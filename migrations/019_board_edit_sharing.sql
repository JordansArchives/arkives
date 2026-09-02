-- ============================================================
-- Arkives — 019: Board edit links (anyone with the link can edit)
--
-- Extends 017's view-only board sharing with an 'edit' mode,
-- mirroring how script sharing works after 018. Edit links are
-- #bshared/{token}/edit; the view link keeps working while a
-- board is in edit mode.
--
-- Adds:
--   * 'edit' to boards.share_mode
--   * get_shared_board returns share_mode + user_id (the shared
--     editor needs the owner id to build image upload paths —
--     already public knowledge: it's the first folder of every
--     shared image path)
--   * write RPCs gated on share_mode = 'edit' (add / update /
--     delete board items; new rows stamped with the owner's
--     user_id; size + count caps as leaked-link backstops)
--   * storage INSERT/DELETE policies so shared editors can
--     upload images into, and clean orphans out of, exactly the
--     shared board's folder (bucket still enforces 10MB + image
--     MIME types)
--
-- Depends on 016 + 017.
-- ============================================================

BEGIN;

-- 'edit' joins the allowed share modes (017's check was created inline)
ALTER TABLE boards DROP CONSTRAINT IF EXISTS boards_share_mode_check;
ALTER TABLE boards ADD CONSTRAINT boards_share_mode_check
  CHECK (share_mode IN ('none','view','edit'));

-- ============================================================
-- READ RPCs — return type of get_shared_board changes, so drop first
-- ============================================================

DROP FUNCTION IF EXISTS public.get_shared_board(UUID);
CREATE FUNCTION public.get_shared_board(p_token UUID)
RETURNS TABLE (id UUID, title TEXT, share_mode TEXT, user_id UUID,
               view_x DOUBLE PRECISION, view_y DOUBLE PRECISION, view_zoom DOUBLE PRECISION)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.title, b.share_mode, b.user_id, b.view_x, b.view_y, b.view_zoom
  FROM boards b
  WHERE b.share_token = p_token AND b.share_mode IN ('view','edit')
$$;

CREATE OR REPLACE FUNCTION public.get_shared_board_items(p_token UUID)
RETURNS TABLE (id UUID, kind TEXT, x DOUBLE PRECISION, y DOUBLE PRECISION,
               w DOUBLE PRECISION, h DOUBLE PRECISION, z INTEGER, content JSONB)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.kind, i.x, i.y, i.w, i.h, i.z, i.content
  FROM board_items i
  JOIN boards b ON b.id = i.board_id
  WHERE b.share_token = p_token AND b.share_mode IN ('view','edit')
$$;

-- ============================================================
-- WRITE RPCs — 'edit' links only
-- ============================================================

CREATE OR REPLACE FUNCTION public._shared_board_id(p_token UUID)
RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  SELECT b.id INTO v_id FROM boards b
  WHERE b.share_token = p_token AND b.share_mode = 'edit';
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'not an editable share link';
  END IF;
  RETURN v_id;
END $$;

-- p_id lets the shared editor's undo restore a deleted item under its
-- original id; NULL means "mint a new one".
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
DECLARE v_id UUID := public._shared_board_id(p_token);
BEGIN
  IF length(p_content::text) > 500000 THEN
    RAISE EXCEPTION 'content too large';
  END IF;
  IF (SELECT count(*) FROM board_items i WHERE i.board_id = v_id) >= 2000 THEN
    RAISE EXCEPTION 'item limit reached';
  END IF;
  RETURN QUERY
  INSERT INTO board_items (id, board_id, user_id, kind, x, y, w, h, z, content)
  SELECT coalesce(p_id, uuid_generate_v4()), v_id, b.user_id, p_kind,
         p_x, p_y, p_w, p_h, coalesce(p_z, 1), coalesce(p_content, '{}'::jsonb)
  FROM boards b WHERE b.id = v_id
  RETURNING board_items.id, board_items.board_id, board_items.kind,
            board_items.x, board_items.y, board_items.w, board_items.h,
            board_items.z, board_items.content;
END $$;

-- NULL for a field means "leave it unchanged"
CREATE OR REPLACE FUNCTION public.update_shared_board_item(
  p_token UUID, p_item_id UUID,
  p_x DOUBLE PRECISION DEFAULT NULL, p_y DOUBLE PRECISION DEFAULT NULL,
  p_w DOUBLE PRECISION DEFAULT NULL, p_h DOUBLE PRECISION DEFAULT NULL,
  p_z INTEGER DEFAULT NULL, p_content JSONB DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID := public._shared_board_id(p_token);
BEGIN
  IF length(p_content::text) > 500000 THEN
    RAISE EXCEPTION 'content too large';
  END IF;
  UPDATE board_items SET
    x = coalesce(p_x, x), y = coalesce(p_y, y),
    w = coalesce(p_w, w), h = coalesce(p_h, h),
    z = coalesce(p_z, z), content = coalesce(p_content, content)
  WHERE id = p_item_id AND board_id = v_id;
END $$;

CREATE OR REPLACE FUNCTION public.delete_shared_board_item(p_token UUID, p_item_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID := public._shared_board_id(p_token);
BEGIN
  DELETE FROM board_items WHERE id = p_item_id AND board_id = v_id;
END $$;

REVOKE ALL ON FUNCTION public.get_shared_board(UUID) FROM public;
REVOKE ALL ON FUNCTION public.get_shared_board_items(UUID) FROM public;
REVOKE ALL ON FUNCTION public._shared_board_id(UUID) FROM public;
REVOKE ALL ON FUNCTION public.add_shared_board_item(UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, JSONB, UUID) FROM public;
REVOKE ALL ON FUNCTION public.update_shared_board_item(UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, JSONB) FROM public;
REVOKE ALL ON FUNCTION public.delete_shared_board_item(UUID, UUID) FROM public;

GRANT EXECUTE ON FUNCTION public.get_shared_board(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_board_items(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_shared_board_item(UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, JSONB, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_shared_board_item(UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_shared_board_item(UUID, UUID) TO anon, authenticated;

-- ============================================================
-- Storage: shared-board policies follow the mode change.
-- SELECT: view + edit. INSERT/DELETE: edit only, and only into
-- the shared board's own folder under its owner's folder.
-- ============================================================

DROP POLICY IF EXISTS "board_media_select_shared" ON storage.objects;
CREATE POLICY "board_media_select_shared" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'board-media' AND EXISTS (
    SELECT 1 FROM public.boards b
    WHERE b.id::text = (storage.foldername(name))[2]
      AND b.share_mode IN ('view','edit')
  ));

DROP POLICY IF EXISTS "board_media_insert_shared" ON storage.objects;
CREATE POLICY "board_media_insert_shared" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'board-media' AND EXISTS (
    SELECT 1 FROM public.boards b
    WHERE b.id::text = (storage.foldername(name))[2]
      AND b.user_id::text = (storage.foldername(name))[1]
      AND b.share_mode = 'edit'
  ));

DROP POLICY IF EXISTS "board_media_delete_shared" ON storage.objects;
CREATE POLICY "board_media_delete_shared" ON storage.objects FOR DELETE TO anon, authenticated
  USING (bucket_id = 'board-media' AND EXISTS (
    SELECT 1 FROM public.boards b
    WHERE b.id::text = (storage.foldername(name))[2]
      AND b.user_id::text = (storage.foldername(name))[1]
      AND b.share_mode = 'edit'
  ));

COMMIT;

-- Verify afterwards:
-- SELECT proname FROM pg_proc WHERE proname LIKE '%shared_board%';
-- SELECT policyname FROM pg_policies WHERE tablename='objects' AND policyname LIKE 'board_media%';
