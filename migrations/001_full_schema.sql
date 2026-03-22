-- ============================================================
-- Arkives — Full Supabase Schema Migration
-- Phase 1: All tables, RLS policies, indexes
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- AUTH: Profiles (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  brand TEXT NOT NULL DEFAULT '',
  entity TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  niche TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- PLATFORMS (per-user social media accounts)
-- ============================================================
CREATE TABLE IF NOT EXISTS platforms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'instagram', 'tiktok', 'youtube', 'twitter', 'linkedin'
  handle TEXT NOT NULL DEFAULT '',
  followers INTEGER NOT NULL DEFAULT 0,
  followers_display TEXT NOT NULL DEFAULT '0', -- "243K"
  engagement_rate NUMERIC(5,2), -- 11.71
  tier TEXT, -- "Macro (200K-500K)"
  posts INTEGER DEFAULT 0,
  likes TEXT, -- "3.6M"
  videos INTEGER DEFAULT 0,
  connections INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  status TEXT, -- "new", "active"
  profile_url TEXT, -- direct link to the profile
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform)
);

-- ============================================================
-- RATE CARDS (per-user pricing)
-- ============================================================
CREATE TABLE IF NOT EXISTS rate_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- 'organic', 'ugc', 'tiktok', 'youtube', 'addOns', 'bundles'
  item_id TEXT NOT NULL, -- 'ig-reel', 'ugc-30', etc.
  name TEXT NOT NULL,
  rate INTEGER DEFAULT 0, -- flat rate in cents? No, keep as dollars for simplicity
  rate_range TEXT, -- "$500-$1,500"
  pct INTEGER, -- for add-ons (percentage)
  platform TEXT, -- 'ig', 'ugc', 'tt', 'yt'
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- RATE CARD SETTINGS (per-user global pricing rules)
-- ============================================================
CREATE TABLE IF NOT EXISTS rate_card_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  minimum_rate INTEGER NOT NULL DEFAULT 15000,
  pricing_rule TEXT NOT NULL DEFAULT '6% of follower count baseline',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- ============================================================
-- ANALYTICS SNAPSHOTS (daily social media metrics)
-- ============================================================
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  date DATE NOT NULL,
  followers INTEGER DEFAULT 0,
  subscribers INTEGER DEFAULT 0, -- YouTube
  following INTEGER DEFAULT 0,
  engagement_rate NUMERIC(5,2),
  average_likes INTEGER DEFAULT 0,
  average_comments INTEGER DEFAULT 0,
  likes TEXT, -- "3.6M" for TikTok
  likes_num INTEGER DEFAULT 0,
  videos INTEGER DEFAULT 0,
  posts INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  connections INTEGER DEFAULT 0, -- LinkedIn
  tweets INTEGER DEFAULT 0, -- Twitter/X
  grade TEXT, -- "B+", "A-"
  sb_rank INTEGER, -- Social Blade rank
  followers_rank INTEGER,
  engagement_rank INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform, date)
);

-- ============================================================
-- DEALS (brand partnerships / pipeline)
-- ============================================================
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Lead', -- raw status from email/user
  mapped_status TEXT NOT NULL DEFAULT 'Lead', -- normalized pipeline stage
  value INTEGER NOT NULL DEFAULT 0,
  contact TEXT,
  email TEXT,
  agency TEXT,
  campaign TEXT,
  scope TEXT,
  deliverables TEXT,
  term TEXT,
  notes TEXT,
  last_contact DATE,
  contract_status TEXT,
  invoiced INTEGER DEFAULT 0,
  paid INTEGER DEFAULT 0,
  outstanding INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- DEAL NEGOTIATION HISTORY (one-to-many from deals)
-- ============================================================
CREATE TABLE IF NOT EXISTS deal_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- FOLLOW-UPS
-- ============================================================
CREATE TABLE IF NOT EXISTS follow_ups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  contact TEXT,
  date DATE NOT NULL,
  note TEXT,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ACTION ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS action_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  priority TEXT NOT NULL DEFAULT 'medium', -- urgent, high, medium, low
  brand TEXT NOT NULL,
  action TEXT NOT NULL,
  deadline TEXT, -- "TODAY", "Mar 20", "This week"
  contact TEXT,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  completed BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- LATEST UPDATES (email scan results / activity feed)
