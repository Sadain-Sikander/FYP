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
                "lesson_topic": "SQL SELECT queries and filtering",
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
                "lesson_topic": "Database testing project and edge cases",
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
    assert plan["lesson_status"] == "partial"
    assert plan["milestones"][1]["lesson_status"] == "no_distinct_result"
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
    assert len([c for c in calls if "generativelanguage" in c.url.host]) == 1
    assert result["milestones"][0][
        "lessons"
    ]  # Gemini failure must not disable YouTube.
    assert result["priority_skill_gaps"] == context[0]["priority_skill_gaps"]


def test_missing_keys_make_no_network_calls(context, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY")
    monkeypatch.delenv("YOUTUBE_API_KEY")
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
    assert plan["lesson_status"] == (
        "available" if "generativelanguage" in host else "search_only"
    )
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


def test_youtube_only_configuration_gets_players(context, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY")
    calls = mock_remote(monkeypatch)
    plan = learning.enhance_roadmap(*context)
    assert plan["generation"] == "starter"
    assert plan["milestones"][0]["lessons"]
    assert all("generativelanguage" not in c.url.host for c in calls)


def test_missing_youtube_key_keeps_personalized_plan(context, monkeypatch):
    monkeypatch.delenv("YOUTUBE_API_KEY")
    calls = mock_remote(monkeypatch)
    plan = learning.enhance_roadmap(*context)
    assert plan["generation"] == "personalized" and len(calls) == 1
    assert all(w["lesson_status"] == "not_configured" for w in plan["milestones"])


@pytest.mark.parametrize(
    "career", ["Data Scientist", "Registered Nurse", "Electrician", "Graphic Designer"]
)
def test_every_week_has_stage_specific_search_even_after_week_four(
    context, monkeypatch, career
):
    plan = copy.deepcopy(context[0])
    plan["career"]["title"] = career
    plan["duration_weeks"] = 12
    plan["milestones"] = [
        {
            "week": i + 1,
            "title": f"Topic {i + 1}",
            "lesson_topic": f"Skill exercise {i + 1}",
            "skills": ["Research"],
        }
        for i in range(12)
    ]
    calls = []

    def videos(query, key):
        calls.append(query)
        number = int(query.split()[2])
        return [{"id": f"video_{number:05}", "title": query}]

    monkeypatch.setattr(learning, "find_videos", videos)
    result = learning.attach_lessons(plan, "key")
    assert len(calls) == 12
    assert all(w["lessons"] for w in result["milestones"])
    assert len({v["id"] for w in result["milestones"] for v in w["lessons"]}) == 12
    assert "beginner fundamentals" in result["milestones"][0]["lessons"][0]["title"]
    assert (
        "project tutorial case study" in result["milestones"][-1]["lessons"][0]["title"]
    )
    assert result["milestones"][-1]["builds_on_week"] == 11
    assert {w["learning_stage"] for w in result["milestones"]} == {
        s[0] for s in learning.STAGES
    }
    assert "lessons" not in plan["milestones"][0]  # Do not mutate saved/starter input.


def test_repeated_candidates_are_distributed_without_repeating_videos(
    context, monkeypatch
):
    plan = copy.deepcopy(context[0])
    plan["milestones"] = [
        {"week": i + 1, "title": "Practice", "skills": ["SQL"]} for i in range(4)
    ]
    candidates = [{"id": f"video_{i:05}", "title": f"Lesson {i}"} for i in range(8)]
    monkeypatch.setattr(learning, "find_videos", lambda *args: candidates)
    result = learning.attach_lessons(plan, "key")
    assert all(len(w["lessons"]) == 2 for w in result["milestones"])
    assert [w["lessons"][0]["id"] for w in result["milestones"]] == [
        v["id"] for v in candidates[:4]
    ]
    assert len({v["id"] for w in result["milestones"] for v in w["lessons"]}) == 8


def test_empty_results_are_explained(context, monkeypatch):
    monkeypatch.setattr(learning, "find_videos", lambda *args: [])
    result = learning.attach_lessons(context[0], "key")
    assert result["milestones"][0]["lesson_status"] == "no_results"
    assert result["milestones"][0]["lesson_search_url"].startswith(
        "https://www.youtube.com/results?"
    )
