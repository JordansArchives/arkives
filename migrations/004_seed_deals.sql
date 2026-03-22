-- ============================================================
-- Arkives — Seed Deals + Follow-ups + Action Items + Content Deadlines
-- ============================================================

DO $$
DECLARE
  jordan_id UUID := '00000000-0000-0000-0000-000000000001';
  d_id UUID;
BEGIN

-- ============================================================
-- DEALS
-- ============================================================

-- Stanley
INSERT INTO deals (id, user_id, brand, status, mapped_status, value, contact, email, agency, campaign, scope, deliverables, term, notes, last_contact, contract_status, invoiced, paid, outstanding, sort_order)
VALUES (uuid_generate_v4(), jordan_id, 'Stanley', 'SIGNED', 'Active', 30000, 'Jonathan Tsugawa', '', 'Find Community, Inc.', 'Dare to Post', '30-day challenge + Stanley promotion', '1 Reel + 1 Carousel + Stories per month × 3', '90 days (Feb-Apr 2026)', '$10K/month × 3 months. Founding Stanley Partner. Content requires written approval.', '2026-02-04', 'Signed', 30000, 10000, 20000, 1)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-01-28', 'Added to pipeline, negotiating $15-25K'),
  (d_id, '2026-02-04', 'SIGNED at $30K ($10K/mo × 3)');

-- Perplexity
INSERT INTO deals (id, user_id, brand, status, mapped_status, value, contact, email, agency, campaign, scope, deliverables, term, notes, last_contact, contract_status, invoiced, paid, outstanding, sort_order)
VALUES (uuid_generate_v4(), jordan_id, 'Perplexity', 'Completed', 'Completed', 13000, 'Michelle Dao', 'michelle.dao@perplexity.ai', '', 'Perplexity Computer Launch', '2 UGC hero videos + 8 hook variants for paid ads', '32 total assets (2 concepts x 8 hooks x 2 orientations + extra hook)', '30 days paid ad usage included', 'COMPLETED. Sreekar approved finals Mar 20. All deliverables uploaded. Invoice $13K (NET 30).', '2026-03-20', 'Signed (DocuSign completed)', 13000, 0, 13000, 2)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-02-23', 'Rates sent at $5K/video'),
  (d_id, '2026-03-01', 'Michelle came back to discuss bundle'),
  (d_id, '2026-03-05', 'Countered at $20K for expedited timeline'),
  (d_id, '2026-03-08', 'ACCEPTED at $13K for 2 concepts + 8 hooks'),
  (d_id, '2026-03-10', 'DocuSign SIGNED. Drafts submitted. Sreekar left feedback.'),
  (d_id, '2026-03-12', 'Vertical versions uploaded. Awaiting approval before mass export.'),
  (d_id, '2026-03-14', 'Sreekar flagged finance misalignment, wants call. Active production ongoing.'),
  (d_id, '2026-03-16', 'Jordan improvised script, sent preview + dashboard animation plan.'),
  (d_id, '2026-03-17', 'Sreekar approved. Nitpick on Plaid pronunciation. Green light to film finals.'),
  (d_id, '2026-03-17', 'Jordan reformatting hooks. Final drafts in 1-2 days. Sreekar: 100% aligned.'),
  (d_id, '2026-03-18', 'Jordan sent updated hooks to Sreekar/Michelle. Final drafts due Mar 19.'),
  (d_id, '2026-03-20', 'Sreekar: Awesome. Thanks for everything! FINALS APPROVED. Invoice $13K.');

-- Higgsfield AI
INSERT INTO deals (id, user_id, brand, status, mapped_status, value, contact, email, agency, campaign, scope, deliverables, term, notes, last_contact, contract_status, invoiced, paid, outstanding, sort_order)
VALUES (uuid_generate_v4(), jordan_id, 'Higgsfield AI', 'Revised Contract Drafted', 'Contract', 20000, 'Shakhnazar Shayakhmet', '', '', 'AI Sustainability for Creatives', '1-2 reels/month, long-term rolling', 'Reel 1 (Feb), Reel 2 & 3 (March)', 'Rolling monthly', '$20K base + $30/1K views above 500K, cap $35K/reel. 16 contract improvements drafted.', '2026-02-12', 'Revised draft ready to send', 0, 0, 0, 3)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-02-01', 'Pitched AI Sustainability campaign'),
  (d_id, '2026-02-10', 'Shakhnazar accepted $20K + performance terms'),
  (d_id, '2026-02-12', 'Revised contract with 16 improvements');

