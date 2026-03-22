/* ===========================================
   Command Center — Executable Skills
   Run, schedule, and monitor automated workflows
   =========================================== */

/* ---- SKILL DEFINITIONS ---- */
const SKILLS = [
  {
    id: "scan-gmail",
    name: "Scan Gmail",
    description: "Scan inbox for new brand deal emails from the last 24 hours. Classifies deals and surfaces action items.",
    icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
    category: "inbox",
    color: "#c45d5d",
    schedulable: true,
    schedule: "Daily at 7:00 AM MDT",
    cronActive: true,
    fields: [
      { key: "lookback", label: "Lookback Period", type: "select", options: ["24 hours", "48 hours", "7 days"], default: "24 hours" }
    ],
    endpoint: "/api/skill/scan-gmail"
  },
  {
    id: "draft-reply",
    name: "Draft Email Reply",
    description: "Generate a professional brand deal reply using Jordan's voice, tone, and negotiation rules.",
    icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    category: "email",
    color: "#5b8fd9",
    schedulable: false,
    fields: [
      { key: "brand", label: "Brand Name", type: "text", placeholder: "e.g. Manychat" },
      { key: "contact", label: "Contact Name", type: "text", placeholder: "e.g. Steph Giroux" },
      { key: "email", label: "Email Address", type: "text", placeholder: "e.g. steph@manychat.com" },
      { key: "context", label: "Context / What to say", type: "textarea", placeholder: "e.g. Follow up on Q2 partnership. They offered $8K, counter at $20K with Option A bundle." },
      { key: "draft_type", label: "Reply Type", type: "select", options: ["reply", "follow_up", "rates", "counter", "decline"], default: "reply" }
    ],
    endpoint: "/api/draft-email"
  },
  {
    id: "research-company",
    name: "Research Company",
    description: "Deep-dive research on a company: funding, valuation, creator campaigns, social presence, and pricing intelligence.",
    icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    category: "research",
    color: "#4f98a3",
    schedulable: false,
    fields: [
      { key: "company", label: "Company Name", type: "text", placeholder: "e.g. Notion, Canva, Adobe" }
    ],
    endpoint: "/api/research"
  },
  {
    id: "generate-caption",
    name: "Generate Caption",
    description: "Create Instagram captions, hooks, or content using Jordan's brand voice, content pillars, and hook frameworks.",
    icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>`,
    category: "content",
    color: "#d4a853",
    schedulable: false,
    fields: [
      { key: "content_type", label: "Content Type", type: "select", options: ["caption", "hook", "email", "negotiation"], default: "caption" },
      { key: "pillar", label: "Content Pillar", type: "select", options: ["visual-distinction", "trust-over-virality", "anti-template", "behind-the-craft"], default: "visual-distinction" },
      { key: "topic", label: "Topic", type: "text", placeholder: "e.g. Why your content looks like everyone else's" },
      { key: "tone", label: "Tone", type: "select", options: ["professional", "contrarian", "educational", "vulnerable"], default: "professional" },
      { key: "context", label: "Additional Context", type: "textarea", placeholder: "Any extra details or direction..." }
    ],
    endpoint: "/api/generate-content"
  },
  {
    id: "brand-match",
    name: "Score Brand Deal",
    description: "AI-powered scoring of inbound brand deals against your niche, rate card, and past performance.",
    icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    category: "deals",
    color: "#9b7fd4",
    schedulable: false,
    fields: [
      { key: "brand", label: "Brand Name", type: "text", placeholder: "e.g. CapCut" },
      { key: "contact", label: "Contact Name", type: "text", placeholder: "e.g. Sofia" },
      { key: "scope", label: "Scope of Work", type: "textarea", placeholder: "e.g. 1 Instagram Reel (40s+), 7-day link in bio" },
      { key: "budget", label: "Their Budget", type: "text", placeholder: "e.g. $6,000 or TBD" },
      { key: "email_body", label: "Original Email (paste)", type: "textarea", placeholder: "Paste the brand's outreach email here..." }
    ],
    endpoint: "/api/brand-match"
  },
  {
    id: "generate-proposal",
    name: "Generate Proposal",
    description: "Build a polished partnership proposal with deliverables, pricing, timeline, and contract terms.",
    icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/></svg>`,
    category: "deals",
    color: "#5db87a",
    schedulable: false,
    fields: [
      { key: "brand", label: "Brand Name", type: "text", placeholder: "e.g. Stanley" },
      { key: "contact", label: "Contact Name", type: "text", placeholder: "e.g. Jonathan" },
      { key: "scope", label: "Scope", type: "textarea", placeholder: "Describe the campaign scope..." },
      { key: "deliverables", label: "Deliverables", type: "text", placeholder: "e.g. 1 Reel + 1 Carousel + Stories" },
      { key: "value", label: "Total Value ($)", type: "text", placeholder: "e.g. 30000" },
      { key: "term", label: "Term", type: "text", placeholder: "e.g. 90 days" },
      { key: "template", label: "Template", type: "select", options: ["standard", "ugc", "premium", "decline"], default: "standard" }
    ],
    endpoint: "/api/proposal"
  },
  {
    id: "morning-briefing",
    name: "Morning Briefing",
    description: "Run the full morning update: scan emails, classify deals, compile action items, and surface follow-ups due today.",
    icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    category: "inbox",
    color: "#d4883b",
    schedulable: true,
    schedule: "Daily at 7:00 AM MDT",
    cronActive: true,
    fields: [],
    endpoint: "/api/skill/morning-briefing"
  }
];

