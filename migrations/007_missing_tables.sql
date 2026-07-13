-- ============================================================
-- Arkives — 007: Missing tables (schema drift fix)
-- weekly_plans, weekly_tasks, parking_lot, scripts, script_scenes
-- exist in the live DB (created via dashboard) but in no migration.
-- This makes them reproducible AND adds user_id for multi-tenancy.
--
-- Safe to run on the live DB: CREATE TABLE IF NOT EXISTS is a no-op
-- where the table exists; ADD COLUMN IF NOT EXISTS fills the gaps.
-- RUN ORDER: 007 first, then 008 (RLS policies cover these tables).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- WEEKLY PLANS
-- ============================================================
CREATE TABLE IF NOT EXISTS weekly_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  week_label TEXT NOT NULL DEFAULT '',
  week_start DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE weekly_plans ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- ============================================================
-- WEEKLY TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS weekly_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID REFERENCES weekly_plans(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  day TEXT,
  priority TEXT,
  time_estimate TEXT,
  done BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE weekly_tasks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- ============================================================
-- PARKING LOT
-- ============================================================
CREATE TABLE IF NOT EXISTS parking_lot (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  task TEXT NOT NULL DEFAULT '',
  priority TEXT,
  project TEXT,
  done BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE parking_lot ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- ============================================================
-- SCRIPTS
-- ============================================================
CREATE TABLE IF NOT EXISTS scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Script',
  share_token UUID UNIQUE DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- ============================================================
-- SCRIPT SCENES
-- ============================================================
CREATE TABLE IF NOT EXISTS script_scenes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  script_id UUID REFERENCES scripts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  script_text TEXT NOT NULL DEFAULT '',
  scene_description TEXT NOT NULL DEFAULT '',
  thumbnail_data TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE script_scenes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_weekly_plans_user ON weekly_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_tasks_user ON weekly_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_tasks_plan ON weekly_tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_parking_lot_user ON parking_lot(user_id);
CREATE INDEX IF NOT EXISTS idx_scripts_user ON scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_script_scenes_user ON script_scenes(user_id);
CREATE INDEX IF NOT EXISTS idx_script_scenes_script ON script_scenes(script_id);

-- NOTE (2026-07-13): this file was applied to the live DB under the
-- name 006_missing_tables.sql, then renumbered to 007 when the
-- July-1 simplification cleanup claimed the 006 slot. Same content.
