/* ===========================================
   Creator Toolkit Views
   Brand Voice, Content Studio, Contract Builder
   =========================================== */

/* ---- BRAND VOICE DATA ---- */
const BRAND_VOICE = {
  visualDNA: {
    title: "Visual DNA Method",
    icon: "🧬",
    summary: "4-phase methodology for extracting and expressing unique visual identity",
    phases: [
      { name: "Extraction", desc: "Pull out what makes you visually distinct — audit content, identify patterns, capture personality", output: "Visual DNA Profile" },
      { name: "Sequencing", desc: "Organize building blocks into a system — 5 DNA strands: Color, Motion, Typography, Composition, Audio", output: "Visual DNA Sequence" },
      { name: "Expression", desc: "Turn the code into content — templates, scripts, visual assets, platform adaptations", output: "Visual DNA Toolkit" },
      { name: "Replication", desc: "Systems to produce consistently — workflows, SOPs, style guides, quality checklists", output: "Operating Manual" }
    ],
    strands: ["Color DNA — Primary palette, accent colors, mood", "Motion DNA — Transitions, pacing, energy level", "Typography DNA — Fonts, text treatments, hierarchy", "Composition DNA — Framing, layouts, visual structure", "Audio DNA — Sound design, music style, voice treatment"]
  },
  offers: {
    title: "Offer Tiers",
    icon: "💎",
    summary: "Two service tiers — DWY for founders who learn, DFY for founders who delegate",
    tiers: [
      { name: "Visual DNA Foundations (DWY)", price: "$3,000–$5,000", duration: "8 weeks", involvement: "High — they do the work with guidance", includes: "Extraction workshop, sequencing templates, asset library, scripting frameworks, group coaching, community access", ideal: "Budget-conscious founders who want to learn and implement themselves" },
      { name: "Visual DNA Build (DFY)", price: "$20,000+", duration: "3–6 months", involvement: "Low — they show up for extraction, we handle the rest", includes: "Full extraction sessions, custom visual identity, content production, launch support, team training, ongoing advisory", ideal: "Founders with budget, zero time — want premium execution without learning the craft" }
    ]
  },
  positioning: {
    title: "Positioning",
    icon: "🎯",
    summary: "\"Content that looks like you, not a template\" — Visual Authority angle",
    taglines: [
      "Your content should be recognized before they read a word",
      "In a sea of templates, be unmistakable",
      "Extract your Visual DNA. Express it everywhere."
    ],
    antiPosition: "Not another agency churning out generic content. Not templates. Not AI-generated slop.",
    differentiators: [
      "Jordan's signature hand-drawn style — impossible to replicate",
      "239K followers as proof of concept",
      "Creator credibility vs. agency theory",
      "Named methodology that sounds proprietary"
    ]
  },
  competitive: {
    title: "Competitive Edge",
    icon: "⚡",
    summary: "How Visual DNA beats competitors across 4 categories",
    comparisons: [
      { type: "Personal branding agencies", their: "LinkedIn/written focus", ours: "Visual-first, video-native" },
      { type: "Ghostwriting agencies", their: "Text-based thought leadership", ours: "Full visual system, not just words" },
      { type: "Video agencies", their: "Volume, speed, templates", ours: "Premium, distinctive, signature style" },
      { type: "Creative consultants", their: "Strategy docs, no execution", ours: "Strategy + execution with unique aesthetic" }
    ]
  },
  motionStandards: {
    title: "Motion & Visual Standards",
    icon: "🎨",
    summary: "Typography, colors, and animation rules for brand consistency",
    typography: { primary: "General Sans — 600 (headings) + 400 (body)", secondary: "Instrument Serif 400 — accent text, editorial moments" },
    colors: [
      { name: "Gold", hex: "#D4A853", use: "Primary accent, CTAs, highlights" },
      { name: "Background", hex: "#1A1A1A", use: "Primary dark background" },
      { name: "Text", hex: "#F5F0E8", use: "Body text, headings" },
      { name: "Muted", hex: "#8B7355", use: "Secondary text, borders" },
      { name: "Surface", hex: "#242424", use: "Cards, elevated surfaces" }
    ],
    animation: "60fps target, 0.3s default duration, ease cubic-bezier(0.4, 0, 0.2, 1)"
  },
  plugin: {
    title: "Plugin License Tiers",
    icon: "🔌",
    summary: "Hand-Drawn Text Animator — 3 pricing tiers for After Effects",
    tiers: [
      { name: "Starter", price: "$79", includes: "Core plugin, 50 presets, personal use" },
      { name: "Pro", price: "$149", includes: "All presets, commercial license, priority support" },
      { name: "Studio", price: "$349", includes: "Unlimited seats, enterprise license, custom presets, white-label" }
    ]
  }
};

