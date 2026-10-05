-- ============================================================
-- Arkives — 024: shared-script thumbnails load for logged-out visitors
--
-- The shared-script storage policies in 021 decide access with a
-- subquery on public.scripts. A policy subquery runs as the CALLER,
-- and scripts is readable only by its owner (008), so for a visitor
-- holding a share link the subquery sees zero rows and every
-- thumbnail download, upload and delete is refused. Same fault 023
-- fixed for boards; this is the scripts half.
--
-- Nothing is broken today: the client still carries thumbnails as
-- data URLs through the share RPCs. The fault bites the day
-- thumbnails move to the script-media bucket, so it is fixed now,
-- while 021's policies are still unused.
--
-- Fix: the lookup moves into a SECURITY DEFINER helper, mirroring
-- _board_share_mode (023). The rules themselves do not change: read
-- while the script is shared (view or edit); write and delete only
-- on an edit-shared script, only inside that script's folder under
-- its owner's folder, and under the 600-object cap.
--
-- The helper answers one question (a script id's share mode) and
-- returns nothing else. Script ids are unguessable UUIDs that reach
-- a visitor only through the token-gated RPCs.
--
-- Idempotent. Safe to run before or after deploying the client.
-- Depends on 008, 018, 021.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public._script_share_mode(p_script TEXT, p_owner TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.share_mode::text FROM public.scripts s
   WHERE s.id::text = p_script
     AND (p_owner IS NULL OR s.user_id::text = p_owner)
   LIMIT 1
$$;
REVOKE ALL ON FUNCTION public._script_share_mode(TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public._script_share_mode(TEXT, TEXT) TO anon, authenticated;

DROP POLICY IF EXISTS "script_media_select_shared" ON storage.objects;
CREATE POLICY "script_media_select_shared" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'script-media'
    AND public._script_share_mode((storage.foldername(name))[2]) IN ('view','edit'));

DROP POLICY IF EXISTS "script_media_insert_shared" ON storage.objects;
CREATE POLICY "script_media_insert_shared" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'script-media'
    AND public._script_share_mode((storage.foldername(name))[2], (storage.foldername(name))[1]) = 'edit'
    AND public._script_object_count((storage.foldername(name))[2]) < 600);

DROP POLICY IF EXISTS "script_media_delete_shared" ON storage.objects;
CREATE POLICY "script_media_delete_shared" ON storage.objects FOR DELETE TO anon, authenticated
  USING (bucket_id = 'script-media'
    AND public._script_share_mode((storage.foldername(name))[2], (storage.foldername(name))[1]) = 'edit');

COMMIT;

-- Verify afterwards:
-- SELECT policyname FROM pg_policies WHERE tablename='objects' AND policyname LIKE 'script_media%shared';   -- 3 rows
-- SELECT public._script_share_mode(id::text) FROM scripts WHERE share_mode <> 'none' LIMIT 1;               -- 'view' or 'edit'
