"""Exercise resume scoring against evidence, not embedding similarity."""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.resume_review import review_resume

BASE = """Sam Example
sam@example.com
Education
BSc Computer Science, Example University, 2025
Projects
Built a reporting application using Python and PostgreSQL.
Skills
Python, SQL, JavaScript, React, C++
"""


def test_readiness_has_an_auditable_total_and_no_fabricated_job_match():
    result = review_resume(BASE)
    assert 0 <= result["ats_score"] <= 100
    assert result["ats_score"] == sum(check["points"] for check in result["checks"])
    assert sum(check["maximum"] for check in result["checks"]) == 100
    assert result["job_match"] is None
    assert "readiness" in result["score_label"].lower()
    assert any(item["id"] == "evidence" for item in result["suggestions"])
    contact = next(item for item in result["checks"] if item["id"] == "contact")
    assert contact["points"] == 10  # A graduation year is not a phone number.


def test_job_matching_uses_aliases_boundaries_and_explicit_formula():
    result = review_resume(BASE, "Required skills: Python, React, SQL, Docker, Java.")
    match = result["job_match"]
    assert {"Python", "React", "SQL"} <= set(match["matched_keywords"])
    assert {"Docker", "Java"} <= set(match["missing_keywords"])
    assert "Java" not in match["matched_keywords"]  # JavaScript is not Java.
    assert match["score"] == round(100 * len(match["matched_keywords"]) / match["recognized_keywords"])
    assert result["ats_score"] == round(result["readiness_score"] * .4 + match["score"] * .6)
    alias = review_resume(BASE, "Required skills: JS, Python, React, SQL.")
    assert "JavaScript" in alias["job_match"]["matched_keywords"]


def test_repeated_keywords_cannot_inflate_coverage():
    single = review_resume(BASE, "Required skills: Python, Docker.")
    repeated = review_resume(BASE, "Required skills: Python, Python, Python, Docker.")
    assert single["job_match"] == repeated["job_match"]
    stuffed = review_resume(BASE + "\nPython " * 40, "Required skills: Python, Docker.")
    assert stuffed["job_match"]["score"] == single["job_match"]["score"]


def test_unknown_job_terms_have_no_misleading_perfect_score():
    result = review_resume(BASE, "We require zyxwvutsrqpon expertise within qqqqqq.")
    assert result["job_match"]["score"] is None
    assert result["ats_score"] == result["readiness_score"]
    assert "No supported skill terms" in result["job_match"]["note"]


def test_dates_do_not_count_as_measured_achievements():
    result = review_resume(BASE + "\nExperience\nBuilt a tool in 2024.\n")
    assert next(check for check in result["checks"] if check["id"] == "evidence")["points"] == 0
    result = review_resume(BASE + "\nExperience\nReduced reporting time by 30%.\n")
    assert next(check for check in result["checks"] if check["id"] == "evidence")["points"] == 10


def test_non_technical_resume_gets_actionable_checks():
    result = review_resume("""Avery Example
avery@example.com
+92 300 1234567
Education
PharmD, Example University
Experience
Reviewed 120 records during a supervised placement.
Prepared reports for the research team.
Skills
Research, Active Listening
""")
    assert next(check for check in result["checks"] if check["id"] == "contact")["points"] == 20
    assert next(check for check in result["checks"] if check["id"] == "actions")["points"] == 10
    assert next(check for check in result["checks"] if check["id"] == "evidence")["points"] == 10
    assert "licensing" in result["limitations"]


def test_api_review_is_independent_of_embedding_model(monkeypatch):
    from app import main
    monkeypatch.setattr(main, "get_model", lambda: pytest.fail("Review must not load career embeddings"))
    with TestClient(app) as client:
        response = client.post("/api/resume/review", json={"text": BASE})
    assert response.status_code == 200
    assert response.json()["readiness_score"] > 0


@pytest.mark.parametrize("payload", [
    {"text": "too short"},
    {"text": " " * 50},
    {"text": "x" * 100001},
    {"text": BASE, "job_description": "tiny"},
    {"text": BASE, "job_description": "x" * 20001},
])
def test_review_rejects_invalid_inputs(payload):
    with TestClient(app) as client:
        assert client.post("/api/resume/review", json=payload).status_code == 422
