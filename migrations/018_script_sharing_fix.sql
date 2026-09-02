-- ============================================================
-- Arkives — 018: Script sharing that actually works logged-out
--
-- Closes the accepted 008 gap: shared script links (#shared/token,
-- #shared/token/edit) have 404'd for logged-out visitors because
-- the app read scripts/script_scenes directly and user-scoped RLS
-- blocks anon. Same medicine as boards (017): SECURITY DEFINER
-- RPCs gated on the share token, granted to anon.
--
-- Scripts have an EDIT link mode, so this adds write RPCs too —
-- every write requires share_mode = 'edit' and only touches rows
-- belonging to the token's script. Owners keep using direct
-- table access; the app routes through these RPCs only in a
-- shared session.
--
-- Also writes down TWO pieces of schema drift: scripts.share_mode
-- exists on live but appears in no migration, and live
-- scripts.share_token is TEXT (007 claims UUID) — hence every
-- p_token here is TEXT compared via share_token::text, which
-- works on both the live TEXT column and a fresh-install UUID one.
--
-- Depends on 007 (scripts, script_scenes, share_token).
-- ============================================================

BEGIN;

-- Drift repair / fresh-install support
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS share_mode TEXT NOT NULL DEFAULT 'none';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scripts_share_mode_check') THEN
    ALTER TABLE scripts ADD CONSTRAINT scripts_share_mode_check
      CHECK (share_mode IN ('none','view','edit'));
  END IF;
END $$;
UPDATE scripts SET share_token = uuid_generate_v4() WHERE share_token IS NULL;

-- ============================================================
-- READ RPCs — valid for 'view' and 'edit' links
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_shared_script(p_token TEXT)
RETURNS TABLE (id UUID, title TEXT, share_mode TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.title, s.share_mode
  FROM scripts s
  WHERE s.share_token::text = p_token AND s.share_mode IN ('view','edit')
$$;

CREATE OR REPLACE FUNCTION public.get_shared_script_scenes(p_token TEXT)
RETURNS TABLE (id UUID, script_id UUID, sort_order INTEGER,
               script_text TEXT, scene_description TEXT, thumbnail_data TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sc.id, sc.script_id, sc.sort_order,
         sc.script_text, sc.scene_description, sc.thumbnail_data
  FROM script_scenes sc
  JOIN scripts s ON s.id = sc.script_id
  WHERE s.share_token::text = p_token AND s.share_mode IN ('view','edit')
  ORDER BY sc.sort_order ASC
$$;

-- ============================================================
-- WRITE RPCs — 'edit' links only. Every function resolves the
-- script by token first; a bad token or a non-edit share raises.
-- New scenes are stamped with the script OWNER's user_id so the
-- owner's RLS keeps seeing them. Size caps are backstops against
-- abuse of a leaked edit link (thumbnails are ~600px JPEG data
-- URLs, well under the cap).
-- ============================================================

CREATE OR REPLACE FUNCTION public._shared_script_id(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  SELECT s.id INTO v_id FROM scripts s
  WHERE s.share_token::text = p_token AND s.share_mode = 'edit';
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'not an editable share link';
  END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.update_shared_script_title(p_token TEXT, p_title TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID := public._shared_script_id(p_token);
BEGIN
  UPDATE scripts SET title = left(coalesce(nullif(trim(p_title), ''), 'Untitled Script'), 300)
  WHERE id = v_id;
END $$;

-- NULL for a field means "leave it unchanged" (empty string is a
-- meaningful value — it clears the field / removes a thumbnail).
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
  IF length(p_script_text) > 100000 OR length(p_scene_description) > 100000
     OR length(p_thumbnail_data) > 3000000 THEN
    RAISE EXCEPTION 'field too large';
  END IF;
  UPDATE script_scenes SET
    script_text       = coalesce(p_script_text, script_text),
    scene_description = coalesce(p_scene_description, scene_description),
    thumbnail_data    = coalesce(p_thumbnail_data, thumbnail_data)
  WHERE id = p_scene_id AND script_id = v_id;
END $$;

CREATE OR REPLACE FUNCTION public.add_shared_scene(p_token TEXT, p_sort_order INTEGER)
RETURNS TABLE (id UUID, script_id UUID, sort_order INTEGER,
               script_text TEXT, scene_description TEXT, thumbnail_data TEXT)
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
            script_scenes.script_text, script_scenes.scene_description, script_scenes.thumbnail_data;
END $$;

CREATE OR REPLACE FUNCTION public.delete_shared_scene(p_token TEXT, p_scene_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID := public._shared_script_id(p_token);
BEGIN
  DELETE FROM script_scenes WHERE id = p_scene_id AND script_id = v_id;
END $$;

CREATE OR REPLACE FUNCTION public.reorder_shared_scenes(p_token TEXT, p_scene_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID := public._shared_script_id(p_token);
BEGIN
  UPDATE script_scenes sc
  SET sort_order = t.ord - 1
  FROM unnest(p_scene_ids) WITH ORDINALITY AS t(sid, ord)
  WHERE sc.id = t.sid AND sc.script_id = v_id;
END $$;

-- Lock down: only anon + authenticated may call, nothing else
REVOKE ALL ON FUNCTION public.get_shared_script(TEXT) FROM public;
REVOKE ALL ON FUNCTION public.get_shared_script_scenes(TEXT) FROM public;
REVOKE ALL ON FUNCTION public._shared_script_id(TEXT) FROM public;
REVOKE ALL ON FUNCTION public.update_shared_script_title(TEXT, TEXT) FROM public;
REVOKE ALL ON FUNCTION public.patch_shared_scene(TEXT, UUID, TEXT, TEXT, TEXT) FROM public;
REVOKE ALL ON FUNCTION public.add_shared_scene(TEXT, INTEGER) FROM public;
REVOKE ALL ON FUNCTION public.delete_shared_scene(TEXT, UUID) FROM public;
REVOKE ALL ON FUNCTION public.reorder_shared_scenes(TEXT, UUID[]) FROM public;

GRANT EXECUTE ON FUNCTION public.get_shared_script(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_script_scenes(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_shared_script_title(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.patch_shared_scene(TEXT, UUID, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_shared_scene(TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_shared_scene(TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_shared_scenes(TEXT, UUID[]) TO anon, authenticated;
-- _shared_script_id stays internal: no anon/authenticated grant needed
-- (SECURITY DEFINER callers run it as the definer).

COMMIT;

-- Verify afterwards:
-- SELECT proname FROM pg_proc WHERE proname LIKE '%shared_scene%' OR proname LIKE '%shared_script%';
-- SELECT column_name FROM information_schema.columns WHERE table_name='scripts' AND column_name='share_mode';
