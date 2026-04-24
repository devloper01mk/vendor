"use client";

import type { DashboardSummary } from "@/features/expenses/types";
import { useApi } from "@/core/use-api";
import { useQuery } from "@tanstack/react-query";

export default function AnalyticsPage() {
  const api = useApi();
  const q = useQuery({
    queryKey: ["dashboard", "analytics"],
    queryFn: () => api.get<DashboardSummary>("/dashboard/summary"),
  });

  if (q.isLoading) return <p className="text-sm text-muted">Loading analytics…</p>;
  if (q.isError || !q.data) return <p className="text-sm text-negative">Could not load analytics.</p>;

  const d = q.data;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted">Simple, precise financial patterns without visual clutter</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="surface p-5">
          <p className="label">Top pending vendors</p>
          <ul className="mt-3 space-y-2">
            {d.vendorPending.slice(0, 6).map((v) => (
              <li key={v.vendorId} className="flex items-center justify-between rounded-lg border border-line bg-panel-muted px-3 py-2 text-sm">
                <span>{v.name}</span>
                <span className="tabular-nums tone-negative">{v.pending}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface p-5">
          <p className="label">Top paid sites</p>
          <ul className="mt-3 space-y-2">
            {d.siteSpend.slice(0, 6).map((s) => (
              <li key={s.siteId} className="flex items-center justify-between rounded-lg border border-line bg-panel-muted px-3 py-2 text-sm">
                <span>{s.name}</span>
                <span className="tabular-nums tone-positive">{s.paid}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