/* ---- CONTENT DATA ---- */
const CONTENT_PILLARS = [
  {
    id: "visual-distinction",
    name: "Visual Distinction",
    theme: "How to look unmistakably YOU",
    color: "#D4A853",
    subtopics: ["What makes content memorable vs. forgettable", "Visual DNA concepts (without selling)", "Before/after transformations", "Why your content looks like everyone else's", "Side-by-side diagnostics"],
    contentTypes: "YouTube breakdowns, Instagram carousels, diagnostic reels",
    audience: "#1 challenge (49% — 'finding unique style')",
    hookTypes: "Proof-First + Curiosity Gap"
  },
  {
    id: "trust-over-virality",
    name: "Trust Over Virality",
    theme: "Why views don't pay bills",
    color: "#4A9EBF",
    subtopics: ["High-ticket content strategy", "Why wide content dilutes message", "Founder positioning vs. creator virality", "The content that got me zero views but 6-figure clients", "Defining winning BEFORE posting"],
    contentTypes: "YouTube long-form, LinkedIn posts, thoughtful IG captions",
    audience: "Founders want ROI, not vanity metrics",
    hookTypes: "Contrarian + Fear-Based"
  },
  {
    id: "anti-template",
    name: "The Anti-Template",
    theme: "Contrarian positioning — what we're against",
    color: "#BF4A4A",
    subtopics: ["Why templates make you forgettable", "Agency horror stories", "What I refuse to make", "Generic vs. distinctive (point at the problem)", "Anti-association as positioning"],
    contentTypes: "Provocative reels, 'I don't' carousels, contrarian YouTube takes",
    audience: "Founders burned by agencies, creators sick of looking generic",
    hookTypes: "Contrarian + Pattern Interrupt"
  },
  {
    id: "behind-the-craft",
    name: "Behind the Craft",
    theme: "How it's made — process and quality",
    color: "#6ABF4A",
    subtopics: ["Editing tutorials (hand-drawn animations, motion graphics)", "How I made this breakdowns", "Tools and techniques", "The work behind the work", "Vulnerability moments — creative blocks, failed projects"],
    contentTypes: "YouTube tutorials, Instagram process reels, IG Stories",
    audience: "Creators learn techniques, founders see proof of quality",
    hookTypes: "Proof-First + Curiosity Gap"
  }
];

const HOOKS_LIBRARY = {
  "visual-distinction": {
    "Proof-First": [
      "Watch the difference one visual change makes...",
      "I made one change to this founder's content. Look what happened.",
      "[Split screen] Which founder do you trust more?",
      "This is what 'forgettable' looks like. This is 'memorable.' Here's the difference."
    ],
    "Curiosity Gap": [
      "Here's why your content looks like everyone else's",
      "The visual cue that makes people remember you",
      "What makes content memorable vs. forgettable",
      "Here's why 99% of founder content looks the same"
    ],
    "Fear/Urgency": [
      "3 seconds. That's how long you have to be memorable. Most people blow it here.",
      "3 things that make founders forgettable on camera",
      "3 visual elements that build trust before you speak"
    ]
  },
  "trust-over-virality": {
    "Contrarian": [
      "Views don't pay bills. Here's what does.",
      "Virality is a vanity metric. Trust is the real currency.",
      "I stopped optimizing for views. Revenue went up.",
      "I stopped chasing views. Here's what I chase instead.",
      "Optimize for trust, not views."
    ],
    "Fear-Based": [
      "Your agency got you 1M views. Why didn't anyone buy?",
      "You're optimizing for the wrong metric. Let me show you.",
      "The content that built trust, not followers"
    ],
    "Proof-First": [
      "The content that got me zero views but 6-figure clients",
      "I stopped optimizing for views. Here's what happened.",
      "Views don't pay bills. Trust does."
    ]
  },
  "anti-template": {
    "Contrarian": [
      "Templates make you forgettable. Here's what to do instead.",
      "If you want generic, hire an agency.",
      "Templates are the enemy of recognition.",
      "I don't care if this goes viral — I care if it builds trust"
    ],
    "Pattern Interrupt": [
      "I refuse to make this kind of content. Here's why.",
      "Content I refuse to make (and why)",
      "5 things I'll never do for my clients",
      "What I won't associate with — and why it matters for your brand"
    ],
    "Pain Point": [
      "Your content could be anyone's. That's the problem.",
      "If your content could be anyone's, it won't be remembered"
    ]
  },
  "behind-the-craft": {
    "Proof-First": [
      "How I made this [quick cut to result]",
      "Everyone asks how I get this look. Let me show you.",
      "The technique that makes founders look expensive",
      "I spent 10 hours making this look effortless. Here's the shortcut."
    ],
    "Curiosity Gap": [
      "The hand-drawn animation technique nobody can copy",
      "The technique nobody talks about",
      "How I made this in 10 minutes (not 3 hours)"
    ],
    "Value Promise": [
      "This took me 3 hours. I'll teach you in 3 minutes.",
      "I spent 3 hours making this look effortless. Here's how to do it in 10.",
      "How I made this"
    ]
  }
};

const RE_HOOKS = [
  { type: "Question", example: "But here's the part nobody talks about...", when: "After setup, before payoff" },
  { type: "Scene switch", example: "Cut to new angle, new location, screen share", when: "When energy dips mid-video" },
  { type: "Escalation", example: "And it gets worse. / But that's not even the real problem.", when: "After establishing first point" },
  { type: "Meta-break", example: "I just did it. Let me explain.", when: "When demonstrating the technique you're teaching" },
  { type: "Reversal", example: "Now forget everything I just said.", when: "Contrarian takes, Anti-Template content" }
];

