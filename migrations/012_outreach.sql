-- ============================================================
-- Arkives — 012: Outreach (Analytics → Outreach tab)
--
-- A prospecting book for brands / companies / platforms /
-- opportunities Jordan wants to work with, plus user-created
-- lists (e.g. "Dream 100") a target can belong to several of.
--
-- Two new tables (outreach_lists, outreach_targets) — after
-- 009 + 010 + 011 + 012 the schema is 21 working tables plus
-- profiles.
--
-- Depends on 008 (public.current_profile_id) and 001
-- (update_updated_at trigger function), both applied live.
-- Safe to run any time after 008.
--
-- Design notes:
-- * List membership is a UUID[] column (list_ids) on the
--   target, not a join table. Membership is never queried
--   relationally — the app loads a user's whole book at once —
--   and an array keeps the vanilla-JS client simple (same
--   reasoning as invoices.line_items JSONB in 011). Deleting a
--   list sweeps the array client-side; a stale id left behind
--   is harmless because the app only resolves ids against
--   loaded lists.
-- * Past/current work lives in a projects JSONB array on the
--   target. Shape per item:
--     { "name": text, "budget": number|null,
--       "rate": number|null, "notes": text }
--   budget = what they had, rate = what was agreed.
-- * status is one pipeline stage (single source of truth);
--   initiated_by records direction separately (us / them).
-- ============================================================

BEGIN;

-- ============================================================
-- 1. OUTREACH LISTS (user-named groupings, e.g. "Dream 100")
-- ============================================================
CREATE TABLE IF NOT EXISTS outreach_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_lists_user ON outreach_lists(user_id);

DROP TRIGGER IF EXISTS set_updated_at ON outreach_lists;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON outreach_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE outreach_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_lists ALTER COLUMN user_id SET DEFAULT public.current_profile_id();

DROP POLICY IF EXISTS "outreach_lists_select_own" ON outreach_lists;
DROP POLICY IF EXISTS "outreach_lists_insert_own" ON outreach_lists;
DROP POLICY IF EXISTS "outreach_lists_update_own" ON outreach_lists;
DROP POLICY IF EXISTS "outreach_lists_delete_own" ON outreach_lists;

CREATE POLICY "outreach_lists_select_own" ON outreach_lists FOR SELECT TO authenticated
  USING (user_id = public.current_profile_id());
CREATE POLICY "outreach_lists_insert_own" ON outreach_lists FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "outreach_lists_update_own" ON outreach_lists FOR UPDATE TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "outreach_lists_delete_own" ON outreach_lists FOR DELETE TO authenticated
  USING (user_id = public.current_profile_id());

-- ============================================================
-- 2. OUTREACH TARGETS (the prospecting book itself)
-- ============================================================
CREATE TABLE IF NOT EXISTS outreach_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  type TEXT NOT NULL DEFAULT 'brand'
    CHECK (type IN ('brand', 'company', 'platform', 'opportunity')),
  website TEXT NOT NULL DEFAULT '' CHECK (char_length(website) <= 500),
  pitch TEXT NOT NULL DEFAULT '' CHECK (char_length(pitch) <= 2000),
  status TEXT NOT NULL DEFAULT 'not_contacted'
    CHECK (status IN ('not_contacted', 'contacted', 'in_talks', 'worked_together', 'passed')),
  initiated_by TEXT NOT NULL DEFAULT 'none'
    CHECK (initiated_by IN ('none', 'us', 'them')),
  projects JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 5000),
  list_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_targets_user ON outreach_targets(user_id);

DROP TRIGGER IF EXISTS set_updated_at ON outreach_targets;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON outreach_targets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE outreach_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_targets ALTER COLUMN user_id SET DEFAULT public.current_profile_id();

DROP POLICY IF EXISTS "outreach_targets_select_own" ON outreach_targets;
DROP POLICY IF EXISTS "outreach_targets_insert_own" ON outreach_targets;
DROP POLICY IF EXISTS "outreach_targets_update_own" ON outreach_targets;
DROP POLICY IF EXISTS "outreach_targets_delete_own" ON outreach_targets;

CREATE POLICY "outreach_targets_select_own" ON outreach_targets FOR SELECT TO authenticated
  USING (user_id = public.current_profile_id());
CREATE POLICY "outreach_targets_insert_own" ON outreach_targets FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "outreach_targets_update_own" ON outreach_targets FOR UPDATE TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "outreach_targets_delete_own" ON outreach_targets FOR DELETE TO authenticated
  USING (user_id = public.current_profile_id());

COMMIT;

-- Verify afterwards:
-- SELECT * FROM pg_policies WHERE tablename IN ('outreach_lists', 'outreach_targets');
