import type { Metadata } from "next";
import Link from "next/link";
import { fmtDateTime } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { listUsers } from "@/lib/users";
import { AddUserForm, DeleteUserButton, ResetPasswordForm } from "./forms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Użytkownicy — Kursy walut" };

export default async function UsersPage() {
  const admin = await requireAdmin();
  const users = await listUsers();

  return (
    <main className="narrow">
      <p className="back">
        <Link href="/">← Wszystkie kursy</Link>
      </p>
      <h1>Użytkownicy</h1>
      <p className="muted">
        Zalogowany jako administrator <strong>{admin.username}</strong>. Dodani użytkownicy widzą kursy,
        ale nie mogą zarządzać kontami.
      </p>

      <section className="card">
        <h2>Dodaj użytkownika</h2>
        <AddUserForm />
      </section>

      <section className="card">
        <h2>Konta ({users.length + 1})</h2>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Login</th>
                <th>Rola</th>
                <th>Dodany</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>{admin.username}</strong></td>
                <td>Administrator</td>
                <td className="muted small">konto z ustawień (AUTH_USERNAME)</td>
                <td />
              </tr>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.username}</strong></td>
                  <td>Użytkownik</td>
                  <td className="muted small">{fmtDateTime(u.created_at.toISOString())} · {u.created_by}</td>
                  <td>
                    <div className="rowActions">
                      <ResetPasswordForm id={u.id} username={u.username} />
                      <DeleteUserButton id={u.id} username={u.username} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
