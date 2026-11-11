# CareerBridge AI

A career exploration FYP built with React, FastAPI, O*NET/ESCO occupational data,
and pretrained Sentence Transformers embeddings.

## Current milestone

- Animated, responsive home page and a dedicated sign-in/sign-up experience.
- Dark charcoal/lime and light ivory/green themes with a shared animated thread
  background. The header switch works throughout the app, preserves profile
  answers, and remembers your choice on this browser. Dark is the initial default.
- Progressive discovery starts with a role. Students choose an education level
  and subject; other roles can include a short description. Previous answers stay
  visible as the next borderless prompt appears.
- Contextual skill suggestions come from related O*NET/ESCO occupations using
  the existing embedding model. Choose at least three, add your own, select all,
  or request another batch without losing selections.
- An editable career identity combines confirmed education, experiences and skills.
  Add/remove entries, copy the statement, or save the profile to an account.
- Explore twelve career possibilities in a constellation, then inspect skills and gaps.
  The desktop map fits the viewport with six spacious career entries per page.
  Previous/next controls reveal all twelve results; phones use a readable vertical
  list. Selecting a career opens its full details.
- Take action with resume/ATS review, resume and cover-letter drafting, or a
  four-week learning roadmap. The career identity and manual document starters
  use confirmed profile details. Optional AI writing uses the backend Gemini
  configuration and offers a preview with supporting profile evidence before
  replacing any edits. Download the final text or an editable Word document.
  See [writing assistance](docs/DOCUMENT_WRITING.md).
- Background motion can be paused and respects reduced-motion preferences.
  Scene transitions preserve keyboard focus; the layout adapts to mobile screens.
- Both the home resume button and “Workshop your resume” open a dedicated resume
  studio inside the animated discovery interface, with dark/light themes,
  borderless profile editing, and resume/job-description insights. Confirm the
  extracted details to continue to your career identity. The full profile editor
  remains available as an explicit alternative.
- Enter a profile manually, or upload a text-based PDF/DOCX resume.
- Successful uploads automatically fill the editable profile, preserving existing
  answers and deduplicating recognised skills. Review the extraction and correct
  any mistakes before continuing.
- Edit and confirm the profile before discovering careers.
- Receive an explained ATS readiness estimate and actionable resume suggestions.
  Add a job description to compare recognised skills and calculate a tailored estimate.
- Rank career descriptions against the profile using `all-MiniLM-L6-v2`.
- Explore role-specific learning priorities, listed/confirmed skills, and potential gaps.
  Practical skills, actual workplace tools, and transferable foundations are grouped
  separately, with expandable source details. This applies across the career catalogue;
  see [skill selection and limitations](docs/SKILL_PRIORITIES.md).
- Local ML retrieves related evidence from skills, experience, and education.
  Review the supporting quote and confirm or dismiss a suggested connection;
  similarity alone never counts as coverage. Answers are scoped to the career,
  survive same-tab refresh, can be undone, and reset when the profile changes.
  Roadmaps use these reviewed gaps. Model outages fall back to explicit/fuzzy
  matching with a visible notice. See the [evaluation report](backend/evaluation/README.md)
  for the baseline comparison, reproducible commands, and limitations.
- Generate a four-week learning roadmap, with optional server-side AI
  personalization and YouTube lessons. Weekly tasks, practical work samples,
  video playback and search links appear inside CareerBridge in all roadmap
  views. Plans, including lesson metadata, use the existing saved-roadmap flow.
  Lessons progress from foundations to guided/applied practice and a project,
  with stage-specific searches and no repeated video IDs across a rebuilt plan.
  See [AI roadmap setup](docs/AI_ROADMAPS.md) to configure the backend keys.
- Track roadmap lessons, tasks and projects with reversible checkoffs, weekly
  counts, an overall completion percentage and **Continue learning**. Optional
  videos do not affect the percentage. Progress survives same-tab refresh;
  **Save roadmap** stores it with the plan in the existing Supabase table.
  Saved space shows the saved completion percentage. Older plans start at zero.
  Rebuilding starts fresh after a warning; saving the new plan replaces the
  saved plan for that career. Completion is self-reported activity tracking,
  not an assessment of proficiency or automatic video-watch tracking.
