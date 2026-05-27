"use client";

import { DateRangeControls, getPresetRange } from "@/components/ui/DateRangeControls";
import { formatDisplayDate } from "@/core/date-display";
import type { DashboardSummary } from "@/features/expenses/types";
import {
  AlertCard,
  AnalyticsPageHeader,
  AnalyticsSummaryCard,
  SectionHead,
  StatusBadge,
  analyticsCard,
} from "@/features/analytics/components";
import { CashFlowBarChart, DonutChart } from "@/features/analytics/charts";
import type { DateRange } from "react-day-picker";
import { useState } from "react";

type QuickRange = "today" | "week" | "month" | "custom";

export function FinancialAnalyticsDashboard({
  data,
  customRange,
  onRangeChange,
  isFetching,
}: {
  data: DashboardSummary;
  customRange: DateRange | undefined;
  onRangeChange: (range: DateRange | undefined) => void;
  isFetching?: boolean;
}) {
  const [quickRange, setQuickRange] = useState<QuickRange>("month");
  const [cashFlowView, setCashFlowView] = useState<"monthly" | "weekly">("monthly");
  const [cashFlowFilter, setCashFlowFilter] = useState<"both" | "incoming" | "outgoing">("both");

  const totals = {
    received: amount(data.investor?.totalReceived),
    paid: amount(data.totals.paid),
    pending: amount(data.totals.pending),
    liability: amount(data.totals.committed),
    settled: amount(data.userFunding?.paidToUsers),
    available: amount(data.investor?.totalReceived) - amount(data.totals.paid),
  };

  const monthlyRows = data.monthly.slice(-12).map((row) => ({
    label: row.month,
    incoming: amount(row.committed),
    outgoing: amount(row.paid),
  }));
  const weeklyRows = buildWeeklyRows(monthlyRows).slice(-8);
  const cashFlowRows = cashFlowView === "weekly" ? weeklyRows : monthlyRows;
  const cashFlowIncomingTotal = cashFlowRows.reduce((sum, row) => sum + row.incoming, 0);
  const cashFlowOutgoingTotal = cashFlowRows.reduce((sum, row) => sum + row.outgoing, 0);

  const vendorRows = [...(data.vendorBreakdown ?? [])]
    .sort((a, b) => amount(b.pending) - amount(a.pending))
    .slice(0, 8);

  const investorRows = [...(data.investor?.entries ?? [])]
    .map((entry) => ({ ...entry, numericAmount: amount(entry.amount) }))
    .sort((a, b) => b.numericAmount - a.numericAmount)
    .slice(0, 6);

  const totalInvestorContrib = Math.max(1, investorRows.reduce((sum, row) => sum + row.numericAmount, 0));

  const transactions = [
    ...(data.memberWallet?.receivedPayments ?? []).map((p) => ({
      date: p.paidAt,
      id: p.id,
      type: "Incoming",
      amount: amount(p.amount),
      status: "Success" as const,
    })),
    ...(data.userFunding?.payments ?? []).map((p, index) => ({
      date: new Date().toISOString(),
      id: `SET-${index + 1}`,
      type: "Settlement",
      amount: amount(p.amount),
      status: "Pending" as const,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);

  const setRange = (next: QuickRange) => {
    setQuickRange(next);
    if (next === "custom") return;
    const map = { today: "today", week: "week", month: "thisMonth" } as const;
    onRangeChange(getPresetRange(map[next]));
  };

  const riskAlerts = [
    {
      title: "High pending vendor payments",
      detail: `${data.vendorPending.length} vendors with outstanding balances`,
      severity: "high" as const,
    },
    {
      title: "Delayed settlements",
      detail: `${data.alerts.filter((a) => /delay|pending/i.test(a.message)).length} items need follow-up`,
      severity: "medium" as const,
    },
    ...(totals.available < 0
      ? [{ title: "Negative balance warning", detail: "Available funds are below zero", severity: "high" as const }]
      : []),
  ];

  return (
    <div className={`space-y-6 ${isFetching ? "opacity-70" : ""}`}>
      <div className={`${analyticsCard} sticky top-0 z-10`}>
        <AnalyticsPageHeader
          title="Financial Analytics"
          subtitle="Monitor payments, liabilities, funds, and business insights"
          notificationCount={data.alerts.length}
        >
          <div className="flex flex-wrap items-center justify-end gap-2">
            {(
              [
                { id: "today", label: "Today" },
                { id: "week", label: "This Week" },
                { id: "month", label: "This Month" },
                { id: "custom", label: "Custom Range" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRange(opt.id)}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                  quickRange === opt.id
                    ? "bg-[#111827] text-white shadow-sm"
                    : "border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]"
                }`}
              >
                {opt.label}
              </button>
            ))}
            {quickRange === "custom" ? (
              <DateRangeControls customRange={customRange} onRangeChange={onRangeChange} compact />
            ) : null}
          </div>
        </AnalyticsPageHeader>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        <AnalyticsSummaryCard
          label="Total Funds Received"
          hint="Money from investors and other sources"
          value={formatInr(totals.received)}
          tone="green"
          icon={<IconWallet />}
        />
        <AnalyticsSummaryCard
          label="Vendor Payments Done"
          hint="Successfully paid to vendors"
          value={formatInr(totals.paid)}
          tone="green"
          icon={<IconCheck />}
        />
        <AnalyticsSummaryCard
          label="Pending Vendor Payments"
          hint="Outstanding vendor dues"
          value={formatInr(totals.pending)}
          tone="red"
          icon={<IconAlert />}
        />
        <AnalyticsSummaryCard
          label="Total Vendor Liability"
          hint="Overall payable amount"
          value={formatInr(totals.liability)}
          tone="orange"
          icon={<IconChart />}
        />
        <AnalyticsSummaryCard
          label="Accounts Settled"
          hint="Settled by accounting team"
          value={formatInr(totals.settled)}
          tone="blue"
          icon={<IconReceipt />}
        />
        <AnalyticsSummaryCard
          label="Available Balance"
          hint="Current available funds"
          value={formatInr(totals.available)}
          tone="highlight"
          icon={<IconBank />}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <div className={`${analyticsCard} xl:col-span-2`}>
          <SectionHead
            title="Cash Flow Analytics"
            sub={cashFlowView === "weekly" ? "Incoming vs outgoing money — weekly report" : "Incoming vs outgoing money — monthly trend"}
            badge="Live"
          />
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCashFlowView("weekly")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  cashFlowView === "weekly"
                    ? "bg-[#2563EB] text-white"
                    : "border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]"
                }`}
              >
                Weekly Report
              </button>
              <button
                type="button"
                onClick={() => setCashFlowView("monthly")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  cashFlowView === "monthly"
                    ? "bg-[#2563EB] text-white"
                    : "border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]"
                }`}
              >
                Monthly Report
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[#6B7280]">Data filter</span>
              <select
                value={cashFlowFilter}
                onChange={(e) => setCashFlowFilter(e.target.value as "both" | "incoming" | "outgoing")}
                className="rounded-lg border border-[#E5E7EB] bg-white px-2 py-1.5 text-xs text-[#374151] outline-none"
              >
                <option value="both">Incoming + Outgoing</option>
                <option value="incoming">Incoming only</option>
                <option value="outgoing">Outgoing only</option>
              </select>
            </div>
          </div>
          <div className="mb-3 flex gap-4 text-xs text-[#6B7280]">
            {cashFlowFilter !== "outgoing" ? (
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#3B82F6]" /> Incoming {formatInr(cashFlowIncomingTotal)}
              </span>
            ) : null}
            {cashFlowFilter !== "incoming" ? (
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#10B981]" /> Outgoing {formatInr(cashFlowOutgoingTotal)}
              </span>
            ) : null}
          </div>
          <CashFlowBarChart rows={cashFlowRows} mode={cashFlowFilter} />
        </div>

        <div className={analyticsCard}>
          <SectionHead title="Vendor Payment Distribution" sub="Paid vs pending allocation" />
          <DonutChart
            segments={[
              { label: "Paid", value: totals.paid, color: "#10B981" },
              { label: "Pending", value: totals.pending, color: "#EF4444" },
            ]}
          />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className={analyticsCard}>
          <SectionHead title="Vendor Analytics" sub="Top vendors by pending balance" />
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-left text-xs uppercase tracking-wide text-[#6B7280]">
                  <th className="pb-3 pr-4 font-medium">Vendor</th>
                  <th className="pb-3 pr-4 text-right font-medium">Paid</th>
                  <th className="pb-3 text-right font-medium">Pending</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {vendorRows.map((row) => (
                  <tr key={row.vendorId} className="transition hover:bg-[#F9FAFB]">
                    <td className="py-3 pr-4 font-medium text-[#111827]">{row.name}</td>
                    <td className="py-3 pr-4 text-right tabular-nums text-[#059669]">{formatInr(amount(row.paid))}</td>
                    <td className="py-3 text-right tabular-nums text-[#DC2626]">{formatInr(amount(row.pending))}</td>
                  </tr>
                ))}
                {!vendorRows.length ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-[#9CA3AF]">
                      No vendor data for this period.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className={analyticsCard}>
          <SectionHead title="Investor Analytics" sub="Contributions and fund utilization" />
          <div className="space-y-3">
            {investorRows.map((investor) => {
              const pct = Math.min(100, (investor.numericAmount / totalInvestorContrib) * 100);
              return (
                <div key={investor.name} className="rounded-xl border border-[#F3F4F6] bg-[#F9FAFB] p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-[#111827]">{investor.name}</span>
                    <span className="font-semibold tabular-nums text-[#2563EB]">{formatInr(investor.numericAmount)}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
                    <div className="h-full rounded-full bg-[#3B82F6]" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-[#9CA3AF]">{pct.toFixed(0)}% of tracked contributions</p>
                </div>
              );
            })}
            {!investorRows.length ? (
              <p className="text-sm text-[#9CA3AF]">No investor contribution data.</p>
            ) : null}
          </div>
        </div>
      </section>

      <section>
        <div className={analyticsCard}>
          <SectionHead title="Risk Monitoring" sub="High pending alerts and settlement delays" />
          <div className="grid gap-3 sm:grid-cols-3">
            <RiskStat label="Pending vendors" value={String(data.vendorPending.length)} />
            <RiskStat
              label="Delayed settlements"
              value={String(data.alerts.filter((a) => /delay|pending/i.test(a.message)).length)}
            />
            <RiskStat label="Balance warnings" value={totals.available < 0 ? "1" : "0"} alert />
          </div>
          <div className="mt-4 space-y-2">
            {riskAlerts.map((alert) => (
              <AlertCard key={alert.title} title={alert.title} detail={alert.detail} severity={alert.severity} />
            ))}
            {data.alerts.slice(0, 4).map((a) => (
              <AlertCard key={`${a.type}-${a.requirementId}`} title={a.type} detail={a.message} severity="high" />
            ))}
          </div>
        </div>
      </section>

      <section className={analyticsCard}>
        <SectionHead title="Transaction Activity" sub="Recent financial movements with status tracking" />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB] text-left text-xs uppercase tracking-wide text-[#6B7280]">
                <th className="pb-3 pr-4 font-medium">Date</th>
                <th className="pb-3 pr-4 font-medium">Transaction ID</th>
                <th className="pb-3 pr-4 font-medium">Type</th>
                <th className="pb-3 pr-4 text-right font-medium">Amount</th>
                <th className="pb-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {transactions.map((row) => (
                <tr key={`${row.id}-${row.date}`} className="transition hover:bg-[#F9FAFB]">
                  <td className="py-3 pr-4 text-[#6B7280]">{formatDisplayDate(row.date)}</td>
                  <td className="py-3 pr-4 font-medium text-[#111827]">{row.id}</td>
                  <td className="py-3 pr-4 text-[#374151]">{row.type}</td>
                  <td className="py-3 pr-4 text-right font-semibold tabular-nums text-[#111827]">
                    {formatInr(row.amount)}
                  </td>
                  <td className="py-3 text-right">
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
              {!transactions.length ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-[#9CA3AF]">
                    No transactions for the selected range.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}

function RiskStat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3 ${alert && value !== "0" ? "border-[#FECACA] bg-[#FEF2F2]" : "border-[#F3F4F6] bg-[#F9FAFB]"}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${alert && value !== "0" ? "text-[#DC2626]" : "text-[#111827]"}`}>
        {value}
      </p>
    </div>
  );
}

function amount(value: string | number | undefined | null) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function buildWeeklyRows(rows: { label: string; incoming: number; outgoing: number }[]) {
  return rows.flatMap((row) =>
    [1, 2, 3, 4].map((week) => ({
      label: `${row.label}-W${week}`,
      incoming: row.incoming / 4,
      outgoing: row.outgoing / 4,
    })),
  );
}

function IconWallet() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7h18v10H3zM16 12h2" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12l4 4L19 6" />
    </svg>
  );
}
function IconAlert() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 8v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19V5M10 19V9M16 19v-6M22 19V3" />
    </svg>
  );
}
function IconReceipt() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z" />
    </svg>
  );
}
function IconBank() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10h18M5 10V18M9 10V18M15 10V18M19 10V18M2 20h20M12 3L2 10h20L12 3z" />
    </svg>
  );
}
