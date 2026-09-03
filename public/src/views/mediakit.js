// Arkives — Media kit view and PDF export.
import { state } from '../state.js';
import { act } from '../lib/actions.js';
import { _esc } from '../lib/esc.js';
import { formatCurrency } from '../lib/format.js';
import { SKETCHY_ICONS } from '../lib/icons.js';


function renderMediaKit() {
  const container = document.getElementById("view-mediakit");
  const totalFollowers = Object.values(state.CREATOR.platforms).reduce((s, p) => s + p.followersNum, 0);

  // Identity comes from the profile + platforms — nothing hardcoded
  const mkBrand = state.CREATOR.brand || state.CREATOR.name || 'Your Brand';
  const mkInitials = (state.CREATOR.brand || state.CREATOR.name || '').split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  const mkIgHandle = (state.CREATOR.platforms.instagram.handle || '').replace(/^@/, '');
  const mkContact = state.CREATOR.mkContactEmail || state.CREATOR.email || '';
  const mkAlignYes = state.CREATOR.mkAlignYes || [];
  const mkAlignNo = state.CREATOR.mkAlignNo || [];

  const mkPlatformDefs = [
    { key: 'instagram', cls: 'ig', icon: SKETCHY_ICONS.instagram, label: 'Followers', sub: p => p.engagement + ' Engagement', url: h => 'https://instagram.com/' + h },
    { key: 'tiktok', cls: 'tt', icon: SKETCHY_ICONS.tiktok, label: 'Followers', sub: p => (p.likes || '0') + ' Total Likes', url: h => 'https://tiktok.com/@' + h },
    { key: 'youtube', cls: 'yt', icon: SKETCHY_ICONS.youtube, label: 'Subscribers', sub: p => (p.videos || 0) + ' Videos', url: h => 'https://youtube.com/@' + h },
    { key: 'twitter', cls: 'tw', icon: SKETCHY_ICONS.twitter, label: 'Followers', sub: () => '', url: h => 'https://x.com/' + h },
    { key: 'linkedin', cls: 'li', icon: SKETCHY_ICONS.linkedin, label: 'Followers', sub: p => (p.connections || 0) + ' Connections', url: h => 'https://linkedin.com/in/' + h }
  ];
  const mkPlatformCards = mkPlatformDefs
    .filter(d => { const p = state.CREATOR.platforms[d.key]; return p && (p.handle || p.followersNum > 0); })
    .map(d => {
      const p = state.CREATOR.platforms[d.key];
      const handle = (p.handle || '').replace(/^@/, '');
      const href = p.profileUrl || (handle ? d.url(handle) : '');
      const sub = d.sub(p);
      const inner = `
            <div class="platform-icon ${d.cls}">${d.icon}</div>
            <div class="mk-platform-details">
              <div class="mk-platform-stat">${_esc(p.followers)}</div>
              <div class="mk-platform-label">${d.label}</div>
              ${sub ? `<div class="mk-platform-er">${_esc(sub)}</div>` : ''}
            </div>`;
      return href
        ? `<a href="${_esc(href)}" target="_blank" rel="noopener" class="mk-platform-card mk-platform-link">${inner}</a>`
        : `<div class="mk-platform-card">${inner}</div>`;
    }).join('');

  const mkRateItems = [...state.RATE_CARD.organic, ...state.RATE_CARD.ugc, ...state.RATE_CARD.bundles];

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Media Kit</h1>
        <p class="view-subtitle">Share with brands to showcase your reach and rates</p>
      </div>
      <button class="btn-export-pdf" data-action="exportMediaKitPDF">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Export PDF
      </button>
    </div>

    <div class="media-kit">
      <div class="mk-hero">
        <div class="mk-hero-left">
          <div class="mk-avatar">${_esc(mkInitials)}</div>
          <div>
            <div class="mk-brand-name">
              ${_esc(mkBrand)}
              ${state.CREATOR.platforms.instagram.verified ? '<svg class="mk-verified" width="18" height="18" viewBox="0 0 24 24" fill="var(--teal)"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>' : ''}
            </div>
            ${mkIgHandle ? `<div class="mk-handle">@${_esc(mkIgHandle)}</div>` : ''}
            ${state.CREATOR.niche ? `<div class="mk-niche">${_esc(state.CREATOR.niche)}</div>` : '<div class="mk-niche" style="color:var(--text-faint)">Add your niche in Settings \u2192 Profile</div>'}
          </div>
        </div>
        <div class="mk-hero-stats">
          <div class="mk-total-reach">
            <span class="mk-reach-num">${(totalFollowers / 1000).toFixed(1)}K</span>
            <span class="mk-reach-label">Total Reach</span>
          </div>
        </div>
      </div>

      <div class="mk-section">
        <h3 class="mk-section-title">Platform Presence</h3>
        ${mkPlatformCards
          ? `<div class="mk-platforms">${mkPlatformCards}</div>`
          : '<p style="color:var(--text-muted);font-size:13px">No platforms added yet. Add your handles and stats in Settings → Platforms.</p>'}
      </div>

      <div class="mk-row">
        <div class="mk-section">
          <h3 class="mk-section-title">Audience Demographics</h3>
          ${(!state.AUDIENCE_DATA.ageRange && !state.AUDIENCE_DATA.topCountries.length && !state.AUDIENCE_DATA.gender.male && !state.AUDIENCE_DATA.gender.female)
            ? '<p style="color:var(--text-muted);font-size:13px">No audience data yet. Demographics will appear once audience data is added to your account.</p>'
            : `<div class="mk-demo-grid">
            <div class="mk-demo-item">
              <span class="mk-demo-label">Age Range</span>
              <span class="mk-demo-value">${state.AUDIENCE_DATA.ageRange}</span>
              <span class="mk-demo-detail">Core: ${state.AUDIENCE_DATA.topAge}</span>
            </div>
            <div class="mk-demo-item">
              <span class="mk-demo-label">Gender Split</span>
              <div class="mk-gender-bar">
                <div class="mk-gender-male" style="width:${state.AUDIENCE_DATA.gender.male}%">${state.AUDIENCE_DATA.gender.male}% M</div>
                <div class="mk-gender-female" style="width:${state.AUDIENCE_DATA.gender.female}%">${state.AUDIENCE_DATA.gender.female}% F</div>
              </div>
            </div>
            <div class="mk-demo-item">
              <span class="mk-demo-label">Top Locations</span>
              ${state.AUDIENCE_DATA.topCountries.map(c => `
                <div class="mk-country-row">
                  <span>${_esc(c.name)}</span>
                  <div class="mk-country-bar"><div class="mk-country-fill" style="width:${c.pct}%"></div></div>
                  <span class="mk-country-pct">${c.pct}%</span>
                </div>
              `).join("")}
            </div>
          </div>`}
        </div>

        <div class="mk-section">
          <h3 class="mk-section-title">Brand Alignment</h3>
          <div class="mk-tags">
            ${state.AUDIENCE_DATA.interests.map(i => `<span class="mk-tag">${_esc(i)}</span>`).join("")}
          </div>
          ${(mkAlignYes.length || mkAlignNo.length) ? `
          <div class="mk-alignment-list">
            ${mkAlignYes.map(item => `<div class="mk-alignment-item mk-align-yes"><span class="mk-align-icon">\u2713</span><span>${_esc(item)}</span></div>`).join('')}
            ${mkAlignNo.map(item => `<div class="mk-alignment-item mk-align-no"><span class="mk-align-icon">\u2717</span><span>${_esc(item)}</span></div>`).join('')}
          </div>` : '<p style="color:var(--text-muted);font-size:13px">Tell brands what fits and what doesn\'t in Settings \u2192 Profile \u2192 Media Kit.</p>'}
        </div>
      </div>

      <div class="mk-section">
        <h3 class="mk-section-title">Campaign Performance</h3>
        ${!state.CAMPAIGN_RESULTS.length
          ? '<p style="color:var(--text-muted);font-size:13px">No campaign results yet. Past brand campaigns will show here.</p>'
          : `<div class="mk-campaigns">
          ${state.CAMPAIGN_RESULTS.map(c => `
            <div class="mk-campaign-card">
              <div class="mk-campaign-brand">${_esc(c.brand)}</div>
              <div class="mk-campaign-stats">
                <div class="mk-camp-stat">
                  <span class="mk-camp-value">${c.views ? (c.views >= 1000000 ? (c.views / 1000000).toFixed(1) + "M" : (c.views / 1000).toFixed(0) + "K") : "\u2014"}</span>
                  <span class="mk-camp-label">Views</span>
                </div>
                <div class="mk-camp-stat">
                  <span class="mk-camp-value">${c.ctr || "\u2014"}</span>
                  <span class="mk-camp-label">CTR</span>
                </div>
                <div class="mk-camp-stat">
                  <span class="mk-camp-value">${c.conversion || "\u2014"}</span>
                  <span class="mk-camp-label">Conv.</span>
                </div>
                ${c.revenue ? `<div class="mk-camp-stat"><span class="mk-camp-value" style="color:var(--green)">${formatCurrency(c.revenue)}</span><span class="mk-camp-label">Revenue</span></div>` : ""}
              </div>
            </div>
          `).join("")}
        </div>`}
      </div>

      <div class="mk-section">
        <h3 class="mk-section-title">Rates</h3>
        ${mkRateItems.length ? `
        <div class="mk-rates">
          ${mkRateItems.map(r => `<div class="mk-rate-card"><div class="mk-rate-name">${_esc(r.name)}</div><div class="mk-rate-price">${r.rate ? '$' + r.rate.toLocaleString('en-US') : (r.range ? _esc(r.range) : "Let's talk")}</div></div>`).join('')}
        </div>
        <p style="color:var(--text-muted);font-size:12px;margin-top:12px">All pricing is flat-rate. Licensing, exclusivity, and paid ad usage rights available as add-ons.</p>
        ` : '<p style="color:var(--text-muted);font-size:13px">No rates set yet. Build your rate card in Settings → Rate Card.</p>'}
      </div>

      ${mkContact ? `
      <div class="mk-footer">
        <p>Contact: <a href="mailto:${_esc(mkContact)}" style="color:var(--accent)">${_esc(mkContact)}</a></p>
      </div>` : ''}
    </div>
  `;
}
async function _getBrandLogoDataUrl() {
  if (state._brandLogoDataUrl) return state._brandLogoDataUrl;
  try {
    const resp = await fetch('logo-black.png');
    if (!resp.ok) return null;
    const blob = await resp.blob();
    state._brandLogoDataUrl = await new Promise(resolve => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch (e) { state._brandLogoDataUrl = null; }
  return state._brandLogoDataUrl;
}

async function exportMediaKitPDF() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert('PDF library is still loading. Please try again in a moment.');
    return;
  }
  var brandLogo = await _getBrandLogoDataUrl();
  try {
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });

  // Identity comes from the profile + platforms — nothing hardcoded
  var mkBrand = state.CREATOR.brand || state.CREATOR.name || 'Media Kit';
  var mkIgHandle = (state.CREATOR.platforms.instagram.handle || '').replace(/^@/, '');
  var mkContact = state.CREATOR.mkContactEmail || state.CREATOR.email || '';
  var mkTagline = (state.CREATOR.niche || '').replace(/\s*·\s*/g, '  |  ');
  function mkPlatformUrl(key) {
    var p = state.CREATOR.platforms[key] || {};
    if (p.profileUrl) return p.profileUrl;
    var h = (p.handle || '').replace(/^@/, '');
    if (!h) return '';
    switch (key) {
      case 'instagram': return 'https://instagram.com/' + h;
      case 'tiktok': return 'https://tiktok.com/@' + h;
      case 'youtube': return 'https://youtube.com/@' + h;
      case 'twitter': return 'https://x.com/' + h;
      case 'linkedin': return 'https://linkedin.com/in/' + h;
    }
    return '';
  }
  var W = doc.internal.pageSize.getWidth();
  var H = doc.internal.pageSize.getHeight();
  var M = 50;
  var CW = W - M * 2;

  // Brand colors
  var CREAM = [245, 241, 237];
  var TEXT_DARK = [26, 23, 20];
  var RED = [199, 53, 57];
  var TEAL = [42, 107, 90];
  var MUTED = [122, 121, 116];
  var BORDER_C = [26, 23, 20];
  var LIGHT_BG = [251, 249, 245];
  var DIVIDER = [212, 209, 202];

  function setColor(c) { doc.setTextColor(c[0], c[1], c[2]); }
  function setDraw(c) { doc.setDrawColor(c[0], c[1], c[2]); }
  function setFill(c) { doc.setFillColor(c[0], c[1], c[2]); }

  function drawPageBg() {
    setFill(CREAM);
    doc.rect(0, 0, W, H, 'F');
    setFill(RED);
    doc.rect(0, 0, W, 5, 'F');
  }

  function drawCard(x, y, w, h) {
    setFill(LIGHT_BG);
    setDraw(BORDER_C);
    doc.setLineWidth(1.5);
    doc.rect(x, y, w, h, 'FD');
  }

  // Section title: clean, no underline — just a red square bullet
  function sectionTitle(title, y) {
    setFill(RED);
    doc.rect(M, y - 8, 4, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    setColor(TEXT_DARK);
    doc.text(title, M + 10, y);
    return y + 22;
  }

  function pageFooter(pageNum, totalPages) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setColor(MUTED);
    doc.text(mkBrand + "  |  Media Kit  |  " + new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), W / 2, H - 22, { align: 'center' });
    doc.text(pageNum + ' / ' + totalPages, W - M, H - 22, { align: 'right' });
    setFill(RED);
    doc.rect(0, H - 5, W, 5, 'F');
  }

  var PLATFORM_URLS = {
    instagram: mkPlatformUrl('instagram'),
    tiktok: mkPlatformUrl('tiktok'),
    youtube: mkPlatformUrl('youtube'),
    twitter: mkPlatformUrl('twitter'),
    linkedin: mkPlatformUrl('linkedin')
  };

  // ==================== PAGE 1 ====================
  drawPageBg();
  var Y = 38;

  // Brand logo (box mark) — 905x729 source, kept to aspect
  if (brandLogo) doc.addImage(brandLogo, 'PNG', M, Y - 13, 20.4, 16.4);

  // Brand name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  setColor(TEXT_DARK);
  doc.text(mkBrand, brandLogo ? M + 30 : M, Y);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(MUTED);
  doc.text('MEDIA KIT  |  ' + new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), M + 28, Y + 13);

  Y += 32;

  // Divider
  setDraw(RED);
  doc.setLineWidth(2);
  doc.line(M, Y, M + 50, Y);
  setDraw(DIVIDER);
  doc.setLineWidth(0.5);
  doc.line(M + 52, Y, W - M, Y);

  Y += 18;

  // Creator info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(TEXT_DARK);
  if (mkIgHandle) doc.text('@' + mkIgHandle, M, Y);
  setColor(MUTED);
  if (mkTagline) doc.text(mkTagline, mkIgHandle ? M + 80 : M, Y);
  setColor(TEAL);
  if (mkContact) doc.text(mkContact, W - M, Y, { align: 'right' });

  Y += 24;

  // ---- TOTAL REACH BANNER ----
  var totalFollowers = Object.values(state.CREATOR.platforms).reduce(function(s, p) { return s + p.followersNum; }, 0);
  var reachStr = totalFollowers >= 1000000 ? (totalFollowers / 1000000).toFixed(1) + 'M' : (totalFollowers / 1000).toFixed(1) + 'K';

  drawCard(M, Y, CW, 48);

  // Left side: TOTAL REACH label + big number side by side
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setColor(MUTED);
  doc.text('TOTAL REACH', M + 14, Y + 20);

  doc.setFontSize(22);
  setColor(RED);
  doc.text(reachStr, M + 14, Y + 38);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(MUTED);
  var reachNumW = doc.getTextWidth(reachStr);
  doc.setFontSize(22);
  reachNumW = doc.getTextWidth(reachStr);
  doc.setFontSize(9);
  doc.text('across all platforms', M + 16 + reachNumW + 8, Y + 38);

  // Right: engagement
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setColor(TEAL);
  doc.text(state.CREATOR.platforms.instagram.engagement + ' IG Engagement', W - M - 14, Y + 30, { align: 'right' });

  Y += 68;

  // ---- PLATFORM PRESENCE ----
  Y = sectionTitle('Platform Presence', Y);

  var platforms = [
    { key: 'instagram', name: 'Instagram', followers: state.CREATOR.platforms.instagram.followers, detail: state.CREATOR.platforms.instagram.engagement + ' Engagement', icon: 'IG' },
    { key: 'tiktok', name: 'TikTok', followers: state.CREATOR.platforms.tiktok.followers, detail: state.CREATOR.platforms.tiktok.likes + ' Total Likes', icon: 'TT' },
    { key: 'youtube', name: 'YouTube', followers: state.CREATOR.platforms.youtube.followers, detail: state.CREATOR.platforms.youtube.videos + ' Videos', icon: 'YT' },
    { key: 'twitter', name: 'Twitter / X', followers: state.CREATOR.platforms.twitter.followers, detail: 'New Account', icon: 'X' },
    { key: 'linkedin', name: 'LinkedIn', followers: state.CREATOR.platforms.linkedin.followers, detail: state.CREATOR.platforms.linkedin.connections + ' Connections', icon: 'LI' }
  ];

  var cardW = (CW - 16) / 3;
  var cardH = 56;
  platforms.forEach(function(p, i) {
    var col = i % 3;
    var row = Math.floor(i / 3);
    var cx = M + col * (cardW + 8);
    var cy = Y + row * (cardH + 10);

    drawCard(cx, cy, cardW - 2, cardH);

    // Clickable link on the card (only when the platform has a URL)
    if (PLATFORM_URLS[p.key]) doc.link(cx, cy, cardW - 2, cardH, { url: PLATFORM_URLS[p.key] });

    // Icon circle
    var iconColors = { IG: [225, 48, 108], TT: [0, 0, 0], YT: [255, 0, 0], X: [0, 0, 0], LI: [0, 119, 181] };
    setFill(iconColors[p.icon] || TEXT_DARK);
    doc.circle(cx + 17, cy + 19, 9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text(p.icon, cx + 17, cy + 21.5, { align: 'center' });

    // Follower count
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    setColor(TEXT_DARK);
    doc.text(String(p.followers), cx + 33, cy + 18);

    // Platform name
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    setColor(MUTED);
    doc.text(p.name, cx + 33, cy + 29);

    // Detail stat
    doc.setFontSize(7);
    setColor(TEAL);
    doc.text(p.detail, cx + 33, cy + 40);
  });

  Y += Math.ceil(platforms.length / 3) * (cardH + 10) + 20;

  // ---- AUDIENCE DEMOGRAPHICS ----
  Y = sectionTitle('Audience Demographics', Y);

  var halfW = (CW - 14) / 2;

  // Left card: Age + Gender
  drawCard(M, Y, halfW, 100);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setColor(MUTED);
  doc.text('AGE RANGE', M + 12, Y + 16);
  doc.setFontSize(16);
  setColor(TEXT_DARK);
  doc.text(state.AUDIENCE_DATA.ageRange, M + 12, Y + 33);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setColor(MUTED);
  doc.text('Core: ' + state.AUDIENCE_DATA.topAge, M + 12, Y + 44);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setColor(MUTED);
  doc.text('GENDER', M + 12, Y + 62);
  var barX = M + 12;
  var barW = halfW - 24;
  var barY2 = Y + 68;
  var maleW = barW * (state.AUDIENCE_DATA.gender.male / 100);
  setFill(TEAL);
  doc.rect(barX, barY2, maleW, 12, 'F');
  setFill(RED);
  doc.rect(barX + maleW, barY2, barW - maleW, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(state.AUDIENCE_DATA.gender.male + '% M', barX + 6, barY2 + 9);
  doc.text(state.AUDIENCE_DATA.gender.female + '% F', barX + maleW + 6, barY2 + 9);

  // Right card: Top Locations (FIXED: bars stay inside card)
  var rX = M + halfW + 14;
  drawCard(rX, Y, halfW, 100);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setColor(MUTED);
  doc.text('TOP LOCATIONS', rX + 12, Y + 16);

  var locLabelW = 70;
  var locPctW = 28;
  var locBarMaxW = halfW - locLabelW - locPctW - 30;
  state.AUDIENCE_DATA.topCountries.forEach(function(c, i) {
    var ly = Y + 30 + i * 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setColor(TEXT_DARK);
    doc.text(c.name, rX + 12, ly);
    // Bar bg
    setFill([230, 226, 220]);
    doc.rect(rX + locLabelW + 14, ly - 5, locBarMaxW, 6, 'F');
    // Bar fill
    setFill(TEAL);
    doc.rect(rX + locLabelW + 14, ly - 5, locBarMaxW * (c.pct / 100), 6, 'F');
    // Pct
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    setColor(MUTED);
    doc.text(c.pct + '%', rX + locLabelW + 14 + locBarMaxW + 4, ly);
  });

  Y += 122;

  // ---- BRAND ALIGNMENT ----
  Y = sectionTitle('Brand Alignment', Y);

  // Tags
  var tagX = M;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  state.AUDIENCE_DATA.interests.forEach(function(interest) {
    var tw = doc.getTextWidth(interest) + 14;
    if (tagX + tw > W - M) {
      tagX = M;
      Y += 18;
    }
    setFill([230, 226, 220]);
    setDraw(BORDER_C);
    doc.setLineWidth(0.7);
    doc.rect(tagX, Y - 8, tw, 16, 'FD');
    setColor(TEXT_DARK);
    doc.text(interest, tagX + 7, Y + 2);
    tagX += tw + 5;
  });

  Y += 22;

  var alignYes = state.CREATOR.mkAlignYes || [];
  var alignNo = state.CREATOR.mkAlignNo || [];

  alignYes.forEach(function(item) {
    setFill(TEAL);
    doc.circle(M + 5, Y - 2, 4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text('+', M + 5, Y, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    setColor(TEXT_DARK);
    doc.text(item, M + 16, Y);
    Y += 13;
  });
  alignNo.forEach(function(item) {
    setFill(RED);
    doc.circle(M + 5, Y - 2, 4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text('-', M + 5, Y, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    setColor(TEXT_DARK);
    doc.text(item, M + 16, Y);
    Y += 13;
  });

  pageFooter('1', '2');

  // ==================== PAGE 2 ====================
  doc.addPage();
  drawPageBg();
  Y = 36;

  // ---- CAMPAIGN PERFORMANCE ----
  Y = sectionTitle('Campaign Performance', Y);

  var campCardW = (CW - 16) / 3;
  var campCardH = 78;
  state.CAMPAIGN_RESULTS.forEach(function(c, i) {
    var cx = M + i * (campCardW + 8);
    drawCard(cx, Y, campCardW - 4, campCardH);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setColor(TEXT_DARK);
    doc.text(c.brand, cx + 10, Y + 16);

    var stats = [
      { label: 'Views', value: c.views ? (c.views >= 1000000 ? (c.views / 1000000).toFixed(1) + 'M' : (c.views / 1000).toFixed(0) + 'K') : '--' },
      { label: 'CTR', value: c.ctr || '--' },
      { label: 'Conv.', value: c.conversion || '--' }
    ];
    if (c.revenue) stats.push({ label: 'Revenue', value: '$' + (c.revenue / 1000).toFixed(0) + 'K' });

    var statSpacing = (campCardW - 24) / stats.length;
    stats.forEach(function(s, si) {
      var sx = cx + 10 + si * statSpacing;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      setColor(si === stats.length - 1 && c.revenue ? TEAL : TEXT_DARK);
      doc.text(s.value, sx, Y + 42);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      setColor(MUTED);
      doc.text(s.label, sx, Y + 54);
    });
  });

  Y += campCardH + 28;

  // ---- RATE CARD ----
  Y = sectionTitle('Rate Card', Y);

  // Organic
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setColor(RED);
  doc.text('Organic Content', M, Y);
  Y += 14;

  setFill([230, 226, 220]);
  doc.rect(M, Y - 9, CW, 16, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  setColor(MUTED);
  doc.text('DELIVERABLE', M + 8, Y);
  doc.text('RATE', W - M - 8, Y, { align: 'right' });
  Y += 14;

  state.RATE_CARD.organic.forEach(function(r) {
    setDraw(DIVIDER);
    doc.setLineWidth(0.3);
    doc.line(M, Y + 3, W - M, Y + 3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setColor(TEXT_DARK);
    doc.text(r.name, M + 8, Y);
    doc.setFont('helvetica', 'bold');
    doc.text('$' + r.rate.toLocaleString(), W - M - 8, Y, { align: 'right' });
    Y += 15;
  });

  Y += 16;

  // UGC
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setColor(RED);
  doc.text('UGC Content', M, Y);
  Y += 14;

  setFill([230, 226, 220]);
  doc.rect(M, Y - 9, CW, 16, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  setColor(MUTED);
  doc.text('DELIVERABLE', M + 8, Y);
  doc.text('RATE', W - M - 8, Y, { align: 'right' });
  Y += 14;

  state.RATE_CARD.ugc.forEach(function(r) {
    setDraw(DIVIDER);
    doc.setLineWidth(0.3);
    doc.line(M, Y + 3, W - M, Y + 3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setColor(TEXT_DARK);
    doc.text(r.name, M + 8, Y);
    doc.setFont('helvetica', 'bold');
    doc.text('$' + r.rate.toLocaleString(), W - M - 8, Y, { align: 'right' });
    Y += 15;
  });

  Y += 16;

  // Bundles
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setColor(RED);
  doc.text('Bundles', M, Y);
  Y += 14;

  var bundleCardW = (CW - 10) / 2;
  state.RATE_CARD.bundles.forEach(function(b, i) {
    var col = i % 2;
    var row = Math.floor(i / 2);
    var bx = M + col * (bundleCardW + 10);
    var by = Y + row * 44;

    drawCard(bx, by, bundleCardW - 2, 36);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setColor(TEXT_DARK);
    doc.text(b.name, bx + 10, by + 15, { maxWidth: bundleCardW - 72 });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    setColor(RED);
    doc.text('$' + b.rate.toLocaleString(), bx + bundleCardW - 14, by + 18, { align: 'right' });
  });

  Y += Math.ceil(state.RATE_CARD.bundles.length / 2) * 44 + 16;

  // Terms
  drawCard(M, Y, CW, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  setColor(MUTED);
  doc.text('All pricing is flat-rate. NET 30 terms. Licensing, exclusivity, and paid ad usage rights available as add-ons.', M + 12, Y + 12, { maxWidth: CW - 24 });

  Y += 44;

  // Contact footer
  setDraw(BORDER_C);
  doc.setLineWidth(1.5);
  doc.line(M, Y, W - M, Y);
  Y += 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(TEXT_DARK);
  doc.text("Let's Work Together", M, Y);
  Y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(TEAL);
  if (mkContact) doc.text(mkContact, M, Y);

  pageFooter('2', '2');

  doc.setProperties({
    title: mkBrand + ' - Media Kit',
    author: state.CREATOR.name || mkBrand,
    subject: 'Creator Media Kit',
    creator: 'Arkives CRM'
  });

  doc.save((mkBrand.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'Media_Kit') + '_Media_Kit.pdf');
  } catch (err) {
    console.error('PDF export error:', err);
    alert('Error generating PDF: ' + err.message);
  }
}

act({ exportMediaKitPDF });

export { _getBrandLogoDataUrl, exportMediaKitPDF, renderMediaKit };
