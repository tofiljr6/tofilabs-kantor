// Sesja = podpisany token w ciasteczku httpOnly. Działa w middleware (Edge) i w Node — tylko Web Crypto.
// Klucz HMAC = AUTH_SECRET + AUTH_PASSWORD, więc zmiana hasła unieważnia wszystkie stare sesje.

export const SESSION_COOKIE = "kantor_session";
export const SESSION_TTL_S = 30 * 24 * 3600; // 30 dni

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function authConfig() {
  const username = process.env.AUTH_USERNAME;
  const password = process.env.AUTH_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!username || !password || !secret || secret.length < 32) return null;
  return { username, password, secret };
}

async function hmac(key: string, data: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}

/** Porównanie w stałym czasie (przez HMAC obu wartości — równe długości, brak wycieku długości). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const key = crypto.getRandomValues(new Uint8Array(32));
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const [x, y] = await Promise.all([
    crypto.subtle.sign("HMAC", k, enc.encode(a)),
    crypto.subtle.sign("HMAC", k, enc.encode(b)),
  ]);
  const xa = new Uint8Array(x);
  const ya = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < xa.length; i++) diff |= xa[i] ^ ya[i];
  return diff === 0;
}

export async function checkCredentials(username: string, password: string): Promise<boolean> {
  const cfg = authConfig();
  if (!cfg) return false;
  const [u, p] = await Promise.all([safeEqual(username, cfg.username), safeEqual(password, cfg.password)]);
  return u && p;
}

export async function createSessionToken(username: string): Promise<string> {
  const cfg = authConfig();
  if (!cfg) throw new Error("Brak konfiguracji AUTH_*");
  const payload = b64url(enc.encode(JSON.stringify({ u: username, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S })));
  const sig = b64url(await hmac(cfg.secret + cfg.password, payload));
  return `${payload}.${sig}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  const cfg = authConfig();
  if (!cfg || !token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = b64url(await hmac(cfg.secret + cfg.password, payload));
  if (!(await safeEqual(sig, expected))) return false;
  try {
    const { u, exp } = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as { u: string; exp: number };
    return u === cfg.username && exp > Date.now() / 1000;
  } catch {
    return false;
  }
}
