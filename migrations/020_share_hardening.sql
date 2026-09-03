-- ============================================================
-- Arkives — 020: Share-link hardening + profile drift
--
-- Closes the two Critical findings of ARCHITECTURE-AUDIT.md
-- (F1, F2): the token-gated write RPCs from 018/019 accepted any
-- content, so a stranger holding an EDIT link could store a
-- crafted thumbnail / board item that the OWNER's editor then
-- rendered. The app now escapes at render too; this migration is
-- the server-side half (defense in depth, and it protects older
-- clients that may still be cached on a phone).
--
-- Also writes down the two pieces of schema drift the audit found
-- (F9): profiles.id needs a DEFAULT and no FK to auth.users
-- (live was built from full_migration_v2, 001 says otherwise),
-- and scripts.share_token needs a default on both the live TEXT
-- column and a fresh UUID one.
--
-- Abuse caps (F7): thumbnails capped at 400KB (client makes
-- ~600px JPEGs, well under), board item content at 64KB except
-- pen strokes at 256KB, and at most 500 uploaded objects per
-- shared board.
--
-- Idempotent. Safe to run before or after deploying the matching
-- app.js/boards.js. Depends on 018 + 019.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. PROFILES drift (fresh installs could not create a profile)
-- ============================================================
ALTER TABLE profiles ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- scripts.share_token: TEXT on live, UUID on a fresh install.
-- Either way it must default to a fresh token.
DO $$
DECLARE v_type TEXT;
BEGIN
  SELECT data_type INTO v_type FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'scripts' AND column_name = 'share_token';
  IF v_type = 'uuid' THEN
    ALTER TABLE scripts ALTER COLUMN share_token SET DEFAULT uuid_generate_v4();
  ELSE
    ALTER TABLE scripts ALTER COLUMN share_token SET DEFAULT uuid_generate_v4()::text;
  END IF;
END $$;
UPDATE scripts SET share_token = uuid_generate_v4()::text WHERE share_token IS NULL;

-- ============================================================
-- 2. VALIDATORS
-- ============================================================

-- A scene thumbnail is either empty or a base64 image data URL.
CREATE OR REPLACE FUNCTION public._valid_thumbnail(p TEXT)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
AS $$
  SELECT p IS NULL
      OR p = ''
      OR (length(p) <= 400000
          AND p ~ '^data:image/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$')
$$;