/* ---- SKILL EXECUTION STATE ---- */
const skillState = {};

function getSkillState(skillId) {
  if (!skillState[skillId]) {
    skillState[skillId] = { status: "idle", result: null, error: null, startTime: null };
  }
  return skillState[skillId];
}

/* ---- RENDER SKILLS VIEW ---- */
function renderSkills() {
  const container = document.getElementById("view-skills");

  const categories = [
    { key: "inbox", label: "Inbox & Briefings", icon: "📬" },
    { key: "email", label: "Email & Outreach", icon: "✉️" },
    { key: "content", label: "Content Creation", icon: "🎨" },
    { key: "research", label: "Research & Intel", icon: "🔍" },
    { key: "deals", label: "Deal Management", icon: "🤝" }
  ];

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Command Center</h1>
        <p class="view-subtitle">Run skills on demand or schedule them to execute automatically</p>
      </div>
    </div>

    <!-- Active Schedule Banner -->
    <div class="cc-schedule-banner">
      <div class="cc-schedule-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      </div>
      <div class="cc-schedule-info">
        <strong>Morning Briefing</strong> runs daily at 7:00 AM MDT
        <span class="cc-schedule-status active">Active</span>
      </div>
      <div class="cc-schedule-next">Next run: tomorrow at 7:00 AM</div>
    </div>

    <!-- Skill Categories -->
    ${categories.map(cat => {
      const catSkills = SKILLS.filter(s => s.category === cat.key);
      if (catSkills.length === 0) return "";
      return `
        <div class="cc-category">
          <h2 class="cc-category-title">${cat.icon} ${cat.label}</h2>
          <div class="cc-skills-grid">
            ${catSkills.map(skill => renderSkillCard(skill)).join("")}
          </div>
        </div>
      `;
    }).join("")}

    <!-- Execution Results Panel -->
    <div class="cc-results-panel" id="ccResultsPanel" style="display:none">
      <div class="cc-results-header">
        <h2 class="cc-results-title" id="ccResultsTitle">Results</h2>
        <button class="btn-ghost" onclick="closeResultsPanel()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="cc-results-body" id="ccResultsBody"></div>
    </div>
  `;
}

function renderSkillCard(skill) {
  const state = getSkillState(skill.id);
  const isRunning = state.status === "running";
  const hasResult = state.status === "done";
  const hasError = state.status === "error";

  return `
    <div class="cc-skill-card" data-skill="${skill.id}" style="--skill-color: ${skill.color}">
      <div class="cc-skill-header">
        <div class="cc-skill-icon" style="background: ${skill.color}22; color: ${skill.color}">
          ${skill.icon}
        </div>
        <div class="cc-skill-meta">
          <h3 class="cc-skill-name">${skill.name}</h3>
          <p class="cc-skill-desc">${skill.description}</p>
        </div>
      </div>

      ${skill.schedulable ? `
        <div class="cc-skill-schedule">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>${skill.schedule || "Not scheduled"}</span>
          ${skill.cronActive ? '<span class="cc-cron-badge active">Active</span>' : '<span class="cc-cron-badge">Inactive</span>'}
        </div>
      ` : ""}

      <!-- Input Fields -->
      ${skill.fields.length > 0 ? `
        <div class="cc-skill-fields" id="fields-${skill.id}">
          ${skill.fields.map(f => renderSkillField(skill.id, f)).join("")}
        </div>
      ` : ""}

      <!-- Action Buttons -->
      <div class="cc-skill-actions">
        <button class="cc-btn-run ${isRunning ? 'running' : ''}" onclick="runSkill('${skill.id}')" ${isRunning ? 'disabled' : ''} style="--btn-color: ${skill.color}">
          ${isRunning ? `
            <span class="cc-spinner"></span>
            <span>Running...</span>
          ` : `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <span>Run Now</span>
          `}
        </button>
        ${hasResult ? `
          <button class="cc-btn-view" onclick="viewSkillResult('${skill.id}')" style="--btn-color: ${skill.color}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            View Results
          </button>
        ` : ""}
        ${hasError ? `<span class="cc-skill-error">Failed — try again</span>` : ""}
      </div>

      ${isRunning ? `
        <div class="cc-skill-progress">
          <div class="cc-progress-bar">
            <div class="cc-progress-fill" style="background: ${skill.color}"></div>
          </div>
        </div>
      ` : ""}
    </div>
  `;
}

function renderSkillField(skillId, field) {
  const inputId = `skill-${skillId}-${field.key}`;
  if (field.type === "select") {
    return `
      <div class="cc-field">
        <label for="${inputId}">${field.label}</label>
        <select id="${inputId}" class="cc-input">
          ${field.options.map(o => `<option value="${o}" ${o === field.default ? "selected" : ""}>${o}</option>`).join("")}
        </select>
      </div>
    `;
  } else if (field.type === "textarea") {
    return `
      <div class="cc-field">
        <label for="${inputId}">${field.label}</label>
        <textarea id="${inputId}" class="cc-input cc-textarea" placeholder="${field.placeholder || ""}" rows="3"></textarea>
      </div>
    `;
  } else {
    return `
      <div class="cc-field">
        <label for="${inputId}">${field.label}</label>
        <input id="${inputId}" type="text" class="cc-input" placeholder="${field.placeholder || ""}">
      </div>
    `;
  }
}

/* ---- SKILL EXECUTION ---- */
async function runSkill(skillId) {
  const skill = SKILLS.find(s => s.id === skillId);
  if (!skill) return;

  // Gather field values
  const payload = {};
  skill.fields.forEach(f => {
    const el = document.getElementById(`skill-${skillId}-${f.key}`);
    if (el) {
      let val = el.value.trim();
      if (f.key === "value" && val) val = parseInt(val.replace(/[^0-9]/g, ""), 10) || 0;
      payload[f.key] = val;
    }
  });

  // Validate required fields
  if (skill.id === "draft-reply" && !payload.brand) {
    showSkillToast("Please enter a brand name", "error"); return;
  }
  if (skill.id === "research-company" && !payload.company) {
    showSkillToast("Please enter a company name", "error"); return;
  }
  if (skill.id === "generate-caption" && !payload.topic) {
    showSkillToast("Please enter a topic", "error"); return;
  }
  if (skill.id === "brand-match" && !payload.brand) {
    showSkillToast("Please enter a brand name", "error"); return;
  }
  if (skill.id === "generate-proposal" && !payload.brand) {
    showSkillToast("Please enter a brand name", "error"); return;
  }

  // Update state to running
  skillState[skillId] = { status: "running", result: null, error: null, startTime: Date.now() };
  renderSkills();

  try {
    const url = `${API_BASE}${skill.endpoint}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      skillState[skillId] = { status: "done", result: data.data || data, error: null, startTime: null };
      showSkillToast(`${skill.name} completed`, "success");
    } else {
      skillState[skillId] = { status: "error", result: null, error: data.error || "Unknown error", startTime: null };
      showSkillToast(`${skill.name} failed: ${data.error || "Unknown error"}`, "error");
    }
  } catch (err) {
    skillState[skillId] = { status: "error", result: null, error: err.message, startTime: null };
    showSkillToast(`${skill.name} failed: ${err.message}`, "error");
  }

  renderSkills();

  // Auto-open results for successful runs
  if (skillState[skillId].status === "done") {
    viewSkillResult(skillId);
  }
}

