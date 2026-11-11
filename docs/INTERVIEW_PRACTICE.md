# Interview practice

Open **Take action → Practise your interview**. The target defaults to the
selected career and can be edited. Review the profile details, confirm them,
then start a five-question session: introduction, experience, role knowledge,
problem solving and reflection.

Write your own answers and request feedback individually. Coaching includes
strengths with verbatim excerpts, improvements, a revision outline and a
follow-up question. It does not assign a hiring score, certify proficiency or
write fictional personal achievements. Check technical advice against reliable
sources. Answer excerpts are validated by the server; the interpretation of
those excerpts still needs human review.

Answers and feedback survive refresh in the current browser tab. Editing an
answer hides feedback for the previous version. Changing the role or profile
keeps existing notes but requires a new session before requesting further
feedback. Cancelling a request, navigating to another question or leaving the
workspace discards late responses. Starting a replacement session warns before
replacing answers; failed generation leaves the previous session intact.

**Download practice notes** exports the current questions, answers and applicable
feedback as a text file. Interview sessions are not saved to Supabase. They use
the same user-scoped, tab-scoped draft storage as the rest of the workspace;
signing out clears the local workspace. Download notes before closing the tab
or signing out. No database migration is needed.

## Backend setup

The feature uses the existing `GEMINI_API_KEY` and optional `GEMINI_MODEL` in
`backend/.env`. Restart the backend after pulling the update. There are no new
dependencies or credentials, and keys are never sent to the frontend.

- `POST /api/interview/questions` receives the target role and reviewed profile.
- `POST /api/interview/feedback` additionally receives the current question and
  user-written answer (20–5,000 characters after the minimum whitespace check).
- When AI questions are unavailable, the app identifies the returned questions
  as general starter practice. It does not claim these are personalized.
- When feedback is unavailable, answers remain editable and self-review prompts
  remain available. The endpoint returns a safe error, not fabricated coaching.
- Questions and feedback share the existing process-wide generation budget with
  roadmap and writing requests: two concurrent calls and 20 calls per hour.
  This is a local cost guard, not per-user authentication or a distributed quota.
  Public deployments should add authenticated usage limits before exposing
  paid generation to arbitrary traffic.

Provider responses are schema-validated and bounded. The backend rejects invalid
categories, repeated questions, truncated output, empty text and strength quotes
that do not occur in the submitted answer. Logs contain error categories, not
profile text, answers or provider error bodies. Requests use the server-side
provider connection; the UI uses CareerBridge branding throughout.

## Verification

`backend/tests/test_interview.py` covers schema validation, prompt context,
fallbacks, provider failures, quote grounding, secret handling and the shared
generation budget with a mocked provider. `frontend/tests/interview.spec.js`
covers persistence, navigation, edited answers, late-response cancellation,
retries, export, replacement warnings, completion, mobile layout and both themes.
Live output quality should also be reviewed using a configured backend across
technical and non-technical roles.
