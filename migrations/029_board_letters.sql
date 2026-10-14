-- ============================================================
-- Arkives — 029: Board letters (big scalable numbers and letters)
--
-- Adds the 'letter' board item: a short string (1-12 characters)
-- drawn as a vector that fills its box, so it scales and stretches
-- like a shape. Content: { text, color: ink|red|teal,
-- font: sans|serif|mono }.
--
-- Three changes:
--   1. board_items.kind accepts 'letter'.
--   2. _valid_board_content (020) learns the letter shape, so shared
--      editors can only write well-formed letters.
--   3. add_shared_board_item (020) accepts the new kind.
-- Both functions are copied from 020 with only those lines added.
--
-- Idempotent. Run before using letters (the app shows a save error
-- until it's applied). Depends on 016, 019, 020.
-- ============================================================

BEGIN;

-- Drop whatever check currently guards kind (named by Postgres in 016)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT conname FROM pg_constraint
            WHERE conrelid = 'public.board_items'::regclass AND contype = 'c'
              AND pg_get_constraintdef(oid) ILIKE '%kind%'
  LOOP
    EXECUTE format('ALTER TABLE board_items DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
ALTER TABLE board_items ADD CONSTRAINT board_items_kind_check
  CHECK (kind IN ('note','text','image','video','draw','letter'));

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

  IF p_kind = 'letter' THEN
    IF jsonb_typeof(c->'text') <> 'string' OR length(c->>'text') < 1 OR length(c->>'text') > 12 THEN RETURN FALSE; END IF;
    IF c ? 'color' THEN
      v_color := c->>'color';
      IF jsonb_typeof(c->'color') <> 'string' OR v_color NOT IN ('ink','red','teal') THEN RETURN FALSE; END IF;
    END IF;
    IF c ? 'font' THEN
      IF jsonb_typeof(c->'font') <> 'string' OR c->>'font' NOT IN ('sans','serif','mono') THEN RETURN FALSE; END IF;
    END IF;
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
  IF p_kind IS NULL OR p_kind NOT IN ('note','text','image','video','draw','letter') THEN
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

COMMIT;

-- Verify afterwards:
--   SELECT public._valid_board_content('letter', '{"text":"1","color":"red","font":"sans"}');  -- true
--   SELECT public._valid_board_content('letter', '{"text":""}');  -- false
