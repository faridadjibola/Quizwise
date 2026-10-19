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
4. Copy `.env.example` to `.env.local` and set the required values:

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL; included in the browser bundle. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase public anon key; included in the browser bundle. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only key for protected reads, scoring, and health checks. Never expose it to the browser. |
| `SEED_ADMIN_EMAIL` | Only for seeding | Email address for the optional sample administrator. |
| `SEED_ADMIN_PASSWORD` | Only for seeding | Strong password for the optional sample administrator. |

Do not commit real environment files or expose the service-role key through a `NEXT_PUBLIC_` variable.

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
