import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getProfile } from "@/utils/supabase/auth";
import { InviteForm } from "./invite-form";
import { setRole } from "./actions";

type ProfileRow = { id: string; email: string; full_name: string | null; role: string };
type AllowRow = { email: string; role: string };

export default async function PeoplePage() {
  const profile = await getProfile();
  if (profile?.role !== "admin") {
    return <p className="text-sm text-stone-600">Only admins can manage people.</p>;
  }

  const supabase = createClient(await cookies());
  const [{ data: people }, { data: allow }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role").order("email"),
    supabase.from("editor_allowlist").select("email, role").order("email"),
  ]);

  const signedIn = new Set(((people ?? []) as ProfileRow[]).map((p) => p.email.toLowerCase()));
  const pending = ((allow ?? []) as AllowRow[]).filter((a) => !signedIn.has(a.email.toLowerCase()));

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold text-stone-900">People</h1>

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {((people ?? []) as ProfileRow[]).map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2 text-stone-900">{p.full_name ?? "—"}</td>
                <td className="px-4 py-2 text-stone-600">{p.email}</td>
                <td className="px-4 py-2">
                  <form action={setRole} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={p.id} />
                    <select name="role" defaultValue={p.role}
                      className="rounded border border-stone-300 px-2 py-1 text-xs">
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button className="text-xs text-stone-500 hover:text-stone-900">Save</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pending.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-stone-900">Approved, not yet signed in</h2>
          <ul className="mt-3 space-y-1 text-sm text-stone-600">
            {pending.map((a) => (
              <li key={a.email}>{a.email} — will become {a.role}</li>
            ))}
          </ul>
        </div>
      )}

      <InviteForm />
    </div>
  );
}
