// Arkives — Worker entry. Only /api/* runs here (wrangler.jsonc
// run_worker_first); every other request is served from public/ by the
// assets layer with the _headers file applied, exactly as before.
// email() receives mail for the domain via Cloudflare Email Routing
// (the brand-deal inbox, worker/inbox.js).
import { handleScan } from './scan.js';
import { handleGoogle } from './google.js';
import { handleEmail } from './inbox.js';

export default {
  async fetch(req, env) {
    const { pathname } = new URL(req.url);
    if (pathname === '/api/social-scan') return handleScan(req, env);
    if (pathname.startsWith('/api/google/')) return handleGoogle(req, env);
    if (pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(req);
  },
  async email(message, env) {
    return handleEmail(message, env);
  },
};
