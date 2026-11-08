"""Occupation-scoped learning priorities, with traceable catalogue provenance."""

from functools import lru_cache
import re
import numpy as np
import pandas as pd
from .skill_matching import normalize_skill


def title_key(title):
    words = re.findall(r"[a-z0-9]+", title.lower())
    return " ".join(
        (
            w[:-3] + "y"
            if w.endswith("ies")
            else w[:-1] if w.endswith("s") and not w.endswith("ss") else w
        )
        for w in words
    )


@lru_cache(maxsize=256)
def ranked_indices(context, labels, model_provider):
    vectors = np.asarray(
        model_provider().encode(
            [context, *labels], normalize_embeddings=True, convert_to_numpy=True
        )
    )
    if (
        vectors.ndim != 2
        or len(vectors) != len(labels) + 1
        or not np.isfinite(vectors).all()
    ):
        raise ValueError("Invalid skill ranking embeddings")
    vectors = vectors / np.maximum(
        np.linalg.norm(vectors, axis=1, keepdims=True), 1e-12
    )
    relevance = vectors[1:] @ vectors[0]
    relevance_order = np.argsort(-relevance, kind="stable").tolist()
    pool = relevance_order[:80]
    pool_vectors = vectors[1:][pool]
    similarity = pool_vectors @ pool_vectors.T
    remaining, selected = list(range(len(pool))), []
    while remaining and len(selected) < 40:
        # Avoid filling the short list with near-duplicate skills.
        best = max(
            remaining,
            key=lambda i: 0.75 * relevance[pool[i]]
            - 0.25 * max((similarity[i, j] for j in selected), default=0),
        )
        selected.append(best)
        remaining.remove(best)
    chosen = [pool[i] for i in selected]
    return tuple(chosen + [i for i in relevance_order if i not in chosen])


def rank(items, career, model_provider):
    if not items:
        return []
    context = f"{career['title']}. {career.get('description', '')}"
    try:
        order = ranked_indices(
            context,
            tuple(f"{s['name']}. {s.get('description', '')}" for s in items),
            model_provider,
        )
        ranked = [items[i] for i in order]
    except Exception:
        # Catalogue entries remain usable when the local model is unavailable.
        ranked = items
    return sorted(
        ranked,
        key=lambda s: (s.get("category") == "tools" and not s.get("in_demand", False)),
    )


def unique(items):
    seen, result = set(), []
    for item in items:
        key = normalize_skill(item["name"])
        if key and len(item["name"]) <= 200 and key not in seen:
            seen.add(key)
            result.append(item)
    return result


def learning_targets(items, limit=12):
    chosen = []
    for category, count in [("role", 8), ("tools", 3), ("foundation", 1)]:
        chosen.extend(
            [s for s in items if s.get("category", "role") == category][:count]
        )
    return unique(chosen + items)[:limit]


def technology_name(label):
    aliases = {
        "structured query language sql": "SQL",
        "microsoft excel": "Excel",
        "microsoft power bi": "Power BI",
        "the mathworks matlab": "MATLAB",
        "amazon web services aws software": "AWS",
        "microsoft azure software": "Azure",
    }
    return aliases.get(label.lower(), label)


@lru_cache(maxsize=4)
def esco_index(load_csv):
    definitions = (
        load_csv("esco_skills.csv")
        .drop_duplicates("conceptUri")
        .set_index("conceptUri")["description"]
        .to_dict()
    )
    preferred, aliases = {}, {}
    for _, row in load_csv("esco_occupations.csv").iterrows():
        preferred.setdefault(title_key(row["preferredLabel"]), set()).add(
            row["conceptUri"]
        )
        for label in str(row["altLabels"]).splitlines():
            aliases.setdefault(title_key(label), set()).add(row["conceptUri"])
    return definitions, preferred, aliases


