-- ============================================================
-- Arkives — Full Supabase Schema Migration (v2)
-- Fixed: profiles is standalone (no auth.users FK for now)
-- Auth FK will be added later when login is implemented
-- Run this ENTIRE file in Supabase SQL Editor
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (standalone for now — auth FK added later)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL DEFAULT '',
  brand TEXT NOT NULL DEFAULT '',
  entity TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  niche TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PLATFORMS (per-user social media accounts)
-- ============================================================
CREATE TABLE IF NOT EXISTS platforms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  handle TEXT NOT NULL DEFAULT '',
  followers INTEGER NOT NULL DEFAULT 0,
  followers_display TEXT NOT NULL DEFAULT '0',
  engagement_rate NUMERIC(5,2),
  tier TEXT,
  posts INTEGER DEFAULT 0,
  likes TEXT,
  videos INTEGER DEFAULT 0,
  connections INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  status TEXT,
  profile_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform)
);

-- ============================================================
-- RATE CARDS
-- ============================================================
CREATE TABLE IF NOT EXISTS rate_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  rate INTEGER DEFAULT 0,
  rate_range TEXT,
  pct INTEGER,
  platform TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- RATE CARD SETTINGS
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
-- ANALYTICS SNAPSHOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  date DATE NOT NULL,
  followers INTEGER DEFAULT 0,
  subscribers INTEGER DEFAULT 0,
  following INTEGER DEFAULT 0,
  engagement_rate NUMERIC(5,2),
  average_likes INTEGER DEFAULT 0,
  average_comments INTEGER DEFAULT 0,
  likes TEXT,
  likes_num INTEGER DEFAULT 0,
  videos INTEGER DEFAULT 0,
  posts INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  connections INTEGER DEFAULT 0,
  tweets INTEGER DEFAULT 0,
  grade TEXT,
  sb_rank INTEGER,
  followers_rank INTEGER,
  engagement_rank INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform, date)
);

-- ============================================================
-- DEALS
-- ============================================================
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Lead',
  mapped_status TEXT NOT NULL DEFAULT 'Lead',
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
-- DEAL NEGOTIATION HISTORY
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
  priority TEXT NOT NULL DEFAULT 'medium',
  brand TEXT NOT NULL,
  action TEXT NOT NULL,
  deadline TEXT,
  contact TEXT,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  completed BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- LATEST UPDATES
-- ============================================================
CREATE TABLE IF NOT EXISTS latest_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dot TEXT NOT NULL DEFAULT 'blue',
  text TEXT NOT NULL,
  time TEXT,
  priority TEXT NOT NULL DEFAULT 'info',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CONTENT DEADLINES
-- ============================================================
CREATE TABLE IF NOT EXISTS content_deadlines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
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
  invoice_number TEXT NOT NULL,
  brand TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  description TEXT,
  payment_terms TEXT DEFAULT 'net30',
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
  category TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'business',
  vendor TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  type TEXT NOT NULL DEFAULT 'business',
  renewal_info TEXT,
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- NET INCOME
-- ============================================================
CREATE TABLE IF NOT EXISTS net_income (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
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
-- LABOR
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
  template_key TEXT NOT NULL,
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
  type TEXT NOT NULL,
  platform TEXT,
  status TEXT DEFAULT 'draft',
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INBOX ITEMS
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
  date TEXT NOT NULL,
  time TEXT,
  status TEXT DEFAULT 'new',
  category TEXT DEFAULT 'inbound',
  classification TEXT,
  suggested_action TEXT,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- BRAND ALIGNMENT RULES
-- ============================================================
CREATE TABLE IF NOT EXISTS brand_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rule TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CONTRACT RULES
-- ============================================================
CREATE TABLE IF NOT EXISTS contract_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rule TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MONTHLY REVENUE
-- ============================================================
CREATE TABLE IF NOT EXISTS monthly_revenue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  year INTEGER NOT NULL DEFAULT 2026,
  amount INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, month, year)
);

-- ============================================================
-- AUDIENCE DATA
-- ============================================================
CREATE TABLE IF NOT EXISTS audience_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, category)
);

-- ============================================================
-- USER SETTINGS
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
-- ROW-LEVEL SECURITY
-- ============================================================
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

-- Anon access (temporary — allows the app to work before auth is implemented)
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
    EXECUTE format('CREATE POLICY "%s_anon_select" ON %I FOR SELECT TO anon USING (true)', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_anon_insert" ON %I FOR INSERT TO anon WITH CHECK (true)', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_anon_update" ON %I FOR UPDATE TO anon USING (true)', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_anon_delete" ON %I FOR DELETE TO anon USING (true)', tbl, tbl);
  END LOOP;
END $$;


-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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


-- ============================================================
-- ============================================================
-- SEED DATA — Jordan Watkins
-- ============================================================
-- ============================================================

DO $$
DECLARE
  jordan_id UUID;
  d_id UUID;
BEGIN

-- Create Jordan's profile and capture the generated ID
INSERT INTO profiles (name, brand, entity, email, niche)
VALUES ('Jordan Watkins', 'Jordan''s Archives', 'Asterisk LLC', 'jordanss.archives@gmail.com', 'Visual creator, editing education, creative business')
RETURNING id INTO jordan_id;

-- ============================================================
-- PLATFORMS
-- ============================================================
INSERT INTO platforms (user_id, platform, handle, followers, followers_display, engagement_rate, tier, posts, verified, profile_url)
VALUES (jordan_id, 'instagram', '@jordans.archivess', 243489, '243K', 11.71, 'Macro (200K-500K)', 127, true, 'https://instagram.com/jordans.archivess');

INSERT INTO platforms (user_id, platform, handle, followers, followers_display, likes, profile_url)
VALUES (jordan_id, 'tiktok', '@jordans.archives', 28600, '28.6K', '3.6M', 'https://tiktok.com/@jordans.archives');

INSERT INTO platforms (user_id, platform, handle, followers, followers_display, videos, profile_url)
VALUES (jordan_id, 'youtube', '@JordansArchives', 548, '548', 9, 'https://youtube.com/@JordansArchives');

