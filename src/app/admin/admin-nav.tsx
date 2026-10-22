"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

/**
 * Which tab is current has to be decided in the browser, so this is a client
 * component: the layout that renders it is a Server Component and has no
 * access to the pathname.
 */
export function AdminNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  function isCurrent(href: string) {
    // "/admin" would otherwise match every page beneath it.
    if (href === "/admin") {
      // Editing an event is reached from the calendar, so keep Calendar lit
      // rather than leaving no tab selected.
      return pathname === "/admin" || /^\/admin\/events\/(?!new$)/.test(pathname);
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    // Scrolls sideways within itself on a phone rather than wrapping into a
    // ragged two-line block or pushing the whole page off-screen.
    <nav className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item) => {
        const current = isCurrent(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 transition ${
              current
                ? "bg-stone-900 font-medium text-white"
                : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
