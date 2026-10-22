# Quizwise - Quiz Management System

Quizwise is a Next.js App Router application with a Supabase Postgres, Auth, and Storage backend. The app includes student registration and login, timed quizzes, server-side scoring, result history, and role-protected quiz, question, student, and analytics management.

## Prerequisites

- Node.js 22 or later and npm.
- A Supabase project with its URL, anon key, and service-role key.
- Docker Engine and the Docker Compose plugin for container deployment.

## Configure Supabase

1. Create a Supabase project and copy its project URL, anon key, and service-role key.
2. Apply every SQL migration in `supabase/migrations/`, in filename order, using the Supabase SQL editor or the Supabase CLI. The migrations create the app schema, quiz metadata, RLS policies, and the public `question-images` bucket. The bucket allows public image reads and restricts uploads, updates, and deletes to active admins.
3. In the Supabase Auth settings, configure the allowed site URL and redirect URLs for your local and deployed app origins.
4. Create `.env.local` and set the required values:

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL; included in the browser bundle. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase public anon key; included in the browser bundle. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only key for protected reads, scoring, and health checks. Never expose it to the browser. |
| `SEED_ADMIN_EMAIL` | Only for seeding | Email address for the optional sample administrator. |
| `SEED_ADMIN_PASSWORD` | Only for seeding | Strong password for the optional sample administrator. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | For Google sign-in | Google OAuth Web client ID; included in the browser bundle. |
| `ADMIN_EMAILS` | Optional | Comma-separated email addresses promoted to admins at sign-in. |

Do not commit real environment files or expose the service-role key through a `NEXT_PUBLIC_` variable.

Example variable names and safe placeholders:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
ADMIN_EMAILS=admin@example.com
```

## Google sign-in

1. In the [Google Cloud Console](https://console.cloud.google.com/), create an OAuth client with application type **Web application**.
2. Add `http://localhost:3000` and your deployed app origin (for example, `https://your-app.vercel.app`) as **Authorized JavaScript origins**.
3. In Supabase, open **Authentication → Sign In / Providers → Google**, enable Google, and enter the OAuth client ID and client secret. Copy the Web client ID into `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `.env.local`.
4. In the Google OAuth client, add the Supabase callback URL shown in the Google provider settings (typically `https://<project-ref>.supabase.co/auth/v1/callback`) as an **Authorized redirect URI**. In Supabase URL configuration, allow `http://localhost:3000/**` and the deployed origin's callback paths, and set the deployed origin as the production Site URL.
5. Set `ADMIN_EMAILS` to a comma-separated list of trusted, verified email addresses, such as `you@example.com,another-admin@example.com`. Those accounts receive the `admin` profile role when they sign in; other new accounts remain students. Existing manually assigned admins are not demoted.
6. Apply `supabase/migrations/0006_google_auth_profiles.sql` after the earlier migrations. Configure `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `ADMIN_EMAILS`, and the existing Supabase variables in the Vercel project's environment settings for the relevant environments, then redeploy so the client ID is included in the frontend bundle.

The app uses Supabase Auth's signed cookie session, with `SameSite=Lax` and `Secure` enabled in production. Supabase's browser client needs access to its session cookies, but session tokens are not stored in localStorage. The same-origin `/api/auth/google`, `/api/auth/me`, and `/api/auth/logout` handlers rely on Supabase Auth for ID-token validation and cookie/session lifecycle. Admin page and API guards read the active profile role from the database on each request.

Manual smoke test after configuring Google and applying migrations:

1. Sign in with Google and verify the header shows your name/avatar.
2. Refresh and verify the account menu remains signed in.
3. Sign out and verify protected result pages return to sign-in.
4. Open `/admin` with a non-admin account and verify the friendly “Admins only” page.
5. Finish a quiz as a guest, verify the score and “Sign in to save your results” prompt, then sign in and verify the saved result appears in My results.

## Run locally

```powershell
npm ci
npm run dev
```

Open `http://localhost:3000`. Run the production checks with:

```powershell
npm test
npm run lint
npm run build
npm start
```

The production start script prepares the static assets required by Next.js standalone output before launching the server.

`GET /api/health` returns `200` only when the server can connect to the Supabase database; otherwise it returns `503`.

## Create an administrator and sample data

Email/password sign-up creates a student profile. To promote a trusted account, first register it, then run this in the Supabase SQL editor:

```sql
update public.profiles
set role = 'admin'
where email = 'you@example.com';
```

Alternatively, set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in your local environment and run `npm run seed`. The seed script creates or updates a sample administrator, five published quizzes across different categories, and 25 questions. Use a unique, strong password and do not use the sample account in production.

## Import quizzes

Apply the quiz metadata and question-type migrations (`0004_quiz_metadata.sql` and `0005_multi_select_questions.sql`) before importing. Sign in with an active admin account and open **Admin → Quizzes → Upload quizzes**. CSV, XLSX, and JSON files up to 5 MB are accepted. Uploading only validates and previews the file; the Import as draft action saves valid rows as unpublished quizzes.

The CSV columns are `quiz_title,category,difficulty,question,type,option_a,option_b,option_c,option_d,correct,explanation`. Difficulty is Easy, Medium, or Hard. Question type is MCQ, TRUE_FALSE, or MULTI_SELECT. Leave TRUE_FALSE option columns empty and use True or False as the correct answer. For MULTI_SELECT, separate correct option texts with `|`. Rows with the same quiz title are grouped into a single draft quiz; category and difficulty must be consistent within a quiz. Invalid rows must be fixed by uploading a corrected file or explicitly skipped before import.

Download [the 10-question sample CSV](./public/sample-quizzes.csv) or use the authenticated template download in the upload page.

## Deploy with Docker Compose

Copy `.env.example` to `.env`, set the three Supabase values, then build and start the production container:

```powershell
docker compose up --build -d
docker compose ps
```

The app listens on port 3000. The Compose health check verifies both the web service and its database connection. Public Supabase URL and anon-key values are passed as build arguments because Next.js embeds `NEXT_PUBLIC_` values into browser assets at build time. The service-role key is passed only at runtime to the server container. Rebuild after changing either public value:

```powershell
docker compose down
docker compose up --build -d
```

For a hosted Node.js or Vercel deployment, use Node.js 22 or later, run `npm ci`, `npm run build`, then `npm start` (or let Vercel build the project). Configure all three required Supabase variables in the hosting provider. Apply the migrations before directing traffic to the deployment.

## Application and data safeguards

- Row-level security scopes student profiles, attempts, and answers to the signed-in user; admin access is role- and active-account-checked.
- The quiz API omits correct answers; the server computes and persists scores on submission.
- Supabase service-role credentials are used only by server-side code.
- Quiz images are public media; database writes to the bucket are limited to active admins.
