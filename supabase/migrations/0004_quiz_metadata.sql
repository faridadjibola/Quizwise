alter table public.quizzes
  add column difficulty public.difficulty_level not null default 'medium',
  add column estimated_minutes integer not null default 15
    check (estimated_minutes between 1 and 600),
  add column status text,
  add column publish_at timestamptz;

update public.quizzes
set status = case when is_published then 'PUBLISHED' else 'DRAFT' end,
    publish_at = case
      when is_published then coalesce(publish_at, created_at)
      else publish_at
    end;

alter table public.quizzes
  alter column status set default 'DRAFT',
  alter column status set not null,
  add constraint quizzes_status_check
    check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED'));

create function public.sync_quiz_publish_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'PUBLISHED' or new.is_published then
      new.status := 'PUBLISHED';
      new.is_published := true;
    elsif new.status = 'ARCHIVED' then
      new.is_published := false;
    else
      new.status := 'DRAFT';
      new.is_published := false;
    end if;
  elsif new.status is distinct from old.status then
    new.is_published := new.status = 'PUBLISHED';
  elsif new.is_published is distinct from old.is_published then
    new.status := case when new.is_published then 'PUBLISHED' else 'DRAFT' end;
  end if;

  if new.status = 'PUBLISHED' and new.publish_at is null then
    new.publish_at := now();
  end if;

  return new;
end;
$$;

create trigger sync_quiz_publish_status
before insert or update of status, is_published, publish_at
on public.quizzes
for each row execute function public.sync_quiz_publish_status();

drop policy if exists "published quizzes readable" on public.quizzes;
create policy "published quizzes readable" on public.quizzes
  for select using (
    (
      is_published
      and status = 'PUBLISHED'
      and (publish_at is null or publish_at <= now())
    )
    or public.is_admin()
  );

drop policy if exists "quiz assignments readable" on public.quiz_questions;
create policy "quiz assignments readable" on public.quiz_questions
  for select using (
    exists (
      select 1
      from public.quizzes q
      where q.id = quiz_id
        and (
          (
            q.is_published
            and q.status = 'PUBLISHED'
            and (q.publish_at is null or q.publish_at <= now())
          )
          or public.is_admin()
        )
    )
  );

drop policy if exists "students start own attempts" on public.attempts;
create policy "students start own attempts" on public.attempts
  for insert with check (
    student_id = auth.uid()
    and exists (
      select 1
      from public.quizzes q
      where q.id = quiz_id
        and q.is_published
        and q.status = 'PUBLISHED'
        and (q.publish_at is null or q.publish_at <= now())
    )
  );
