"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

const ERRORS: Record<string, string> = {
  missing_code: "Google did not send us back a sign-in code. Please try again.",
  exchange_failed: "That sign-in link could not be completed. Please try again.",
};

function LoginForm() {
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const next = params.get("next") ?? "/admin";
  const error = params.get("error");

  async function signIn() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
      <h1 className="text-xl font-semibold text-stone-900">Schedule admin</h1>
      <p className="mt-2 text-sm text-stone-600">
        Sign in to view and manage the calendar.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {ERRORS[error] ?? "Something went wrong signing in."}
        </p>
      )}

      <button
        onClick={signIn}
        disabled={busy}
        className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-60"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8Z" />
          <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8h-4v3.1A12 12 0 0 0 12 24Z" />
          <path fill="#FBBC05" d="M5.3 14.3a7.1 7.1 0 0 1 0-4.6v-3.1h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
          <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8Z" />
        </svg>
        {busy ? "Redirecting to Google…" : "Continue with Google"}
      </button>

      <p className="mt-6 text-xs text-stone-500">
        Editing is limited to approved accounts. If yours is not approved yet you
        will still be able to see the schedule, but not change it.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-100 p-6">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