-- Board item content, validated per kind. Mirrors what the client
-- produces (boards.js: _bdParseVideoUrl, _bdAddImageFiles, pen
-- strokes). Unknown keys are ignored; known keys must be well-formed.
CREATE OR REPLACE FUNCTION public._valid_board_content(p_kind TEXT, c JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  v_text TEXT;
  v_size TEXT;
  v_color TEXT;
  v_provider TEXT;
  v_vid TEXT;
  v_url TEXT;
  v_path TEXT;
  v_bad INT;
BEGIN
  IF c IS NULL OR jsonb_typeof(c) <> 'object' THEN RETURN FALSE; END IF;

  -- Optional shared fields
  IF c ? 'size' THEN
    IF jsonb_typeof(c->'size') <> 'string' THEN RETURN FALSE; END IF;
    v_size := c->>'size';
    IF v_size NOT IN ('small','body','large','title') THEN RETURN FALSE; END IF;
  END IF;
  IF c ? 'rich' AND jsonb_typeof(c->'rich') <> 'boolean' THEN RETURN FALSE; END IF;
  IF c ? 'caption' THEN
    IF jsonb_typeof(c->'caption') <> 'string' OR length(c->>'caption') > 2000 THEN RETURN FALSE; END IF;
  END IF;

  IF p_kind IN ('note','text') THEN
    IF c ? 'text' THEN
      IF jsonb_typeof(c->'text') <> 'string' OR length(c->>'text') > 20000 THEN RETURN FALSE; END IF;
    END IF;
    IF p_kind = 'note' AND c ? 'color' THEN
      v_color := c->>'color';
      IF jsonb_typeof(c->'color') <> 'string' OR v_color NOT IN ('yellow','red','teal','white') THEN RETURN FALSE; END IF;
    END IF;
    RETURN TRUE;
  END IF;

  IF p_kind = 'image' THEN
    IF jsonb_typeof(c->'path') <> 'string' THEN RETURN FALSE; END IF;
    v_path := c->>'path';
    -- {profile uuid}/{board uuid}/{file uuid}.{ext}
    IF v_path !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|jpeg|png|gif)$' THEN
      RETURN FALSE;
    END IF;
    IF c ? 'natW' AND jsonb_typeof(c->'natW') <> 'number' THEN RETURN FALSE; END IF;
    IF c ? 'natH' AND jsonb_typeof(c->'natH') <> 'number' THEN RETURN FALSE; END IF;
    RETURN TRUE;
  END IF;

  IF p_kind = 'video' THEN
    IF jsonb_typeof(c->'url') <> 'string' THEN RETURN FALSE; END IF;
    v_url := c->>'url';
    IF length(v_url) > 2000 OR v_url !~ '^https?://' THEN RETURN FALSE; END IF;
    v_provider := c->>'provider';
    IF v_provider IS NULL OR v_provider NOT IN ('youtube','vimeo','link') THEN RETURN FALSE; END IF;
    v_vid := c->>'vid';
    IF v_provider = 'youtube' AND (v_vid IS NULL OR v_vid !~ '^[A-Za-z0-9_-]{11}$') THEN RETURN FALSE; END IF;
    IF v_provider = 'vimeo' AND (v_vid IS NULL OR v_vid !~ '^[0-9]{1,20}$') THEN RETURN FALSE; END IF;
    IF v_provider = 'link' AND v_vid IS NOT NULL AND jsonb_typeof(c->'vid') <> 'null' THEN RETURN FALSE; END IF;
    RETURN TRUE;
  END IF;

  IF p_kind = 'draw' THEN
    IF jsonb_typeof(c->'points') <> 'array' OR jsonb_array_length(c->'points') > 5000 THEN RETURN FALSE; END IF;
    SELECT count(*) INTO v_bad
      FROM jsonb_array_elements(c->'points') p
     WHERE jsonb_typeof(p) <> 'array'
        OR jsonb_array_length(p) <> 2
        OR jsonb_typeof(p->0) <> 'number'
        OR jsonb_typeof(p->1) <> 'number';
    IF v_bad > 0 THEN RETURN FALSE; END IF;
    IF c ? 'color' THEN
      v_color := c->>'color';
      IF jsonb_typeof(c->'color') <> 'string' OR v_color NOT IN ('ink','red','teal') THEN RETURN FALSE; END IF;
    END IF;
    IF c ? 'width' THEN
      IF jsonb_typeof(c->'width') <> 'number' OR (c->>'width')::numeric < 1 OR (c->>'width')::numeric > 40 THEN RETURN FALSE; END IF;
    END IF;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END $$;

-- Objects uploaded under one board's folder (for the per-board cap).
-- SECURITY DEFINER so the storage policy can count without RLS
-- interplay; takes the board id as text (foldername[2]).
CREATE OR REPLACE FUNCTION public._board_object_count(p_board TEXT)
RETURNS BIGINT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) FROM storage.objects o
   WHERE o.bucket_id = 'board-media' AND (storage.foldername(o.name))[2] = p_board
