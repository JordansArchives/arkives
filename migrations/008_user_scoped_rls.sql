-- ============================================================
-- Arkives — 008: User-scoped RLS (the multi-tenancy migration)
--
-- Replaces the temporary anon allow-all policies (002) with
-- authenticated, per-user policies on every table. After this
-- runs, the public anon key can no longer read or write ANY row;
-- only logged-in users can, and only their own rows.
--
-- RUN ORDER: 007 first, then this file.
--
-- SAFE-DEPLOY NOTES:
-- * The currently deployed app keeps working: it signs users in
--   (authenticated role) and Jordan's rows get backfilled below.
-- * Jordan's profile MUST be linked (auth_user_id set) before this
--   runs. It is, if he has logged in since 005 was applied.
-- * The backfill assumes a SINGLE existing profile (Jordan). Do not
--   run it after other users have signed up. Run this BEFORE opening
--   signups.
-- * Script share links (#shared/token) will 404 for logged-out
--   visitors after this. That feature is being reworked in P1.4 via
--   a SECURITY DEFINER RPC (get_shared_script). Known + accepted.
-- ============================================================

-- ============================================================
-- 1. PROFILES: ensure the auth link column is enforceable
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auth_user_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_auth_user ON profiles(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Drop the legacy 001 signup trigger: it inserted profiles with
-- id = auth.users.id, which conflicts with the auth_user_id link
-- model the app actually uses. The app creates profiles on first
-- login instead.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ============================================================
-- 2. HELPER: current user's profile id
-- SECURITY DEFINER so policies can resolve it without recursing
-- into profiles' own RLS.
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE auth_user_id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.current_profile_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated;

-- ============================================================
-- 3. BACKFILL: stamp Jordan's profile id onto any rows missing
-- user_id. Guarded: aborts if more than one profile exists.
-- ============================================================
DO $$
DECLARE
  profile_count INTEGER;
  owner_id UUID;
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'platforms', 'rate_cards', 'rate_card_settings', 'analytics_snapshots',
    'deals', 'follow_ups', 'action_items', 'latest_updates',
    'content_deadlines', 'invoices', 'expenses', 'subscriptions',
    'net_income', 'labor', 'campaign_results', 'outreach_templates',
    'calendar_events', 'inbox_items', 'brand_rules', 'contract_rules',
    'monthly_revenue', 'audience_data', 'user_settings',
    'weekly_plans', 'weekly_tasks', 'parking_lot', 'scripts', 'script_scenes'
  ];
BEGIN
  SELECT COUNT(*) INTO profile_count FROM profiles;
  IF profile_count > 1 THEN
    RAISE EXCEPTION 'Backfill aborted: % profiles exist. This backfill is only safe with a single (owner) profile.', profile_count;
  END IF;

  SELECT id INTO owner_id FROM profiles LIMIT 1;
  IF owner_id IS NULL THEN
    RAISE NOTICE 'No profile found; skipping backfill.';
    RETURN;
  END IF;

  FOREACH tbl IN ARRAY tables LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN
      RAISE NOTICE 'Backfill: skipping missing table %', tbl;
      CONTINUE;
    END IF;
    EXECUTE format('UPDATE %I SET user_id = %L WHERE user_id IS NULL', tbl, owner_id);
  END LOOP;
END $$;

-- ============================================================
-- 4. DROP ALL EXISTING POLICIES (002 anon policies + any
-- dashboard-created drift), then enable RLS everywhere.
-- ============================================================
DO $$
DECLARE
  pol RECORD;
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'profiles', 'platforms', 'rate_cards', 'rate_card_settings', 'analytics_snapshots',
    'deals', 'deal_history', 'follow_ups', 'action_items', 'latest_updates',
    'content_deadlines', 'invoices', 'expenses', 'subscriptions',
    'net_income', 'labor', 'campaign_results', 'outreach_templates',
    'calendar_events', 'inbox_items', 'brand_rules', 'contract_rules',
    'monthly_revenue', 'audience_data', 'user_settings',
    'weekly_plans', 'weekly_tasks', 'parking_lot', 'scripts', 'script_scenes'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN
      RAISE NOTICE 'RLS enable: skipping missing table %', tbl;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    FOR pol IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY %I ON %I', pol.policyname, tbl);
    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- 5. PROFILES POLICIES (keyed on auth_user_id directly)
-- No DELETE policy: account deletion is a support action for now.
-- ============================================================
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());

-- ============================================================
-- 6. USER-SCOPED POLICIES for every table with user_id,
-- plus a DEFAULT so inserts that omit user_id are auto-stamped
-- (several app call sites omit it; the default closes that gap).
-- ============================================================
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'platforms', 'rate_cards', 'rate_card_settings', 'analytics_snapshots',
    'deals', 'follow_ups', 'action_items', 'latest_updates',
    'content_deadlines', 'invoices', 'expenses', 'subscriptions',
    'net_income', 'labor', 'campaign_results', 'outreach_templates',
    'calendar_events', 'inbox_items', 'brand_rules', 'contract_rules',
    'monthly_revenue', 'audience_data', 'user_settings',
    'weekly_plans', 'weekly_tasks', 'parking_lot', 'scripts', 'script_scenes'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN
      RAISE NOTICE 'Policies: skipping missing table %', tbl;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE %I ALTER COLUMN user_id SET DEFAULT public.current_profile_id()', tbl);
    EXECUTE format('CREATE POLICY "%s_select_own" ON %I FOR SELECT TO authenticated USING (user_id = public.current_profile_id())', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_insert_own" ON %I FOR INSERT TO authenticated WITH CHECK (user_id = public.current_profile_id())', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_update_own" ON %I FOR UPDATE TO authenticated USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id())', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_delete_own" ON %I FOR DELETE TO authenticated USING (user_id = public.current_profile_id())', tbl, tbl);
  END LOOP;
END $$;

-- ============================================================
-- 7. DEAL_HISTORY (no user_id column): scope through parent deal
-- ============================================================
DO $$
BEGIN
  IF to_regclass('public.deal_history') IS NULL OR to_regclass('public.deals') IS NULL THEN
    RAISE NOTICE 'Skipping deal_history policies: table missing';
    RETURN;
  END IF;
  EXECUTE 'CREATE POLICY "deal_history_select_own" ON deal_history FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM deals d WHERE d.id = deal_history.deal_id AND d.user_id = public.current_profile_id()))';
  EXECUTE 'CREATE POLICY "deal_history_insert_own" ON deal_history FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM deals d WHERE d.id = deal_history.deal_id AND d.user_id = public.current_profile_id()))';
  EXECUTE 'CREATE POLICY "deal_history_update_own" ON deal_history FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM deals d WHERE d.id = deal_history.deal_id AND d.user_id = public.current_profile_id()))';
  EXECUTE 'CREATE POLICY "deal_history_delete_own" ON deal_history FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM deals d WHERE d.id = deal_history.deal_id AND d.user_id = public.current_profile_id()))';
END $$;

-- ============================================================
-- 8. VERIFY (run these after; expect: 30 tables with RLS on,
-- 0 anon policies, every policy TO authenticated)
-- ============================================================
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
-- SELECT tablename, policyname, roles FROM pg_policies WHERE schemaname='public' ORDER BY tablename;
-- SELECT COUNT(*) AS anon_policies FROM pg_policies WHERE schemaname='public' AND roles::text LIKE '%anon%';

-- NOTE (2026-07-13): this file was applied to the live DB under the
-- name 007_user_scoped_rls.sql, then renumbered to 008 when the
-- July-1 simplification cleanup claimed the 006 slot. Same content.
