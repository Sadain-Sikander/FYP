"""Evidence retrieval, not proficiency prediction. Semantic matches require review."""

from __future__ import annotations

import logging
import re
from typing import Callable
import numpy as np

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
SEMANTIC_THRESHOLD = 0.42
LOGGER = logging.getLogger(__name__)


def clean_text(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalize_skill(value: str) -> str:
    value = clean_text(value).lower()
    value = re.sub(r"[^a-z0-9+#. ]+", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    aliases = {
        "js": "javascript",
        "ts": "typescript",
        "py": "python",
        "ms excel": "excel",
        "microsoft excel": "excel",
        "ms word": "word",
        "microsoft word": "word",
        "powerbi": "power bi",
        "power point": "powerpoint",
        "machine-learning": "machine learning",
        "ai": "artificial intelligence",
    }
    return aliases.get(value, value)


def skill_is_covered(required: str, user_skills: list[str]) -> bool:
    try:
        from rapidfuzz import fuzz

        score_fn = fuzz.token_set_ratio
    except Exception:
        score_fn = None

    target = normalize_skill(required)
    if not target:
        return False

    for supplied in user_skills:
        candidate = normalize_skill(supplied)
        if not candidate:
            continue
        if target == candidate:
            return True
        if score_fn and len(target) >= 4 and len(candidate) >= 4:
            if score_fn(target, candidate) >= 91:
                return True
    return False


# A conservative filter: wanting to learn a skill is not evidence of having it.
NON_EVIDENCE = re.compile(
    r"\b(no|not|never|without|lack|lacking|unable|cannot|can't|haven't|haven’t|don't|don’t|"
    r"want|hope|wish|aspire|aim|plan|interested|interest|seeking|learn|beginner)\b",
    re.I,
)


def evidence_items(user_skills, experience="", education=""):
    items, seen = [], set()
    for source, texts in [
        ("skills", user_skills),
        ("experience", re.split(r"[\n;]+|(?<=[.!?])\s+", experience)),
        ("education", re.split(r"[\n;]+|(?<=[.!?])\s+", education)),
    ]:
        count = 0
        for raw in texts:
            text = clean_text(raw)
            # Keep complete quotes; avoid embedding truncation of long paragraphs.
            if (
                not text
                or len(text) > 500
                or (
                    NON_EVIDENCE.search(text)
                    or re.search(r"^learning\b|\blearning (?:how|to)\b", text, re.I)
                )
            ):
                continue
            key = (source, text.lower())
            if key in seen:
                continue
            seen.add(key)
            items.append({"text": text, "source": source})
            count += 1
            if count >= (80 if source == "skills" else 24):
                break
    return items


def match_skills(
    required,
    user_skills,
    experience="",
    education="",
    confirmed=(),
    dismissed=(),
    model_provider: Callable | None = None,
    threshold=SEMANTIC_THRESHOLD,
):
    evidence = evidence_items(user_skills, experience, education)
    declared = [e for e in evidence if e["source"] == "skills"]
    confirmed = {normalize_skill(s) for s in confirmed}
    dismissed = {normalize_skill(s) for s in dismissed}
    results = []
    for skill in required:
        name = normalize_skill(skill["name"])
        exact = next((e for e in declared if normalize_skill(e["text"]) == name), None)
        result = {**skill, "status": "not_found", "method": "none", "evidence": None}
        if name in confirmed:
            result.update(status="matched", method="user_confirmed")
        elif exact:
            result.update(status="matched", method="explicit_skill", evidence=exact)
        elif name in dismissed:
            result.update(status="dismissed", method="user_dismissed")
        else:
            fuzzy = next(
                (e for e in declared if skill_is_covered(skill["name"], [e["text"]])),
                None,
            )
            if fuzzy:
                result.update(
                    status="needs_confirmation",
                    method="similar_wording",
                    evidence=fuzzy,
                )
        results.append(result)

    pending = [i for i, r in enumerate(results) if r["status"] == "not_found"]
    engine = "hybrid"
    if pending and evidence:
        try:
            model = model_provider()
            texts = [required[i]["name"] for i in pending] + [
                e["text"] for e in evidence
            ]
            vectors = np.asarray(
                model.encode(texts, normalize_embeddings=True, convert_to_numpy=True)
            )
            if (
                vectors.ndim != 2
                or len(vectors) != len(texts)
                or not np.isfinite(vectors).all()
            ):
                raise ValueError("Invalid embedding response")
            vectors = vectors / np.maximum(
                np.linalg.norm(vectors, axis=1, keepdims=True), 1e-12
            )
            similarities = vectors[: len(pending)] @ vectors[len(pending) :].T
            for row, i in enumerate(pending):
                best = int(np.argmax(similarities[row]))
                score = float(similarities[row, best])
                if score >= threshold:
                    results[i].update(
                        status="needs_confirmation",
                        method="semantic",
                        evidence=evidence[best],
                        similarity=round(score, 4),
                    )
        except Exception:
            LOGGER.warning(
                "Semantic skill matching unavailable; returning explicit/fuzzy matches",
                exc_info=True,
            )
            engine = "rules_fallback"
    return {
        "skills": results,
        "engine": engine,
        "model": MODEL_NAME if engine == "hybrid" else None,
        "semantic_threshold": threshold,
        "analysis_notice": (
            "Semantic matching is temporarily unavailable. Explicit skills and wording matches are still shown."
            if engine == "rules_fallback"
            else "Related evidence is a suggestion to review, not a measure of proficiency."
        ),
    }