$$;
REVOKE ALL ON FUNCTION public._board_object_count(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public._board_object_count(TEXT) TO anon, authenticated;

-- ============================================================
-- 3. SCRIPT RPCs (018) — validate what shared editors may write
-- ============================================================

CREATE OR REPLACE FUNCTION public.patch_shared_scene(
  p_token TEXT, p_scene_id UUID,
  p_script_text TEXT DEFAULT NULL,
  p_scene_description TEXT DEFAULT NULL,
  p_thumbnail_data TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID := public._shared_script_id(p_token);
BEGIN
  IF length(p_script_text) > 100000 OR length(p_scene_description) > 100000 THEN
    RAISE EXCEPTION 'field too large';
  END IF;
  IF NOT public._valid_thumbnail(p_thumbnail_data) THEN
    RAISE EXCEPTION 'invalid thumbnail';
  END IF;
  UPDATE script_scenes SET
    script_text       = coalesce(p_script_text, script_text),
    scene_description = coalesce(p_scene_description, scene_description),
    thumbnail_data    = coalesce(p_thumbnail_data, thumbnail_data)
  WHERE id = p_scene_id AND script_id = v_id;
END $$;

-- Titles: strip control characters so nothing odd lands in an attribute
CREATE OR REPLACE FUNCTION public.update_shared_script_title(p_token TEXT, p_title TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID := public._shared_script_id(p_token);
BEGIN
  UPDATE scripts
     SET title = left(coalesce(nullif(trim(regexp_replace(p_title, '[\x00-\x1F\x7F]', '', 'g')), ''), 'Untitled Script'), 300)
   WHERE id = v_id;
END $$;

-- ============================================================
-- 4. BOARD RPCs (019) — validate content per kind, tighter caps
-- ============================================================

CREATE OR REPLACE FUNCTION public.add_shared_board_item(
  p_token UUID, p_kind TEXT,
  p_x DOUBLE PRECISION, p_y DOUBLE PRECISION,
  p_w DOUBLE PRECISION, p_h DOUBLE PRECISION,
  p_z INTEGER, p_content JSONB,
  p_id UUID DEFAULT NULL)
RETURNS TABLE (id UUID, board_id UUID, kind TEXT, x DOUBLE PRECISION, y DOUBLE PRECISION,
               w DOUBLE PRECISION, h DOUBLE PRECISION, z INTEGER, content JSONB)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID := public._shared_board_id(p_token);
  v_content JSONB := coalesce(p_content, '{}'::jsonb);
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN ('note','text','image','video','draw') THEN
    RAISE EXCEPTION 'invalid kind';
  END IF;
  IF length(v_content::text) > (CASE WHEN p_kind = 'draw' THEN 262144 ELSE 65536 END) THEN
    RAISE EXCEPTION 'content too large';
  END IF;
  IF NOT public._valid_board_content(p_kind, v_content) THEN
    RAISE EXCEPTION 'invalid content';
  END IF;
  IF (SELECT count(*) FROM board_items i WHERE i.board_id = v_id) >= 2000 THEN
    RAISE EXCEPTION 'item limit reached';
  END IF;
  RETURN QUERY
  INSERT INTO board_items (id, board_id, user_id, kind, x, y, w, h, z, content)
  SELECT coalesce(p_id, uuid_generate_v4()), v_id, b.user_id, p_kind,
         p_x, p_y, p_w, p_h, coalesce(p_z, 1), v_content
  FROM boards b WHERE b.id = v_id
  RETURNING board_items.id, board_items.board_id, board_items.kind,
            board_items.x, board_items.y, board_items.w, board_items.h,
            board_items.z, board_items.content;
END $$;

CREATE OR REPLACE FUNCTION public.update_shared_board_item(
  p_token UUID, p_item_id UUID,
  p_x DOUBLE PRECISION DEFAULT NULL, p_y DOUBLE PRECISION DEFAULT NULL,
  p_w DOUBLE PRECISION DEFAULT NULL, p_h DOUBLE PRECISION DEFAULT NULL,
  p_z INTEGER DEFAULT NULL, p_content JSONB DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID := public._shared_board_id(p_token);
  v_kind TEXT;
BEGIN
  IF p_content IS NOT NULL THEN
    SELECT i.kind INTO v_kind FROM board_items i WHERE i.id = p_item_id AND i.board_id = v_id;
    IF v_kind IS NULL THEN RETURN; END IF;
    IF length(p_content::text) > (CASE WHEN v_kind = 'draw' THEN 262144 ELSE 65536 END) THEN
      RAISE EXCEPTION 'content too large';
    END IF;
    IF NOT public._valid_board_content(v_kind, p_content) THEN
      RAISE EXCEPTION 'invalid content';
    END IF;
  END IF;
  UPDATE board_items SET
    x = coalesce(p_x, x), y = coalesce(p_y, y),
    w = coalesce(p_w, w), h = coalesce(p_h, h),
    z = coalesce(p_z, z), content = coalesce(p_content, content)
  WHERE id = p_item_id AND board_id = v_id;
END $$;

-- ============================================================
-- 5. STORAGE: per-board object cap for anonymous editors
-- ============================================================
DROP POLICY IF EXISTS "board_media_insert_shared" ON storage.objects;
CREATE POLICY "board_media_insert_shared" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'board-media' AND EXISTS (
    SELECT 1 FROM public.boards b
    WHERE b.id::text = (storage.foldername(name))[2]
      AND b.user_id::text = (storage.foldername(name))[1]
      AND b.share_mode = 'edit'
  ) AND public._board_object_count((storage.foldername(name))[2]) < 500);

COMMIT;

-- Verify afterwards:
-- SELECT public._valid_board_content('video', '{"url":"https://x","provider":"youtube","vid":"abc"}'::jsonb);   -- false
-- SELECT public._valid_board_content('video', '{"url":"https://youtu.be/dQw4w9WgXcQ","provider":"youtube","vid":"dQw4w9WgXcQ"}'::jsonb); -- true
-- SELECT public._valid_thumbnail('data:image/jpeg;base64,AAAA');  -- true
-- SELECT public._valid_thumbnail('x" onerror="alert(1)');           -- false
-- SELECT column_default FROM information_schema.columns WHERE table_name='profiles' AND column_name='id';