-- Manychat
INSERT INTO deals (id, user_id, brand, status, mapped_status, value, contact, email, agency, campaign, scope, deliverables, term, notes, last_contact, contract_status, invoiced, paid, outstanding, sort_order)
VALUES (uuid_generate_v4(), jordan_id, 'Manychat', 'Follow-Up Sent', 'Negotiating', 20000, 'Steph Giroux', 'steph.giroux@partner.manychat.com', '', 'Q2 2026 Partnership', 'Option A: 1 Reel + 1 Story Set ($20K) | Option B: 2 Reels + 2 Story Sets ($35K)', 'TBD based on option', 'Q2 2026', 'Steph OOO until March 15. Genuine Manychat user across both businesses.', '2026-03-05', 'Pending response', 0, 0, 0, 4)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-02-23', 'Rates sent ($20K Option A / $35K Option B)'),
  (d_id, '2026-03-04', 'Follow-up sent, offered call'),
  (d_id, '2026-03-05', 'Steph replied — gathering rates. OOO until Mar 15.');

-- LTX
INSERT INTO deals (id, user_id, brand, status, mapped_status, value, contact, email, agency, campaign, scope, deliverables, term, notes, last_contact, contract_status, invoiced, paid, outstanding, sort_order)
VALUES (uuid_generate_v4(), jordan_id, 'LTX', 'Follow-Up Sent', 'Negotiating', 15000, 'Shakeel Fazul', 'shakeel@smoothmedia.co', 'Smooth Media', 'AI Production Tool', 'Organic creator-led content for enterprise audience', 'TBD — IG/YT options quoted', '', 'Stefany looped in Shakeel Fazul to discuss rates. Q1/Q2 2026 campaign.', '2026-03-10', 'N/A', 0, 0, 0, 5)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-03-09', 'Sent full rate card with bundles ($15K-$22K)'),
  (d_id, '2026-03-10', 'Stefany escalated to Shakeel Fazul for rate discussion');

-- CapCut
INSERT INTO deals (id, user_id, brand, status, mapped_status, value, contact, email, agency, campaign, scope, deliverables, term, notes, last_contact, contract_status, invoiced, paid, outstanding, sort_order)
VALUES (uuid_generate_v4(), jordan_id, 'CapCut', 'Rates Sent', 'Rates Sent', 15000, 'Sofia', '', 'TruemeKOL', 'AI Design Agent', '1 Reel (40s+)', '1 Instagram Reel', '', 'Quoted $15K, flagged tight timeline.', '2026-03-04', 'N/A', 0, 0, 0, 6)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-03-04', 'Quoted $15K, flagged timeline constraints');

-- Insta360
INSERT INTO deals (id, user_id, brand, status, mapped_status, value, contact, email, agency, campaign, scope, deliverables, term, notes, last_contact, contract_status, invoiced, paid, outstanding, sort_order)
VALUES (uuid_generate_v4(), jordan_id, 'Insta360', 'Declined', 'Declined', 0, 'Gina', 'wujing1@insta360.com', '', 'X5 Camera', 'Product review', '1 Reel', '', 'DEAD — Gina declined Mar 10 citing limited budget.', '2026-03-10', 'Declined', 0, 0, 0, 7)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-03-04', 'Countered product-only with paid-only ($15K+)'),
  (d_id, '2026-03-10', 'Gina DECLINED — budget too limited');

-- TeraBox
INSERT INTO deals (id, user_id, brand, status, mapped_status, value, contact, email, agency, campaign, scope, deliverables, term, notes, last_contact, contract_status, invoiced, paid, outstanding, sort_order)
VALUES (uuid_generate_v4(), jordan_id, 'TeraBox', 'Rates Sent', 'Rates Sent', 15000, 'Kelly', '', 'GrowMaxValue', 'Cloud Storage', 'TBD', 'TBD', '', 'Sent full rate card. Mass outreach via BCC — proceed with caution.', '2026-03-08', 'N/A', 0, 0, 0, 8)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-03-08', 'Sent rate card ($15K/$10K/$5K)');