-- ============================================================
CREATE TABLE IF NOT EXISTS latest_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dot TEXT NOT NULL DEFAULT 'blue', -- green, amber, blue, red
  text TEXT NOT NULL,
  time TEXT, -- "Mar 20, 7:00 AM"
  priority TEXT NOT NULL DEFAULT 'info', -- info, action, urgent
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CONTENT DEADLINES
-- ============================================================
CREATE TABLE IF NOT EXISTS content_deadlines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date TEXT NOT NULL, -- "2026-03-20" or "ongoing"
  text TEXT NOT NULL,
  brand TEXT NOT NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  completed BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL, -- "INV-2025001"
  brand TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, sent, paid, overdue
  description TEXT,
  payment_terms TEXT DEFAULT 'net30', -- net15, net30, net45, net60
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- EXPENSES
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  category TEXT NOT NULL, -- HARDWARE, SOFTWARE, AD, GENERAL, TRAVEL, EMPLOYEE, LEASURE, LIVING, GAS, GROCERIES, THERAPY, OTHER
  type TEXT NOT NULL DEFAULT 'business', -- 'personal' or 'business'
  vendor TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SUBSCRIPTIONS (recurring expenses)
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'monthly', -- 'monthly' or 'yearly'
  type TEXT NOT NULL DEFAULT 'business', -- 'personal' or 'business'
  renewal_info TEXT, -- "5th", "October", etc.
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- NET INCOME (monthly financial summaries)
-- ============================================================
CREATE TABLE IF NOT EXISTS net_income (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- "January", "February"
  year INTEGER NOT NULL DEFAULT 2026,
  personal_rev NUMERIC(10,2) DEFAULT 0,
  business_rev NUMERIC(10,2) DEFAULT 0,
  total_rev NUMERIC(10,2) DEFAULT 0,
  personal_exp NUMERIC(10,2) DEFAULT 0,
  business_exp NUMERIC(10,2) DEFAULT 0,
  total_exp NUMERIC(10,2) DEFAULT 0,
  personal_pl NUMERIC(10,2) DEFAULT 0,
  business_pl NUMERIC(10,2) DEFAULT 0,
  total_pl NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, month, year)
);

-- ============================================================
-- LABOR (contractors / team members)
-- ============================================================
CREATE TABLE IF NOT EXISTS labor (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Contractor',
  salary NUMERIC(10,2) DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CAMPAIGN RESULTS
-- ============================================================
CREATE TABLE IF NOT EXISTS campaign_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  views INTEGER DEFAULT 0,
  ctr TEXT,
  conversion TEXT,
  revenue INTEGER DEFAULT 0,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- OUTREACH TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS outreach_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL, -- 'initial', 'rates', 'counter', 'decline'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CALENDAR EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  brand TEXT,
  type TEXT NOT NULL, -- "Scripts Due", "Drafts Due", "Follow-up"
  platform TEXT, -- "ig", "ugc", "tt", "yt"
  status TEXT DEFAULT 'draft', -- "draft", "review", "approved"
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INBOX ITEMS (email threads / communications)
-- ============================================================
CREATE TABLE IF NOT EXISTS inbox_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  from_name TEXT NOT NULL,
  from_email TEXT,
  brand TEXT,
  subject TEXT NOT NULL,
  preview TEXT,
  body TEXT,
  date TEXT NOT NULL, -- "2026-03-09"
  time TEXT, -- "2:42 PM"
  status TEXT DEFAULT 'new', -- 'new', 'read', 'replied', 'archived'
  category TEXT DEFAULT 'inbound', -- 'inbound', 'follow-up', 'internal'
  classification TEXT, -- 'High-Value', 'Standard', 'Low-Priority', 'Decline'
  suggested_action TEXT,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- BRAND ALIGNMENT RULES (per-user deal evaluation criteria)
-- ============================================================
CREATE TABLE IF NOT EXISTS brand_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rule TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general', -- 'ai', 'budget', 'niche', 'general'
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CONTRACT MUST-HAVES (per-user contract requirements)
-- ============================================================
CREATE TABLE IF NOT EXISTS contract_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rule TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MONTHLY REVENUE (for revenue charts)
-- ============================================================
CREATE TABLE IF NOT EXISTS monthly_revenue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- "Jan", "Feb"
  year INTEGER NOT NULL DEFAULT 2026,
  amount INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, month, year)
);

