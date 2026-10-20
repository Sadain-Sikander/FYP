"""Explainable text-only resume checks, independent of career similarity."""
from __future__ import annotations

import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .resume import MAX_TEXT_CHARS, _clean_text, _sections, _skills_in

router = APIRouter(prefix="/api/resume", tags=["resume review"])


class ReviewRequest(BaseModel):
    text: str = Field(min_length=20, max_length=MAX_TEXT_CHARS)
    job_description: str = Field(default="", max_length=20_000)


def contains_term(text: str, term: str) -> bool:
    return bool(re.search(r"(?<!\w)" + re.escape(term) + r"(?!\w)", text, re.I))


def review_resume(text: str, job_description: str = "") -> dict:
    text = _clean_text(text)
    sections = _sections(text)
    words = re.findall(r"\b[\w+#.-]+\b", text)
    experience = "\n".join(sections["experience"])
    email = bool(re.search(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", text, re.I))
    # Require enough digits and a phone-like line; graduation years are not phones.
    phone = any(
        9 <= len(re.sub(r"\D", "", match)) <= 15
        for match in re.findall(r"(?<!\w)\+?\d[\d ().-]{7,}\d(?!\w)", text)
    )
    action_lines = [
        line for line in experience.splitlines()
        if re.match(
            r"^[\s•*\-\d.)]*(built|created|developed|designed|analysed|analyzed|led|"
            r"managed|improved|reduced|increased|delivered|supported|researched|"
            r"evaluated|coordinated|implemented|prepared|assisted|reviewed|"
            r"organised|organized|conducted|documented|tested|trained)\b", line, re.I
        )
    ]
    measured = any(
        re.search(r"\b\d+(?:\.\d+)?\s*(?:%|percent\b|patients?\b|reports?\b|"
                  r"users?\b|hours?\b|days?\b|weeks?\b|students?\b|samples?\b|"
                  r"projects?\b|clients?\b|records?\b|tests?\b|team members?\b)", line, re.I)
        for line in action_lines
    )
    checks = []
    suggestions = []

    def check(key, label, points, maximum, evidence, advice):
        checks.append({"id": key, "label": label, "points": points, "maximum": maximum, "evidence": evidence})
        if points < maximum:
            suggestions.append({
                "id": key, "priority": "high" if points == 0 else "medium",
                "title": label, "suggestion": advice,
            })

    check("contact", "Reachable contact details", 10 * (email + phone), 20,
          f"Email {'found' if email else 'not detected'}; phone {'found' if phone else 'not detected'}.",
          "Include a professional email and, if appropriate for the application, a reachable phone number in plain text.")
    for key, label, advice in [
        ("education", "Education section", "Add an Education heading with your qualification, institution and dates."),
        ("experience", "Experience or projects section", "Add Experience or Projects with relevant work, placements, research or coursework."),
        ("skills", "Skills section", "List relevant skills under a Skills heading. Include only skills you can demonstrate."),
    ]:
        found = bool(sections[key])
        check(key, label, 15 if found else 0, 15,
              f"Recognised section {'contains text' if found else 'not found or empty'}.", advice)
    check("length", "Concise, substantive content", 15 if 150 <= len(words) <= 1200 else 7 if len(words) >= 80 else 0, 15,
          f"{len(words)} words extracted; this general-resume rubric targets 150–1,200 words.",
          "For a general resume, add concrete evidence if very brief or remove repetition if lengthy. Academic CVs can legitimately be longer.")
    check("actions", "Specific action statements", 10 if len(action_lines) >= 2 else 5 if action_lines else 0, 10,
          f"{len(action_lines)} experience/project lines start with a recognised action verb.",
          "Start experience or project bullets with an action: what you did, how you did it and the result.")
    check("evidence", "Evidence of impact", 10 if measured else 0, 10,
          "A measurable outcome or scope was detected." if measured else "No measured scope or outcome detected in recognised action statements.",
          "Where truthful, describe scope or outcomes: people supported, samples reviewed, time saved or project results. Never invent numbers.")

    readiness = sum(item["points"] for item in checks)
    job_description = job_description.strip()
    match = None
    if job_description:
        # Treat job requirements as an explicit list to support terms like R and C++.
        terms = _skills_in(job_description, explicit=True)
        resume_terms = {term.casefold() for term in _skills_in(text, explicit=True)}
        matched = [term for term in terms if term.casefold() in resume_terms or contains_term(text, term)]
        missing = [term for term in terms if term not in matched]
        match = {
            "score": round(100 * len(matched) / len(terms)) if terms else None,
            "matched_keywords": matched,
            "missing_keywords": missing,
            "recognized_keywords": len(terms),
            "note": (
                "Equal-weight coverage of recognised skill terms, including aliases. This does not verify proficiency or eligibility."
                if terms else "No supported skill terms were recognised in this job description. No job-match score was calculated."
            ),
        }
        if missing:
            suggestions.insert(0, {
                "id": "job_keywords", "priority": "high", "title": "Make relevant experience visible",
                "suggestion": "The job description mentions: " + ", ".join(missing[:15]) +
                ". If you have this experience, describe it with evidence. Otherwise treat these as learning gaps, not keywords to add.",
            })
    job_score = match["score"] if match else None
    ats_score = round(readiness * 0.4 + job_score * 0.6) if job_score is not None else readiness
    return {
        "ats_score": ats_score,
        "score_label": "ATS estimate · job tailored" if job_score is not None else "ATS readiness estimate",
        "readiness_score": readiness,
        "method": "40% resume readiness + 60% recognised job-skill coverage." if job_score is not None
                  else "Resume readiness checks only. Add a job description for a tailored estimate.",
        "checks": checks,
        "job_match": match,
        "suggestions": sorted(suggestions, key=lambda item: item["priority"] != "high"),
        "limitations": "An explained text-based heuristic, not an employer's ATS result or hiring probability. Visual layout, clinical competence, licensing and every job requirement are not assessed.",
    }


@router.post("/review")
def review(payload: ReviewRequest):
    if sum(character.isalnum() for character in payload.text) < 20:
        raise HTTPException(422, "Provide readable resume text before requesting a review.")
    if payload.job_description.strip() and len(payload.job_description.strip()) < 30:
        raise HTTPException(422, "Add a fuller job description (at least 30 characters), or leave it empty.")
    return review_resume(payload.text, payload.job_description)
