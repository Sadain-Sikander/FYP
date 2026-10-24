# Enable Google login and saved user data

The application code is ready, but accounts stay disabled until a Supabase project
is configured. A Gemini key is not needed for this feature.

## 1. Create the Supabase project

1. Open <https://supabase.com/dashboard>, create an organisation if needed, and
   create a project. Keep its database password private.
2. Open the project's SQL Editor and run
   [`202610200001_user_data.sql`](../supabase/migrations/202610200001_user_data.sql)
   once. Existing projects that already applied this migration must not rerun it.
3. Under the project's API settings (or Connect dialog), copy the project URL
   and **publishable key**. A legacy public `anon` key is also supported.
4. Copy `frontend/.env.example` to `frontend/.env.local` and fill in:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
   ```

   Never put a `service_role` key, secret key, database password, or Google client
   secret in a `VITE_` variable. These variables are included in the browser bundle.

## 2. Register the application URLs

In Supabase **Authentication → URL Configuration**:

- Set **Site URL** to the app's URL. During development, use
  `http://localhost:5173`; replace it with the deployed HTTPS URL for production.
- Add the URLs you actually use to **Redirect URLs**, including:

  ```text
  http://localhost:5173/
  http://localhost:5173/?auth_callback=1
  http://127.0.0.1:5173/
  http://127.0.0.1:5173/?auth_callback=1
  https://YOUR_APP_DOMAIN/
  https://YOUR_APP_DOMAIN/?auth_callback=1
  ```

  Substitute your real domain; don't add the placeholder. The root URL supports
  email confirmation/recovery. The query-marked URL supports Google login.
  If the app is hosted under a subpath, include that path in both entries.
  Use the same hostname throughout a login: localhost and 127.0.0.1 have separate
  browser storage. New code-based email links should also be opened in the browser
  where the flow began.

## 3. Connect Google

1. Open <https://console.cloud.google.com/> and create/select a project.
2. In **Google Auth Platform** (also available through APIs & Services → OAuth
   consent screen), configure the app name **CareerBridge**, support email,
   audience, and contact details. For an external app in testing, add the Google
   accounts you will use as test users. Request only basic sign-in identity scopes.
3. Create an **OAuth client ID** with application type **Web application**.
4. In Supabase **Authentication → Sign In / Providers → Google**, copy the callback
   URL shown by Supabase. Add that exact URL to the Google client's **Authorised
   redirect URIs**. It normally looks like:

   ```text
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   ```

   This is the provider callback, distinct from the app URLs in step 2. For this
   redirect-based integration, the frontend does not need a Google client ID.
5. Copy the Google client ID and client secret into the Supabase Google provider
   settings, enable the provider, and save. The client secret stays in Supabase.
6. For public release, update Google's audience/publishing settings and any
   required consent-screen verification. For testing, use an approved test user.

## 4. Start and verify

Restart Vite after editing `.env.local`. For production, configure the two public
variables on the frontend host and rebuild. No backend service-role key is needed.
If the development environment restricts outbound traffic, allow your actual
Supabase project hostname. Google login also requires the browser to reach Google.

Verify with real accounts:

1. Enter a guest story, choose **Sign in to save → Continue with Google**, and
   complete Google sign-in. The same story should return in the current interface.
2. Choose **Save profile**. Saving is explicit; signing in does not upload the
   guest draft automatically.
3. Save a career and a roadmap. Open **Saved space** in the header to load or
   delete them without opening the full profile editor.
4. Sign out, then sign in again. Open Saved space to restore saved work. Signing
   out clears local workspace data; unsaved drafts are not account backups.
5. Sign in with a second Google test account and verify its saved space is empty.
6. Cancel Google login and verify that the app offers retry and guest exploration.

Email signup, login, and password recovery remain available when the Email
provider is enabled. Configure SMTP and verify email delivery separately for
public use. Google-only accounts do not need to create an app password.

## What is stored

| Data | Where | When |
| --- | --- | --- |
| Google identity, email, auth session | Supabase Auth / SDK session storage | On sign-in |
| Reviewed profile fields and career identity | `public.profiles` | Save profile |
| Bookmarked careers | `public.saved_careers` | Save career |
| Generated roadmap | `public.saved_roadmaps` | Save roadmap |
| Unsaved profile/resume text, results, cover-letter drafts, skill confirmations | This tab's session storage | While using the workspace |
| Original uploaded PDF/DOCX | Processed by the API, not deliberately persisted | Upload request only |

All three application tables use the authenticated user's ID and Row Level
Security. The public key alone cannot read saved rows. Google creates an Auth user;
no separate public profile row is required until the person chooses Save profile.
Deleting an Auth user through Supabase cascades their saved application rows.
There is no in-app account-deletion feature yet.

The current schema does not back up entire unsaved workspaces, original resume
files, cover-letter drafts, or per-career skill confirmations across devices.
Saved roadmaps retain the plan generated from the user's choices at save time.

## Troubleshooting

- **Accounts are not connected:** check both Vite variables and restart/rebuild.
- **Unsupported provider / Google disabled:** enable Google in Supabase and enter
  the OAuth client ID and secret there.
- **redirect_uri_mismatch:** Google's authorised redirect URI must exactly match
  the callback displayed in Supabase, including the project reference.
- **Unexpected app URL after login:** check Supabase Site URL and Redirect URLs.
- **Cancelled/expired sign-in:** start again from the app in the same browser;
  old callback codes cannot be reused. Browser storage is required for PKCE.
- **Sign-in works but saves fail:** apply the migration and check the tables and
  RLS policies. Do not disable RLS or move an admin key into the frontend.
- **Only test accounts can sign in:** review the Google consent-screen audience
  and testing/publishing settings.

Browser tests simulate Supabase Auth/REST, including the PKCE challenge and code
exchange. Database tests execute ownership policies in local PostgreSQL (PGlite).
They do not replace this real-project sign-in and isolation check.
