// Tiny static server for tests: serves public/ with the same SPA fallback
// Cloudflare uses (unknown paths return index.html with HTTP 200) and the
// same response headers (public/_headers), so the Content-Security-Policy
// is enforced in tests exactly as in production. An inline handler or
// inline script that slips in fails the smoke test as a console error.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../public/', import.meta.url));
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json'
};

// Parse the `/*` block of public/_headers (Cloudflare's format).
export function siteHeaders() {
  const out = {};
  let text = '';
  try { text = fs.readFileSync(path.join(ROOT, '_headers'), 'utf8'); } catch (e) { return out; }
  let inCatchAll = false;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) { inCatchAll = line.trim() === '/*'; continue; }
    if (!inCatchAll) continue;
    const i = line.indexOf(':');
    if (i > 0) out[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  return out;
}

export function startServer(port) {
  const headers = siteHeaders();
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(200, { ...headers, 'content-type': 'text/html' });
      res.end(fs.readFileSync(path.join(ROOT, 'index.html')));
      return;
    }
    res.writeHead(200, { ...headers, 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(fs.readFileSync(f));
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

// Playwright: use the locally installed Chrome (no browser download). In
// CI, ubuntu runners ship google-chrome. Override with PW_CHANNEL / PW_EXECUTABLE.
export function launchOptions() {
  const opts = { headless: true };
  if (process.env.PW_EXECUTABLE) opts.executablePath = process.env.PW_EXECUTABLE;
  else opts.channel = process.env.PW_CHANNEL || 'chrome';
  return opts;
}
