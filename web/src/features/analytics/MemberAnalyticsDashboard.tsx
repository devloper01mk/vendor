"use client";

import { DateRangeControls } from "@/components/ui/DateRangeControls";
import { formatDisplayDate } from "@/core/date-display";
import type { DashboardSummary } from "@/features/expenses/types";
import type { DateRange } from "react-day-picker";

export function MemberAnalyticsDashboard({
  data,
  memberName,
  customRange,
  onRangeChange,
  from,
  to,
}: {
  data: DashboardSummary;
  memberName: string;
  customRange: DateRange | undefined;
  onRangeChange: (range: DateRange | undefined) => void;
  from?: string;
  to?: string;
}) {
  const handleDownloadReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      range: { from: from ?? null, to: to ?? null },
      summary: data,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `member-analytics-report-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const wallet = data.memberWallet ?? { received: "0", spent: "0", balance: "0", receivedPayments: [] };
  const monthly = data.monthly.slice(-6);

  const totalInvested = toNumber(data.totals.committed);
  const totalReturned = toNumber(wallet.received || data.totals.paid);
  const activeExposure = toNumber(data.totals.pending);
  const pendingReturns = data.vendorPending.reduce((sum, row) => sum + toNumber(row.pending), 0);
  const profitEarned = totalReturned - toNumber(wallet.spent);
  const walletBalance = toNumber(wallet.balance);
  const roi = totalInvested > 0 ? (profitEarned / totalInvested) * 100 : 0;

  const closedExposure = Math.max(0, totalInvested - activeExposure);
  const exposureTotal = activeExposure + closedExposure;
  const activePct = exposureTotal > 0 ? (activeExposure / exposureTotal) * 100 : 0;

  const portfolioTotal = data.siteSpend.reduce((sum, row) => sum + toNumber(row.paid), 0);
  const topSites = data.siteSpend.slice(0, 6);
  const timelineItems = [
    ...(wallet.receivedPayments ?? []).slice(0, 4).map((p) => ({
      id: `payment-${p.id}`,
      type: "Returns",
      description: `${formatAmount(p.amount)} via ${p.method || "bank transfer"}`,
      at: p.paidAt,
    })),
    ...(data.highlighted ?? []).slice(0, 3).map((h) => ({
      id: `investment-${h.requirementId}`,
      type: "Investments",
      description: `${h.itemName} • ${h.vendorName}`,
      at: new Date().toISOString(),
    })),
    ...data.alerts.slice(0, 2).map((a, idx) => ({
      id: `settlement-${a.requirementId}-${idx}`,
      type: "Settlements",
      description: a.message,
      at: new Date().toISOString(),
    })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <div className="space-y-6 bg-[#F8FAFC]">
      <section className="rounded-3xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-[#64748B]">Welcome back,</p>
            <h1 className="truncate text-2xl font-semibold tracking-tight text-[#0F172A]">{memberName}</h1>
            <p className="mt-1 text-sm text-[#64748B]">Secure member analytics for investments, returns, and performance.</p>
          </div>
          <div className="flex items-center gap-2">
            <DateRangeControls customRange={customRange} onRangeChange={onRangeChange} />
            <button
              type="button"
              onClick={handleDownloadReport}
              className="rounded-xl bg-[#1D4ED8] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1E40AF]"
            >
              Download report
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Total Invested" value={formatAmount(totalInvested)} tone="blue" />
        <MetricCard label="Total Returned" value={formatAmount(totalReturned)} tone="green" />
        <MetricCard label="Active Exposure" value={formatAmount(activeExposure)} tone="purple" />
        <MetricCard label="Pending Returns" value={formatAmount(pendingReturns)} tone="red" />
        <MetricCard label="Profit Earned" value={formatAmount(profitEarned)} tone={profitEarned >= 0 ? "green" : "red"} />
        <MetricCard label="Wallet Balance" value={formatAmount(walletBalance)} tone="neutral" />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-[#0F172A]">Investment Growth</h2>
          <p className="mt-1 text-sm text-[#64748B]">Monthly investment trend and ROI analytics.</p>
          <div className="mt-4">
            <BarRows
              rows={monthly.map((m, i) => ({
                label: m.month || `M${i + 1}`,
                value: toNumber(m.committed),
              }))}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-[#0F172A]">Exposure Analytics</h2>
          <p className="mt-1 text-sm text-[#64748B]">Active vs closed exposure donut and pending settlement indicators.</p>
          <div className="mt-4 flex items-center gap-6">
            <div
              className="h-36 w-36 rounded-full"
              style={{
                background: `conic-gradient(#2563EB 0% ${activePct}%, #A855F7 ${activePct}% 100%)`,
              }}
            />
            <div className="space-y-2 text-sm">
              <p className="text-[#1D4ED8]">Active exposure: {formatAmount(activeExposure)}</p>
              <p className="text-[#7E22CE]">Closed exposure: {formatAmount(closedExposure)}</p>
              <p className="text-[#DC2626]">Pending settlements: {formatAmount(pendingReturns)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-[#0F172A]">Profit Analytics</h2>
          <p className="mt-1 text-sm text-[#64748B]">Profit trend graph, ROI cards, and monthly earnings analytics.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MiniStat label="Current ROI" value={`${roi.toFixed(1)}%`} tone="green" />
            <MiniStat label="Net Profit" value={formatAmount(profitEarned)} tone={profitEarned >= 0 ? "green" : "red"} />
          </div>
          <div className="mt-4">
            <BarRows
              rows={monthly.map((m) => ({
                label: m.month,
                value: toNumber(m.paid) - toNumber(m.committed),
              }))}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-[#0F172A]">Portfolio Distribution</h2>
          <p className="mt-1 text-sm text-[#64748B]">Vendor-wise allocation and investment diversification view.</p>
          <div className="mt-4 space-y-2">
            {topSites.map((site) => {
              const amount = toNumber(site.paid);
              const percent = portfolioTotal > 0 ? (amount / portfolioTotal) * 100 : 0;
              return (
                <div key={site.siteId}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{site.name}</span>
                    <span className="tabular-nums text-[#334155]">{percent.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#E2E8F0]">
                    <div className="h-2 rounded-full bg-[#7C3AED]" style={{ width: `${Math.max(3, percent)}%` }} />
                  </div>
                </div>
              );
            })}
            {!topSites.length ? <p className="text-sm text-[#94A3B8]">No diversification data available.</p> : null}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm xl:col-span-2">
          <h2 className="text-base font-semibold text-[#0F172A]">Transaction History</h2>
          <p className="mt-1 text-sm text-[#64748B]">Date, type, amount, and status for recent transactions.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#E2E8F0] text-xs uppercase tracking-wide text-[#64748B]">
                <tr>
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">Amount</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF2F7]">
                {(wallet.receivedPayments ?? []).slice(0, 8).map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-3 py-3 text-[#334155]">{formatDisplayDate(tx.paidAt)}</td>
                    <td className="px-3 py-3 text-[#334155]">Return</td>
                    <td className="px-3 py-3 tabular-nums text-[#0F172A]">{formatAmount(tx.amount)}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-[#DCFCE7] px-2.5 py-1 text-xs font-semibold text-[#15803D]">Completed</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!(wallet.receivedPayments ?? []).length ? (
              <p className="px-3 py-8 text-center text-sm text-[#94A3B8]">No transactions in this date range.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-[#0F172A]">Recent Activity Timeline</h2>
          <p className="mt-1 text-sm text-[#64748B]">Investments, settlements, withdrawals, and returns.</p>
          <ul className="mt-4 space-y-3">
            {timelineItems.slice(0, 7).map((item) => (
              <li key={item.id} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <p className="text-xs uppercase tracking-wide text-[#64748B]">{item.type}</p>
                <p className="mt-1 text-sm text-[#0F172A]">{item.description}</p>
                <p className="mt-1 text-xs text-[#64748B]">{formatDisplayDate(item.at)}</p>
              </li>
            ))}
            {!timelineItems.length ? <li className="text-sm text-[#94A3B8]">No recent activity yet.</li> : null}
          </ul>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "red" | "blue" | "purple" | "neutral";
}) {
  const toneClass =
    tone === "green"
      ? "text-[#059669]"
      : tone === "red"
        ? "text-[#DC2626]"
        : tone === "blue"
          ? "text-[#2563EB]"
          : tone === "purple"
            ? "text-[#7C3AED]"
            : "text-[#0F172A]";

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums tracking-tight ${toneClass}`}>{value}</p>
    </div>
  );
}

function BarRows({ rows }: { rows: { label: string; value: number }[] }) {
  if (!rows.length) return <p className="text-sm text-[#94A3B8]">No monthly earnings trend available.</p>;
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const pct = (Math.abs(row.value) / max) * 100;
        const positive = row.value >= 0;
        return (
          <div key={row.label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-[#334155]">{row.label}</span>
              <span className={`tabular-nums ${positive ? "text-[#059669]" : "text-[#DC2626]"}`}>{formatAmount(row.value)}</span>
            </div>
            <div className="h-2 rounded-full bg-[#E2E8F0]">
              <div className={`h-2 rounded-full ${positive ? "bg-[#059669]" : "bg-[#DC2626]"}`} style={{ width: `${Math.max(3, pct)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: "green" | "red" }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
      <p className="text-xs uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone === "green" ? "text-[#059669]" : "text-[#DC2626]"}`}>{value}</p>
    </div>
  );
}

function toNumber(value: string | number | null | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatAmount(value: string | number) {
  const n = toNumber(value);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}