-- FLORA
INSERT INTO deals (id, user_id, brand, status, mapped_status, value, contact, email, agency, campaign, scope, deliverables, term, notes, last_contact, contract_status, invoiced, paid, outstanding, sort_order)
VALUES (uuid_generate_v4(), jordan_id, 'FLORA', 'Counter Sent', 'Negotiating', 3500, 'Matthew', 'collab@florafauna.ai', '', 'Creative Platform', 'UGC', '1 UGC Video', '', 'FLORA countered at $2,000 flat + $10/user bonus. Rev-share model — DECLINE recommended.', '2026-03-09', 'N/A', 0, 0, 0, 9)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-03-08', 'Qualifying questions sent'),
  (d_id, '2026-03-09', 'Countered at $3,500 UGC'),
  (d_id, '2026-03-09', 'FLORA counter: $2K flat + $10/user bonus (rev-share model).');

-- Milanote
INSERT INTO deals (id, user_id, brand, status, mapped_status, value, contact, email, agency, campaign, scope, deliverables, term, notes, last_contact, contract_status, invoiced, paid, outstanding, sort_order)
VALUES (uuid_generate_v4(), jordan_id, 'Milanote', 'Counter Received', 'Negotiating', 15000, 'Blanca Jimenez', 'blanca.jimenez@milanote.com', '', 'Creative Process Reel', '1x IG Reel + paid usage rights (Meta ads)', '1 IG Reel + monthly paid ad usage', 'Before May 2026', 'Blanca revised counter: $3K + lifetime PRO for 3mo whitelisting, no reel post required.', '2026-03-17', 'N/A', 0, 0, 0, 10)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-03-08', 'Qualifying questions sent'),
  (d_id, '2026-03-10', 'Blanca sent full brief + asked for rates'),
  (d_id, '2026-03-11', 'Jordan quoted $15K + $2,250/mo paid usage'),
  (d_id, '2026-03-13', 'Blanca countered at $3K + lifetime PRO.'),
  (d_id, '2026-03-17', 'Blanca revised: $3K + lifetime PRO for 3mo whitelisting, no reel post required.');

-- HiDock
INSERT INTO deals (id, user_id, brand, status, mapped_status, value, contact, email, agency, campaign, scope, deliverables, term, notes, last_contact, contract_status, invoiced, paid, outstanding, sort_order)
VALUES (uuid_generate_v4(), jordan_id, 'HiDock', 'Rates Sent', 'Rates Sent', 15000, 'Yasmine', 'yasmine@hidock.com', '', 'HiDock P1 AI Voice Recorder', 'IG Reel or TikTok (platform TBD)', 'TBD based on platform', '', 'Jordan sent rates + audience overview. Yasmine requested media kit.', '2026-03-12', 'N/A', 0, 0, 0, 11)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-03-05', 'Qualifying questions sent'),
  (d_id, '2026-03-11', 'Jordan sent rates + audience insights'),
  (d_id, '2026-03-12', 'Yasmine requested media kit');

-- Wondershare
INSERT INTO deals (id, user_id, brand, status, mapped_status, value, contact, email, agency, campaign, scope, deliverables, term, notes, last_contact, contract_status, invoiced, paid, outstanding, sort_order)
VALUES (uuid_generate_v4(), jordan_id, 'Wondershare', 'Questions Sent', 'Qualifying', 0, 'Eileen', '', '', 'Creative Software Suite', 'TBD', 'TBD', '', 'Asked for platform priority, budget, features, timeline.', '2026-03-05', 'N/A', 0, 0, 0, 12)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-03-05', 'Qualifying questions sent');