INSERT INTO platforms (user_id, platform, handle, followers, followers_display, status, profile_url)
VALUES (jordan_id, 'twitter', '@jordanarchivess', 2, '2', 'new', 'https://x.com/jordanarchivess');

INSERT INTO platforms (user_id, platform, handle, followers, followers_display, connections, profile_url)
VALUES (jordan_id, 'linkedin', '/in/jordanwatkinss/', 386, '386', 380, 'https://linkedin.com/in/jordanwatkinss/');

-- ============================================================
-- RATE CARD SETTINGS
-- ============================================================
INSERT INTO rate_card_settings (user_id, minimum_rate, pricing_rule)
VALUES (jordan_id, 15000, '6% of follower count baseline');

-- ============================================================
-- RATE CARDS
-- ============================================================
INSERT INTO rate_cards (user_id, category, item_id, name, rate, platform, sort_order) VALUES
  (jordan_id, 'organic', 'ig-reel', 'Instagram Reel', 15000, 'ig', 1),
  (jordan_id, 'organic', 'ig-static', 'Instagram Static / Carousel', 10000, 'ig', 2),
  (jordan_id, 'organic', 'ig-stories', 'Instagram Stories (3-pack)', 5000, 'ig', 3),
  (jordan_id, 'ugc', 'ugc-30', 'UGC Video (30s)', 3500, 'ugc', 1),
  (jordan_id, 'ugc', 'ugc-60', 'UGC Video (60s)', 5000, 'ugc', 2),
  (jordan_id, 'ugc', 'ugc-photo', 'UGC Photo Set (5 images)', 2500, 'ugc', 3),
  (jordan_id, 'ugc', 'ugc-hook', 'Additional Hook / CTA', 1000, 'ugc', 4),
  (jordan_id, 'ugc', 'ugc-raw', 'Raw Footage', 1500, 'ugc', 5);

INSERT INTO rate_cards (user_id, category, item_id, name, rate, rate_range, platform, sort_order) VALUES
  (jordan_id, 'tiktok', 'tt-video', 'TikTok Video', 1000, '$500-$1,500', 'tt', 1),
  (jordan_id, 'youtube', 'yt-integration', 'YouTube Integration (60-90s)', 3000, '$1,500-$5,000', 'yt', 1),
  (jordan_id, 'youtube', 'yt-dedicated', 'YouTube Dedicated Video', 6000, '$3,000-$10,000', 'yt', 2),
  (jordan_id, 'youtube', 'yt-shorts', 'YouTube Shorts', 700, '$400-$1,000', 'yt', 3);

INSERT INTO rate_cards (user_id, category, item_id, name, pct, sort_order) VALUES
  (jordan_id, 'addOns', 'license-90', 'Licensing (90 days)', 25, 1),
  (jordan_id, 'addOns', 'license-6mo', 'Licensing (6 months)', 50, 2),
  (jordan_id, 'addOns', 'paid-ads', 'Paid Ad Rights (per month)', 15, 3),
  (jordan_id, 'addOns', 'excl-30', 'Exclusivity (30 days)', 20, 4),
  (jordan_id, 'addOns', 'excl-60', 'Exclusivity (60 days)', 35, 5),
  (jordan_id, 'addOns', 'excl-90', 'Exclusivity (90 days)', 50, 6),
  (jordan_id, 'addOns', 'cross-post', 'Cross-Posting', 30, 7);

INSERT INTO rate_cards (user_id, category, item_id, name, rate, sort_order) VALUES
  (jordan_id, 'bundles', 'bundle-starter', 'Starter: 1 Reel + 1 UGC (30s)', 17000, 1),
  (jordan_id, 'bundles', 'bundle-growth', 'Growth: 1 Reel + 3 UGC (30s)', 22000, 2),
  (jordan_id, 'bundles', 'bundle-ugc3', 'UGC Only: 3 Videos (30s)', 9000, 3),
  (jordan_id, 'bundles', 'bundle-ugc5', 'UGC Only: 5 Videos (30s)', 14000, 4);

-- ============================================================
-- MONTHLY REVENUE
-- ============================================================
INSERT INTO monthly_revenue (user_id, month, year, amount) VALUES
  (jordan_id, 'Jan', 2026, 0),
  (jordan_id, 'Feb', 2026, 10000),
  (jordan_id, 'Mar', 2026, 0);

-- ============================================================
-- NET INCOME
-- ============================================================
INSERT INTO net_income (user_id, month, year, personal_rev, business_rev, total_rev, personal_exp, business_exp, total_exp, personal_pl, business_pl, total_pl) VALUES
  (jordan_id, 'January', 2026, 2165.89, 5891.67, 8057.56, 4107.64, 1901.89, 6009.53, -1941.75, 3989.78, 2048.03),
  (jordan_id, 'February', 2026, 7112.18, 5493.97, 12606.15, 6129.55, 1027.19, 7156.74, 982.63, 4466.78, 5449.41),
  (jordan_id, 'March', 2026, 0, 0, 0, 3162.81, 205.00, 3367.81, -3162.81, -205.00, -3367.81);

-- ============================================================
-- AUDIENCE DATA
-- ============================================================
INSERT INTO audience_data (user_id, category, data) VALUES
  (jordan_id, 'age', '{"18-24": 36.1, "25-34": 49.8, "35-44": 8.9, "45+": 5.2}'),
  (jordan_id, 'gender', '{"Male": 70.5, "Female": 29.5}'),
  (jordan_id, 'topCities', '{"Los Angeles": 5.2, "New York": 4.1, "London": 3.8, "Dallas": 2.4, "Houston": 2.1}'),
  (jordan_id, 'topCountries', '{"United States": 55.4, "United Kingdom": 7.2, "Canada": 5.1, "Australia": 4.3, "Germany": 3.8}');

