insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', true)
on conflict (id) do update set public = excluded.public;

create policy "Admins upload question images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'question-images' and public.is_admin());

create policy "Admins update question images"
on storage.objects for update
to authenticated
using (bucket_id = 'question-images' and public.is_admin())
with check (bucket_id = 'question-images' and public.is_admin());

create policy "Admins delete question images"
on storage.objects for delete
to authenticated
using (bucket_id = 'question-images' and public.is_admin());
