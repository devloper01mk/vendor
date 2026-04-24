"use client";

import { ApiError } from "@/core/api/http";
import { useApi } from "@/core/use-api";
import type { VendorRow } from "@/features/expenses/types";
import { useQuery } from "@tanstack/react-query";

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Session expired or not signed in. Please log in again.";
    return err.message || `Request failed (${err.status})`;
  }
  if (err instanceof Error) return err.message;
  return "Failed to load vendors.";
}

export default function VendorsPage() {
  const api = useApi();
  const q = useQuery({
    queryKey: ["vendors"],
    queryFn: () => api.get<VendorRow[]>("/vendors"),
  });

  if (q.isLoading) return <p className="text-sm text-muted">Loading vendors…</p>;
  if (q.isError) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-red-600">Could not load vendors</p>
        <p className="text-sm text-muted">{errorMessage(q.error)}</p>
        {q.error instanceof ApiError && q.error.status ? (
          <p className="text-xs text-muted">HTTP {q.error.status}</p>
        ) : null}
      </div>
    );
  }

  const rows = Array.isArray(q.data) ? q.data : null;
  if (!rows) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-red-600">Unexpected response</p>
        <p className="text-sm text-muted">The server did not return a vendor list.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Vendor insights</h1>
        <p className="mt-1 text-sm text-muted">Paid vs pending by vendor</p>
      </div>

      <div className="surface overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line bg-panel-muted text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Vendor</th>
              <th className="px-4 py-3 font-medium">GST</th>
              <th className="px-4 py-3 font-medium">Committed</th>
              <th className="px-4 py-3 font-medium">Paid</th>
              <th className="px-4 py-3 font-medium">Pending</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((v) => {
              const t = v.totals;
              const committed = t?.committed ?? "—";
              const paid = t?.paid ?? "—";
              const pending = t?.pending ?? "—";
              return (
                <tr key={v.id} className="transition hover:bg-panel-muted">
                  <td className="px-4 py-3 font-medium">{v.name}</td>
                  <td className="px-4 py-3 text-muted">{v.gstNumber ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums">{committed}</td>
                  <td className="px-4 py-3 tabular-nums tone-positive">{paid}</td>
                  <td className="px-4 py-3 tabular-nums tone-negative">{pending}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length ? (
          <p className="px-4 py-10 text-center text-sm text-muted">No vendors yet.</p>
        ) : null}
      </div>
    </div>
  );
}
