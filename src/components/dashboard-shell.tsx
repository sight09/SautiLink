"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/app-shell";

export type NavItem = { href: string; label: string; icon: string };

export function DashboardShell({
  nav,
  title,
  subtitle,
  userName,
  children,
}: {
  nav: NavItem[];
  title: string;
  subtitle: string;
  userName: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-dvh bg-sand-50 lg:flex">
      <aside
        className={`border-b border-sand-200 bg-white lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r ${
          open ? "" : "max-lg:pb-0"
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <Logo size={30} />
            <span>
              <span className="block text-sm font-semibold tracking-tight text-brand-900">{title}</span>
              <span className="block text-xs text-ink-500">{subtitle}</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="rounded-lg border border-sand-200 px-2.5 py-1.5 text-sm lg:hidden"
          >
            ☰<span className="sr-only">Toggle navigation</span>
          </button>
        </div>
        <nav aria-label="Dashboard" className={`${open ? "block" : "hidden"} px-2 pb-3 lg:block`}>
          <ul className="space-y-1">
            {nav.map((item) => {
              const active =
                item.href === pathname || (item.href !== "/institution" && item.href !== "/admin" && pathname.startsWith(item.href));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      active ? "bg-brand-50 text-brand-900" : "text-ink-700 hover:bg-sand-100"
                    }`}
                  >
                    <span aria-hidden>{item.icon}</span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 border-t border-sand-200 px-3 pt-3">
            <p className="text-xs text-ink-500">Signed in as</p>
            <p className="text-sm font-medium text-ink-900">{userName}</p>
            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-2 w-full rounded-lg border border-sand-200 px-3 py-2 text-sm font-semibold text-ink-700"
            >
              Sign out
            </button>
          </div>
        </nav>
      </aside>
      <main id="main" className="min-w-0 flex-1 px-4 py-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
