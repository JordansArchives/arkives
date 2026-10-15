// Arkives — Worker crypto helpers (WebCrypto only, so the same code runs
// in Workers and in Node for tests/checks.mjs).
//
// One secret, ARKIVES_MASTER_KEY (32 random bytes, base64), is stretched
// with HKDF into separate keys per purpose, so a key used to sign OAuth
// state can never decrypt a stored token and vice versa.
//
//   seal(master, purpose, aad, text)  -> "v1.<iv>.<ciphertext>" (AES-256-GCM)
//   open(master, purpose, aad, sealed) -> text, or null if tampered / wrong aad
//   sign(master, purpose, text)        -> base64url HMAC-SHA256
//
// `aad` binds a ciphertext to its owner (the Supabase auth user id): a
// token row copied onto another account fails to decrypt.

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64url(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function unb64url(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function masterBytes(master) {
  const raw = unb64url(String(master || '').trim());
  if (raw.length < 32) throw new Error('ARKIVES_MASTER_KEY must be at least 32 bytes (base64)');
  return raw;
}

const _keys = new Map();
async function derive(master, purpose, usage) {
  const id = purpose + '|' + usage + '|' + master;
  if (_keys.has(id)) return _keys.get(id);
  const base = await crypto.subtle.importKey('raw', masterBytes(master), 'HKDF', false, ['deriveKey']);
  const params = { name: 'HKDF', hash: 'SHA-256', salt: enc.encode('arkives'), info: enc.encode(purpose) };
  const key = usage === 'aes'
    ? await crypto.subtle.deriveKey(params, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    : await crypto.subtle.deriveKey(params, base, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign', 'verify']);
  _keys.set(id, key);
  return key;
}

export async function seal(master, purpose, aad, text) {
  const key = await derive(master, purpose, 'aes');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(String(aad)) }, key, enc.encode(text));
  return 'v1.' + b64url(iv) + '.' + b64url(ct);
}

export async function open(master, purpose, aad, sealed) {
  try {
    const [v, iv, ct] = String(sealed || '').split('.');
    if (v !== 'v1' || !iv || !ct) return null;
    const key = await derive(master, purpose, 'aes');
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64url(iv), additionalData: enc.encode(String(aad)) }, key, unb64url(ct));
    return dec.decode(pt);
  } catch {
    return null;
  }
}

export async function sign(master, purpose, text) {
  const key = await derive(master, purpose, 'hmac');
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}

export async function verify(master, purpose, text, sig) {
  try {
    const key = await derive(master, purpose, 'hmac');
    return await crypto.subtle.verify('HMAC', key, unb64url(sig), enc.encode(text));
  } catch {
    return false;
  }
}

export function randomToken(bytes = 16) {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function readCookie(req, name) {
  const all = req.headers.get('Cookie') || '';
  for (const part of all.split(/;\s*/)) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i) === name) return part.slice(i + 1);
  }
  return '';
}

// HttpOnly + Secure + SameSite=Lax, scoped to the Google routes only
export function cookie(name, value, maxAge) {
  return `${name}=${value}; Path=/api/google; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}
