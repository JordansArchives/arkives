-- ============================================================
-- Arkives — Seed Data for Jordan Watkins
-- Migrates all static data from app.js into Supabase tables
-- ============================================================

-- Use a fixed UUID for Jordan's profile during migration
-- This will be replaced by auth.uid() once auth is set up
DO $$
DECLARE
  jordan_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN

-- ============================================================
-- PROFILE
-- ============================================================
INSERT INTO profiles (id, name, brand, entity, email, niche)
VALUES (jordan_id, 'Jordan Watkins', 'Jordan''s Archives', 'Asterisk LLC', 'jordanss.archives@gmail.com', 'Visual creator, editing education, creative business')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, brand = EXCLUDED.brand, entity = EXCLUDED.entity,
  email = EXCLUDED.email, niche = EXCLUDED.niche;

-- ============================================================
-- PLATFORMS
-- ============================================================
INSERT INTO platforms (user_id, platform, handle, followers, followers_display, engagement_rate, tier, posts, verified, profile_url)
VALUES (jordan_id, 'instagram', '@jordans.archivess', 243489, '243K', 11.71, 'Macro (200K-500K)', 127, true, 'https://instagram.com/jordans.archivess')
ON CONFLICT (user_id, platform) DO UPDATE SET
  followers = EXCLUDED.followers, followers_display = EXCLUDED.followers_display,
  engagement_rate = EXCLUDED.engagement_rate, posts = EXCLUDED.posts;

INSERT INTO platforms (user_id, platform, handle, followers, followers_display, likes, profile_url)
VALUES (jordan_id, 'tiktok', '@jordans.archives', 28600, '28.6K', '3.6M', 'https://tiktok.com/@jordans.archives')
ON CONFLICT (user_id, platform) DO UPDATE SET
  followers = EXCLUDED.followers, followers_display = EXCLUDED.followers_display, likes = EXCLUDED.likes;

INSERT INTO platforms (user_id, platform, handle, followers, followers_display, videos, profile_url)
VALUES (jordan_id, 'youtube', '@JordansArchives', 548, '548', 0, 'https://youtube.com/@JordansArchives')
ON CONFLICT (user_id, platform) DO UPDATE SET
  followers = EXCLUDED.followers, followers_display = EXCLUDED.followers_display;
UPDATE platforms SET videos = 9 WHERE user_id = jordan_id AND platform = 'youtube';

INSERT INTO platforms (user_id, platform, handle, followers, followers_display, status, profile_url)
VALUES (jordan_id, 'twitter', '@jordanarchivess', 2, '2', 'new', 'https://x.com/jordanarchivess')
ON CONFLICT (user_id, platform) DO UPDATE SET
  followers = EXCLUDED.followers, followers_display = EXCLUDED.followers_display;

INSERT INTO platforms (user_id, platform, handle, followers, followers_display, connections, profile_url)
VALUES (jordan_id, 'linkedin', '/in/jordanwatkinss/', 386, '386', 380, 'https://linkedin.com/in/jordanwatkinss/')
ON CONFLICT (user_id, platform) DO UPDATE SET
  followers = EXCLUDED.followers, followers_display = EXCLUDED.followers_display, connections = EXCLUDED.connections;

-- ============================================================
-- RATE CARD SETTINGS
-- ============================================================
INSERT INTO rate_card_settings (user_id, minimum_rate, pricing_rule)
VALUES (jordan_id, 15000, '6% of follower count baseline')
ON CONFLICT (user_id) DO UPDATE SET
  minimum_rate = EXCLUDED.minimum_rate, pricing_rule = EXCLUDED.pricing_rule;

-- ============================================================
-- RATE CARDS
-- ============================================================
-- Organic
INSERT INTO rate_cards (user_id, category, item_id, name, rate, platform, sort_order) VALUES
  (jordan_id, 'organic', 'ig-reel', 'Instagram Reel', 15000, 'ig', 1),
  (jordan_id, 'organic', 'ig-static', 'Instagram Static / Carousel', 10000, 'ig', 2),
  (jordan_id, 'organic', 'ig-stories', 'Instagram Stories (3-pack)', 5000, 'ig', 3);
