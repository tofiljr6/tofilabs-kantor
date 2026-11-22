import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { passwordFingerprint, SESSION_COOKIE, verifySessionToken } from "./auth";
import { findUser } from "./users";

export type CurrentUser = { username: string; isAdmin: boolean };

/** Pełne sprawdzenie sesji (z bazą dla zwykłych użytkowników). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const p = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!p) return null;
  if (p.k === "a") return { username: p.u, isAdmin: true };
  const user = await findUser(p.u);
  if (!user || (await passwordFingerprint(user.password_hash)) !== p.v) return null;
  return { username: user.username, isAdmin: false };
}

/** Dla stron: brak sesji → /login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Dla stron i akcji administracyjnych: tylko konto z AUTH_USERNAME. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/");
  return user;
}
