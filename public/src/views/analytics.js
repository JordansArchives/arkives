// Arkives — Social analytics view.
import { state } from '../state.js';
import { fmtDate, fmtDateShort, fmtNum } from '../lib/format.js';
import { SKETCHY_ICONS } from '../lib/icons.js';


function filterHistoryByPeriod(history, period) {
  if (!history || !history.length) return [];
  const now = new Date();
  let cutoff = new Date();
  if (period === "3m") cutoff.setMonth(now.getMonth() - 3);
  else if (period === "6m") cutoff.setMonth(now.getMonth() - 6);
  else if (period === "12m") cutoff.setFullYear(now.getFullYear() - 1);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return history.filter(h => h.date >= cutoffStr);
}

function calcGrowth(history, key) {
  if (!history || history.length < 2) return { delta: 0, pct: 0 };
  const first = history[0][key];
  const last = history[history.length - 1][key];
  if (first == null || last == null) return { delta: 0, pct: 0 };
  const delta = last - first;
  const pct = first > 0 ? ((delta / first) * 100).toFixed(1) : 0;
  return { delta, pct };
}

async function fetchAnalyticsData(refresh = false) {
  state.analyticsLoading = true;
  if (refresh) renderAnalyticsLoading();
  try {
    // Load this user's payload from social_stats (migration 013).
    // No row / missing table = clean empty state, never someone
    // else's numbers — the payload used to ship as a public
    // static file with the owner's stats baked in.
    let cache = null;
    if (state._sb && state.CREATOR._sbId) {
      const res = await state._sb.from('social_stats').select('payload').eq('user_id', state.CREATOR._sbId).limit(1).maybeSingle();
      if (res.error) {
        const missing = (res.error.code === '42P01' || res.error.code === 'PGRST205');
        if (!missing) console.error('social_stats fetch error:', res.error);
      } else if (res.data && res.data.payload && res.data.payload.platforms) {
        cache = res.data.payload;
      }
    }
    if (cache) {
      // Transform: snapshots grouped by date -> history grouped by platform
      const history = { instagram: [], tiktok: [], youtube: [], twitter: [], linkedin: [] };
      (cache.snapshots || []).forEach(snap => {
        if (snap.platform && snap.date) {
          // Old flat format: { platform: 'instagram', date, followers }
          if (history[snap.platform]) history[snap.platform].push(snap);
        } else if (snap.platforms && snap.date) {
          // Unified format: { date, platforms: { instagram: {...}, ...} }
          Object.entries(snap.platforms).forEach(([plat, pdata]) => {
            if (history[plat]) {
              const followers = pdata.followers || pdata.subscribers || pdata.connections || 0;
              history[plat].push({ date: snap.date, followers });
            }
          });
        }
      });
      // Sort each platform's history by date
      Object.keys(history).forEach(p => history[p].sort((a,b) => (a.date||'').localeCompare(b.date||'')));
      state.analyticsData = { ...cache, history };
      state.analyticsLastFetch = cache.last_fetch;
    }
  } catch (e) {
    console.error("Analytics fetch error:", e);
  }
  state.analyticsLoading = false;
  renderAnalytics();
}

function renderAnalyticsLoading() {
  const content = document.getElementById("analyticsContent");
  if (content) {
    content.innerHTML = `
      <div class="card" style="padding:60px;text-align:center">
        <div class="loading-spinner" style="margin:0 auto 16px"></div>
        <p style="color:var(--text-secondary)">Loading your analytics...</p>
        <p style="color:var(--text-muted);font-size:12px;margin-top:4px">This may take a few seconds</p>
      </div>`;
  }
}

