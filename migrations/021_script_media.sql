-- ============================================================
-- 021: script thumbnails move from a base64 column to Storage
-- ============================================================
-- Scene thumbnails are ~600px JPEG data URLs stored in
-- script_scenes.thumbnail_data (100-400KB each). Every scenes
-- query and every shared-link RPC drags them along. This
-- migration adds a private bucket and a path column, mirroring
-- the boards layout (016/017/019/020):
--
--   bucket  script-media, private, 2MB/object, jpeg|png|webp
--   path    {owner_profile_id}/{script_id}/{uuid}.jpg
--   column  script_scenes.thumbnail_path (nullable; thumbnail_data
--           stays for rows not yet moved, the client renders
--           whichever is set)
--
-- Safe to run before OR after the client that uses it deploys;
-- idempotent, run it twice and nothing changes.
-- ============================================================

BEGIN;

-- 1. Bucket ---------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('script-media', 'script-media', false, 2097152,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Column + shape check ---------------------------------------
ALTER TABLE script_scenes ADD COLUMN IF NOT EXISTS thumbnail_path TEXT;

-- A path is empty or exactly {uuid}/{uuid}/{uuid}.{jpg|png|webp}.
CREATE OR REPLACE FUNCTION public._valid_thumbnail_path(p TEXT)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
AS $$
  SELECT p IS NULL
      OR p = ''
      OR p ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'script_scenes_thumbnail_path_shape') THEN
    ALTER TABLE script_scenes ADD CONSTRAINT script_scenes_thumbnail_path_shape
      CHECK (public._valid_thumbnail_path(thumbnail_path));
  END IF;
END $$;

-- 3. Per-script object cap (backstop for a leaked edit link) ------
CREATE OR REPLACE FUNCTION public._script_object_count(p_script TEXT)
RETURNS BIGINT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) FROM storage.objects o
   WHERE o.bucket_id = 'script-media' AND (storage.foldername(o.name))[2] = p_script
$$;
REVOKE ALL ON FUNCTION public._script_object_count(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public._script_object_count(TEXT) TO anon, authenticated;

-- 4. Storage policies: the owner, under their own folder ----------
DROP POLICY IF EXISTS "script_media_select_own" ON storage.objects;
DROP POLICY IF EXISTS "script_media_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "script_media_update_own" ON storage.objects;
DROP POLICY IF EXISTS "script_media_delete_own" ON storage.objects;
CREATE POLICY "script_media_select_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'script-media' AND (storage.foldername(name))[1] = public.current_profile_id()::text);
CREATE POLICY "script_media_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'script-media' AND (storage.foldername(name))[1] = public.current_profile_id()::text);
CREATE POLICY "script_media_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'script-media' AND (storage.foldername(name))[1] = public.current_profile_id()::text);
CREATE POLICY "script_media_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'script-media' AND (storage.foldername(name))[1] = public.current_profile_id()::text);

-- 5. Storage policies: shared links ---------------------------------
-- SELECT: view + edit. INSERT/DELETE: edit only, only into the shared
-- script's own folder under its owner's folder, and capped per script.
DROP POLICY IF EXISTS "script_media_select_shared" ON storage.objects;
CREATE POLICY "script_media_select_shared" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'script-media' AND EXISTS (
    SELECT 1 FROM public.scripts s
    WHERE s.id::text = (storage.foldername(name))[2]
      AND s.share_mode IN ('view','edit')
  ));

DROP POLICY IF EXISTS "script_media_insert_shared" ON storage.objects;
CREATE POLICY "script_media_insert_shared" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'script-media'
    AND public._script_object_count((storage.foldername(name))[2]) < 600
    AND EXISTS (
      SELECT 1 FROM public.scripts s
      WHERE s.id::text = (storage.foldername(name))[2]
        AND s.user_id::text = (storage.foldername(name))[1]
        AND s.share_mode = 'edit'
    ));

