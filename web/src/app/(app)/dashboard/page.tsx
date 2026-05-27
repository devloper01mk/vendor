"use client";

import { CloseIconButton } from "@/components/ui/CloseIconButton";
import { DateRangeControls } from "@/components/ui/DateRangeControls";
import type { DashboardSummary } from "@/features/expenses/types";
import { formatDisplayDate, formatLocalYmd } from "@/core/date-display";
import { useApi } from "@/core/use-api";
import { useAuthStore } from "@/features/auth/auth.store";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { DateRange } from "react-day-picker";
import { useEffect, useMemo, useState } from "react";

type MetricDialogKind = "paid" | "pending" | "committed" | "paidToUsers" | "investor";

function formatBreakdownAmount(value: string) {
  const n = Number(value);
  if (!value || Number.isNaN(n) || Math.abs(n) < 0.01) return "—";
  return value;
}

function aggregateAmountsByName(items: { name: string; amount: string }[]) {
  const totals = new Map<string, number>();
  for (const item of items) {
    const key = item.name.trim() || "Unknown";
    totals.set(key, (totals.get(key) ?? 0) + (Number(item.amount) || 0));
  }
  return [...totals.entries()]
    .map(([name, total]) => ({ name, amount: total.toFixed(2) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getMetricDialogConfig(
  kind: MetricDialogKind,
  d: DashboardSummary,
  vendorRows: NonNullable<DashboardSummary["vendorBreakdown"]>,
) {
  if (kind === "paid") {
    return {
      title: "Total paid — by vendor",
      columns: ["Vendor", "Paid amount"] as const,
      rows: vendorRows.map((v) => ({ name: v.name, amount: formatBreakdownAmount(v.paid) })),
    };
  }
  if (kind === "pending") {
    return {
      title: "Pending vendor payments — by vendor",
      columns: ["Vendor", "Pending amount"] as const,
      rows: vendorRows.map((v) => ({ name: v.name, amount: formatBreakdownAmount(v.pending) })),
    };
  }
  if (kind === "committed") {
    return {
      title: "Total vendor payable — by vendor",
      columns: ["Vendor", "Payable amount"] as const,
      rows: vendorRows.map((v) => ({ name: v.name, amount: formatBreakdownAmount(v.committed) })),
    };
  }
  if (kind === "paidToUsers") {
    return {
      title: "Paid to users — by member",
      columns: ["Member", "Total paid"] as const,
      rows: aggregateAmountsByName(d.userFunding?.payments ?? []).map((r) => ({
        name: r.name,
        amount: formatBreakdownAmount(r.amount),
      })),
    };
  }
  return {
    title: "Total funds received — by investor",
    columns: ["Investor", "Total received"] as const,
    rows: aggregateAmountsByName(d.investor?.entries ?? []).map((r) => ({
      name: r.name,
      amount: formatBreakdownAmount(r.amount),
    })),
  };
}

export default function DashboardPage() {
  const api = useApi();
  const user = useAuthStore((s) => s.user);
  const isAdminView = user?.role === "ADMIN" || user?.role === "ACCOUNT_HEAD";
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [receivedDialogOpen, setReceivedDialogOpen] = useState(false);
  const [receivedFilterRange, setReceivedFilterRange] = useState<DateRange | undefined>();
  const [metricDialog, setMetricDialog] = useState<MetricDialogKind | null>(null);

  const { from, to } = useMemo(
    () => ({
      from: customRange?.from ? formatLocalYmd(customRange.from) : undefined,
      to: customRange?.to ? formatLocalYmd(customRange.to) : undefined,
    }),
    [customRange],
  );

  const q = useQuery({
    queryKey: ["dashboard", { from: from ?? "", to: to ?? "" }],
    queryFn: () => api.get<DashboardSummary>("/dashboard/summary", { ...(from ? { from } : {}), ...(to ? { to } : {}) }),
    placeholderData: keepPreviousData,
  });

  if (q.isPending && !q.data) {
    return <p className="text-sm text-[#857B6E]">Loading summary...</p>;
  }
  if (q.isError || !q.data) {
    return <p className="text-sm text-red-600">Could not load dashboard.</p>;
  }

  const d = q.data;
  const filteredReceivedPayments = (d.memberWallet?.receivedPayments ?? []).filter((p) => {
    if (!receivedFilterRange?.from) return true;
    const paidYmd = p.paidAt.slice(0, 10);
    const fromYmd = formatLocalYmd(receivedFilterRange.from);
    if (paidYmd < fromYmd) return false;
    if (!receivedFilterRange.to) return true;
    return paidYmd <= formatLocalYmd(receivedFilterRange.to);
  });

  const vendorRows = d.vendorBreakdown ?? [];
  const metricDialogConfig = metricDialog ? getMetricDialogConfig(metricDialog, d, vendorRows) : null;

  return (
    <div className="space-y-7">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#2A2A2A]">Dashboard overview</h1>
          <p className="mt-1 text-sm text-[#7C7266]">Clarity-first view of spending, dues, and risk</p>
        </div>
        <DateRangeControls customRange={customRange} onRangeChange={setCustomRange} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Total paid" value={d.totals.paid} tone="positive" onClick={() => setMetricDialog("paid")} />
        <Metric
          label="Pending Vendor Payments"
          value={d.totals.pending}
          tone="negative"
          onClick={() => setMetricDialog("pending")}
        />
        <Metric
          label="Total Vendor Payable"
          value={d.totals.committed}
          tone="neutral"
          onClick={() => setMetricDialog("committed")}
        />
        {isAdminView ? (
          <Metric
            label="Paid to users"
            value={d.userFunding?.paidToUsers ?? "0"}
            tone="neutral"
            onClick={() => setMetricDialog("paidToUsers")}
          />
        ) : (
          <Metric label="Tracked items" value={String(d.requirementsTracked ?? 0)} tone="neutral" />
        )}
        {isAdminView ? (
          <Metric
            label="Total Funds Received"
            value={d.investor?.totalReceived ?? "0"}
            tone="neutral"
            onClick={() => setMetricDialog("investor")}
          />
        ) : null}
      </div>

      {metricDialog && metricDialogConfig ? (
        <MetricBreakdownDialog
          title={metricDialogConfig.title}
          columns={[...metricDialogConfig.columns]}
          rows={metricDialogConfig.rows}
          customRange={customRange}
          onRangeChange={setCustomRange}
          isFetching={q.isFetching}
          onClose={() => setMetricDialog(null)}
        />
      ) : null}

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
                setReceivedFilterRange(undefined);
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
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="min-w-0 text-base font-semibold text-[#2A2A2A]">Received from admin</h3>
              <div className="flex shrink-0 items-center gap-2">
                <DateRangeControls compact customRange={receivedFilterRange} onRangeChange={setReceivedFilterRange} />
                <CloseIconButton onClick={() => setReceivedDialogOpen(false)} />
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
                      <td className="px-4 py-3 tabular-nums text-[#6F6659]">{formatDisplayDate(p.paidAt)}</td>
                      <td className="px-4 py-3 tabular-nums text-[#2A2A2A]">{p.amount}</td>
                      <td className="px-4 py-3 text-[#6F6659]">{p.method || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredReceivedPayments.length ? (
                <p className="px-4 py-8 text-center text-sm text-[#8A8072]">No received payments for selected period.</p>
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

function MetricBreakdownDialog({
  title,
  columns,
  rows,
  customRange,
  onRangeChange,
  isFetching,
  onClose,
}: {
  title: string;
  columns: [string, string];
  rows: { name: string; amount: string }[];
  customRange: DateRange | undefined;
  onRangeChange: (range: DateRange | undefined) => void;
  isFetching?: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-ink/30 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="surface flex max-h-[85vh] w-full max-w-3xl flex-col p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-[#2A2A2A]">{title}</h3>
            {isFetching ? <p className="mt-1 text-xs text-[#8A8072]">Updating breakdown…</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <DateRangeControls compact customRange={customRange} onRangeChange={onRangeChange} calendarZIndex={120} />
            <CloseIconButton onClick={onClose} />
          </div>
        </div>
        <div className={`min-h-0 flex-1 overflow-auto ${isFetching ? "opacity-60" : ""}`}>
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 border-b border-[#E5DED3] bg-[#FBF9F5] text-xs uppercase tracking-wide text-[#7E7569]">
              <tr>
                <th className="px-4 py-3 font-medium">{columns[0]}</th>
                <th className="px-4 py-3 text-right font-medium">{columns[1]}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEE7DD]">
              {rows.map((row) => (
                <tr key={row.name}>
                  <td className="px-4 py-3 text-[#2A2A2A]">{row.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#2A2A2A]">{row.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? (
            <p className="px-4 py-8 text-center text-sm text-[#8A8072]">No breakdown data for this period.</p>
          ) : null}
        </div>
      </div>
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
      className={`surface block w-full p-5 text-left ${onClick ? "cursor-pointer transition hover:bg-[#FAF7F2]" : ""}`}
      onClick={onClick}
      disabled={!onClick}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-[#7E7569]">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums tracking-tight ${toneClass}`}>{value}</p>
    </button>
  );
}
