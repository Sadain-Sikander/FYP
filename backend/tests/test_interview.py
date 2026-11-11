import json

from fastapi.testclient import TestClient
import httpx
import pytest

from app.main import app
from app import interview, learning_plan


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "private-interview-key")
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    monkeypatch.delenv("CAREERBRIDGE_PRELOAD_MODEL", raising=False)
    learning_plan._requests.clear()
    with TestClient(app) as client:
        yield client
    learning_plan._requests.clear()


def question_output():
    return {
        "questions": [
            {
                "category": category,
                "question": f"Practice question about {category}?",
                "hint": "Use a real example.",
            }
            for category in interview.CATEGORIES
        ]
    }


def payload(review=False):
    request = {
        "job_title": "Registered Nurse",
        "profile_reviewed": True,
        "profile": {
            "education": "Nursing degree",
            "experience": "Supervised student placement",
            "skills": ["Patient communication"],
        },
    }
    if review:
        request.update(
            question=question_output()["questions"][0],
            answer="During my supervised placement, I clarified the task with my supervisor and checked the result together.",
        )
    return request


def feedback_output():
    return {
        "summary": "You explain how you sought support. Add the context.",
        "strengths": [
            {
                "quote": "clarified the task with my supervisor",
                "comment": "You name a specific action.",
            }
        ],
        "improvements": ["Explain what needed clarification."],
        "outline": [
            "Describe the situation briefly.",
            "Explain your action and what you learned.",
        ],
        "follow_up": "What would you do differently next time?",
    }


def mock_provider(monkeypatch, data, status=200, finish="STOP"):
    calls = []

    def handler(request):
        calls.append(request)
        if status != 200:
            return httpx.Response(status, json={"error": "private-interview-key"})
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "finishReason": finish,
                        "content": {
                            "parts": [
                                {
                                    "text": (
                                        data
                                        if isinstance(data, str)
                                        else json.dumps(data)
                                    )
                                }
                            ]
                        },
                    }
                ]
            },
        )

    original = httpx.Client
    monkeypatch.setattr(
        interview.httpx,
        "Client",
        lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs),
    )
    return calls


def test_questions_use_profile_and_return_five_distinct_stable_ids(client, monkeypatch):
    calls = mock_provider(monkeypatch, question_output())
    response = client.post("/api/interview/questions", json=payload())
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json()["generation"] == "personalized"
    assert [q["id"] for q in response.json()["questions"]] == [
        "q1",
        "q2",
        "q3",
        "q4",
        "q5",
    ]
    context = json.loads(
        json.loads(calls[0].content)["contents"][0]["parts"][0]["text"]
    )
    assert context["job_title"] == "Registered Nurse"
    assert context["profile"]["experience"] == "Supervised student placement"
    assert "key=" not in str(calls[0].url)
    assert "private-interview-key" not in response.text


def test_feedback_is_grounded_in_the_answer_and_does_not_assign_a_score(
    client, monkeypatch
):
    calls = mock_provider(monkeypatch, feedback_output())
    response = client.post("/api/interview/feedback", json=payload(True))
    assert response.status_code == 200
    result = response.json()
    assert result["strengths"][0]["quote"] in payload(True)["answer"]
    assert "score" not in result
    assert response.headers["cache-control"] == "no-store"
    context = json.loads(
        json.loads(calls[0].content)["contents"][0]["parts"][0]["text"]
    )
    assert context["answer"] == payload(True)["answer"]


@pytest.mark.parametrize(
    "case",
    [
        "missing_key",
        "quota",
        "invalid_json",
        "truncated",
        "duplicate",
        "wrong_category",
        "blank_question",
    ],
)
def test_questions_fall_back_honestly_without_leaking_errors(
    client, monkeypatch, caplog, case
):
    data = question_output()
    if case == "missing_key":
        monkeypatch.delenv("GEMINI_API_KEY")
    elif case == "invalid_json":
        data = "private-interview-key"
    elif case == "duplicate":
        for q in data["questions"]:
            q["question"] = "Same question?"
    elif case == "wrong_category":
        data["questions"][0]["category"] = "Reflection"
    elif case == "blank_question":
        data["questions"][0]["question"] = "   "
    calls = mock_provider(
        monkeypatch,
        data,
        status=429 if case == "quota" else 200,
        finish="MAX_TOKENS" if case == "truncated" else "STOP",
    )
    response = client.post("/api/interview/questions", json=payload())
    assert response.status_code == 200
    assert response.json()["generation"] == "starter"
    assert len(response.json()["questions"]) == 5
    assert "unavailable" in response.json()["notice"]
    assert "private-interview-key" not in response.text + caplog.text
    if case == "missing_key":
        assert not calls


@pytest.mark.parametrize(
    "case",
    [
        "missing_key",
        "quota",
        "invalid_json",
        "truncated",
        "invented_quote",
        "blank_summary",
    ],
)
def test_unreliable_feedback_is_not_returned(client, monkeypatch, caplog, case):
    data = feedback_output()
    if case == "missing_key":
        monkeypatch.delenv("GEMINI_API_KEY")
    elif case == "invalid_json":
        data = "private-interview-key"
    elif case == "invented_quote":
        data["strengths"][0]["quote"] = "I increased productivity by 80%."
    elif case == "blank_summary":
        data["summary"] = "   "
    calls = mock_provider(
        monkeypatch,
        data,
        status=429 if case == "quota" else 200,
        finish="MAX_TOKENS" if case == "truncated" else "STOP",
    )
    response = client.post("/api/interview/feedback", json=payload(True))
    assert response.status_code == 503
    assert "summary" not in response.json()
    assert "private-interview-key" not in response.text + caplog.text
    if case == "missing_key":
        assert not calls


@pytest.mark.parametrize(
    "case",
    [
        "unreviewed",
        "empty_role",
        "long_role",
        "long_profile",
        "short_answer",
        "blank_answer",
        "long_answer",
    ],
)
def test_invalid_input_is_rejected_before_calling_provider(client, monkeypatch, case):
    calls = mock_provider(monkeypatch, feedback_output())
    request = payload(True)
    if case == "unreviewed":
        request["profile_reviewed"] = False
    elif case == "empty_role":
        request["job_title"] = "   "
    elif case == "long_role":
        request["job_title"] = "x" * 161
    elif case == "long_profile":
        request["profile"]["experience"] = "x" * 6001
    elif case == "short_answer":
        request["answer"] = "Yes."
    elif case == "blank_answer":
        request["answer"] = " " * 30
    else:
        request["answer"] = "x" * 5001
    assert client.post("/api/interview/feedback", json=request).status_code == 422
    assert not calls


def test_interview_uses_the_shared_generation_budget(client, monkeypatch):
    calls = mock_provider(monkeypatch, feedback_output())
    for _ in range(20):
        with learning_plan.generation_slot():
            pass
    assert (
        client.post("/api/interview/questions", json=payload()).json()["generation"]
        == "starter"
    )
    assert client.post("/api/interview/feedback", json=payload(True)).status_code == 503
    assert not calls
