-- ============================================================
-- Arkives — 025: scene blocks (shot / transition pills) and
--                multiple thumbnails per scene
--
-- The SCENE cell of a script row becomes an ordered list of blocks.
-- A block is a shot (shot size, camera angle, lighting, text) or a
-- transition (transition type, text). The THUMBNAIL cell becomes a
-- list of images. Nothing existing moves: a scene with no blocks
-- renders its scene_description as one untagged shot block, and the
-- old single thumbnail renders ahead of the new list. The client
-- keeps scene_description as a plain-text mirror of the blocks so
-- anything reading it still works.
--
--   script_scenes.blocks      JSONB  null = legacy (use scene_description)
--     [{ "kind": "shot", "shot": "Medium", "angle": "Top-down",
--        "light": "Daylight", "text": "..." },
--      { "kind": "transition", "type": "Match cut", "text": "..." }]
--   script_scenes.thumbnails  JSONB  null = legacy (use thumbnail_data)
--     ["data:image/jpeg;base64,...", ...]
--   profiles.scene_tag_presets JSONB  custom pill values the owner added
--     { "shot": [...], "angle": [...], "light": [...], "transition": [...] }
--
-- Both scene columns are validated by CHECK constraints (shape, caps)
-- and by patch_shared_scene for edit links. The share RPCs that
-- return scenes change shape, so they are dropped and recreated with
-- 021's columns plus the two new ones; grants are re-applied.
--
-- Idempotent. Safe to run before or after deploying the client.
-- Depends on 018, 020, 021.
-- ============================================================

BEGIN;

-- 1. Columns -----------------------------------------------------
ALTER TABLE script_scenes ADD COLUMN IF NOT EXISTS blocks JSONB;
ALTER TABLE script_scenes ADD COLUMN IF NOT EXISTS thumbnails JSONB;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS scene_tag_presets JSONB;

-- 2. Validators --------------------------------------------------

