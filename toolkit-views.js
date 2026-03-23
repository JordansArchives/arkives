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
/* ---- CONTRACT DEFAULTS (persisted to Supabase user_settings) ---- */
var CONTRACT_DEFAULTS = {
  creatorEntity: 'Asterisk LLC',
  creatorDBA: 'Asterisk LLC',
  creatorTitle: 'Managing Member',
  creatorState: 'Colorado',
  revisionExtraCost: 500,
  paidMediaFloor: 5000,
  crossPostFee: 30,
  nonDisparagement: 6,
  mediationDays: 30,
  contentExclusions: 'raw footage, outtakes, drafts, behind-the-scenes material, working files',
  invoiceMethod: 'email',
  paymentMethod: 'wire transfer or ACH',
  approvalConsequence: 'approval of the Content as delivered',
  forceMajeureDays: 30
};

/* Load contract defaults from Supabase on init */
async function loadContractDefaults() {
  if (typeof _sb === 'undefined' || !_sb || typeof CREATOR === 'undefined' || !CREATOR._sbId) return;
  try {
    var res = await _sb.from('user_settings').select('*').eq('user_id', CREATOR._sbId).eq('key', 'contract_defaults').maybeSingle();
    if (res.data && res.data.value) {
      try {
        var saved = JSON.parse(res.data.value);
        Object.assign(CONTRACT_DEFAULTS, saved);
      } catch(e) { /* ignore parse errors */ }
    }
  } catch(e) { console.warn('loadContractDefaults:', e); }
}

async function saveContractDefaults() {
  if (typeof _sb === 'undefined' || !_sb || typeof CREATOR === 'undefined' || !CREATOR._sbId) return;
  // Read values from the settings form
  var fields = {
    creatorEntity: 'cdEntity', creatorDBA: 'cdDBA', creatorTitle: 'cdTitle',
    creatorState: 'cdState', contentExclusions: 'cdExclusions',
    invoiceMethod: 'cdInvoiceMethod', paymentMethod: 'cdPaymentMethod',
    approvalConsequence: 'cdApprovalConsequence'
  };
  var numFields = {
    revisionExtraCost: 'cdRevCost', paidMediaFloor: 'cdPaidFloor',
    crossPostFee: 'cdCrossPost', nonDisparagement: 'cdNonDisp',
    mediationDays: 'cdMedDays', forceMajeureDays: 'cdFMDays'
  };
  for (var k in fields) {
    var el = document.getElementById(fields[k]);
    if (el) CONTRACT_DEFAULTS[k] = el.value.trim();
  }
  for (var k2 in numFields) {
    var el2 = document.getElementById(numFields[k2]);
    if (el2) CONTRACT_DEFAULTS[k2] = Number(el2.value) || 0;
  }
  try {
    await _sb.from('user_settings').upsert({
      user_id: CREATOR._sbId, key: 'contract_defaults',
      value: JSON.stringify(CONTRACT_DEFAULTS)
    }, { onConflict: 'user_id,key' });
    showToast('Contract defaults saved');
  } catch(e) {
    console.error('saveContractDefaults:', e);
    showToast('Failed to save defaults');
  }
}

function toggleContractDefaults() {
  var panel = document.getElementById('contractDefaultsPanel');
  var arrow = document.getElementById('contractDefaultsArrow');
  if (!panel) return;
  var isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (arrow) arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
}

