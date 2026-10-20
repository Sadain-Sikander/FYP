# CareerBridge AI

A career exploration FYP built with React, FastAPI, O*NET/ESCO occupational data,
and pretrained Sentence Transformers embeddings.

## Current milestone

- Enter a profile manually, or upload a text-based PDF/DOCX resume.
- Preview extracted sections and suggested skills before merging them into the profile.
- Edit and confirm the profile before discovering careers.
- Rank career descriptions against the profile using `all-MiniLM-L6-v2`.
- Explore a selected career's essential skills, matched skills, and potential gaps.
- Generate a starter four-week learning roadmap.

Resume extraction uses document text, section headings, and skill-label matching.
It can miss information or suggest a skill mentioned in a different context. Users
must review the suggestions; interests, goals, and preferences should be entered
or confirmed by the user. Uploaded files are processed for the request and are
not deliberately saved to an application upload directory or database. The API
returns extracted text to the browser for review.

Scanned/image-only PDFs need OCR and are not supported in this milestone. Uploads
are limited to 5 MiB. Password-protected, malformed, and oversized documents
receive a useful error so users can upload another file or continue manually.

## Run locally

Use Python 3.11 or 3.12 and a current Node.js LTS release (Node 24 was validated).
Open two terminals at the repository root. The source folders in this repository
are the current application; `CareerBridge_FYP_Starter.zip` is the original starter
archive and does not need to be extracted again.

### Backend — Windows PowerShell

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Backend — Linux/macOS

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
# Linux CPU-only installation avoids downloading unnecessary GPU libraries:
python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
# On macOS, use `python -m pip install torch` instead of the preceding command.
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend — second terminal

```bash
cd frontend
npm ci
npm run dev
```

Vite serves the frontend on port 5173 and forwards `/api` requests to the backend
on port 8000. Open the local address printed by Vite. Both processes must stay
running. Production hosting needs an equivalent `/api` reverse proxy, or a
`VITE_API_BASE_URL` set at frontend build time together with appropriate backend
CORS configuration.

### Embedding model

The first recommendation downloads the public
`sentence-transformers/all-MiniLM-L6-v2` model. This can take longer than later
requests. You can download and check it in advance, using the backend virtual
environment:

```bash
python -c "from sentence_transformers import SentenceTransformer; m = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2'); assert m.encode(['software development']).shape == (1, 384)"
```

The model is cached by Hugging Face. Set `HF_HOME` to a persistent writable folder
if the default cache directory is unavailable. Network-restricted environments
need access to Hugging Face and its model-download hosts. Do not disable TLS
verification to resolve connectivity problems.

`career_embeddings.npy` contains the career vectors, not the model weights. The
encoder is still needed to embed each new profile. The notebook generated these
vectors with a pretrained model; it did not fine-tune model weights.

## Validation

Run the resume extraction tests from `backend`, with its virtual environment active:

```bash
python -m pip install -r requirements-dev.txt
python -m pytest -q
```

The tests exercise real PDF/DOCX bytes, table extraction, skill recognition, and
upload error handling without downloading the embedding model.

Build the frontend from `frontend`:

```bash
npm run build
```

With the API running, run this command from the repository root using the backend
virtual environment:

```bash
python scripts/smoke.py
```

It generates a synthetic DOCX in memory and checks both manual and extracted
profiles through real recommendations, skill gaps, and roadmaps. It needs the
embedding model to be cached or downloadable. Set `CAREERBRIDGE_API_URL` if the
backend is running at a different address.

With both services running, exercise:

1. Manual profile → career recommendations → select a career → skill gaps → roadmap.
2. PDF/DOCX upload → review extraction → merge → edit → confirm → recommendations.
3. Invalid and image-only uploads → clear error → continue manually or retry.

`GET /api/health` checks data loading. A successful health response alone does not
verify the model; use `POST /api/careers/recommend` with a nonempty profile to do so.

## Data and interpretation

- 4,059 career rows: 1,016 O*NET and 3,043 ESCO; 384-dimensional career embeddings.
- Keep `unified_careers.csv` and `career_embeddings.npy` in exactly the same row
  order. Do not sort or deduplicate one without applying the same change to the other.
- Four ESCO IDs are duplicated in the supplied career table. Recommendations
  suppress repeated IDs while preserving the supplied embeddings.
- Semantic similarity ranks related career descriptions. It is not a probability
  of employment, a validated suitability measure, or an ATS score.
- The baseline encoder has a limited input length. Long profiles may be truncated
  during encoding; keep the reviewed profile focused on relevant experience.
- Skill matching is a first-pass comparison with occupational labels. Roadmaps
  currently use rule-based milestones, not a reviewed course curriculum.

## Remaining FYP milestones

1. Evaluate extraction quality and career recommendations with reviewed examples.
2. Improve career matching with confirmed skills, interests, and work preferences.
3. Add reviewed learning resources, practical projects, and progress tracking.
4. Add evidence-based resume-improvement suggestions.
5. Add resume readability checks and an explained job-description match estimate.
6. Consider OCR, accounts, persistent user data, and deployment as separate milestones.

The interface and recommendation approach are independently implemented, with
career-exploration products such as Google Career Dreamer serving as references
for the user journey.
