"""Contextual suggestions must be grounded in the supplied occupational data."""
import numpy as np
import pandas as pd
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
import app.main as api

client = TestClient(api.app)

@pytest.fixture
def catalogue(monkeypatch):
    monkeypatch.setattr(api, "careers", pd.DataFrame([
        {"id": "tech", "title": "Developer", "description": "Build software", "source": "ESCO"},
        {"id": "nurse", "title": "Nurse", "description": "Care for patients", "source": "O*NET"},
        {"id": "tech", "title": "Developer duplicate", "description": "Build software", "source": "ESCO"},
    ]))
    monkeypatch.setattr(api, "career_embeddings", np.array([[1., 0.], [0., 1.], [1., 0.]]))
    queries = []
    class Model:
        def encode(self, texts, **kwargs):
            queries.extend(texts)
            return np.array([[1., 0.] if "Technology" in text else [0., 1.] for text in texts])
    monkeypatch.setattr(api, "get_model", lambda: Model())
    def skills(career):
        prefix = "Software" if career["id"] == "tech" else "Patient care"
        essential = [{"name": f"{prefix} skill {i}"} for i in range(14)]
        return essential, [{"name": essential[0]["name"].upper()}, {"name": f"{prefix} tool"}]
    monkeypatch.setattr(api, "get_role_skills", skills)
    return queries

def test_student_subject_drives_grounded_deduplicated_suggestions(catalogue):
    response = client.post("/api/discovery/skills", json={"role": "Student", "education": "Bachelor’s degree · Information Technology"})
    assert response.status_code == 200
    data = response.json()
    assert len(data["skills"]) == 12
    names = [s["name"].lower() for s in data["skills"]]
    assert len(names) == len(set(names))
    assert names[0].startswith("software")
    assert data["skills"][0]["sources"] == ["ESCO"]
    assert "Information Technology" in catalogue[0]
    assert "Student" not in catalogue[0]
    nurse = client.post("/api/discovery/skills", json={"role": "Nurse"}).json()
    assert nurse["skills"][0]["name"].startswith("Patient care")

def test_regeneration_uses_next_batch_without_inventing_skills(catalogue):
    payload = {"role": "Developer", "education": "Information Technology"}
    first = client.post("/api/discovery/skills", json=payload).json()
    second = client.post("/api/discovery/skills", json={**payload, "offset": first["next_offset"]}).json()
    assert first["skills"] != second["skills"]
    assert all(s["sources"] for s in second["skills"])

@pytest.mark.parametrize("payload", [{}, {"role": "x" * 51}, {"role": "Nurse", "offset": -1}, {"education": "x" * 6001}])
def test_suggestion_inputs_are_bounded(payload):
    assert client.post("/api/discovery/skills", json=payload).status_code == 422

def test_model_failure_can_be_retried_without_fabricated_success(monkeypatch):
    def unavailable():
        raise HTTPException(status_code=503, detail="Model unavailable")
    monkeypatch.setattr(api, "get_model", unavailable)
    response = client.post("/api/discovery/skills", json={"role": "Nurse"})
    assert response.status_code == 503
    assert response.json()["detail"] == "Model unavailable"

def test_edited_identity_is_part_of_the_career_query(catalogue):
    response = client.post("/api/careers/recommend", json={"identity_statement": "Information Technology is my next direction.", "top_k": 2})
    assert response.status_code == 200
    assert "Information Technology is my next direction." in catalogue[0]
    assert "Career identity:" not in catalogue[0]
    assert "Career identity:" in response.json()["profile_summary"]
    assert len(response.json()["results"]) == 2
