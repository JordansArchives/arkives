-- ============================================================
-- Arkives — 026: Quotes (client-facing project quotes)
--
-- A quote is a priced proposal for a freelance project (editing,
-- directing, in-house production). The owner builds it in the
-- Quotes view, sends the client a link (#q/{share_token}), and the
-- client accepts (typed name) or declines without logging in. An
-- accepted quote turns into a draft deposit invoice in one click.
--
-- Two tables:
--   quote_services — the saved service menu (name, unit, rate).
--                    Rate is NULLABLE: a service can sit on the
--                    menu before it has a price.
--   quotes         — the quote document. Like invoices, line items
--                    live in a JSONB column and the client details
--                    are a SNAPSHOT (editing a saved client never
--                    rewrites an issued quote). The "from" block is
--                    snapshotted too, so the public RPC never has to
--                    read profiles.
--
-- Line item shape (quotes.line_items):
--   { "desc": text, "detail": text,
--     "unit": "flat"|"day"|"hour"|"each", "qty": number, "rate": number }
--   amount = qty * rate (a flat item is qty 1).
--
-- Status: draft -> sent -> accepted | declined. "Viewed" and
-- "Expired" are derived (viewed_at, valid_until), not stored.
--
-- Public access: two SECURITY DEFINER RPCs gated on the token, the
-- same pattern as 017 (boards). Draft quotes are never served.
--   get_shared_quote(token)        read; stamps viewed_at on the
--                                  first visit by anyone but the owner
--   respond_to_quote(token, ...)   accept/decline once, while the
--                                  quote is sent and not expired
--
-- Seeds Jordan's starter service menu with blank rates (keyed by
-- login email like 014; a silent no-op on any other install).
--
-- Idempotent. Depends on 008 (current_profile_id), 011 (clients,
-- invoices builder columns), 001 (update_updated_at).
-- ============================================================

BEGIN;

-- ============================================================
-- 1. SERVICE MENU
-- ============================================================
CREATE TABLE IF NOT EXISTS quote_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  unit TEXT NOT NULL DEFAULT 'flat' CHECK (unit IN ('flat','day','hour','each')),
  rate NUMERIC(12,2) CHECK (rate IS NULL OR rate >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_services_user ON quote_services(user_id);

DROP TRIGGER IF EXISTS set_updated_at ON quote_services;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON quote_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE quote_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_services ALTER COLUMN user_id SET DEFAULT public.current_profile_id();

DROP POLICY IF EXISTS "quote_services_select_own" ON quote_services;
DROP POLICY IF EXISTS "quote_services_insert_own" ON quote_services;
DROP POLICY IF EXISTS "quote_services_update_own" ON quote_services;
DROP POLICY IF EXISTS "quote_services_delete_own" ON quote_services;

CREATE POLICY "quote_services_select_own" ON quote_services FOR SELECT TO authenticated
  USING (user_id = public.current_profile_id());
CREATE POLICY "quote_services_insert_own" ON quote_services FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "quote_services_update_own" ON quote_services FOR UPDATE TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "quote_services_delete_own" ON quote_services FOR DELETE TO authenticated
  USING (user_id = public.current_profile_id());

-- ============================================================
-- 2. QUOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  quote_number TEXT NOT NULL DEFAULT '' CHECK (char_length(quote_number) <= 40),
  title TEXT NOT NULL DEFAULT '' CHECK (char_length(title) <= 200),

  -- Client snapshot
  client_name TEXT NOT NULL DEFAULT '' CHECK (char_length(client_name) <= 200),
  client_company TEXT NOT NULL DEFAULT '' CHECK (char_length(client_company) <= 200),
  client_email TEXT NOT NULL DEFAULT '' CHECK (char_length(client_email) <= 200),
  client_address TEXT NOT NULL DEFAULT '' CHECK (char_length(client_address) <= 1000),

  -- From snapshot (the creator's entity as it read when saved)
  from_name TEXT NOT NULL DEFAULT '' CHECK (char_length(from_name) <= 200),
  from_email TEXT NOT NULL DEFAULT '' CHECK (char_length(from_email) <= 200),
  from_address TEXT NOT NULL DEFAULT '' CHECK (char_length(from_address) <= 1000),

  -- The document
  scope TEXT NOT NULL DEFAULT '' CHECK (char_length(scope) <= 10000),
  timeline TEXT NOT NULL DEFAULT '' CHECK (char_length(timeline) <= 1000),
  exclusions TEXT NOT NULL DEFAULT '' CHECK (char_length(exclusions) <= 5000),
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(line_items) = 'array' AND jsonb_array_length(line_items) <= 100),
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  deposit_pct INTEGER NOT NULL DEFAULT 50 CHECK (deposit_pct BETWEEN 0 AND 100),
  balance_terms TEXT NOT NULL DEFAULT 'delivery' CHECK (balance_terms IN ('delivery','NET15','NET30')),
  revision_rounds INTEGER NOT NULL DEFAULT 2 CHECK (revision_rounds BETWEEN 0 AND 20),
  usage_rights TEXT NOT NULL DEFAULT '' CHECK (char_length(usage_rights) <= 2000),
  notes TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 5000),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','declined')),
  share_token UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  accepted_name TEXT NOT NULL DEFAULT '' CHECK (char_length(accepted_name) <= 120),
  decline_reason TEXT NOT NULL DEFAULT '' CHECK (char_length(decline_reason) <= 1000),
  response_seen BOOLEAN NOT NULL DEFAULT true,  -- false = a client response the owner has not opened yet

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotes_user ON quotes(user_id);

