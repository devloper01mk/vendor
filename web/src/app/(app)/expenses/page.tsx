"use client";

import type { RequirementRow, VendorRow } from "@/features/expenses/types";
import { useApi } from "@/core/use-api";
import { useAuthStore } from "@/features/auth/auth.store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { useEffect, useMemo, useState } from "react";

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
  const [detailRow, setDetailRow] = useState<RequirementRow | null>(null);
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
      limit: "50",
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
    queryFn: () => api.get<ListResponse>("/requirements", query),
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Transactions</h1>
          <p className="mt-1 text-sm text-muted">Clean ledger view with instant positive/negative context</p>
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
          {!isReadOnly ? (
            <Link href="/expenses/new" className="btn-primary">
              New expense
            </Link>
          ) : null}
        </div>
      </div>

      <div className="surface flex flex-wrap gap-3 p-4">
        <Field label="Vendor">
          <select
            className="input-base mt-1 w-48"
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
          >
            <option value="">All</option>
            {(vendorsQ.data ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Site">
          <select
            className="input-base mt-1 w-48"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
          >
            <option value="">All</option>
            {(sitesQ.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Search">
          <input
            className="input-base mt-1 w-56"
            placeholder="Item or brand"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
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

      <div className="surface overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line bg-panel-muted text-xs uppercase tracking-wide text-muted">
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
          <tbody className="divide-y divide-line">
            {(listQ.data?.items ?? []).map((r) => (
              <tr
                key={r.id}
                className={`transition hover:bg-panel-muted ${r.isFlagged ? "bg-negative/20" : ""}`}
                onClick={() => setDetailRow(r)}
              >
                <td className="px-4 py-3 tabular-nums text-muted">
                  {r.entryDate.slice(0, 10)}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{r.itemName}</div>
                  {r.brand ? <div className="text-xs text-muted">{r.brand}</div> : null}
                </td>
                <td className="px-4 py-3">{r.vendor.name}</td>
                <td className="px-4 py-3">{r.site.name}</td>
                <td className="px-4 py-3 text-muted">{r.createdBy.name}</td>
                <td className="px-4 py-3 tabular-nums">{r.totalAmount}</td>
                <td className="px-4 py-3 tabular-nums tone-negative">{r.remaining}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!listQ.data?.items.length ? (
          <p className="px-4 py-10 text-center text-sm text-muted">No rows match filters.</p>
        ) : null}
      </div>

      {canManageFlags ? (
        <section className="grid gap-4 md:grid-cols-3">
          <div className="surface p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Today paid</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums tone-positive">{paymentStats.today}</p>
          </div>
          <div className="surface p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Yesterday paid</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{paymentStats.yesterday}</p>
          </div>
          <div className="surface p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Last 7 days paid</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{paymentStats.last7}</p>
          </div>
        </section>
      ) : null}

      {canManageFlags ? (
        <section className="surface p-4">
          <h2 className="mb-3 text-sm font-medium text-muted">Payments by recorder (visible rows)</h2>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {paymentStats.byUser.map((u) => (
              <li key={u.name} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>{u.name}</span>
                <span className="tabular-nums">{u.amount}</span>
              </li>
            ))}
            {!paymentStats.byUser.length ? (
              <li className="px-4 py-6 text-center text-sm text-muted">No payment rows in selected range.</li>
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
                        {new Date(log.createdAt).toLocaleString()} by {log.changedBy.name}
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

function formatDisplayDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-US", { month: "short" });
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
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
