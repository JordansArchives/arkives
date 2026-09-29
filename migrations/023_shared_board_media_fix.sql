-- ============================================================
-- Arkives — 023: shared-board images load for logged-out visitors
--
-- The shared-board storage policies (017, 019, 020) decided access
-- with a subquery on public.boards. A policy subquery runs as the
-- CALLER, and boards is readable only by its owner (016), so for a
-- visitor holding a share link the subquery saw zero rows and every
-- image download was refused. Storage reports a refusal as
-- "Object not found", which is why shared boards showed grey frames.
-- Edit links had the same fault on upload and delete.
--
-- Fix: the lookup moves into a SECURITY DEFINER helper, the same
-- pattern 020 uses for _board_object_count. The rules themselves do
-- not change: read while the board is shared (view or edit); write
-- and delete only on an edit-shared board, only inside that board's
-- folder under its owner's folder, and under the 500-object cap.
--
-- The helper answers one question (a board id's share mode) and
-- returns nothing else. Board ids are unguessable UUIDs that reach a
-- visitor only through the token-gated RPCs.
--
-- Idempotent. Safe to run before or after deploying the client.
-- Depends on 016, 017, 019, 020.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public._board_share_mode(p_board TEXT, p_owner TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.share_mode::text FROM public.boards b
   WHERE b.id::text = p_board
     AND (p_owner IS NULL OR b.user_id::text = p_owner)
   LIMIT 1
$$;
REVOKE ALL ON FUNCTION public._board_share_mode(TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public._board_share_mode(TEXT, TEXT) TO anon, authenticated;

DROP POLICY IF EXISTS "board_media_select_shared" ON storage.objects;
CREATE POLICY "board_media_select_shared" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'board-media'
    AND public._board_share_mode((storage.foldername(name))[2]) IN ('view','edit'));

DROP POLICY IF EXISTS "board_media_insert_shared" ON storage.objects;
CREATE POLICY "board_media_insert_shared" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'board-media'
    AND public._board_share_mode((storage.foldername(name))[2], (storage.foldername(name))[1]) = 'edit'
    AND public._board_object_count((storage.foldername(name))[2]) < 500);

DROP POLICY IF EXISTS "board_media_delete_shared" ON storage.objects;
CREATE POLICY "board_media_delete_shared" ON storage.objects FOR DELETE TO anon, authenticated
  USING (bucket_id = 'board-media'
    AND public._board_share_mode((storage.foldername(name))[2], (storage.foldername(name))[1]) = 'edit');

COMMIT;

-- Verify afterwards:
-- SELECT policyname FROM pg_policies WHERE tablename='objects' AND policyname LIKE 'board_media%shared';   -- 3 rows
-- SELECT public._board_share_mode(id::text) FROM boards WHERE share_mode <> 'none' LIMIT 1;               -- 'view' or 'edit'
-- Then open a shared board link in a private window: the images load.
