"""Precompute public occupational skill rankings; never encode user profiles.

Run from the repo root using the backend environment. Rebuild after changing
the model, ranking algorithm, or occupational datasets. No API server is needed.
"""

import argparse
import gzip
import hashlib
import json
from pathlib import Path
import sys
import time
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
import app.main as api
import app.role_skills as skills


def build(output):
    started = time.perf_counter()
    requests = {}
    original = skills.ranked_indices

    def collect(context, labels, provider):
        requests[skills.ranking_key(context, labels)] = (context, labels)
        return tuple(range(len(labels)))

    def no_model():
        raise AssertionError("Collection must not load the encoder")

    # Collect exactly the same rank inputs used by the production catalogue.
    skills.ranked_indices = collect
    try:
        for index, career in enumerate(api.careers.to_dict("records"), 1):
            skills.catalogue(career, api.load_csv, api.careers, no_model)
            if index % 500 == 0:
                print(f"Collected {index}/{len(api.careers)} occupations", flush=True)
    finally:
        skills.ranked_indices = original

    texts = list(
        dict.fromkeys(
            text for context, labels in requests.values() for text in (context, *labels)
        )
    )
    print(
        f"Encoding {len(texts)} unique public texts for {len(requests)} rankings",
        flush=True,
    )
    encoder = api.get_model()
    batches = []
    for start in range(0, len(texts), 512):
        batches.append(
            encoder.encode(
                texts[start : start + 512],
                batch_size=32,
                normalize_embeddings=True,
                convert_to_numpy=True,
                show_progress_bar=False,
            )
        )
        if start % 5120 == 0:
            print(
                f"Encoded {min(start + 512, len(texts))}/{len(texts)} texts", flush=True
            )
    vectors = np.concatenate(batches)
    positions = {text: i for i, text in enumerate(texts)}
    rankings = {}
    for key, (context, labels) in requests.items():
        indices = [positions[text] for text in (context, *labels)]
        rankings[key] = skills.rank_vectors(vectors[indices], len(labels))
    files = [
        "unified_careers.csv",
        "esco_occupations.csv",
        "esco_skills.csv",
        "esco_occupation_skill_relations.csv",
        "onet_essential_skills.csv",
        "onet_transferable_skills.csv",
        "onet_software_skills.csv",
    ]
    metadata = {
        "version": skills.RANKING_VERSION,
        "model": skills.MODEL_NAME,
        "model_revision": getattr(encoder[0].auto_model.config, "_commit_hash", None),
        "career_records": len(api.careers),
        "unique_public_texts": len(texts),
        "ranking_count": len(rankings),
        "source_sha256": {
            name: hashlib.sha256((api.DATA_DIR / name).read_bytes()).hexdigest()
            for name in files
        },
    }
    output = Path(output)
    temporary = output.with_suffix(output.suffix + ".tmp")
    encoded = json.dumps(
        {**metadata, "rankings": rankings}, separators=(",", ":")
    ).encode()
    temporary.write_bytes(gzip.compress(encoded, mtime=0))
    temporary.replace(output)
    output.with_name("skill_rankings_manifest.json").write_text(
        json.dumps(metadata, indent=2) + "\n"
    )
    print(
        f"Wrote {output.name}: {output.stat().st_size:,} bytes in {time.perf_counter()-started:.1f}s",
        flush=True,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=skills.RANKING_PATH)
    build(parser.parse_args().output)