-- UGC
INSERT INTO rate_cards (user_id, category, item_id, name, rate, platform, sort_order) VALUES
  (jordan_id, 'ugc', 'ugc-30', 'UGC Video (30s)', 3500, 'ugc', 1),
  (jordan_id, 'ugc', 'ugc-60', 'UGC Video (60s)', 5000, 'ugc', 2),
  (jordan_id, 'ugc', 'ugc-photo', 'UGC Photo Set (5 images)', 2500, 'ugc', 3),
  (jordan_id, 'ugc', 'ugc-hook', 'Additional Hook / CTA', 1000, 'ugc', 4),
  (jordan_id, 'ugc', 'ugc-raw', 'Raw Footage', 1500, 'ugc', 5);
-- TikTok
INSERT INTO rate_cards (user_id, category, item_id, name, rate, rate_range, platform, sort_order) VALUES
  (jordan_id, 'tiktok', 'tt-video', 'TikTok Video', 1000, '$500-$1,500', 'tt', 1);
-- YouTube
INSERT INTO rate_cards (user_id, category, item_id, name, rate, rate_range, platform, sort_order) VALUES
  (jordan_id, 'youtube', 'yt-integration', 'YouTube Integration (60-90s)', 3000, '$1,500-$5,000', 'yt', 1),
  (jordan_id, 'youtube', 'yt-dedicated', 'YouTube Dedicated Video', 6000, '$3,000-$10,000', 'yt', 2),
  (jordan_id, 'youtube', 'yt-shorts', 'YouTube Shorts', 700, '$400-$1,000', 'yt', 3);
-- Add-Ons
INSERT INTO rate_cards (user_id, category, item_id, name, pct, sort_order) VALUES
  (jordan_id, 'addOns', 'license-90', 'Licensing (90 days)', 25, 1),
  (jordan_id, 'addOns', 'license-6mo', 'Licensing (6 months)', 50, 2),
  (jordan_id, 'addOns', 'paid-ads', 'Paid Ad Rights (per month)', 15, 3),
  (jordan_id, 'addOns', 'excl-30', 'Exclusivity (30 days)', 20, 4),
  (jordan_id, 'addOns', 'excl-60', 'Exclusivity (60 days)', 35, 5),
  (jordan_id, 'addOns', 'excl-90', 'Exclusivity (90 days)', 50, 6),
  (jordan_id, 'addOns', 'cross-post', 'Cross-Posting', 30, 7);
-- Bundles
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
  (jordan_id, 'Mar', 2026, 0)
ON CONFLICT (user_id, month, year) DO UPDATE SET amount = EXCLUDED.amount;

-- ============================================================
-- NET INCOME
-- ============================================================
INSERT INTO net_income (user_id, month, year, personal_rev, business_rev, total_rev, personal_exp, business_exp, total_exp, personal_pl, business_pl, total_pl) VALUES
  (jordan_id, 'January', 2026, 2165.89, 5891.67, 8057.56, 4107.64, 1901.89, 6009.53, -1941.75, 3989.78, 2048.03),
  (jordan_id, 'February', 2026, 7112.18, 5493.97, 12606.15, 6129.55, 1027.19, 7156.74, 982.63, 4466.78, 5449.41),
  (jordan_id, 'March', 2026, 0, 0, 0, 3162.81, 205.00, 3367.81, -3162.81, -205.00, -3367.81)
ON CONFLICT (user_id, month, year) DO UPDATE SET
  personal_rev = EXCLUDED.personal_rev, business_rev = EXCLUDED.business_rev, total_rev = EXCLUDED.total_rev,
  personal_exp = EXCLUDED.personal_exp, business_exp = EXCLUDED.business_exp, total_exp = EXCLUDED.total_exp,
  personal_pl = EXCLUDED.personal_pl, business_pl = EXCLUDED.business_pl, total_pl = EXCLUDED.total_pl;

