-- ============================================================
-- Arkives — 022: Ideas table for the Ideas tab
--
-- A quick-capture list: one line, optional notes, archive it
-- when it has been used or gone stale. One flat list per user.
-- No tags and no links to other tables: an idea is a note to
-- self, not a record. Archived rows stay findable under a
-- collapsed section; delete is explicit.
--
-- Depends on 008 (public.current_profile_id) and 001
-- (update_updated_at trigger function), both applied live.
--
-- RLS matches the 010 pattern: user_id defaults to
-- public.current_profile_id() and all four policies scope
-- rows to the owning profile.
--
-- Idempotent: run it twice and nothing changes. Safe to run
-- before or after the client that uses it deploys (the view
-- explains itself until the table exists).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS ideas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
  notes TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 5000),
  archived BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ideas_user ON ideas(user_id);

-- Same updated_at convention as every other table (001)
DROP TRIGGER IF EXISTS set_updated_at ON ideas;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ideas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;

ALTER TABLE ideas ALTER COLUMN user_id SET DEFAULT public.current_profile_id();

DROP POLICY IF EXISTS "ideas_select_own" ON ideas;
DROP POLICY IF EXISTS "ideas_insert_own" ON ideas;
DROP POLICY IF EXISTS "ideas_update_own" ON ideas;
DROP POLICY IF EXISTS "ideas_delete_own" ON ideas;

CREATE POLICY "ideas_select_own" ON ideas FOR SELECT TO authenticated
  USING (user_id = public.current_profile_id());
CREATE POLICY "ideas_insert_own" ON ideas FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "ideas_update_own" ON ideas FOR UPDATE TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "ideas_delete_own" ON ideas FOR DELETE TO authenticated
  USING (user_id = public.current_profile_id());

COMMIT;

-- Verify afterwards:
-- SELECT * FROM pg_policies WHERE tablename = 'ideas';
