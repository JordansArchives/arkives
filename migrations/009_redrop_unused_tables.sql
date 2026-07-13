-- ============================================================
-- Arkives — 009: Re-drop tables the simplified app no longer uses
--
-- WHY THIS EXISTS: the July-1 simplification (006) dropped these 11
-- tables from the live DB. On 2026-07-13, while fixing schema drift,
-- 001 was re-run to recreate the then-missing follow_ups table and it
-- recreated all 11 dropped tables as empty shells (007 then added
-- weekly/parking tables back too). This migration re-drops them so
-- the schema matches the simplified app again: 17 working tables
-- plus profiles.
--
-- SAFE: all of these are empty (recreated 2026-07-13, never written).
-- The kept tables (profiles, platforms, rate_cards, rate_card_settings,
-- deals, deal_history, invoices, inbox_items, calendar_events,
-- outreach_templates, scripts, script_scenes, contract_rules,
-- campaign_results, audience_data, monthly_revenue, user_settings,
-- expenses, analytics_snapshots) are untouched.
-- ============================================================

BEGIN;

DROP TABLE IF EXISTS action_items          CASCADE;
DROP TABLE IF EXISTS latest_updates        CASCADE;
DROP TABLE IF EXISTS follow_ups            CASCADE;
DROP TABLE IF EXISTS content_deadlines     CASCADE;
DROP TABLE IF EXISTS weekly_tasks          CASCADE;
DROP TABLE IF EXISTS weekly_plans          CASCADE;
DROP TABLE IF EXISTS parking_lot           CASCADE;
DROP TABLE IF EXISTS subscriptions         CASCADE;
DROP TABLE IF EXISTS labor                 CASCADE;
DROP TABLE IF EXISTS net_income            CASCADE;
DROP TABLE IF EXISTS brand_rules           CASCADE;

COMMIT;

-- Verify afterwards:
-- SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