-- LiberNovo
INSERT INTO deals (id, user_id, brand, status, mapped_status, value, contact, email, agency, campaign, scope, deliverables, term, notes, last_contact, contract_status, invoiced, paid, outstanding, sort_order)
VALUES (uuid_generate_v4(), jordan_id, 'LiberNovo', 'Rates Sent', 'Rates Sent', 15000, 'Daisy', '', '', 'Omni Chair', 'TBD', 'TBD', '', 'Sent full rate card. Ergonomic chair collab.', '2026-03-08', 'N/A', 0, 0, 0, 13)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-03-05', 'Initially declined (wrong niche)'),
  (d_id, '2026-03-08', 'Reopened, rates sent ($15K/$10K/$5K)');

-- Switchyards
INSERT INTO deals (id, user_id, brand, status, mapped_status, value, contact, email, agency, campaign, scope, deliverables, term, notes, last_contact, contract_status, invoiced, paid, outstanding, sort_order)
VALUES (uuid_generate_v4(), jordan_id, 'Switchyards', 'Meeting Scheduled', 'Qualifying', 0, 'Jack Henry Decker', 'jackhenry@switchyards.com', '', 'Creator Partnership', 'Partnership discussion — coworking/membership brand', 'TBD', '', 'Jack has time Tuesday afternoon.', '2026-03-10', 'N/A', 0, 0, 0, 14)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-03-09', 'Accepted meeting via Ben Treat intro'),
  (d_id, '2026-03-10', 'Jack replied — free Tuesday afternoon.');

-- Higgsfield/JEEVMEDIA
INSERT INTO deals (id, user_id, brand, status, mapped_status, value, contact, email, agency, campaign, scope, deliverables, term, notes, last_contact, contract_status, invoiced, paid, outstanding, sort_order)
VALUES (uuid_generate_v4(), jordan_id, 'Higgsfield/JEEVMEDIA', 'Negotiating Direct', 'Negotiating', 20000, 'Aqsa Siddique', 'aqsa@jeevmedia.net', 'JEEVMEDIA', 'Higgsfield.ai Promotion', '1 Instagram Reel + 7-day Link in Bio', '1 IG Reel', '', 'Jordan held firm at $20K. Transitioning to direct Higgsfield partnership. Higgsfield team via WhatsApp.', '2026-03-16', 'Transitioning to direct partnership', 0, 0, 20000, 15)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-03-09', 'Sent standard rates ($15K/$10K/$5K + bundles)'),
  (d_id, '2026-03-09', 'JEEVMEDIA countered at $6,000 USD'),
  (d_id, '2026-03-10', 'Aqsa followed up twice'),
  (d_id, '2026-03-11', 'DEAL LOCKED at $15K. Brief + contract sent.'),
  (d_id, '2026-03-11', 'Jordan proposed long-term Higgsfield direct partnership'),
  (d_id, '2026-03-12', 'Jordan held firm at $20K citing brand risk for AI tool promotion.'),
  (d_id, '2026-03-13', 'Aqsa confirmed Higgsfield team will connect directly.'),
  (d_id, '2026-03-14', 'Higgsfield team reached out via WhatsApp. Garna.io payment onboarding.');

-- Typeless
INSERT INTO deals (id, user_id, brand, status, mapped_status, value, contact, email, agency, campaign, scope, deliverables, term, notes, last_contact, contract_status, invoiced, paid, outstanding, sort_order)
VALUES (uuid_generate_v4(), jordan_id, 'Typeless', 'Decline', 'Declined', 0, 'Fay Yang', 'fay@typeless.com', '', 'Voice-to-Text Tool', 'TBD', 'TBD', '', 'AI writing assistant. DECLINE per Higgsfield exclusivity.', '2026-03-18', 'N/A', 0, 0, 0, 16)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-03-08', 'Pointed to manager Shawn'),
  (d_id, '2026-03-09', 'Fay reported Shawn email bounced'),
  (d_id, '2026-03-18', 'Fay followed up again. DECLINE — AI tool conflicts with Higgsfield.');

-- MMW/Bassrush
INSERT INTO deals (id, user_id, brand, status, mapped_status, value, contact, email, agency, campaign, scope, deliverables, term, notes, last_contact, contract_status, invoiced, paid, outstanding, sort_order)
VALUES (uuid_generate_v4(), jordan_id, 'MMW/Bassrush', 'Cold', 'Lead', 0, 'David Kim', 'dhk@davidkim.biz', 'DK Projects', 'Miami Music Week Videographer', 'Videographer gig for Bassrush event at Factory Town, Miami', 'Event videography', '', 'David Kim asked if Jordan will be in Miami for MMW. Bassrush party Mar 27.', '2026-03-09', 'N/A', 0, 0, 0, 17)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-03-09', 'David Kim reached out about MMW videographer gig');