const WEEKLY_CADENCE = [
  { day: "Mon", platform: "Instagram", pillar: "Behind the Craft", format: "Reel (process)", purpose: "Trust", effort: "high" },
  { day: "Tue", platform: "LinkedIn", pillar: "Trust Over Virality", format: "Text post", purpose: "Authority", effort: "low" },
  { day: "Wed", platform: "Instagram", pillar: "Visual Distinction", format: "Carousel", purpose: "Value", effort: "medium" },
  { day: "Thu", platform: "YouTube", pillar: "Rotate", format: "Long-form", purpose: "Depth", effort: "high" },
  { day: "Fri", platform: "Instagram", pillar: "Anti-Template", format: "Reel (contrarian)", purpose: "Reach", effort: "medium" },
  { day: "Sat", platform: "—", pillar: "Rest", format: "—", purpose: "—", effort: "rest" },
  { day: "Sun", platform: "Instagram", pillar: "Behind the Craft", format: "Story dump", purpose: "Connection", effort: "low" }
];

const CONTENT_ANGLES = [
  { name: "Anti-Association", desc: "What I won't associate with — contrarian positioning" },
  { name: "Visual Brand Journey", desc: "4-question framework for visual identity discovery" },
  { name: "Side-by-Side Diagnostic", desc: "Generic vs. distinctive comparison content" },
  { name: "Views Don't Pay Bills", desc: "Challenge virality obsession — series format" },
  { name: "The 3 Things Format", desc: "Numbered list reveals — high engagement pattern" },
  { name: "Comment-Gated Resource", desc: "Free lead magnet via DM automation trigger" },
  { name: "Framework Reveal", desc: "Show Visual DNA Method steps as educational content" },
  { name: "Vulnerable Origin Story", desc: "Why I got tired of seeing forgettable founder content" },
  { name: "Quick Tutorial with Contrast", desc: "I used to [struggle]. Here's what changed." },
  { name: "Barrier Removal", desc: "You don't need [expensive thing]. Here's what I used." },
  { name: "3P Story", desc: "Problem → Pursuit → Payoff storytelling structure" },
  { name: "The Reframe", desc: "Take a negative and flip it into fuel" },
  { name: "Music-Only Visual Showcase", desc: "Plugin demos with trending audio, no voiceover — high volume, low effort" },
  { name: "Poetic Process → Product", desc: "75% creative philosophy, 25% product reveal — product appears LATE" },
  { name: "Superlative Claim", desc: "This is the first [X] ever. One click. Comment [WORD]. 8-12 seconds." },
  { name: "All My [X] Start the Same...", desc: "Signature recurring opener — creates pattern recognition" },
  { name: "Three-Layer Rotation", desc: "Alternate visual proof / short scripts / philosophy for sustainable volume" }
];

const CAPTION_KEYWORDS = {
  "visual-distinction": ["visual identity", "brand identity", "memorable content", "distinctive content", "visual branding", "founder content", "content style", "visual DNA", "recognizable brand"],
  "trust-over-virality": ["trust building", "high-ticket content", "founder positioning", "content strategy", "views vs trust", "content ROI", "brand trust", "business content", "thought leadership"],
  "anti-template": ["generic content", "template-free", "distinctive style", "memorable vs forgettable", "brand differentiation", "unique content", "anti-generic", "visual originality"],
  "behind-the-craft": ["editing tutorial", "motion graphics", "hand-drawn animation", "video editing", "content creation", "editing techniques", "visual effects", "production quality", "creative process"]
};