-- ============================================================
-- SUBSCRIPTIONS — Personal
-- ============================================================
INSERT INTO subscriptions (user_id, name, cost, frequency, type, sort_order) VALUES
  (jordan_id, 'Studio Rent & Utilities', 2000.00, 'monthly', 'personal', 1),
  (jordan_id, 'Phone/Car Insurance', 200.00, 'monthly', 'personal', 2),
  (jordan_id, 'Iphone Payment', 44.00, 'monthly', 'personal', 3),
  (jordan_id, 'Apple Bill', 20.00, 'monthly', 'personal', 4),
  (jordan_id, 'VASA Fitness', 27.50, 'monthly', 'personal', 5),
  (jordan_id, 'Health Insurance', 56.00, 'monthly', 'personal', 6),
  (jordan_id, 'Dental Insurance', 11.00, 'monthly', 'personal', 7),
  (jordan_id, 'Renters Insurance', 15.17, 'monthly', 'personal', 8),
  (jordan_id, 'Adobe Subscription', 31.00, 'monthly', 'personal', 9),
  (jordan_id, 'Instagram Verified', 15.00, 'monthly', 'personal', 10),
  (jordan_id, 'Crunchy Roll', 9.00, 'monthly', 'personal', 11),
  (jordan_id, 'Google Storage', 3.00, 'monthly', 'personal', 12),
  (jordan_id, 'Claude', 20.00, 'monthly', 'personal', 13),
  (jordan_id, 'Netflix', 9.99, 'monthly', 'personal', 14);

INSERT INTO subscriptions (user_id, name, cost, frequency, type, renewal_info, sort_order) VALUES
  (jordan_id, 'Sleep Cycle APP', 30.00, 'yearly', 'personal', 'October', 15),
  (jordan_id, 'GoDaddy Domain', 20.00, 'yearly', 'personal', 'November', 16),
  (jordan_id, 'Amazon Prime', 72.00, 'yearly', 'personal', 'March', 17),
  (jordan_id, 'Ground News', 12.00, 'yearly', 'personal', 'May', 18),
  (jordan_id, 'MaxRewards', 81.00, 'yearly', 'personal', 'July', 19),
  (jordan_id, 'Incogni (Personal)', 104.00, 'yearly', 'personal', 'July', 20),
  (jordan_id, 'Wispr Flow', 144.00, 'yearly', 'personal', 'August', 21);

-- ============================================================
-- SUBSCRIPTIONS — Business
-- ============================================================
INSERT INTO subscriptions (user_id, name, cost, frequency, type, renewal_info, sort_order) VALUES
  (jordan_id, 'Skool (AC)', 99.00, 'monthly', 'business', '5th', 22),
  (jordan_id, 'Skool (VMWJ)', 99.00, 'monthly', 'business', NULL, 23),
  (jordan_id, 'GoHighLevel', 97.00, 'monthly', 'business', '18th', 24),
  (jordan_id, 'Google Workspace x4', 67.20, 'monthly', 'business', '5th', 25),
  (jordan_id, 'HiggsField.ai', 49.00, 'monthly', 'business', '27th', 26),
  (jordan_id, 'Manychat (jordansarchives)', 45.00, 'monthly', 'business', '19th', 27),
  (jordan_id, 'QuickBooks', 35.00, 'monthly', 'business', '18th', 28),
  (jordan_id, 'Manychat (asteriskcreate)', 25.00, 'monthly', 'business', '19th', 29),
  (jordan_id, 'Business Standard - Google', 23.00, 'monthly', 'business', '23rd', 30),
  (jordan_id, 'Gusto x3 contractors', 18.00, 'monthly', 'business', NULL, 31),
  (jordan_id, 'Google Workspace (jordanss.archives)', 9.99, 'monthly', 'business', '23rd', 32),
  (jordan_id, 'X Premium', 8.00, 'monthly', 'business', '11th', 33),
  (jordan_id, 'Eleven Labs', 5.00, 'monthly', 'business', '22nd', 34);

INSERT INTO subscriptions (user_id, name, cost, frequency, type, renewal_info, sort_order) VALUES
  (jordan_id, 'Squarespace: AsteriskCreate', 273.00, 'yearly', 'business', 'March', 35),
  (jordan_id, 'Squarespace: Hand Drawn Animator', 179.00, 'yearly', 'business', 'February', 36),
  (jordan_id, 'Incogni (Business)', 104.00, 'yearly', 'business', 'July', 37),
  (jordan_id, 'Ad Blocker - Paddle.com', 40.00, 'yearly', 'business', 'May', 38),
  (jordan_id, 'CleanMyMac', 34.99, 'yearly', 'business', 'April', 39),
  (jordan_id, 'GoDaddy Domain (Asteriskcreate.com)', 12.17, 'yearly', 'business', 'February', 40),
  (jordan_id, 'GoDaddy Domain (jordanwatkins.xyz)', 11.00, 'yearly', 'business', 'February', 41);

-- ============================================================
-- LABOR
-- ============================================================
INSERT INTO labor (user_id, name, role, salary) VALUES
  (jordan_id, 'Ethan Chene — Video Editor', 'Contractor', 0),
  (jordan_id, 'Jordan Watkins — Founder', 'Founder', 4000.00);

