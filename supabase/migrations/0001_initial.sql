-- Quiz Management System schema
create extension if not exists pgcrypto;
create type public.app_role as enum ('admin','student');
create type public.question_type as enum ('multiple_choice','true_false');
create type public.difficulty_level as enum ('easy','medium','hard');

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null unique,
 full_name text not null default '',
 role public.app_role not null default 'student',
 is_active boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.quizzes (
 id uuid primary key default gen_random_uuid(), title text not null, description text not null default '',
 category text not null default 'General', time_limit_minutes int not null check(time_limit_minutes between 1 and 600),
 pass_mark numeric(5,2) not null default 60 check(pass_mark between 0 and 100),
 shuffle_questions boolean not null default false, shuffle_options boolean not null default false,
 attempts_allowed int not null default 1 check(attempts_allowed between 1 and 100),
 is_published boolean not null default false, created_by uuid references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.questions (
 id uuid primary key default gen_random_uuid(), text text not null,
 image_path text, type public.question_type not null default 'multiple_choice',
 options jsonb not null check(jsonb_typeof(options)='array' and jsonb_array_length(options) between 2 and 6),
 correct_answer text not null, explanation text not null default '',
 difficulty public.difficulty_level not null default 'medium', category text not null default 'General',
 created_by uuid references public.profiles(id), created_at timestamptz not null default now()
);
create table public.quiz_questions (
 quiz_id uuid not null references public.quizzes(id) on delete cascade,
 question_id uuid not null references public.questions(id) on delete cascade,
 position int not null default 0, points numeric(6,2) not null default 1 check(points>0),
 primary key(quiz_id,question_id), unique(quiz_id,position)
);
create table public.attempts (
 id uuid primary key default gen_random_uuid(), quiz_id uuid not null references public.quizzes(id),
 student_id uuid not null references public.profiles(id), started_at timestamptz not null default now(),
 submitted_at timestamptz, score numeric(6,2), total_points numeric(6,2), passed boolean,
 status text not null default 'in_progress' check(status in ('in_progress','submitted','timed_out')),
 unique(id,student_id)
);
create table public.attempt_answers (
 attempt_id uuid not null references public.attempts(id) on delete cascade,
 question_id uuid not null references public.questions(id), answer text,
 is_correct boolean, flagged boolean not null default false, answered_at timestamptz,
 primary key(attempt_id,question_id)
);
create index attempts_student_idx on public.attempts(student_id,started_at desc);
create index attempts_quiz_idx on public.attempts(quiz_id,started_at desc);

create function public.is_admin() returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active) $$;
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public
as $$ begin insert into public.profiles(id,email,full_name) values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name','')); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_answers enable row level security;
create policy "profile self or admin read" on public.profiles for select using(id=auth.uid() or public.is_admin());
create policy "admin manages profiles" on public.profiles for all using(public.is_admin()) with check(public.is_admin());
create policy "published quizzes readable" on public.quizzes for select using(is_published or public.is_admin());
create policy "admin manages quizzes" on public.quizzes for all using(public.is_admin()) with check(public.is_admin());
create policy "questions admin only" on public.questions for all using(public.is_admin()) with check(public.is_admin());
create policy "quiz assignments readable" on public.quiz_questions for select using(exists(select 1 from public.quizzes q where q.id=quiz_id and (q.is_published or public.is_admin())));
create policy "admin manages quiz assignments" on public.quiz_questions for all using(public.is_admin()) with check(public.is_admin());
create policy "attempts own or admin" on public.attempts for select using(student_id=auth.uid() or public.is_admin());
create policy "students start own attempts" on public.attempts for insert with check(student_id=auth.uid() and exists(select 1 from public.quizzes q where q.id=quiz_id and q.is_published));
create policy "attempt answers own or admin" on public.attempt_answers for select using(exists(select 1 from public.attempts a where a.id=attempt_id and (a.student_id=auth.uid() or public.is_admin())));
create policy "students save own answers" on public.attempt_answers for insert with check(exists(select 1 from public.attempts a where a.id=attempt_id and a.student_id=auth.uid() and a.status='in_progress'));
create policy "students update own answers" on public.attempt_answers for update using(exists(select 1 from public.attempts a where a.id=attempt_id and a.student_id=auth.uid() and a.status='in_progress')) with check(exists(select 1 from public.attempts a where a.id=attempt_id and a.student_id=auth.uid() and a.status='in_progress'));

-- Never expose the answer key in browser queries. Use the server service role for scoring.
