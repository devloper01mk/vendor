"use client";

import { useAuthStore } from "@/features/auth/auth.store";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  roles?: readonly string[];
};

const nav: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "◫" },
  { href: "/expenses", label: "Transactions", icon: "↕" },
  { href: "/analytics", label: "Analytics", icon: "◌" },
  { href: "/vendors", label: "Vendors", icon: "◇" },
  { href: "/users", label: "Users", icon: "◍", roles: ["ADMIN", "ACCOUNT_HEAD"] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const path = usePathname();
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    if (!token) router.replace("/login");
  }, [token, router]);

  if (!token) return null;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 border-b border-line/80 bg-canvas/90 backdrop-blur">
        <div className="flex w-full items-center justify-between gap-4 px-3 py-4">
          <div className="flex items-center gap-4">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-panel text-sm font-semibold">
              FX
            </span>
            <div>
              <p className="text-sm font-semibold leading-none tracking-tight">Finops Workspace</p>
              <p className="mt-1 text-xs text-muted">Calm finance operations</p>
            </div>
          </div>
          <div className="flex flex-1 items-center justify-end gap-3">
            <div className="hidden w-full max-w-sm items-center rounded-xl border border-line bg-panel px-3 py-2 md:flex">
              <span className="text-xs text-muted">Search transactions, vendors, sites…</span>
            </div>
            <button
              type="button"
              className="btn-secondary px-3 py-2 text-xs"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              Theme mode
            </button>
            <button
              type="button"
              className="text-sm text-muted hover:text-ink"
              onClick={() => {
                logout();
                router.replace("/login");
              }}
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <div className="grid w-full gap-6 px-3 py-8 lg:grid-cols-[220px_1fr]">
        <aside className="surface h-fit p-3">
          <p className="px-2 pb-2 text-xs uppercase tracking-wide text-muted">Navigation</p>
          <nav className="space-y-1">
            {nav
              .filter((n) => !n.roles || (user?.role ? n.roles.includes(user.role) : false))
              .map((n) => {
              const active = path === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                    active ? "bg-panel-muted text-ink" : "text-muted hover:bg-panel-muted hover:text-ink"
                  }`}
                >
                  <span className="text-xs">{n.icon}</span>
                  <span>{n.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-4 rounded-xl border border-line bg-panel-muted p-3">
            <p className="text-xs font-medium text-muted">Profile</p>
            <p className="mt-1 text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-muted">{user?.role}</p>
          </div>
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}