/* ---- RENDER: BRAND VOICE ---- */
function renderVoice() {
  const container = document.getElementById("view-voice");
  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Brand Voice</h1>
        <p class="view-subtitle">Your identity, methodology, and standards — quick reference</p>
      </div>
    </div>
    <div class="voice-grid">
      ${renderVoiceCard(BRAND_VOICE.visualDNA)}
      ${renderVoiceCard(BRAND_VOICE.offers)}
      ${renderVoiceCard(BRAND_VOICE.positioning)}
      ${renderVoiceCard(BRAND_VOICE.competitive)}
      ${renderVoiceCard(BRAND_VOICE.motionStandards)}
      ${renderVoiceCard(BRAND_VOICE.plugin)}
    </div>
  `;
}

function renderVoiceCard(data) {
  let contentHTML = "";

  if (data.phases) {
    contentHTML += `<div class="voice-section"><h4>The Four Phases</h4>`;
    data.phases.forEach((p, i) => {
      contentHTML += `<div class="voice-phase"><span class="phase-num">${i + 1}</span><div><strong>${p.name}</strong><p>${p.desc}</p><span class="phase-output">Output: ${p.output}</span></div></div>`;
    });
    contentHTML += `</div>`;
    contentHTML += `<div class="voice-section"><h4>5 DNA Strands</h4><ul>${data.strands.map(s => `<li>${s}</li>`).join("")}</ul></div>`;
  }

  if (data.tiers && data.title === "Offer Tiers") {
    data.tiers.forEach(t => {
      contentHTML += `<div class="voice-section tier-card"><h4>${t.name}</h4><div class="tier-price">${t.price}</div><div class="tier-meta">${t.duration} · ${t.involvement}</div><p><strong>Includes:</strong> ${t.includes}</p><p class="tier-ideal"><strong>Ideal for:</strong> ${t.ideal}</p></div>`;
    });
  }

  if (data.taglines) {
    contentHTML += `<div class="voice-section"><h4>Taglines</h4><ul>${data.taglines.map(t => `<li>"${t}"</li>`).join("")}</ul></div>`;
    contentHTML += `<div class="voice-section"><h4>Anti-Positioning</h4><p class="voice-anti">${data.antiPosition}</p></div>`;
    contentHTML += `<div class="voice-section"><h4>Differentiators</h4><ul>${data.differentiators.map(d => `<li>${d}</li>`).join("")}</ul></div>`;
  }

  if (data.comparisons) {
    contentHTML += `<div class="voice-section"><table class="voice-table"><thead><tr><th>Competitor</th><th>Their Approach</th><th>Visual DNA Advantage</th></tr></thead><tbody>`;
    data.comparisons.forEach(c => {
      contentHTML += `<tr><td>${c.type}</td><td>${c.their}</td><td class="advantage">${c.ours}</td></tr>`;
    });
    contentHTML += `</tbody></table></div>`;
  }

  if (data.typography) {
    contentHTML += `<div class="voice-section"><h4>Typography</h4><p><strong>Primary:</strong> ${data.typography.primary}</p><p><strong>Secondary:</strong> ${data.typography.secondary}</p></div>`;
    contentHTML += `<div class="voice-section"><h4>Brand Colors</h4><div class="color-swatches">${data.colors.map(c => `<div class="swatch"><div class="swatch-color" style="background:${c.hex}"></div><div class="swatch-info"><span class="swatch-name">${c.name}</span><span class="swatch-hex">${c.hex}</span><span class="swatch-use">${c.use}</span></div></div>`).join("")}</div></div>`;
    contentHTML += `<div class="voice-section"><h4>Animation</h4><p>${data.animation}</p></div>`;
  }

  if (data.tiers && data.title === "Plugin License Tiers") {
    contentHTML += `<div class="voice-section plugin-tiers">${data.tiers.map(t => `<div class="plugin-tier"><div class="plugin-tier-name">${t.name}</div><div class="plugin-tier-price">${t.price}</div><p>${t.includes}</p></div>`).join("")}</div>`;
  }

  return `
    <div class="voice-card" onclick="this.classList.toggle('expanded')">
      <div class="voice-card-header">
        <span class="voice-icon">${data.icon}</span>
        <div>
          <h3>${data.title}</h3>
          <p>${data.summary}</p>
        </div>
        <button class="btn-copy-sm" onclick="event.stopPropagation(); copyVoiceCard('${data.title}')" title="Copy summary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <svg class="expand-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="voice-card-body">${contentHTML}</div>
    </div>
  `;
}

function copyVoiceCard(title) {
  const data = Object.values(BRAND_VOICE).find(v => v.title === title);
  if (!data) return;
  let text = `${data.title}\n${data.summary}\n`;
  if (data.phases) text += "\nPhases: " + data.phases.map(p => p.name).join(" → ");
  if (data.taglines) text += "\nTaglines:\n" + data.taglines.map(t => `- "${t}"`).join("\n");
  if (data.tiers) text += "\nTiers:\n" + data.tiers.map(t => `- ${t.name}: ${t.price}`).join("\n");
  navigator.clipboard.writeText(text);
  showToast("Copied to clipboard");
}

function showToast(msg) {
  let toast = document.getElementById("toast-notif");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast-notif";
    toast.className = "toast-notification";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}

/* ---- RENDER: CONTENT STUDIO ---- */
function renderContentStudio() {
  const container = document.getElementById("view-contentstudio");
  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Content Studio</h1>
        <p class="view-subtitle">Pillars, hooks, captions, and cadence — your content system</p>
      </div>
    </div>
    <div class="studio-tabs">
      <button class="mode-tab active" data-studio="pillars">Pillars</button>
      <button class="mode-tab" data-studio="hooks">Hook Library</button>
      <button class="mode-tab" data-studio="captions">Caption Builder</button>
      <button class="mode-tab" data-studio="cadence">Weekly Cadence</button>
      <button class="mode-tab" data-studio="angles">Content Angles</button>
    </div>
    <div id="studio-content"></div>
  `;
  container.querySelectorAll(".studio-tabs .mode-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      container.querySelectorAll(".studio-tabs .mode-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      renderStudioTab(tab.dataset.studio);
    });
  });
  renderStudioTab("pillars");
}

function renderStudioTab(tab) {
  const el = document.getElementById("studio-content");
  switch (tab) {
    case "pillars": renderPillarsTab(el); break;
    case "hooks": renderHooksTab(el); break;
    case "captions": renderCaptionsTab(el); break;
    case "cadence": renderCadenceTab(el); break;
    case "angles": renderAnglesTab(el); break;
  }
}

function renderPillarsTab(el) {
  el.innerHTML = `<div class="pillars-grid">${CONTENT_PILLARS.map(p => `
    <div class="pillar-card" style="border-top: 3px solid ${p.color}">
      <div class="pillar-header">
        <h3>${p.name}</h3>
        <span class="pillar-hook-types">${p.hookTypes}</span>
      </div>
      <p class="pillar-theme">${p.theme}</p>
      <div class="pillar-detail">
        <h4>Sub-topics</h4>
        <ul>${p.subtopics.map(s => `<li>${s}</li>`).join("")}</ul>
        <h4>Content Types</h4>
        <p>${p.contentTypes}</p>
        <h4>Audience Signal</h4>
        <p>${p.audience}</p>
      </div>
    </div>
  `).join("")}</div>`;
}