def catalogue(career, load_csv, careers, model_provider):
    """Never retrieve skills from a merely similar occupation.

    Same-title ESCO enrichment is explicitly attributed; it is not an official
    O*NET/ESCO crosswalk. Tools are examples used in the role, not prerequisites.
    """
    cid, source = str(career["id"]), career["source"]
    relations = load_csv("esco_occupation_skill_relations.csv")
    definitions, preferred, aliases = esco_index(load_csv)
    role, tools, supporting, optional = [], [], [], []
    related = None
    if source == "ESCO":
        related = career
    else:
        key = title_key(career["title"])
        ids = preferred.get(key) or aliases.get(key, set())
        same_title = careers[(careers["source"] == "ESCO") & careers["id"].isin(ids)]
        if len(ids) == 1 and len(same_title) == 1:
            related = same_title.iloc[0].to_dict()
    if related:
        rows = relations[relations["occupationUri"] == related["id"]]
        for _, row in rows.iterrows():
            item = {
                "name": str(row["skillLabel"]).strip(),
                "category": "role",
                "kind": "ESCO occupational skill",
                "importance": None,
                "source": "ESCO",
                "source_url": row["skillUri"],
                "source_occupation": related["title"],
                "relation": row["relationType"],
                "description": str(definitions.get(row["skillUri"], ""))[:450],
                "basis": (
                    "matching ESCO title or alias"
                    if source != "ESCO"
                    else "selected occupation"
                ),
            }
            (role if row["relationType"] == "essential" else optional).append(item)
    if source == "O*NET":
        for filename in ["onet_essential_skills.csv", "onet_transferable_skills.csv"]:
            frame = load_csv(filename)
            rows = frame[
                (frame["O*NET-SOC Code"] == cid) & (frame["Scale ID"] == "IM")
            ].copy()
            rows["Data Value"] = pd.to_numeric(
                rows["Data Value"], errors="coerce"
            ).fillna(0)
            rows = rows[
                (rows["Data Value"] >= 3)
                & (rows["Recommend Suppress"] != "Y")
                & (rows["Not Relevant"] != "Y")
            ].sort_values("Data Value", ascending=False, kind="stable")
            for _, row in rows.iterrows():
                technical = str(row["Element ID"]).startswith("2.B.3")
                item = {
                    "name": row["Element Name"],
                    "category": "role" if technical else "foundation",
                    "kind": (
                        "O*NET occupational skill"
                        if technical
                        else "O*NET transferable skill"
                    ),
                    "importance": float(row["Data Value"]),
                    "source": "O*NET",
                    "source_url": f"https://www.onetonline.org/link/summary/{cid}",
                    "source_occupation": career["title"],
                    "basis": "selected occupation",
                }
                (role if technical else supporting).append(item)
        sw = load_csv("onet_software_skills.csv")
        for _, row in sw[sw["O*NET-SOC Code"] == cid].iterrows():
            label = str(row["Workplace Example"]).strip()
            if not label:
                continue
            tools.append(
                {
                    "name": technology_name(label),
                    "category": "tools",
                    "kind": "O*NET workplace technology",
                    "importance": None,
                    "source": "O*NET",
                    "source_label": label,
                    "source_url": f"https://www.onetonline.org/link/summary/{cid}",
                    "source_occupation": career["title"],
                    "description": str(row["Element Name"]).strip(),
                    "hot_technology": row["Hot Technology"] == "Y",
                    "in_demand": row["In Demand"] == "Y",
                    "basis": "selected occupation",
                }
            )
    role = rank(unique(role), career, model_provider)
    tools = rank(unique(tools), career, model_provider)
    # Prefer portable foundations over vendor packages, but only when the selected
    # occupation actually lists them. This is an editorial ordering, not prevalence.
    portable = {
        "python",
        "sql",
        "r",
        "javascript",
        "java",
        "git",
        "excel",
        "html",
        "css",
    }
    tools.sort(
        key=lambda s: (not s["in_demand"], normalize_skill(s["name"]) not in portable)
    )
    supporting = sorted(unique(supporting), key=lambda s: -(s.get("importance") or 0))[
        :8
    ]
    # Keep a manageable mix; broad workplace abilities never displace technical work.
    priorities = unique(role[:12] + tools[:8] + (supporting[:4] if not role else []))
    if not priorities:
        priorities, supporting = supporting, []
    selected = {normalize_skill(s["name"]) for s in priorities}
    additional = unique(
        role[12:] + tools[8:] + rank(unique(optional), career, model_provider)
    )
    additional = [s for s in additional if normalize_skill(s["name"]) not in selected][
        :20
    ]
    supporting = [s for s in supporting if normalize_skill(s["name"]) not in selected]
    return priorities, additional, supporting
