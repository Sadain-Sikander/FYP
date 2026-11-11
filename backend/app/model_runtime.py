"""Single, cache-first recommendation encoder with observable readiness."""

import logging
import os
from threading import Lock
import time

import numpy as np

from .skill_matching import MODEL_NAME

logger = logging.getLogger("uvicorn.error")


def enabled(value):
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


class ModelLoadError(RuntimeError):
    pass


class ModelRuntime:
    def __init__(self, factory=None):
        self._factory = factory
        self._model = None
        self._load_lock = Lock()
        self._state_lock = Lock()
        self._state = {
            "state": "not_loaded",
            "stage": "waiting_for_first_request",
            "source": None,
            "error": None,
        }
        self._started = None
        self._finished = None
        self._failed_at = None

    def status(self):
        with self._state_lock:
            elapsed = (
                (self._finished or time.monotonic()) - self._started
                if self._started is not None
                else 0
            )
            return {
                **self._state,
                "model": MODEL_NAME,
                "elapsed_seconds": round(elapsed, 2),
            }

    def _update(self, **values):
        with self._state_lock:
            self._state.update(values)

    def get(self):
        if self._model is not None:
            return self._model
        # Only one request may import/load/warm the encoder. Others share it.
        with self._load_lock:
            if self._model is not None:
                return self._model
            if self._failed_at and time.monotonic() - self._failed_at < 30:
                raise ModelLoadError(
                    "The recommendation model is unavailable. Check the backend model status and retry shortly."
                )
            with self._state_lock:
                self._started, self._finished = time.monotonic(), None
                self._state = {
                    "state": "loading",
                    "stage": "importing_libraries",
                    "source": None,
                    "error": None,
                }
            logger.info(
                "[model] Importing ML libraries. This can take time on the first run."
            )
            try:
                factory = self._factory
                if factory is None:
                    import torch
                    from sentence_transformers import SentenceTransformer

                    threads = int(
                        os.getenv(
                            "CAREERBRIDGE_MODEL_THREADS",
                            str(min(4, os.cpu_count() or 1)),
                        )
                    )
                    if not 1 <= threads <= 16:
                        raise ValueError("Model thread count must be between 1 and 16")
                    torch.set_num_threads(threads)
                    factory = SentenceTransformer
                    logger.info("[model] CPU thread limit: %s", threads)
                options = {"device": os.getenv("CAREERBRIDGE_MODEL_DEVICE", "cpu")}
                self._update(stage="checking_local_cache")
                logger.info(
                    "[model] Loading cached weights without contacting Hugging Face."
                )
                try:
                    model = factory(MODEL_NAME, local_files_only=True, **options)
                    source = "local_cache"
                except OSError:
                    if enabled(os.getenv("HF_HUB_OFFLINE", "")):
                        raise ModelLoadError(
                            "Offline mode is enabled but the model cache is incomplete. Download the model once with offline mode disabled."
                        ) from None
                    self._update(stage="downloading_model")
                    logger.info(
                        "[model] Complete weights were not found locally. Downloading once from Hugging Face; internet is required."
                    )
                    model = factory(MODEL_NAME, local_files_only=False, **options)
                    source = "download"
                self._update(stage="warming_up", source=source)
                logger.info("[model] Warming up the encoder with one test sentence.")
                vector = np.asarray(
                    model.encode(
                        ["CareerBridge model readiness check"],
                        normalize_embeddings=True,
                        convert_to_numpy=True,
                        show_progress_bar=False,
                    )
                )
                if vector.shape != (1, 384) or not np.isfinite(vector).all():
                    raise ModelLoadError(
                        "The recommendation model produced invalid embeddings."
                    )
                with self._state_lock:
                    self._finished = time.monotonic()
                    self._state.update(state="ready", stage="ready", error=None)
                self._model = model
                self._failed_at = None
                logger.info(
                    "[model] READY in %.2fs (%s). Recommendations can now run.",
                    self.status()["elapsed_seconds"],
                    source,
                )
                return model
            except Exception as error:
                message = (
                    str(error)
                    if isinstance(error, ModelLoadError)
                    else "The recommendation model could not load. Check the backend console, model cache, internet connection and available memory."
                )
                with self._state_lock:
                    self._finished = self._failed_at = time.monotonic()
                    self._state.update(state="error", error=message)
                logger.error(
                    "[model] Failed during %s (%s). %s",
                    self.status()["stage"],
                    type(error).__name__,
                    message,
                )
                raise ModelLoadError(message) from None


runtime = ModelRuntime()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    try:
        runtime.get()
    except ModelLoadError:
        raise SystemExit(1)