function renderAnalytics() {
  const container = document.getElementById("view-analytics");

  // Calculate totals from live data or show defaults
  const p = state.analyticsData ? state.analyticsData.platforms : {};
  const igFollowers = p.instagram ? p.instagram.followers : 0;
  const ttFollowers = p.tiktok ? p.tiktok.followers : 0;
  const ytSubscribers = p.youtube ? p.youtube.subscribers : 0;
  const totalReach = igFollowers + ttFollowers + ytSubscribers;
  const igER = p.instagram ? p.instagram.engagement_rate : 0;
  const sbGrade = p.instagram ? p.instagram.grade : "--";

  // Compute follower growth from history for the selected period (guard for no data)
  const igHistory = (state.analyticsData && state.analyticsData.history && state.analyticsData.history.instagram)
    ? filterHistoryByPeriod(state.analyticsData.history.instagram, state.analyticsTimePeriod)
    : [];
  const igGrowth = calcGrowth(igHistory, "followers");

  const lastFetchDisplay = state.analyticsLastFetch ? new Date(state.analyticsLastFetch).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Never";

  container.innerHTML = `
    <div class="view-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
      <div>
        <h1 class="view-title">Social Analytics</h1>
        <p class="view-subtitle">Live data via Social Blade &middot; Last updated: ${lastFetchDisplay}</p>
      </div>
      <button class="btn btn-primary" id="btnRefreshAnalytics" style="display:flex;align-items:center;gap:6px" ${state.analyticsLoading ? "disabled" : ""}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="${state.analyticsLoading ? 'animation:spin 1s linear infinite' : ''}">
          <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
        </svg>
        ${state.analyticsLoading ? "Refreshing..." : "Refresh Data"}
      </button>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-label">Total Reach</span>
        <span class="kpi-value">${fmtNum(totalReach)}</span>
        <span class="kpi-delta ${igGrowth.delta >= 0 ? 'up' : 'down'}">IG ${igGrowth.delta >= 0 ? '+' : ''}${fmtNum(igGrowth.delta)} (${igGrowth.pct}%)</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">IG Engagement</span>
        <span class="kpi-value">${igER}%</span>
        <span class="kpi-delta ${igER > 3 ? 'up' : ''}">Social Blade avg</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Social Blade Grade</span>
        <span class="kpi-value">${sbGrade}</span>
        <span class="kpi-delta up">Instagram</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">IG Avg Likes</span>
        <span class="kpi-value">${p.instagram ? fmtNum(p.instagram.average_likes) : "--"}</span>
        <span class="kpi-delta">${p.instagram ? fmtNum(p.instagram.average_comments) + " avg comments" : ""}</span>
      </div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:4px">
      <div class="analytics-tabs">
        <button class="analytics-tab ${state.analyticsPlatform === "instagram" ? "active" : ""}" data-ap="instagram">
          <span class="platform-icon ig" style="width:24px;height:24px">${SKETCHY_ICONS.instagramSmall}</span> Instagram
        </button>
        <button class="analytics-tab ${state.analyticsPlatform === "tiktok" ? "active" : ""}" data-ap="tiktok">
          <span class="platform-icon tt" style="width:24px;height:24px">${SKETCHY_ICONS.tiktokSmall}</span> TikTok
        </button>
        <button class="analytics-tab ${state.analyticsPlatform === "youtube" ? "active" : ""}" data-ap="youtube">
          <span class="platform-icon yt" style="width:24px;height:24px">${SKETCHY_ICONS.youtubeSmall}</span> YouTube
        </button>
        <button class="analytics-tab ${state.analyticsPlatform === "twitter" ? "active" : ""}" data-ap="twitter">
          <span class="platform-icon tw" style="width:24px;height:24px">${SKETCHY_ICONS.twitterSmall}</span> Twitter
        </button>
        <button class="analytics-tab ${state.analyticsPlatform === "linkedin" ? "active" : ""}" data-ap="linkedin">
          <span class="platform-icon li" style="width:24px;height:24px">${SKETCHY_ICONS.linkedinSmall}</span> LinkedIn
        </button>
      </div>
      <div class="analytics-period-btns">
        <button class="period-btn ${state.analyticsTimePeriod === '3m' ? 'active' : ''}" data-period="3m">3M</button>
        <button class="period-btn ${state.analyticsTimePeriod === '6m' ? 'active' : ''}" data-period="6m">6M</button>
        <button class="period-btn ${state.analyticsTimePeriod === '12m' ? 'active' : ''}" data-period="12m">12M</button>
      </div>
    </div>

    <div id="analyticsContent">
      ${state.analyticsData ? renderAnalyticsPlatform(state.analyticsPlatform) : '<div class="card" style="padding:60px;text-align:center"><p style="color:var(--text-secondary);font-weight:600;margin-bottom:6px">No analytics connected yet</p><p style="color:var(--text-muted);font-size:13px">Your social stats will appear here once analytics data is added to your account.</p></div>'}
    </div>
  `;

  // Refresh button
  document.getElementById("btnRefreshAnalytics").addEventListener("click", () => fetchAnalyticsData(true));

  // Platform tabs
  container.querySelectorAll(".analytics-tab").forEach(tab => {
    tab.addEventListener("click", function() {
      state.analyticsPlatform = this.dataset.ap;
      container.querySelectorAll(".analytics-tab").forEach(t => t.classList.remove("active"));
      this.classList.add("active");
      renderAnalyticsContent();
    });
  });

  // Period buttons
  container.querySelectorAll(".period-btn").forEach(btn => {
    btn.addEventListener("click", function() {
      state.analyticsTimePeriod = this.dataset.period;
      container.querySelectorAll(".period-btn").forEach(b => b.classList.remove("active"));
      this.classList.add("active");
      renderAnalyticsContent();
    });
  });

  // If no data yet, load from cache first (fast), then user can manually refresh
  if (!state.analyticsData && !state.analyticsLoading) {
    fetchAnalyticsData(false);  // load from cache first
  } else if (state.analyticsData) {
    setTimeout(() => {
      if (document.getElementById("chartGrowth")) {
        renderGrowthChart(state.analyticsPlatform);
      }
      if (state.analyticsPlatform === "instagram" && document.getElementById("chartEngagement")) {
        renderEngagementChart();
      }
    }, 50);
  }
}