-- MNTN
INSERT INTO deals (id, user_id, brand, status, mapped_status, value, contact, email, agency, campaign, scope, deliverables, term, notes, last_contact, contract_status, invoiced, paid, outstanding, sort_order)
VALUES (uuid_generate_v4(), jordan_id, 'MNTN', 'Declined', 'Declined', 0, 'Taylor', '', '', 'Connected TV Ads', '', '', '', 'Budget $4-5K — well below $15K minimum.', '2026-03-08', 'N/A', 0, 0, 0, 18)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-03-05', 'Quoted $25,350'),
  (d_id, '2026-03-08', 'DECLINED — budget too low');

-- Canva
INSERT INTO deals (user_id, brand, status, mapped_status, value, contact, email, agency, campaign, notes, last_contact, contract_status, sort_order)
VALUES (jordan_id, 'Canva', 'Declined', 'Declined', 0, 'Addie', 'addie@contentlab.xyz', 'Content Lab', 'Canva Campaign', 'Timeline too tight. Left door open for future campaigns.', '2026-02-23', 'N/A', 19);

-- congstar
INSERT INTO deals (user_id, brand, status, mapped_status, value, contact, email, agency, campaign, notes, last_contact, contract_status, sort_order)
VALUES (jordan_id, 'congstar', 'Declined', 'Declined', 0, 'Hannah Lothwesen', 'hannah@justaddsugar.de', 'JUSTADDSUGAR', 'Internet Artists', 'Deal passed — Gmail labeled Declined.', '2026-01-27', 'N/A', 20);

-- Pixelcut
INSERT INTO deals (user_id, brand, status, mapped_status, value, contact, campaign, notes, last_contact, contract_status, sort_order)
VALUES (jordan_id, 'Pixelcut', 'Completed', 'Completed', 0, '', 'AI Editing Partnership', 'Completed Jan 2026.', '2026-01-15', 'Complete', 21);

-- Adobe MAX 2025
INSERT INTO deals (user_id, brand, status, mapped_status, value, contact, campaign, notes, last_contact, contract_status, sort_order)
VALUES (jordan_id, 'Adobe MAX 2025', 'Completed', 'Completed', 0, '', 'Major Event Partnership', 'Major event partnership Oct 2025.', '2025-10-15', 'Complete', 22);

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
INSERT INTO deals (id, user_id, brand, status, mapped_status, value, contact, email, campaign, scope, deliverables, term, notes, last_contact, contract_status, invoiced, paid, outstanding, sort_order)
VALUES (uuid_generate_v4(), jordan_id, 'Suno', 'Lead', 'Lead', 1000, 'Elias Nolin', 'elias.nolin@suno.com', 'UGC for AI Music Platform', '2 video concepts/mo + 4 hook variants each', 'UGC ads only (not posted to feed)', 'Monthly, perpetual usage rights, 12-month ad rights', '$1K/mo -- well below $15K minimum. Perpetual usage rights is a red flag. Likely decline on rate.', '2026-03-20', 'N/A', 0, 0, 0, 26)
RETURNING id INTO d_id;
INSERT INTO deal_history (deal_id, date, text) VALUES
  (d_id, '2026-03-20', 'Inbound from Elias Nolin. $1K/mo UGC offer with perpetual rights.');

