import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile, canEdit, isOwner } from "@/utils/supabase/auth";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // proxy.ts already bounced anonymous requests; this is the real check, and it
  // runs on every admin page. RLS in the database is the backstop under both.
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/admin");

  return (
    <div className="flex min-h-screen flex-col bg-stone-100">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link href="/admin" className="font-semibold text-stone-900">
            Schedule
          </Link>
          {/* A read-only viewer is shown only what they can act on. Offering
              "Add event" to someone the database will refuse is a promise the
              app cannot keep. */}
          <AdminNav
            items={[
              { href: "/admin", label: "Calendar" },
              ...(canEdit(profile)
                ? [{ href: "/admin/events/new", label: "Add event" }]
                : []),
              ...(isOwner(profile)
                ? [{ href: "/admin/locations", label: "Locations" }]
                : []),
              { href: "/admin/notifications", label: "Notifications" },
              ...(profile.role === "admin"
                ? [{ href: "/admin/people", label: "People" }]
                : []),
            ]}
          />

          <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {!canEdit(profile) && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                Read only
              </span>
            )}
            {/* On a phone the header is already carrying five nav pills; the
                signed-in name is the first thing that can go. */}
            <span className="hidden text-stone-600 sm:inline">
              {profile.full_name ?? profile.email}
            </span>
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
