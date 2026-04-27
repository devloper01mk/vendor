"use client";

import type { RequirementRow, VendorRow } from "@/features/expenses/types";
import { useApi } from "@/core/use-api";
import { useAuthStore } from "@/features/auth/auth.store";
import { AppSelect } from "@/components/ui/AppSelect";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { useEffect, useMemo, useRef, useState } from "react";

type ListResponse = {
  items: RequirementRow[];
  total: number;
  page: number;
  limit: number;
};

type RequirementsQueryCache = [unknown[], ListResponse | undefined][];

export default function ExpensesPage() {
  const api = useApi();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isReadOnly = user?.role === "ADMIN" || user?.role === "ACCOUNT_HEAD";
  const canManageFlags = user?.role === "ADMIN" || user?.role === "ACCOUNT_HEAD";
  const [vendorId, setVendorId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [search, setSearch] = useState("");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [draftRange, setDraftRange] = useState<DateRange | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date | undefined>(undefined);
  const [presetOpen, setPresetOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<RequirementRow | null>(null);
  const presetRef = useRef<HTMLDivElement | null>(null);
  const from = customRange?.from ? fmtDate(customRange.from) : "";
  const to = customRange?.to ? fmtDate(customRange.to) : "";

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

  const vendorsQ = useQuery({
    queryKey: ["vendors"],
    queryFn: () =>
      api.get<VendorRow[]>("/vendors").then((rows) => rows.map((r) => ({ id: r.id, name: r.name }))),
  });
  const sitesQ = useQuery({
    queryKey: ["sites"],
    queryFn: () => api.get<{ id: string; name: string }[]>("/sites"),
  });

  const query = useMemo(
    () => ({
      page: "1",
      limit: "100",
      ...(vendorId ? { vendorId } : {}),
      ...(siteId ? { siteId } : {}),
      ...(search ? { search } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    }),
    [vendorId, siteId, search, from, to],
  );

  const listQ = useQuery({
    queryKey: ["requirements", query],
    queryFn: async () => {
      const firstPage = await api.get<ListResponse>("/requirements", query);
      const total = firstPage.total ?? firstPage.items.length;
      const perPage = Math.max(1, firstPage.limit || Number(query.limit) || 100);
      const totalPages = Math.max(1, Math.ceil(total / perPage));
      if (totalPages <= 1) return firstPage;

      const pageRequests: Promise<ListResponse>[] = [];
      for (let page = 2; page <= totalPages; page += 1) {
        pageRequests.push(api.get<ListResponse>("/requirements", { ...query, page: String(page) }));
      }
      const restPages = await Promise.all(pageRequests);
      return {
        ...firstPage,
        items: [firstPage.items, ...restPages.map((p) => p.items)].flat(),
      };
    },
  });

  const paymentStats = useMemo(() => {
    const rows = listQ.data?.items ?? [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const sevenDaysStart = new Date(todayStart);
    sevenDaysStart.setDate(sevenDaysStart.getDate() - 6);

    let today = 0;
    let yesterday = 0;
    let last7 = 0;
    const byUser = new Map<string, number>();

    for (const r of rows) {
      for (const p of r.payments ?? []) {
        const amount = Number(p.amount ?? 0);
        if (!Number.isFinite(amount)) continue;
        const paidAt = new Date(p.paidAt);
        if (paidAt >= todayStart && paidAt < tomorrowStart) today += amount;
        if (paidAt >= yesterdayStart && paidAt < todayStart) yesterday += amount;
        if (paidAt >= sevenDaysStart && paidAt < tomorrowStart) last7 += amount;
        if (p.recordedBy?.name) {
          byUser.set(p.recordedBy.name, (byUser.get(p.recordedBy.name) ?? 0) + amount);
        }
      }
    }

    return {
      today: today.toFixed(2),
      yesterday: yesterday.toFixed(2),
      last7: last7.toFixed(2),
      byUser: [...byUser.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, amount]) => ({ name, amount: amount.toFixed(2) })),
    };
  }, [listQ.data?.items]);

  const flagMutation = useMutation({
    mutationFn: ({ id, flagged }: { id: string; flagged: boolean }) =>
      api.patch(`/requirements/${id}/highlight`, {
        flagged,
        reason: flagged ? "Marked by admin for correction" : undefined,
      }),
    onMutate: async ({ id, flagged }) => {
      await qc.cancelQueries({ queryKey: ["requirements"] });
      const previous = qc.getQueriesData<ListResponse>({ queryKey: ["requirements"] }) as RequirementsQueryCache;
      const previousDetailRow = detailRow;

      qc.setQueriesData<ListResponse>({ queryKey: ["requirements"] }, (old) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((row) =>
            row.id === id
              ? {
                  ...row,
                  isFlagged: flagged,
                  flagReason: flagged ? "Marked by admin for correction" : null,
                }
              : row,
          ),
        };
      });

      setDetailRow((old) =>
        old?.id === id
          ? {
              ...old,
              isFlagged: flagged,
              flagReason: flagged ? "Marked by admin for correction" : null,
            }
          : old,
      );

      return { previous, previousDetailRow };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx?.previous) return;
      for (const [key, data] of ctx.previous) {
        qc.setQueryData(key, data);
      }
      if (ctx.previousDetailRow !== undefined) setDetailRow(ctx.previousDetailRow);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["requirements"] });
    },
  });

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

  if (listQ.isError) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-red-600">Could not load transactions</p>
        <p className="text-sm text-[#857B6E]">{listQ.error instanceof Error ? listQ.error.message : "Request failed"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#2A2A2A]">Transactions</h1>
          <p className="mt-1 text-sm text-[#7C7266]">Clean ledger view with consistent admin styling.</p>
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
          {!isReadOnly ? (
            <Link
              href="/expenses/new"
              className="inline-flex items-center rounded-xl bg-[#C8B693] px-4 py-2.5 text-sm font-medium text-[#2A2A2A] transition hover:brightness-95"
            >
              New expense
            </Link>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-[#E5DED3] bg-white p-4 shadow-[0_1px_2px_rgba(21,21,21,0.06),0_8px_24px_rgba(21,21,21,0.04)]">
        <Field label="Search">
          <input
            className="input-base mt-1 w-48"
            placeholder="Item or brand"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <div className="flex flex-wrap items-end justify-end gap-3">
          <Field label="Vendor">
            <AppSelect
              value={vendorId}
              onChange={setVendorId}
              className="w-48"
              options={[
                { value: "", label: "All" },
                ...(vendorsQ.data ?? []).map((v) => ({ value: v.id, label: v.name })),
              ]}
            />
          </Field>
          <Field label="Site">
            <AppSelect
              value={siteId}
              onChange={setSiteId}
              className="w-48"
              options={[
                { value: "", label: "All" },
                ...(sitesQ.data ?? []).map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </Field>
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

      <div className="surface overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[#E5DED3] bg-[#FBF9F5] text-xs uppercase tracking-wide text-[#7E7569]">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium">Vendor</th>
              <th className="px-4 py-3 font-medium">Site</th>
              <th className="px-4 py-3 font-medium">Entry User</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEE7DD]">
            {(listQ.data?.items ?? []).map((r) => (
              <tr
                key={r.id}
                className={`cursor-pointer transition hover:bg-[#FAF7F2] active:opacity-95 ${r.isFlagged ? "bg-[#F3ECE1]" : ""}`}
                onClick={() => setDetailRow(r)}
              >
                <td className="px-4 py-3 tabular-nums text-[#7B7265]">
                  {r.entryDate.slice(0, 10)}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{r.itemName}</div>
                  {r.brand ? <div className="text-xs text-[#8D8376]">{r.brand}</div> : null}
                </td>
                <td className="px-4 py-3">{r.vendor.name}</td>
                <td className="px-4 py-3">{r.site.name}</td>
                <td className="px-4 py-3 text-[#6F6659]">{r.createdBy.name}</td>
                <td className="px-4 py-3 tabular-nums tone-positive">{r.totalAmount}</td>
                <td className="px-4 py-3 tabular-nums tone-negative">{r.remaining}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!listQ.data?.items.length ? (
          <p className="px-4 py-10 text-center text-sm text-[#8A8072]">No rows match filters.</p>
        ) : null}
      </div>

      {canManageFlags ? (
        <section className="grid gap-4 md:grid-cols-3">
          <div className="surface p-4">
            <p className="text-xs uppercase tracking-wide text-[#7E7569]">Today paid</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums tone-positive">{paymentStats.today}</p>
          </div>
          <div className="surface p-4">
            <p className="text-xs uppercase tracking-wide text-[#7E7569]">Yesterday paid</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums tone-negative">{paymentStats.yesterday}</p>
          </div>
          <div className="surface p-4">
            <p className="text-xs uppercase tracking-wide text-[#7E7569]">Last 7 days paid</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-[#2A2A2A]">{paymentStats.last7}</p>
          </div>
        </section>
      ) : null}

      {canManageFlags ? (
        <section className="surface p-4">
          <h2 className="mb-3 text-sm font-medium text-[#7E7569]">Payments by recorder (visible rows)</h2>
          <ul className="divide-y divide-[#EEE7DD] rounded-xl border border-[#E5DED3]">
            {paymentStats.byUser.map((u) => (
              <li key={u.name} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>{u.name}</span>
                <span className="tabular-nums">{u.amount}</span>
              </li>
            ))}
            {!paymentStats.byUser.length ? (
              <li className="px-4 py-6 text-center text-sm text-[#8A8072]">No payment rows in selected range.</li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {detailRow ? (
        <div
          className="fixed inset-0 z-[120] flex justify-end bg-ink/30"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDetailRow(null);
          }}
        >
          <div className="h-dvh w-full max-w-xl overflow-auto border-l border-line bg-panel">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-panel px-4 py-3">
              <h3 className="text-base font-semibold">Expense details</h3>
              <button type="button" className="btn-secondary" onClick={() => setDetailRow(null)}>
                Close
              </button>
            </div>
            <div className="space-y-4 px-4 pt-3 pb-4 text-sm">
              <div className="rounded-xl border border-line bg-panel-muted p-3">
                <p className="text-lg font-semibold">{detailRow.itemName}</p>
                <p className="mt-1 text-xs text-muted">{detailRow.brand ?? "No brand"}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Info label="Date" value={detailRow.entryDate.slice(0, 10)} />
                <Info label="Status" value={detailRow.status} />
                <Info label="Vendor" value={detailRow.vendor.name} />
                <Info label="Site" value={detailRow.site.name} />
                <Info label="Entry user" value={detailRow.createdBy.name} />
                <Info label="Quantity" value={detailRow.quantity} />
                <Info label="Total" value={detailRow.totalAmount} />
                <Info label="Paid" value={detailRow.paidTotal} />
                <Info label="Due" value={detailRow.remaining} />
                <Info label="Bill received" value={detailRow.billReceived ? "Yes" : "No"} />
              </div>
              <div className="rounded-xl border border-line p-3">
                <p className="text-xs uppercase tracking-wide text-muted">Notes</p>
                <p className="mt-2">{detailRow.notes ?? "—"}</p>
              </div>
              <div className="rounded-xl border border-line p-3">
                <p className="text-xs uppercase tracking-wide text-muted">Invoice</p>
                {detailRow.invoice?.fileUrl ? (
                  <a href={detailRow.invoice.fileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-ink underline-offset-2 hover:underline">
                    Download invoice
                  </a>
                ) : (
                  <p className="mt-2 text-sm text-muted">No invoice attached.</p>
                )}
              </div>
              <div className="rounded-xl border border-line p-3">
                <p className="text-xs uppercase tracking-wide text-muted">Payment timeline</p>
                <div className="mt-2 overflow-x-auto">
                  {(() => {
                    const sorted = [...(detailRow.payments ?? [])].sort(
                      (a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime(),
                    );
                    let runningPaid = 0;
                    const total = Number(detailRow.totalAmount || 0);
                    if (!sorted.length) return null;
                    return (
                      <table className="min-w-full text-left text-xs">
                        <thead className="border-b border-line bg-panel-muted uppercase tracking-wide text-muted">
                          <tr>
                            <th className="px-2 py-2 font-medium">Date</th>
                            <th className="px-2 py-2 font-medium">Paid</th>
                            <th className="px-2 py-2 font-medium">Running paid</th>
                            <th className="px-2 py-2 font-medium">Remaining</th>
                            <th className="px-2 py-2 font-medium">Invoice</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {sorted.map((p) => {
                            const amount = Number(p.amount || 0);
                            runningPaid += Number.isFinite(amount) ? amount : 0;
                            const remaining = Math.max(total - runningPaid, 0);
                            return (
                              <tr key={p.id}>
                                <td className="px-2 py-2 text-muted">
                                  {formatDisplayDate(p.paidAt)}
                                </td>
                                <td className="px-2 py-2 tabular-nums">{amount.toFixed(2)}</td>
                                <td className="px-2 py-2 tabular-nums">{runningPaid.toFixed(2)}</td>
                                <td className="px-2 py-2 tabular-nums">{remaining.toFixed(2)}</td>
                                <td className="px-2 py-2">
                                  {detailRow.invoice?.fileUrl ? (
                                    <a
                                      href={detailRow.invoice.fileUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-ink underline-offset-2 hover:underline"
                                    >
                                      View invoice
                                    </a>
                                  ) : (
                                    <span className="text-muted">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    );
                  })()}
                  {!detailRow.payments?.length ? (
                    <p className="text-sm text-muted">No payment history yet.</p>
                  ) : null}
                </div>
              </div>
              {canManageFlags ? (
                <div className="rounded-xl border border-line p-3">
                  <p className="text-xs uppercase tracking-wide text-muted">Flag</p>
                  <div className="mt-2 flex items-center gap-2">
                    {detailRow.isFlagged ? (
                      <span className="rounded-full bg-negative/20 px-2 py-1 text-xs font-medium text-negative">
                        Highlighted
                      </span>
                    ) : (
                      <span className="text-sm text-muted">Not highlighted</span>
                    )}
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => flagMutation.mutate({ id: detailRow.id, flagged: !detailRow.isFlagged })}
                    >
                      {detailRow.isFlagged ? "Remove highlight" : "Highlight"}
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="rounded-xl border border-line p-3">
                <p className="text-xs uppercase tracking-wide text-muted">Update logs</p>
                <div className="mt-2 space-y-2">
                  {(detailRow.updateLogs ?? []).map((log) => (
                    <div key={log.id} className="rounded-lg border border-line bg-panel-muted p-2">
                      <p className="text-xs text-muted">
                        {formatDateTime(log.createdAt)} by {log.changedBy.name}
                      </p>
                    </div>
                  ))}
                  {!detailRow.updateLogs?.length ? <p className="text-sm text-muted">No update logs yet.</p> : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
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

function formatDisplayDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-US", { month: "short" });
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(d);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="label block">
      {label}
      {children}
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}
