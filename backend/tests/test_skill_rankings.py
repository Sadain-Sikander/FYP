import gzip
import json
import numpy as np
import pytest
import app.main as api
import app.role_skills as skills


@pytest.fixture
def isolated_index(monkeypatch, tmp_path):
    path = tmp_path / "rankings.json.gz"
    monkeypatch.setattr(skills, "RANKING_PATH", path)
    skills.precomputed_rankings.cache_clear()
    skills.ranked_indices.cache_clear()
    yield path
    skills.precomputed_rankings.cache_clear()
    skills.ranked_indices.cache_clear()


def write_index(path, order, **overrides):
    data = {
        "version": skills.RANKING_VERSION,
        "model": skills.MODEL_NAME,
        "rankings": {skills.ranking_key("test context", ("first", "second")): order},
        **overrides,
    }
    path.write_bytes(gzip.compress(json.dumps(data).encode()))


def test_prebuilt_rankings_do_not_load_or_call_model(isolated_index):
    write_index(isolated_index, [1, 0])

    def forbidden():
        pytest.fail("A known catalogue ranking must not load the model")

    assert skills.ranked_indices("test context", ("first", "second"), forbidden) == (
        1,
        0,
    )


@pytest.mark.parametrize(
    "case",
    [
        "missing",
        "corrupt",
        "version",
        "model",
        "duplicate",
        "wrong_count",
        "wrong_type",
    ],
)
def test_unusable_index_falls_back_without_breaking_requests(isolated_index, case):
    if case == "corrupt":
        isolated_index.write_bytes(b"not gzip")
    elif case != "missing":
        order = {"duplicate": [0, 0], "wrong_count": [0], "wrong_type": ["0", "1"]}.get(
            case, [1, 0]
        )
        overrides = (
            {"version": 999}
            if case == "version"
            else {"model": "other-model"} if case == "model" else {}
        )
        write_index(isolated_index, order, **overrides)
    calls = []

    class Model:
        def encode(self, texts, **kwargs):
            calls.append(texts)
            return np.array([[1.0, 0.0], [1.0, 0.0], [0.0, 1.0]])

    assert skills.ranked_indices(
        "test context", ("first", "second"), lambda: Model()
    ) == (0, 1)
    assert calls == [["test context", "first", "second"]]


def test_cache_keys_change_with_public_role_or_skill_content():
    original = skills.ranking_key("role", ("skill",))
    assert original != skills.ranking_key("different role", ("skill",))
    assert original != skills.ranking_key("role", ("updated skill",))


@pytest.mark.parametrize(
    "cid", ["15-2051.00", "29-1141.00", "47-2111.00", "27-1024.00"]
)
def test_shipped_index_needs_only_one_profile_encoding_for_discovery(monkeypatch, cid):
    position = api.careers.index[api.careers.id == cid][0]
    calls = []

    class Model:
        def encode(self, texts, **kwargs):
            calls.append(texts)
            return np.repeat(
                api.career_embeddings[position][None, :], len(texts), axis=0
            )

    monkeypatch.setattr(api, "get_model", lambda: Model())
    skills.ranked_indices.cache_clear()
    result = api.discovery_skills(
        api.DiscoverySkillsRequest(role=api.get_career(cid)["title"])
    )
    assert len(result["skills"]) == 12
    assert len(calls) == 1 and len(calls[0]) == 1


def test_shipped_index_manifest_matches_sources():
    import hashlib

    manifest = json.loads(
        skills.RANKING_PATH.with_name("skill_rankings_manifest.json").read_text()
    )
    assert manifest["career_records"] == len(api.careers)
    assert manifest["ranking_count"] == len(skills.precomputed_rankings())
    for filename, digest in manifest["source_sha256"].items():
        assert (
            hashlib.sha256((api.DATA_DIR / filename).read_bytes()).hexdigest() == digest
        )
