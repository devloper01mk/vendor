"use client";

import type { ReactNode } from "react";
import type { QuickPresetId } from "./utils";

export const analyticsCard =
  "rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm";

const summaryTones = {
  green: {
    icon: "bg-[#ECFDF5] text-[#059669]",
    value: "text-[#047857]",
  },
  red: {
    icon: "bg-[#FEF2F2] text-[#DC2626]",
    value: "text-[#B91C1C]",
  },
  orange: {
    icon: "bg-[#FFF7ED] text-[#EA580C]",
    value: "text-[#C2410C]",
  },
  blue: {
    icon: "bg-[#EFF6FF] text-[#2563EB]",
    value: "text-[#1D4ED8]",
  },
  highlight: {
    icon: "bg-gradient-to-br from-[#EFF6FF] to-[#EDE9FE] text-[#4F46E5]",
    value: "text-[#4338CA]",
  },
} as const;

type SummaryTone = keyof typeof summaryTones;

export function AnalyticsPageHeader({
  title,
  subtitle,
  notificationCount = 0,
  accent,
  children,
}: {
  title: string;
  subtitle: string;
  notificationCount?: number;
  accent?: "purple";
  children?: ReactNode;
}) {
  const isPurple = accent === "purple";
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1
            className={`text-2xl font-semibold tracking-tight ${isPurple ? "text-[#5B21B6]" : "text-[#111827]"}`}
          >
            {title}
          </h1>
          {notificationCount > 0 ? (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                isPurple ? "bg-[#EDE9FE] text-[#6D28D9]" : "bg-[#FEE2E2] text-[#991B1B]"
              }`}
            >
              {notificationCount} alert{notificationCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        <p className="mt-1 max-w-2xl text-sm text-[#6B7280]">{subtitle}</p>
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}

export function PresetPills({
  active,
  onSelect,
  accent,
}: {
  active: QuickPresetId;
  onSelect: (id: QuickPresetId) => void;
  accent?: "purple";
}) {
  const presets: { id: QuickPresetId; label: string }[] = [
    { id: "all", label: "All Date" },
    { id: "today", label: "Today" },
    { id: "week", label: "This week" },
    { id: "thisMonth", label: "This month" },
    { id: "custom", label: "Custom" },
  ];
  const activeClass =
    accent === "purple"
      ? "border-[#7C3AED] bg-[#7C3AED] text-white shadow-sm"
      : "border-[#2563EB] bg-[#2563EB] text-white shadow-sm";
  const idleClass = "border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]";

  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onSelect(p.id)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
            active === p.id ? activeClass : idleClass
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function AnalyticsSummaryCard({
  label,
  hint,
  value,
  tone,
  icon,
  trendPct,
}: {
  label: string;
  hint: string;
  value: string;
  tone: SummaryTone;
  icon: ReactNode;
  trendPct?: number;
}) {
  const styles = summaryTones[tone];
  const trend =
    trendPct !== undefined ? (
      <span
        className={`text-xs font-medium tabular-nums ${
          trendPct >= 0 ? "text-[#059669]" : "text-[#DC2626]"
        }`}
      >
        {trendPct >= 0 ? "+" : ""}
        {trendPct.toFixed(1)}%
      </span>
    ) : null;

  return (
    <div className={`${analyticsCard} flex flex-col gap-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${styles.icon}`}>{icon}</div>
        {trend}
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">{label}</p>
        <p className={`mt-1 text-2xl font-semibold tabular-nums ${styles.value}`}>{value}</p>
        <p className="mt-0.5 text-xs text-[#9CA3AF]">{hint}</p>
      </div>
    </div>
  );
}

export function SectionHead({
  title,
  sub,
  badge,
}: {
  title: string;
  sub: string;
  badge?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-[#111827]">{title}</h2>
        <p className="mt-0.5 text-sm text-[#6B7280]">{sub}</p>
      </div>
      {badge ? (
        <span className="rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#059669]">
          {badge}
        </span>
      ) : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: "Success" | "Pending" | "Failed" }) {
  const styles = {
    Success: "bg-[#D1FAE5] text-[#065F46]",
    Pending: "bg-[#FEF3C7] text-[#92400E]",
    Failed: "bg-[#FEE2E2] text-[#991B1B]",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}

export function CircularKpi({
  label,
  value,
  pct,
  color,
}: {
  label: string;
  value: string;
  pct: number;
  color: string;
}) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  const offset = c - (clamped / 100) * c;

  return (
    <div className={`${analyticsCard} flex flex-col items-center text-center`}>
      <div className="relative h-24 w-24">
        <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96" aria-hidden>
          <circle cx="48" cy="48" r={r} fill="none" stroke="#E5E7EB" strokeWidth="8" />
          <circle
            cx="48"
            cy="48"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums text-[#111827]">
          {clamped.toFixed(0)}%
        </span>
      </div>
      <p className="mt-3 text-sm font-medium text-[#111827]">{label}</p>
      <p className="mt-0.5 text-xs tabular-nums text-[#6B7280]">{value}</p>
    </div>
  );
}

export function AlertCard({
  title,
  detail,
  severity,
}: {
  title: string;
  detail: string;
  severity: "high" | "medium" | "info";
}) {
  const styles = {
    high: "border-[#FECACA] bg-[#FEF2F2]",
    medium: "border-[#FDE68A] bg-[#FFFBEB]",
    info: "border-[#BFDBFE] bg-[#EFF6FF]",
  };
  const titleColor = {
    high: "text-[#991B1B]",
    medium: "text-[#92400E]",
    info: "text-[#1E40AF]",
  };

  return (
    <div className={`rounded-xl border px-4 py-3 ${styles[severity]}`}>
      <p className={`text-sm font-semibold ${titleColor[severity]}`}>{title}</p>
      <p className="mt-1 text-xs text-[#6B7280]">{detail}</p>
    </div>
  );
}
