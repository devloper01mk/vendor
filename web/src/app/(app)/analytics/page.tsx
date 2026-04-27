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

  if (q.isLoading) return <p className="text-sm text-[#857B6E]">Loading analytics...</p>;
  if (q.isError || !q.data) return <p className="text-sm text-negative">Could not load analytics.</p>;

  const d = q.data;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#2A2A2A]">Reports</h1>
        <p className="mt-1 text-sm text-[#7C7266]">Simple financial patterns with a clean executive view.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="surface p-5">
          <p className="text-xs uppercase tracking-wide text-[#7E7569]">Top pending vendors</p>
          <ul className="mt-3 space-y-2">
            {d.vendorPending.slice(0, 6).map((v) => (
              <li
                key={v.vendorId}
                className="flex items-center justify-between rounded-xl border border-[#E8E1D6] bg-[#FAF7F2] px-3 py-2 text-sm"
              >
                <span className="text-[#2A2A2A]">{v.name}</span>
                <span className="tabular-nums tone-negative">{v.pending}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface p-5">
          <p className="text-xs uppercase tracking-wide text-[#7E7569]">Top paid sites</p>
          <ul className="mt-3 space-y-2">
            {d.siteSpend.slice(0, 6).map((s) => (
              <li
                key={s.siteId}
                className="flex items-center justify-between rounded-xl border border-[#E8E1D6] bg-[#FAF7F2] px-3 py-2 text-sm"
              >
                <span className="text-[#2A2A2A]">{s.name}</span>
                <span className="tabular-nums tone-positive">{s.paid}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
