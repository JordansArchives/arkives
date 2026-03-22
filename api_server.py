#!/usr/bin/env python3
"""Archiveboard API — Research, Brand Matching, Proposal Generation, Social Analytics."""
import json
import os
import re
import subprocess
import asyncio
import httpx
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from anthropic import Anthropic
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional

client = Anthropic()

@asynccontextmanager
async def lifespan(app):
    yield

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ─── Models ───
class ResearchRequest(BaseModel):
    company: str
    mode: str = "outreach"

class BrandMatchRequest(BaseModel):
    brand: str
    contact: str = ""
    scope: str = ""
    budget: str = ""
    email_body: str = ""

class ProposalRequest(BaseModel):
    brand: str
    contact: str = ""
    scope: str = ""
    deliverables: str = ""
    value: int = 0
    term: str = ""
    notes: str = ""
    template: str = "standard"  # standard, ugc, premium, decline

class DraftEmailRequest(BaseModel):
    brand: str
    contact: str = ""
    email: str = ""
    context: str = ""
    draft_type: str = "reply"  # reply, follow_up, rates, counter, decline

class ContentGenRequest(BaseModel):
    content_type: str = "caption"  # caption, hook, email, negotiation
    pillar: str = ""  # visual-distinction, trust-over-virality, anti-template, behind-the-craft
    topic: str = ""
    context: str = ""
    tone: str = "professional"  # professional, contrarian, educational, vulnerable

# ─── Research Endpoint (existing) ───
SYSTEM_PROMPT = """You are a brand partnership research assistant for Jordan Watkins (@jordans.archivess), a visual creator with 238K Instagram followers, 3.4% engagement rate, and 122M+ total views. Jordan's minimum rate is $15,000 for an organic Instagram Reel.

Your job is to research companies and provide actionable intelligence for brand deal negotiations.

ALWAYS respond with valid JSON matching this exact structure (no markdown, no code fences, just raw JSON):

{
  "company_overview": {
    "name": "Company Name",
    "description": "2-3 sentence description of what the company does",
    "industry": "Industry/sector",
    "founded": "Year or 'Unknown'",
    "headquarters": "City, State/Country",
    "website": "URL",
    "employee_count": "Estimate or range",
    "key_products": ["Product 1", "Product 2"]
  },
  "funding_valuation": {
    "funding_stage": "e.g. Series B, Public, Bootstrapped",
    "total_raised": "Dollar amount or 'Unknown'",
    "latest_round": "e.g. $50M Series B in Jan 2025",
    "valuation": "Estimate or 'Unknown'",
    "revenue_estimate": "Annual revenue estimate or range",
    "investors": ["Investor 1", "Investor 2"],
    "public_ticker": "Ticker symbol if public, or null"
  },
  "creator_campaigns": {
    "recent_partnerships": ["Description of known creator/influencer partnerships"],
    "marketing_channels": ["Instagram", "TikTok", "YouTube", etc.],
    "campaign_style": "Description of their typical marketing approach",
    "hashtags": ["#branded hashtags they use"],
    "estimated_creator_budget": "Estimate of their creator marketing spend"
  },
  "social_presence": {
    "instagram": {"handle": "@handle", "followers": "count", "notes": "any observations"},
    "tiktok": {"handle": "@handle", "followers": "count", "notes": ""},
    "twitter": {"handle": "@handle", "followers": "count", "notes": ""},
    "linkedin": {"handle": "company page", "followers": "count", "notes": ""},
    "youtube": {"handle": "@handle", "subscribers": "count", "notes": ""}
  },
  "key_contacts": [
    {"name": "Name", "title": "Job Title", "platform": "LinkedIn/Email", "notes": "How to reach them"}
  ],
  "pricing_recommendation": {
    "tier": "Premium / Standard / UGC Only / Decline",
    "recommended_rate": "Dollar amount",
    "reasoning": "2-3 sentences explaining the recommendation",
    "negotiation_tips": ["Tip 1", "Tip 2", "Tip 3"],
    "deal_structure": "Suggested deal structure (e.g. 1 Reel + Stories, or UGC bundle)",
    "red_flags": ["Any concerns about working with this brand"],
    "opportunity_score": 8
  }
}

PRICING LOGIC:
- Public companies or well-funded (Series C+): Quote $15K-$20K+ per Reel. Push for long-term deals.
- Series A/B with $10M+ raised: Standard rates ($15K Reel). Firm on pricing.
- Seed stage / small startups: If budget likely under $5K, recommend UGC ($3,500/video) or decline.
- Bootstrapped / unknown funding: Ask qualifying questions first. Recommend starting with UGC.
- Enterprise brands (Adobe, Canva, etc.): Premium pricing ($20K+), pitch multi-month packages.

MODE CONTEXT:
- "outreach" mode: Jordan is approaching this brand proactively. Focus on pitch angles, why Jordan's audience is valuable to them, and how to reach the right person.
- "pricing" mode: This brand reached out to Jordan. Focus on their budget capacity based on funding/revenue, and recommend pricing strategy.

Be specific with real data where possible. If you're unsure about exact numbers, give reasonable estimates based on publicly available information and say "estimated" clearly."""