function renderContracts() {
  const container = document.getElementById("view-contracts");
  const today = new Date().toISOString().split('T')[0];

  // Load defaults from Supabase (async, will be ready for next generate)
  loadContractDefaults();

  // Build deliverable options from RATE_CARD if available
  const deliverableOptions = (() => {
    const items = [];
    if (typeof RATE_CARD !== 'undefined') {
      ['organic', 'ugc', 'tiktok', 'youtube'].forEach(cat => {
        if (RATE_CARD[cat]) RATE_CARD[cat].forEach(r => {
          if (r.name && !items.find(i => i.name === r.name)) items.push({ name: r.name, rate: r.rate || 0 });
        });
      });
    }
    if (!items.length) {
      return [
        { name: 'Instagram Reels', rate: 15000 }, { name: 'Instagram Static / Carousel', rate: 8000 },
        { name: 'Instagram Stories', rate: 5000 }, { name: 'UGC Video (30s)', rate: 3000 },
        { name: 'UGC Video (60s)', rate: 5000 }, { name: 'YouTube Integration', rate: 20000 },
        { name: 'YouTube Dedicated Video', rate: 35000 }, { name: 'TikTok Video', rate: 12000 }
      ];
    }
    return items;
  })();

  // Build deal options for pre-fill dropdown
  const dealOpts = (typeof DEALS !== 'undefined' && DEALS.length)
    ? DEALS.map((d, i) => `<option value="${i}">${d.brand || 'Untitled'} — ${d.campaign || d.scope || 'No campaign'}</option>`).join('')
    : '';

  const platformCheckboxes = ['Instagram', 'TikTok', 'YouTube', 'X (Twitter)', 'LinkedIn'].map(p =>
    `<label class="contract-checkbox"><input type="checkbox" value="${p}" class="cPlatformCheck"${p === 'Instagram' ? ' checked' : ''}> ${p}</label>`
  ).join('');

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Contract Builder</h1>
        <p class="view-subtitle">Generate professional partnership agreements from your template</p>
      </div>
    </div>

    <!-- Contract Defaults Settings (collapsible) -->
    <div class="contract-defaults-toggle" onclick="toggleContractDefaults()">
      <svg id="contractDefaultsArrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transition:transform 0.2s;vertical-align:-1px;margin-right:6px;"><polyline points="6 9 12 15 18 9"/></svg>
      Contract Defaults
    </div>
    <div id="contractDefaultsPanel" class="contract-defaults-panel" style="display:none;">
      <div class="form-row">
        <div class="form-group">
          <label>Creator Entity Name</label>
          <input type="text" id="cdEntity" value="${CONTRACT_DEFAULTS.creatorEntity}" placeholder="Asterisk LLC">
        </div>
        <div class="form-group">
          <label>Doing Business As (DBA)</label>
          <input type="text" id="cdDBA" value="${CONTRACT_DEFAULTS.creatorDBA}" placeholder="Asterisk LLC">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Signing Title</label>
          <input type="text" id="cdTitle" value="${CONTRACT_DEFAULTS.creatorTitle}" placeholder="Managing Member">
        </div>
        <div class="form-group">
          <label>Home State</label>
          <input type="text" id="cdState" value="${CONTRACT_DEFAULTS.creatorState}" placeholder="Colorado">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Extra Revision Cost ($)</label>
          <input type="number" id="cdRevCost" value="${CONTRACT_DEFAULTS.revisionExtraCost}">
        </div>
        <div class="form-group">
          <label>Paid Media Floor ($/mo)</label>
          <input type="number" id="cdPaidFloor" value="${CONTRACT_DEFAULTS.paidMediaFloor}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Cross-Post Fee (%)</label>
          <input type="number" id="cdCrossPost" value="${CONTRACT_DEFAULTS.crossPostFee}">
        </div>
        <div class="form-group">
          <label>Non-Disparagement (months)</label>
          <input type="number" id="cdNonDisp" value="${CONTRACT_DEFAULTS.nonDisparagement}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Mediation Period (days)</label>
          <input type="number" id="cdMedDays" value="${CONTRACT_DEFAULTS.mediationDays}">
        </div>
        <div class="form-group">
          <label>Force Majeure Termination (days)</label>
          <input type="number" id="cdFMDays" value="${CONTRACT_DEFAULTS.forceMajeureDays}">
        </div>
      </div>
      <div class="form-group">
        <label>Content Definition Exclusions</label>
        <input type="text" id="cdExclusions" value="${CONTRACT_DEFAULTS.contentExclusions}" placeholder="raw footage, outtakes, drafts...">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Invoice Method</label>
          <input type="text" id="cdInvoiceMethod" value="${CONTRACT_DEFAULTS.invoiceMethod}" placeholder="email">
        </div>
        <div class="form-group">
          <label>Payment Method</label>
          <input type="text" id="cdPaymentMethod" value="${CONTRACT_DEFAULTS.paymentMethod}" placeholder="wire transfer or ACH">
        </div>
      </div>
      <div class="form-group">
        <label>Approval Consequence (if client misses deadline)</label>
        <input type="text" id="cdApprovalConsequence" value="${CONTRACT_DEFAULTS.approvalConsequence}" placeholder="approval of the Content as delivered">
      </div>
      <button class="btn btn-secondary" onclick="saveContractDefaults()" style="margin-top:8px;">Save Defaults</button>
    </div>

    <div class="contract-builder">
      <div class="contract-form">

        ${dealOpts ? `
        <div class="form-group contract-form-section">
          <label>Load from Existing Deal</label>
          <select id="cLoadDeal" onchange="prefillContractFromDeal()">
            <option value="">— Select a deal to pre-fill —</option>
            ${dealOpts}
          </select>
        </div>
        <hr class="contract-divider">
        ` : ''}

        <h3 class="contract-form-heading">Parties</h3>
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
            <label>Contact Title</label>
            <input type="text" id="cContactTitle" placeholder="e.g., VP of Marketing">
          </div>
        </div>
        <div class="form-group">
          <label>Contact Email</label>
          <input type="email" id="cContactEmail" placeholder="e.g., sarah@acme.com">
        </div>
        <div class="form-group">
          <label>Brand Address (Street)</label>
          <input type="text" id="cBrandStreet" placeholder="e.g., 123 Market St, Suite 400">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>City</label>
            <input type="text" id="cBrandCity" placeholder="e.g., San Francisco">
          </div>
          <div class="form-group">
            <label>State</label>
            <input type="text" id="cBrandState" placeholder="e.g., CA">
          </div>
        </div>
        <div class="form-group" style="max-width:200px;">
          <label>Zip Code</label>
          <input type="text" id="cBrandZip" placeholder="e.g., 94105">
        </div>
        <div class="form-group">
          <label>Agreement Date</label>
          <input type="date" id="cDate" value="${today}">
        </div>

        <hr class="contract-divider">
        <h3 class="contract-form-heading">Deal</h3>
        <div class="form-group">
          <label>Campaign Name</label>
          <input type="text" id="cCampaign" placeholder="e.g., AI Sustainability for Creatives">
        </div>
        <div class="form-group">
          <label>Campaign Description / Context</label>
          <textarea id="cContext" rows="3" placeholder="Describe the campaign goals, context, and any special terms…"></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Deliverable Type</label>
            <select id="cDeliverable" onchange="contractDeliverableChanged()">
              ${deliverableOptions.map(d => `<option value="${d.name}" data-rate="${d.rate}">${d.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Number of Deliverables</label>
            <input type="number" id="cNumDeliverables" value="1" min="1">
          </div>
        </div>
        <div class="form-group">
          <label>Platform(s)</label>
          <div class="contract-platform-checks">${platformCheckboxes}</div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Compensation Model</label>
            <select id="cCompModel" onchange="togglePerfFields()">
              <option value="flat">Flat Rate</option>
              <option value="performance">Performance-Based</option>
            </select>
          </div>
          <div class="form-group">
            <label>Base Amount ($)</label>
            <input type="number" id="cAmount" placeholder="15000" value="15000">
          </div>
        </div>
        <div class="form-group">
          <label>Payment Terms</label>
          <select id="cPayTerms">
            <option value="50/50">50% on brief approval, 50% on delivery</option>
            <option value="NET30">NET 30 from delivery</option>
            <option value="100UP">100% upfront before production begins</option>
            <option value="custom">Custom (specify in notes)</option>
          </select>
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

        <hr class="contract-divider">
        <h3 class="contract-form-heading">Rights & Terms</h3>
        <div class="form-row">
          <div class="form-group">
            <label>Content License Duration</label>
            <select id="cLicense">
              <option value="30">30 days organic</option>
              <option value="90">90 days organic (+25%)</option>
              <option value="180">6 months organic (+50%)</option>
              <option value="perpetual">Perpetual (3x base)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Paid Ad Rights</label>
            <select id="cPaidAd">
              <option value="none">None — separate agreement required</option>
              <option value="included">Included in fee</option>
              <option value="separate">Separate agreement ($5K/mo floor)</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Exclusivity</label>
            <select id="cExcl">
              <option value="none">None</option>
              <option value="30">30 days (+20%)</option>
              <option value="60">60 days (+35%)</option>
              <option value="90">90 days (+50%)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Term / Duration</label>
            <input type="text" id="cTerm" placeholder="e.g., 3 months from first content publish">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Governing Law State</label>
            <input type="text" id="cGovLaw" value="Colorado">
          </div>
          <div class="form-group">
            <label>Revision Rounds</label>
            <input type="number" id="cRevisions" value="2" min="1">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Approval Timeline (hours)</label>
            <input type="number" id="cApprovalHrs" value="48" min="24" step="24">
          </div>
          <div class="form-group">
            <label>Kill Fee — Standard (%)</label>
            <input type="number" id="cKillStd" value="50" min="0" max="100">
          </div>
        </div>
        <div class="form-group" style="max-width:200px;">
          <label>Kill Fee — Breach (%)</label>
          <input type="number" id="cKillBreach" value="100" min="0" max="100">
        </div>

        <div class="contract-actions">
          <button class="btn btn-primary" onclick="generateContract()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            Generate Contract
          </button>
          <button class="btn btn-secondary" onclick="generateNegotiationNotes()">AI Negotiation Notes</button>
        </div>
      </div>

      <div class="contract-preview">
        <div class="contract-preview-header">
          <h4>Contract Preview</h4>
          <div class="contract-preview-actions">
            <button class="btn btn-sm btn-secondary" onclick="copyContractPreview()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px"><rect x="9" y="9" width="13" height="13" rx="1"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copy
            </button>
            <button class="btn btn-sm btn-primary" onclick="downloadContractPDF()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              PDF
            </button>
          </div>
        </div>
        <div id="contractPreviewContent" class="preview-content">
          <p class="text-muted" style="text-align:center;padding:40px 20px;">Fill in the form and click "Generate Contract" to preview your agreement</p>
        </div>
      </div>
    </div>

    <div class="card mt-3">
      <div class="card-header"><span class="card-title">Negotiation Checklist</span></div>
      <div class="card-body">
        <div class="checklist-grid">
          ${typeof CONTRACT_RULES !== 'undefined' && CONTRACT_RULES.length ? `
          <div class="check-group">
            <h4>Contract Rules</h4>
            ${CONTRACT_RULES.map(r => `<div class="checklist-item">${r.rule}</div>`).join('')}
          </div>
          ` : `
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
          `}
        </div>
      </div>
    </div>
  `;
}

/* ---- CONTRACT: Pre-fill from Deal ---- */
function prefillContractFromDeal() {
  const sel = document.getElementById('cLoadDeal');
  const idx = parseInt(sel.value, 10);
  if (isNaN(idx) || !DEALS[idx]) return;
  const d = DEALS[idx];
  const setVal = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
  setVal('cBrandName', d.brand);
  setVal('cBrandShort', d.brand);
  setVal('cContact', d.contact);
  setVal('cContactEmail', d.email);
  setVal('cCampaign', d.campaign || d.scope);
  setVal('cContext', d.notes);
  setVal('cTerm', d.term);
  if (d.value) setVal('cAmount', d.value);
  if (d.deliverables) {
    const delSel = document.getElementById('cDeliverable');
    for (let i = 0; i < delSel.options.length; i++) {
      if (d.deliverables.toLowerCase().includes(delSel.options[i].value.toLowerCase())) {
        delSel.selectedIndex = i; break;
      }
    }
  }
  showToast('Deal loaded: ' + d.brand);
}

/* ---- CONTRACT: Update amount hint when deliverable changes ---- */
function contractDeliverableChanged() {
  const sel = document.getElementById('cDeliverable');
  const opt = sel.options[sel.selectedIndex];
  const rate = opt.getAttribute('data-rate');
  if (rate && Number(rate) > 0) {
    document.getElementById('cAmount').placeholder = Number(rate).toLocaleString();
  }
}

/* ---- CONTRACT: Toggle performance fields ---- */
function togglePerfFields() {
  document.getElementById("perfFields").style.display =
    document.getElementById("cCompModel").value === "performance" ? "block" : "none";
}

/* ---- CONTRACT: Gather all form data ---- */
function gatherContractData() {
  const v = (id, fallback) => (document.getElementById(id)?.value || '').trim() || fallback || '';
  // Read latest values from the defaults panel (if open) before gathering
  var cdEl = document.getElementById('cdEntity');
  if (cdEl) {
    CONTRACT_DEFAULTS.creatorEntity = cdEl.value.trim() || CONTRACT_DEFAULTS.creatorEntity;
    CONTRACT_DEFAULTS.creatorDBA = (document.getElementById('cdDBA')?.value || '').trim() || CONTRACT_DEFAULTS.creatorDBA;
    CONTRACT_DEFAULTS.creatorTitle = (document.getElementById('cdTitle')?.value || '').trim() || CONTRACT_DEFAULTS.creatorTitle;
    CONTRACT_DEFAULTS.creatorState = (document.getElementById('cdState')?.value || '').trim() || CONTRACT_DEFAULTS.creatorState;
    CONTRACT_DEFAULTS.revisionExtraCost = Number(document.getElementById('cdRevCost')?.value) || CONTRACT_DEFAULTS.revisionExtraCost;
    CONTRACT_DEFAULTS.paidMediaFloor = Number(document.getElementById('cdPaidFloor')?.value) || CONTRACT_DEFAULTS.paidMediaFloor;
    CONTRACT_DEFAULTS.crossPostFee = Number(document.getElementById('cdCrossPost')?.value) || CONTRACT_DEFAULTS.crossPostFee;
    CONTRACT_DEFAULTS.nonDisparagement = Number(document.getElementById('cdNonDisp')?.value) || CONTRACT_DEFAULTS.nonDisparagement;
    CONTRACT_DEFAULTS.mediationDays = Number(document.getElementById('cdMedDays')?.value) || CONTRACT_DEFAULTS.mediationDays;
    CONTRACT_DEFAULTS.contentExclusions = (document.getElementById('cdExclusions')?.value || '').trim() || CONTRACT_DEFAULTS.contentExclusions;
    CONTRACT_DEFAULTS.invoiceMethod = (document.getElementById('cdInvoiceMethod')?.value || '').trim() || CONTRACT_DEFAULTS.invoiceMethod;
    CONTRACT_DEFAULTS.paymentMethod = (document.getElementById('cdPaymentMethod')?.value || '').trim() || CONTRACT_DEFAULTS.paymentMethod;
    CONTRACT_DEFAULTS.approvalConsequence = (document.getElementById('cdApprovalConsequence')?.value || '').trim() || CONTRACT_DEFAULTS.approvalConsequence;
    CONTRACT_DEFAULTS.forceMajeureDays = Number(document.getElementById('cdFMDays')?.value) || CONTRACT_DEFAULTS.forceMajeureDays;
  }

  const creatorName = (typeof CREATOR !== 'undefined' && CREATOR.name) ? CREATOR.name : 'Jordan Watkins';
  const creatorEntity = CONTRACT_DEFAULTS.creatorEntity;
  const creatorEmail = (typeof CREATOR !== 'undefined' && CREATOR.email) ? CREATOR.email : '';

  const platforms = Array.from(document.querySelectorAll('.cPlatformCheck:checked')).map(cb => cb.value);

  const payTermsMap = {
    '50/50': '50% upon brief approval and 50% upon final delivery of all Content',
    'NET30': 'NET 30 days from delivery of final Content',
    '100UP': '100% upfront before production begins',
    'custom': 'As mutually agreed upon in writing'
  };

  const licenseMap = {
    '30': { text: 'thirty (30) days', label: '30 days' },
    '90': { text: 'ninety (90) days', label: '90 days' },
    '180': { text: 'six (6) months', label: '6 months' },
    'perpetual': { text: 'perpetuity', label: 'Perpetual' }
  };

  const exclMap = {
    'none': null,
    '30': { text: 'thirty (30) days', label: '30 days' },
    '60': { text: 'sixty (60) days', label: '60 days' },
    '90': { text: 'ninety (90) days', label: '90 days' }
  };

  const licenseVal = v('cLicense', '30');
  const exclVal = v('cExcl', 'none');

  return {
    brand: v('cBrandName', '[BRAND LEGAL NAME]'),
    brandShort: v('cBrandShort', '[BRAND]'),
    contact: v('cContact', '[CONTACT NAME]'),
    contactTitle: v('cContactTitle', '[TITLE]'),
    contactEmail: v('cContactEmail', ''),
    brandStreet: v('cBrandStreet', '[ADDRESS]'),
    brandCity: v('cBrandCity', '[CITY]'),
    brandState: v('cBrandState', '[STATE]'),
    brandZip: v('cBrandZip', '[ZIP]'),
    date: v('cDate', '[DATE]'),
    campaign: v('cCampaign', '[CAMPAIGN NAME]'),
    context: v('cContext', ''),
    deliverable: v('cDeliverable', 'Instagram Reels'),
    numDeliverables: parseInt(v('cNumDeliverables', '1'), 10) || 1,
    platforms: platforms.length ? platforms : ['Instagram'],
    compModel: v('cCompModel', 'flat'),
    amount: Number(v('cAmount', '15000')) || 15000,
    payTermsKey: v('cPayTerms', '50/50'),
    payTerms: payTermsMap[v('cPayTerms', '50/50')] || payTermsMap['50/50'],
    perfMetric: v('cPerfMetric', 'Instagram Reel Plays'),
    perfRate: Number(v('cPerfRate', '30')) || 30,
    perfThreshold: Number(v('cPerfThreshold', '500000')) || 500000,
    perfCap: Number(v('cPerfCap', '35000')) || 35000,
    license: licenseMap[licenseVal] || licenseMap['30'],
    licenseKey: licenseVal,
    paidAd: v('cPaidAd', 'none'),
    excl: exclMap[exclVal],
    exclKey: exclVal,
    term: v('cTerm', '[TERM]'),
    govLaw: v('cGovLaw', 'Colorado'),
    revisions: parseInt(v('cRevisions', '2'), 10) || 2,
    approvalHrs: parseInt(v('cApprovalHrs', '48'), 10) || 48,
    killStd: parseInt(v('cKillStd', '50'), 10),
    killBreach: parseInt(v('cKillBreach', '100'), 10),
    creatorName,
    creatorEntity,
    creatorEmail
  };
}

/* ---- CONTRACT: Build all 20 sections as array ---- */
function buildContractSections(d) {
  const fmt = n => '$' + Number(n).toLocaleString();
  const totalComp = d.amount * d.numDeliverables;
  const platformList = d.platforms.join(', ');
  const brandAddr = [d.brandStreet, d.brandCity, d.brandState, d.brandZip].filter(Boolean).join(', ');
  const dateFormatted = d.date !== '[DATE]' ? new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '[DATE]';

  const sections = [];

  // PREAMBLE
  sections.push({
    num: null, title: 'CONTENT CREATOR PARTNERSHIP AGREEMENT', body:
    `This Content Creator Partnership Agreement ("Agreement") is entered into as of <strong>${dateFormatted}</strong> ("Effective Date"), by and between:\n\n` +
    `<strong>${d.creatorEntity}</strong> ("Creator"), a ${CONTRACT_DEFAULTS.creatorState} limited liability company operated by ${d.creatorName}, doing business as ${CONTRACT_DEFAULTS.creatorDBA}` +
    (d.creatorEmail ? `, email: ${d.creatorEmail}` : '') + `;\n\n` +
    `and\n\n` +
    `<strong>${d.brand}</strong> ("Client"), represented by ${d.contact}, ${d.contactTitle}` +
    (d.contactEmail ? `, email: ${d.contactEmail}` : '') +
    (brandAddr && brandAddr !== '[ADDRESS], [CITY], [STATE], [ZIP]' ? `, address: ${brandAddr}` : '') + `.\n\n` +
    `Whereas, Creator is a content production company with an established audience and expertise in visual storytelling, video production, and creative education;\n\n` +
    `Whereas, ${d.brandShort} desires to engage Creator for the creation of original content promoting ${d.brandShort}'s products and services;` +
    (d.context ? `\n\nWhereas, ${d.context};` : '') +
    `\n\nNow, therefore, in consideration of the mutual promises and obligations set forth herein, and for other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the parties agree as follows:`
  });

  // 1. SCOPE OF WORK
  sections.push({ num: 1, title: 'SCOPE OF WORK', body:
    `Creator shall produce and deliver the following content as further described in Exhibit A:\n\n` +
    `<strong>Deliverable:</strong> ${d.deliverable}\n` +
    `<strong>Quantity:</strong> ${d.numDeliverables} deliverable${d.numDeliverables > 1 ? 's' : ''}\n` +
    `<strong>Platform(s):</strong> ${platformList}\n` +
    `<strong>Campaign:</strong> "${d.campaign}"\n\n` +
    `"Content" means the final, published ${d.deliverable} delivered by Creator under this Agreement, including the visual, audio, and textual elements as posted on Creator's channel(s). Content does not include ${CONTRACT_DEFAULTS.contentExclusions}, or any other material not included in the final published deliverable.\n\n` +
    `"Paid Media" means boosted posts, sponsored ads, dark posts, paid social campaigns, display advertising, and any distribution requiring media spend, regardless of the platform.`
  });

  // 2. TERM
  sections.push({ num: 2, title: 'TERM', body:
    `This Agreement shall commence on the Effective Date and continue for <strong>${d.term}</strong> ("Term"), unless terminated earlier in accordance with the provisions herein.\n\n` +
    `The Term begins on the date the first Content is published and continues for the specified duration. Either party may terminate this Agreement at the end of the Term by providing written notice at least fifteen (15) days prior to expiration.`
  });

  // 3. COMPENSATION
  let compBody = '';
  if (d.compModel === 'flat') {
    compBody = `Client shall pay Creator a flat rate of <strong>${fmt(d.amount)} USD</strong> per deliverable, for a total of <strong>${fmt(totalComp)} USD</strong> for all ${d.numDeliverables} deliverable${d.numDeliverables > 1 ? 's' : ''}, provided that all agreed deliverables are completed in full and on time.`;
  } else {
    compBody = `<strong>Base Rate:</strong> ${fmt(d.amount)} USD per deliverable (${fmt(totalComp)} total for ${d.numDeliverables} deliverable${d.numDeliverables > 1 ? 's' : ''}).\n\n` +
    `<strong>Performance Bonus:</strong> ${fmt(d.perfRate)} per 1,000 ${d.perfMetric} above ${d.perfThreshold.toLocaleString()}, measured fourteen (14) days after publication.\n\n` +
    `<strong>Performance Cap:</strong> ${fmt(d.perfCap)} per deliverable.`;
  }
  compBody += `\n\n<strong>Payment Terms:</strong> ${d.payTerms}.\n\n` +
    `Creator shall submit invoices via ${CONTRACT_DEFAULTS.invoiceMethod}. Payment shall be made by ${CONTRACT_DEFAULTS.paymentMethod}. Client shall be responsible for any applicable processing fees.\n\n` +
    `Creator is an independent contractor and is not entitled to any employee benefits, including but not limited to health insurance, retirement plans, or paid time off.`;
  sections.push({ num: 3, title: 'COMPENSATION', body: compBody });

  // 4. CONTENT LICENSING & USAGE RIGHTS
  let licBody = `Client receives a non-exclusive license to reshare and repost the Content organically for a period of <strong>${d.license.text}</strong> following initial publication, limited to the platform(s) specified herein.`;
  if (d.paidAd === 'none' || d.paidAd === 'separate') {
    licBody += `\n\nPaid media rights (boosted posts, dark posts, paid social, display advertising) require a <strong>separate written agreement</strong> with a minimum floor of <strong>$${CONTRACT_DEFAULTS.paidMediaFloor.toLocaleString()} per month</strong>. No paid media usage is authorized under this Agreement.`;
  } else {
    licBody += `\n\nPaid media rights are included in the compensation above for the duration of the license period.`;
  }
  licBody += `\n\nCross-posting fees: Any reuse of Content on platforms not originally specified shall incur an additional fee of ${CONTRACT_DEFAULTS.crossPostFee}% of the base rate per additional platform.`;
  sections.push({ num: 4, title: 'CONTENT LICENSING & USAGE RIGHTS', body: licBody });

  // 5. INTELLECTUAL PROPERTY
  sections.push({ num: 5, title: 'INTELLECTUAL PROPERTY', body:
    `Creator retains full intellectual property rights and copyright to all Content created under this Agreement. This is not a work-for-hire arrangement, and no assignment of copyright is made.\n\n` +
    `"Content" as defined herein explicitly excludes ${CONTRACT_DEFAULTS.contentExclusions}, and any material not included in the final published deliverable. Creator retains all rights to such excluded materials.\n\n` +
    `Client receives only the specific license rights granted in Section 4 above. Any use beyond those rights requires prior written consent from Creator.`
  });

  // 6. EXCLUSIVITY
  if (d.excl) {
    sections.push({ num: 6, title: 'EXCLUSIVITY', body:
      `During the Term and for a period of <strong>${d.excl.text}</strong> following publication of the final Content, Creator agrees not to publish organic content promoting a direct competitor of Client on the same platform(s) specified in this Agreement.\n\n` +
      `"Direct competitor" is limited to companies offering substantially similar products or services in the same market category. This exclusivity does not restrict Creator from general content creation, other brand partnerships in unrelated categories, or personal content.`
    });
  } else {
    sections.push({ num: 6, title: 'EXCLUSIVITY', body:
      `No exclusivity period applies to this Agreement. Creator is free to engage with other brands, including competitors of Client, at any time during and after the Term.`
    });
  }

  // 7. REVISIONS & APPROVAL
  sections.push({ num: 7, title: 'REVISIONS & APPROVAL', body:
    `Creator shall provide up to <strong>${d.revisions} (${numberToWord(d.revisions)})</strong> round${d.revisions > 1 ? 's' : ''} of revisions per deliverable at no additional cost. Additional revisions beyond this scope shall be billed at <strong>$${CONTRACT_DEFAULTS.revisionExtraCost.toLocaleString()} per round</strong>.\n\n` +
    `Client shall provide feedback or approval within <strong>${d.approvalHrs} hours</strong> of receiving Content for review. Failure to respond within this period shall constitute ${CONTRACT_DEFAULTS.approvalConsequence}.\n\n` +
    `Revision requests must be specific, actionable, and consistent with the original brief. Requests that materially change the scope of the deliverable may be treated as new work and quoted separately.`
  });

  // 8. CANCELLATION & KILL FEE
  sections.push({ num: 8, title: 'CANCELLATION & KILL FEE', body:
    `If Client cancels this Agreement after Creator has begun production:\n\n` +
    `<strong>Standard cancellation:</strong> ${d.killStd}% of the total Agreement value (${fmt(totalComp * d.killStd / 100)}) is due within fifteen (15) days of cancellation notice.\n\n` +
    `<strong>Cancellation due to Client's breach:</strong> ${d.killBreach}% of the total Agreement value (${fmt(totalComp * d.killBreach / 100)}) is due immediately.\n\n` +
    `In either case, Creator retains all rights to any completed or in-progress work, and Client's license to use such work is revoked.`
  });

  // 9. FTC DISCLOSURE
  sections.push({ num: 9, title: 'FTC DISCLOSURE', body:
    `All Content shall include appropriate FTC-compliant disclosures as required by the Federal Trade Commission Endorsement Guides, including but not limited to clear and conspicuous use of "#ad", "sponsored", "paid partnership", or equivalent designations.\n\n` +
    `For video Content, disclosures must be stated verbally within the first thirty (30) seconds and displayed on-screen. Disclosures must be visible without requiring the viewer to click "more" or expand any truncated text.\n\n` +
    `Client shall not request, encourage, or require Creator to omit, obscure, or minimize any FTC-required disclosure.`
  });

  // 10. CONFIDENTIALITY
  sections.push({ num: 10, title: 'CONFIDENTIALITY', body:
    `Each party agrees to keep confidential all non-public information shared by the other party in connection with this Agreement, including but not limited to campaign strategy, pricing, creative briefs, performance data, and business terms.\n\n` +
    `This obligation does not apply to information that: (a) is or becomes publicly available through no fault of the receiving party; (b) was known to the receiving party prior to disclosure; (c) is independently developed by the receiving party; or (d) is required to be disclosed by law or legal process.`
  });

  // 11. LIMITATION OF LIABILITY
  sections.push({ num: 11, title: 'LIMITATION OF LIABILITY', body:
    `Neither party shall be liable to the other for any indirect, incidental, special, consequential, or punitive damages arising out of or related to this Agreement, regardless of the cause of action or theory of liability.\n\n` +
    `Each party's total aggregate liability under this Agreement shall not exceed the total compensation payable hereunder.`
  });

  // 12. INDEMNIFICATION
  sections.push({ num: 12, title: 'INDEMNIFICATION', body:
    `Each party shall indemnify, defend, and hold harmless the other party from and against any third-party claims, damages, losses, and expenses (including reasonable attorneys' fees) arising from: (a) the indemnifying party's breach of this Agreement; (b) the indemnifying party's negligence or willful misconduct; or (c) any violation of applicable law by the indemnifying party.\n\n` +
    `Creator represents that all Content is original work and does not infringe upon any third-party intellectual property rights. Client represents that any materials or products provided to Creator for the campaign are lawfully distributed and comply with all applicable regulations.`
  });

  // 13. INDEPENDENT CONTRACTOR
  sections.push({ num: 13, title: 'INDEPENDENT CONTRACTOR', body:
    `Creator is an independent contractor and not an employee, agent, or partner of Client. Creator shall use their own equipment, set their own schedule, and maintain full creative discretion in producing the Content, subject to the brief and revision process.\n\n` +
    `Creator is solely responsible for all applicable federal, state, and local taxes, including self-employment tax. Client shall not withhold any taxes from payments to Creator. If payments exceed applicable IRS thresholds, Client shall issue a Form 1099.`
  });

  // 14. NON-DISPARAGEMENT
  sections.push({ num: 14, title: 'NON-DISPARAGEMENT', body:
    `During the Term and for a period of ${CONTRACT_DEFAULTS.nonDisparagement} (${numberToWord(CONTRACT_DEFAULTS.nonDisparagement)}) months following termination or expiration of this Agreement, neither party shall make any public statements or communications that disparage, defame, or cast in a negative light the other party, its products, services, officers, directors, or employees.\n\n` +
    `This obligation sunsets automatically ${CONTRACT_DEFAULTS.nonDisparagement} (${numberToWord(CONTRACT_DEFAULTS.nonDisparagement)}) months after the termination or expiration of this Agreement.`
  });

  // 15. DISPUTE RESOLUTION
  sections.push({ num: 15, title: 'DISPUTE RESOLUTION', body:
    `Any dispute arising out of or relating to this Agreement shall first be submitted to good-faith mediation in ${d.govLaw}. If mediation fails to resolve the dispute within ${CONTRACT_DEFAULTS.mediationDays} (${numberToWord(CONTRACT_DEFAULTS.mediationDays)}) days, either party may pursue binding arbitration in ${d.govLaw} under the rules of the American Arbitration Association.\n\n` +
    `Each party shall bear its own costs of mediation and arbitration. The prevailing party in any arbitration shall be entitled to recover reasonable attorneys' fees from the non-prevailing party.`
  });

  // 16. FORCE MAJEURE
  sections.push({ num: 16, title: 'FORCE MAJEURE', body:
    `Neither party shall be liable for any failure or delay in performance under this Agreement due to causes beyond its reasonable control, including but not limited to natural disasters, pandemics, government actions, internet outages, platform policy changes, acts of war or terrorism, or other force majeure events.\n\n` +
    `The affected party shall provide prompt written notice and make reasonable efforts to mitigate the impact. If a force majeure event continues for more than ${CONTRACT_DEFAULTS.forceMajeureDays} (${numberToWord(CONTRACT_DEFAULTS.forceMajeureDays)}) days, either party may terminate this Agreement without penalty.`
  });

  // 17. GOVERNING LAW
  sections.push({ num: 17, title: 'GOVERNING LAW', body:
    `This Agreement shall be governed by and construed in accordance with the laws of the State of ${d.govLaw}, without regard to its conflict of laws provisions.`
  });

  // 18. GENERAL PROVISIONS
  sections.push({ num: 18, title: 'GENERAL PROVISIONS', body:
    `<strong>Entire Agreement:</strong> This Agreement, together with any exhibits attached hereto, constitutes the entire agreement between the parties and supersedes all prior negotiations, representations, or agreements relating to the subject matter herein.\n\n` +
    `<strong>Assignment:</strong> Neither party may assign or transfer this Agreement without the prior written consent of the other party, except that Creator may assign this Agreement to a successor entity.\n\n` +
    `<strong>Amendments:</strong> This Agreement may be amended only by a written instrument signed by both parties.\n\n` +
    `<strong>Severability:</strong> If any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions shall remain in full force and effect.\n\n` +
    `<strong>Notices:</strong> All notices under this Agreement shall be in writing and sent to the email addresses listed above, or such other address as a party may designate in writing.\n\n` +
    `<strong>Counterparts:</strong> This Agreement may be executed in counterparts, each of which shall be deemed an original, and all of which together shall constitute one and the same instrument. Electronic signatures shall be deemed valid and binding.`
  });

  // 19. SIGNATURE BLOCK
  sections.push({ num: null, title: 'SIGNATURES', body: 'SIGNATURES_BLOCK', isSigBlock: true, sigData: d });

  return sections;
}

function numberToWord(n) {
  const words = ['zero','one','two','three','four','five','six','seven','eight','nine','ten'];
  return words[n] || String(n);
}

/* ---- CONTRACT: Generate styled HTML preview ---- */
function generateContract() {
  const d = gatherContractData();
  const sections = buildContractSections(d);
  const previewEl = document.getElementById('contractPreviewContent');

  let html = '<div class="contract-document">';

  sections.forEach(sec => {
    if (sec.isSigBlock) {
      const s = sec.sigData;
      html += `
        <div class="contract-sig-block">
          <p style="margin-bottom:24px;font-weight:700;">IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.</p>
          <div class="contract-sig-row">
            <div class="contract-sig-party">
              <p class="contract-sig-entity">${s.creatorEntity}</p>
              <div class="contract-sig-line"></div>
              <p class="contract-sig-label">By: ${s.creatorName}, ${CONTRACT_DEFAULTS.creatorTitle}</p>
              <div class="contract-sig-line"></div>
              <p class="contract-sig-label">Date</p>
            </div>
            <div class="contract-sig-party">
              <p class="contract-sig-entity">${s.brand}</p>
              <div class="contract-sig-line"></div>
              <p class="contract-sig-label">By: ${s.contact}, ${s.contactTitle}</p>
              <div class="contract-sig-line"></div>
              <p class="contract-sig-label">Date</p>
            </div>
          </div>
        </div>`;
      return;
    }

    if (sec.num === null) {
      // Preamble / title section
      html += `<h2 class="contract-doc-title">${sec.title}</h2>`;
      html += `<div class="contract-section-body">${formatContractBody(sec.body)}</div>`;
    } else {
      html += `<div class="contract-section">`;
      html += `<h3 class="contract-section-heading"><span class="contract-section-num">${sec.num}.</span> ${sec.title}</h3>`;
      html += `<div class="contract-section-body">${formatContractBody(sec.body)}</div>`;
      html += `</div>`;
    }
  });

  html += '</div>';
  previewEl.innerHTML = html;
  showToast('Contract generated');
}

function formatContractBody(text) {
  return text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>').replace(/^/, '<p>').replace(/$/, '</p>');
}

/* ---- CONTRACT: Copy to clipboard ---- */
function copyContractPreview() {
  const el = document.getElementById("contractPreviewContent");
  const text = el.innerText;
  if (!text || text.includes("Fill in the form")) {
    showToast("Generate a contract first");
    return;
  }
  navigator.clipboard.writeText(text).then(() => showToast("Contract copied to clipboard"));
}

/* ---- CONTRACT: Download PDF ---- */
function downloadContractPDF() {
  const previewEl = document.getElementById('contractPreviewContent');
  if (!previewEl.querySelector('.contract-document')) {
    showToast('Generate a contract first');
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    showToast('PDF library still loading — try again in a moment');
    return;
  }

  const d = gatherContractData();
  const sections = buildContractSections(d);
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  var W = doc.internal.pageSize.getWidth();
  var H = doc.internal.pageSize.getHeight();
  var M = 72; // 1 inch margins
  var CW = W - M * 2;

  var TEXT_C = [30, 28, 25];
  var MUTED_C = [110, 108, 105];
  var ACCENT = [199, 53, 57];
  var RULE_C = [200, 198, 193];

  function setColor(c) { doc.setTextColor(c[0], c[1], c[2]); }
  function setDraw(c) { doc.setDrawColor(c[0], c[1], c[2]); }

  function checkPage(y, needed) {
    if (y + needed > H - M) {
      doc.addPage();
      drawFooter();
      return M + 10;
    }
    return y;
  }

  var pageNum = 0;
  function drawFooter() {
    pageNum++;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setColor(MUTED_C);
    doc.text(d.creatorEntity + ' — ' + d.brand + ' Partnership Agreement', M, H - 30);
    doc.text('Page ' + pageNum, W - M, H - 30, { align: 'right' });
    setDraw(RULE_C);
    doc.setLineWidth(0.5);
    doc.line(M, H - 42, W - M, H - 42);
  }

  function writeWrapped(text, x, y, maxW, lineH) {
    // Strip HTML tags for PDF
    text = text.replace(/<strong>/g, '').replace(/<\/strong>/g, '').replace(/<br>/g, '\n').replace(/<\/?p>/g, '\n');
    var lines = doc.splitTextToSize(text, maxW);
    for (var i = 0; i < lines.length; i++) {
      y = checkPage(y, lineH);
      doc.text(lines[i], x, y);
      y += lineH;
    }
    return y;
  }

  function writeBoldWrapped(text, x, y, maxW, lineH) {
    // Handle text with **bold** markers (converted from <strong>)
    text = text.replace(/<\/?p>/g, '\n').replace(/<br>/g, '\n');
    var segments = text.split(/<\/?strong>/g);
    var isBold = false;
    var currentText = '';

    // Flatten: just render as plain with manual bold segments
    segments.forEach(function(seg) {
      if (isBold) {
        currentText += seg; // We'll render it all, but track bold sections
      } else {
        currentText += seg;
      }
      isBold = !isBold;
    });

    // For simplicity in PDF, render with bold inline detection
    var paragraphs = text.split(/\n\n+/);
    paragraphs.forEach(function(para) {
      if (!para.trim()) { y += lineH * 0.5; return; }
      // Check for bold segments
      var parts = para.split(/<strong>/);
      parts.forEach(function(part) {
        var boldSplit = part.split(/<\/strong>/);
        if (boldSplit.length > 1) {
          // First part is bold
          doc.setFont('helvetica', 'bold');
          var boldLines = doc.splitTextToSize(boldSplit[0], maxW);
          for (var i = 0; i < boldLines.length; i++) {
            y = checkPage(y, lineH);
            doc.text(boldLines[i], x, y);
            y += lineH;
          }
          // Rest is normal
          if (boldSplit[1].trim()) {
            doc.setFont('helvetica', 'normal');
            var normLines = doc.splitTextToSize(boldSplit[1], maxW);
            for (var j = 0; j < normLines.length; j++) {
              y = checkPage(y, lineH);
              doc.text(normLines[j], x, y);
              y += lineH;
            }
          }
        } else {
          // No bold in this segment
          doc.setFont('helvetica', 'normal');
          if (part.trim()) {
            var pLines = doc.splitTextToSize(part, maxW);
            for (var k = 0; k < pLines.length; k++) {
              y = checkPage(y, lineH);
              doc.text(pLines[k], x, y);
              y += lineH;
            }
          }
        }
      });
      y += lineH * 0.4;
    });
    doc.setFont('helvetica', 'normal');
    return y;
  }

  // --- PAGE 1: Title ---
  drawFooter();
  var y = M;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  setColor(TEXT_C);
  var titleLines = doc.splitTextToSize('CONTENT CREATOR PARTNERSHIP AGREEMENT', CW);
  titleLines.forEach(function(line) {
    doc.text(line, W / 2, y, { align: 'center' });
    y += 24;
  });

  y += 8;
  setDraw(ACCENT);
  doc.setLineWidth(2);
  doc.line(M + CW * 0.3, y, M + CW * 0.7, y);
  y += 24;

  // Preamble body
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setColor(TEXT_C);
  var preamble = sections[0];
  y = writeBoldWrapped(preamble.body, M, y, CW, 14);
  y += 10;

  // Numbered sections
  for (var s = 1; s < sections.length; s++) {
    var sec = sections[s];
    if (sec.isSigBlock) {
      // Signature block
      y = checkPage(y, 180);
      y += 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      setColor(TEXT_C);
      doc.text('IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.', M, y);
      y += 30;

      // Creator sig
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(d.creatorEntity, M, y);
      y += 30;
      setDraw(TEXT_C);
      doc.setLineWidth(0.5);
      doc.line(M, y, M + CW * 0.4, y);
      y += 14;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      setColor(MUTED_C);
      doc.text('By: ' + d.creatorName + ', Managing Member', M, y);
      y += 20;
      doc.line(M, y, M + CW * 0.25, y);
      y += 14;
      doc.text('Date', M, y);
      y += 30;

      // Client sig
      setColor(TEXT_C);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(d.brand, M, y);
      y += 30;
      setDraw(TEXT_C);
      doc.line(M, y, M + CW * 0.4, y);
      y += 14;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      setColor(MUTED_C);
      doc.text('By: ' + d.contact + ', ' + d.contactTitle, M, y);
      y += 20;
      doc.line(M, y, M + CW * 0.25, y);
      y += 14;
      doc.text('Date', M, y);
      continue;
    }

    if (sec.num === null) continue; // Skip preamble (already rendered)

    y = checkPage(y, 50);

    // Section heading
    setDraw(RULE_C);
    doc.setLineWidth(0.5);
    doc.line(M, y, M + CW, y);
    y += 16;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    setColor(TEXT_C);
    doc.text(sec.num + '. ' + sec.title, M, y);
    y += 18;

    // Section body
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    setColor(TEXT_C);
    y = writeBoldWrapped(sec.body, M, y, CW, 13.5);
    y += 8;
  }

  var filename = (d.brandShort !== '[BRAND]' ? d.brandShort.replace(/[^a-zA-Z0-9]/g, '_') : 'Brand') + '_Contract_' + d.date + '.pdf';
  doc.save(filename);
  showToast('PDF downloaded');
}

/* ---- CONTRACT: AI Negotiation Notes ---- */
async function generateNegotiationNotes() {
  const brand = document.getElementById("cBrandShort")?.value || document.getElementById("cBrandName")?.value;
  const amount = document.getElementById("cAmount")?.value;
  const deliverable = document.getElementById("cDeliverable")?.value;

  if (!brand) { showToast("Enter a brand name first"); return; }

  const previewEl = document.getElementById("contractPreviewContent");
  previewEl.innerHTML = '<div class="loading-pulse">Generating negotiation notes...</div>';

  try {
    const res = await fetch((typeof API_BASE !== 'undefined' ? API_BASE : '') + '/api/generate-content', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content_type: "negotiation",
        topic: brand + ' partnership — ' + deliverable + ' at $' + amount,
        context: 'Brand: ' + brand + ', Deliverable: ' + deliverable + ', Current quote: $' + amount + '. Generate negotiation talking points, value justification, and counter-offer strategies.'
      })
    });
    const data = await res.json();
    if (data.success) {
      previewEl.innerHTML = '<div class="contract-document" style="padding:24px"><div class="contract-section-body">' + data.data.content.replace(/\n/g, '<br>') + '</div></div>';
    } else {
      previewEl.innerHTML = '<p class="text-error">Failed: ' + data.error + '</p>';
    }
  } catch (e) {
    previewEl.innerHTML = '<p class="text-error">Error: ' + e.message + '</p>';
  }
}
