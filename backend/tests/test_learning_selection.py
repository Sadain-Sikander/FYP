from copy import deepcopy

from fastapi.testclient import TestClient
import pytest

from app import main
from app.skill_matching import normalize_skill


@pytest.fixture
def client(monkeypatch):
    gap = {"career": {"id": "role", "title": "Analyst", "source": "test"}, "skill_gaps": [{"name": "SQL"}, {"name": "Statistics"}], "optional_skills": [{"name": "Research", "status": "missing"}]}
    monkeypatch.setattr(main, "build_gap_result", lambda **kwargs: deepcopy(gap))
    monkeypatch.setattr(main, "enhance_roadmap", lambda starter, profile: starter)
    return TestClient(main.app)


@pytest.mark.parametrize("selected,expected", [(["SQL"], ["SQL"]), ([], []), (["SQL", "SQL"], ["SQL"])])
def test_roadmap_uses_only_selected_missing_skills(client, selected, expected):
    result = client.post("/api/roadmap", json={"career_id": "role", "learning_skills": selected})
    assert result.status_code == 200
    assert [skill["name"] for skill in result.json()["priority_skill_gaps"]] == expected


def test_unknown_learning_skills_are_rejected(client):
    assert client.post("/api/roadmap", json={"career_id": "role", "learning_skills": ["Made up skill"]}).status_code == 422


def test_old_clients_still_receive_default_targets(client):
    result = client.post("/api/roadmap", json={"career_id": "role"})
    assert {skill["name"] for skill in result.json()["priority_skill_gaps"]} == {"SQL", "Statistics"}


def test_visualisation_aliases_match_without_equating_related_fields():
    assert normalize_skill("Data visualization") == normalize_skill("deliver visual presentation of data")
    assert normalize_skill("Data science") != normalize_skill("Data engineering")