-- ============================================================
-- FOLLOW-UPS
-- ============================================================
INSERT INTO follow_ups (user_id, brand, contact, date, note) VALUES
  (jordan_id, 'Perplexity', 'Sreekar / Michelle', '2026-03-20', 'Sreekar APPROVED finals. Confirm all assets delivered. Invoice $13K (NET 30).'),
  (jordan_id, 'Suno', 'Elias Nolin', '2026-03-20', 'NEW: UGC partnership for AI music platform. $1K/mo. Below $15K min. Evaluate or decline.'),
  (jordan_id, 'Higgsfield/JEEVMEDIA', 'Higgsfield team (WhatsApp)', '2026-03-20', 'Respond on WhatsApp and finalize deal terms at $20K. OVERDUE 6+ days.'),
  (jordan_id, 'Higgsfield/JEEVMEDIA', 'Anshu Prasad', '2026-03-20', 'Complete Garna.io payment onboarding. OVERDUE.'),
  (jordan_id, 'HiDock', 'Yasmine', '2026-03-20', 'Send media kit (OVERDUE 8 days since Mar 12). Risk losing deal.'),
  (jordan_id, 'Manychat', 'Steph', '2026-03-20', 'Steph back from OOO since Mar 15. No reply 5 days. Final follow-up or close.'),
  (jordan_id, 'FLORA', 'Matthew', '2026-03-20', 'Decline rev-share or offer $3,500 flat. OVERDUE.'),
  (jordan_id, 'CapCut', 'Sofia', '2026-03-20', 'No response since Mar 4 (16 days). Close deal.'),
  (jordan_id, 'Milanote', 'Blanca', '2026-03-20', '$3K + lifetime PRO for whitelisting. Below minimum -- decide or decline.'),
  (jordan_id, 'Adobe', 'Ashley Crisp', '2026-03-20', 'Follow-up sent Mar 16 (4 days ago). No response.'),
  (jordan_id, 'Wondershare', 'Eileen', '2026-03-20', 'No response since Mar 5 (15 days). Consider closing.'),
  (jordan_id, 'TeraBox', 'Kelly', '2026-03-20', 'No response since Mar 8 (12 days). Consider closing.'),
  (jordan_id, 'LiberNovo', 'Daisy', '2026-03-20', 'No response since Mar 8 (12 days). Consider closing.'),
  (jordan_id, 'LTX', 'Shakeel', '2026-03-20', 'Await Shakeel outreach for rate discussion (10 days).');

-- ============================================================
-- ACTION ITEMS
-- ============================================================
INSERT INTO action_items (user_id, priority, brand, action, deadline, contact, sort_order) VALUES
  (jordan_id, 'urgent', 'Perplexity', 'Sreekar APPROVED finals. Confirm all assets delivered. Invoice $13K (NET 30).', 'TODAY', 'sreekar@perplexity.ai', 1),
  (jordan_id, 'urgent', 'Stanley', 'Month 2 Reel + Carousel OVERDUE (5 days, since Mar 15). Submit ASAP.', 'TODAY', '', 2),
  (jordan_id, 'urgent', 'Higgsfield/JEEVMEDIA', 'Check WhatsApp -- still no response. Finalize scope at $20K. OVERDUE (6+ days).', 'TODAY', 'aqsa@jeevmedia.net', 3),
  (jordan_id, 'urgent', 'Higgsfield/JEEVMEDIA', 'Complete Garna.io payment onboarding. OVERDUE.', 'TODAY', 'anshu@garna.io', 4),
  (jordan_id, 'high', 'Suno', 'NEW INBOUND: Elias Nolin wants UGC for AI music platform. $1K/mo (below $15K min). Evaluate.', 'TODAY', 'elias.nolin@suno.com', 5),
  (jordan_id, 'high', 'HiDock', 'Send media kit to Yasmine (OVERDUE 8 days since Mar 12).', 'TODAY', 'yasmine@hidock.com', 6),
  (jordan_id, 'high', 'Manychat', 'Steph back from OOO since Mar 15. No reply 5 days. Final follow-up or close.', 'TODAY', 'steph.giroux@partner.manychat.com', 7),
  (jordan_id, 'high', 'FLORA', 'Decline rev-share. Offer $3,500 flat UGC only, or pass. OVERDUE.', 'TODAY', 'collab@florafauna.ai', 8),
  (jordan_id, 'high', 'CapCut', 'Sofia no response 16 days. Close deal.', 'TODAY', '', 9),
  (jordan_id, 'medium', 'Milanote', 'Blanca revised: $3K + lifetime PRO for whitelisting. Below minimum.', 'TODAY', 'blanca.jimenez@milanote.com', 10),
  (jordan_id, 'medium', 'Adobe', 'Ashley Crisp follow-up sent Mar 16 (4 days ago). No response.', 'This week', 'ACrisp@golin.com', 11),
  (jordan_id, 'medium', 'MMW/Bassrush', 'Respond to David Kim about Miami availability (Mar 27).', 'This week', 'dhk@davidkim.biz', 12),
  (jordan_id, 'medium', 'Weekly Plan', 'Create new weekly plan for 3/16-3/22. Running on expired plan.', 'TODAY', '', 13),
  (jordan_id, 'low', 'Typeless', 'DECLINE -- AI writing tool, Higgsfield exclusivity.', 'This week', 'fay@typeless.com', 14),
  (jordan_id, 'low', 'Verdent AI', 'DECLINE -- AI coding tool, Higgsfield exclusivity.', 'This week', 'ppakamy@business.indexgravity.com', 15),
  (jordan_id, 'low', 'Lovart AI', 'DECLINE -- AI design tool. Ignore.', 'This week', 'wqz1016@wkmkt.com', 16),
  (jordan_id, 'low', 'Airlearn', 'Evaluate or decline -- language learning app, niche mismatch.', 'This week', 'raghvendraraut@unacademy.com', 17);

