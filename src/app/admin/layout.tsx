import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile, canEdit } from "@/utils/supabase/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // proxy.ts already bounced anonymous requests; this is the real check, and it
  // runs on every admin page. RLS in the database is the backstop under both.
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/admin");

  return (
    <div className="flex min-h-screen flex-col bg-stone-100">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          <Link href="/admin" className="font-semibold text-stone-900">
            Schedule
          </Link>
          <nav className="flex gap-4 text-sm text-stone-600">
            <Link href="/admin" className="hover:text-stone-900">Calendar</Link>
            <Link href="/admin/events/new" className="hover:text-stone-900">Add event</Link>
            <Link href="/admin/locations" className="hover:text-stone-900">Locations</Link>
            <Link href="/admin/notifications" className="hover:text-stone-900">Notifications</Link>
            {profile.role === "admin" && (
              <Link href="/admin/people" className="hover:text-stone-900">People</Link>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-3 text-sm">
            {!canEdit(profile) && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                Read only
              </span>
            )}
            <span className="text-stone-600">{profile.full_name ?? profile.email}</span>
            <form action="/auth/signout" method="post">
              <button type="submit" className="text-stone-500 hover:text-stone-900">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 p-4">{children}</main>
    </div>
  );
}
