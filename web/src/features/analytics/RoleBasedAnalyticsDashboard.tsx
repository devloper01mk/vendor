"use client";

import { formatLocalYmd } from "@/core/date-display";
import { useApi } from "@/core/use-api";
import type { DashboardSummary } from "@/features/expenses/types";
import { FinancialAnalyticsDashboard } from "@/features/analytics/FinancialAnalyticsDashboard";
import { MemberAnalyticsDashboard } from "@/features/analytics/MemberAnalyticsDashboard";
import { isMemberUser } from "@/features/analytics/role";
import { useAuthStore } from "@/features/auth/auth.store";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { DateRange } from "react-day-picker";
import { useMemo, useState } from "react";

/** Reusable analytics shell for embedding outside `/analytics` if needed. */
export function RoleBasedAnalyticsDashboard() {
  const api = useApi();
  const user = useAuthStore((s) => s.user);
  const isMember = isMemberUser(user?.role);
  const [customRange, setCustomRange] = useState<DateRange | undefined>();

  const { from, to } = useMemo(
    () => ({
      from: customRange?.from ? formatLocalYmd(customRange.from) : undefined,
      to: customRange?.to ? formatLocalYmd(customRange.to) : undefined,
    }),
    [customRange],
  );

  const q = useQuery({
    queryKey: ["dashboard", "analytics", { from: from ?? "", to: to ?? "" }],
    queryFn: () => api.get<DashboardSummary>("/dashboard/summary", { ...(from ? { from } : {}), ...(to ? { to } : {}) }),
    placeholderData: keepPreviousData,
  });

  if (q.isPending && !q.data) return <p className="text-sm text-[#64748B]">Loading analytics...</p>;
  if (q.isError || !q.data) return <p className="text-sm text-red-600">Could not load analytics dashboard.</p>;

  if (isMember) {
    return (
      <MemberAnalyticsDashboard
        data={q.data}
        memberName={user?.name?.trim() || "Member"}
        customRange={customRange}
        onRangeChange={setCustomRange}
        from={from}
        to={to}
      />
    );
  }

  return (
    <FinancialAnalyticsDashboard
      data={q.data}
      customRange={customRange}
      onRangeChange={setCustomRange}
      isFetching={q.isFetching}
    />
  );
}
