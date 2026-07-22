-- ============================================================
-- Arkives — 011: Full invoicing (clients book + invoice builder)
--
-- Upgrades the invoices feature from a flat tracker table to a
-- real invoice builder: saved clients, line items, partial
-- payments, a toggleable bank-payment-info block, and
-- user-configurable invoice numbering.
--
-- Adds one new table (clients) — after 009 + 010 + 011 the
-- schema is 19 working tables plus profiles.
--
-- Depends on 008 (public.current_profile_id + invoices RLS,
-- applied live) and 001 (update_updated_at trigger function).
-- Safe to run before or after 009/010.
--
-- Design notes:
-- * Line items live in a JSONB column on invoices, not a child
--   table. They are never queried relationally — the document is
--   always loaded whole — and JSONB keeps the vanilla-JS client
--   simple. Shape per item:
--     { "type": "flat"|"hourly"|"day", "desc": text,
--       "qty": number, "rate": number, "fee": number }
-- * bill_to_name / bill_to_address are a SNAPSHOT taken when the
--   invoice is created. Editing them on an invoice never mutates
--   the saved client (and vice versa) — issued invoices must not
--   change retroactively.
-- * amount becomes NUMERIC(12,2): invoices need cents (hourly
--   rates like $99.49). Existing whole-dollar INTEGER values cast
--   losslessly.
-- * Bank details go on profiles (entered once in Settings, then
--   an include_payment_info toggle per invoice). They are scoped
--   by the profiles RLS from 008 — own row only.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. CLIENTS (the standalone saved-clients book)
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  company TEXT NOT NULL DEFAULT '' CHECK (char_length(company) <= 200),
  email TEXT NOT NULL DEFAULT '' CHECK (char_length(email) <= 200),
  billing_address TEXT NOT NULL DEFAULT '' CHECK (char_length(billing_address) <= 1000),
  invoice_prefix TEXT NOT NULL DEFAULT '' CHECK (char_length(invoice_prefix) <= 12),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_user ON clients(user_id);

DROP TRIGGER IF EXISTS set_updated_at ON clients;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ALTER COLUMN user_id SET DEFAULT public.current_profile_id();

DROP POLICY IF EXISTS "clients_select_own" ON clients;
DROP POLICY IF EXISTS "clients_insert_own" ON clients;
DROP POLICY IF EXISTS "clients_update_own" ON clients;
DROP POLICY IF EXISTS "clients_delete_own" ON clients;

CREATE POLICY "clients_select_own" ON clients FOR SELECT TO authenticated
  USING (user_id = public.current_profile_id());
CREATE POLICY "clients_insert_own" ON clients FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "clients_update_own" ON clients FOR UPDATE TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "clients_delete_own" ON clients FOR DELETE TO authenticated
  USING (user_id = public.current_profile_id());

-- ============================================================
-- 2. INVOICES: builder columns
-- ============================================================
ALTER TABLE invoices ALTER COLUMN amount TYPE NUMERIC(12,2);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bill_to_name TEXT NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bill_to_address TEXT NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS line_items JSONB NOT NULL DEFAULT '[]';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS include_payment_info BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);

-- payment_terms gains a 'none' option (freeform / no due date).
-- Column is TEXT with no CHECK, so no DDL needed — documented here.

-- ============================================================
-- 3. PROFILES: business + bank details, numbering settings
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_address TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_name TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_account_holder TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_account_number TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_routing_number TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_account_type TEXT NOT NULL DEFAULT '';

-- invoice_numbering: 'per_client' → prefix from the client's book
-- entry (SKYMOGRAPHY-0001 style, counter per client); 'global' →
-- one running sequence under invoice_prefix (INV-2025001 style).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invoice_numbering TEXT NOT NULL DEFAULT 'per_client'
  CHECK (invoice_numbering IN ('per_client', 'global'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invoice_prefix TEXT NOT NULL DEFAULT 'INV'
  CHECK (char_length(invoice_prefix) <= 12);

COMMIT;

-- Verify afterwards:
-- SELECT * FROM pg_policies WHERE tablename = 'clients';
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'invoices' ORDER BY ordinal_position;
