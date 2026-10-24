"""Run with the real cached model. Tune only on development, report test once."""

import argparse
import json
from pathlib import Path
import sys
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.skill_matching import (
    evidence_items,
    skill_is_covered,
    match_skills,
    SEMANTIC_THRESHOLD,
    MODEL_NAME,
)


def metrics(labels, predictions):
    tp = sum(y and p for y, p in zip(labels, predictions))
    fp = sum(not y and p for y, p in zip(labels, predictions))
    fn = sum(y and not p for y, p in zip(labels, predictions))
    tn = sum(not y and not p for y, p in zip(labels, predictions))
    precision = tp / (tp + fp) if tp + fp else 0
    recall = tp / (tp + fn) if tp + fn else 0
    return dict(
        tp=tp,
        fp=fp,
        fn=fn,
        tn=tn,
        precision=round(precision, 3),
        recall=round(recall, 3),
        f1=(
            round(2 * precision * recall / (precision + recall), 3)
            if precision + recall
            else 0
        ),
    )


def run(output, tune=False):
    from sentence_transformers import SentenceTransformer

    fixture = json.loads(Path(__file__).with_name("skill_pairs.json").read_text())
    examples = fixture["examples"]
    model = SentenceTransformer(MODEL_NAME)
    texts = [s for row in examples for s in (row["required"], row["evidence"])]
    vectors = model.encode(texts, normalize_embeddings=True, convert_to_numpy=True)
    scores = np.sum(vectors[::2] * vectors[1::2], axis=1)
    by_text = dict(zip(texts, vectors))

    class CachedModel:
        def encode(self, values, **kwargs):
            return np.asarray([by_text[text] for text in values])

    cached_model = CachedModel()
    for row, score in zip(examples, scores):
        row["similarity"] = round(float(score), 4)
        row["baseline"] = row["source"] == "skills" and skill_is_covered(
            row["required"], [row["evidence"]]
        )
        items = evidence_items(
            [row["evidence"]] if row["source"] == "skills" else [],
            **({row["source"]: row["evidence"]} if row["source"] != "skills" else {})
        )
        row["eligible"] = bool(items)
        row["rules_same_evidence"] = bool(items) and skill_is_covered(
            row["required"], [row["evidence"]]
        )

    def predicted(row, threshold):
        supplied = [row["evidence"]] if row["source"] == "skills" else []
        context = {row["source"]: row["evidence"]} if row["source"] != "skills" else {}
        result = match_skills(
            [{"name": row["required"]}],
            supplied,
            **context,
            model_provider=lambda: cached_model,
            threshold=float(threshold)
        )
        return result["skills"][0]["status"] in ("matched", "needs_confirmation")

    development = [r for r in examples if r["split"] == "development"]
    tuning = []
    for threshold in np.arange(0.4, 0.81, 0.02):
        measure = metrics(
            [r["relevant"] for r in development],
            [predicted(r, threshold) for r in development],
        )
        tuning.append({"threshold": round(float(threshold), 2), **measure})
    best = max(tuning, key=lambda m: (m["f1"], m["precision"], m["threshold"]))
    if tune:
        print(
            json.dumps(
                {"development_only": True, "recommended": best, "sweep": tuning},
                indent=2,
            )
        )
        return
    report = dict(
        model=MODEL_NAME,
        threshold=SEMANTIC_THRESHOLD,
        provenance=fixture["provenance"],
        task="Retrieve evidence worth user review; this does not evaluate proficiency or calibrated confidence.",
        splits={},
    )
    for split in ("development", "test"):
        rows = [r for r in examples if r["split"] == split]
        report["splits"][split] = {
            "count": len(rows),
            "rules_baseline": metrics(
                [r["relevant"] for r in rows], [r["baseline"] for r in rows]
            ),
            "rules_with_same_evidence": metrics(
                [r["relevant"] for r in rows], [r["rules_same_evidence"] for r in rows]
            ),
            "hybrid_candidates": metrics(
                [r["relevant"] for r in rows],
                [predicted(r, SEMANTIC_THRESHOLD) for r in rows],
            ),
            "errors": [
                {**r, "hybrid": predicted(r, SEMANTIC_THRESHOLD)}
                for r in rows
                if predicted(r, SEMANTIC_THRESHOLD) != r["relevant"]
            ],
        }
    report["limitations"] = [
        "Small synthetic benchmark with provisional author labels, not independently expert-reviewed.",
        "Baseline accepts only explicit skill labels; hybrid also uses experience and education, so this is an end-to-end feature comparison, not a pure model ablation.",
        "Similarity can confuse participation with responsibility and adjacent skills with equivalent ones. All inferred matches require user confirmation.",
        "No training or fine-tuning was performed; thresholds were selected on development examples.",
    ]
    Path(output).write_text(json.dumps(report, indent=2) + "\n")
    print(
        json.dumps(
            {
                k: {m: v for m, v in val.items() if m != "errors"}
                for k, val in report["splits"].items()
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--tune", action="store_true")
    parser.add_argument(
        "--output", default=str(Path(__file__).with_name("results.json"))
    )
    args = parser.parse_args()
    run(args.output, args.tune)
