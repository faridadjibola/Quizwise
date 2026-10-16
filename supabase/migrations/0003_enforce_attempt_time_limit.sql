drop policy "students save own answers" on public.attempt_answers;
drop policy "students update own answers" on public.attempt_answers;

create policy "students save own answers before deadline"
on public.attempt_answers for insert
to authenticated
with check (
  exists (
    select 1
    from public.attempts a
    join public.quizzes q on q.id = a.quiz_id
    where a.id = attempt_id
      and a.student_id = auth.uid()
      and a.status = 'in_progress'
      and now() < a.started_at + make_interval(mins => q.time_limit_minutes)
  )
);

create policy "students update own answers before deadline"
on public.attempt_answers for update
to authenticated
using (
  exists (
    select 1
    from public.attempts a
    join public.quizzes q on q.id = a.quiz_id
    where a.id = attempt_id
      and a.student_id = auth.uid()
      and a.status = 'in_progress'
      and now() < a.started_at + make_interval(mins => q.time_limit_minutes)
  )
)
with check (
  exists (
    select 1
    from public.attempts a
    join public.quizzes q on q.id = a.quiz_id
    where a.id = attempt_id
      and a.student_id = auth.uid()
      and a.status = 'in_progress'
      and now() < a.started_at + make_interval(mins => q.time_limit_minutes)
  )
);