function renderAnalyticsContent() {
  const content = document.getElementById("analyticsContent");
  if (!content || !state.analyticsData) return;
  content.innerHTML = renderAnalyticsPlatform(state.analyticsPlatform);
  setTimeout(() => {
    // Render growth chart for any platform that has a canvas
    if (document.getElementById("chartGrowth")) {
      renderGrowthChart(state.analyticsPlatform);
    }
    if (state.analyticsPlatform === "instagram" && document.getElementById("chartEngagement")) {
      renderEngagementChart();
    }
  }, 50);
}

function renderAnalyticsPlatform(platform) {
  if (!state.analyticsData) return '<div class="card"><p class="text-muted" style="padding:20px">No data loaded yet. Click Refresh Data.</p></div>';

  const p = (state.analyticsData && state.analyticsData.platforms) ? state.analyticsData.platforms[platform] : null;
  const history = filterHistoryByPeriod((state.analyticsData && state.analyticsData.history && state.analyticsData.history[platform]) || [], state.analyticsTimePeriod);
  const periodLabel = state.analyticsTimePeriod === "3m" ? "3 Months" : state.analyticsTimePeriod === "6m" ? "6 Months" : "12 Months";

  if (platform === "instagram" && p) {
    const growth = calcGrowth(history, "followers");
    return `
      <div class="analytics-stats-row">
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${fmtNum(p.followers)}</div>
          <div class="analytics-stat-label">Followers</div>
          <div class="analytics-stat-delta ${growth.delta >= 0 ? 'up' : 'down'}">${growth.delta >= 0 ? '+' : ''}${fmtNum(growth.delta)} (${growth.pct}%)</div>
        </div>
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${p.engagement_rate}%</div>
          <div class="analytics-stat-label">Engagement Rate</div>
        </div>
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${fmtNum(p.average_likes)}</div>
          <div class="analytics-stat-label">Avg Likes</div>
        </div>
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${fmtNum(p.average_comments)}</div>
          <div class="analytics-stat-label">Avg Comments</div>
        </div>
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${p.media_count}</div>
          <div class="analytics-stat-label">Posts</div>
        </div>
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${p.grade}</div>
          <div class="analytics-stat-label">SB Grade</div>
        </div>
      </div>
      <div class="chart-row">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Follower Growth (${periodLabel})</span>
            <span class="card-subtitle">${history.length} data points &middot; ${history.length ? fmtDateShort(history[0].date) + ' — ' + fmtDateShort(history[history.length-1].date) : 'No data'}</span>
          </div>
          <div class="chart-container"><canvas id="chartGrowth"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-title">Engagement Rate Trend</span>
            <span class="card-subtitle">Daily engagement % from Social Blade</span>
          </div>
          <div class="chart-container"><canvas id="chartEngagement"></canvas></div>
        </div>
      </div>
      ${history.length < 5 ? `
      <div class="card" style="padding:16px;text-align:center;border:1px dashed var(--border)">
        <p style="color:var(--text-muted);font-size:13px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          Social Blade provides ~15 days of free history. Each time you refresh, new data points are saved and your history grows over time.
        </p>
      </div>` : ''}
    `;
  }

  if (platform === "tiktok" && p) {
    const growth = calcGrowth(history, "followers");
    return `
      <div class="analytics-stats-row">
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${fmtNum(p.followers)}</div>
          <div class="analytics-stat-label">Followers</div>
          <div class="analytics-stat-delta ${growth.delta >= 0 ? 'up' : 'down'}">${growth.delta >= 0 ? '+' : ''}${fmtNum(growth.delta)} (${growth.pct}%)</div>
        </div>
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${fmtNum(p.likes)}</div>
          <div class="analytics-stat-label">Total Likes</div>
        </div>
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${p.videos}</div>
          <div class="analytics-stat-label">Videos</div>
        </div>
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${p.grade}</div>
          <div class="analytics-stat-label">SB Grade</div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Follower Growth (${periodLabel})</span>
          <span class="card-subtitle">${history.length} data points &middot; ${history.length ? fmtDateShort(history[0].date) + ' \u2014 ' + fmtDateShort(history[history.length-1].date) : 'No data'}</span>
        </div>
        <div class="chart-container"><canvas id="chartGrowth"></canvas></div>
      </div>
    `;
  }

  if (platform === "youtube" && p) {
    const growth = calcGrowth(history, "subscribers");
    return `
      <div class="analytics-stats-row">
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${fmtNum(p.subscribers)}</div>
          <div class="analytics-stat-label">Subscribers</div>
          <div class="analytics-stat-delta ${growth.delta >= 0 ? 'up' : 'down'}">${growth.delta >= 0 ? '+' : ''}${fmtNum(growth.delta)} (${growth.pct}%)</div>
        </div>
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${fmtNum(p.views)}</div>
          <div class="analytics-stat-label">Total Views</div>
        </div>
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${p.videos}</div>
          <div class="analytics-stat-label">Videos</div>
        </div>
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${p.grade}</div>
          <div class="analytics-stat-label">SB Grade</div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Subscriber Growth (${periodLabel})</span>
          <span class="card-subtitle">${history.length} data points &middot; ${history.length ? fmtDateShort(history[0].date) + ' \u2014 ' + fmtDateShort(history[history.length-1].date) : 'No data'}</span>
        </div>
        <div class="chart-container"><canvas id="chartGrowth"></canvas></div>
      </div>
    `;
  }

  if (platform === "twitter" && p) {
    const growth = calcGrowth(history, "followers");
    return `
      <div class="analytics-stats-row">
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${fmtNum(p.followers)}</div>
          <div class="analytics-stat-label">Followers</div>
          <div class="analytics-stat-delta ${growth.delta >= 0 ? 'up' : 'down'}">${growth.delta >= 0 ? '+' : ''}${fmtNum(growth.delta)}</div>
        </div>
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${p.tweets || 0}</div>
          <div class="analytics-stat-label">Posts</div>
        </div>
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${p.grade || 'New'}</div>
          <div class="analytics-stat-label">Status</div>
          <div class="analytics-stat-delta">${p.handle ? '@' + p.handle.replace(/^@/, '') : '—'}</div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Follower Growth (${periodLabel})</span>
          <span class="card-subtitle">${history.length} data points &middot; ${history.length ? fmtDateShort(history[0].date) + ' \u2014 ' + fmtDateShort(history[history.length-1].date) : 'No data'}</span>
        </div>
        <div class="chart-container"><canvas id="chartGrowth"></canvas></div>
      </div>
      <div class="card" style="padding:16px;text-align:center;border:1px dashed var(--border)">
        <p style="color:var(--text-muted);font-size:13px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          X/Twitter is a new account &mdash; growth data is based on estimated milestones. Live tracking updates daily.
        </p>
      </div>
    `;
  }

  if (platform === "twitter" && !p) {
    return '<div class="card" style="padding:40px;text-align:center"><p style="color:var(--text-muted)">Click "Refresh Data" to load X/Twitter data</p></div>';
  }

  if (platform === "linkedin" && p) {
    const growth = calcGrowth(history, "followers");
    return `
      <div class="analytics-stats-row">
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${fmtNum(p.followers)}</div>
          <div class="analytics-stat-label">Followers</div>
          <div class="analytics-stat-delta ${growth.delta >= 0 ? 'up' : 'down'}">${growth.delta >= 0 ? '+' : ''}${fmtNum(growth.delta)} (${growth.pct}%)</div>
        </div>
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${fmtNum(p.connections || 0)}</div>
          <div class="analytics-stat-label">Connections</div>
        </div>
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${p.grade || 'N/A'}</div>
          <div class="analytics-stat-label">Status</div>
          <div class="analytics-stat-delta">${p.handle ? '/in/' + p.handle.replace(/^@/, '') + '/' : '—'}</div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Follower Growth (${periodLabel})</span>
          <span class="card-subtitle">${history.length} data points &middot; ${history.length ? fmtDateShort(history[0].date) + ' \u2014 ' + fmtDateShort(history[history.length-1].date) : 'No data'}</span>
        </div>
        <div class="chart-container"><canvas id="chartGrowth"></canvas></div>
      </div>
      <div class="card" style="padding:16px;text-align:center;border:1px dashed var(--border)">
        <p style="color:var(--text-muted);font-size:13px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          LinkedIn growth is based on estimated milestones. Connect the LinkedIn API for live daily tracking.
        </p>
      </div>
    `;
  }

  if (platform === "linkedin" && !p) {
    return '<div class="card" style="padding:40px;text-align:center"><p style="color:var(--text-muted)">Click "Refresh Data" to load LinkedIn data</p></div>';
  }

  return '';
}

