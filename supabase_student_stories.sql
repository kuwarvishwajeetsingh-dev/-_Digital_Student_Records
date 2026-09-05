
create table if not exists public.student_stories (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  story text not null check (char_length(trim(story)) between 1 and 800),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If an earlier run created this column as bigint, migrate the empty column to UUID.
alter table public.student_stories
alter column student_id type uuid
using student_id::text::uuid;

alter table public.student_stories enable row level security;

drop policy if exists "Anyone can read student stories" on public.student_stories;
drop policy if exists "Owners can create their student story" on public.student_stories;
drop policy if exists "Owners can update their student story" on public.student_stories;
drop policy if exists "Owners can delete their student story" on public.student_stories;

create policy "Anyone can read student stories"
on public.student_stories for select
using (true);

create policy "Owners can create their student story"
on public.student_stories for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.student
    where student.id = student_id
      and student.user_id = auth.uid()
  )
);

create policy "Owners can update their student story"
on public.student_stories for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Owners can delete their student story"
on public.student_stories for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists student_stories_student_id_idx
on public.student_stories(student_id);

create or replace function public.set_student_story_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists student_stories_updated_at on public.student_stories;
create trigger student_stories_updated_at
before update on public.student_stories
for each row execute function public.set_student_story_updated_at();
