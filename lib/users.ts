import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { db } from "./db";

// Tylko Node.js (server actions / route handlers), nie middleware.

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 32;

function scrypt(password: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, KEYLEN, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, { N, r: R, p: P });
  return ["scrypt", N, R, P, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, saltB64, hashB64] = stored.split("$");
  if (alg !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64url");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64url"), { N: +n, r: +r, p: +p });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Hash "atrapa" — przy nieistniejącym loginie i tak liczymy scrypt, żeby czas odpowiedzi
// nie zdradzał, czy taki użytkownik istnieje.
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(password: string) {
  dummyHash ??= hashPassword(randomBytes(12).toString("hex"));
  await verifyPassword(password, await dummyHash);
}

export type DbUser = { id: number; username: string; password_hash: string; created_at: Date; created_by: string };

export async function findUser(username: string): Promise<DbUser | null> {
  const { rows } = await db().query<DbUser>(
    `SELECT id, username, password_hash, created_at, created_by FROM users WHERE lower(username) = lower($1)`,
    [username],
  );
  return rows[0] ?? null;
}

export async function listUsers(): Promise<Omit<DbUser, "password_hash">[]> {
  const { rows } = await db().query<DbUser>(
    `SELECT id, username, created_at, created_by FROM users ORDER BY created_at`,
  );
  return rows;
}

export async function createUser(username: string, password: string, createdBy: string) {
  await db().query(`INSERT INTO users (username, password_hash, created_by) VALUES ($1, $2, $3)`, [
    username,
    await hashPassword(password),
    createdBy,
  ]);
}

export async function setUserPassword(id: number, password: string) {
  await db().query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [id, await hashPassword(password)]);
}

export async function deleteUser(id: number) {
  await db().query(`DELETE FROM users WHERE id = $1`, [id]);
}

export const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/;
export const MIN_PASSWORD = 8;
