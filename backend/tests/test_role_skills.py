import numpy as np
import pytest
import app.main as api
from app.role_skills import catalogue, esco_index, learning_targets, title_key


class FlatModel:
    def encode(self, texts, **kwargs):
        return np.ones((len(texts), 3))


@pytest.mark.parametrize(
    "cid",
    [
        "15-2051.00",
        "15-1252.00",
        "29-1141.00",
        "47-2111.00",
        "27-1024.00",
        "17-2051.00",
        "35-1011.00",
    ],
)
def test_traceable_priorities_across_domains(cid):
    career = api.get_career(cid)
    primary, extra, support = catalogue(
        career, api.load_csv, api.careers, lambda: FlatModel()
    )
    assert primary and len(primary) <= 24 and len(extra) <= 20
    assert len({s["name"].lower() for s in primary}) == len(primary)
    software = api.load_csv("onet_software_skills.csv")
    labels = set(software[software["O*NET-SOC Code"] == cid]["Workplace Example"])
    for skill in primary + extra + support:
        assert skill["source_url"].startswith(
            ("https://www.onetonline.org/", "http://data.europa.eu/esco/")
        )
        if skill["category"] == "tools":
            assert skill["source_label"] in labels
            assert skill["source_occupation"] == career["title"]
        if skill["source"] == "ESCO":
            assert skill["basis"] == "matching ESCO title or alias"
    assert all(s["category"] == "foundation" for s in support)


def test_data_science_tools_and_separate_foundations():
    primary, _, support = catalogue(
        api.get_career("15-2051.00"), api.load_csv, api.careers, lambda: FlatModel()
    )
    names = {s["name"] for s in primary}
    assert {"Python", "SQL"}.issubset(names)
    assert "Critical Thinking" not in names
    assert "Critical Thinking" in {s["name"] for s in support}
    assert any(s["source"] == "ESCO" for s in primary)
    assert "Development environment software" not in names


def test_esco_uses_its_own_relations():
    career = (
        api.careers[
            (api.careers.source == "ESCO") & (api.careers.title == "electrician")
        ]
        .iloc[0]
        .to_dict()
    )
    primary, extra, support = catalogue(
        career, api.load_csv, api.careers, lambda: FlatModel()
    )
    relations = api.load_csv("esco_occupation_skill_relations.csv")
    labels = set(relations[relations.occupationUri == career["id"]].skillLabel)
    assert all(
        s["name"] in labels and s["basis"] == "selected occupation"
        for s in primary + extra
    )
    assert not support


def test_nursing_does_not_inherit_assistant_requirements():
    groups = catalogue(
        api.get_career("29-1141.00"), api.load_csv, api.careers, lambda: FlatModel()
    )
    assert all(
        s["source_occupation"] != "nurse assistant" for group in groups for s in group
    )


def test_model_outage_preserves_catalogue():
    def unavailable():
        raise RuntimeError("offline")

    primary, _, _ = catalogue(
        api.get_career("15-2051.00"), api.load_csv, api.careers, unavailable
    )
    assert {"Python", "SQL"}.issubset({s["name"] for s in primary})


def test_roadmap_balances_role_skills_and_tools():
    candidates = [{"name": f"Skill {i}", "category": "role"} for i in range(12)] + [
        {"name": "SQL", "category": "tools"}
    ]
    result = learning_targets(candidates)
    assert len(result) == 12 and "SQL" in [s["name"] for s in result]


def test_title_match_uses_published_aliases_without_fuzzy_role_matching():
    assert title_key("Data Scientists") == title_key("data scientist")
    assert title_key("Registered Nurses") != title_key("nurse assistant")
    _, preferred, aliases = esco_index(api.load_csv)
    assert title_key("technical writer") in aliases
    assert title_key("electrician") in preferred


def test_api_counts_python_and_sql_and_removes_them_from_roadmap(monkeypatch):
    monkeypatch.setattr(api, "get_model", lambda: FlatModel())
    result = api.build_gap_result("15-2051.00", ["Python", "SQL"])
    assert {"Python", "SQL"}.issubset({s["name"] for s in result["matched_skills"]})
    assert result["coverage_percent"] > 0
    plan = api.generate_roadmap(
        api.RoadmapRequest(career_id="15-2051.00", user_skills=["Python", "SQL"])
    )
    assert not {"Python", "SQL"} & {s["name"] for s in plan["priority_skill_gaps"]}