function renderGrowthChart(platform) {
  if (!state.analyticsData) return;
  let history = filterHistoryByPeriod((state.analyticsData && state.analyticsData.history && state.analyticsData.history[platform]) || [], state.analyticsTimePeriod);
  if (!history.length) return;

  // Downsample if too many points (keep first, last, and evenly spaced points)
  const maxPoints = state.analyticsTimePeriod === '12m' ? 52 : state.analyticsTimePeriod === '6m' ? 36 : 90;
  if (history.length > maxPoints) {
    const sampled = [history[0]];
    const step = (history.length - 1) / (maxPoints - 1);
    for (let i = 1; i < maxPoints - 1; i++) {
      sampled.push(history[Math.round(i * step)]);
    }
    sampled.push(history[history.length - 1]);
    history = sampled;
  }

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";
  const textColor = isDark ? "#a8a29e" : "#5a5550";

  if (state.chartsRendered.growth) state.chartsRendered.growth.destroy();

  const ctx = document.getElementById("chartGrowth");
  if (!ctx) return;

  const platformColors = {
    instagram: "#E1306C",
    tiktok: "#69C9D0",
    youtube: "#FF0000",
    twitter: "#1DA1F2",
    linkedin: "#0A66C2"
  };

  const followerKey = platform === "youtube" ? "subscribers" : "followers";
  const color = platformColors[platform] || "#4f98a3";

  state.chartsRendered.growth = new Chart(ctx, {
    type: "line",
    data: {
      labels: history.map(h => fmtDate(h.date)),
      datasets: [{
        label: platform === "youtube" ? "Subscribers" : "Followers",
        data: history.map(h => h[followerKey] || 0),
        borderColor: color,
        backgroundColor: color + "20",
        fill: true,
        tension: 0.4,
        pointRadius: history.length > 30 ? 0 : 4,
        pointHoverRadius: 6,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx) { return fmtNum(ctx.raw) + (platform === "youtube" ? " subscribers" : " followers"); },
            title: function(items) { return items[0] ? items[0].label : ""; }
          }
        }
      },
      scales: {
        y: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { family: "'General Sans'", size: 11 },
            callback: function(v) {
              if (v >= 1000000) return (v / 1000000).toFixed(1) + "M";
              if (v >= 1000) return (v / 1000).toFixed(0) + "K";
              return v;
            }
          }
        },
        x: {
          grid: { display: false },
          ticks: {
            color: textColor,
            font: { family: "'General Sans'", size: 11 },
            maxTicksLimit: 8
          }
        }
      }
    }
  });
}

