-- ============================================================
-- Arkives — 028: Timelines (client-facing production schedules)
--
-- A timeline shows a brand what a project looks like from kickoff
-- to delivery: pre-production, production, post-production, each
-- step with a length in business days, an owner (you / brand /
-- both), and whether it goes on the brand's calendar. No pricing,
-- ever: quotes carry the money.
--
-- Dates are NOT stored per step. The row keeps the kickoff date and
-- each step's length; the app derives every date (business days,
-- weekends skipped), so moving the kickoff shifts the whole plan.
--
-- Step shape (timelines.steps):
--   { "id": text, "phase": "pre"|"prod"|"post", "name": text,
--     "detail": text, "days": int 1-60, "owner": "you"|"brand"|"both",
--     "cal": bool, "on": bool }
--   on = false skips the step: zero days, never shown to the brand.
--
-- Logos are small data: URLs (downscaled in the browser, validated
-- on render), so the public page needs no storage policy.
--
-- Status: draft -> shared. Only shared timelines are served by
-- get_shared_timeline(token); unsharing takes the link down.
--
-- Idempotent. Depends on 008 (current_profile_id), 001
-- (update_updated_at).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS timelines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '' CHECK (char_length(title) <= 200),
  client_name TEXT NOT NULL DEFAULT '' CHECK (char_length(client_name) <= 200),
  client_logo TEXT NOT NULL DEFAULT '' CHECK (char_length(client_logo) <= 300000),
  from_name TEXT NOT NULL DEFAULT '' CHECK (char_length(from_name) <= 200),
  from_logo TEXT NOT NULL DEFAULT '' CHECK (char_length(from_logo) <= 300000),
  kickoff_date DATE,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(steps) = 'array' AND jsonb_array_length(steps) <= 60),
  notes TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 2000),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'shared')),
  share_token UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
  viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timelines_user ON timelines(user_id);

DROP TRIGGER IF EXISTS set_updated_at ON timelines;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON timelines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE timelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE timelines ALTER COLUMN user_id SET DEFAULT public.current_profile_id();

DROP POLICY IF EXISTS "timelines_select_own" ON timelines;
DROP POLICY IF EXISTS "timelines_insert_own" ON timelines;
DROP POLICY IF EXISTS "timelines_update_own" ON timelines;
DROP POLICY IF EXISTS "timelines_delete_own" ON timelines;

CREATE POLICY "timelines_select_own" ON timelines FOR SELECT TO authenticated
  USING (user_id = public.current_profile_id());
CREATE POLICY "timelines_insert_own" ON timelines FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "timelines_update_own" ON timelines FOR UPDATE TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "timelines_delete_own" ON timelines FOR DELETE TO authenticated
  USING (user_id = public.current_profile_id());

-- ============================================================
-- PUBLIC READ (token-gated, callable logged out)
-- SECURITY DEFINER bypasses RLS; the WHERE clause is the gate.
-- Skipped steps are dropped here, so the brand never receives them.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_shared_timeline(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t timelines%ROWTYPE;
  v_viewer UUID;
BEGIN
  SELECT * INTO t FROM timelines WHERE share_token = p_token AND status = 'shared';
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT id INTO v_viewer FROM profiles WHERE auth_user_id = auth.uid();
  IF t.viewed_at IS NULL AND v_viewer IS DISTINCT FROM t.user_id THEN
    UPDATE timelines SET viewed_at = now() WHERE id = t.id;
  END IF;

  RETURN jsonb_build_object(
    'title', t.title, 'client_name', t.client_name, 'client_logo', t.client_logo,
    'from_name', t.from_name, 'from_logo', t.from_logo,
    'kickoff_date', t.kickoff_date, 'notes', t.notes, 'status', t.status,
    'steps', coalesce((SELECT jsonb_agg(s) FROM jsonb_array_elements(t.steps) s
                       WHERE coalesce((s->>'on')::boolean, true)), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_timeline(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.get_shared_timeline(UUID) TO anon, authenticated;

COMMIT;

-- Verify afterwards:
--   SELECT count(*) FROM timelines;
--   SELECT public.get_shared_timeline(uuid_generate_v4());  -- NULL
