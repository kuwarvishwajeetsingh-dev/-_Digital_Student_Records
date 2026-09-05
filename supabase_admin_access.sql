create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Admins can manage every student profile. Existing student policies remain active
-- for normal users, so this adds access without removing owner-only protection.
alter table public.student enable row level security;
drop policy if exists "Admins can manage all student profiles" on public.student;
create policy "Admins can manage all student profiles"
on public.student for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Admins can manage every chapter while normal users keep owner-only access.
alter table public.student_stories enable row level security;
drop policy if exists "Admins can manage all student stories" on public.student_stories;
create policy "Admins can manage all student stories"
on public.student_stories for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Admins can manage any uploaded student photo.
drop policy if exists "Admins can manage all student photos" on storage.objects;
create policy "Admins can manage all student photos"
on storage.objects for all
to authenticated
using (bucket_id = 'student-photos' and public.is_admin())
with check (bucket_id = 'student-photos' and public.is_admin());
