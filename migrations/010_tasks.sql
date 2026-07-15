-- ============================================================
-- Arkives — 010: Tasks table for the Tasks tab
--
-- A simple Google-Tasks-style to-do list: title, optional
-- details, optional due date, star to pin, check off to
-- complete. One flat list per user, no task lists/subtasks.
--
-- NOTE: the old weekly_tasks / action_items tables are dead
-- (dropped in 006, re-dropped in 009). This is a fresh table,
-- not a revival. Safe to run before or after 009. After 009 and
-- 010 both run, the schema is 18 working tables plus profiles
-- (009's header says 17 — this table supersedes that count).
--
-- Depends on 008 (public.current_profile_id) and 001
-- (update_updated_at trigger function), both applied live.
--
-- RLS matches the 008 pattern: user_id defaults to
-- public.current_profile_id() and all four policies scope
-- rows to the owning profile.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
  details TEXT NOT NULL DEFAULT '' CHECK (char_length(details) <= 2000),
  due_date DATE CHECK (due_date IS NULL OR due_date BETWEEN '1900-01-01' AND '9999-12-31'),
  starred BOOLEAN NOT NULL DEFAULT false,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);

-- Same updated_at convention as every other table (001)
DROP TRIGGER IF EXISTS set_updated_at ON tasks;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

ALTER TABLE tasks ALTER COLUMN user_id SET DEFAULT public.current_profile_id();

DROP POLICY IF EXISTS "tasks_select_own" ON tasks;
DROP POLICY IF EXISTS "tasks_insert_own" ON tasks;
DROP POLICY IF EXISTS "tasks_update_own" ON tasks;
DROP POLICY IF EXISTS "tasks_delete_own" ON tasks;

CREATE POLICY "tasks_select_own" ON tasks FOR SELECT TO authenticated
  USING (user_id = public.current_profile_id());
CREATE POLICY "tasks_insert_own" ON tasks FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "tasks_update_own" ON tasks FOR UPDATE TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "tasks_delete_own" ON tasks FOR DELETE TO authenticated
  USING (user_id = public.current_profile_id());

COMMIT;

-- Verify afterwards:
-- SELECT * FROM pg_policies WHERE tablename = 'tasks';