-- ============================================================
-- CONTENT DEADLINES
-- ============================================================
INSERT INTO content_deadlines (user_id, date, text, brand, sort_order) VALUES
  (jordan_id, '2026-03-20', 'Perplexity -- Sreekar approved finals. Confirm all assets delivered. Invoice $13K.', 'Perplexity', 1),
  (jordan_id, '2026-03-15', 'Stanley -- Month 2 Reel + Carousel OVERDUE (5 days). Submit ASAP.', 'Stanley', 2),
  (jordan_id, '2026-03-14', 'Higgsfield -- Respond to WhatsApp outreach, finalize scope & payment at $20K.', 'Higgsfield', 3),
  (jordan_id, '2026-03-20', 'Higgsfield -- video delivery (pending finalization)', 'Higgsfield', 4),
  (jordan_id, 'ongoing', 'Stanley content -- $10K/mo x 3', 'Stanley', 5);

-- ============================================================
-- LATEST UPDATES
-- ============================================================
INSERT INTO latest_updates (user_id, dot, text, time, priority) VALUES
  (jordan_id, 'green', 'Perplexity -- Sreekar replied ''Awesome. Thanks for everything!'' Final deliverables ACCEPTED.', 'Mar 20, 7:00 AM', 'urgent'),
  (jordan_id, 'green', 'Suno (Elias Nolin) -- NEW INBOUND. UGC partnership for AI music platform. $1K/mo. Below minimum.', 'Mar 20, 7:00 AM', 'action'),
  (jordan_id, 'amber', 'Stanley -- Month 2 Reel + Carousel OVERDUE (5 days, since Mar 15).', 'Mar 20, 7:00 AM', 'urgent'),
  (jordan_id, 'amber', 'Higgsfield/JEEVMEDIA -- WhatsApp outreach still no response. Finalize at $20K.', 'Mar 20, 7:00 AM', 'urgent'),
  (jordan_id, 'amber', 'Manychat -- Steph back from OOO since Mar 15. No reply in 5 days.', 'Mar 20, 7:00 AM', 'action'),
  (jordan_id, 'amber', 'HiDock -- Yasmine still waiting on media kit (OVERDUE 8 days since Mar 12).', 'Mar 20, 7:00 AM', 'action'),
  (jordan_id, 'amber', 'CapCut -- Sofia no response since Mar 4 (16 days). Consider closing.', 'Mar 20, 7:00 AM', 'action'),
  (jordan_id, 'red', 'FLORA -- Rev-share model. Still needs decline reply. OVERDUE.', 'Mar 20, 7:00 AM', 'action'),
  (jordan_id, 'blue', 'Instagram 243.5K (+263). Engagement 11.71% (+0.09%). TikTok 28.6K (+500).', 'Mar 20, 7:00 AM', 'info'),
  (jordan_id, 'amber', 'Weekly plan still on 3/9-3/15. No new plan created (5 days overdue).', 'Mar 20, 7:00 AM', 'action');

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

END $$;
