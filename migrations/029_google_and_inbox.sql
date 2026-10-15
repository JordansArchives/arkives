-- ============================================================
-- Arkives — 029: Google Calendar connection + brand-deal inbox
--
-- Every Arkives account connects ITS OWN Google account and gets ITS
-- OWN forwarding address. Nothing is shared between accounts.
--
-- Security model (no Supabase service key anywhere):
--   * google_connections and inbox_addresses have RLS ON, NO policies,
--     and no grants: the browser cannot select, insert or update them
--     directly. All access is through the SECURITY DEFINER functions
--     below, which always scope to the CALLER (current_profile_id()).
--   * Functions that touch tokens or write inbox mail also demand
--     p_key = the Worker's ARKIVES_DB_KEY. Its SHA-256 lives in
--     private.worker_keys (schema not exposed by the API). A stolen
--     browser session therefore cannot read even the ciphertext.
--   * refresh_token is AES-256-GCM sealed by the Worker before it gets
--     here and bound to the user's auth id; this table only ever holds
--     ciphertext.
--
-- AFTER RUNNING THIS FILE, register the Worker key ONCE (SQL editor).
-- Paste only its SHA-256 (the key itself never enters SQL history):
--   security find-generic-password -s vip.arkives-db-key -w | tr -d '\n' | shasum -a 256 | cut -d' ' -f1
--   insert into private.worker_keys (name, key_hash) values ('worker', '<64-char hash>')
--   on conflict (name) do update set key_hash = excluded.key_hash;
-- (hash of the same value set as the ARKIVES_DB_KEY secret in Cloudflare)
--
-- Also: inbox_items gains message_id/received_at (dedupe + ordering),
-- calendar_events gains google_event_id (Arkives events mirrored to
-- Google).
--
-- Idempotent. Depends on 001 (inbox_items, calendar_events,
-- update_updated_at), 008 (current_profile_id, inbox_items RLS).
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================
-- 1. WORKER KEY (private schema: never exposed through the API)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.worker_keys (
  name TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL CHECK (key_hash ~ '^[0-9a-f]{64}$')
);
REVOKE ALL ON private.worker_keys FROM PUBLIC, anon, authenticated;
ALTER TABLE private.worker_keys ENABLE ROW LEVEL SECURITY; -- belt and braces: owner-run functions bypass it

