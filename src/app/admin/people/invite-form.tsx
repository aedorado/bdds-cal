"use client";

import { useActionState } from "react";
import { inviteEditor } from "./actions";

const input =
  "rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none";

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteEditor, {} as { error?: string });

  return (
    <form action={action} className="rounded-xl border border-stone-200 bg-white p-5">
      <h2 className="mb-1 text-sm font-semibold text-stone-900">Approve someone</h2>
      <p className="mb-4 text-xs text-stone-500">
        Add the Google address they will sign in with. Do this before their first
        sign-in and they arrive with the right role; afterwards, set it in the
        table above instead.
      </p>

      {state.error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <div className="flex flex-wrap gap-3">
        <input name="email" type="email" placeholder="name@example.com"
          className={`${input} min-w-64 flex-1`} />
        <select name="role" defaultValue="editor" className={input}>
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
          <option value="viewer">Viewer</option>
        </select>
        <button disabled={pending}
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-60">
          {pending ? "Saving…" : "Approve"}
        </button>
      </div>
    </form>
  );
}
