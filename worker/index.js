// Arkives — Worker entry. Only /api/* runs here (wrangler.jsonc
// run_worker_first); every other request is served from public/ by the
// assets layer with the _headers file applied, exactly as before.
import { handleScan } from './scan.js';

export default {
  async fetch(req, env) {
    const { pathname } = new URL(req.url);
    if (pathname === '/api/social-scan') return handleScan(req, env);
    if (pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(req);
  },
};
