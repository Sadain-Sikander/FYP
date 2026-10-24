from __future__ import annotations

from pathlib import Path
from typing import Any, Annotated
import os
import re
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from .resume import ResumeUploadLimitMiddleware, router as resume_router
from .resume_review import router as resume_review_router
from .skill_matching import normalize_skill, skill_is_covered, match_skills

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

CAREERS_PATH = DATA_DIR / "unified_careers.csv"
EMBEDDINGS_PATH = DATA_DIR / "career_embeddings.npy"

app = FastAPI(
    title="CareerBridge API",
    description="FYP starter API for career discovery, skill-gap analysis, and learning roadmaps.",
    version="0.1.0",
)

app.add_middleware(
    ResumeUploadLimitMiddleware,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip().rstrip("/")
        for origin in os.environ.get(
            "CAREERBRIDGE_ALLOWED_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
        ).split(",") if origin.strip()
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(resume_router)
app.include_router(resume_review_router)

careers = pd.read_csv(CAREERS_PATH).fillna("")
career_embeddings = np.load(EMBEDDINGS_PATH)

if len(careers) != len(career_embeddings):
    raise RuntimeError(
        f"Career data and embeddings do not align: {len(careers)} careers, "
        f"{len(career_embeddings)} embeddings."
    )

# Embeddings supplied with the notebook are normalized. Normalize again defensively.
norms = np.linalg.norm(career_embeddings, axis=1, keepdims=True)
career_embeddings = career_embeddings / np.maximum(norms, 1e-12)

_model = None
_data_cache: dict[str, pd.DataFrame] = {}

def get_model():
    """Load the same Sentence Transformers model used to create the career embeddings."""
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer(MODEL_NAME)
        except Exception as exc:
            raise HTTPException(
                status_code=503,
                detail=(
                    "The embedding model could not be loaded. Check your internet connection "
                    "for the first download, then retry. Original error: " + str(exc)
                ),
            )
    return _model

def load_csv(filename: str) -> pd.DataFrame:
    if filename not in _data_cache:
        path = DATA_DIR / filename
        if not path.exists():
            raise HTTPException(status_code=500, detail=f"Required dataset is missing: {filename}")
        _data_cache[filename] = pd.read_csv(path).fillna("")
    return _data_cache[filename]

def clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


class ProfileRequest(BaseModel):
    education: str = ""
    experience: str = ""
    skills: list[str] = Field(default_factory=list)
    interests: str = ""
    strengths: str = ""
    work_preferences: str = ""
    career_goals: str = ""
    preferred_industries: str = ""
    identity_statement: str = Field(default="", max_length=6000)
    top_k: int = Field(default=10, ge=1, le=25)

SkillText = Annotated[str, Field(min_length=1, max_length=200)]


class SkillGapRequest(BaseModel):
    career_id: str = Field(max_length=300)
    user_skills: list[SkillText] = Field(default_factory=list, max_length=80)
    experience: str = Field(default="", max_length=6000)
    education: str = Field(default="", max_length=6000)
    confirmed_skills: list[SkillText] = Field(default_factory=list, max_length=50)
    dismissed_skills: list[SkillText] = Field(default_factory=list, max_length=50)


class RoadmapRequest(SkillGapRequest):
    weeks: int = Field(default=4, ge=2, le=12)


def profile_to_text(profile: ProfileRequest) -> str:
    pieces = [
        f"Education and courses: {profile.education}",
        f"Work and project experience: {profile.experience}",
        f"Skills: {', '.join(profile.skills)}",
        f"Interests: {profile.interests}",
        f"Strengths and transferable abilities: {profile.strengths}",
        f"Preferred work environment: {profile.work_preferences}",
        f"Career goals: {profile.career_goals}",
        f"Preferred industries: {profile.preferred_industries}",
        f"Career identity: {profile.identity_statement}",
    ]
    return "\n".join(p for p in pieces if p.split(":", 1)[-1].strip())


def get_career(career_id: str) -> dict[str, Any]:
    rows = careers[careers["id"].astype(str) == str(career_id)]
    if rows.empty:
        raise HTTPException(status_code=404, detail="Career not found.")
    return rows.iloc[0].to_dict()

def get_role_skills(career: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    source = str(career.get("source", ""))
    career_id = str(career.get("id", ""))
    essential: list[dict[str, Any]] = []
    optional: list[dict[str, Any]] = []

    if source == "O*NET":
        df = load_csv("onet_essential_skills.csv")
        df = df[(df["O*NET-SOC Code"].astype(str) == career_id) & (df["Scale ID"].astype(str) == "IM")].copy()
        if not df.empty:
            df["Data Value"] = pd.to_numeric(df["Data Value"], errors="coerce").fillna(0)
            df = df.sort_values("Data Value", ascending=False)
            seen = set()
            for _, row in df.iterrows():
                label = clean_text(row.get("Element Name", ""))
                key = normalize_skill(label)
                if not key or key in seen:
                    continue
                seen.add(key)
                essential.append({"name": label, "importance": round(float(row["Data Value"]), 2), "kind": "O*NET essential skill"})
                if len(essential) >= 20:
                    break

        sw = load_csv("onet_software_skills.csv")
        sw = sw[sw["O*NET-SOC Code"].astype(str) == career_id]
        seen = {normalize_skill(x["name"]) for x in essential}
        for _, row in sw.iterrows():
            label = clean_text(row.get("Element Name", ""))
            key = normalize_skill(label)
            if not key or key in seen:
                continue
            seen.add(key)
            optional.append({
                "name": label,
                "importance": None,
                "kind": "Software/technology",
                "hot_technology": clean_text(row.get("Hot Technology", "")),
                "in_demand": clean_text(row.get("In Demand", "")),
            })
            if len(optional) >= 20:
                break
    else:
        relations = load_csv("esco_occupation_skill_relations.csv")
        matches = relations[relations["occupationUri"].astype(str) == career_id]
        for relation_type, destination in [("essential", essential), ("optional", optional)]:
            subset = matches[matches["relationType"].astype(str).str.lower() == relation_type]
            seen = set()
            for _, row in subset.iterrows():
                label = clean_text(row.get("skillLabel", ""))
                key = normalize_skill(label)
                if not key or key in seen:
                    continue
                seen.add(key)
                destination.append({"name": label, "importance": None, "kind": f"ESCO {relation_type} skill"})
                if len(destination) >= (25 if relation_type == "essential" else 20):
                    break
    return essential, optional


def build_gap_result(
    career_id: str,
    user_skills: list[str],
    experience: str = "",
    education: str = "",
    confirmed_skills: list[str] | None = None,
    dismissed_skills: list[str] | None = None,
) -> dict[str, Any]:
    career = get_career(career_id)
    essential, optional = get_role_skills(career)
    analysis = match_skills(
        essential + optional,
        user_skills,
        experience,
        education,
        confirmed_skills or [],
        dismissed_skills or [],
        get_model,
    )
    all_results = analysis.pop("skills")
    essential_results, optional_results = (
        all_results[: len(essential)],
        all_results[len(essential) :],
    )
    covered = [s for s in essential_results if s["status"] == "matched"]
    gaps = [s for s in essential_results if s["status"] != "matched"]
    return {
        "career": {
            "id": career_id,
            "title": career["title"],
            "source": career["source"],
        },
        "user_skills": user_skills,
        "essential_skills": essential_results,
        "matched_skills": covered,
        "skill_gaps": gaps,
        "suggested_matches": [
            s for s in essential_results if s["status"] == "needs_confirmation"
        ],
        "optional_skills": optional_results,
        "matched_optional_skills": [
            s for s in optional_results if s["status"] == "matched"
        ],
        "coverage_percent": (
            round((len(covered) / len(essential)) * 100, 1) if essential else None
        ),
        **analysis,
        "note": "Coverage counts explicitly listed or user-confirmed skills, not demonstrated proficiency. Related evidence needs your confirmation; unconfirmed skills remain in the learning plan.",
    }


@app.get("/")
def root():
    return {"message": "CareerBridge API is running", "docs": "/docs"}

@app.get("/api/health")
def health():
    return {"status": "ok", "career_records": int(len(careers)), "embedding_shape": list(career_embeddings.shape)}

@app.get("/api/data-status")
def data_status():
    return {
        "career_records": int(len(careers)),
        "embedding_rows": int(career_embeddings.shape[0]),
        "embedding_dimensions": int(career_embeddings.shape[1]),
        "source_counts": {str(k): int(v) for k, v in careers["source"].value_counts().items()},
        "model": MODEL_NAME,
        "model_loaded": _model is not None,
    }

@app.post("/api/careers/recommend")
def recommend_careers(profile: ProfileRequest):
    profile_text = profile_to_text(profile)
    if len(profile_text.strip()) < 10:
        raise HTTPException(status_code=422, detail="Please enter some education, experience, skills, interests, or career goals.")

    model = get_model()
    # Field labels such as "Career identity" and "Education and courses" can
    # skew short student profiles toward counselling/teaching occupations.
    # Match the user's actual content; keep labels only in the display summary.
    query_text = "\n".join(filter(None, [
        clean_text(profile.education), clean_text(profile.experience),
        ", ".join(profile.skills), clean_text(profile.interests),
        clean_text(profile.strengths), clean_text(profile.work_preferences),
        clean_text(profile.career_goals), clean_text(profile.preferred_industries),
        clean_text(profile.identity_statement),
    ]))
    query_embedding = model.encode([query_text], normalize_embeddings=True, convert_to_numpy=True)[0]
    if query_embedding.shape[0] != career_embeddings.shape[1]:
        raise HTTPException(status_code=500, detail="Query model dimensions do not match the saved career embeddings.")
    similarities = career_embeddings @ query_embedding
    top_indices = np.argsort(similarities)[::-1][:profile.top_k]

    results = []
    seen_ids = set()
    # The supplied ESCO data contains four occupation IDs duplicated in the unified CSV.
    # Keep the highest-ranked occurrence of each ID so users do not see duplicate cards.
    for idx in np.argsort(similarities)[::-1]:
        row = careers.iloc[int(idx)]
        career_id = str(row["id"])
        if career_id in seen_ids:
            continue
        seen_ids.add(career_id)
        results.append({
            "id": career_id,
            "title": str(row["title"]),
            "description": str(row["description"]),
            "source": str(row["source"]),
            "semantic_similarity": round(float(similarities[idx]), 4),
            "explanation": "Ranked by semantic similarity between your profile and this occupation's title and description.",
        })
        if len(results) >= profile.top_k:
            break
    return {
        "profile_summary": profile_text,
        "results": results,
        "note": "Semantic similarity is a ranking signal, not a probability of job success or a calibrated employability score.",
    }

class DiscoverySkillsRequest(BaseModel):
    role: str = Field(default="", max_length=50)
    education: str = Field(default="", max_length=6000)
    experience: str = Field(default="", max_length=6000)
    offset: int = Field(default=0, ge=0, le=1000)


@app.post("/api/discovery/skills")
def discovery_skills(request: DiscoverySkillsRequest):
    """Suggest occupational skill labels; never assert that the user has them."""
    role = clean_text(request.role)
    # A student's subject is more informative than the generic role "Student".
    if role.lower() in {"student", "learner", "graduate"} and request.education.strip():
        role = ""
    context = "\n".join(filter(None, [
        role, clean_text(request.education), clean_text(request.experience)
    ]))
    if len(context) < 3:
        raise HTTPException(status_code=422, detail="Add a role or subject to find relevant skills.")
    model = get_model()
    query = model.encode([context], normalize_embeddings=True, convert_to_numpy=True)[0]
    if query.shape[0] != career_embeddings.shape[1]:
        raise HTTPException(status_code=500, detail="Query model dimensions do not match the saved career embeddings.")
    similarities = career_embeddings @ query
    candidates = {}
    seen_careers = set()
    for idx in np.argsort(similarities)[::-1]:
        career = careers.iloc[int(idx)].to_dict()
        if career["id"] in seen_careers:
            continue
        seen_careers.add(career["id"])
        essential, optional = get_role_skills(career)
        # Balance general abilities with concrete software and subject skills.
        for group in [essential[:14], optional[:8]]:
            for rank, skill in enumerate(group):
                label = skill["name"]
                key = normalize_skill(label)
                if not key or len(label) > 100:
                    continue
                weight = max(0.01, float(similarities[idx])) / (1 + rank * 0.12)
                existing = candidates.setdefault(key, {"name": label, "score": 0, "sources": set()})
                existing["score"] += weight
                existing["sources"].add(str(career["source"]))
        if len(seen_careers) >= 8:
            break
    ranked = sorted(candidates.values(), key=lambda skill: (-skill["score"], skill["name"]))
    if not ranked:
        return {"skills": [], "next_offset": 0, "note": "No suggestions found. Add your own skills."}
    start = request.offset % len(ranked)
    rotated = ranked[start:] + ranked[:start]
    chosen = rotated[:12]
    return {
        "skills": [{"name": item["name"], "sources": sorted(item["sources"])} for item in chosen],
        "next_offset": (start + len(chosen)) % len(ranked),
        "note": "Suggested from related O*NET and ESCO occupations. Select only skills that reflect your experience.",
    }


@app.post("/api/skill-gap")
def skill_gap(request: SkillGapRequest):
    return build_gap_result(**request.model_dump())

@app.post("/api/roadmap")
def generate_roadmap(request: RoadmapRequest):
    gap_result = build_gap_result(**request.model_dump(exclude={"weeks"}))
    career_title = gap_result["career"]["title"]
    gaps = gap_result["skill_gaps"][:12]
    if not gaps:
        gaps = [s for s in gap_result["optional_skills"] if s["status"] != "matched"][:4]

    weeks = request.weeks
    phases = []
    phases.append({
        "week": 1,
        "title": "Understand the role and build foundations",
        "tasks": [
            f"Review the role requirements for {career_title}.",
            "Choose the highest-priority skill gaps listed below.",
            "Study core concepts and write short notes in your own words.",
        ],
    })
    phases.append({
        "week": min(2, weeks),
        "title": "Guided practice",
        "tasks": [
            f"Practice: {', '.join(s['name'] for s in gaps[:3]) or 'the role’s core skills'}.",
            "Complete small exercises and record what you can do independently.",
        ],
    })
    phases.append({
        "week": min(3, weeks),
        "title": "Apply skills in a practical project",
        "tasks": [
            f"Build a small project or work sample related to {career_title}.",
            "Document your approach, decisions, and results.",
            "Ask for feedback and revise the work.",
        ],
    })
    phases.append({
        "week": weeks,
        "title": "Review and prepare evidence",
        "tasks": [
            "Compare your project against the role requirements.",
            "Update your portfolio and resume with only verified work you completed.",
            "Reassess the remaining skill gaps and plan the next learning cycle.",
        ],
    })
    # Merge phases when a short roadmap causes duplicate week numbers.
    merged = {}
    for phase in phases:
        merged.setdefault(phase["week"], {"week": phase["week"], "title": phase["title"], "tasks": []})
        merged[phase["week"]]["tasks"].extend(phase["tasks"])
    return {
        "career": gap_result["career"],
        "duration_weeks": weeks,
        "priority_skill_gaps": gaps,
        "milestones": [merged[k] for k in sorted(merged)],
        "note": "This starter roadmap uses rule-based milestones. Add reviewed learning resources and personalized difficulty estimates in a later iteration.",
    }
