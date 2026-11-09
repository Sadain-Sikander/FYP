# Personalized roadmaps and YouTube lessons

CareerBridge can create a weekly learning plan from the selected career,
education, experience, listed/confirmed skills, and remaining learning targets.
The model runs behind the backend API; users stay inside CareerBridge.
Resume/cover-letter generation is a separate future feature.

## Activate on your computer

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey).
   Choose a model available to your project; the default is `gemini-2.5-flash`.
2. In [Google Cloud Console](https://console.cloud.google.com/), enable **YouTube
   Data API v3** and create an API key restricted to that API. The YouTube key
   is separate from the Google OAuth client used for Supabase sign-in.
3. Copy `backend/.env.example` to `backend/.env` and enter the keys locally:

   ```dotenv
   GEMINI_API_KEY=your_private_gemini_key
   GEMINI_MODEL=gemini-2.5-flash
   YOUTUBE_API_KEY=your_private_youtube_key
   ```

   Do not put these in the frontend, prefix them with `VITE_`/`NEXT_PUBLIC_`,
   commit them, or paste them in chat. The `.env` file is Git-ignored.
4. From `FYP\backend`, with the virtual environment active, run:

   ```cmd
   python -m pip install -r requirements.txt
   python -m uvicorn app.main:app --env-file .env --host 127.0.0.1 --port 8000
   ```

   The `--env-file .env` argument matters: the backend does not automatically
   read this file. Restart after changing keys. Continue running the frontend
   in its own terminal as before.
5. Select a career and click **Build my roadmap**, or **Rebuild plan** for a
   previously generated outline. Successful generation shows **Your personalized
   learning plan**, weekly exercises and a practical work sample. With the
   YouTube key configured, available results have **Watch lesson** and **Open on
   YouTube** controls. The player loads only after you click Watch lesson.

Saved plans are snapshots. Existing saved roadmaps still open; rebuild and save
again to replace one with a new personalized plan. Nothing automatically
overwrites a saved plan.

## How the feature works

- O*NET/ESCO and the existing skill-gap analysis supply the learning targets.
  The server sends a bounded profile context to Gemini; it does not send original
  resume files, account identifiers, authentication tokens or API keys in prompts.
  Generated tasks can still be imperfect and need review.
- Gemini returns structured JSON with exactly one milestone per requested week,
  target IDs, tasks and a project. The server validates week ordering, target
  membership/coverage, types and text lengths before using it. The prompt requests
  4–6 hours of study per week; this is a planning assumption, not a measured estimate.
- The model cannot supply video links. The backend constructs topic searches from
  the career and validated targets, queries YouTube, then checks returned IDs for
  public/embeddable status. Title, channel and links come from those API results.
  Relevance and instructional quality are not independently verified.
- Up to four unique topic searches run per plan, with up to two videos each.
  Public video results are cached for 24 hours in a bounded process-local cache.
  Remaining topics and unavailable results have clearly labelled YouTube search
  links. Regional restrictions or later video removal can still prevent playback;
  the Open on YouTube link provides an alternative.
- Without a Gemini key, there are no external API calls: a starter outline and
  YouTube search links remain available. Without a YouTube key, AI plans still
  work with search links. Provider outages or invalid AI output show an explicit
  starter notice and offer Rebuild plan, without exposing provider error bodies.

## Deployment and limits

Set the same variables as secrets in the **backend** hosting service, not in the
frontend build. Permit outbound HTTPS to `generativelanguage.googleapis.com` and
`www.googleapis.com`. The browser must be able to load
`www.youtube-nocookie.com` for embedded playback. Use your existing deployed
frontend API URL and backend CORS configuration.

Generation is capped at two concurrent requests and 20 starts per rolling hour
per backend process. This is a basic cost bound, not a distributed abuse-control
system. Before public deployment, configure authenticated/per-user limits at
the gateway, shared limits across replicas, provider quotas and billing alerts.
YouTube search consumes quota; exhausted quotas fall back to search links.
Provider limits and pricing depend on the Google project. AI generation is a
network request and can take longer than local skill suggestions.

## Validation and practical limits

Backend tests use mocked Google HTTP responses to check structured generation,
target validation, missing keys, upstream failures, the request budget and
public video filtering. Browser tests check the existing roadmap views, on-demand
playback, reload persistence, retry, and mobile/light/dark rendering. The test
player is mocked; these checks do not establish live API access or video quality.

No Google API credentials are configured in the development cloud environment,
so live generation must be checked after local key setup. If a configured request
falls back, check that the selected model is available, the API is enabled, and
the key's restrictions, quota and billing allow the request. Keep provider keys
and personal profile content out of public logs and screenshots.
The backend logs only a failure category (such as `http_403`, `http_429`, or
`timeout`), without provider response bodies or profile content.
