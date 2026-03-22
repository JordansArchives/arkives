-- ============================================================
-- Arkives — Temporary Anon Access Policies
-- During migration (before auth is fully implemented),
-- allow anon key to read/write data.
-- These will be REMOVED once auth + service_role key is set up.
-- ============================================================

-- For each table, add a policy that allows anon access when no user is authenticated
-- This is TEMPORARY — remove once auth is live

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'profiles', 'platforms', 'rate_cards', 'rate_card_settings', 'analytics_snapshots',
    'deals', 'deal_history', 'follow_ups', 'action_items', 'latest_updates',
    'content_deadlines', 'invoices', 'expenses', 'subscriptions',
    'net_income', 'labor', 'campaign_results', 'outreach_templates',
    'calendar_events', 'inbox_items', 'brand_rules', 'contract_rules',
    'monthly_revenue', 'audience_data', 'user_settings'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- Allow anon SELECT (read)
    EXECUTE format('CREATE POLICY "%s_anon_select" ON %I FOR SELECT TO anon USING (true)', tbl, tbl);
    -- Allow anon INSERT
    EXECUTE format('CREATE POLICY "%s_anon_insert" ON %I FOR INSERT TO anon WITH CHECK (true)', tbl, tbl);
    -- Allow anon UPDATE
    EXECUTE format('CREATE POLICY "%s_anon_update" ON %I FOR UPDATE TO anon USING (true)', tbl, tbl);
    -- Allow anon DELETE
    EXECUTE format('CREATE POLICY "%s_anon_delete" ON %I FOR DELETE TO anon USING (true)', tbl, tbl);
  END LOOP;
END $$;
