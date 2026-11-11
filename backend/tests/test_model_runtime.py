from concurrent.futures import ThreadPoolExecutor
from threading import Event

from fastapi.testclient import TestClient
import numpy as np
import pytest

from app.model_runtime import ModelLoadError, ModelRuntime
import app.main as api


class Encoder:
    def __init__(self):
        self.encodes = 0

    def encode(self, texts, **kwargs):
        self.encodes += 1
        return np.ones((len(texts), 384))


def test_cached_model_never_uses_online_load_and_warms_once():
    calls, encoder = [], Encoder()

    def factory(name, **kwargs):
        calls.append(kwargs)
        return encoder

    runtime = ModelRuntime(factory)
    assert runtime.status()["state"] == "not_loaded"
    assert runtime.get() is encoder and runtime.get() is encoder
    assert len(calls) == 1 and calls[0]["local_files_only"] is True
    assert encoder.encodes == 1
    assert runtime.status()["state"] == "ready"
    assert runtime.status()["source"] == "local_cache"


def test_missing_cache_downloads_once(monkeypatch):
    monkeypatch.delenv("HF_HUB_OFFLINE", raising=False)
    calls, encoder = [], Encoder()

    def factory(name, **kwargs):
        calls.append(kwargs["local_files_only"])
        if kwargs["local_files_only"]:
            raise OSError("not cached")
        return encoder

    runtime = ModelRuntime(factory)
    assert runtime.get() is encoder
    assert calls == [True, False]
    assert runtime.status()["source"] == "download"


def test_parallel_requests_share_one_load_and_status_stays_responsive():
    started, release = Event(), Event()
    calls, encoder = [], Encoder()

    def factory(*args, **kwargs):
        calls.append(1)
        started.set()
        assert release.wait(5)
        return encoder

    runtime = ModelRuntime(factory)
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = [pool.submit(runtime.get) for _ in range(5)]
        assert started.wait(5)
        assert runtime.status()["state"] == "loading"
        assert runtime.status()["stage"] == "checking_local_cache"
        release.set()
        assert all(f.result(timeout=5) is encoder for f in futures)
    assert len(calls) == 1 and encoder.encodes == 1


def test_failure_is_observable_and_waiting_requests_do_not_retry_immediately():
    calls = []

    def factory(*args, **kwargs):
        calls.append(1)
        raise ValueError("private internal detail")

    runtime = ModelRuntime(factory)
    for _ in range(2):
        with pytest.raises(ModelLoadError):
            runtime.get()
    assert len(calls) == 1
    assert runtime.status()["state"] == "error"
    assert "private internal detail" not in str(runtime.status())
    runtime._failed_at -= 31
    runtime._factory = lambda *args, **kwargs: Encoder()
    assert runtime.get() is not None
    assert runtime.status()["state"] == "ready"


def test_offline_missing_cache_has_clear_error_without_online_attempt(monkeypatch):
    monkeypatch.setenv("HF_HUB_OFFLINE", "1")
    calls = []

    def factory(*args, **kwargs):
        calls.append(kwargs)
        raise OSError("missing")

    runtime = ModelRuntime(factory)
    with pytest.raises(ModelLoadError, match="cache is incomplete"):
        runtime.get()
    assert len(calls) == 1


def test_invalid_warmup_output_is_not_ready():
    class Invalid(Encoder):
        def encode(self, *args, **kwargs):
            return np.ones((1, 20))

    runtime = ModelRuntime(lambda *args, **kwargs: Invalid())
    with pytest.raises(ModelLoadError, match="invalid embeddings"):
        runtime.get()
    assert runtime.status()["state"] == "error"


def test_preload_finishes_before_startup_completes(monkeypatch):
    runtime = ModelRuntime(lambda *args, **kwargs: Encoder())
    monkeypatch.setattr(api, "model_runtime", runtime)
    monkeypatch.setenv("CAREERBRIDGE_PRELOAD_MODEL", "1")
    with TestClient(api.app) as client:
        assert client.get("/api/model-status").json()["state"] == "ready"
        assert client.get("/api/data-status").json()["model_loaded"] is True


def test_lazy_health_check_does_not_load_model(monkeypatch):
    def forbidden(*args, **kwargs):
        pytest.fail("Status must not load weights")

    monkeypatch.setattr(api, "model_runtime", ModelRuntime(forbidden))
    monkeypatch.delenv("CAREERBRIDGE_PRELOAD_MODEL", raising=False)
    with TestClient(api.app) as client:
        assert client.get("/api/model-status").json()["state"] == "not_loaded"
        assert client.get("/api/data-status").json()["model_loaded"] is False
