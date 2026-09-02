-- ============================================================
-- Arkives — 017: Board sharing (public view links)
--
-- "Anyone with the link" sharing for Boards, view-only. Unlike
-- the scripts share path (which still 404s for logged-out
-- visitors — the accepted 008 gap), boards get the real thing:
-- SECURITY DEFINER RPCs gated on the share token, callable by
-- anon, plus an anon read policy on board-media images that only
-- opens up while a board is actively shared.
--
-- boards gains:
--   share_token UUID  — stable unguessable token (like scripts 007)
--   share_mode  TEXT  — 'none' (default) | 'view'
--
-- The link is #bshared/{share_token}. Flipping share_mode back to
-- 'none' kills the link AND the image access instantly; the token
-- survives so re-sharing restores the same URL.
--
-- Depends on 016 (boards, board_items, board-media bucket).
-- ============================================================

BEGIN;

ALTER TABLE boards ADD COLUMN IF NOT EXISTS share_token UUID UNIQUE DEFAULT uuid_generate_v4();
ALTER TABLE boards ADD COLUMN IF NOT EXISTS share_mode TEXT NOT NULL DEFAULT 'none'
  CHECK (share_mode IN ('none','view'));

-- Backfill tokens for boards created before this migration
UPDATE boards SET share_token = uuid_generate_v4() WHERE share_token IS NULL;

-- ============================================================
-- RPCs: token-gated reads for logged-out visitors.
-- SECURITY DEFINER bypasses RLS; the WHERE clause is the gate —
-- rows come back only for a matching token on a board that is
-- actively shared. Returned columns are the minimum the shared
-- view needs (no user_id, no created/updated timestamps).
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_shared_board(p_token UUID)
RETURNS TABLE (id UUID, title TEXT, view_x DOUBLE PRECISION, view_y DOUBLE PRECISION, view_zoom DOUBLE PRECISION)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.title, b.view_x, b.view_y, b.view_zoom
  FROM boards b
  WHERE b.share_token = p_token AND b.share_mode = 'view'
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
  WHERE b.share_token = p_token AND b.share_mode = 'view'
$$;

REVOKE ALL ON FUNCTION public.get_shared_board(UUID) FROM public;
REVOKE ALL ON FUNCTION public.get_shared_board_items(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.get_shared_board(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_board_items(UUID) TO anon, authenticated;

-- ============================================================
-- Storage: let shared-board images be read without a login.
-- Object paths are {profile_id}/{board_id}/{uuid}.{ext} —
-- foldername[2] is the board id. The policy opens SELECT only
-- while that board's share_mode is 'view', and the paths
-- themselves are unguessable (two UUIDs deep) and only served
-- to visitors via the token-gated RPC above.
-- ============================================================

DROP POLICY IF EXISTS "board_media_select_shared" ON storage.objects;
CREATE POLICY "board_media_select_shared" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'board-media' AND EXISTS (
    SELECT 1 FROM public.boards b
    WHERE b.id::text = (storage.foldername(name))[2]
      AND b.share_mode = 'view'
  ));

COMMIT;

-- Verify afterwards:
-- SELECT column_name FROM information_schema.columns WHERE table_name='boards' AND column_name LIKE 'share%';
-- SELECT proname FROM pg_proc WHERE proname LIKE 'get_shared_board%';
-- SELECT policyname FROM pg_policies WHERE tablename='objects' AND policyname LIKE 'board_media%';