-- ============================================================
-- OUTREACH TEMPLATES
-- ============================================================
INSERT INTO outreach_templates (user_id, template_key, title, body, sort_order) VALUES
  (jordan_id, 'initial', 'Initial Interest (Need More Info)', E'Hi [Name],\n\nThanks for reaching out about a potential collaboration with jordans.archives.\n\nBefore I can provide a quote, I''d love to learn more:\n- What content are you looking for? (Reel, static post, Stories, etc.)\n- What platforms?\n- What''s the timeline?\n- What usage rights do you need?\n\nLooking forward to hearing more about [BRAND]''s vision for this campaign.\n\nBest,\nJordan', 1),
  (jordan_id, 'rates', 'Sending Rates', E'Hi [Name],\n\nThanks for the details on the [CAMPAIGN NAME] campaign.\n\nBased on the scope you described ([DELIVERABLES]), my rate would be $[AMOUNT].\n\nThis includes:\n- [Deliverable 1]\n- [Deliverable 2]\n- [X] rounds of revisions\n- [X] days organic usage\n\nAdditional usage rights or exclusivity can be discussed.\n\nLet me know if you''d like to move forward or if you have questions.\n\nBest,\nJordan', 2),
  (jordan_id, 'counter', 'Countering a Low Offer', E'Hi [Name],\n\nThanks for sharing your budget. Based on the deliverables requested and my current rates, I typically charge $[YOUR RATE] for this scope.\n\nI''d be happy to discuss how we might adjust the deliverables to work within your budget — for example, [suggest alternative: fewer posts, shorter usage, different format].\n\nLet me know what works best for [BRAND].\n\nBest,\nJordan', 3),
  (jordan_id, 'decline', 'Declining (Politely)', E'Hi [Name],\n\nThanks so much for thinking of me for this campaign.\n\nUnfortunately, I''m not able to take on this project at this time [OR: this doesn''t align with my current content direction].\n\nI appreciate you reaching out and wish you the best with the campaign.\n\nBest,\nJordan', 4);

-- ============================================================
-- CAMPAIGN RESULTS
-- ============================================================
INSERT INTO campaign_results (user_id, brand, views, ctr, conversion, revenue) VALUES
  (jordan_id, 'Adobe', 596000, '3.3%', '9.9%', 0),
  (jordan_id, 'Keen Shoes', 776000, '1.1%', '11.1%', 0),
  (jordan_id, 'Altered', 7700000, NULL, '3.3%', 117000);

-- ============================================================
-- BRAND RULES
-- ============================================================
INSERT INTO brand_rules (user_id, rule, category, sort_order) VALUES
  (jordan_id, 'AI tools that ENHANCE creativity: Open to organic', 'ai', 1),
  (jordan_id, 'AI tools that REPLACE creativity: Decline for organic, offer UGC', 'ai', 2),
  (jordan_id, 'All AI organic partnerships focused on Higgsfield', 'ai', 3),
  (jordan_id, 'Product-only offers: Decline or quote paid rates', 'budget', 4),
  (jordan_id, 'Rev-share models: Decline (flat-rate cash only)', 'budget', 5),
  (jordan_id, 'Generic mass outreach: Lower priority, prefer direct', 'general', 6);

-- ============================================================
-- CONTRACT RULES
-- ============================================================
INSERT INTO contract_rules (user_id, rule, sort_order) VALUES
  (jordan_id, 'Sign as Asterisk LLC', 1),
  (jordan_id, '"Content" defined explicitly', 2),
  (jordan_id, 'Creator retains full IP/copyright', 3),
  (jordan_id, '2 revision rounds max', 4),
  (jordan_id, 'Kill fee: 50% standard, 100% on breach', 5),
  (jordan_id, 'Paid media = separate agreement + $5K floor', 6),
  (jordan_id, 'Organic reshare expires 90 days post-term', 7),
  (jordan_id, 'Non-disparagement sunset: 6 months max', 8),
  (jordan_id, 'Dispute resolution: Mediation in Colorado', 9),
  (jordan_id, 'FTC disclosure required on all content', 10);

-- ============================================================
-- DEALS (all 30)
-- ============================================================

-- Stanley
INSERT INTO deals (user_id, brand, status, mapped_status, value, contact, email, agency, campaign, scope, deliverables, term, notes, last_contact, contract_status, invoiced, paid, outstanding, sort_order)
VALUES (jordan_id, 'Stanley', 'SIGNED', 'Active', 30000, 'Jonathan Tsugawa', '', 'Find Community, Inc.', 'Dare to Post', '30-day challenge + Stanley promotion', '1 Reel + 1 Carousel + Stories per month × 3', '90 days (Feb-Apr 2026)', '$10K/month × 3 months. Founding Stanley Partner.', '2026-02-04', 'Signed', 30000, 10000, 20000, 1)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-01-28', 'Added to pipeline, negotiating $15-25K'),
  (d_id, '2026-02-04', 'SIGNED at $30K ($10K/mo × 3)');

-- Perplexity
INSERT INTO deals (user_id, brand, status, mapped_status, value, contact, email, agency, campaign, scope, deliverables, term, notes, last_contact, contract_status, invoiced, paid, outstanding, sort_order)
VALUES (jordan_id, 'Perplexity', 'Completed', 'Completed', 13000, 'Michelle Dao', 'michelle.dao@perplexity.ai', '', 'Perplexity Computer Launch', '2 UGC hero videos + 8 hook variants for paid ads', '32 total assets', '30 days paid ad usage included', 'COMPLETED. Sreekar approved finals Mar 20. Invoice $13K (NET 30).', '2026-03-20', 'Signed (DocuSign completed)', 13000, 0, 13000, 2)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-02-23', 'Rates sent at $5K/video'),
  (d_id, '2026-03-01', 'Michelle came back to discuss bundle'),
  (d_id, '2026-03-05', 'Countered at $20K for expedited timeline'),
  (d_id, '2026-03-08', 'ACCEPTED at $13K for 2 concepts + 8 hooks'),
  (d_id, '2026-03-10', 'DocuSign SIGNED. Drafts submitted.'),
  (d_id, '2026-03-12', 'Vertical versions uploaded.'),
  (d_id, '2026-03-14', 'Sreekar flagged finance misalignment.'),
  (d_id, '2026-03-16', 'Jordan improvised script, sent preview.'),
  (d_id, '2026-03-17', 'Sreekar approved. Green light to film finals.'),
  (d_id, '2026-03-18', 'Jordan sent updated hooks. Final drafts due Mar 19.'),
  (d_id, '2026-03-20', 'Sreekar: Awesome. Thanks for everything! FINALS APPROVED.');

