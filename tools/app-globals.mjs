// Generates tools/app-globals.json: every top-level function / let / const /
// var across the five classic scripts in public/. They share one global
// scope at runtime, so ESLint needs the list to check `no-undef` without
// drowning in false positives. Re-run after adding a top-level symbol:
//   npm run globals
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('../public/', import.meta.url);
const files = ['app.js', 'invoices.js', 'outreach.js', 'boards.js', 'toolkit-views.js'];
const names = new Set();
for (const f of files) {
  const s = fs.readFileSync(new URL(f, root), 'utf8');
  for (const m of s.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  for (const m of s.matchAll(/^(?:let|const|var)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
}
const out = new URL('./app-globals.json', import.meta.url);
fs.writeFileSync(out, JSON.stringify([...names].sort(), null, 2) + '\n');
console.log(`${names.size} app globals -> ${path.basename(out.pathname)}`);