DROP POLICY IF EXISTS "script_media_delete_shared" ON storage.objects;
CREATE POLICY "script_media_delete_shared" ON storage.objects FOR DELETE TO anon, authenticated
  USING (bucket_id = 'script-media' AND EXISTS (
    SELECT 1 FROM public.scripts s
    WHERE s.id::text = (storage.foldername(name))[2]
      AND s.user_id::text = (storage.foldername(name))[1]
      AND s.share_mode = 'edit'
  ));

-- 6. Shared-link RPCs learn the path column ---------------------------
-- Return types change, so these are dropped and recreated (018/020
-- created them; grants are re-applied below).

DROP FUNCTION IF EXISTS public.get_shared_script_scenes(TEXT);
CREATE FUNCTION public.get_shared_script_scenes(p_token TEXT)
RETURNS TABLE (id UUID, script_id UUID, sort_order INTEGER,
               script_text TEXT, scene_description TEXT, thumbnail_data TEXT, thumbnail_path TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sc.id, sc.script_id, sc.sort_order,
         sc.script_text, sc.scene_description, sc.thumbnail_data, sc.thumbnail_path
  FROM script_scenes sc
  JOIN scripts s ON s.id = sc.script_id
  WHERE s.share_token::text = p_token AND s.share_mode IN ('view','edit')
  ORDER BY sc.sort_order ASC
$$;

DROP FUNCTION IF EXISTS public.add_shared_scene(TEXT, INTEGER);
CREATE FUNCTION public.add_shared_scene(p_token TEXT, p_sort_order INTEGER)
RETURNS TABLE (id UUID, script_id UUID, sort_order INTEGER,
               script_text TEXT, scene_description TEXT, thumbnail_data TEXT, thumbnail_path TEXT)
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
            script_scenes.thumbnail_data, script_scenes.thumbnail_path;
END $$;

-- patch_shared_scene gains p_thumbnail_path. A path must be valid in
-- shape and live under THIS script's folder; '' clears it. Setting a
-- path clears the legacy data URL and vice versa, so a scene never
-- carries both.
DROP FUNCTION IF EXISTS public.patch_shared_scene(TEXT, UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.patch_shared_scene(TEXT, UUID, TEXT, TEXT, TEXT, TEXT);
CREATE FUNCTION public.patch_shared_scene(
  p_token TEXT, p_scene_id UUID,
  p_script_text TEXT DEFAULT NULL,
  p_scene_description TEXT DEFAULT NULL,
  p_thumbnail_data TEXT DEFAULT NULL,
  p_thumbnail_path TEXT DEFAULT NULL)
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
  UPDATE script_scenes SET
    script_text       = coalesce(p_script_text, script_text),
    scene_description = coalesce(p_scene_description, scene_description),
    thumbnail_data    = CASE WHEN coalesce(p_thumbnail_path, '') <> '' THEN ''
                             ELSE coalesce(p_thumbnail_data, thumbnail_data) END,
    thumbnail_path    = CASE WHEN coalesce(p_thumbnail_data, '') <> '' THEN NULL
                             WHEN p_thumbnail_path IS NULL THEN thumbnail_path
                             WHEN p_thumbnail_path = '' THEN NULL
                             ELSE p_thumbnail_path END
  WHERE id = p_scene_id AND script_id = v_id;
END $$;

REVOKE ALL ON FUNCTION public.get_shared_script_scenes(TEXT) FROM public;
REVOKE ALL ON FUNCTION public.add_shared_scene(TEXT, INTEGER) FROM public;
REVOKE ALL ON FUNCTION public.patch_shared_scene(TEXT, UUID, TEXT, TEXT, TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.get_shared_script_scenes(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_shared_scene(TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.patch_shared_scene(TEXT, UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Verify afterwards (each should return a row / true):
-- SELECT id, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'script-media';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'script_scenes' AND column_name = 'thumbnail_path';
-- SELECT public._valid_thumbnail_path('11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222/33333333-3333-3333-3333-333333333333.jpg'); -- true
-- SELECT public._valid_thumbnail_path('../../etc/passwd');  -- false
-- SELECT count(*) FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE 'script_media_%';  -- 7