function renderEngagementChart() {
  if (!state.analyticsData) return;
  const history = filterHistoryByPeriod((state.analyticsData && state.analyticsData.history && state.analyticsData.history.instagram) || [], state.analyticsTimePeriod);
  let erHistory = history.filter(h => h.engagement_rate != null);
  if (!erHistory.length) return;

  // Downsample if too many points
  const maxPoints = state.analyticsTimePeriod === '12m' ? 52 : state.analyticsTimePeriod === '6m' ? 36 : 90;
  if (erHistory.length > maxPoints) {
    const sampled = [erHistory[0]];
    const step = (erHistory.length - 1) / (maxPoints - 1);
    for (let i = 1; i < maxPoints - 1; i++) {
      sampled.push(erHistory[Math.round(i * step)]);
    }
    sampled.push(erHistory[erHistory.length - 1]);
    erHistory = sampled;
  }

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";
  const textColor = isDark ? "#a8a29e" : "#5a5550";

  if (state.chartsRendered.engagement) state.chartsRendered.engagement.destroy();
  const ctx = document.getElementById("chartEngagement");
  if (!ctx) return;

  state.chartsRendered.engagement = new Chart(ctx, {
    type: "bar",
    data: {
      labels: erHistory.map(h => fmtDate(h.date)),
      datasets: [{
        label: "Engagement %",
        data: erHistory.map(h => h.engagement_rate),
        backgroundColor: erHistory.map(h => h.engagement_rate > 5 ? "#10b98140" : "#E1306C40"),
        borderColor: erHistory.map(h => h.engagement_rate > 5 ? "#10b981" : "#E1306C"),
        borderWidth: 1,
        borderRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx) { return ctx.raw.toFixed(2) + "% engagement"; }
          }
        }
      },
      scales: {
        y: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { family: "'General Sans'", size: 11 },
            callback: function(v) { return v + "%"; }
          }
        },
        x: {
          grid: { display: false },
          ticks: {
            color: textColor,
            font: { family: "'General Sans'", size: 11 },
            maxTicksLimit: 8
          }
        }
      }
    }
  });
}

export { calcGrowth, fetchAnalyticsData, filterHistoryByPeriod, renderAnalytics, renderAnalyticsContent, renderAnalyticsLoading, renderAnalyticsPlatform, renderEngagementChart, renderGrowthChart };