-- Higgsfield AI
INSERT INTO deals (user_id, brand, status, mapped_status, value, contact, campaign, scope, deliverables, term, notes, last_contact, contract_status, sort_order)
VALUES (jordan_id, 'Higgsfield AI', 'Revised Contract Drafted', 'Contract', 20000, 'Shakhnazar Shayakhmet', 'AI Sustainability for Creatives', '1-2 reels/month, long-term rolling', 'Reel 1 (Feb), Reel 2 & 3 (March)', 'Rolling monthly', '$20K base + $30/1K views above 500K, cap $35K/reel.', '2026-02-12', 'Revised draft ready to send', 3)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-02-01', 'Pitched AI Sustainability campaign'),
  (d_id, '2026-02-10', 'Shakhnazar accepted $20K + performance terms'),
  (d_id, '2026-02-12', 'Revised contract with 16 improvements');

-- Manychat
INSERT INTO deals (user_id, brand, status, mapped_status, value, contact, email, campaign, scope, deliverables, term, notes, last_contact, contract_status, sort_order)
VALUES (jordan_id, 'Manychat', 'Follow-Up Sent', 'Negotiating', 20000, 'Steph Giroux', 'steph.giroux@partner.manychat.com', 'Q2 2026 Partnership', 'Option A: 1 Reel + 1 Story Set ($20K) | Option B: 2 Reels + 2 Story Sets ($35K)', 'TBD based on option', 'Q2 2026', 'Steph OOO until March 15.', '2026-03-05', 'Pending response', 4)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-02-23', 'Rates sent ($20K Option A / $35K Option B)'),
  (d_id, '2026-03-04', 'Follow-up sent, offered call'),
  (d_id, '2026-03-05', 'Steph replied — gathering rates. OOO until Mar 15.');

-- LTX
INSERT INTO deals (user_id, brand, status, mapped_status, value, contact, email, agency, campaign, scope, deliverables, notes, last_contact, sort_order)
VALUES (jordan_id, 'LTX', 'Follow-Up Sent', 'Negotiating', 15000, 'Shakeel Fazul', 'shakeel@smoothmedia.co', 'Smooth Media', 'AI Production Tool', 'Organic creator-led content for enterprise audience', 'TBD — IG/YT options quoted', 'Stefany looped in Shakeel Fazul to discuss rates.', '2026-03-10', 5)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-03-09', 'Sent full rate card with bundles ($15K-$22K)'),
  (d_id, '2026-03-10', 'Stefany escalated to Shakeel Fazul');

-- CapCut
INSERT INTO deals (user_id, brand, status, mapped_status, value, contact, agency, campaign, scope, deliverables, notes, last_contact, sort_order)
VALUES (jordan_id, 'CapCut', 'Rates Sent', 'Rates Sent', 15000, 'Sofia', 'TruemeKOL', 'AI Design Agent', '1 Reel (40s+)', '1 Instagram Reel', 'Quoted $15K, flagged tight timeline.', '2026-03-04', 6)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-03-04', 'Quoted $15K, flagged timeline constraints');

-- Insta360
INSERT INTO deals (user_id, brand, status, mapped_status, value, contact, email, campaign, scope, deliverables, notes, last_contact, contract_status, sort_order)
VALUES (jordan_id, 'Insta360', 'Declined', 'Declined', 0, 'Gina', 'wujing1@insta360.com', 'X5 Camera', 'Product review', '1 Reel', 'DEAD — Gina declined citing limited budget.', '2026-03-10', 'Declined', 7)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-03-04', 'Countered product-only with paid-only ($15K+)'),
  (d_id, '2026-03-10', 'Gina DECLINED — budget too limited');

-- TeraBox
INSERT INTO deals (user_id, brand, status, mapped_status, value, contact, agency, campaign, notes, last_contact, sort_order)
VALUES (jordan_id, 'TeraBox', 'Rates Sent', 'Rates Sent', 15000, 'Kelly', 'GrowMaxValue', 'Cloud Storage', 'Sent full rate card. Mass outreach via BCC.', '2026-03-08', 8)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-03-08', 'Sent rate card ($15K/$10K/$5K)');

-- FLORA
INSERT INTO deals (user_id, brand, status, mapped_status, value, contact, email, campaign, scope, deliverables, notes, last_contact, sort_order)
VALUES (jordan_id, 'FLORA', 'Counter Sent', 'Negotiating', 3500, 'Matthew', 'collab@florafauna.ai', 'Creative Platform', 'UGC', '1 UGC Video', 'Rev-share model — DECLINE recommended.', '2026-03-09', 9)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-03-08', 'Qualifying questions sent'),
  (d_id, '2026-03-09', 'Countered at $3,500 UGC'),
  (d_id, '2026-03-09', 'FLORA counter: $2K flat + $10/user bonus (rev-share).');

-- Milanote
INSERT INTO deals (user_id, brand, status, mapped_status, value, contact, email, campaign, scope, deliverables, term, notes, last_contact, sort_order)
VALUES (jordan_id, 'Milanote', 'Counter Received', 'Negotiating', 15000, 'Blanca Jimenez', 'blanca.jimenez@milanote.com', 'Creative Process Reel', '1x IG Reel + paid usage rights', '1 IG Reel + monthly paid ad usage', 'Before May 2026', '$3K + lifetime PRO for 3mo whitelisting, no reel post required.', '2026-03-17', 10)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-03-08', 'Qualifying questions sent'),
  (d_id, '2026-03-10', 'Blanca sent full brief + asked for rates'),
  (d_id, '2026-03-11', 'Jordan quoted $15K + $2,250/mo paid usage'),
  (d_id, '2026-03-13', 'Blanca countered at $3K + lifetime PRO.'),
  (d_id, '2026-03-17', 'Blanca revised: $3K + lifetime PRO for 3mo whitelisting.');

-- HiDock
INSERT INTO deals (user_id, brand, status, mapped_status, value, contact, email, campaign, scope, deliverables, notes, last_contact, sort_order)
VALUES (jordan_id, 'HiDock', 'Rates Sent', 'Rates Sent', 15000, 'Yasmine', 'yasmine@hidock.com', 'HiDock P1 AI Voice Recorder', 'IG Reel or TikTok', 'TBD based on platform', 'Jordan sent rates. Yasmine requested media kit.', '2026-03-12', 11)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-03-05', 'Qualifying questions sent'),
  (d_id, '2026-03-11', 'Jordan sent rates + audience insights'),
  (d_id, '2026-03-12', 'Yasmine requested media kit');

