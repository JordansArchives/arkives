-- ============================================================
-- Arkives — 016: Boards (Milanote-style storyboards)
--
-- Free-form idea boards: an endless pannable canvas per board
-- holding sticky notes, text blocks, uploaded images, video
-- links, and freehand pen strokes. Standalone feature (own
-- sidebar tab), not tied to deals.
--
-- Two tables + one private Storage bucket:
--   boards       — one row per board, remembers its viewport
--   board_items  — one row per thing on a board; geometry in
--                  columns, kind-specific payload in JSONB
--   board-media  — Storage bucket for uploaded images. Videos
--                  are links only (storage cost stays near zero).
--
-- Depends on 008 (public.current_profile_id) and 001
-- (update_updated_at trigger function), both applied live.
-- RLS matches the 010 pattern exactly.
--
-- board_items.content by kind:
--   note  {text, color}                      sticky note
--   text  {text, size}                       plain text block
--   image {path, caption, natW, natH}        path = Storage object
--   video {url, caption, provider, vid}      provider: youtube|vimeo|link
--   draw  {points, color, width}             points relative to x/y
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS boards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Board' CHECK (char_length(title) BETWEEN 1 AND 200),
  view_x DOUBLE PRECISION NOT NULL DEFAULT 0,
  view_y DOUBLE PRECISION NOT NULL DEFAULT 0,
  view_zoom DOUBLE PRECISION NOT NULL DEFAULT 1 CHECK (view_zoom BETWEEN 0.05 AND 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boards_user ON boards(user_id);

CREATE TABLE IF NOT EXISTS board_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('note','text','image','video','draw')),
  x DOUBLE PRECISION NOT NULL DEFAULT 0,
  y DOUBLE PRECISION NOT NULL DEFAULT 0,
  w DOUBLE PRECISION NOT NULL DEFAULT 200 CHECK (w BETWEEN 1 AND 20000),
  h DOUBLE PRECISION NOT NULL DEFAULT 200 CHECK (h BETWEEN 1 AND 20000),
  z INTEGER NOT NULL DEFAULT 1,
  content JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_board_items_board ON board_items(board_id);
CREATE INDEX IF NOT EXISTS idx_board_items_user ON board_items(user_id);

-- Same updated_at convention as every other table (001)
DROP TRIGGER IF EXISTS set_updated_at ON boards;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON boards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON board_items;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON board_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE boards ALTER COLUMN user_id SET DEFAULT public.current_profile_id();
ALTER TABLE board_items ALTER COLUMN user_id SET DEFAULT public.current_profile_id();

DROP POLICY IF EXISTS "boards_select_own" ON boards;
DROP POLICY IF EXISTS "boards_insert_own" ON boards;
DROP POLICY IF EXISTS "boards_update_own" ON boards;
DROP POLICY IF EXISTS "boards_delete_own" ON boards;

CREATE POLICY "boards_select_own" ON boards FOR SELECT TO authenticated
  USING (user_id = public.current_profile_id());
CREATE POLICY "boards_insert_own" ON boards FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "boards_update_own" ON boards FOR UPDATE TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "boards_delete_own" ON boards FOR DELETE TO authenticated
  USING (user_id = public.current_profile_id());

DROP POLICY IF EXISTS "board_items_select_own" ON board_items;
DROP POLICY IF EXISTS "board_items_insert_own" ON board_items;
DROP POLICY IF EXISTS "board_items_update_own" ON board_items;
DROP POLICY IF EXISTS "board_items_delete_own" ON board_items;

CREATE POLICY "board_items_select_own" ON board_items FOR SELECT TO authenticated
  USING (user_id = public.current_profile_id());
CREATE POLICY "board_items_insert_own" ON board_items FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "board_items_update_own" ON board_items FOR UPDATE TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "board_items_delete_own" ON board_items FOR DELETE TO authenticated
  USING (user_id = public.current_profile_id());

-- ============================================================
-- Storage: private bucket for board images.
-- Object paths are {profile_id}/{board_id}/{uuid}.{ext}; the
-- folder-name check scopes every operation to the owner, same
-- trust anchor as table RLS (current_profile_id). 10MB cap and
-- image-only MIME types enforced by the bucket itself — the
-- client also downscales before upload, this is the backstop.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('board-media', 'board-media', false, 10485760,
        ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "board_media_select_own" ON storage.objects;
DROP POLICY IF EXISTS "board_media_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "board_media_update_own" ON storage.objects;
DROP POLICY IF EXISTS "board_media_delete_own" ON storage.objects;

CREATE POLICY "board_media_select_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'board-media' AND (storage.foldername(name))[1] = public.current_profile_id()::text);
CREATE POLICY "board_media_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'board-media' AND (storage.foldername(name))[1] = public.current_profile_id()::text);
CREATE POLICY "board_media_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'board-media' AND (storage.foldername(name))[1] = public.current_profile_id()::text);
CREATE POLICY "board_media_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'board-media' AND (storage.foldername(name))[1] = public.current_profile_id()::text);

COMMIT;

-- Verify afterwards:
-- SELECT * FROM pg_policies WHERE tablename IN ('boards','board_items');
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE 'board_media%';
-- SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'board-media';