CREATE OR REPLACE FUNCTION private.worker_key_ok(p_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = private, extensions
AS $$
  SELECT p_key IS NOT NULL AND char_length(p_key) BETWEEN 32 AND 200 AND EXISTS (
    SELECT 1 FROM private.worker_keys
    WHERE name = 'worker' AND key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex')
  )
$$;
REVOKE ALL ON FUNCTION private.worker_key_ok(TEXT) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 2. GOOGLE CONNECTIONS (one per profile)
-- ============================================================
CREATE TABLE IF NOT EXISTS google_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  google_email TEXT NOT NULL DEFAULT '' CHECK (char_length(google_email) <= 200),
  scopes TEXT NOT NULL DEFAULT '' CHECK (char_length(scopes) <= 1000),
  refresh_token TEXT NOT NULL CHECK (char_length(refresh_token) BETWEEN 10 AND 2000),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_updated_at ON google_connections;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON google_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE google_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON google_connections FROM PUBLIC, anon, authenticated;

-- Status for the Settings card (no key needed: never returns the token)
CREATE OR REPLACE FUNCTION public.google_conn_status()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('email', google_email, 'scopes', scopes, 'status', status, 'connected_at', connected_at)
  FROM google_connections WHERE user_id = public.current_profile_id()
$$;

CREATE OR REPLACE FUNCTION public.google_conn_put(p_key TEXT, p_email TEXT, p_scopes TEXT, p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE pid UUID := public.current_profile_id();
BEGIN
  IF pid IS NULL OR NOT private.worker_key_ok(p_key) THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  IF p_token IS NULL OR p_token !~ '^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' THEN RAISE EXCEPTION 'bad token' USING ERRCODE = '22023'; END IF;
  INSERT INTO google_connections (user_id, google_email, scopes, refresh_token, status, connected_at)
  VALUES (pid, left(coalesce(p_email, ''), 200), left(coalesce(p_scopes, ''), 1000), p_token, 'active', now())
  ON CONFLICT (user_id) DO UPDATE SET
    google_email = EXCLUDED.google_email, scopes = EXCLUDED.scopes,
    refresh_token = EXCLUDED.refresh_token, status = 'active', connected_at = now();
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.google_conn_token(p_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.worker_key_ok(p_key) THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  RETURN (SELECT refresh_token FROM google_connections WHERE user_id = public.current_profile_id() AND status = 'active');
END;
$$;

CREATE OR REPLACE FUNCTION public.google_conn_mark(p_key TEXT, p_status TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.worker_key_ok(p_key) OR p_status NOT IN ('active', 'revoked') THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  UPDATE google_connections SET status = p_status WHERE user_id = public.current_profile_id();
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.google_conn_delete(p_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.worker_key_ok(p_key) THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  DELETE FROM google_connections WHERE user_id = public.current_profile_id();
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.google_conn_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.google_conn_put(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.google_conn_token(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.google_conn_mark(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.google_conn_delete(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.google_conn_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.google_conn_put(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.google_conn_token(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.google_conn_mark(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.google_conn_delete(TEXT) TO authenticated;

-- ============================================================
-- 3. INBOX FORWARDING ADDRESSES (deals-<token>@arkives.xyz)
-- ============================================================
CREATE TABLE IF NOT EXISTS inbox_addresses (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE CHECK (token ~ '^[0-9a-f]{32}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE inbox_addresses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON inbox_addresses FROM PUBLIC, anon, authenticated;

-- Returns the caller's token, creating it on first use
CREATE OR REPLACE FUNCTION public.inbox_address()
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE pid UUID := public.current_profile_id(); t TEXT;
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  SELECT token INTO t FROM inbox_addresses WHERE user_id = pid;
  IF t IS NULL THEN
    t := encode(extensions.gen_random_bytes(16), 'hex');
    INSERT INTO inbox_addresses (user_id, token) VALUES (pid, t);
  END IF;
  RETURN t;
END;
$$;

-- New address; the old one stops accepting mail immediately
CREATE OR REPLACE FUNCTION public.inbox_address_rotate()
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE pid UUID := public.current_profile_id(); t TEXT := encode(extensions.gen_random_bytes(16), 'hex');
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  INSERT INTO inbox_addresses (user_id, token) VALUES (pid, t)
  ON CONFLICT (user_id) DO UPDATE SET token = EXCLUDED.token, created_at = now();
  RETURN t;
END;
$$;

REVOKE ALL ON FUNCTION public.inbox_address() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.inbox_address_rotate() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inbox_address() TO authenticated;
GRANT EXECUTE ON FUNCTION public.inbox_address_rotate() TO authenticated;

-- ============================================================
-- 4. INBOX ITEMS: dedupe + real timestamps
-- ============================================================
ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS message_id TEXT CHECK (message_id IS NULL OR char_length(message_id) <= 500);
ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS idx_inbox_items_user_msgid ON inbox_items(user_id, message_id) WHERE message_id IS NOT NULL;

-- Called by the Worker's email() handler (no user session: anon + key).
-- Returns 'ok' | 'duplicate' | 'limit' | 'unknown'.
CREATE OR REPLACE FUNCTION public.inbox_ingest(
  p_key TEXT, p_token TEXT, p_from_name TEXT, p_from_email TEXT, p_brand TEXT,
  p_subject TEXT, p_preview TEXT, p_message_id TEXT, p_received_at TIMESTAMPTZ)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE pid UUID; mid TEXT := nullif(left(coalesce(p_message_id, ''), 500), ''); v_at TIMESTAMPTZ := coalesce(p_received_at, now());
BEGIN
  IF NOT private.worker_key_ok(p_key) THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  SELECT user_id INTO pid FROM inbox_addresses WHERE token = lower(coalesce(p_token, ''));
  IF pid IS NULL THEN RETURN 'unknown'; END IF;
  IF mid IS NOT NULL AND EXISTS (SELECT 1 FROM inbox_items WHERE user_id = pid AND message_id = mid) THEN RETURN 'duplicate'; END IF;
  IF (SELECT count(*) FROM inbox_items WHERE user_id = pid AND created_at > now() - interval '1 day') >= 300 THEN RETURN 'limit'; END IF;
  IF v_at > now() + interval '1 day' THEN v_at := now(); END IF;
  INSERT INTO inbox_items (user_id, from_name, from_email, brand, subject, preview, date, time, status, category, message_id, received_at)
  VALUES (pid,
    left(coalesce(nullif(p_from_name, ''), 'Unknown sender'), 200),
    left(coalesce(p_from_email, ''), 200),
    left(coalesce(p_brand, ''), 200),
    left(coalesce(nullif(p_subject, ''), '(No subject)'), 500),
    left(coalesce(p_preview, ''), 2000),
    to_char(v_at, 'YYYY-MM-DD'), NULL, 'new', 'inbound', mid, v_at)
  ON CONFLICT DO NOTHING;
  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.inbox_ingest(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inbox_ingest(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO anon, authenticated;

-- ============================================================
-- 5. CALENDAR EVENTS mirrored to Google
-- ============================================================
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS google_event_id TEXT CHECK (google_event_id IS NULL OR char_length(google_event_id) <= 1024);

COMMIT;
