import math
import numpy as np
import pytest
from fastapi.testclient import TestClient
import app.main as api
from app.skill_matching import match_skills, evidence_items, SEMANTIC_THRESHOLD


class SimilarModel:
    def encode(self, texts, **kwargs):
        return np.array([[1.0, 0.0] for _ in texts])


def match(required, supplied=(), **kwargs):
    return match_skills(
        [{"name": s} for s in required],
        list(supplied),
        model_provider=lambda: SimilarModel(),
        **kwargs,
    )


def test_aliases_are_explicit_but_semantic_evidence_needs_confirmation():
    direct, semantic = match(
        ["JavaScript", "backend development"],
        ["JS"],
        experience="Built REST APIs with Django.",
    )["skills"]
    assert direct["status"] == "matched" and direct["method"] == "explicit_skill"
    assert (
        semantic["status"] == "needs_confirmation" and semantic["method"] == "semantic"
    )
    assert semantic["evidence"]["text"] in ["JS", "Built REST APIs with Django."]
    assert semantic["similarity"] == 1


def test_fuzzy_subsets_are_not_automatically_covered():
    result = match(["advanced Python programming"], ["Python programming"])["skills"][0]
    assert (
        result["status"] == "needs_confirmation"
        and result["method"] == "similar_wording"
    )


@pytest.mark.parametrize(
    "text",
    [
        "I have no Python experience.",
        "I want to learn Python.",
        "I am learning how to use Python.",
        "I never used Python.",
        "I am interested in Python.",
    ],
)
def test_negation_and_aspirations_do_not_become_evidence(text):
    result = match(["Python"], experience=text)["skills"][0]
    assert result["status"] == "not_found" and result["evidence"] is None


def test_machine_learning_is_not_mistaken_for_an_aspiration():
    assert (
        match(["machine learning"], ["Machine Learning"])["skills"][0]["status"]
        == "matched"
    )


def test_quote_is_an_unchanged_complete_sentence_from_the_right_source():
    result = match(
        ["communication"], experience="I led meetings. I want to learn sales."
    )["skills"][0]
    assert result["evidence"] == {"source": "experience", "text": "I led meetings."}


def test_review_decisions_override_inference_and_can_be_reconsidered():
    confirmed = match(["database management"], confirmed=["database management"])[
        "skills"
    ][0]
    assert confirmed["method"] == "user_confirmed" and confirmed["status"] == "matched"
    assert (
        match(
            ["database management"],
            experience="Managed databases.",
            dismissed=["database management"],
        )["skills"][0]["status"]
        == "dismissed"
    )
    assert (
        match(["database management"], experience="Managed databases.")["skills"][0][
            "status"
        ]
        == "needs_confirmation"
    )


def test_model_failure_preserves_direct_matches_and_reports_fallback():
    def unavailable():
        raise RuntimeError("offline")

    result = match_skills(
        [{"name": "Python"}, {"name": "data analysis"}],
        ["Python"],
        model_provider=unavailable,
    )
    assert result["engine"] == "rules_fallback"
    assert (
        result["skills"][0]["status"] == "matched"
        and result["skills"][1]["status"] == "not_found"
    )


def test_empty_profile_does_not_load_model():
    def forbidden():
        pytest.fail("Model should not load without evidence")

    assert (
        match_skills([{"name": "Python"}], [], model_provider=forbidden)["skills"][0][
            "status"
        ]
        == "not_found"
    )


def test_similarity_boundary_and_normalization():
    class BoundaryModel:
        def encode(self, texts, **kwargs):
            t = SEMANTIC_THRESHOLD - 0.01
            return np.array([[10.0, 0.0], [t, math.sqrt(1 - t * t)]])

    result = match_skills(
        [{"name": "technical writing"}],
        [],
        experience="Authored installation guides.",
        model_provider=lambda: BoundaryModel(),
    )
    assert result["skills"][0]["status"] == "not_found"


def test_long_evidence_and_excess_lines_are_bounded():
    items = evidence_items(
        [],
        "\n".join([f"I completed distinct project {i}." for i in range(100)])
        + "\n"
        + "a" * 501,
    )
    assert len(items) == 24
    assert all(len(e["text"]) <= 500 for e in items)


@pytest.fixture
def skill_api(monkeypatch):
    monkeypatch.setattr(
        api,
        "get_career",
        lambda _: {"id": "role", "title": "Developer", "source": "ESCO"},
    )
    monkeypatch.setattr(
        api,
        "get_role_skills",
        lambda _: (
            [{"name": "Python"}, {"name": "backend development"}],
            [{"name": "Git"}],
        ),
    )
    monkeypatch.setattr(api, "get_model", lambda: SimilarModel())
    return TestClient(api.app)


def test_coverage_and_roadmap_keep_unconfirmed_skills_then_use_confirmation(skill_api):
    payload = {
        "career_id": "role",
        "user_skills": ["Python"],
        "experience": "Built REST APIs with Django.",
    }
    gap = skill_api.post("/api/skill-gap", json=payload).json()
    assert gap["coverage_percent"] == 50
    assert [s["name"] for s in gap["suggested_matches"]] == ["backend development"]
    assert gap["optional_skills"][0]["name"] == "Git"
    assert (
        skill_api.post("/api/roadmap", json=payload).json()["priority_skill_gaps"][0][
            "name"
        ]
        == "backend development"
    )
    reviewed = {**payload, "confirmed_skills": ["backend development"]}
    assert (
        skill_api.post("/api/skill-gap", json=reviewed).json()["coverage_percent"]
        == 100
    )
    updated = skill_api.post("/api/roadmap", json=reviewed).json()
    assert all(
        s["name"] != "backend development" for s in updated["priority_skill_gaps"]
    )
    assert len(updated["milestones"]) == 4
    all_confirmed = {**payload, "confirmed_skills": ["backend development", "Git"]}
    assert (
        skill_api.post("/api/roadmap", json=all_confirmed).json()["priority_skill_gaps"]
        == []
    )


@pytest.mark.parametrize(
    "extra",
    [
        {"user_skills": ["x"] * 81},
        {"user_skills": ["x" * 201]},
        {"experience": "x" * 6001},
        {"education": "x" * 6001},
        {"confirmed_skills": ["x"] * 51},
    ],
)
def test_api_rejects_unbounded_inputs(skill_api, extra):
    assert (
        skill_api.post(
            "/api/skill-gap", json={"career_id": "role", **extra}
        ).status_code
        == 422
    )