-- Wondershare
INSERT INTO deals (user_id, brand, status, mapped_status, value, contact, campaign, notes, last_contact, sort_order)
VALUES (jordan_id, 'Wondershare', 'Questions Sent', 'Qualifying', 0, 'Eileen', 'Creative Software Suite', 'Asked for platform, budget, features, timeline.', '2026-03-05', 12);

-- LiberNovo
INSERT INTO deals (user_id, brand, status, mapped_status, value, contact, campaign, notes, last_contact, sort_order)
VALUES (jordan_id, 'LiberNovo', 'Rates Sent', 'Rates Sent', 15000, 'Daisy', 'Omni Chair', 'Sent full rate card. Ergonomic chair collab.', '2026-03-08', 13);

-- Switchyards
INSERT INTO deals (user_id, brand, status, mapped_status, value, contact, email, campaign, scope, notes, last_contact, sort_order)
VALUES (jordan_id, 'Switchyards', 'Meeting Scheduled', 'Qualifying', 0, 'Jack Henry Decker', 'jackhenry@switchyards.com', 'Creator Partnership', 'Partnership discussion — coworking/membership brand', 'Jack has time Tuesday afternoon.', '2026-03-10', 14);

-- Higgsfield/JEEVMEDIA
INSERT INTO deals (user_id, brand, status, mapped_status, value, contact, email, agency, campaign, scope, deliverables, notes, last_contact, contract_status, outstanding, sort_order)
VALUES (jordan_id, 'Higgsfield/JEEVMEDIA', 'Negotiating Direct', 'Negotiating', 20000, 'Aqsa Siddique', 'aqsa@jeevmedia.net', 'JEEVMEDIA', 'Higgsfield.ai Promotion', '1 Instagram Reel + 7-day Link in Bio', '1 IG Reel', 'Jordan held firm at $20K. Transitioning to direct Higgsfield partnership.', '2026-03-16', 'Transitioning to direct partnership', 20000, 15)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-03-09', 'Sent standard rates'),
  (d_id, '2026-03-09', 'JEEVMEDIA countered at $6,000 USD'),
  (d_id, '2026-03-11', 'DEAL LOCKED at $15K.'),
  (d_id, '2026-03-12', 'Jordan held firm at $20K citing brand risk.'),
  (d_id, '2026-03-13', 'Aqsa confirmed Higgsfield team will connect directly.'),
  (d_id, '2026-03-14', 'Higgsfield team via WhatsApp. Garna.io payment onboarding.');

-- Typeless
INSERT INTO deals (user_id, brand, status, mapped_status, value, contact, email, campaign, notes, last_contact, sort_order)
VALUES (jordan_id, 'Typeless', 'Decline', 'Declined', 0, 'Fay Yang', 'fay@typeless.com', 'Voice-to-Text Tool', 'AI writing assistant. DECLINE per Higgsfield exclusivity.', '2026-03-18', 16);

-- MMW/Bassrush
INSERT INTO deals (user_id, brand, status, mapped_status, value, contact, email, agency, campaign, scope, deliverables, notes, last_contact, sort_order)
VALUES (jordan_id, 'MMW/Bassrush', 'Cold', 'Lead', 0, 'David Kim', 'dhk@davidkim.biz', 'DK Projects', 'Miami Music Week Videographer', 'Videographer gig for Bassrush event', 'Event videography', 'Bassrush party Mar 27.', '2026-03-09', 17);

-- MNTN
INSERT INTO deals (user_id, brand, status, mapped_status, value, contact, campaign, notes, last_contact, sort_order)
VALUES (jordan_id, 'MNTN', 'Declined', 'Declined', 0, 'Taylor', 'Connected TV Ads', 'Budget $4-5K — well below $15K minimum.', '2026-03-08', 18);

-- Canva
INSERT INTO deals (user_id, brand, status, mapped_status, value, contact, email, agency, campaign, notes, last_contact, sort_order)
VALUES (jordan_id, 'Canva', 'Declined', 'Declined', 0, 'Addie', 'addie@contentlab.xyz', 'Content Lab', 'Canva Campaign', 'Timeline too tight.', '2026-02-23', 19);

-- congstar
INSERT INTO deals (user_id, brand, status, mapped_status, value, contact, email, agency, campaign, notes, last_contact, sort_order)
VALUES (jordan_id, 'congstar', 'Declined', 'Declined', 0, 'Hannah Lothwesen', 'hannah@justaddsugar.de', 'JUSTADDSUGAR', 'Internet Artists', 'Deal passed.', '2026-01-27', 20);

-- Pixelcut
INSERT INTO deals (user_id, brand, status, mapped_status, value, campaign, notes, last_contact, contract_status, sort_order)
VALUES (jordan_id, 'Pixelcut', 'Completed', 'Completed', 0, 'AI Editing Partnership', 'Completed Jan 2026.', '2026-01-15', 'Complete', 21);

-- Adobe MAX 2025
INSERT INTO deals (user_id, brand, status, mapped_status, value, campaign, notes, last_contact, contract_status, sort_order)
VALUES (jordan_id, 'Adobe MAX 2025', 'Completed', 'Completed', 0, 'Major Event Partnership', 'Major event partnership Oct 2025.', '2025-10-15', 'Complete', 22);

-- GridSocial
INSERT INTO deals (user_id, brand, status, mapped_status, value, contact, email, campaign, notes, last_contact, sort_order)
VALUES (jordan_id, 'GridSocial', 'Cold', 'Lead', 0, 'Lydia', 'lydia_yicheng@gridsocial.net', 'AI Design Software', 'No response since Jan 29.', '2026-01-29', 23);

