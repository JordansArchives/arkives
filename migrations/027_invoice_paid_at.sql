-- ============================================================
-- 027: invoices.paid_at, the day the money came in
--
-- The dashboard and Revenue view now build every money number from
-- invoices. "Paid this month" and the monthly revenue chart need the
-- date an invoice was PAID, not the date it was issued. The database
-- stamps it so no client code can forget: entering 'paid' sets
-- paid_at (unless one was given), leaving 'paid' clears it.
--
-- Backfill: invoices already marked paid get their last-edited time,
-- which for most of them is the moment they were marked paid.
--
-- Safe to run twice. Until it runs, the app falls back to the
-- invoice date.
-- ============================================================

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

UPDATE invoices SET paid_at = updated_at
WHERE status = 'paid' AND paid_at IS NULL;

CREATE OR REPLACE FUNCTION public._invoice_stamp_paid_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'paid' THEN
    IF NEW.paid_at IS NULL OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'paid' AND NEW.paid_at IS NOT DISTINCT FROM OLD.paid_at) THEN
      NEW.paid_at := now();
    END IF;
  ELSE
    NEW.paid_at := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS invoices_stamp_paid_at ON invoices;
CREATE TRIGGER invoices_stamp_paid_at BEFORE INSERT OR UPDATE OF status, paid_at ON invoices
  FOR EACH ROW EXECUTE FUNCTION public._invoice_stamp_paid_at();

CREATE INDEX IF NOT EXISTS idx_invoices_paid_at ON invoices(user_id, paid_at) WHERE paid_at IS NOT NULL;