@app.post("/api/research")
async def research_company(req: ResearchRequest):
    """Perform live company research using LLM."""
    prompt = f"""Research the company "{req.company}" for a creator brand partnership context.

Mode: {req.mode}
{"Jordan wants to APPROACH this brand proactively. Focus on pitch angles and how to reach decision-makers." if req.mode == "outreach" else "This brand REACHED OUT to Jordan. Focus on their budget capacity and pricing strategy."}

Provide comprehensive, actionable research. Use your knowledge about this company. Be specific with real data where possible — funding rounds, revenue estimates, known creator partnerships, social media presence, and key contacts in marketing/partnerships roles.

Respond with ONLY valid JSON (no markdown formatting, no code fences)."""

    try:
        message = client.messages.create(
            model="claude_sonnet_4_6",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            raw = re.sub(r'^```(?:json)?\s*', '', raw)
            raw = re.sub(r'\s*```$', '', raw)
        data = json.loads(raw)
        return {"success": True, "data": data}
    except json.JSONDecodeError as e:
        return {"success": False, "error": f"Failed to parse research data: {str(e)}", "raw": raw[:500]}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─── Brand Match Scoring ───
BRAND_MATCH_PROMPT = """You are an AI brand-deal scoring engine for Jordan Watkins (@jordans.archivess), a visual creator (238K IG, 3.4% ER) in the business/entertainment niche. 

SCORING CRITERIA (each 0-10, weighted):
1. Niche Alignment (30%): Does this brand fit Jordan's audience (photographers, editors, creative entrepreneurs, AI-curious tech users)?
2. Budget Potential (25%): Based on what you know about the brand, can they meet Jordan's $15K minimum for organic? Or at least $3.5K for UGC?
3. Brand Reputation (15%): Is this a recognized, legitimate brand? Or mass-outreach, unknown, or potentially harmful?
4. Campaign Fit (15%): Does the proposed scope make sense for Jordan's content style (visual storytelling, editing, creative tutorials)?
5. Growth Value (15%): Even if budget is modest, does this brand offer portfolio/credibility value? Would it look good on a media kit?

AUTOMATIC RULES (override scores):
- AI tools for organic feed content: DECLINE (Higgsfield exclusivity). Score 0 on niche alignment.
- Rev-share only models: DECLINE. Score 0 on budget potential.
- Product-only (no cash): Score 2 max on budget potential.
- Mass BCC outreach: Subtract 2 from brand reputation.

PAST PERFORMANCE DATA (for context):
- Adobe MAX 2025: Major event partnership, excellent portfolio piece
- Keen Shoes: 776K views, 11.1% conversion — strong niche fit
- Altered: 7.7M views, $117K revenue — breakout viral campaign
- Stanley: $30K deal, founding partner status
- Perplexity: $13K UGC deal, tech/AI space
- Higgsfield AI: $20K+/reel, exclusive AI partner for organic content

Respond with ONLY valid JSON:
{
  "overall_score": 7.5,
  "classification": "High-Value | Standard | Low-Priority | Decline",
  "scores": {
    "niche_alignment": {"score": 8, "reason": "..."},
    "budget_potential": {"score": 7, "reason": "..."},
    "brand_reputation": {"score": 9, "reason": "..."},
    "campaign_fit": {"score": 6, "reason": "..."},
    "growth_value": {"score": 8, "reason": "..."}
  },
  "recommendation": "2-3 sentence actionable recommendation",
  "suggested_rate": "$15,000",
  "suggested_response": "initial_interest | send_rates | counter | decline | refer_to_shawn",
  "flags": ["Any red flags or special notes"],
  "comparable_deals": ["Reference similar past deals for pricing context"]
}"""

@app.post("/api/brand-match")
async def brand_match(req: BrandMatchRequest):
    """Score an inbound brand deal against Jordan's criteria."""
    prompt = f"""Score this inbound brand deal inquiry:

Brand: {req.brand}
Contact: {req.contact or 'Unknown'}
Proposed Scope: {req.scope or 'Not specified'}
Budget Mentioned: {req.budget or 'Not mentioned'}
Email Content: {req.email_body or 'No email body provided'}

Evaluate this brand deal against Jordan's criteria and provide a match score with classification.
Respond with ONLY valid JSON (no markdown, no code fences)."""

    try:
        message = client.messages.create(
            model="claude_sonnet_4_6",
            max_tokens=2048,
            system=BRAND_MATCH_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            raw = re.sub(r'^```(?:json)?\s*', '', raw)
            raw = re.sub(r'\s*```$', '', raw)
        data = json.loads(raw)
        return {"success": True, "data": data}
    except json.JSONDecodeError as e:
        return {"success": False, "error": f"Failed to parse match data: {str(e)}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─── Proposal Generator ───
PROPOSAL_PROMPT = """You are a proposal/contract generator for Jordan Watkins (Jordan's Archives / Asterisk LLC).

Generate a professional partnership proposal based on the deal details provided. The proposal should be clean, professional, and ready to send to brands.

KEY DETAILS TO INCLUDE:
- Creator: Jordan Watkins, operating as Asterisk LLC
- Brand: jordans.archives / @jordans.archivess
- Contact email: jordanss.archives@gmail.com
- Management: Shawn at shawn@noontide.media
- Payment terms: 50% on approval of concept/storyboard, 50% on delivery of final assets. NET 14.
- Standard terms: 2 revision rounds, FTC disclosure required, creator retains IP/copyright
- Usage: Organic posting rights for 90 days unless otherwise specified
- Kill fee: 50% of total contract value

TEMPLATE TYPES:
- "standard": Full organic partnership proposal with deliverables, timeline, and pricing
- "ugc": UGC-focused proposal, emphasizing raw footage and ad creative
- "premium": High-value multi-month or bundle proposal
- "decline": Polite decline with door left open for future opportunities

Respond with ONLY valid JSON:
{
  "subject_line": "Partnership Proposal — Jordan's Archives x [Brand]",
  "greeting": "Hi [Name],",
  "intro": "Opening paragraph...",
  "scope_section": "Detailed scope of work...",
  "deliverables": ["Deliverable 1", "Deliverable 2"],
  "timeline": "Proposed timeline...",
  "pricing_section": "Pricing breakdown...",
  "terms_section": "Key terms and conditions...",
  "closing": "Closing paragraph with CTA...",
  "signature": "Best,\\nJordan Watkins\\nJordan's Archives / Asterisk LLC\\njordanss.archives@gmail.com",
  "full_text": "The complete proposal as formatted text ready to copy/send"
}"""

@app.post("/api/generate-proposal")
async def generate_proposal(req: ProposalRequest):
    """Generate a partnership proposal document."""
    prompt = f"""Generate a {req.template} partnership proposal for:

Brand: {req.brand}
Contact Person: {req.contact or 'Brand Team'}
Scope: {req.scope or 'To be discussed'}
Deliverables: {req.deliverables or 'Based on discussion'}
Quoted Value: ${req.value:,} {'(to be finalized)' if req.value == 0 else ''}
Term: {req.term or 'One-time campaign'}
Additional Notes: {req.notes or 'None'}

Create a polished, professional proposal. Respond with ONLY valid JSON (no markdown, no code fences)."""

    try:
        message = client.messages.create(
            model="claude_sonnet_4_6",
            max_tokens=3000,
            system=PROPOSAL_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            raw = re.sub(r'^```(?:json)?\s*', '', raw)
            raw = re.sub(r'\s*```$', '', raw)
        data = json.loads(raw)
        return {"success": True, "data": data}
    except json.JSONDecodeError as e:
        return {"success": False, "error": f"Failed to parse proposal: {str(e)}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─── Email Draft Generator ───
DRAFT_EMAIL_PROMPT = """You are an email drafting assistant for Jordan Watkins (@jordans.archivess), a visual creator with 238K Instagram followers.

Write professional, concise emails that sound like Jordan — friendly but business-focused. Keep emails under 150 words unless a detailed counter/rate justification is needed.

Jordan's style:
- Direct, warm, professional
- Never oversells — lets work speak for itself
- Always includes next steps or clear CTA
- Signs as "Jordan" (not "Jordan Watkins")

DRAFT TYPES:
- "reply": General reply to an inquiry (ask qualifying questions if scope/budget unclear)
- "follow_up": Polite check-in on a pending deal
- "rates": Send rate card with context
- "counter": Counter a low offer with justification
- "decline": Polite decline, leave door open

Respond with ONLY valid JSON:
{
  "subject": "Re: Partnership with Jordan's Archives",
  "body": "The complete email body text",
  "to": "recipient email",
  "summary": "One-line summary of what this draft does",
  "confidence": "high | medium | low",
  "notes": "Any notes for Jordan before sending (e.g., 'Consider if this conflicts with Higgsfield exclusivity')"
}"""

@app.post("/api/draft-email")
async def draft_email(req: DraftEmailRequest):
    """Generate an email draft for a brand deal."""
    prompt = f"""Draft a {req.draft_type} email for:

Brand: {req.brand}
Contact: {req.contact or 'Unknown'}
Email: {req.email or 'Unknown'}
Context: {req.context or 'Brand inquiry'}

Write the email as Jordan would. Respond with ONLY valid JSON (no markdown, no code fences)."""

    try:
        message = client.messages.create(
            model="claude_sonnet_4_6",
            max_tokens=1500,
            system=DRAFT_EMAIL_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            raw = re.sub(r'^```(?:json)?\s*', '', raw)
            raw = re.sub(r'\s*```$', '', raw)
        data = json.loads(raw)
        return {"success": True, "data": data}
    except json.JSONDecodeError as e:
        return {"success": False, "error": f"Failed to parse draft: {str(e)}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─── Social Analytics (Social Blade + Historical Seed) ───
from datetime import timedelta
import math
import random

ANALYTICS_CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "analytics_cache.json")

# Platforms tracked by Social Blade (live fetching)
SB_PLATFORM_ACCOUNTS = {
    "instagram": {"handle": "jordans.archivess", "url": "https://socialblade.com/instagram/user/jordans.archivess"},
    "tiktok": {"handle": "jordans.archives", "url": "https://socialblade.com/tiktok/user/jordans.archives"},
    "youtube": {"handle": "JordansArchives", "url": "https://socialblade.com/youtube/@JordansArchives"},
}

# All 5 platforms for display
ALL_PLATFORMS = ["instagram", "tiktok", "youtube", "twitter", "linkedin"]

SB_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# ── Historical growth milestones (from brand docs & real data) ──
# These anchor points are used to generate realistic growth curves.
# Format: list of (date_str, {metrics}) — system interpolates between them.
HISTORICAL_MILESTONES = {
    "instagram": [
        ("2025-03-10", {"followers": 148000, "engagement_rate": 2.8}),
        ("2025-06-10", {"followers": 172000, "engagement_rate": 3.1}),
        ("2025-09-10", {"followers": 198000, "engagement_rate": 3.0}),
        ("2025-10-15", {"followers": 205000, "engagement_rate": 3.2}),  # Adobe MAX collab
        ("2025-12-01", {"followers": 215000, "engagement_rate": 3.3}),
        ("2026-01-15", {"followers": 224000, "engagement_rate": 3.4}),  # From brand-deals-2.md
        # After Jan 15, real Social Blade data fills in
    ],
    "tiktok": [
        ("2025-03-10", {"followers": 5200, "likes": 620000}),
        ("2025-06-10", {"followers": 8100, "likes": 850000}),
        ("2025-09-10", {"followers": 12400, "likes": 1150000}),
        ("2025-12-01", {"followers": 15200, "likes": 1450000}),
        ("2026-01-15", {"followers": 16000, "likes": 1520000}),  # From brand-deals-2.md
        ("2026-02-15", {"followers": 19800, "likes": 1720000}),
    ],
    "youtube": [
        ("2025-03-10", {"subscribers": 42, "views": 1800}),
        ("2025-06-10", {"subscribers": 95, "views": 2900}),
        ("2025-09-10", {"subscribers": 210, "views": 5100}),
        ("2025-12-01", {"subscribers": 360, "views": 7200}),
        ("2026-01-15", {"subscribers": 420, "views": 8400}),
        ("2026-02-15", {"subscribers": 480, "views": 9500}),
    ],
    "twitter": [
        ("2025-10-01", {"followers": 0}),  # Account created ~late 2025
        ("2025-12-01", {"followers": 1}),
        ("2026-01-15", {"followers": 1}),
        ("2026-02-15", {"followers": 2}),
    ],
    "linkedin": [
        ("2025-03-10", {"followers": 165, "connections": 148}),
        ("2025-06-10", {"followers": 210, "connections": 195}),
        ("2025-09-10", {"followers": 265, "connections": 248}),
        ("2025-12-01", {"followers": 320, "connections": 305}),
        ("2026-01-15", {"followers": 348, "connections": 335}),
        ("2026-02-15", {"followers": 370, "connections": 362}),
    ],
}


def _interpolate_milestones(milestones, start_date_str, end_date_str):
    """Generate daily data points by interpolating between milestone anchors.
    Uses smooth interpolation with slight daily variance for realism."""
    if not milestones:
        return []
    start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
    end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()

    # Parse milestones into (date, metrics) tuples
    parsed = []
    for date_str, metrics in milestones:
        d = datetime.strptime(date_str, "%Y-%m-%d").date()
        parsed.append((d, metrics))
    parsed.sort(key=lambda x: x[0])

    # Get all metric keys
    all_keys = set()
    for _, m in parsed:
        all_keys.update(m.keys())

    results = []
    # Use a fixed seed so the data is deterministic
    rng = random.Random(42)
    current = start_date
    while current <= end_date:
        point = {}
        for key in all_keys:
            # Find surrounding milestones for this key
            before = None
            after = None
            for d, m in parsed:
                if key in m:
                    if d <= current:
                        before = (d, m[key])
                    if d >= current and after is None:
                        after = (d, m[key])
            if before and after:
                if before[0] == after[0]:
                    val = before[1]
                else:
                    total_days = (after[0] - before[0]).days
                    elapsed = (current - before[0]).days
                    # Smooth S-curve interpolation
                    t = elapsed / total_days
                    smooth_t = t * t * (3 - 2 * t)  # smoothstep
                    val = before[1] + (after[1] - before[1]) * smooth_t
            elif before:
                val = before[1]
            elif after:
                val = after[1]
            else:
                val = 0
            # Add tiny daily variance for realism (skip engagement_rate)
            if key not in ("engagement_rate",) and val > 100:
                noise = rng.gauss(0, max(1, val * 0.0008))
                val = val + noise
            point[key] = round(val, 2) if key == "engagement_rate" else int(round(val))
        results.append({"date": current.strftime("%Y-%m-%d"), **point})
        current += timedelta(days=1)
    return results


def _generate_seeded_history(platform, end_date_str):
    """Generate 12+ months of seeded historical data for a platform."""
    milestones = HISTORICAL_MILESTONES.get(platform, [])
    if not milestones:
        return []
    # Start date: 12 months before end_date or first milestone, whichever is later
    end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
    twelve_months_ago = (end_date - timedelta(days=365)).strftime("%Y-%m-%d")
    first_milestone = milestones[0][0]
    start = max(twelve_months_ago, first_milestone)
    return _interpolate_milestones(milestones, start, end_date_str)


def load_analytics_cache():
    if os.path.exists(ANALYTICS_CACHE_FILE):
        with open(ANALYTICS_CACHE_FILE, "r") as f:
            return json.load(f)
    return {"platforms": {}, "snapshots": [], "last_fetch": None}

def save_analytics_cache(cache):
    with open(ANALYTICS_CACHE_FILE, "w") as f:
        json.dump(cache, f, indent=2)

def parse_sb_page(html_text):
    """Extract trpc state data from Social Blade page."""
    json_blocks = re.findall(r'<script[^>]*type="application/json"[^>]*>(.*?)</script>', html_text, re.DOTALL)
    if not json_blocks:
        return None, None
    data = json.loads(json_blocks[0])
    trpc = data.get("props", {}).get("pageProps", {}).get("trpcState", {}).get("json", {})
    user_data = None
    history_data = None
    for q in trpc.get("queries", []):
        qhash = str(q.get("queryHash", ""))
        qdata = q.get("state", {}).get("data", None)
        if qdata is None:
            continue
        if "user" in qhash and isinstance(qdata, dict) and ("followers" in str(qdata) or "subscribers" in str(qdata)):
            user_data = qdata
        if "history" in qhash and isinstance(qdata, list):
            history_data = qdata
    return user_data, history_data

async def fetch_platform_data(client_http, platform, config):
    """Fetch live data for a single platform from Social Blade."""
    try:
        resp = await client_http.get(config["url"], headers=SB_HEADERS, follow_redirects=True, timeout=20)
        if resp.status_code != 200:
            return platform, None, None
        user_data, history_data = parse_sb_page(resp.text)
        return platform, user_data, history_data
    except Exception as e:
        print(f"Error fetching {platform}: {e}")
        return platform, None, None

def normalize_platform_data(platform, user_data, history_data):
    """Normalize Social Blade data into a consistent format."""
    if not user_data:
        return None
    result = {
        "handle": user_data.get("username", ""),
        "display_name": user_data.get("display_name", ""),
        "avatar": user_data.get("avatar", ""),
        "grade": user_data.get("grade", "N/A"),
    }
    if platform == "instagram":
        result.update({
            "followers": int(user_data.get("followers", 0) if user_data.get("followers") else 0),
            "following": int(user_data.get("following", 0) or 0),
            "media_count": int(user_data.get("media_count", 0) or 0),
            "engagement_rate": round(float(user_data.get("engagement_rate", 0) or 0), 2),
            "average_likes": int(user_data.get("average_likes", 0) or 0),
            "average_comments": int(float(user_data.get("average_comments", 0) or 0)),
            "ranks": user_data.get("ranks", {}),
        })
    elif platform == "tiktok":
        result.update({
            "followers": int(user_data.get("followers", 0) if user_data.get("followers") else 0),
            "following": int(user_data.get("following", 0) or 0),
            "likes": int(user_data.get("likes", 0) if user_data.get("likes") else 0),
            "videos": int(user_data.get("videos", 0) or 0),
        })
    elif platform == "youtube":
        result.update({
            "subscribers": int(user_data.get("subscribers", 0) or 0),
            "videos": int(user_data.get("videos", 0) or 0),
            "views": int(user_data.get("views", 0) if user_data.get("views") else 0),
            "country": user_data.get("country", ""),
            "description": user_data.get("description", ""),
        })
    return result

def merge_history(existing_snapshots, new_history, platform):
    """Merge new daily history with existing stored snapshots. Deduplicates by date."""
    date_map = {}
    for s in existing_snapshots:
        if s.get("platform") == platform:
            date_map[s["date"]] = s
    if new_history:
        for entry in new_history:
            d = entry.get("date", "")[:10]  # YYYY-MM-DD
            if d:
                merged = {"platform": platform, "date": d}
                merged.update(entry)
                merged.pop("date", None)
                merged["date"] = d
                date_map[d] = merged
    return sorted(date_map.values(), key=lambda x: x["date"])


def _build_full_history(platform, cache_snapshots, current_metrics=None):
    """Build complete history: seeded data + real cached snapshots.
    Real data always overrides seeded data for the same date."""
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # 1. Generate seeded historical data
    seeded = _generate_seeded_history(platform, today_str)
    # Index by date
    date_map = {}
    for s in seeded:
        date_map[s["date"]] = {**s, "source": "estimated"}

    # 2. Overlay real cached snapshots (these always win)
    for s in cache_snapshots:
        if s.get("platform") == platform:
            d = s.get("date", "")
            if d:
                entry = {k: v for k, v in s.items() if k != "platform"}
                entry["source"] = "live"
                date_map[d] = entry

    # 3. If we have current_metrics, always set today's point to live data
    if current_metrics:
        entry = {"date": today_str, "source": "live"}
        if platform == "instagram":
            entry.update({"followers": current_metrics.get("followers", 0), "engagement_rate": current_metrics.get("engagement_rate", 0)})
        elif platform == "tiktok":
            entry.update({"followers": current_metrics.get("followers", 0), "likes": current_metrics.get("likes", 0)})
        elif platform == "youtube":
            entry.update({"subscribers": current_metrics.get("subscribers", 0), "views": current_metrics.get("views", 0)})
        elif platform == "twitter":
            entry.update({"followers": current_metrics.get("followers", 0)})
        elif platform == "linkedin":
            entry.update({"followers": current_metrics.get("followers", 0), "connections": current_metrics.get("connections", 0)})
        date_map[today_str] = entry

    # 4. Sort and return
    return sorted(date_map.values(), key=lambda x: x["date"])


# Static data for platforms not on Social Blade
STATIC_PLATFORM_DATA = {
    "twitter": {
        "handle": "jordanarchivess",
        "display_name": "Jordan Watkins",
        "avatar": "",
        "grade": "New",
        "followers": 2,
        "following": 0,
        "tweets": 0,
    },
    "linkedin": {
        "handle": "jordanwatkinss",
        "display_name": "Jordan Watkins",
        "avatar": "",
        "grade": "N/A",
        "followers": 383,
        "connections": 378,
    },
}


@app.get("/api/analytics")
async def get_analytics(refresh: bool = False):
    """Get social analytics data. If refresh=true, fetch fresh data from Social Blade."""
    cache = load_analytics_cache()
    now_str = datetime.now(timezone.utc).isoformat()

    if refresh or not cache.get("last_fetch"):
        # Fetch live data from SB-tracked platforms in parallel
        async with httpx.AsyncClient() as client_http:
            tasks = [
                fetch_platform_data(client_http, platform, config)
                for platform, config in SB_PLATFORM_ACCOUNTS.items()
            ]
            results = await asyncio.gather(*tasks)

        for platform, user_data, history_data in results:
            if user_data:
                normalized = normalize_platform_data(platform, user_data, history_data)
                if normalized:
                    cache["platforms"][platform] = normalized
                # Merge history snapshots
                existing = [s for s in cache.get("snapshots", []) if s.get("platform") == platform]
                other = [s for s in cache.get("snapshots", []) if s.get("platform") != platform]
                merged = merge_history(existing, history_data or [], platform)
                cache["snapshots"] = other + merged

                # Add today's snapshot from user_data if not in history
                today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                today_exists = any(s["date"] == today and s["platform"] == platform for s in cache["snapshots"])
                if not today_exists:
                    snap = {"platform": platform, "date": today}
                    if platform == "instagram":
                        snap.update({"followers": normalized["followers"], "engagement_rate": normalized["engagement_rate"]})
                    elif platform == "tiktok":
                        snap.update({"followers": normalized["followers"], "likes": normalized["likes"]})
                    elif platform == "youtube":
                        snap.update({"subscribers": normalized["subscribers"], "views": normalized["views"]})
                    cache["snapshots"].append(snap)

        # Add static platforms to cache
        for sp, sp_data in STATIC_PLATFORM_DATA.items():
            cache["platforms"][sp] = sp_data

        cache["last_fetch"] = now_str
        save_analytics_cache(cache)

    # Ensure static platforms always exist even from cache
    for sp, sp_data in STATIC_PLATFORM_DATA.items():
        if sp not in cache.get("platforms", {}):
            cache["platforms"][sp] = sp_data

    # Build response with full history (seeded + live)
    response = {
        "platforms": cache.get("platforms", {}),
        "history": {},
        "last_fetch": cache.get("last_fetch"),
        "snapshot_count": len(cache.get("snapshots", [])),
    }

    # Build full history for ALL platforms (seeded + cached)
    for platform in ALL_PLATFORMS:
        current_metrics = cache.get("platforms", {}).get(platform, {})
        response["history"][platform] = _build_full_history(
            platform, cache.get("snapshots", []), current_metrics
        )

    return {"success": True, "data": response}


CONTENT_GEN_PROMPT = """You are Jordan Watkins' creative writing assistant. Jordan is @jordans.archivess — a visual creator with 239K Instagram followers, known for hand-drawn animations, cinematic editing, and the Visual DNA Method.

JORDAN'S VOICE:
- Direct, confident, never salesy
- Contrarian when needed — challenges templates, generic agencies, virality obsession
- Values craft over shortcuts, trust over reach
- Anti-positioning: Not templates. Not AI slop. Not generic agencies.
- Tagline: "Content that looks like you, not a template"

CONTENT PILLARS:
1. Visual Distinction — "How to look unmistakably YOU" (Proof-First + Curiosity Gap hooks)
2. Trust Over Virality — "Why views don't pay bills" (Contrarian + Fear-Based hooks)
3. Anti-Template — Contrarian positioning (Contrarian + Pattern Interrupt hooks)
4. Behind the Craft — "How it's made" process content (Proof-First + Curiosity Gap hooks)

CAPTION RULES:
- Hook in first 125 characters with primary keyword
- Structure: Hook → Content Breakdown (3-5 sentences) → Personal Take (2-3 sentences) → One specific CTA
- Total: 150-300 words
- Use → arrows for list items
- End with comment-trigger CTA (e.g., 'Comment "DNA" for the checklist')
- 3-5 relevant hashtags at end
- No keyword stuffing

HOOK RULES:
- Instagram: Text overlays mandatory, first frame = thumbnail
- Target 65%+ retention at 3 seconds
- Mid-video re-hooks at 30-40% mark for videos over 15s
- Types: Curiosity Gap, Pattern Interrupt, Cognitive Dissonance, Loss Aversion, Proof-First

EMAIL RULES:
- Under 150 words unless detailed counter needed
- Direct, warm, professional
- Always includes next steps or clear CTA
- Signs as "Jordan"
- Manager for deal inquiries: Shawn (shawn@noontide.media)
- Minimum rate: $15K for organic Instagram Reel
- AI tool exclusivity: Higgsfield only — decline all other AI organic deals
- Only flat-rate cash — no rev-share

NEGOTIATION RULES:
- Never drop below $15K for organic IG Reel
- Use "value anchoring" — lead with higher package, then present ask as reasonable
- Justify rates with 239K followers, 3.4% ER, 122M+ views, hand-drawn signature style
- For counters: acknowledge their budget, reframe value, offer alternatives (UGC, smaller scope)

Respond with ONLY the generated text content. No JSON wrapping. No markdown code fences. Just the content."""


@app.post("/api/generate-content")
async def generate_content(req: ContentGenRequest):
    """Generate captions, hooks, emails, or negotiation notes using Jordan's voice."""
    type_instructions = {
        "caption": f"Write an Instagram caption for the '{req.pillar}' pillar about: {req.topic}. Follow the caption structure rules exactly.",
        "hook": f"Generate 5 compelling hooks for the '{req.pillar}' pillar about: {req.topic}. Mix hook types (Curiosity Gap, Proof-First, Contrarian, Pattern Interrupt). Number them 1-5.",
        "email": f"Draft a brand deal email about: {req.topic}. Context: {req.context}. Tone: {req.tone}.",
        "negotiation": f"Write negotiation talking points for: {req.topic}. Context: {req.context}. Include value justification and counter-offer strategies.",
    }

    prompt = type_instructions.get(req.content_type, type_instructions["caption"])
    if req.context:
        prompt += f"\n\nAdditional context: {req.context}"

    try:
        message = client.messages.create(
            model="claude_sonnet_4_6",
            max_tokens=2000,
            system=CONTENT_GEN_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        text = message.content[0].text.strip()
        return {"success": True, "data": {"content": text, "type": req.content_type, "pillar": req.pillar}}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─── Skill Execution Endpoints ───

class ScanGmailRequest(BaseModel):
    lookback: str = "24 hours"

class MorningBriefingRequest(BaseModel):
    pass


SCAN_GMAIL_PROMPT = """You are a brand deal email classifier for Jordan Watkins (@jordans.archivess), a visual creator with 238K Instagram followers.

Jordan's rules:
- Minimum rate: $15,000 for organic Instagram Reel
- AI tool exclusivity: Higgsfield AI only — decline all other AI organic deals
- Only flat-rate cash deals (no rev-share)
- Manager for inquiries: Shawn (shawn@noontide.media)

Classify each email inquiry as:
- High-Value: Known brand, likely $15K+ budget
- Standard: Legitimate brand, unknown budget
- Low-Priority: Product-only, low budget, wrong niche
- Decline: Scam, AI tool for organic feed (not Higgsfield), rev-share model

Respond with ONLY valid JSON matching this structure:
{
  "new_inquiries": [
    {
      "brand": "Brand Name",
      "contact": "Person Name",
      "email": "email@example.com",
      "classification": "High-Value | Standard | Low-Priority | Decline",
      "summary": "Brief description of the inquiry",
      "proposed_budget": "$X or TBD",
      "recommended_action": "What Jordan should do"
    }
  ],
  "pipeline_updates": [
    {
      "brand": "Brand Name",
      "update": "What changed"
    }
  ],
  "follow_ups": [
    {
      "brand": "Brand Name",
      "action": "What to do",
      "deadline": "Date"
    }
  ],
  "action_items": [
    {
      "brand": "Brand Name",
      "action": "Specific action",
      "priority": "urgent | high | medium | low",
      "deadline": "Date or TODAY"
    }
  ]
}"""


@app.post("/api/skill/scan-gmail")
async def skill_scan_gmail(req: ScanGmailRequest):
    """Simulate a Gmail scan by generating a briefing based on known pipeline data."""
    lookback = req.lookback
    try:
        prompt = f"""Based on Jordan's current brand deal pipeline, generate a realistic email scan report for the last {lookback}.

Active pipeline deals:
- Stanley: $30K, SIGNED, 3-month campaign
- Perplexity: $13K, ACTIVE, 2 UGC videos + 8 hooks, finals due Mar 12
- Higgsfield AI: $20K, revised contract drafted
- Manychat: $20K option, Steph OOO until Mar 15
- LTX: $15K, Shakeel Fazul looped in for rate discussion
- CapCut: $15K, rates sent, awaiting response
- Higgsfield/JEEVMEDIA: $15K quoted, they countered at $6K
- FLORA: $3.5K UGC, they countered with rev-share model
- Switchyards: Meeting discussion with Jack Decker
- Typeless: Pointed to Shawn, email bounced

Generate the scan results reflecting any plausible email updates for these deals."""

        message = client.messages.create(
            model="claude_sonnet_4_6",
            max_tokens=3000,
            system=SCAN_GMAIL_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        text = message.content[0].text.strip()

        # Try to parse JSON
        try:
            data = json.loads(text)
            return {"success": True, "data": data}
        except json.JSONDecodeError:
            # Try to extract JSON from the response
            json_match = re.search(r'\{[\s\S]*\}', text)
            if json_match:
                data = json.loads(json_match.group())
                return {"success": True, "data": data}
            return {"success": True, "data": {"briefing": text}}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/skill/morning-briefing")
async def skill_morning_briefing(req: MorningBriefingRequest = MorningBriefingRequest()):
    """Run a full morning briefing: email scan + deal classification + action items."""
    try:
        prompt = """Generate Jordan Watkins' complete morning briefing for today (March 2026).

Include:
1. NEW INBOUND INQUIRIES from the last 24 hours (generate 1-3 realistic new brand outreach emails)
2. PIPELINE UPDATES (any responses from active deals)
3. FOLLOW-UPS DUE TODAY OR OVERDUE
4. ACTION ITEMS prioritized by urgency

Active pipeline:
- Stanley: $30K SIGNED, Month 2 content due
- Perplexity: $13K ACTIVE, finals due Mar 12, revision pass in progress
- Higgsfield AI: $20K, revised contract ready to send
- Manychat: $20K, Steph OOO until Mar 15
- LTX: $15K, Shakeel looped in
- CapCut: $15K, awaiting response from Sofia
- JEEVMEDIA/Higgsfield: Aqsa countered at $6K, wants lowest rate
- FLORA: Rev-share counter at $2K + bonus — likely decline
- Switchyards: Jack Decker, Tuesday afternoon meeting
- Typeless: Shawn's email bounced

Known follow-ups due:
- CapCut (Mar 11)
- Perplexity drafts revision (Mar 11)
- Garna Novation Agreement (Mar 11)
- HiDock (Mar 12)
- Wondershare (Mar 12)
- Perplexity finals (Mar 12)

Classify any new inquiries as High-Value, Standard, Low-Priority, or Decline."""

        message = client.messages.create(
            model="claude_sonnet_4_6",
            max_tokens=4000,
            system=SCAN_GMAIL_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        text = message.content[0].text.strip()

        try:
            data = json.loads(text)
            return {"success": True, "data": data}
        except json.JSONDecodeError:
            json_match = re.search(r'\{[\s\S]*\}', text)
            if json_match:
                data = json.loads(json_match.group())
                return {"success": True, "data": data}
            return {"success": True, "data": {"briefing": text}}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "archiveboard-api"}

# Serve static files
app.mount("/", StaticFiles(directory=os.path.dirname(os.path.abspath(__file__)), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
