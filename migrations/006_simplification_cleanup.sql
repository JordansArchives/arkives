-- ============================================================
-- Arkives CRM Simplification — Schema Cleanup
-- Date: 2026-07-01
--
-- This migration drops tables that the simplified frontend no longer uses.
-- Run this in the Supabase SQL Editor for project wqblmehsqcmsdstyweus.
--
-- SAFE to run: none of the kept features (Dashboard, Revenue, Invoices,
-- Contracts, Inbox, Analytics, Scripts, Media Kit, Calendar, Settings)
-- read from these tables anymore.
-- ============================================================

BEGIN;

-- Old dashboard panels (Action Items / Latest Updates / Follow-ups feed)
DROP TABLE IF EXISTS action_items          CASCADE;
DROP TABLE IF EXISTS latest_updates        CASCADE;
DROP TABLE IF EXISTS follow_ups            CASCADE;
DROP TABLE IF EXISTS content_deadlines     CASCADE;

-- Old task manager (weekly plans + parking lot)
DROP TABLE IF EXISTS weekly_tasks          CASCADE;
DROP TABLE IF EXISTS weekly_plans          CASCADE;
DROP TABLE IF EXISTS parking_lot           CASCADE;

-- Old Expenses feature (subscriptions + labor + net_income)
DROP TABLE IF EXISTS subscriptions         CASCADE;
DROP TABLE IF EXISTS labor                 CASCADE;
DROP TABLE IF EXISTS net_income            CASCADE;

-- Old Settings content that's now user_settings-backed or contract-defaults
DROP TABLE IF EXISTS brand_rules           CASCADE;

COMMIT;

-- ============================================================
-- After this runs, the schema goes from 28 → 17 tables.
-- Kept tables (still used by the app):
--   profiles, platforms, rate_cards, rate_card_settings,
--   deals, deal_history, invoices,
--   inbox_items, calendar_events, outreach_templates,
--   scripts, script_scenes,
--   contract_rules, campaign_results, audience_data,
--   monthly_revenue, user_settings
-- ============================================================
