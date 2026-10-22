import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export default async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);

  // /admin is editor territory. Role is checked again server-side on every
  // admin page and by RLS in the database; this is only a redirect convenience.
  if (request.nextUrl.pathname.startsWith("/admin") && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return withRefreshedCookies(NextResponse.redirect(loginUrl), supabaseResponse);
  }

  return supabaseResponse;
}

/**
 * Carry refreshed auth cookies onto a response we built ourselves.
 *
 * updateSession may have rotated the token and written new cookies onto
 * supabaseResponse. Returning a different response object discards them, and
 * the next request arrives holding a token that has already been consumed.
 */
function withRefreshedCookies(target: NextResponse, source: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));

  // Without these a redirect can be cached and replayed for someone it was
  // never issued to.
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = source.headers.get(header);
    if (value) target.headers.set(header, value);
  }
  return target;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
