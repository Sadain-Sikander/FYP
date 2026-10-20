# CareerBridge AI

A career exploration FYP built with React, FastAPI, O*NET/ESCO occupational data,
and pretrained Sentence Transformers embeddings.

## Current milestone

- Animated, responsive home page and a dedicated sign-in/sign-up experience.
- Guided career discovery through four animated chapters: story, strengths,
  curiosity, and review. Selectable prompts help build a profile; answers stay
  editable when moving between chapters or switching to the full profile editor.
  Decorative motion respects the device's reduced-motion preference.
- Enter a profile manually, or upload a text-based PDF/DOCX resume.
- Successful uploads automatically fill the editable profile, preserving existing
  answers and deduplicating recognised skills. Review the extraction and correct
  any mistakes before continuing.
- Edit and confirm the profile before discovering careers.
- Receive an explained ATS readiness estimate and actionable resume suggestions.
  Add a job description to compare recognised skills and calculate a tailored estimate.
- Rank career descriptions against the profile using `all-MiniLM-L6-v2`.
- Explore a selected career's essential skills, matched skills, and potential gaps.
- Generate a starter four-week learning roadmap.
- Supabase integration for signup, login, email confirmation, password reset and
  saving/loading profiles, career bookmarks and roadmaps. Connect a Supabase
  project using the steps below to activate accounts. Guest exploration remains available.

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

### Connect Supabase accounts and user data

The app uses **Supabase Auth + PostgreSQL**, with Row Level Security restricting
each user to their own rows. FastAPI handles document processing and career
analysis; the browser accesses saved data through Supabase using the signed-in
user's access token. The unfinished SQLite account implementation has been removed.

1. Create a Supabase project.
2. Run `supabase/migrations/202610200001_user_data.sql` once in its SQL editor
   (or apply it through the Supabase CLI). This creates profiles, career bookmarks
   and roadmap tables, grants and ownership policies.
3. Copy `frontend/.env.example` to `frontend/.env.local`. Set
   `VITE_SUPABASE_URL` to your project URL and `VITE_SUPABASE_PUBLISHABLE_KEY`
   to its **public publishable key**. The legacy public anon key also works in
   this variable. Never use a secret or `service_role` key in a `VITE_` variable:
   Vite includes these values in the browser bundle.
4. In Supabase Authentication, enable email/password sign-in and email
   confirmation. In URL Configuration, set your app's Site URL and allow its
   exact callback URLs, including your development origin on port 5173 and your
   production HTTPS origin. The app sends confirmation and recovery links to
   the application root; it detects password recovery and opens the update form.
5. Restart Vite after changing environment variables. On production hosting,
   supply these variables before building, then rebuild the frontend.
6. Verify a real signup, confirmation email, sign-in, save/load and password reset.
   Configure Supabase's email sender/SMTP for public use. Browser tests use a
   simulated Auth service; they do not verify your project's email delivery.

There is no server-side service key requirement. Both frontend Supabase values
are public configuration. If your cloud environment restricts network access,
allow your actual Supabase project hostname. Account forms show an unavailable
state when configuration is missing; they never simulate a successful login.

Profile and career saves are explicit actions. Uploading a resume does not save
the original file or extracted text to Supabase. Saving a profile does store the
reviewed fields, which may contain personal information. Guests' profiles stay
in memory and disappear on reload. Signing out clears the current workspace.
Saved profiles are restored with **Load saved profile** so they do not silently
overwrite current edits. Saved profiles, bookmarks and roadmaps can be removed
from the saved-space panel.

### Resume assessment

`POST /api/resume/review` accepts extracted resume `text` and an optional
`job_description`. It runs locally without an LLM or embedding-model request.

- Readiness is the sum of contact details (20), education (15), experience or
  projects (15), skills section (15), length (15), action statements (10), and
  measured impact/scope (10).
- Job-skill coverage is the fraction of recognised unique skill terms found in
  the resume, including supported aliases. Repeating keywords does not increase it.
- With recognised job terms: estimated score = 40% readiness + 60% job-skill
  coverage, rounded to an integer. Without them, only readiness is reported;
  unsupported job descriptions do not receive a fake perfect match.

This is a transparent heuristic, **not an employer ATS score, validated hiring
prediction, or assessment of professional eligibility**. The UI exposes the
formula, evidence, missed keywords and limitations. It cannot assess visual
layout or every requirement. Academic CV length and nonstandard headings may
need manual interpretation. Suggestions never invent achievements or credentials.
Editing a profile does not alter the original resume assessment: upload the
revised document to assess its contents again.

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

The tests exercise real PDF/DOCX bytes, table extraction, skill recognition,
upload error handling, scoring evidence, keyword aliases, and input bounds
without downloading the embedding model.

Build the frontend from `frontend`:

```bash
npm run build
```

For browser and database-policy checks, keep FastAPI running on port 8000, then
generate synthetic fixtures from the repository root using the backend Python:

```bash
python scripts/make_test_resumes.py
cd frontend
npx playwright install chromium
npm run test:e2e
```

The test runner starts frontend servers on ports 5173 and 5174. Port 5174 uses a
test-only Supabase URL and intercepted Auth/REST responses; it creates no hosted
accounts. Use a guest configuration without Supabase variables on port 5173.
Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` if using an already installed Chromium
(this cloud workspace uses `/usr/bin/chromium`).

Tests cover manual recommendations against the real backend, automatic PDF/DOCX
autofill, resume review, stale responses, mobile layouts, reduced motion, account
UI, persistence flows, and sign-out cleanup. PostgreSQL ownership policies run
in PGlite with a simulated `auth.uid()` identity function, checking that another
user cannot read/write/delete someone else's rows. This validates the migration
locally, not the configuration of a hosted Supabase project.

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
4. Evaluate the resume scoring rubric against reviewed examples and expand
   skill/section recognition across disciplines.
5. Connect and verify the hosted Supabase project, including email delivery.
6. Consider OCR and production deployment (including request limits for public
   document/model endpoints) as separate milestones.

The interface and recommendation approach are independently implemented, with
career-exploration products such as Google Career Dreamer serving as references
for the user journey.