-- ============================================================
-- AUDIENCE DATA (for media kit)
-- ============================================================
INSERT INTO audience_data (user_id, category, data) VALUES
  (jordan_id, 'age', '{"18-24": 36.1, "25-34": 49.8, "35-44": 8.9, "45+": 5.2}'),
  (jordan_id, 'gender', '{"Male": 70.5, "Female": 29.5}'),
  (jordan_id, 'topCities', '{"Los Angeles": 5.2, "New York": 4.1, "London": 3.8, "Dallas": 2.4, "Houston": 2.1}'),
  (jordan_id, 'topCountries', '{"United States": 55.4, "United Kingdom": 7.2, "Canada": 5.1, "Australia": 4.3, "Germany": 3.8}')
ON CONFLICT (user_id, category) DO UPDATE SET data = EXCLUDED.data;

-- ============================================================
-- SUBSCRIPTIONS — Personal Monthly
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
-- Personal Yearly
INSERT INTO subscriptions (user_id, name, cost, frequency, type, renewal_info, sort_order) VALUES
  (jordan_id, 'Sleep Cycle APP', 30.00, 'yearly', 'personal', 'October', 15),
  (jordan_id, 'GoDaddy Domain', 20.00, 'yearly', 'personal', 'November', 16),
  (jordan_id, 'Amazon Prime', 72.00, 'yearly', 'personal', 'March', 17),
  (jordan_id, 'Ground News', 12.00, 'yearly', 'personal', 'May', 18),
  (jordan_id, 'MaxRewards', 81.00, 'yearly', 'personal', 'July', 19),
  (jordan_id, 'Incogni (Personal)', 104.00, 'yearly', 'personal', 'July', 20),
  (jordan_id, 'Wispr Flow', 144.00, 'yearly', 'personal', 'August', 21);

-- ============================================================
-- SUBSCRIPTIONS — Business Monthly
-- ============================================================
INSERT INTO subscriptions (user_id, name, cost, frequency, type, renewal_info, sort_order) VALUES
  (jordan_id, 'Skool (AC)', 99.00, 'monthly', 'business', '5th', 1),
  (jordan_id, 'Skool (VMWJ)', 99.00, 'monthly', 'business', NULL, 2),
  (jordan_id, 'GoHighLevel', 97.00, 'monthly', 'business', '18th', 3),
  (jordan_id, 'Google Workspace x4', 67.20, 'monthly', 'business', '5th', 4),
  (jordan_id, 'HiggsField.ai', 49.00, 'monthly', 'business', '27th', 5),
  (jordan_id, 'Manychat (jordansarchives)', 45.00, 'monthly', 'business', '19th', 6),
  (jordan_id, 'QuickBooks', 35.00, 'monthly', 'business', '18th', 7),
  (jordan_id, 'Manychat (asteriskcreate)', 25.00, 'monthly', 'business', '19th', 8),
  (jordan_id, 'Business Standard - Google', 23.00, 'monthly', 'business', '23rd', 9),
  (jordan_id, 'Gusto x3 contractors', 18.00, 'monthly', 'business', NULL, 10),
  (jordan_id, 'Google Workspace (jordanss.archives)', 9.99, 'monthly', 'business', '23rd', 11),
  (jordan_id, 'X Premium', 8.00, 'monthly', 'business', '11th', 12),
  (jordan_id, 'Eleven Labs', 5.00, 'monthly', 'business', '22nd', 13);
-- Business Yearly
INSERT INTO subscriptions (user_id, name, cost, frequency, type, renewal_info, sort_order) VALUES
  (jordan_id, 'Squarespace: AsteriskCreate', 273.00, 'yearly', 'business', 'March', 14),
  (jordan_id, 'Squarespace: Hand Drawn Animator', 179.00, 'yearly', 'business', 'February', 15),
  (jordan_id, 'Incogni (Business)', 104.00, 'yearly', 'business', 'July', 16),
  (jordan_id, 'Ad Blocker - Paddle.com', 40.00, 'yearly', 'business', 'May', 17),
  (jordan_id, 'CleanMyMac', 34.99, 'yearly', 'business', 'April', 18),
  (jordan_id, 'GoDaddy Domain (Asteriskcreate.com)', 12.17, 'yearly', 'business', 'February', 19),
  (jordan_id, 'GoDaddy Domain (jordanwatkins.xyz)', 11.00, 'yearly', 'business', 'February', 20);

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
-- BRAND ALIGNMENT RULES
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

END $$;
