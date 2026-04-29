"use client";

import { useAuthStore } from "@/features/auth/auth.store";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles?: readonly string[];
};

const nav: readonly NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
        <path fill="currentColor" d="M3 3h6v6H3V3Zm8 0h6v3h-6V3ZM3 11h3v6H3v-6Zm5 0h9v6H8v-6Z" />
      </svg>
    ),
  },
  {
    href: "/expenses",
    label: "Transactions",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
        <path fill="currentColor" d="M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1H3V5Zm0 3h14v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Zm4 2a1 1 0 1 0 0 2h2v2a1 1 0 1 0 2 0v-2h2a1 1 0 1 0 0-2h-2V8a1 1 0 1 0-2 0v2H7Z" />
      </svg>
    ),
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
        <path fill="currentColor" d="M3 16h14v1H3v-1Zm2-2V8h2v6H5Zm4 0V5h2v9H9Zm4 0v-4h2v4h-2Z" />
      </svg>
    ),
  },
  {
    href: "/users",
    label: "Users",
    roles: ["ADMIN", "ACCOUNT_HEAD"],
    icon: (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
        <path
          fill="currentColor"
          d="M10 10a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.87 0-7 2.02-7 4.5V18h14v-1.5c0-2.48-3.13-4.5-7-4.5Z"
        />
      </svg>
    ),
  },
  {
    href: "/vendors",
    label: "Vendors",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
        <path
          fill="currentColor"
          d="M4 3h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm1 4v8h10V7H5Zm0-2h10V5H5v0Z"
        />
      </svg>
    ),
  },
  {
    href: "/sites",
    label: "Sites",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
        <path
          fill="currentColor"
          d="M10 2 3 7v10a1 1 0 0 0 1 1h4v-5h4v5h4a1 1 0 0 0 1-1V7l-7-5Zm0 2.45L15 8v8h-1v-5a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v5H5V8l5-3.55Z"
        />
      </svg>
    ),
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const path = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!token) router.replace("/login");
  }, [token, router]);

  if (!mounted || !token) return null;

  return (
    <div className="min-h-screen bg-[#F6F3EE] pb-20 text-[#2A2A2A] lg:pb-0">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-[#262626] bg-[#151515] px-4 py-6 text-[#E7E2D9] lg:flex lg:flex-col">
        <div className="mb-8 flex items-center gap-3 px-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#2A2A2A] bg-[#1F1F1F] text-sm font-semibold text-[#F5EEE1]">
            RK
          </span>
          <div>
            <p className="text-sm font-semibold tracking-wide text-[#F5EEE1]">Reckon</p>
            <p className="text-xs text-[#B8B1A6]">Workspace</p>
          </div>
        </div>
        <nav className="space-y-1">
          {nav
            .filter((n) => !n.roles || (user?.role ? n.roles.includes(user.role) : false))
            .map((n) => {
              const active = path === n.href || path.startsWith(`${n.href}/`);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                    active ? "bg-[#1F1F1F] text-[#F5EEE1]" : "text-[#B8B1A6] hover:bg-[#1F1F1F] hover:text-[#F5EEE1]"
                  }`}
                >
                  <span className="opacity-90">{n.icon}</span>
                  <span>{n.label}</span>
                </Link>
              );
            })}
        </nav>
        <div className="mt-auto rounded-xl border border-[#2A2A2A] bg-[#1B1B1B] p-3">
          <p className="text-xs uppercase tracking-wide text-[#A89F93]">Signed in</p>
          <p className="mt-1 text-sm font-medium text-[#F5EEE1]">{user?.name}</p>
          <p className="text-xs text-[#A89F93]">{user?.role}</p>
          <button
            type="button"
            className="mt-3 inline-flex rounded-lg border border-[#2F2F2F] px-3 py-1.5 text-xs text-[#D5CCBF] transition hover:bg-[#1F1F1F]"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
          >
            Log out
          </button>
        </div>
      </aside>
      <div className="lg:pl-64">
        <main className="px-4 py-6 sm:px-5 lg:px-8 lg:py-8">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[#E5DED3] bg-white/95 px-2 py-2 backdrop-blur lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {nav
            .filter((n) => !n.roles || (user?.role ? n.roles.includes(user.role) : false))
            .slice(0, 5)
            .map((n) => {
              const active = path === n.href || path.startsWith(`${n.href}/`);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition active:opacity-85 ${
                    active ? "bg-[#F3EDE3] text-[#2A2A2A]" : "text-[#7A7A7A] hover:bg-[#FBF8F4] hover:text-[#2A2A2A]"
                  }`}
                >
                  <span className={`${active ? "text-[#C8B693]" : "text-current"}`}>{n.icon}</span>
                  <span className="truncate">{n.label}</span>
                </Link>
              );
            })}
        </div>
      </nav>
    </div>
  );
}
