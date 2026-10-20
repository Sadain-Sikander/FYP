"""Local resume parsing. Extracted values are suggestions for the user to review."""

from __future__ import annotations

import csv
import re
import unicodedata
from functools import lru_cache
from io import BytesIO
from pathlib import Path
from typing import Any
from zipfile import ZipFile

from docx import Document
from docx.table import Table
from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from pypdf import PdfReader
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_REQUEST_BYTES = MAX_FILE_BYTES + 64 * 1024
MAX_PDF_PAGES = 30
MAX_PDF_PAGE_BYTES = 2 * 1024 * 1024
MAX_DOCX_UNCOMPRESSED_BYTES = 20 * 1024 * 1024
MAX_TEXT_CHARS = 100_000
MAX_PROFILE_CHARS = 6_000
MAX_SKILLS = 80

router = APIRouter()


class ExtractedProfile(BaseModel):
    education: str = ""
    experience: str = ""
    skills: list[str] = Field(default_factory=list)
    interests: str = ""
    strengths: str = ""
    work_preferences: str = ""
    career_goals: str = ""
    preferred_industries: str = ""


class ResumeExtraction(BaseModel):
    filename: str
    profile: ExtractedProfile
    extracted_text: str
    warnings: list[str]
    extraction_method: str


class ResumeUploadLimitMiddleware:
    """Bound multipart parsing too, including requests without Content-Length."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["path"].rstrip("/") != "/api/resume/extract":
            await self.app(scope, receive, send)
            return

        error = "Upload a resume smaller than 5 MiB."
        headers = dict(scope.get("headers", []))
        try:
            content_length = int(headers.get(b"content-length", b"0"))
        except ValueError:
            await JSONResponse({"detail": "Invalid Content-Length header."}, status_code=400)(scope, receive, send)
            return
        if content_length > MAX_REQUEST_BYTES:
            await JSONResponse({"detail": error}, status_code=413)(scope, receive, send)
            return

        received = 0

        async def bounded_receive() -> dict[str, Any]:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > MAX_REQUEST_BYTES:
                    raise HTTPException(status_code=413, detail=error)
            return message

        await self.app(scope, bounded_receive, send)


def _clean_text(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).replace("\r\n", "\n").replace("\r", "\n")
    text = "".join(character for character in text if character in "\n\t" or not unicodedata.category(character).startswith("C"))
    lines = [re.sub(r"[^\S\n]+", " ", line).strip() for line in text.split("\n")]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


def _check_text_size(length: int) -> None:
    if length > MAX_TEXT_CHARS:
        raise HTTPException(status_code=413, detail="This document contains too much text. Upload a shorter resume (up to 100,000 characters).")


def _pdf_text(data: bytes) -> tuple[str, list[str]]:
    if not data.lstrip().startswith(b"%PDF-"):
        raise HTTPException(status_code=422, detail="This file is not a readable PDF. Export your resume as a new PDF and try again.")
    try:
        reader = PdfReader(BytesIO(data))
        if reader.is_encrypted:
            raise HTTPException(status_code=422, detail="This PDF is password protected. Upload an unlocked copy of your resume.")
        if len(reader.pages) > MAX_PDF_PAGES:
            raise HTTPException(status_code=413, detail="Upload a resume with 30 pages or fewer.")
        texts: list[str] = []
        total_chars = 0
        empty_pages = 0
        for page in reader.pages:
            content = page.get_contents()
            if content is not None and len(content.get_data()) > MAX_PDF_PAGE_BYTES:
                raise HTTPException(status_code=413, detail="A PDF page is too complex to read. Export a simpler, text-based PDF or upload a DOCX file.")
            text = page.extract_text() or ""
            total_chars += len(text)
            _check_text_size(total_chars)
            empty_pages += not text.strip()
            texts.append(text)
        warnings = []
        if empty_pages:
            warnings.append(f"{empty_pages} PDF page(s) had no readable text. Image-only content was skipped; OCR is not supported yet.")
        return "\n\n".join(texts), warnings
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail="The PDF could not be read. It may be damaged or use an unsupported format. Export a new PDF or upload DOCX.") from exc


def _docx_text(data: bytes) -> tuple[str, list[str]]:
    try:
        with ZipFile(BytesIO(data)) as archive:
            entries = archive.infolist()
            names = [entry.filename for entry in entries]
            if "word/document.xml" not in names or "[Content_Types].xml" not in names:
                raise HTTPException(status_code=422, detail="This file is not a valid DOCX resume. Save it as a Word document (.docx) and try again.")
            if len(entries) > 500 or sum(entry.file_size for entry in entries) > MAX_DOCX_UNCOMPRESSED_BYTES:
                raise HTTPException(status_code=413, detail="This Word document expands beyond the supported size. Remove large images or upload a simpler resume.")
            if len(names) != len(set(names)) or any(entry.flag_bits & 1 for entry in entries):
                raise HTTPException(status_code=422, detail="This Word document is encrypted or malformed. Upload an unlocked, newly saved DOCX file.")
            if archive.getinfo("word/document.xml").file_size > 4 * 1024 * 1024:
                raise HTTPException(status_code=413, detail="This Word document is too complex. Upload a shorter, simpler resume.")

        document = Document(BytesIO(data))
        parts: list[str] = []
        has_tables = False
        total_chars = 0

        def append(text: str) -> None:
            nonlocal total_chars
            total_chars += len(text) + 1
            _check_text_size(total_chars)
            parts.append(text)

        def read_blocks(container: Any) -> None:
            nonlocal has_tables
            for block in container.iter_inner_content():
                if isinstance(block, Table):
                    has_tables = True
                    seen_cells: set[Any] = set()
                    for row in block.rows:
                        for cell in row.cells:
                            if cell._tc in seen_cells:
                                continue
                            seen_cells.add(cell._tc)
                            read_blocks(cell)
                else:
                    append(block.text)

        read_blocks(document)
        warnings = ["This resume contains tables. Check the extracted section order before continuing."] if has_tables else []
        return "\n".join(parts), warnings
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail="The DOCX file could not be read. It may be damaged, password protected, or saved in another format. Save a new .docx copy and try again.") from exc


_SECTION_NAMES = {
    "education": ["education", "academic background", "academic qualifications", "qualifications", "education and certifications", "certifications", "certificates", "coursework", "relevant coursework"],
    "experience": ["experience", "work experience", "professional experience", "employment", "employment history", "work history", "internships", "projects", "academic projects", "personal projects", "selected projects", "research experience", "volunteer experience"],
    "skills": ["skills", "technical skills", "professional skills", "key skills", "core skills", "core competencies", "technical competencies", "skills and tools", "tools and technologies", "technical proficiencies", "technologies", "programming languages", "tools", "languages"],
    "interests": ["interests", "hobbies", "hobbies and interests", "areas of interest"],
    "strengths": ["strengths", "personal strengths", "key strengths", "soft skills"],
    "work_preferences": ["work preferences", "workplace preferences", "preferred work environment"],
    "career_goals": ["career goals", "goals", "career objective", "objective", "professional objective"],
    "preferred_industries": ["preferred industries", "industries of interest"],
    "summary": ["summary", "professional summary", "profile", "professional profile", "about me"],
    "ignore": ["contact", "contact information", "personal details", "personal information", "references", "publications", "awards", "honors", "achievements"],
}


def _heading_key(text: str) -> str:
    return re.sub(r"\s+", " ", text.casefold().replace("&", "and")).strip(" :\t•-–—")


_HEADINGS = {_heading_key(label): field for field, labels in _SECTION_NAMES.items() for label in labels}


def _sections(text: str) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {field: [] for field in _SECTION_NAMES}
    active = "summary"
    for line in text.splitlines():
        field = _HEADINGS.get(_heading_key(line))
        remainder = ""
        if field is None:
            prefix, separator, suffix = line.partition(":")
            if separator:
                field = _HEADINGS.get(_heading_key(prefix))
                remainder = suffix.strip()
        if field is not None:
            active = field
            if remainder:
                sections[active].append(remainder)
        elif line:
            sections[active].append(line)
    return sections


# Short or everyday aliases are accepted only as explicit items in a skills list.
_TECH_ALIASES = {
    "Python": ["python", "python programming"],
    "JavaScript": ["javascript", "java script", "js"],
    "TypeScript": ["typescript", "type script", "ts"],
    "Java": ["java"], "C++": ["c++"], "C#": ["c#"], "C": ["c"], "R": ["r"],
    "Go": ["go", "golang", "go programming"], "Rust": ["rust", "rust programming"],
    "SQL": ["sql", "structured query language"], "HTML": ["html", "html5"],
    "CSS": ["css", "css3"], "React": ["react", "react.js", "reactjs"],
    "Next.js": ["next.js", "nextjs"], "Vue.js": ["vue.js", "vuejs"],
    "Angular": ["angular", "angularjs"], "Node.js": ["node.js", "nodejs"],
    "Express.js": ["express.js", "expressjs"], "Django": ["django"],
    "Flask": ["flask"], "FastAPI": ["fastapi"], "Spring Boot": ["spring boot"],
    ".NET": [".net", "dotnet", "asp.net"], "PHP": ["php"], "Laravel": ["laravel"],
    "Kotlin": ["kotlin"], "Swift": ["swift", "swift programming"],
    "Flutter": ["flutter"], "Dart": ["dart", "dart programming"],
    "PostgreSQL": ["postgresql", "postgres"], "MySQL": ["mysql"], "SQLite": ["sqlite"],
    "MongoDB": ["mongodb"], "Redis": ["redis"], "Firebase": ["firebase"],
    "Git": ["git"], "GitHub": ["github"], "Docker": ["docker"], "Kubernetes": ["kubernetes", "k8s"],
    "Linux": ["linux"], "Bash": ["bash"], "AWS": ["aws", "amazon web services"],
    "Microsoft Azure": ["azure", "microsoft azure"], "Google Cloud": ["google cloud", "gcp"],
    "Machine learning": ["machine learning", "ml"], "Deep learning": ["deep learning"],
    "Natural language processing": ["natural language processing", "nlp"],
    "Artificial intelligence": ["artificial intelligence", "ai"],
    "TensorFlow": ["tensorflow"], "PyTorch": ["pytorch"], "scikit-learn": ["scikit-learn", "sklearn"],
    "pandas": ["pandas"], "NumPy": ["numpy"], "Matplotlib": ["matplotlib"],
    "Data analysis": ["data analysis", "data analytics"], "Data visualization": ["data visualization", "data visualisation"],
    "Microsoft Excel": ["microsoft excel", "ms excel", "excel"],
    "Microsoft Word": ["microsoft word", "ms word"],
    "Microsoft PowerPoint": ["microsoft powerpoint", "powerpoint", "power point"],
    "Power BI": ["power bi", "powerbi"], "Tableau": ["tableau"],
    "Figma": ["figma"], "Adobe Photoshop": ["adobe photoshop", "photoshop"],
    "Adobe Illustrator": ["adobe illustrator"],
    "UX design": ["ux design", "user experience design"],
    "UI design": ["ui design", "user interface design"],
    "REST APIs": ["rest api", "rest apis", "restful api", "restful apis"],
    "GraphQL": ["graphql"], "Agile": ["agile"], "Scrum": ["scrum"],
    "Project management": ["project management"], "Problem solving": ["problem solving"],
    "Communication": ["communication", "communication skills"], "Teamwork": ["teamwork", "team work"],
}
_EXPLICIT_ONLY = {"c", "r", "go", "js", "ts", "ml", "ai", "rust", "swift", "dart", "react", "flask", "excel", "agile", "communication", "teamwork"}
_TOKEN_PATTERN = re.compile(r"\.net\b|[a-z0-9]+(?:\.[a-z0-9]+)*[+#]*")
_NEGATED = re.compile(r"\b(?:no|not|never|without|lack|lacking|unfamiliar|learning|learn|interested|aspire|aspiring|want|hope)\b", re.I)
_LEARNING_DISCIPLINES = re.compile(r"\b(?:machine|deep|reinforcement|transfer|federated|supervised|unsupervised|statistical)\s+learning\b|\bscikit[-\s]+learn\b", re.I)


def _tokens(text: str) -> list[re.Match[str]]:
    return list(_TOKEN_PATTERN.finditer(text.casefold()))


@lru_cache(maxsize=1)
def _skill_trie() -> dict[str, Any]:
    """A token trie avoids rescanning the resume once per occupational label."""
    trie: dict[str, Any] = {}
    canonical_aliases = {alias.casefold(): label for label, aliases in _TECH_ALIASES.items() for alias in aliases}

    def add(alias: str, label: str, source: str) -> None:
        parts = [match.group() for match in _tokens(alias)]
        if not parts or len(parts) > 12 or len(alias) > 120:
            return
        if source == "taxonomy" and (len(alias) < 4 or len(parts) == 1 and len(parts[0]) < 4):
            return
        node = trie
        for part in parts:
            node = node.setdefault(part, {})
        node[""] = (canonical_aliases.get(label.casefold(), label), source, alias.casefold())

    for name, columns in [
        ("esco_skills.csv", ["preferredLabel"]),
        ("onet_essential_skills.csv", ["Element Name"]),
        ("onet_transferable_skills.csv", ["Element Name"]),
        ("onet_software_skills.csv", ["Element Name", "Workplace Example"]),
    ]:
        with (DATA_DIR / name).open(encoding="utf-8-sig", newline="") as source:
            seen: set[str] = set()
            for row in csv.DictReader(source):
                for column in columns:
                    label = row.get(column, "").strip()
                    if not label or label in seen:
                        continue
                    seen.add(label)
                    add(label, label, "taxonomy")
                    if column == "preferredLabel":
                        for alias in row.get("altLabels", "").splitlines():
                            add(alias.strip(), label, "taxonomy")
    # Curated labels take precedence over differently named aliases in the datasets.
    for label, aliases in _TECH_ALIASES.items():
        for alias in aliases:
            add(alias, label, "curated")
    return trie


def _skills_in(text: str, explicit: bool) -> list[str]:
    # Contact links alone do not establish proficiency with a tool such as GitHub.
    text = re.sub(r"(?:https?://|www\.)\S+|\b\S+@\S+\b|\b(?:github|gitlab)\.com/\S+", " ", text, flags=re.I)
    normalized = text.casefold()
    tokens = _tokens(normalized)
    trie = _skill_trie()
    found: list[str] = []
    index = 0
    while index < len(tokens):
        node = trie
        best: tuple[int, str] | None = None
        end = index
        while end < len(tokens) and tokens[end].group() in node:
            # Do not create a phrase across list items, sentences, or section lines.
            if end > index and re.search(r"[,;:|\n.!?]", normalized[tokens[end - 1].end():tokens[end].start()]):
                break
            node = node[tokens[end].group()]
            if "" in node:
                label, source, alias = node[""]
                start_pos, end_pos = tokens[index].start(), tokens[end].end()
                sentence_start = max(normalized.rfind(delimiter, 0, start_pos) for delimiter in ["\n", ".", ";", "!"])
                prefix = normalized[max(sentence_start + 1, start_pos - 80):start_pos]
                # "Machine learning, Python" describes skills, while "learning Python"
                # is an aspiration. Do not treat the discipline name as a negation.
                allowed = not _NEGATED.search(_LEARNING_DISCIPLINES.sub("", prefix))
                if source == "taxonomy" and end == index and not explicit:
                    allowed = False
                if alias in _EXPLICIT_ONLY:
                    before = normalized[:start_pos].rstrip(" \t")
                    after = normalized[end_pos:].lstrip(" \t")
                    standalone_item = (not before or before[-1] in ",;|\n:•*-–—") and (not after or after[0] in ",;|\n•.")
                    allowed = allowed and explicit and standalone_item
                if allowed:
                    best = (end, label)
            end += 1
        if best:
            index = best[0] + 1
            if best[1].casefold() not in {label.casefold() for label in found}:
                found.append(best[1])
        else:
            index += 1
    return found


def extract_profile(text: str) -> tuple[ExtractedProfile, list[str]]:
    sections = _sections(text)
    values: dict[str, Any] = {}
    warnings = ["Review and correct this profile before finding careers. Only explicitly mentioned information is suggested; skill level is not inferred."]
    for field in ExtractedProfile.model_fields:
        if field == "skills":
            continue
        value = "\n".join(sections[field]).strip()
        if len(value) > MAX_PROFILE_CHARS:
            value = value[:MAX_PROFILE_CHARS].rsplit("\n", 1)[0]
            warnings.append(f"The {field.replace('_', ' ')} section was shortened. Review the extracted text for anything you want to add.")
        values[field] = value

    skills = _skills_in("\n".join(sections["skills"]), explicit=True)
    supporting_text = "\n".join(line for field in ["summary", "education", "experience", "strengths"] for line in sections[field])
    for skill in _skills_in(supporting_text, explicit=False):
        if skill.casefold() not in {label.casefold() for label in skills}:
            skills.append(skill)
    if len(skills) > MAX_SKILLS:
        warnings.append("Only the first 80 recognized skills are shown. Remove irrelevant skills before continuing.")
    values["skills"] = skills[:MAX_SKILLS]
    if not values["education"]:
        warnings.append("No education section was identified. Add or confirm your education manually.")
    if not values["experience"]:
        warnings.append("No experience or projects section was identified. Add relevant work or projects manually.")
    if not values["skills"]:
        warnings.append("No skills were confidently recognized. Add your skills manually; unrecognized skills may still appear in the extracted text.")
    return ExtractedProfile(**values), warnings


@router.post("/api/resume/extract", response_model=ResumeExtraction)
def extract_resume(file: UploadFile = File(...)) -> ResumeExtraction:
    """Read a resume locally and suggest an editable profile. No upload is retained."""
    try:
        filename = (file.filename or "").replace("\\", "/").rsplit("/", 1)[-1]
        filename = _clean_text(filename).replace("\n", " ")[:255]
        suffix = Path(filename).suffix.casefold()
        if suffix not in {".pdf", ".docx"}:
            raise HTTPException(status_code=415, detail="Upload a PDF or DOCX resume. Other file types, including .doc and images, are not supported.")
        data = file.file.read(MAX_FILE_BYTES + 1)
        if len(data) > MAX_FILE_BYTES:
            raise HTTPException(status_code=413, detail="Upload a resume smaller than 5 MiB.")
        if not data:
            raise HTTPException(status_code=422, detail="This file is empty. Choose a PDF or DOCX resume with readable text.")
        raw_text, format_warnings = _pdf_text(data) if suffix == ".pdf" else _docx_text(data)
        text = _clean_text(raw_text)
        _check_text_size(len(text))
        if sum(character.isalnum() for character in text) < 20:
            raise HTTPException(status_code=422, detail="No usable resume text was found. Scanned or image-only documents need OCR, which is not supported yet. Upload a text-based PDF or DOCX, or enter your profile manually.")
        profile, warnings = extract_profile(text)
        return ResumeExtraction(
            filename=filename,
            profile=profile,
            extracted_text=text,
            warnings=format_warnings + warnings,
            extraction_method="pdf_text" if suffix == ".pdf" else "docx_text",
        )
    finally:
        file.file.close()
