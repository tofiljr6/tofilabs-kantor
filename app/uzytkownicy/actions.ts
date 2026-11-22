"use server";

import { revalidatePath } from "next/cache";
import { authConfig } from "@/lib/auth";
import { requireAdmin } from "@/lib/session";
import { createUser, deleteUser, findUser, MIN_PASSWORD, setUserPassword, USERNAME_RE } from "@/lib/users";

export type FormState = { error: string | null; ok: string | null };

export async function addUserAction(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");

  if (!USERNAME_RE.test(username)) {
    return { error: "Login: 3–32 znaki, tylko litery, cyfry, kropka, myślnik i podkreślnik.", ok: null };
  }
  if (password.length < MIN_PASSWORD) {
    return { error: `Hasło musi mieć co najmniej ${MIN_PASSWORD} znaków.`, ok: null };
  }
  if (username.toLowerCase() === authConfig()!.username.toLowerCase() || (await findUser(username))) {
    return { error: `Użytkownik „${username}” już istnieje.`, ok: null };
  }
  await createUser(username, password, admin.username);
  revalidatePath("/uzytkownicy");
  return { error: null, ok: `Dodano użytkownika „${username}”.` };
}

export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const id = Number(form.get("id"));
  const password = String(form.get("password") ?? "");
  if (password.length < MIN_PASSWORD) {
    return { error: `Hasło musi mieć co najmniej ${MIN_PASSWORD} znaków.`, ok: null };
  }
  await setUserPassword(id, password);
  revalidatePath("/uzytkownicy");
  return { error: null, ok: "Hasło zmienione — użytkownik musi zalogować się ponownie." };
}

export async function deleteUserAction(form: FormData) {
  await requireAdmin();
  await deleteUser(Number(form.get("id")));
  revalidatePath("/uzytkownicy");
}
