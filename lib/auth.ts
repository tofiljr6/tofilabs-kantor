// Sesja = podpisany token w ciasteczku httpOnly. Tylko Web Crypto — działa w middleware (Edge) i w Node.
//
// Payload: { u: login, k: "a" (admin z env) | "u" (użytkownik z bazy), v: odcisk hasła, exp }
// - odcisk hasła (v) unieważnia sesję po zmianie hasła;
// - middleware sprawdza tylko podpis i ważność (bez bazy); pełne sprawdzenie użytkownika z bazy
//   (czy nadal istnieje, czy hasło to samo) robi lib/session.ts na każdej stronie i w API.

export const SESSION_COOKIE = "kantor_session";
export const SESSION_TTL_S = 30 * 24 * 3600; // 30 dni

export type SessionPayload = { u: string; k: "a" | "u"; v: string; exp: number };

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

/** Odcisk sekretu hasła (hasło admina z env albo hash hasła z bazy) — wchodzi do tokenu. */
export async function passwordFingerprint(material: string): Promise<string> {
  const cfg = authConfig();
  if (!cfg) throw new Error("Brak konfiguracji AUTH_*");
  return b64url(await hmac(cfg.secret, "pw:" + material)).slice(0, 22);
}

export async function isAdminCredentials(username: string, password: string): Promise<boolean> {
  const cfg = authConfig();
  if (!cfg) return false;
  const [u, p] = await Promise.all([safeEqual(username, cfg.username), safeEqual(password, cfg.password)]);
  return u && p;
}

export async function createSessionToken(p: Omit<SessionPayload, "exp">): Promise<string> {
  const cfg = authConfig();
  if (!cfg) throw new Error("Brak konfiguracji AUTH_*");
  const payload: SessionPayload = { ...p, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return `${body}.${b64url(await hmac(cfg.secret, body))}`;
}

/** Podpis + ważność; dla admina także login i odcisk hasła z env. Bez bazy (Edge-safe). */
export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  const cfg = authConfig();
  if (!cfg || !token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if (!(await safeEqual(sig, b64url(await hmac(cfg.secret, body))))) return null;
  let p: SessionPayload;
  try {
    p = JSON.parse(new TextDecoder().decode(fromB64url(body)));
  } catch {
    return null;
  }
  if (typeof p.u !== "string" || typeof p.v !== "string" || !(p.exp > Date.now() / 1000)) return null;
  if (p.k === "a") {
    return p.u === cfg.username && p.v === (await passwordFingerprint(cfg.password)) ? p : null;
  }
  return p.k === "u" ? p : null;
}
