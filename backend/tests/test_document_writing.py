from io import BytesIO
import json

from docx import Document
from fastapi.testclient import TestClient
import httpx
import pytest

from app.main import app
from app import document_writing as writing
from app import learning_plan


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "private-writing-key")
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    learning_plan._requests.clear()
    with TestClient(app) as client:
        yield client
    learning_plan._requests.clear()


def payload(kind="resume"):
    return {
        "kind": kind,
        "profile_reviewed": True,
        "profile": {
            "education": "BSc Information Technology, 2024",
            "experience": "Built a Python reporting tool for a coursework project.",
            "skills": ["Python", "SQL"],
        },
        "job_title": "Junior Developer",
        "company": "Example Company",
        "job_description": "Looking for Python and Kubernetes. Five years of experience preferred.",
    }


def output(kind="resume"):
    return {
        "blocks": [
            {
                "section": "summary" if kind == "resume" else "body",
                "text": "I bring experience building a Python reporting tool for coursework.",
                "source_ids": ["experience_0"],
            },
            {
                "section": "experience" if kind == "resume" else "body",
                "text": "Built a Python reporting tool for a coursework project.",
                "source_ids": ["experience_0"],
            },
        ],
        "questions": ["What outcome can you verify from the project?"],
    }


def mock_google(monkeypatch, data=None, status=200, finish="STOP"):
    calls = []

    def handler(request):
        calls.append(request)
        if status != 200:
            return httpx.Response(status, json={"error": "private-writing-key"})
        raw = data if isinstance(data, str) else json.dumps(data or output())
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {"finishReason": finish, "content": {"parts": [{"text": raw}]}}
                ]
            },
        )

    original = httpx.Client
    monkeypatch.setattr(
        writing.httpx,
        "Client",
        lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs),
    )
    return calls


@pytest.mark.parametrize("kind", ["resume", "cover_letter"])
def test_grounded_draft_has_evidence_and_keeps_job_requirements_separate(
    client, monkeypatch, kind
):
    calls = mock_google(monkeypatch, output(kind))
    response = client.post("/api/documents/draft", json=payload(kind))
    assert response.status_code == 200
    result = response.json()
    assert "coursework" in result["draft"]
    assert "Kubernetes" not in result["draft"]
    assert (
        result["evidence"][0]["sources"][0]["text"]
        == payload()["profile"]["experience"]
    )
    context = json.loads(
        json.loads(calls[0].content)["contents"][0]["parts"][0]["text"]
    )
    assert "Kubernetes" in context["target"]["job_description"]
    assert all(
        "Kubernetes" not in fact["text"] for fact in context["profile_facts"].values()
    )
    if kind == "resume":
        assert "BSc Information Technology, 2024" in result["draft"]
        assert "SKILLS\nPython, SQL" in result["draft"]
    else:
        assert "Junior Developer at Example Company" in result["draft"]
    assert "private-writing-key" not in response.text
    assert "key" not in str(calls[0].url)


@pytest.mark.parametrize(
    "case", ["unreviewed", "empty", "too_long", "too_many_facts", "wrong_kind"]
)
def test_invalid_input_does_not_call_provider(client, monkeypatch, case):
    calls = mock_google(monkeypatch)
    request = payload()
    if case == "unreviewed":
        request["profile_reviewed"] = False
    elif case == "empty":
        request["profile"] = {}
    elif case == "too_long":
        request["job_description"] = "x" * 12001
    elif case == "too_many_facts":
        request["profile"]["experience"] = "\n".join(f"Fact {i}" for i in range(101))
    else:
        request["kind"] = "other"
    assert client.post("/api/documents/draft", json=request).status_code == 422
    assert not calls


@pytest.mark.parametrize(
    "case",
    [
        "missing_key",
        "quota",
        "bad_json",
        "truncated",
        "invented_source",
        "invented_metric",
        "job_as_experience",
        "invalid_section",
    ],
)
def test_unusable_drafts_never_return_partial_or_secret_text(
    client, monkeypatch, caplog, case
):
    data = output()
    if case == "invented_source":
        data["blocks"][0]["source_ids"] = ["job_description"]
    elif case == "invented_metric":
        data["blocks"][1]["text"] = "Improved reporting by 75%."
    elif case == "job_as_experience":
        data["blocks"][1]["source_ids"] = ["skill_0"]
    elif case == "invalid_section":
        data["blocks"][0]["section"] = "body"
    elif case == "bad_json":
        data = "bad json"
    if case == "missing_key":
        monkeypatch.delenv("GEMINI_API_KEY")
    calls = mock_google(
        monkeypatch,
        data,
        status=429 if case == "quota" else 200,
        finish="MAX_TOKENS" if case == "truncated" else "STOP",
    )
    response = client.post("/api/documents/draft", json=payload())
    assert response.status_code == 503
    assert "draft" not in response.json()
    assert "private-writing-key" not in response.text + caplog.text
    if case == "missing_key":
        assert not calls


def test_shared_generation_budget_also_limits_writing(client, monkeypatch):
    calls = mock_google(monkeypatch)
    for _ in range(20):
        with learning_plan.generation_slot():
            pass
    assert client.post("/api/documents/draft", json=payload()).status_code == 503
    assert not calls


@pytest.mark.parametrize("kind", ["resume", "cover_letter"])
def test_word_export_contains_actual_edits_without_ai(client, monkeypatch, kind):
    monkeypatch.delenv("GEMINI_API_KEY")
    response = client.post(
        "/api/documents/export",
        json={
            "kind": kind,
            "text": "[My name]\nSUMMARY\nMy personally edited introduction.\n• Built a real project.\n\x00",
        },
    )
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert ".docx" in response.headers["content-disposition"]
    text = "\n".join(p.text for p in Document(BytesIO(response.content)).paragraphs)
    assert "My personally edited introduction." in text
    assert "Built a real project." in text


@pytest.mark.parametrize("text", ["", "   ", "x" * 20001])
def test_export_rejects_empty_or_oversized_text(client, text):
    assert (
        client.post(
            "/api/documents/export", json={"kind": "resume", "text": text}
        ).status_code
        == 422
    )
