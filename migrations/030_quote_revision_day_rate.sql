-- ============================================================
-- Arkives — 030: Quotes bill extra revisions by the day
--
-- revision_day_rate: what each working day of revisions beyond the
-- included rounds costs the client. 0 = no rate on the quote (the
-- document falls back to "further rounds are quoted separately").
--
-- get_shared_quote is recreated so the client's link carries the
-- rate. Same body as 026 plus the one key.
--
-- Idempotent. Depends on 026.
-- ============================================================

BEGIN;

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS revision_day_rate NUMERIC(12,2) NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE quotes ADD CONSTRAINT quotes_revision_day_rate_range CHECK (revision_day_rate BETWEEN 0 AND 1000000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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
    'revision_rounds', q.revision_rounds, 'revision_day_rate', q.revision_day_rate,
    'usage_rights', q.usage_rights,
    'notes', q.notes, 'issue_date', q.issue_date, 'valid_until', q.valid_until,
    'status', q.status, 'responded_at', q.responded_at,
    'accepted_name', q.accepted_name, 'expired', public._quote_expired(q.valid_until)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_quote(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.get_shared_quote(UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
