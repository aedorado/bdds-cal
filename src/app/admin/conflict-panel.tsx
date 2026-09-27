"use client";

import { useState } from "react";
import type { Issue } from "@/lib/conflicts";

export function ConflictPanel({ issues }: { issues: Issue[] }) {
  const [open, setOpen] = useState(true);
  const warns = issues.filter((i) => i.severity === "warn").length;

  return (
    <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50">
      <button onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-amber-900">
        <span>⚠</span>
        {issues.length} scheduling {issues.length === 1 ? "note" : "notes"}
        {warns > 0 && <span className="text-amber-700">({warns} worth a look)</span>}
        <span className="ml-auto text-xs font-normal text-amber-700">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <ul className="space-y-2 border-t border-amber-200 px-4 py-3">
          {issues.map((i) => (
            <li key={i.id} className="text-sm">
              <span className={i.severity === "warn" ? "font-medium text-amber-900" : "text-amber-800"}>
                {i.title}
              </span>
              <span className="text-amber-800"> — {i.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