/* ---- VIEW RESULTS ---- */
function viewSkillResult(skillId) {
  const skill = SKILLS.find(s => s.id === skillId);
  const state = getSkillState(skillId);
  if (!state.result) return;

  const panel = document.getElementById("ccResultsPanel");
  const title = document.getElementById("ccResultsTitle");
  const body = document.getElementById("ccResultsBody");

  panel.style.display = "block";
  title.textContent = `${skill.name} — Results`;

  const result = state.result;

  // Format based on skill type
  if (skillId === "draft-reply") {
    body.innerHTML = formatEmailResult(result);
  } else if (skillId === "research-company") {
    body.innerHTML = formatResearchResult(result);
  } else if (skillId === "generate-caption") {
    body.innerHTML = formatContentResult(result);
  } else if (skillId === "brand-match") {
    body.innerHTML = formatBrandMatchResult(result);
  } else if (skillId === "generate-proposal") {
    body.innerHTML = formatProposalResult(result);
  } else if (skillId === "scan-gmail" || skillId === "morning-briefing") {
    body.innerHTML = formatBriefingResult(result);
  } else {
    body.innerHTML = `<pre class="cc-result-raw">${JSON.stringify(result, null, 2)}</pre>`;
  }

  // Scroll to results
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeResultsPanel() {
  document.getElementById("ccResultsPanel").style.display = "none";
}

/* ---- RESULT FORMATTERS ---- */
function formatEmailResult(result) {
  const draft = result.draft || result.content || result.email || JSON.stringify(result);
  return `
    <div class="cc-result-section">
      <div class="cc-result-label">Generated Draft</div>
      <div class="cc-result-email">${escapeHtml(draft).replace(/\n/g, "<br>")}</div>
      <div class="cc-result-actions">
        <button class="cc-btn-copy" onclick="copyToClipboard(this, \`${escapeForAttr(draft)}\`)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copy to Clipboard
        </button>
      </div>
    </div>
  `;
}

function formatContentResult(result) {
  const content = result.content || JSON.stringify(result);
  return `
    <div class="cc-result-section">
      <div class="cc-result-label">${(result.type || "caption").toUpperCase()} — ${result.pillar || ""}</div>
      <div class="cc-result-content">${escapeHtml(content).replace(/\n/g, "<br>")}</div>
      <div class="cc-result-actions">
        <button class="cc-btn-copy" onclick="copyToClipboard(this, \`${escapeForAttr(content)}\`)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copy
        </button>
      </div>
    </div>
  `;
}

function formatResearchResult(result) {
  if (typeof result === "string") {
    return `<div class="cc-result-content">${escapeHtml(result).replace(/\n/g, "<br>")}</div>`;
  }
  let html = "";

  if (result.company_overview) {
    const co = result.company_overview;
    html += `
      <div class="cc-result-section">
        <div class="cc-result-label">Company Overview</div>
        <div class="cc-result-grid">
          <div class="cc-result-kv"><span>Name</span><strong>${co.name || "—"}</strong></div>
          <div class="cc-result-kv"><span>Industry</span><strong>${co.industry || "—"}</strong></div>
          <div class="cc-result-kv"><span>Founded</span><strong>${co.founded || "—"}</strong></div>
          <div class="cc-result-kv"><span>HQ</span><strong>${co.headquarters || "—"}</strong></div>
          <div class="cc-result-kv"><span>Employees</span><strong>${co.employee_count || "—"}</strong></div>
        </div>
        <p class="cc-result-text">${co.description || ""}</p>
      </div>
    `;
  }

  if (result.funding_valuation) {
    const fv = result.funding_valuation;
    html += `
      <div class="cc-result-section">
        <div class="cc-result-label">Funding & Valuation</div>
        <div class="cc-result-grid">
          <div class="cc-result-kv"><span>Stage</span><strong>${fv.funding_stage || "—"}</strong></div>
          <div class="cc-result-kv"><span>Total Raised</span><strong>${fv.total_raised || "—"}</strong></div>
          <div class="cc-result-kv"><span>Valuation</span><strong>${fv.valuation || "—"}</strong></div>
          <div class="cc-result-kv"><span>Revenue Est.</span><strong>${fv.revenue_estimate || "—"}</strong></div>
        </div>
        ${fv.latest_round ? `<p class="cc-result-text">Latest: ${fv.latest_round}</p>` : ""}
      </div>
    `;
  }

  if (result.creator_campaigns) {
    const cc = result.creator_campaigns;
    html += `
      <div class="cc-result-section">
        <div class="cc-result-label">Creator Campaigns</div>
        <p class="cc-result-text">${cc.campaign_style || ""}</p>
        ${cc.recent_partnerships && cc.recent_partnerships.length ? `<ul class="cc-result-list">${cc.recent_partnerships.map(p => `<li>${p}</li>`).join("")}</ul>` : ""}
        <div class="cc-result-kv"><span>Est. Creator Budget</span><strong>${cc.estimated_creator_budget || "—"}</strong></div>
      </div>
    `;
  }

  if (result.negotiation_intel) {
    const ni = result.negotiation_intel;
    html += `
      <div class="cc-result-section">
        <div class="cc-result-label">Negotiation Intel</div>
        <div class="cc-result-grid">
          <div class="cc-result-kv"><span>Recommended Rate</span><strong>${ni.recommended_rate || "—"}</strong></div>
          <div class="cc-result-kv"><span>Budget Likelihood</span><strong>${ni.budget_likelihood || "—"}</strong></div>
        </div>
        ${ni.talking_points && ni.talking_points.length ? `
          <div class="cc-result-label" style="margin-top:12px">Talking Points</div>
          <ul class="cc-result-list">${ni.talking_points.map(p => `<li>${p}</li>`).join("")}</ul>
        ` : ""}
      </div>
    `;
  }

  return html || `<pre class="cc-result-raw">${JSON.stringify(result, null, 2)}</pre>`;
}

function formatBrandMatchResult(result) {
  if (typeof result === "string") {
    return `<div class="cc-result-content">${escapeHtml(result).replace(/\n/g, "<br>")}</div>`;
  }

  let html = "";
  if (result.score !== undefined || result.overall_score !== undefined) {
    const score = result.score || result.overall_score || 0;
    const grade = score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D";
    const gradeColor = score >= 80 ? "#5db87a" : score >= 60 ? "#d4a853" : score >= 40 ? "#d4883b" : "#c45d5d";
    html += `
      <div class="cc-result-section cc-score-hero">
        <div class="cc-score-circle" style="--score-color: ${gradeColor}">
          <span class="cc-score-grade">${grade}</span>
          <span class="cc-score-num">${score}/100</span>
        </div>
        <div class="cc-score-details">
          ${result.classification ? `<div class="cc-result-kv"><span>Classification</span><strong>${result.classification}</strong></div>` : ""}
          ${result.recommended_action ? `<div class="cc-result-kv"><span>Recommended Action</span><strong>${result.recommended_action}</strong></div>` : ""}
          ${result.suggested_rate ? `<div class="cc-result-kv"><span>Suggested Rate</span><strong>${result.suggested_rate}</strong></div>` : ""}
        </div>
      </div>
    `;
  }

  if (result.analysis || result.reasoning) {
    html += `
      <div class="cc-result-section">
        <div class="cc-result-label">Analysis</div>
        <div class="cc-result-content">${escapeHtml(result.analysis || result.reasoning || "").replace(/\n/g, "<br>")}</div>
      </div>
    `;
  }

  return html || `<pre class="cc-result-raw">${JSON.stringify(result, null, 2)}</pre>`;
}

function formatProposalResult(result) {
  const proposal = result.proposal || result.content || JSON.stringify(result, null, 2);
  return `
    <div class="cc-result-section">
      <div class="cc-result-label">Generated Proposal</div>
      <div class="cc-result-proposal">${escapeHtml(typeof proposal === "string" ? proposal : JSON.stringify(proposal, null, 2)).replace(/\n/g, "<br>")}</div>
      <div class="cc-result-actions">
        <button class="cc-btn-copy" onclick="copyToClipboard(this, \`${escapeForAttr(typeof proposal === "string" ? proposal : JSON.stringify(proposal))}\`)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copy
        </button>
      </div>
    </div>
  `;
}

function formatBriefingResult(result) {
  if (result.briefing || result.summary) {
    const text = result.briefing || result.summary;
    return `
      <div class="cc-result-section">
        <div class="cc-result-label">Morning Briefing</div>
        <div class="cc-result-content">${escapeHtml(text).replace(/\n/g, "<br>")}</div>
      </div>
    `;
  }

  // Structured briefing
  let html = "";
  if (result.new_inquiries && result.new_inquiries.length) {
    html += `
      <div class="cc-result-section">
        <div class="cc-result-label">New Inbound Inquiries</div>
        ${result.new_inquiries.map(i => `
          <div class="cc-briefing-item">
            <strong>${i.brand || i.name || "Unknown"}</strong>
            ${i.contact ? ` — ${i.contact}` : ""}
            ${i.classification ? `<span class="cc-briefing-tag">${i.classification}</span>` : ""}
            ${i.summary ? `<p>${i.summary}</p>` : ""}
          </div>
        `).join("")}
      </div>
    `;
  }

  if (result.pipeline_updates && result.pipeline_updates.length) {
    html += `
      <div class="cc-result-section">
        <div class="cc-result-label">Pipeline Updates</div>
        ${result.pipeline_updates.map(u => `
          <div class="cc-briefing-item"><strong>${u.brand || ""}</strong>: ${u.update || u.text || ""}</div>
        `).join("")}
      </div>
    `;
  }

  if (result.follow_ups && result.follow_ups.length) {
    html += `
      <div class="cc-result-section">
        <div class="cc-result-label">Follow-Ups Due</div>
        ${result.follow_ups.map(f => `
          <div class="cc-briefing-item"><strong>${f.brand || ""}</strong> — ${f.action || f.note || ""} <span class="cc-briefing-date">${f.deadline || f.date || ""}</span></div>
        `).join("")}
      </div>
    `;
  }

  if (result.action_items && result.action_items.length) {
    html += `
      <div class="cc-result-section">
        <div class="cc-result-label">Action Items</div>
        ${result.action_items.map(a => `
          <div class="cc-briefing-item priority-${a.priority || "medium"}">
            <strong>${a.brand || ""}</strong>: ${a.action || a.text || ""}
            ${a.deadline ? `<span class="cc-briefing-date">${a.deadline}</span>` : ""}
          </div>
        `).join("")}
      </div>
    `;
  }

  return html || `<pre class="cc-result-raw">${JSON.stringify(result, null, 2)}</pre>`;
}

/* ---- UTILITIES ---- */
function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeForAttr(str) {
  if (!str) return "";
  return String(str).replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
}

function copyToClipboard(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.innerHTML;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5db87a" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copied`;
    btn.style.color = "#5db87a";
    setTimeout(() => { btn.innerHTML = orig; btn.style.color = ""; }, 2000);
  });
}

function showSkillToast(message, type) {
  const existing = document.querySelector(".cc-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `cc-toast cc-toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