- Supabase integration for Google sign-in, email signup/login, email confirmation,
  password reset, and saving/loading profiles, career bookmarks and roadmaps.
  Saved space opens directly inside the current interface in both themes.
  Connect a Supabase project using the steps below to activate accounts.
  Guest exploration remains available.

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
.\start.cmd
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

For a new project, follow the [Google login and Supabase setup guide](docs/SUPABASE_SETUP.md).
It covers project creation, Google OAuth, exact callback URLs, and real-account checks.

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
reviewed fields, which may contain personal information. The current workspace
(including profile edits, extracted resume text, results, and letter drafts) is
temporarily kept in this tab's `sessionStorage` so refreshing restores the same
interface and step. This is separate from saving to an account; the original
uploaded file is not stored. Storage is scoped to the current user or guest,
and signing out clears it. If browser storage is unavailable, the app still
opens the new discovery flow, but unsaved work cannot survive a refresh.
Saved profiles are restored with **Load saved profile** so they do not silently
overwrite current edits. Saved profiles, bookmarks and roadmaps can be loaded or removed
from **Saved space** in the current discovery header or home navigation.
Google sign-in uses PKCE and returns to the current interface. A guest draft is
carried into the account only after a sign-in initiated in that tab; it is not
automatically uploaded. Failed or cancelled sign-in keeps the guest draft.

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

The encoder loads the cached `sentence-transformers/all-MiniLM-L6-v2` weights
without contacting Hugging Face. If the cache is incomplete, it downloads the
model once. Concurrent requests share one loader and one warm-up inference.
You can check it separately from the frontend in the backend environment:

```bash
python -m app.model_runtime
```

The model is cached by Hugging Face. Set `HF_HOME` to a persistent writable folder
if the default cache directory is unavailable. Network-restricted environments
need access to Hugging Face and its model-download hosts. Do not disable TLS
verification to resolve connectivity problems.

On Windows, run `start.cmd` from `backend` (`.\start.cmd` in PowerShell). It uses
the existing virtual environment, loads `.env` when present, and waits for
`[model] READY` before reporting application startup complete. It does not use
`--reload`, which restarts the process and reloads weights when code changes.
Use `CAREERBRIDGE_PRELOAD_MODEL=1` for the same startup behaviour with a manual
Uvicorn command. Without that flag, model loading happens on the first ML request.

Console messages distinguish library imports, local cache loading, downloading,
and warm-up. `GET /api/model-status` reports `not_loaded`, `loading`, `ready` or
`error` without loading the model itself. CPU inference defaults to at most four
threads; `CAREERBRIDGE_MODEL_THREADS` (1–16) and `CAREERBRIDGE_MODEL_DEVICE` can
override this. See [startup troubleshooting](docs/MODEL_STARTUP.md).

`career_embeddings.npy` contains the career vectors, not the model weights. The
encoder is still needed to embed each new profile. The notebook generated these
vectors with a pretrained model; it did not fine-tune model weights.

Skill suggestions also use the shipped `backend/data/skill_rankings.json.gz`
index to avoid repeatedly encoding fixed occupational skill descriptions. Only
the user's story needs a fresh encoding. Keep this file when deploying; missing
entries fall back to slower live ranking. Initial model loading still takes
time. See [discovery performance](docs/DISCOVERY_PERFORMANCE.md) for measurements
and rebuild instructions.

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
autofill, resume studio navigation/review confirmation, cancelled uploads, resume
review, stale responses, mobile layouts, reduced motion, account
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
verify the model; use `GET /api/model-status` for readiness and
`POST /api/careers/recommend` with a nonempty profile for an end-to-end check.

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
- Skill matching is a first-pass comparison with occupational labels. Personalized
  roadmaps are generated drafts, and YouTube results are not a reviewed curriculum.
  Without AI configuration, roadmaps use fixed starter milestones.

## Remaining FYP milestones

1. Evaluate extraction quality and career recommendations with reviewed examples.
2. Improve career matching with confirmed skills, interests, and work preferences.
3. Evaluate AI roadmap relevance and lesson quality with learner feedback.
4. Evaluate the resume scoring rubric against reviewed examples and expand
   skill/section recognition across disciplines.
5. Verify deployed Google redirects, saved-data isolation, and email delivery.
6. Consider OCR and production deployment (including request limits for public
   document/model endpoints) as separate milestones.

The interface and recommendation approach are independently implemented, with
career-exploration products such as Google Career Dreamer serving as references
for the user journey.