-- ============================================================
-- AUDIENCE DATA (for media kit)
-- ============================================================
CREATE TABLE IF NOT EXISTS audience_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- 'age', 'gender', 'topCities', 'topCountries'
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, category)
);

-- ============================================================
-- USER SETTINGS (general app config per user)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, key)
);


-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_platforms_user ON platforms(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_cards_user ON rate_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_user_date ON analytics_snapshots(user_id, platform, date);
CREATE INDEX IF NOT EXISTS idx_deals_user ON deals(user_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(user_id, mapped_status);
CREATE INDEX IF NOT EXISTS idx_deal_history_deal ON deal_history(deal_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_user ON follow_ups(user_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_date ON follow_ups(user_id, date);
CREATE INDEX IF NOT EXISTS idx_action_items_user ON action_items(user_id);
CREATE INDEX IF NOT EXISTS idx_latest_updates_user ON latest_updates(user_id);
CREATE INDEX IF NOT EXISTS idx_content_deadlines_user ON content_deadlines(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(user_id, date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_net_income_user ON net_income(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_results_user ON campaign_results(user_id);
CREATE INDEX IF NOT EXISTS idx_outreach_templates_user ON outreach_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(user_id, date);
CREATE INDEX IF NOT EXISTS idx_inbox_items_user ON inbox_items(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_revenue_user ON monthly_revenue(user_id);
CREATE INDEX IF NOT EXISTS idx_audience_data_user ON audience_data(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);


-- ============================================================
-- ROW-LEVEL SECURITY (RLS)
-- Users can only access their own data
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_card_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE latest_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE net_income ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE audience_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Helper function for standard RLS policies
-- All other tables: CRUD on own data
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'platforms', 'rate_cards', 'rate_card_settings', 'analytics_snapshots',
    'deals', 'follow_ups', 'action_items', 'latest_updates',
    'content_deadlines', 'invoices', 'expenses', 'subscriptions',
    'net_income', 'labor', 'campaign_results', 'outreach_templates',
    'calendar_events', 'inbox_items', 'brand_rules', 'contract_rules',
    'monthly_revenue', 'audience_data', 'user_settings'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('CREATE POLICY "%s_select_own" ON %I FOR SELECT USING (auth.uid() = user_id)', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_insert_own" ON %I FOR INSERT WITH CHECK (auth.uid() = user_id)', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_update_own" ON %I FOR UPDATE USING (auth.uid() = user_id)', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_delete_own" ON %I FOR DELETE USING (auth.uid() = user_id)', tbl, tbl);
  END LOOP;
END $$;

-- Deal history: access through deal ownership
CREATE POLICY "deal_history_select" ON deal_history FOR SELECT
  USING (EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_history.deal_id AND deals.user_id = auth.uid()));
CREATE POLICY "deal_history_insert" ON deal_history FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_history.deal_id AND deals.user_id = auth.uid()));
CREATE POLICY "deal_history_update" ON deal_history FOR UPDATE
  USING (EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_history.deal_id AND deals.user_id = auth.uid()));
CREATE POLICY "deal_history_delete" ON deal_history FOR DELETE
  USING (EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_history.deal_id AND deals.user_id = auth.uid()));


-- ============================================================
-- SERVICE ROLE BYPASS POLICY
-- For the daily cron / server-side operations
-- The anon key + service_role key can bypass RLS
-- ============================================================
-- Note: Supabase service_role key already bypasses RLS by default.
-- The cron will need to use service_role key or a dedicated API endpoint.


-- ============================================================
-- UPDATED_AT TRIGGER (auto-set updated_at on UPDATE)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables that have it
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'profiles', 'platforms', 'rate_cards', 'rate_card_settings',
    'deals', 'follow_ups', 'action_items', 'content_deadlines',
    'invoices', 'expenses', 'subscriptions', 'net_income', 'labor',
    'campaign_results', 'outreach_templates', 'calendar_events',
    'inbox_items', 'monthly_revenue', 'audience_data', 'user_settings'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', tbl);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', tbl);
  END LOOP;
END $$;
