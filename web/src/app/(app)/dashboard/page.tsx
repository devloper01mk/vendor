"use client";

import type { DashboardSummary } from "@/features/expenses/types";
import { useApi } from "@/core/use-api";
import { useQuery } from "@tanstack/react-query";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { useEffect, useMemo, useState } from "react";

export default function DashboardPage() {
  const api = useApi();
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [draftRange, setDraftRange] = useState<DateRange | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (!calendarOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setCalendarOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [calendarOpen]);

  const { from, to } = useMemo(
    () => ({
      from: customRange?.from ? fmtDate(customRange.from) : undefined,
      to: customRange?.to ? fmtDate(customRange.to) : undefined,
    }),
    [customRange],
  );

  const q = useQuery({
    queryKey: ["dashboard", { from: from ?? "", to: to ?? "" }],
    queryFn: () => api.get<DashboardSummary>("/dashboard/summary", { ...(from ? { from } : {}), ...(to ? { to } : {}) }),
  });

  if (q.isLoading) {
    return <p className="text-sm text-muted">Loading summary…</p>;
  }
  if (q.isError || !q.data) {
    return <p className="text-sm text-red-600">Could not load dashboard.</p>;
  }

  const d = q.data;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard overview</h1>
          <p className="mt-1 text-sm text-muted">Clarity-first view of spending, dues, and risk</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="input-base w-64 text-left"
            onClick={() => {
              setDraftRange(customRange);
              setCalendarMonth(customRange?.from ?? new Date());
              setCalendarOpen(true);
            }}
          >
            {customRange?.from
              ? `${fmtDate(customRange.from)}${customRange?.to ? ` → ${fmtDate(customRange.to)}` : ""}`
              : "Select date range"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setCustomRange(undefined);
              setDraftRange(undefined);
            }}
          >
            Clear dates
          </button>
        </div>
      </div>
      {calendarOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/30 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCalendarOpen(false);
          }}
        >
          <div className="surface w-full max-w-5xl overflow-hidden p-0">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-panel p-4">
              <div>
                <p className="text-sm font-medium">Select date range</p>
                <p className="mt-1 text-xs text-muted">
                  {draftRange?.from ? fmtDate(draftRange.from) : "—"} → {draftRange?.to ? fmtDate(draftRange.to) : "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className="btn-secondary" onClick={() => setCalendarOpen(false)}>
                  Close
                </button>
                {draftRange?.from && draftRange?.to ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      setCustomRange(draftRange);
                      setCalendarOpen(false);
                    }}
                  >
                    Done
                  </button>
                ) : null}
              </div>
            </div>
            <div className="max-h-[80vh] overflow-auto p-4">
            <p className="text-xs text-muted">
              {!draftRange?.from
                ? "Step 1: Select From date."
                : !draftRange?.to
                  ? "Step 2: Select To date."
                  : "Step 3: Click Done to apply range."}
            </p>
            <div className="mt-3 rounded-xl border border-line bg-panel p-3">
              <DayPicker
                mode="range"
                numberOfMonths={2}
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                selected={draftRange}
                onSelect={setDraftRange}
              />
            </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Total paid" value={d.totals.paid} tone="positive" />
        <Metric label="Pending exposure" value={d.totals.pending} tone="negative" />
        <Metric label="Total committed" value={d.totals.committed} tone="neutral" />
        <Metric label="Paid to users" value={d.userFunding?.paidToUsers ?? "0"} tone="neutral" />
      </div>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <div className="surface p-4">
            <h2 className="mb-3 text-sm font-medium text-muted">Pending by vendor</h2>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {d.vendorPending.map((v) => (
                <li key={v.vendorId} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>{v.name}</span>
                  <span className="tabular-nums tone-negative">{v.pending}</span>
                </li>
              ))}
              {!d.vendorPending.length ? (
                <li className="px-4 py-6 text-center text-sm text-muted">No pending rows</li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="surface p-4">
          <h2 className="mb-3 text-sm font-medium text-muted">Paid by site</h2>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {d.siteSpend.map((s) => (
              <li key={s.siteId} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>{s.name}</span>
                <span className="tabular-nums tone-positive">{s.paid}</span>
              </li>
            ))}
            {!d.siteSpend.length ? (
              <li className="px-4 py-6 text-center text-sm text-muted">No site data</li>
            ) : null}
          </ul>
        </div>
      </section>

      <section className="surface p-4">
        <h2 className="mb-3 text-sm font-medium text-muted">Alerts and exceptions</h2>
        <ul className="space-y-2">
          {d.alerts.slice(0, 8).map((a) => (
            <li
              key={`${a.type}-${a.requirementId}`}
              className="rounded-xl border border-line bg-panel-muted px-4 py-3 text-sm"
            >
              <span className="text-xs uppercase tracking-wide text-muted">{a.type}</span>
              <p className="mt-1">{a.message}</p>
            </li>
          ))}
          {!d.alerts.length ? (
            <li className="text-sm text-muted">No alerts right now.</li>
          ) : null}
        </ul>
      </section>

    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral";
}) {
  const toneClass = tone === "positive" ? "tone-positive" : tone === "negative" ? "tone-negative" : "";
  return (
    <div className="surface p-5">
      <p className="label">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums tracking-tight ${toneClass}`}>{value}</p>
    </div>
  );
}

function fmtDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
