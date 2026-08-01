-- ============================================================
-- Arkives — 013: Clean slate for new users
--
-- Part of removing every hardcoded Jordan's-Archives value from
-- the product so a fresh signup sees only their own data.
--
-- 1. social_stats: per-user home for the Social Blade payload
--    that previously shipped as a public static file
--    (public/analytics_cache.json — removed from the deploy in
--    the same release). One row per user, whole payload as
--    JSONB: { platforms, snapshots, last_fetch }. The frontend
--    reads it whole; no relational queries.
-- 2. profiles: media-kit copy that was hardcoded in app.js
--    (brand-alignment checklist, kit contact email) becomes
--    per-user profile fields. The niche tagline reuses the
--    existing profiles.niche column.
--
-- Run 014_seed_jordan_media_analytics.sql afterwards to move
-- Jordan's existing data into these fields (owner install only;
-- it is a no-op on any other install).
--
-- Depends on 008 (public.current_profile_id + profiles RLS) and
-- 001 (update_updated_at trigger function).
-- ============================================================

BEGIN;

-- ============================================================
-- 1. SOCIAL STATS (one row per user)
-- ============================================================
CREATE TABLE IF NOT EXISTS social_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_stats_user ON social_stats(user_id);

DROP TRIGGER IF EXISTS set_updated_at ON social_stats;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON social_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE social_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_stats ALTER COLUMN user_id SET DEFAULT public.current_profile_id();

DROP POLICY IF EXISTS "social_stats_select_own" ON social_stats;
DROP POLICY IF EXISTS "social_stats_insert_own" ON social_stats;
DROP POLICY IF EXISTS "social_stats_update_own" ON social_stats;
DROP POLICY IF EXISTS "social_stats_delete_own" ON social_stats;

CREATE POLICY "social_stats_select_own" ON social_stats FOR SELECT TO authenticated
  USING (user_id = public.current_profile_id());
CREATE POLICY "social_stats_insert_own" ON social_stats FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "social_stats_update_own" ON social_stats FOR UPDATE TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "social_stats_delete_own" ON social_stats FOR DELETE TO authenticated
  USING (user_id = public.current_profile_id());

-- ============================================================
-- 2. PROFILE MEDIA-KIT FIELDS
--    mk_align_yes / mk_align_no: JSONB arrays of strings shown
--    as the Brand Alignment checklist. mk_contact_email: the
--    outward-facing contact on the kit (may differ from the
--    login email). Covered by the existing profiles RLS (008).
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mk_align_yes JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mk_align_no JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mk_interests JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mk_contact_email TEXT NOT NULL DEFAULT ''
  CHECK (char_length(mk_contact_email) <= 200);

COMMIT;

-- Verify afterwards:
-- SELECT * FROM pg_policies WHERE tablename = 'social_stats';
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'profiles' AND column_name LIKE 'mk_%';
