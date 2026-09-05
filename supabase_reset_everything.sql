-- WARNING: IRREVERSIBLE FULL RESET.
-- This deletes every student profile, chapter, and authentication account.
-- After running this, create fresh accounts through the app's Sign Up form.

begin;

-- Remove app records first.
delete from public.student_stories;
delete from public.student;

-- Remove every Supabase Auth account, including the current admin.
delete from auth.users;

commit;

-- Storage photos cannot be deleted directly with SQL.
-- Empty the student-photos bucket separately from Supabase Dashboard > Storage.
