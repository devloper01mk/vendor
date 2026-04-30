"use client";

import type { DashboardSummary } from "@/features/expenses/types";
import { useApi } from "@/core/use-api";
import { useAuthStore } from "@/features/auth/auth.store";
import { useQuery } from "@tanstack/react-query";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { useEffect, useMemo, useRef, useState } from "react";

export default function DashboardPage() {
  const api = useApi();
  const user = useAuthStore((s) => s.user);
  const isAdminView = user?.role === "ADMIN" || user?.role === "ACCOUNT_HEAD";
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [draftRange, setDraftRange] = useState<DateRange | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date | undefined>(undefined);
  const [presetOpen, setPresetOpen] = useState(false);
  const [receivedDialogOpen, setReceivedDialogOpen] = useState(false);
  const [receivedFilterDate, setReceivedFilterDate] = useState("");
  const presetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!calendarOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setCalendarOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [calendarOpen]);

  useEffect(() => {
    if (!presetOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (!presetRef.current) return;
      if (!presetRef.current.contains(e.target as Node)) {
        setPresetOpen(false);
      }
    }
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, [presetOpen]);

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
    return <p className="text-sm text-[#857B6E]">Loading summary...</p>;
  }
  if (q.isError || !q.data) {
    return <p className="text-sm text-red-600">Could not load dashboard.</p>;
  }

  const d = q.data;
  const filteredReceivedPayments = (d.memberWallet?.receivedPayments ?? []).filter((p) =>
    receivedFilterDate ? p.paidAt.slice(0, 10) === receivedFilterDate : true,
  );
  const applyPreset = (preset: "today" | "yesterday" | "week" | "thisMonth" | "lastMonth" | "custom") => {
    if (preset === "custom") {
      setDraftRange(customRange);
      setCalendarMonth(customRange?.from ?? new Date());
      setCalendarOpen(true);
      setPresetOpen(false);
      return;
    }
    const range = getPresetRange(preset);
    setCustomRange(range);
    setDraftRange(range);
    setPresetOpen(false);
  };

  return (
      <div className="space-y-7">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#2A2A2A]">Dashboard overview</h1>
          <p className="mt-1 text-sm text-[#7C7266]">Clarity-first view of spending, dues, and risk</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="relative" ref={presetRef}>
            <button
              type="button"
              className="w-64 rounded-xl border border-[#E5DED3] bg-white px-3 py-2.5 text-left text-sm text-[#2A2A2A] shadow-sm outline-none transition hover:bg-[#FAF7F2]"
              onClick={() => setPresetOpen((prev) => !prev)}
            >
              {customRange?.from
                ? `${fmtDate(customRange.from)}${customRange?.to ? ` → ${fmtDate(customRange.to)}` : ""}`
                : "Select date range"}
            </button>
            {presetOpen ? (
              <div className="absolute z-20 mt-2 w-64 rounded-xl border border-[#E5DED3] bg-white p-1.5 shadow-[0_10px_30px_rgba(21,21,21,0.12)]">
                <PresetItem label="Today" onClick={() => applyPreset("today")} />
                <PresetItem label="Yesterday" onClick={() => applyPreset("yesterday")} />
                <PresetItem label="One Week" onClick={() => applyPreset("week")} />
                <PresetItem label="This Month" onClick={() => applyPreset("thisMonth")} />
                <PresetItem label="Last Month" onClick={() => applyPreset("lastMonth")} />
                <PresetItem label="Custom" onClick={() => applyPreset("custom")} />
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="inline-flex items-center rounded-xl border border-[#E5DED3] bg-white px-4 py-2.5 text-sm font-medium text-[#4E463B] transition hover:bg-[#F8F5EF]"
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
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-[#E5DED3] bg-white p-0 shadow-[0_4px_10px_rgba(21,21,21,0.08),0_22px_50px_rgba(21,21,21,0.08)]">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#E5DED3] bg-white p-4">
              <div>
                <p className="text-base font-semibold text-[#2A2A2A]">Select date range</p>
                <p className="mt-1 text-xs text-[#8D8376]">
                  {draftRange?.from ? fmtDate(draftRange.from) : "—"} → {draftRange?.to ? fmtDate(draftRange.to) : "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center rounded-xl border border-[#E5DED3] bg-white px-4 py-2 text-sm font-medium text-[#4E463B] transition hover:bg-[#F8F5EF]"
                  onClick={() => setCalendarOpen(false)}
                >
                  Close
                </button>
                {draftRange?.from && draftRange?.to ? (
                  <button
                    type="button"
                    className="inline-flex items-center rounded-xl bg-[#C8B693] px-4 py-2 text-sm font-medium text-[#2A2A2A] transition hover:brightness-95"
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
            <div className="max-h-[80vh] overflow-auto p-5">
              <p className="rounded-lg bg-[#F8F5EF] px-3 py-2 text-xs text-[#7A6F61]">
                {!draftRange?.from
                  ? "Step 1: Select From date."
                  : !draftRange?.to
                    ? "Step 2: Select To date."
                    : "Step 3: Click Done to apply range."}
              </p>
              <div className="mt-4 flex justify-center rounded-2xl border border-[#E5DED3] bg-[#FBF9F5] p-4">
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Total paid" value={d.totals.paid} tone="positive" />
        <Metric label="Pending exposure" value={d.totals.pending} tone="negative" />
        <Metric label="Total" value={d.totals.committed} tone="neutral" />
        {isAdminView ? (
          <Metric label="Paid to users" value={d.userFunding?.paidToUsers ?? "0"} tone="neutral" />
        ) : (
          <Metric label="Tracked items" value={String(d.requirementsTracked ?? 0)} tone="neutral" />
        )}
        {isAdminView ? <Metric label="TOTAL RECEIVED FROM INVESTOR" value={d.investor?.totalReceived ?? "0"} tone="neutral" /> : null}
      </div>

      {!isAdminView && d.memberWallet ? (
        <section className="surface p-4">
          <h2 className="mb-3 text-sm font-medium text-[#7E7569]">Member wallet</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Metric
              label="Received from admin"
              value={d.memberWallet.received}
              tone="neutral"
              onClick={() => {
                setReceivedDialogOpen(true);
                setReceivedFilterDate("");
              }}
            />
            <Metric label="Spent to vendors" value={d.memberWallet.spent} tone="positive" />
            <Metric label="Available balance" value={d.memberWallet.balance} tone="negative" />
          </div>
        </section>
      ) : null}
      {!isAdminView && d.memberWallet && receivedDialogOpen ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-ink/30 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setReceivedDialogOpen(false);
          }}
        >
          <div className="surface w-full max-w-3xl p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-[#2A2A2A]">Received from admin</h3>
              <div className="ml-auto flex items-center gap-2">
                <input
                  type="date"
                  className="input-base h-10 min-w-[180px]"
                  value={receivedFilterDate}
                  onChange={(e) => setReceivedFilterDate(e.target.value)}
                />
                <button
                  type="button"
                  className="inline-flex h-10 items-center rounded-lg border border-[#E5DED3] bg-white px-4 text-sm font-medium text-[#4E463B] transition hover:bg-[#F8F5EF]"
                  disabled={!receivedFilterDate}
                  onClick={() => setReceivedFilterDate("")}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="inline-flex h-10 items-center rounded-xl border border-[#E5DED3] bg-white px-4 text-sm font-medium text-[#4E463B] transition hover:bg-[#F8F5EF]"
                  onClick={() => setReceivedDialogOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[#E5DED3] bg-[#FBF9F5] text-xs uppercase tracking-wide text-[#7E7569]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Payment method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEE7DD]">
                  {filteredReceivedPayments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 tabular-nums text-[#6F6659]">{p.paidAt.slice(0, 10)}</td>
                      <td className="px-4 py-3 tabular-nums text-[#2A2A2A]">{p.amount}</td>
                      <td className="px-4 py-3 text-[#6F6659]">{p.method || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredReceivedPayments.length ? (
                <p className="px-4 py-8 text-center text-sm text-[#8A8072]">No received payments for selected date.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        {isAdminView ? (
          <div className="space-y-6">
            <div className="surface p-4">
              <h2 className="mb-3 text-sm font-medium text-[#7E7569]">Pending by vendor</h2>
              <ul className="divide-y divide-[#EEE7DD] rounded-xl border border-[#E5DED3]">
                {d.vendorPending.map((v) => (
                  <li key={v.vendorId} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span>{v.name}</span>
                    <span className="tabular-nums tone-negative">{v.pending}</span>
                  </li>
                ))}
                {!d.vendorPending.length ? (
                  <li className="px-4 py-6 text-center text-sm text-[#8A8072]">No pending rows</li>
                ) : null}
              </ul>
            </div>
          </div>
        ) : (
          <div className="surface p-4">
            <h2 className="mb-3 text-sm font-medium text-[#7E7569]">Needs attention</h2>
            <ul className="space-y-2">
              {(d.highlighted ?? []).slice(0, 8).map((h) => (
                <li key={h.requirementId} className="rounded-xl border border-[#E5DED3] bg-[#FAF7F2] px-4 py-3 text-sm">
                  <p className="font-medium">{h.itemName}</p>
                  <p className="mt-1 text-xs text-[#8A8072]">
                    {h.vendorName} · {h.siteName}
                  </p>
                </li>
              ))}
              {!d.highlighted?.length ? <li className="text-sm text-[#8A8072]">No highlighted items right now.</li> : null}
            </ul>
          </div>
        )}

        <div className="surface p-4">
          <h2 className="mb-3 text-sm font-medium text-[#7E7569]">Paid by site</h2>
          <ul className="divide-y divide-[#EEE7DD] rounded-xl border border-[#E5DED3]">
            {d.siteSpend.map((s) => (
              <li key={s.siteId} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>{s.name}</span>
                <span className="tabular-nums tone-positive">{s.paid}</span>
              </li>
            ))}
            {!d.siteSpend.length ? (
              <li className="px-4 py-6 text-center text-sm text-[#8A8072]">No site data</li>
            ) : null}
          </ul>
        </div>
      </section>

      {isAdminView ? (
        <section className="surface p-4">
          <h2 className="mb-3 text-sm font-medium text-[#7E7569]">Alerts and exceptions</h2>
          <ul className="space-y-2">
            {d.alerts.slice(0, 8).map((a) => (
              <li
                key={`${a.type}-${a.requirementId}`}
                className="rounded-xl border border-[#E5DED3] bg-[#FAF7F2] px-4 py-3 text-sm"
              >
                <span className="text-xs uppercase tracking-wide text-[#8A8072]">{a.type}</span>
                <p className="mt-1">{a.message}</p>
              </li>
            ))}
            {!d.alerts.length ? <li className="text-sm text-[#8A8072]">No alerts right now.</li> : null}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral";
  onClick?: () => void;
}) {
  const toneClass = tone === "positive" ? "tone-positive" : tone === "negative" ? "tone-negative" : "text-[#2A2A2A]";
  return (
    <button
      type="button"
      className={`surface block w-full p-5 text-left ${onClick ? "transition hover:bg-[#FAF7F2]" : ""}`}
      onClick={onClick}
      disabled={!onClick}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-[#7E7569]">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums tracking-tight ${toneClass}`}>{value}</p>
    </button>
  );
}

function fmtDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getPresetRange(preset: "today" | "yesterday" | "week" | "thisMonth" | "lastMonth"): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (preset === "today") return { from: today, to: today };
  if (preset === "yesterday") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return { from: y, to: y };
  }
  if (preset === "week") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { from: start, to: today };
  }
  if (preset === "thisMonth") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from: start, to: end };
  }
  const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const end = new Date(today.getFullYear(), today.getMonth(), 0);
  return { from: start, to: end };
}

function PresetItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[#3C352D] transition hover:bg-[#F8F5EF]"
    >
      {label}
    </button>
  );
}