function renderHooksTab(el) {
  const pillars = Object.keys(HOOKS_LIBRARY);
  el.innerHTML = `
    <div class="hooks-filters">
      ${pillars.map((p, i) => `<button class="chip ${i === 0 ? 'active' : ''}" data-pillar="${p}">${CONTENT_PILLARS.find(cp => cp.id === p)?.name || p}</button>`).join("")}
    </div>
    <div id="hooks-list"></div>
    <div class="hooks-section mt-3">
      <h3>Mid-Video Re-Hooks</h3>
      <p class="text-muted">Place at 30-40% mark of any video over 15 seconds</p>
      <div class="rehooks-grid">${RE_HOOKS.map(r => `
        <div class="rehook-card">
          <span class="rehook-type">${r.type}</span>
          <p>"${r.example}"</p>
          <span class="rehook-when">${r.when}</span>
        </div>
      `).join("")}</div>
    </div>
  `;
  renderHooksList(pillars[0]);
  el.querySelectorAll(".hooks-filters .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      el.querySelectorAll(".hooks-filters .chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      renderHooksList(chip.dataset.pillar);
    });
  });
}

function renderHooksList(pillar) {
  const hooks = HOOKS_LIBRARY[pillar] || {};
  const el = document.getElementById("hooks-list");
  let html = "";
  for (const [type, items] of Object.entries(hooks)) {
    html += `<div class="hook-group"><h4>${type}</h4>`;
    items.forEach(hook => {
      html += `<div class="hook-item"><span class="hook-text">"${hook}"</span><button class="btn-copy-sm" onclick="navigator.clipboard.writeText('${hook.replace(/'/g, "\\'")}'); showToast('Hook copied')" title="Copy"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></div>`;
    });
    html += `</div>`;
  }
  el.innerHTML = html;
}

function renderCaptionsTab(el) {
  el.innerHTML = `
    <div class="caption-builder">
      <div class="caption-form">
        <div class="form-group">
          <label>Pillar</label>
          <select id="captionPillar" onchange="updateCaptionKeywords()">
            ${CONTENT_PILLARS.map(p => `<option value="${p.id}">${p.name}</option>`).join("")}
          </select>
        </div>
        <div class="form-group">
          <label>Topic / Subject</label>
          <input type="text" id="captionTopic" placeholder="e.g., Why your content looks generic">
        </div>
        <div class="form-group">
          <label>Hook (first 125 chars)</label>
          <input type="text" id="captionHook" placeholder="e.g., Your content could be anyone's. That's the problem." maxlength="125">
          <span class="char-count" id="hookCharCount">0/125</span>
        </div>
        <div class="form-group">
          <label>Content Breakdown (3-5 sentences)</label>
          <textarea id="captionBreakdown" rows="4" placeholder="→ What this post covers&#10;→ Key insight or framework&#10;→ Why this matters"></textarea>
        </div>
        <div class="form-group">
          <label>Personal Take (2-3 sentences)</label>
          <textarea id="captionPersonal" rows="3" placeholder="Your experience, opinion, or lesson learned"></textarea>
        </div>
        <div class="form-group">
          <label>CTA</label>
          <input type="text" id="captionCTA" placeholder='e.g., Comment "DNA" for the free checklist'>
        </div>
        <div class="form-group">
          <label>Suggested Keywords</label>
          <div id="captionKeywords" class="keyword-chips"></div>
        </div>
        <div class="caption-actions">
          <button class="btn btn-primary" onclick="previewCaption()">Preview</button>
          <button class="btn btn-secondary" onclick="generateCaptionAI()">Generate with AI</button>
        </div>
      </div>
      <div class="caption-preview">
        <h4>Caption Preview</h4>
        <div id="captionPreviewContent" class="preview-content">
          <p class="text-muted">Fill in the form or click "Generate with AI" to see your caption here</p>
        </div>
        <button class="btn btn-secondary mt-2" onclick="copyCaptionPreview()">Copy to Clipboard</button>
      </div>
    </div>
  `;
  updateCaptionKeywords();
  document.getElementById("captionHook").addEventListener("input", function() {
    document.getElementById("hookCharCount").textContent = `${this.value.length}/125`;
  });
}

function updateCaptionKeywords() {
  const pillar = document.getElementById("captionPillar").value;
  const keywords = CAPTION_KEYWORDS[pillar] || [];
  document.getElementById("captionKeywords").innerHTML = keywords.map(k => `<span class="keyword-chip">${k}</span>`).join("");
}

function previewCaption() {
  const hook = document.getElementById("captionHook").value;
  const breakdown = document.getElementById("captionBreakdown").value;
  const personal = document.getElementById("captionPersonal").value;
  const cta = document.getElementById("captionCTA").value;
  const pillar = document.getElementById("captionPillar").value;
  const keywords = CAPTION_KEYWORDS[pillar] || [];
  const hashtags = keywords.slice(0, 4).map(k => "#" + k.replace(/\s+/g, "")).join(" ");

  if (!hook && !breakdown) {
    showToast("Add a hook or content to preview");
    return;
  }

  const preview = `${hook}\n\n${breakdown}\n\n${personal}\n\n${cta}\n\n${hashtags}`;
  document.getElementById("captionPreviewContent").innerHTML = `<pre class="caption-text">${preview}</pre>`;
}

async function generateCaptionAI() {
  const pillar = document.getElementById("captionPillar").value;
  const topic = document.getElementById("captionTopic").value;
  if (!topic) { showToast("Enter a topic first"); return; }

  const previewEl = document.getElementById("captionPreviewContent");
  previewEl.innerHTML = `<div class="loading-pulse">Generating caption...</div>`;

  try {
    const res = await fetch(`${API_BASE}/api/generate-content`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content_type: "caption", pillar, topic })
    });
    const data = await res.json();
    if (data.success) {
      previewEl.innerHTML = `<pre class="caption-text">${data.data.content}</pre>`;
    } else {
      previewEl.innerHTML = `<p class="text-error">Failed: ${data.error}</p>`;
    }
  } catch (e) {
    previewEl.innerHTML = `<p class="text-error">Error: ${e.message}</p>`;
  }
}

