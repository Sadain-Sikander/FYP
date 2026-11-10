# Resume and cover-letter assistance

CareerBridge can suggest application wording from the reviewed education,
experience/projects and skills in a profile. The selected career or an editable
target role, organisation and job description guide the writing. Gemini runs
behind the backend; users stay inside the current dark/light interface.

## Using it

The existing `GEMINI_API_KEY` and optional `GEMINI_MODEL` in `backend/.env` are
reused. No additional key or database migration is needed. Pull the changes,
install backend requirements if needed, and restart with:

```cmd
python -m uvicorn app.main:app --env-file .env --host 127.0.0.1 --port 8000
```

Restart the frontend too. From **Take action**:

- **Start a cover letter:** keep or edit the manual starter, enter the target
  role/organisation and optional job description, review the source profile,
  then select **Generate AI draft**.
- **Workshop your resume:** upload/review a resume, or use the profile already
  entered. The **Build a resume from your story** section can create a manual
  starter or an AI suggestion. Uploaded profile details must be confirmed first.
- Review the proposed text and expand **See the source details behind the
  wording**. Suggestions do not overwrite the editable document automatically.
  Choose **Use this draft** to replace it, or **Keep my current draft**.
- Edit the accepted draft, replace contact placeholders, and check all claims.
  Copy, download text, or select **Download Word** for a `.docx` containing the
  actual edited document. Word export works without AI keys.

Changing the profile or target cancels pending generation and hides suggestions
for the old context. Current edits remain. Navigating away cancels the pending
request; a late response cannot overwrite a newer document. Drafts and target
fields survive same-tab refresh in the existing account-scoped session storage.
They are not saved in Supabase's profile or roadmap tables. Closing the tab or
clearing browser storage can remove them; download a copy to keep it.

An edited resume draft does not change the uploaded resume or its ATS score.
Download, complete and re-upload a revised document if you want to assess it.

## Grounding and limitations

- The backend sends only the reviewed education, experience/projects, skill
  list and writing target. It does not send the original resume file, account
  identifiers or authentication tokens. Users explicitly request generation.
- The prompt distinguishes job requirements from evidence of the applicant's
  qualifications. It asks for concise wording, citations to profile facts,
  and questions for missing information instead of invented achievements.
- Structured output must reference existing source IDs. Resume experience
  statements must cite experience entries, not skill or education entries.
  Resume education and skills are inserted directly from the supplied profile.
  Unsupported numeric tokens in generated claims reject the whole suggestion.
- These checks do **not** prove semantic accuracy. A model may overstate a claim
  even with a valid citation, and spelled-out numbers can evade the numeric
  check. Users must compare the wording with its displayed evidence before use.
  The feature does not guarantee ATS performance, job suitability or employment.
- Missing configuration, quotas, blocked/malformed responses and provider
  failures leave manual editing available. Errors never return provider response
  bodies, keys or prompts. Sanitized backend logs contain only failure categories.
- AI requests share the roadmap's process-local limit of two concurrent requests
  and 20 starts per rolling hour. Deployed services still need shared/per-user
  limits and provider budgets as described in the roadmap setup guide.

## API and verification

`POST /api/documents/draft` accepts `kind` (`resume` or `cover_letter`),
`profile`, `profile_reviewed`, `job_title`, `company` and `job_description`.
It returns editable text, supporting profile evidence, missing-detail questions
and a review note. Input lengths and output shapes are bounded.

`POST /api/documents/export` accepts `kind` and `text`, and returns a Word
document with `Cache-Control: no-store`. It creates the file in memory, strips
XML-incompatible control characters, and does not call the AI provider.

Backend tests cover provider failures, evidence validation, invented numeric
claims, shared request limits and actual Word-file contents. Browser tests cover
review-before-apply, cancellation, preserved edits, refresh, export and mobile
themes. Google responses are mocked: live wording quality and model access must
be checked with the deployment's configured key and representative profiles.