-- A tag value is absent, null, or a short string.
CREATE OR REPLACE FUNCTION public._valid_scene_tag(v JSONB)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
AS $$
  SELECT v IS NULL OR jsonb_typeof(v) = 'null'
      OR (jsonb_typeof(v) = 'string' AND length(v #>> '{}') <= 60)
$$;

-- blocks: null, or an array of at most 50 block objects.
CREATE OR REPLACE FUNCTION public._valid_scene_blocks(b JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE blk JSONB; v_kind TEXT;
BEGIN
  IF b IS NULL THEN RETURN TRUE; END IF;
  IF jsonb_typeof(b) <> 'array' OR jsonb_array_length(b) > 50 THEN RETURN FALSE; END IF;
  FOR blk IN SELECT * FROM jsonb_array_elements(b) LOOP
    IF jsonb_typeof(blk) <> 'object' THEN RETURN FALSE; END IF;
    v_kind := blk->>'kind';
    IF v_kind IS NULL OR v_kind NOT IN ('shot','transition') THEN RETURN FALSE; END IF;
    IF blk ? 'text' AND (jsonb_typeof(blk->'text') <> 'string' OR length(blk->>'text') > 20000) THEN RETURN FALSE; END IF;
    IF NOT public._valid_scene_tag(blk->'shot')  THEN RETURN FALSE; END IF;
    IF NOT public._valid_scene_tag(blk->'angle') THEN RETURN FALSE; END IF;
    IF NOT public._valid_scene_tag(blk->'light') THEN RETURN FALSE; END IF;
    IF NOT public._valid_scene_tag(blk->'type')  THEN RETURN FALSE; END IF;
  END LOOP;
  RETURN TRUE;
END $$;

-- thumbnails: null, or an array of at most 8 image data URLs, each
-- passing the same check as the legacy column (020).
CREATE OR REPLACE FUNCTION public._valid_scene_thumbnails(t JSONB)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
AS $$
  SELECT t IS NULL
      OR (jsonb_typeof(t) = 'array'
          AND jsonb_array_length(t) <= 8
          AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(t) e
             WHERE jsonb_typeof(e) <> 'string'
                OR NOT public._valid_thumbnail(e #>> '{}')
                OR (e #>> '{}') = ''))
$$;

-- presets: null, or an object whose values are arrays of short strings.
CREATE OR REPLACE FUNCTION public._valid_tag_presets(p JSONB)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
AS $$
  SELECT p IS NULL
      OR (jsonb_typeof(p) = 'object'
          AND NOT EXISTS (
            SELECT 1 FROM jsonb_each(p) kv
             WHERE kv.key NOT IN ('shot','angle','light','transition')
                OR jsonb_typeof(kv.value) <> 'array'
                OR jsonb_array_length(kv.value) > 100
                OR EXISTS (SELECT 1 FROM jsonb_array_elements(kv.value) e
                            WHERE jsonb_typeof(e) <> 'string' OR length(e #>> '{}') > 60)))
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'script_scenes_blocks_shape') THEN
    ALTER TABLE script_scenes ADD CONSTRAINT script_scenes_blocks_shape
      CHECK (public._valid_scene_blocks(blocks));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'script_scenes_thumbnails_shape') THEN
    ALTER TABLE script_scenes ADD CONSTRAINT script_scenes_thumbnails_shape
      CHECK (public._valid_scene_thumbnails(thumbnails));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_scene_tag_presets_shape') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_scene_tag_presets_shape
      CHECK (public._valid_tag_presets(scene_tag_presets));
  END IF;
END $$;

-- 3. Shared-link RPCs learn the new columns ------------------------
-- Return types change, so drop and recreate (shape = 021 + blocks +
-- thumbnails). Grants re-applied below.

DROP FUNCTION IF EXISTS public.get_shared_script_scenes(TEXT);
CREATE FUNCTION public.get_shared_script_scenes(p_token TEXT)
RETURNS TABLE (id UUID, script_id UUID, sort_order INTEGER,
               script_text TEXT, scene_description TEXT, thumbnail_data TEXT, thumbnail_path TEXT,
               blocks JSONB, thumbnails JSONB)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sc.id, sc.script_id, sc.sort_order,
         sc.script_text, sc.scene_description, sc.thumbnail_data, sc.thumbnail_path,
         sc.blocks, sc.thumbnails
  FROM script_scenes sc
  JOIN scripts s ON s.id = sc.script_id
  WHERE s.share_token::text = p_token AND s.share_mode IN ('view','edit')
  ORDER BY sc.sort_order ASC
$$;

DROP FUNCTION IF EXISTS public.add_shared_scene(TEXT, INTEGER);
CREATE FUNCTION public.add_shared_scene(p_token TEXT, p_sort_order INTEGER)
RETURNS TABLE (id UUID, script_id UUID, sort_order INTEGER,
               script_text TEXT, scene_description TEXT, thumbnail_data TEXT, thumbnail_path TEXT,
               blocks JSONB, thumbnails JSONB)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID := public._shared_script_id(p_token);
BEGIN
  IF (SELECT count(*) FROM script_scenes sc WHERE sc.script_id = v_id) >= 500 THEN
    RAISE EXCEPTION 'scene limit reached';
  END IF;
  RETURN QUERY
  INSERT INTO script_scenes (script_id, user_id, sort_order, script_text, scene_description, thumbnail_data)
  SELECT v_id, s.user_id, greatest(coalesce(p_sort_order, 0), 0), '', '', ''
  FROM scripts s WHERE s.id = v_id
  RETURNING script_scenes.id, script_scenes.script_id, script_scenes.sort_order,
            script_scenes.script_text, script_scenes.scene_description,
            script_scenes.thumbnail_data, script_scenes.thumbnail_path,
            script_scenes.blocks, script_scenes.thumbnails;
END $$;

-- patch_shared_scene gains p_blocks and p_thumbnails. NULL leaves a
-- column alone; the client sends the whole array when it changes.
-- Everything else is 021's body unchanged.
DROP FUNCTION IF EXISTS public.patch_shared_scene(TEXT, UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.patch_shared_scene(TEXT, UUID, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.patch_shared_scene(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB);
CREATE FUNCTION public.patch_shared_scene(
  p_token TEXT, p_scene_id UUID,
  p_script_text TEXT DEFAULT NULL,
  p_scene_description TEXT DEFAULT NULL,
  p_thumbnail_data TEXT DEFAULT NULL,
  p_thumbnail_path TEXT DEFAULT NULL,
  p_blocks JSONB DEFAULT NULL,
  p_thumbnails JSONB DEFAULT NULL)
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
  IF NOT public._valid_thumbnail_path(p_thumbnail_path)
     OR (coalesce(p_thumbnail_path, '') <> '' AND split_part(p_thumbnail_path, '/', 2) <> v_id::text) THEN
    RAISE EXCEPTION 'invalid thumbnail path';
  END IF;
  IF NOT public._valid_scene_blocks(p_blocks) THEN
    RAISE EXCEPTION 'invalid blocks';
  END IF;
  IF NOT public._valid_scene_thumbnails(p_thumbnails) THEN
    RAISE EXCEPTION 'invalid thumbnails';
  END IF;
  UPDATE script_scenes SET
    script_text       = coalesce(p_script_text, script_text),
    scene_description = coalesce(p_scene_description, scene_description),
    thumbnail_data    = CASE WHEN coalesce(p_thumbnail_path, '') <> '' THEN ''
                             ELSE coalesce(p_thumbnail_data, thumbnail_data) END,
    thumbnail_path    = CASE WHEN coalesce(p_thumbnail_data, '') <> '' THEN NULL
                             WHEN p_thumbnail_path IS NULL THEN thumbnail_path
                             WHEN p_thumbnail_path = '' THEN NULL
                             ELSE p_thumbnail_path END,
    blocks            = coalesce(p_blocks, blocks),
    thumbnails        = coalesce(p_thumbnails, thumbnails)
  WHERE id = p_scene_id AND script_id = v_id;
END $$;

REVOKE ALL ON FUNCTION public.get_shared_script_scenes(TEXT) FROM public;
REVOKE ALL ON FUNCTION public.add_shared_scene(TEXT, INTEGER) FROM public;
REVOKE ALL ON FUNCTION public.patch_shared_scene(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB) FROM public;
GRANT EXECUTE ON FUNCTION public.get_shared_script_scenes(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_shared_scene(TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.patch_shared_scene(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB) TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Verify afterwards:
-- SELECT column_name FROM information_schema.columns WHERE table_name='script_scenes' AND column_name IN ('blocks','thumbnails');  -- 2 rows
-- SELECT public._valid_scene_blocks('[{"kind":"shot","shot":"Medium","text":"x"},{"kind":"transition","type":"Match cut"}]'::jsonb); -- true
-- SELECT public._valid_scene_blocks('[{"kind":"pan"}]'::jsonb);                                                                       -- false
-- SELECT public._valid_scene_thumbnails('["data:image/jpeg;base64,AAAA"]'::jsonb);                                                   -- true
-- SELECT public._valid_scene_thumbnails('["https://x"]'::jsonb);                                                                       -- false
