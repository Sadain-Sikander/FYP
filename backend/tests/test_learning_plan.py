import copy
import json

import httpx
import pytest

from app import learning_plan as learning


@pytest.fixture
def context(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "private-test-key")
    monkeypatch.setenv("YOUTUBE_API_KEY", "youtube-test-key")
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    learning._requests.clear()
    learning._video_cache.clear()
    starter = {
        "career": {"id": "test", "title": "Software Developer"},
        "duration_weeks": 2,
        "priority_skill_gaps": [{"name": "SQL"}, {"name": "Testing"}],
        "milestones": [{"week": 1, "title": "Starter", "tasks": ["Review the role"]}],
        "note": "Starter outline",
    }
    profile = {
        "user_skills": ["Python"],
        "confirmed_skills": [],
        "education": "IT",
        "experience": "Student projects",
    }
    yield starter, profile
    learning._requests.clear()
    learning._video_cache.clear()


def generated():
    return {
        "summary": "Build reliable database features with four hours of practice each week.",
        "milestones": [
            {
                "week": 1,
                "title": "Query a small dataset",
                "skill_ids": [0],
                "tasks": [
                    "Write five SELECT queries.",
                    "Compare query results with expected rows.",
                ],
                "project": "Publish five queries and their expected output.",
            },
            {
                "week": 2,
                "title": "Test the feature",
                "skill_ids": [1],
                "tasks": [
                    "Write tests for the database feature.",
                    "Exercise empty and invalid input.",
                ],
                "project": "Deliver passing tests and document the edge cases.",
            },
        ],
    }


def mock_remote(monkeypatch, plan=None, fail=None, finish="STOP"):
    calls = []

    def respond(request):
        calls.append(request)
        if fail and fail in request.url.host:
            return httpx.Response(
                429, json={"error": "private-test-key must never reach browser"}
            )
        if "generativelanguage" in request.url.host:
            output = (
                plan
                if isinstance(plan, str)
                else json.dumps(plan if plan is not None else generated())
            )
            return httpx.Response(
                200,
                json={
                    "candidates": [
                        {
                            "finishReason": finish,
                            "content": {"parts": [{"text": output}]},
                        }
                    ]
                },
            )
        if request.url.path.endswith("/search"):
            return httpx.Response(
                200,
                json={
                    "items": [
                        {"id": {"videoId": "abc123DEF45"}},
                        {"id": {"videoId": "xyz123DEF45"}},
                        {"id": {"videoId": "javascript:evil"}},
                    ]
                },
            )
        return httpx.Response(
            200,
            json={
                "items": [
                    {
                        "id": "abc123DEF45",
                        "status": {"embeddable": True, "privacyStatus": "public"},
                        "snippet": {
                            "title": "SQL &amp; testing lesson",
                            "channelTitle": "Example instructor",
                        },
                        "contentDetails": {"duration": "PT12M"},
                    },
                    {
                        "id": "xyz123DEF45",
                        "status": {"embeddable": False, "privacyStatus": "private"},
                        "snippet": {"title": "Unavailable video"},
                    },
                ]
            },
        )

    client = httpx.Client
    monkeypatch.setattr(
        learning.httpx,
        "Client",
        lambda **kwargs: client(transport=httpx.MockTransport(respond), **kwargs),
    )
    return calls


def test_generated_plan_uses_grounded_targets_and_real_video_metadata(
    context, monkeypatch
):
    calls = mock_remote(monkeypatch)
    starter, profile = context
    plan = learning.enhance_roadmap(starter, profile)
    assert plan["generation"] == "personalized"
    assert [w["skills"] for w in plan["milestones"]] == [["SQL"], ["Testing"]]
    assert plan["priority_skill_gaps"] == starter["priority_skill_gaps"]
    assert plan["milestones"][0]["lessons"] == [
        {
            "id": "abc123DEF45",
            "title": "SQL & testing lesson",
            "channel": "Example instructor",
            "duration": "PT12M",
            "url": "https://www.youtube.com/watch?v=abc123DEF45",
        }
    ]
    assert plan["lesson_status"] == "available"
    body = json.loads(calls[0].content)
    prompt = json.loads(body["contents"][0]["parts"][0]["text"])
    assert prompt["known_skills"] == ["Python"]
    assert [s["name"] for s in prompt["learning_targets"]] == ["SQL", "Testing"]
    assert "key" not in str(calls[0].url)
    assert calls[0].headers["x-goog-api-key"] == "private-test-key"
    assert "private-test-key" not in json.dumps(plan)
    assert "youtube-test-key" not in json.dumps(plan)


@pytest.mark.parametrize(
    "case",
    [
        "bad_json",
        "unknown_skill",
        "missing_week",
        "missing_target",
        "long_task",
        "truncated",
    ],
)
def test_invalid_generation_returns_honest_starter(context, monkeypatch, case):
    plan = generated()
    if case == "unknown_skill":
        plan["milestones"][0]["skill_ids"] = [999]
    elif case == "missing_week":
        plan["milestones"][1]["week"] = 3
    elif case == "missing_target":
        plan["milestones"][1]["skill_ids"] = [0]
    elif case == "long_task":
        plan["milestones"][0]["tasks"] = ["x" * 401, "Practice"]
    elif case == "bad_json":
        plan = "not json"
    calls = mock_remote(
        monkeypatch, plan, finish="MAX_TOKENS" if case == "truncated" else "STOP"
    )
    result = learning.enhance_roadmap(*context)
    assert result["generation"] == "starter" and result["notice"]
    assert len(calls) == 1
    assert result["priority_skill_gaps"] == context[0]["priority_skill_gaps"]


def test_missing_keys_make_no_network_calls(context, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY")
    calls = mock_remote(monkeypatch)
    plan = learning.enhance_roadmap(*context)
    assert not calls
    assert plan["generation"] == "starter" and plan["lesson_status"] == "search_only"
    assert plan["milestones"][0]["lesson_search_url"].startswith(
        "https://www.youtube.com/results?search_query="
    )


@pytest.mark.parametrize(
    "host", ["generativelanguage.googleapis.com", "www.googleapis.com"]
)
def test_provider_outages_preserve_plan_without_leaking_error(
    context, monkeypatch, host, caplog
):
    mock_remote(monkeypatch, fail=host)
    plan = learning.enhance_roadmap(*context)
    assert plan["generation"] == (
        "starter" if "generativelanguage" in host else "personalized"
    )
    assert plan["lesson_status"] == "search_only"
    assert "private-test-key" not in json.dumps(plan)
    assert "private-test-key" not in caplog.text
    assert "youtube-test-key" not in caplog.text
    assert "http_429" in caplog.text


def test_video_cache_reuses_only_public_search_results(context, monkeypatch):
    calls = mock_remote(monkeypatch)
    first = learning.find_videos("SQL tutorial", "test")
    second = learning.find_videos("SQL tutorial", "test")
    assert first == second and len(calls) == 2


def test_process_budget_blocks_external_calls(context, monkeypatch):
    calls = mock_remote(monkeypatch)
    for _ in range(20):
        with learning.generation_slot():
            pass
    result = learning.enhance_roadmap(*context)
    assert not calls and result["generation"] == "starter"


def test_no_skill_gaps_builds_application_plan(context, monkeypatch):
    starter, profile = copy.deepcopy(context)
    starter["priority_skill_gaps"] = []
    plan = generated()
    for week in plan["milestones"]:
        week["skill_ids"] = []
    mock_remote(monkeypatch, plan)
    assert learning.enhance_roadmap(starter, profile)["generation"] == "personalized"
