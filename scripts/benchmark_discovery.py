"""Compare live and prebuilt rankings using synthetic profiles and a warm model."""

import json
from pathlib import Path
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
import app.main as api
import app.role_skills as skills


def benchmark():
    model = api.get_model()
    model.encode(["warm up"], normalize_embeddings=True)

    class CountedModel:
        calls = 0
        texts = 0

        def encode(self, texts, **kwargs):
            self.calls += 1
            self.texts += len(texts)
            return model.encode(texts, **kwargs)

    counted = CountedModel()
    original_model, original_index = api.get_model, skills.precomputed_rankings
    api.get_model = lambda: counted
    report = {
        "method": "One observation per synthetic subject and mode; same warm model, cold role-ranking and metadata-index caches. Model import/download/load and browser/network time excluded. Not a hardware-independent latency guarantee.",
        "results": {},
    }
    try:
        for mode in ["live_rankings", "precomputed_rankings"]:
            skills.precomputed_rankings = (
                (lambda: {}) if mode == "live_rankings" else original_index
            )
            api._data_cache.clear()
            rows = []
            for subject in [
                "Information Technology",
                "Nursing",
                "Business administration",
            ]:
                skills.ranked_indices.cache_clear()
                skills.esco_index.cache_clear()
                original_index.cache_clear()
                counted.calls = counted.texts = 0
                start = time.perf_counter()
                response = api.discovery_skills(
                    api.DiscoverySkillsRequest(role="Student", education=subject)
                )
                rows.append(
                    {
                        "subject": subject,
                        "seconds": round(time.perf_counter() - start, 3),
                        "encoder_calls": counted.calls,
                        "encoded_texts": counted.texts,
                        "skills": [item["name"] for item in response["skills"]],
                    }
                )
            report["results"][mode] = rows
        report["identical_suggestions"] = all(
            a["skills"] == b["skills"] for a, b in zip(*report["results"].values())
        )
        return report
    finally:
        api.get_model, skills.precomputed_rankings = original_model, original_index


if __name__ == "__main__":
    print(json.dumps(benchmark(), indent=2))