-- Invideo
INSERT INTO deals (user_id, brand, status, mapped_status, value, contact, email, campaign, notes, last_contact, sort_order)
VALUES (jordan_id, 'Invideo', 'Cold', 'Lead', 0, 'Perpetual Gomes', 'perpetual@invideo.io', 'AI Video Creation', 'UGC proposal sent, no response.', '2026-01-29', 24);

-- Flixier
INSERT INTO deals (user_id, brand, status, mapped_status, value, contact, email, campaign, notes, last_contact, sort_order)
VALUES (jordan_id, 'Flixier', 'Cold', 'Lead', 0, 'Sorina', 'creators@flixier.com', 'Video Editing Tool', 'No response since Jan 27.', '2026-01-27', 25);

-- Suno
INSERT INTO deals (user_id, brand, status, mapped_status, value, contact, email, campaign, scope, deliverables, term, notes, last_contact, sort_order)
VALUES (jordan_id, 'Suno', 'Lead', 'Lead', 1000, 'Elias Nolin', 'elias.nolin@suno.com', 'UGC for AI Music Platform', '2 video concepts/mo + 4 hook variants each', 'UGC ads only (not posted to feed)', 'Monthly, perpetual usage rights', '$1K/mo -- well below $15K minimum. Likely decline.', '2026-03-20', 26)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-03-20', 'Inbound from Elias Nolin. $1K/mo UGC offer.');

-- ============================================================
-- FOLLOW-UPS
-- ============================================================
INSERT INTO follow_ups (user_id, brand, contact, date, note) VALUES
  (jordan_id, 'Perplexity', 'Sreekar / Michelle', '2026-03-20', 'Sreekar APPROVED finals. Invoice $13K (NET 30).'),
  (jordan_id, 'Suno', 'Elias Nolin', '2026-03-20', 'NEW: UGC for AI music. $1K/mo. Likely decline.'),
  (jordan_id, 'Higgsfield/JEEVMEDIA', 'Higgsfield team (WhatsApp)', '2026-03-20', 'Respond on WhatsApp. Finalize at $20K. OVERDUE 6+ days.'),
  (jordan_id, 'Higgsfield/JEEVMEDIA', 'Anshu Prasad', '2026-03-20', 'Complete Garna.io payment onboarding. OVERDUE.'),
  (jordan_id, 'HiDock', 'Yasmine', '2026-03-20', 'Send media kit (OVERDUE 8 days).'),
  (jordan_id, 'Manychat', 'Steph', '2026-03-20', 'Steph back from OOO. No reply 5 days.'),
  (jordan_id, 'FLORA', 'Matthew', '2026-03-20', 'Decline rev-share or offer $3,500 flat.'),
  (jordan_id, 'CapCut', 'Sofia', '2026-03-20', 'No response 16 days. Close deal.'),
  (jordan_id, 'Milanote', 'Blanca', '2026-03-20', '$3K + PRO for whitelisting. Below minimum.'),
  (jordan_id, 'Adobe', 'Ashley Crisp', '2026-03-20', 'Follow-up sent Mar 16. No response.'),
  (jordan_id, 'Wondershare', 'Eileen', '2026-03-20', 'No response 15 days. Consider closing.'),
  (jordan_id, 'TeraBox', 'Kelly', '2026-03-20', 'No response 12 days. Consider closing.'),
  (jordan_id, 'LiberNovo', 'Daisy', '2026-03-20', 'No response 12 days. Consider closing.'),
  (jordan_id, 'LTX', 'Shakeel', '2026-03-20', 'Await Shakeel outreach (10 days).');

-- ============================================================
-- ACTION ITEMS
-- ============================================================
INSERT INTO action_items (user_id, priority, brand, action, deadline, contact, sort_order) VALUES
  (jordan_id, 'urgent', 'Perplexity', 'Sreekar APPROVED finals. Invoice $13K (NET 30).', 'TODAY', 'sreekar@perplexity.ai', 1),
  (jordan_id, 'urgent', 'Stanley', 'Month 2 Reel + Carousel OVERDUE. Submit ASAP.', 'TODAY', '', 2),
  (jordan_id, 'urgent', 'Higgsfield/JEEVMEDIA', 'Check WhatsApp. Finalize scope at $20K. OVERDUE.', 'TODAY', 'aqsa@jeevmedia.net', 3),
  (jordan_id, 'urgent', 'Higgsfield/JEEVMEDIA', 'Complete Garna.io payment onboarding. OVERDUE.', 'TODAY', 'anshu@garna.io', 4),
  (jordan_id, 'high', 'Suno', 'NEW: Elias Nolin UGC offer. $1K/mo. Below minimum. Evaluate.', 'TODAY', 'elias.nolin@suno.com', 5),
  (jordan_id, 'high', 'HiDock', 'Send media kit to Yasmine (OVERDUE 8 days).', 'TODAY', 'yasmine@hidock.com', 6),
  (jordan_id, 'high', 'Manychat', 'Steph back from OOO. No reply 5 days. Follow up or close.', 'TODAY', 'steph.giroux@partner.manychat.com', 7),
  (jordan_id, 'high', 'FLORA', 'Decline rev-share. Offer $3,500 flat or pass.', 'TODAY', 'collab@florafauna.ai', 8),
  (jordan_id, 'high', 'CapCut', 'Sofia no response 16 days. Close deal.', 'TODAY', '', 9),
  (jordan_id, 'medium', 'Milanote', 'Blanca: $3K + PRO for whitelisting. Below minimum.', 'TODAY', 'blanca.jimenez@milanote.com', 10),
  (jordan_id, 'medium', 'Adobe', 'Ashley Crisp follow-up 4 days ago. No response.', 'This week', 'ACrisp@golin.com', 11),
  (jordan_id, 'medium', 'MMW/Bassrush', 'Respond to David Kim about Miami (Mar 27).', 'This week', 'dhk@davidkim.biz', 12),
  (jordan_id, 'medium', 'Weekly Plan', 'Create new weekly plan for 3/16-3/22.', 'TODAY', '', 13),
  (jordan_id, 'low', 'Typeless', 'DECLINE -- AI tool, Higgsfield exclusivity.', 'This week', 'fay@typeless.com', 14),
  (jordan_id, 'low', 'Verdent AI', 'DECLINE -- AI coding tool.', 'This week', 'ppakamy@business.indexgravity.com', 15),
  (jordan_id, 'low', 'Lovart AI', 'DECLINE -- AI design tool. Ignore.', 'This week', 'wqz1016@wkmkt.com', 16),
  (jordan_id, 'low', 'Airlearn', 'Evaluate or decline -- niche mismatch.', 'This week', 'raghvendraraut@unacademy.com', 17);

