limits the student-photos bucket to 50 KB.

alter table public.student
add column if not exists photo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-photos',
  'student-photos',
  true,
  51200,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set public = true,
    file_size_limit = 51200,
    allowed_mime_types = excluded.allowed_mime_types;

-- Public profile photos can be displayed by directory readers.
drop policy if exists "Anyone can read student photos" on storage.objects;
create policy "Anyone can read student photos"
on storage.objects for select
using (bucket_id = 'student-photos');

-- Each signed-in student can only upload inside their own user-id folder.
drop policy if exists "Students can upload their own photos" on storage.objects;
create policy "Students can upload their own photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'student-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Students can update their own photos" on storage.objects;
create policy "Students can update their own photos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'student-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'student-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Students can delete their own photos" on storage.objects;
create policy "Students can delete their own photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'student-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
