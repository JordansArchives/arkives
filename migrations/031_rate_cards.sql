-- ============================================================
-- Arkives — 031: Rate cards (brand and freelance presets)
--
-- One table, three kinds of saved preset. The Rate Cards view
-- builds PDFs from them; nothing here is ever served publicly.
--
--   kind = 'brand'  A full brand-facing card: metrics toggles,
--                   deliverables, usage add-ons, packages, terms.
--   kind = 'role'   One freelance role block (editor, director,
--                   director + editor, motion, or custom): its
--                   rate lines. Several roles combine into one
--                   freelance PDF at export.
--   kind = 'terms'  The freelance terms and profile that close a
--                   freelance PDF (working day, overtime, deposit,
--                   cancellation, reel link, software...).
--
-- `name` is the INTERNAL label ("Brand: AI tools"). It never
-- prints. Every printed heading lives inside `content`.
--
-- Line item shape (inside content):
--   { "name": text, "detail": text, "price": number|null,
--     "unit": "none"|"post"|"each"|"day"|"hour"|"second"|"30d"|"pct"|"pct30d",
--     "display": "fixed"|"from"|"request" }
--
-- Idempotent. Depends on 008 (current_profile_id) and 001
-- (update_updated_at). Nothing seeded: the app fills new presets
-- from its templates with blank prices.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS rate_card_presets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('brand','role','terms')),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  role TEXT CHECK (role IS NULL OR role IN ('editor','director','director_editor','motion','custom')),
  content JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(content) = 'object' AND pg_column_size(content) <= 200000),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_card_presets_user ON rate_card_presets(user_id, kind);

DROP TRIGGER IF EXISTS set_updated_at ON rate_card_presets;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON rate_card_presets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE rate_card_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_card_presets ALTER COLUMN user_id SET DEFAULT public.current_profile_id();

DROP POLICY IF EXISTS "rate_card_presets_select_own" ON rate_card_presets;
DROP POLICY IF EXISTS "rate_card_presets_insert_own" ON rate_card_presets;
DROP POLICY IF EXISTS "rate_card_presets_update_own" ON rate_card_presets;
DROP POLICY IF EXISTS "rate_card_presets_delete_own" ON rate_card_presets;

CREATE POLICY "rate_card_presets_select_own" ON rate_card_presets FOR SELECT TO authenticated
  USING (user_id = public.current_profile_id());
CREATE POLICY "rate_card_presets_insert_own" ON rate_card_presets FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "rate_card_presets_update_own" ON rate_card_presets FOR UPDATE TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "rate_card_presets_delete_own" ON rate_card_presets FOR DELETE TO authenticated
  USING (user_id = public.current_profile_id());

COMMIT;

-- Verify:
-- SELECT * FROM pg_policies WHERE tablename = 'rate_card_presets';
-- SELECT kind, name, role FROM rate_card_presets ORDER BY kind, sort_order;
