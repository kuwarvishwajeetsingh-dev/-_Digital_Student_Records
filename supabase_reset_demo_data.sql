-- WARNING: This permanently clears demo data.
-- Run only when you want a fresh student directory.

begin;

-- Remove dependent story records first.
delete from public.student_stories;

-- Remove all student profile records.
delete from public.student;

-- Storage files cannot be deleted directly with SQL.
-- Empty the student-photos bucket from Supabase Storage instead.

commit;