DROP TRIGGER IF EXISTS set_updated_at ON quotes;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ALTER COLUMN user_id SET DEFAULT public.current_profile_id();

DROP POLICY IF EXISTS "quotes_select_own" ON quotes;
DROP POLICY IF EXISTS "quotes_insert_own" ON quotes;
DROP POLICY IF EXISTS "quotes_update_own" ON quotes;
DROP POLICY IF EXISTS "quotes_delete_own" ON quotes;

CREATE POLICY "quotes_select_own" ON quotes FOR SELECT TO authenticated
  USING (user_id = public.current_profile_id());
CREATE POLICY "quotes_insert_own" ON quotes FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "quotes_update_own" ON quotes FOR UPDATE TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "quotes_delete_own" ON quotes FOR DELETE TO authenticated
  USING (user_id = public.current_profile_id());

-- ============================================================
-- 3. PUBLIC RPCs (token-gated, callable logged out)
-- SECURITY DEFINER bypasses RLS; the WHERE clause is the gate.
-- Only the fields the client page renders come back: no user_id,
-- client_id, invoice_id, or response_seen.
-- ============================================================

-- A quote is expired the day after valid_until (one day of grace
-- covers the client's timezone being behind UTC).
CREATE OR REPLACE FUNCTION public._quote_expired(p_valid_until DATE)
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT p_valid_until IS NOT NULL AND p_valid_until + 1 < CURRENT_DATE
$$;

CREATE OR REPLACE FUNCTION public.get_shared_quote(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q quotes%ROWTYPE;
  v_viewer UUID;
BEGIN
  SELECT * INTO q FROM quotes WHERE share_token = p_token AND status <> 'draft';
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- First open by someone other than the owner marks the quote viewed
  SELECT id INTO v_viewer FROM profiles WHERE auth_user_id = auth.uid();
  IF q.viewed_at IS NULL AND v_viewer IS DISTINCT FROM q.user_id THEN
    UPDATE quotes SET viewed_at = now() WHERE id = q.id;
    q.viewed_at := now();
  END IF;

  RETURN jsonb_build_object(
    'quote_number', q.quote_number, 'title', q.title,
    'client_name', q.client_name, 'client_company', q.client_company,
    'client_email', q.client_email, 'client_address', q.client_address,
    'from_name', q.from_name, 'from_email', q.from_email, 'from_address', q.from_address,
    'scope', q.scope, 'timeline', q.timeline, 'exclusions', q.exclusions,
    'line_items', q.line_items, 'total', q.total,
    'deposit_pct', q.deposit_pct, 'balance_terms', q.balance_terms,
    'revision_rounds', q.revision_rounds, 'usage_rights', q.usage_rights,
    'notes', q.notes, 'issue_date', q.issue_date, 'valid_until', q.valid_until,
    'status', q.status, 'responded_at', q.responded_at,
    'accepted_name', q.accepted_name, 'expired', public._quote_expired(q.valid_until)
  );
END;
$$;

-- Accept (p_accept = true, typed full name required) or decline
-- (optional reason). One response per quote, only while it is sent
-- and not expired. Returns { ok, status } or { ok: false, error }.
CREATE OR REPLACE FUNCTION public.respond_to_quote(p_token UUID, p_accept BOOLEAN, p_name TEXT, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q quotes%ROWTYPE;
  v_name TEXT := btrim(coalesce(p_name, ''));
  v_reason TEXT := btrim(coalesce(p_reason, ''));
BEGIN
  SELECT * INTO q FROM quotes WHERE share_token = p_token AND status <> 'draft' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF q.status <> 'sent' THEN RETURN jsonb_build_object('ok', false, 'error', 'already_responded', 'status', q.status); END IF;
  IF public._quote_expired(q.valid_until) THEN RETURN jsonb_build_object('ok', false, 'error', 'expired'); END IF;

  IF p_accept THEN
    IF char_length(v_name) < 2 OR char_length(v_name) > 120 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'name_required');
    END IF;
    UPDATE quotes SET status = 'accepted', accepted_name = v_name, decline_reason = '',
      responded_at = now(), response_seen = false, viewed_at = coalesce(viewed_at, now())
    WHERE id = q.id;
    RETURN jsonb_build_object('ok', true, 'status', 'accepted');
  END IF;

  UPDATE quotes SET status = 'declined', accepted_name = left(v_name, 120), decline_reason = left(v_reason, 1000),
    responded_at = now(), response_seen = false, viewed_at = coalesce(viewed_at, now())
  WHERE id = q.id;
  RETURN jsonb_build_object('ok', true, 'status', 'declined');
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_quote(UUID) FROM public;
REVOKE ALL ON FUNCTION public.respond_to_quote(UUID, BOOLEAN, TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.get_shared_quote(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_quote(UUID, BOOLEAN, TEXT, TEXT) TO anon, authenticated;

-- ============================================================
-- 4. SEED: Jordan's starter service menu, blank rates
-- Only when the menu is empty, so re-running never duplicates.
-- ============================================================
INSERT INTO quote_services (user_id, name, description, unit, rate, sort_order)
SELECT p.id, s.name, s.description, s.unit, NULL, s.sort_order
FROM profiles p
CROSS JOIN (VALUES
  ('Editing day', 'Post-production on supplied or shot footage', 'day', 1),
  ('Director day', 'Creative direction and directing on set', 'day', 2),
  ('Hero film', 'Director-led production: pre-production, shoot, and post', 'flat', 3),
  ('UGC cut, 30s', 'Native vertical cut, captions and sound mix', 'each', 4),
  ('UGC cut, 60s', 'Native vertical cut, captions and sound mix', 'each', 5),
  ('Extra revision round', 'One consolidated round of notes beyond those included', 'each', 6),
  ('Crew & equipment (pass-through)', 'DP, gaffer, sound, rentals, billed at cost', 'flat', 7)
) AS s(name, description, unit, sort_order)
WHERE p.email = 'connorjordanwatkins@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM quote_services qs WHERE qs.user_id = p.id);

COMMIT;

-- Verify afterwards:
-- SELECT * FROM pg_policies WHERE tablename IN ('quotes','quote_services');
-- SELECT proname FROM pg_proc WHERE proname IN ('get_shared_quote','respond_to_quote');
-- SELECT name, unit, rate FROM quote_services ORDER BY sort_order;
