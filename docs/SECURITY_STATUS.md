# Current security measures and limits

CareerBridge has baseline security controls for local testing. It has not had
an independent security audit and is not yet hardened for unrestricted public
deployment.

## Implemented

- Supabase handles email/password authentication, Google OAuth, session refresh
  and password recovery. Google login uses PKCE. OAuth callback codes and errors
  are removed from the browser URL after handling.
- Supabase row-level security and table grants restrict profiles, saved careers
  and roadmaps to their owning authenticated user. Anonymous users cannot access
  these tables. PostgreSQL policy tests cover reads, writes, owner changes and
  account-deletion cascades. Apply the supplied migration to enforce these rules
  in your own project.
- AI and video API keys are read by the backend; the browser receives only public
  Supabase configuration. Environment files are ignored by Git. Never put a
  service-role key or provider secret in a frontend environment variable.
- API input schemas constrain text lengths and supported values. Resume uploads
  have request/file limits, page limits and archive expansion checks. Original
  resume files are not deliberately stored by the application.
- AI output is schema-validated. Writing claims require profile references;
  interview strengths require excerpts from the submitted answer. Provider error
  bodies and secrets are not returned in those errors. These checks do not prove
  every generated statement is correct.
- AI requests share a process-wide concurrency and hourly budget. The API has a
  configurable CORS allowlist. CORS is a browser policy, not access control.
- Local workspace drafts are scoped to the account or guest and cleared on
  sign-out/account changes. They are kept in browser session storage, not encrypted
  private storage. Supabase sessions persist in browser storage.
- Account names are rendered as text. Google photos use HTTPS Google image hosts
  with no referrer; a failed image falls back to initials. Account metadata is
  display information and is never used to grant database access.

## Still needed before a public launch

- Authentication and per-user/per-IP rate limits for costly public API endpoints.
  The current FastAPI analysis/generation routes do not require a Supabase token.
  The process-wide AI budget is not a distributed quota or an abuse-proof limit.
- HTTPS hosting, strict deployed-origin configuration and reviewed OAuth redirect
  URLs. Configure Supabase email/password protections, abuse controls and mail
  delivery for the actual project.
- Deployment secret management, request/response security headers, monitoring,
  dependency review and backup/recovery procedures.
- A clear privacy/retention notice for profile data sent to AI providers and a
  reviewed account-deletion process. The existing UI can delete saved items;
  deleting an authentication account is not a user-facing feature yet.
- A security review and testing of the deployed system. Local mocks do not
  validate the live Google/Supabase project configuration.

Deployment remains paused while local testing is in progress.