function copyCaptionPreview() {
  const text = document.getElementById("captionPreviewContent").innerText;
  navigator.clipboard.writeText(text);
  showToast("Caption copied");
}

function renderCadenceTab(el) {
  const effortColors = { high: "#BF4A4A", medium: "#D4A853", low: "#6ABF4A", rest: "#555" };
  el.innerHTML = `
    <div class="cadence-section">
      <p class="text-muted mb-2">Alternate high and low effort to prevent burnout. Never stack two high-effort days back to back.</p>
      <div class="cadence-table">
        <table>
          <thead><tr><th>Day</th><th>Platform</th><th>Pillar</th><th>Format</th><th>Purpose</th><th>Effort</th></tr></thead>
          <tbody>
            ${WEEKLY_CADENCE.map(d => `
              <tr class="${d.effort === 'rest' ? 'cadence-rest' : ''}">
                <td><strong>${d.day}</strong></td>
                <td>${d.platform}</td>
                <td>${d.pillar}</td>
                <td>${d.format}</td>
                <td>${d.purpose}</td>
                <td><span class="effort-badge" style="background:${effortColors[d.effort]}20;color:${effortColors[d.effort]}">${d.effort}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      <div class="cadence-legend mt-3">
        <h4>Purpose Guide</h4>
        <div class="legend-items">
          <div class="legend-item"><strong>Trust</strong> — Makes people believe you (story, struggle, proof)</div>
          <div class="legend-item"><strong>Authority</strong> — Positions you as worth listening to</div>
          <div class="legend-item"><strong>Value</strong> — Save-worthy breakdown</div>
          <div class="legend-item"><strong>Depth</strong> — Turns followers into community</div>
          <div class="legend-item"><strong>Reach</strong> — Trending format + your message</div>
          <div class="legend-item"><strong>Connection</strong> — Low-pressure, human</div>
        </div>
      </div>
      <div class="content-mix mt-3">
        <h4>Content Mix Rule</h4>
        <div class="mix-bars">
          <div class="mix-bar"><div class="mix-fill" style="width:70%;background:#6ABF4A"></div><span>70% Validated — content you KNOW works</span></div>
          <div class="mix-bar"><div class="mix-fill" style="width:20%;background:#D4A853"></div><span>20% Iterations — tweak hooks/formats on winners</span></div>
          <div class="mix-bar"><div class="mix-fill" style="width:10%;background:#BF4A4A"></div><span>10% Big Swings — find what's next</span></div>
        </div>
      </div>
    </div>
  `;
}

function renderAnglesTab(el) {
  el.innerHTML = `
    <div class="angles-section">
      <p class="text-muted mb-2">17 proven content angles from competitor mining and research</p>
      <div class="angles-grid">
        ${CONTENT_ANGLES.map((a, i) => `
          <div class="angle-card">
            <span class="angle-num">${i + 1}</span>
            <div>
              <strong>${a.name}</strong>
              <p>${a.desc}</p>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

/* ---- RENDER: CONTRACT BUILDER ---- */
function renderContracts() {
  const container = document.getElementById("view-contracts");
  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Contract Builder</h1>
        <p class="view-subtitle">Generate partnership contracts from your template</p>
      </div>
    </div>
    <div class="contract-builder">
      <div class="contract-form">
        <div class="form-row">
          <div class="form-group">
            <label>Brand Legal Name</label>
            <input type="text" id="cBrandName" placeholder="e.g., Acme Inc.">
          </div>
          <div class="form-group">
            <label>Brand Short Name</label>
            <input type="text" id="cBrandShort" placeholder="e.g., Acme">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Contact Name</label>
            <input type="text" id="cContact" placeholder="e.g., Sarah Johnson">
          </div>
          <div class="form-group">
            <label>Agreement Date</label>
            <input type="date" id="cDate" value="${new Date().toISOString().split('T')[0]}">
          </div>
        </div>
        <div class="form-group">
          <label>Brand Description</label>
          <input type="text" id="cBrandDesc" placeholder="e.g., a leading AI-powered creative tool platform">
        </div>
        <div class="form-group">
          <label>Campaign Name</label>
          <input type="text" id="cCampaign" placeholder="e.g., AI Sustainability for Creatives">
        </div>
        <div class="form-group">
          <label>Campaign Context (optional Whereas clause)</label>
          <textarea id="cContext" rows="2" placeholder="e.g., both parties agree that the campaign will position tools as instruments that support the creative process"></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Deliverable Type</label>
            <select id="cDeliverable">
              <option value="Instagram Reels">Instagram Reels</option>
              <option value="Instagram Static / Carousel">Instagram Static / Carousel</option>
              <option value="Instagram Stories">Instagram Stories</option>
              <option value="UGC Video (30s)">UGC Video (30s)</option>
              <option value="UGC Video (60s)">UGC Video (60s)</option>
              <option value="YouTube Integration">YouTube Integration</option>
              <option value="YouTube Dedicated Video">YouTube Dedicated Video</option>
              <option value="TikTok Video">TikTok Video</option>
            </select>
          </div>
          <div class="form-group">
            <label>Compensation Model</label>
            <select id="cCompModel" onchange="togglePerfFields()">
              <option value="flat">Flat Rate</option>
              <option value="performance">Performance-Based</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Base Amount ($)</label>
            <input type="number" id="cAmount" placeholder="15000" value="15000">
          </div>
          <div class="form-group">
            <label>Payment Terms</label>
            <select id="cPayTerms">
              <option value="50% on brief approval, 50% on delivery">50/50 Split</option>
              <option value="NET 30 from delivery">NET 30</option>
              <option value="100% upfront before production begins">100% Upfront</option>
            </select>
          </div>
        </div>
        <div id="perfFields" style="display:none">
          <div class="form-row">
            <div class="form-group">
              <label>Performance Metric</label>
              <input type="text" id="cPerfMetric" placeholder="e.g., Instagram Reel Plays" value="Instagram Reel Plays">
            </div>
            <div class="form-group">
              <label>Bonus Rate ($/1K above threshold)</label>
              <input type="number" id="cPerfRate" placeholder="30" value="30">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Threshold</label>
              <input type="number" id="cPerfThreshold" placeholder="500000" value="500000">
            </div>
            <div class="form-group">
              <label>Cap per deliverable ($)</label>
              <input type="number" id="cPerfCap" placeholder="35000" value="35000">
            </div>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Content License Duration</label>
            <select id="cLicense">
              <option value="30 days organic (2 platforms)">30 days organic (included)</option>
              <option value="90 days organic (+25% base rate)">90 days (+25%)</option>
              <option value="6 months organic (+50% base rate)">6 months (+50%)</option>
              <option value="Perpetual (minimum 3x base)">Perpetual (3x base)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Exclusivity</label>
            <select id="cExcl">
              <option value="none">None</option>
              <option value="30 days (+20% base rate)">30 days (+20%)</option>
              <option value="60 days (+35% base rate)">60 days (+35%)</option>
              <option value="90 days (+50% base rate)">90 days (+50%)</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Term / Duration</label>
          <input type="text" id="cTerm" placeholder="e.g., 3 months from first content publish">
        </div>
        <div class="contract-actions">
          <button class="btn btn-primary" onclick="generateContract()">Generate Contract</button>
          <button class="btn btn-secondary" onclick="generateNegotiationNotes()">AI Negotiation Notes</button>
        </div>
      </div>
      <div class="contract-preview">
        <h4>Contract Preview</h4>
        <div id="contractPreviewContent" class="preview-content">
          <p class="text-muted">Fill in the form and click "Generate Contract" to preview</p>
        </div>
        <div class="contract-preview-actions mt-2">
          <button class="btn btn-secondary" onclick="copyContractPreview()">Copy to Clipboard</button>
        </div>
      </div>
    </div>

    <div class="card mt-3">
      <div class="card-header"><span class="card-title">Negotiation Checklist</span></div>
      <div class="card-body">
        <div class="checklist-grid">
          <div class="check-group">
            <h4>Must-Haves</h4>
            <div class="checklist-item">Sign as Asterisk LLC (not Jordan individually)</div>
            <div class="checklist-item">"Content" defined explicitly — excludes raw footage, outtakes</div>
            <div class="checklist-item">Creator retains full IP/copyright</div>
            <div class="checklist-item">2 revision rounds max</div>
            <div class="checklist-item">Kill fee: 50% standard, 100% on breach</div>
          </div>
          <div class="check-group">
            <h4>Protect</h4>
            <div class="checklist-item">Paid media = separate agreement + $5K floor</div>
            <div class="checklist-item">Organic reshare expires 90 days post-term</div>
            <div class="checklist-item">Non-disparagement sunset: 6 months max</div>
            <div class="checklist-item">Dispute resolution: Mediation in Colorado</div>
            <div class="checklist-item">FTC disclosure required on all content</div>
          </div>
          <div class="check-group">
            <h4>Negotiate Up</h4>
            <div class="checklist-item">Performance bonus structure ($/1K views above threshold)</div>
            <div class="checklist-item">Multi-month retainer for recurring deals</div>
            <div class="checklist-item">Cross-posting fees (+30% per additional platform)</div>
            <div class="checklist-item">Rush delivery surcharge (+25-50%)</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function togglePerfFields() {
  document.getElementById("perfFields").style.display =
    document.getElementById("cCompModel").value === "performance" ? "block" : "none";
}

function generateContract() {
  const brand = document.getElementById("cBrandName").value || "[BRAND LEGAL NAME]";
  const brandShort = document.getElementById("cBrandShort").value || "[BRAND]";
  const contact = document.getElementById("cContact").value || "[CONTACT NAME]";
  const date = document.getElementById("cDate").value || "[DATE]";
  const brandDesc = document.getElementById("cBrandDesc").value || "[BRAND DESCRIPTION]";
  const campaign = document.getElementById("cCampaign").value || "[CAMPAIGN NAME]";
  const context = document.getElementById("cContext").value;
  const deliverable = document.getElementById("cDeliverable").value;
  const compModel = document.getElementById("cCompModel").value;
  const amount = document.getElementById("cAmount").value || "[AMOUNT]";
  const payTerms = document.getElementById("cPayTerms").value;
  const license = document.getElementById("cLicense").value;
  const excl = document.getElementById("cExcl").value;
  const term = document.getElementById("cTerm").value || "[TERM]";

  let compSection = "";
  if (compModel === "flat") {
    compSection = `Compensation: $${Number(amount).toLocaleString()} USD per deliverable, provided that all agreed deliverables are completed in full and on time.\n\nPayment terms: ${payTerms}.`;
  } else {
    const metric = document.getElementById("cPerfMetric").value || "Instagram Reel Plays";
    const rate = document.getElementById("cPerfRate").value || "30";
    const threshold = document.getElementById("cPerfThreshold").value || "500,000";
    const cap = document.getElementById("cPerfCap").value || "35,000";
    compSection = `Base Rate: $${Number(amount).toLocaleString()} USD per deliverable.\n\nPerformance Bonus: $${rate} per 1,000 ${metric} above ${Number(threshold).toLocaleString()}, measured 14 days after publication.\n\nPerformance cap: $${Number(cap).toLocaleString()} per deliverable.\n\nPayment terms: ${payTerms}.`;
  }

  const whereasContext = context ? `\nWhereas, ${context};\n` : "";

  const contract = `CONTENT CREATOR PARTNERSHIP AGREEMENT

This Agreement is entered into as of ${date}, by and between:

Asterisk LLC ("Creator"), a Colorado limited liability company operated by
Jordan Watkins, doing business as @jordans.archives;

and

${brand} ("${brandShort}"), represented by ${contact}.

Whereas, Creator is a content production company with an established audience
and expertise in visual storytelling, video production, and creative education;

Whereas, ${brandShort} is ${brandDesc};
${whereasContext}
Now, therefore, in consideration of the mutual promises and obligations set
forth herein, and for other good and valuable consideration, the receipt and
sufficiency of which are hereby acknowledged, the parties agree as follows:


1. OVERVIEW

The parties agree to collaborate on "${campaign}".

1.1 Definitions

"Content" means the final, published ${deliverable} delivered by Creator under
this Agreement, including the visual, audio, and textual elements as posted on
Creator's channel(s). Content does not include raw footage, outtakes, drafts,
behind-the-scenes material, or any other material not included in the final
published deliverable.

"Paid Media" means boosted posts, sponsored ads, dark posts, paid social
campaigns, display advertising, and any distribution requiring media spend,
regardless of the platform.

"Term" means the period beginning on the date the first Content is published
and continuing for ${term}.


2. COMPENSATION

${compSection}


3. CONTENT LICENSING

${license}.

Paid ad rights require a separate written agreement with a minimum floor of
$5,000 per month.


4. EXCLUSIVITY

${excl === "none" ? "No exclusivity period applies to this Agreement." : `Exclusivity period: ${excl}. During this period, Creator will not publish organic content promoting a direct competitor of ${brandShort} on the same platform(s).`}


5. INTELLECTUAL PROPERTY

Creator retains full intellectual property rights and copyright to all Content.
${brandShort} receives a license to reshare Content organically for 90 days
following the end of the Term.


6. REVISIONS AND APPROVAL

Creator will provide up to two (2) rounds of revisions per deliverable.
Additional revisions beyond this scope will be billed at $500 per round.


7. CANCELLATION AND KILL FEE

If ${brandShort} cancels this Agreement after Creator has begun production:
- Standard cancellation: 50% of the total Agreement value is due.
- Cancellation due to ${brandShort}'s breach: 100% of the total Agreement value.


8. FTC DISCLOSURE

All Content will include appropriate FTC-compliant disclosures as required by
the Federal Trade Commission, including but not limited to "ad", "sponsored",
or "paid partnership" designations.


9. DISPUTE RESOLUTION

Any disputes arising from this Agreement will first be submitted to mediation
in Colorado before either party may pursue litigation.


10. NON-DISPARAGEMENT

The non-disparagement obligation shall sunset six (6) months after the
termination or expiration of this Agreement.


AGREED AND ACCEPTED:

Asterisk LLC
By: Jordan Watkins, Managing Member
Date: _______________


${brand}
By: ${contact}
Title: _______________
Date: _______________`;

  document.getElementById("contractPreviewContent").innerHTML = `<pre class="contract-text">${contract}</pre>`;
}

function copyContractPreview() {
  const text = document.getElementById("contractPreviewContent").innerText;
  if (!text || text.includes("Fill in the form")) {
    showToast("Generate a contract first");
    return;
  }
  navigator.clipboard.writeText(text);
  showToast("Contract copied");
}

async function generateNegotiationNotes() {
  const brand = document.getElementById("cBrandShort").value || document.getElementById("cBrandName").value;
  const amount = document.getElementById("cAmount").value;
  const deliverable = document.getElementById("cDeliverable").value;

  if (!brand) { showToast("Enter a brand name first"); return; }

  const previewEl = document.getElementById("contractPreviewContent");
  previewEl.innerHTML = `<div class="loading-pulse">Generating negotiation notes...</div>`;

  try {
    const res = await fetch(`${API_BASE}/api/generate-content`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content_type: "negotiation",
        topic: `${brand} partnership — ${deliverable} at $${amount}`,
        context: `Brand: ${brand}, Deliverable: ${deliverable}, Current quote: $${amount}. Generate negotiation talking points, value justification, and counter-offer strategies.`
      })
    });
    const data = await res.json();
    if (data.success) {
      previewEl.innerHTML = `<pre class="contract-text">${data.data.content}</pre>`;
    } else {
      previewEl.innerHTML = `<p class="text-error">Failed: ${data.error}</p>`;
    }
  } catch (e) {
    previewEl.innerHTML = `<p class="text-error">Error: ${e.message}</p>`;
  }
}