-- ============================================================
-- CONTENT DEADLINES
-- ============================================================
INSERT INTO content_deadlines (user_id, date, text, brand, sort_order) VALUES
  (jordan_id, '2026-03-20', 'Perplexity -- Invoice $13K.', 'Perplexity', 1),
  (jordan_id, '2026-03-15', 'Stanley -- Month 2 Reel + Carousel OVERDUE.', 'Stanley', 2),
  (jordan_id, '2026-03-14', 'Higgsfield -- WhatsApp outreach, finalize at $20K.', 'Higgsfield', 3),
  (jordan_id, '2026-03-20', 'Higgsfield -- video delivery (pending finalization)', 'Higgsfield', 4),
  (jordan_id, 'ongoing', 'Stanley content -- $10K/mo x 3', 'Stanley', 5);

-- ============================================================
-- LATEST UPDATES
-- ============================================================
INSERT INTO latest_updates (user_id, dot, text, time, priority) VALUES
  (jordan_id, 'green', 'Perplexity -- Sreekar: Awesome. Thanks for everything! FINALS APPROVED.', 'Mar 20, 7:00 AM', 'urgent'),
  (jordan_id, 'green', 'Suno (Elias Nolin) -- NEW INBOUND. $1K/mo UGC. Below minimum.', 'Mar 20, 7:00 AM', 'action'),
  (jordan_id, 'amber', 'Stanley -- Month 2 content OVERDUE (5 days).', 'Mar 20, 7:00 AM', 'urgent'),
  (jordan_id, 'amber', 'Higgsfield/JEEVMEDIA -- WhatsApp no response. OVERDUE.', 'Mar 20, 7:00 AM', 'urgent'),
  (jordan_id, 'amber', 'Manychat -- Steph back from OOO. No reply 5 days.', 'Mar 20, 7:00 AM', 'action'),
  (jordan_id, 'amber', 'HiDock -- Yasmine waiting on media kit (8 days).', 'Mar 20, 7:00 AM', 'action'),
  (jordan_id, 'amber', 'CapCut -- Sofia no response 16 days.', 'Mar 20, 7:00 AM', 'action'),
  (jordan_id, 'red', 'FLORA -- Rev-share. Needs decline reply.', 'Mar 20, 7:00 AM', 'action'),
  (jordan_id, 'blue', 'Instagram 243.5K. TikTok 28.6K.', 'Mar 20, 7:00 AM', 'info'),
  (jordan_id, 'amber', 'Weekly plan expired (5 days overdue).', 'Mar 20, 7:00 AM', 'action');

-- ============================================================
-- CALENDAR EVENTS
-- ============================================================
INSERT INTO calendar_events (user_id, date, brand, type, platform, status) VALUES
  (jordan_id, '2026-03-09', 'Perplexity', 'Scripts', 'ugc', 'draft'),
  (jordan_id, '2026-03-10', 'Perplexity', 'Scripts Due', 'ugc', 'draft'),
  (jordan_id, '2026-03-11', 'Perplexity', 'Drafts Due', 'ugc', 'review'),
  (jordan_id, '2026-03-11', 'Manychat', 'Follow-up', 'ig', 'draft'),
  (jordan_id, '2026-03-12', 'Perplexity', 'Finals Due', 'ugc', 'approved'),
  (jordan_id, '2026-03-15', 'Stanley', 'Month 2 Reel', 'ig', 'draft'),
  (jordan_id, '2026-03-15', 'Stanley', 'Carousel', 'ig', 'draft');

-- ============================================================
-- INBOX ITEMS
-- ============================================================
INSERT INTO inbox_items (user_id, from_name, from_email, brand, subject, preview, date, time, status, suggested_action) VALUES
  (jordan_id, 'Jack Henry Decker', 'jackhenry@switchyards.com', 'Switchyards', 'Re: Creator Partnership', 'Jack is free Tuesday afternoon.', '2026-03-10', '1:30 PM', 'new', 'reply'),
  (jordan_id, 'Aqsa Siddique', 'aqsa@jeevmedia.net', 'Higgsfield/JEEVMEDIA', 'Re: Partnership Rates', 'Aqsa followed up. Budget at $6K.', '2026-03-10', '7:10 AM', 'new', 'counter'),
  (jordan_id, 'Michelle Dao', 'michelle.dao@perplexity.ai', 'Perplexity', 'B-roll + Draft Feedback', 'Michelle sent B-roll. Sreekar left comments.', '2026-03-10', '10:52 AM', 'new', 'reply'),
  (jordan_id, 'Stefany / Shakeel Fazul', 'shakeel@smoothmedia.co', 'LTX/Smooth Media', 'Re: Rate Discussion', 'Stefany looped in Shakeel Fazul.', '2026-03-10', '5:03 PM', 'read', 'follow_up'),
  (jordan_id, 'Matthew', 'collab@florafauna.ai', 'FLORA', 'Re: Counter Offer', 'FLORA countered: $2K flat + $10/user bonus.', '2026-03-09', '9:59 PM', 'new', 'decline'),
  (jordan_id, 'Fay Yang', 'fay@typeless.com', 'Typeless', 'Re: Manager Contact', 'Fay reported Shawn email bounced.', '2026-03-09', '', 'new', 'reply'),
  (jordan_id, 'David Kim', 'dhk@davidkim.biz', 'MMW/Bassrush', 'Miami Music Week Videography', 'David asking about MMW availability Mar 27.', '2026-03-09', '', 'new', 'reply');

END $$;
