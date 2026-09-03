-- ============================================================
-- Arkives: read-only live-schema introspection
--
-- Paste the WHOLE file into the Supabase SQL Editor and run it.
-- It is one SELECT (a UNION of sections), so the editor shows a
-- single result grid: one row per section, payload as JSON.
-- Use "Copy as JSON" (or download CSV) and hand the output back.
--
-- It reads catalog views only. It changes nothing.
-- ============================================================

WITH
tables AS (
  SELECT jsonb_agg(jsonb_build_object(
    'table', c.relname,
    'rls_enabled', c.relrowsecurity,
    'rls_forced', c.relforcerowsecurity,
    'live_rows', s.n_live_tup,
    'total_bytes', pg_total_relation_size(c.oid),
    'table_bytes', pg_relation_size(c.oid),
    'toast_bytes', CASE WHEN c.reltoastrelid <> 0 THEN pg_relation_size(c.reltoastrelid) ELSE 0 END
  ) ORDER BY pg_total_relation_size(c.oid) DESC) AS payload
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
  WHERE n.nspname = 'public' AND c.relkind = 'r'
),
columns AS (
  SELECT jsonb_agg(jsonb_build_object(
    'table', table_name,
    'column', column_name,
    'type', CASE WHEN data_type = 'USER-DEFINED' THEN udt_name ELSE data_type END,
    'nullable', is_nullable = 'YES',
    'default', column_default
  ) ORDER BY table_name, ordinal_position) AS payload
  FROM information_schema.columns
  WHERE table_schema = 'public'
),
policies AS (
  SELECT jsonb_agg(jsonb_build_object(
    'table', tablename,
    'policy', policyname,
    'cmd', cmd,
    'roles', roles,
    'permissive', permissive,
    'using', qual,
    'with_check', with_check
  ) ORDER BY tablename, policyname) AS payload
  FROM pg_policies
  WHERE schemaname = 'public'
),
storage_policies AS (
  SELECT jsonb_agg(jsonb_build_object(
    'policy', policyname,
    'cmd', cmd,
    'roles', roles,
    'using', qual,
    'with_check', with_check
  ) ORDER BY policyname) AS payload
  FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
),
buckets AS (
  SELECT jsonb_agg(jsonb_build_object(
    'id', id,
    'public', public,
    'file_size_limit', file_size_limit,
    'allowed_mime_types', allowed_mime_types
  )) AS payload
  FROM storage.buckets
),
storage_usage AS (
  SELECT jsonb_agg(jsonb_build_object(
    'bucket', bucket_id,
    'owner_folder', (storage.foldername(name))[1],
    'objects', cnt,
    'bytes', bytes
  ) ORDER BY bytes DESC) AS payload
  FROM (
    SELECT bucket_id, name, COUNT(*) OVER (PARTITION BY bucket_id, (storage.foldername(name))[1]) AS cnt,
           SUM((metadata->>'size')::bigint) OVER (PARTITION BY bucket_id, (storage.foldername(name))[1]) AS bytes,
           ROW_NUMBER() OVER (PARTITION BY bucket_id, (storage.foldername(name))[1]) AS rn
    FROM storage.objects
  ) x WHERE rn = 1
),
functions AS (
  SELECT jsonb_agg(jsonb_build_object(
    'function', p.proname,
    'args', pg_get_function_identity_arguments(p.oid),
    'security_definer', p.prosecdef,
    'volatility', p.provolatile,
    'config', p.proconfig,
    'language', l.lanname,
    'anon_can_execute', has_function_privilege('anon', p.oid, 'EXECUTE'),
    'authenticated_can_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ) ORDER BY p.proname) AS payload
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_language l ON l.oid = p.prolang
  WHERE n.nspname = 'public'
),
indexes AS (
  SELECT jsonb_agg(jsonb_build_object(
    'table', tablename,
    'index', indexname,
    'def', indexdef
  ) ORDER BY tablename, indexname) AS payload
  FROM pg_indexes
  WHERE schemaname = 'public'
),
triggers AS (
  SELECT jsonb_agg(jsonb_build_object(
    'table', event_object_table,
    'trigger', trigger_name,
    'event', event_manipulation,
    'timing', action_timing,
    'statement', action_statement
  ) ORDER BY event_object_table, trigger_name) AS payload
  FROM information_schema.triggers
  WHERE trigger_schema = 'public'
),
constraints AS (
  SELECT jsonb_agg(jsonb_build_object(
    'table', c.conrelid::regclass::text,
    'constraint', c.conname,
    'type', c.contype,
    'def', pg_get_constraintdef(c.oid)
  ) ORDER BY c.conrelid::regclass::text, c.conname) AS payload
  FROM pg_constraint c
  JOIN pg_namespace n ON n.oid = c.connamespace
  WHERE n.nspname = 'public' AND c.contype IN ('f', 'c', 'u')
),
auth_summary AS (
  SELECT jsonb_build_object(
    'users', (SELECT COUNT(*) FROM auth.users),
    'confirmed_users', (SELECT COUNT(*) FROM auth.users WHERE email_confirmed_at IS NOT NULL),
    'profiles', (SELECT COUNT(*) FROM public.profiles),
    'profiles_linked', (SELECT COUNT(*) FROM public.profiles WHERE auth_user_id IS NOT NULL),
    'user_emails', (SELECT jsonb_agg(email ORDER BY created_at) FROM auth.users)
  ) AS payload
),
scene_thumbs AS (
  SELECT jsonb_build_object(
    'scenes_total', COUNT(*),
    'scenes_with_thumbnail', COUNT(*) FILTER (WHERE COALESCE(thumbnail_data, '') <> ''),
    'thumbnail_bytes_total', COALESCE(SUM(length(thumbnail_data)), 0),
    'thumbnail_bytes_max', COALESCE(MAX(length(thumbnail_data)), 0)
  ) AS payload
  FROM public.script_scenes
),
share_state AS (
  SELECT jsonb_build_object(
    'scripts_by_mode', (SELECT jsonb_object_agg(COALESCE(share_mode, 'null'), n) FROM (SELECT share_mode, COUNT(*) n FROM public.scripts GROUP BY 1) s),
    'boards_by_mode', (SELECT jsonb_object_agg(COALESCE(share_mode, 'null'), n) FROM (SELECT share_mode, COUNT(*) n FROM public.boards GROUP BY 1) b),
    'scripts_share_token_type', (SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'scripts' AND column_name = 'share_token'),
    'boards_share_token_type', (SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'boards' AND column_name = 'share_token')
  ) AS payload
)
SELECT 'tables' AS section, payload FROM tables
UNION ALL SELECT 'columns', payload FROM columns
UNION ALL SELECT 'policies', payload FROM policies
UNION ALL SELECT 'storage_policies', payload FROM storage_policies
UNION ALL SELECT 'buckets', payload FROM buckets
UNION ALL SELECT 'storage_usage', payload FROM storage_usage
UNION ALL SELECT 'functions', payload FROM functions
UNION ALL SELECT 'indexes', payload FROM indexes
UNION ALL SELECT 'triggers', payload FROM triggers
UNION ALL SELECT 'constraints', payload FROM constraints
UNION ALL SELECT 'auth_summary', payload FROM auth_summary
UNION ALL SELECT 'scene_thumbnails', payload FROM scene_thumbs
UNION ALL SELECT 'share_state', payload FROM share_state;
