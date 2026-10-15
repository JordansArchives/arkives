// Arkives — brand-deal inbox, fed by email forwarding (server side).
//
// Arkives never asks for Gmail access. Each user gets a private address,
// deals-<token>@arkives.xyz (Settings > Connections), and points a Gmail
// filter at it. Cloudflare Email Routing hands every message for the
// domain to this Worker's email() handler, which files a SHORT summary
// (sender, subject, first ~2,000 characters, Message-ID) into that
// user's inbox_items. Attachments and the full body are never stored;
// "Open in Gmail" jumps back to the original by Message-ID.
//
// The write goes through the inbox_ingest RPC, which demands
// ARKIVES_DB_KEY and the address token, caps volume per user per day,
// and dedupes by Message-ID. Unknown addresses are rejected at SMTP time.

import PostalMime from 'postal-mime';
import { SUPABASE_URL, SUPABASE_ANON } from './scan.js';

export const MAX_RAW_BYTES = 10 * 1024 * 1024;
export const PREVIEW_CHARS = 2000;
const FREEMAIL = new Set(['gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'live.com']);

export function addressToken(to) {
  const m = /^deals-([a-z0-9]{24,64})@/i.exec(String(to || '').trim());
  return m ? m[1].toLowerCase() : null;
}

export function htmlToText(html) {
  return String(html || '')
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

export function preview(text) {
  return String(text || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, PREVIEW_CHARS);
}

// "partnerships@nike.com" -> "Nike"; freemail senders fall back to their name
export function brandGuess(fromName, fromEmail) {
  const domain = String(fromEmail || '').split('@')[1] || '';
  const d = domain.toLowerCase();
  if (!d || FREEMAIL.has(d)) return String(fromName || fromEmail || '').slice(0, 200);
  const parts = d.split('.');
  const core = parts.length > 2 && /^(co|com|org|net)$/.test(parts[parts.length - 2]) ? parts[parts.length - 3] : parts[parts.length - 2] || parts[0];
  return core ? core.charAt(0).toUpperCase() + core.slice(1) : String(fromName || '');
}

export async function summarize(raw) {
  const mail = await PostalMime.parse(raw);
  const from = mail.from || {};
  const fromEmail = String(from.address || '').slice(0, 200);
  const fromName = String(from.name || fromEmail || 'Unknown sender').slice(0, 200);
  const received = Date.parse(mail.date || '') || Date.now();
  return {
    p_from_name: fromName,
    p_from_email: fromEmail,
    p_brand: brandGuess(fromName, fromEmail),
    p_subject: String(mail.subject || '(No subject)').slice(0, 500),
    p_preview: preview(mail.text || htmlToText(mail.html)),
    p_message_id: String(mail.messageId || '').replace(/^<|>$/g, '').slice(0, 500),
    p_received_at: new Date(received).toISOString(),
  };
}

export async function handleEmail(message, env, fetchImpl = fetch) {
  const token = addressToken(message.to);
  if (!token) { message.setReject('Unknown address'); return; }
  if (!env.ARKIVES_DB_KEY) { message.setReject('Inbox not configured'); return; }
  if (message.rawSize > MAX_RAW_BYTES) { message.setReject('Message too large'); return; }
  const raw = await new Response(message.raw).arrayBuffer();
  const fields = await summarize(raw);
  const r = await fetchImpl(`${SUPABASE_URL}/rest/v1/rpc/inbox_ingest`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_key: env.ARKIVES_DB_KEY, p_token: token, ...fields }),
  });
  const res = r.ok ? await r.json().catch(() => null) : null;
  if (res === 'unknown') { message.setReject('Unknown address'); return; }
  // 'ok' | 'duplicate' | 'limit' are accepted silently. A failed write is
  // logged (Workers observability) rather than bounced, so a Supabase
  // hiccup never makes Gmail disable the forwarding rule.
  if (!r.ok) console.error('inbox_ingest failed', r.status);
}
