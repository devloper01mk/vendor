"use client";

import { ApiError } from "@/core/api/http";
import { useApi } from "@/core/use-api";
import { useAuthStore } from "@/features/auth/auth.store";
import { AppSelect } from "@/components/ui/AppSelect";
import type { VendorRow } from "@/features/expenses/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

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
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canDelete = user?.role === "ADMIN";
  const [editingVendor, setEditingVendor] = useState<{ id: string; name: string; gstNumber: string } | null>(null);
  const [formName, setFormName] = useState("");
  const [formGst, setFormGst] = useState("");
  const [actionError, setActionError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [memberId, setMemberId] = useState("");

  const usersQ = useQuery({
    queryKey: ["users", "vendors-filter"],
    queryFn: () => api.get<{ id: string; name: string; role: string }[]>("/users"),
    enabled: user?.role === "ADMIN" || user?.role === "ACCOUNT_HEAD",
  });

  const q = useQuery({
    queryKey: ["vendors", { search, memberId }],
    queryFn: () =>
      api.get<VendorRow[]>("/vendors", {
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(memberId ? { memberId } : {}),
      }),
  });

  const updateVendor = useMutation({
    mutationFn: async (vars: { id: string; name: string; gstNumber?: string }) =>
      api.patch(`/vendors/${vars.id}`, {
        name: vars.name,
        gstNumber: vars.gstNumber?.trim() || undefined,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["vendors"] });
      setEditingVendor(null);
      setActionError("");
    },
    onError: (err) => setActionError(errorMessage(err)),
  });

  const deleteVendor = useMutation({
    mutationFn: async (id: string) => api.delete(`/vendors/${id}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["vendors"] });
      setActionError("");
    },
    onError: (err) => setActionError(errorMessage(err)),
  });

  if (q.isLoading) return <p className="text-sm text-[#857B6E]">Loading vendors...</p>;
  if (q.isError) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-red-600">Could not load vendors</p>
        <p className="text-sm text-[#857B6E]">{errorMessage(q.error)}</p>
        {q.error instanceof ApiError && q.error.status ? (
          <p className="text-xs text-[#857B6E]">HTTP {q.error.status}</p>
        ) : null}
      </div>
    );
  }

  const rows = Array.isArray(q.data) ? q.data : null;
  if (!rows) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-red-600">Unexpected response</p>
        <p className="text-sm text-[#857B6E]">The server did not return a vendor list.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#2A2A2A]">Vendors</h1>
          <p className="mt-1 text-sm text-[#7C7266]">Paid versus pending distribution by vendor.</p>
        </div>
        <div className="flex flex-wrap items-end justify-start gap-3 lg:justify-end">
          <label className="text-xs font-medium uppercase tracking-wide text-[#7E7569]">
            Search
            <input
              className="input-base mt-1 w-64"
              placeholder="Search vendor or GST"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setSearch(searchInput.trim());
                }
              }}
            />
          </label>
          {user?.role !== "MEMBER" ? (
            <label className="text-xs font-medium uppercase tracking-wide text-[#7E7569]">
              Member
              <AppSelect
                value={memberId}
                onChange={setMemberId}
                className="w-56"
                options={[
                  { value: "", label: "All members" },
                  ...(usersQ.data ?? [])
                    .filter((u) => u.role === "MEMBER")
                    .map((u) => ({ value: u.id, label: u.name })),
                ]}
              />
            </label>
          ) : null}
        </div>
      </div>
      {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}

      <div className="surface overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[#E5DED3] bg-[#FBF9F5] text-xs uppercase tracking-wide text-[#7E7569]">
            <tr>
              <th className="px-4 py-3 font-medium">Vendor</th>
              <th className="px-4 py-3 font-medium">GST</th>
              <th className="px-4 py-3 font-medium">Committed</th>
              <th className="px-4 py-3 font-medium">Paid</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Pending</th>
              <th className="w-[1%] px-3 py-3 text-right font-medium whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEE7DD]">
            {rows.map((v) => {
              const t = v.totals;
              const committed = t?.committed ?? "—";
              const paid = t?.paid ?? "—";
              const pending = t?.pending ?? "—";
              return (
                <tr key={v.id} className="transition hover:bg-[#FAF7F2] active:opacity-95">
                  <td className="px-4 py-3 font-medium text-[#2A2A2A]">{v.name}</td>
                  <td className="px-4 py-3 text-[#6F6659]">{v.gstNumber ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-[#4B4338]">{committed}</td>
                  <td className="px-4 py-3 tabular-nums tone-positive">{paid}</td>
                  <td className="px-4 py-3 tabular-nums tone-negative whitespace-nowrap">{pending}</td>
                  <td className="w-[1%] px-3 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        className="inline-flex rounded-lg border border-[#E5DED3] bg-white px-3 py-1.5 text-xs font-medium text-[#4E463B] transition hover:bg-[#F8F5EF]"
                        onClick={() => {
                          setEditingVendor({
                            id: v.id,
                            name: v.name,
                            gstNumber: v.gstNumber ?? "",
                          });
                          setFormName(v.name);
                          setFormGst(v.gstNumber ?? "");
                          setActionError("");
                        }}
                      >
                        Edit
                      </button>
                      {canDelete ? (
                        <button
                          type="button"
                          className="inline-flex rounded-lg border border-[#E5DED3] bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-[#F8F5EF]"
                          disabled={deleteVendor.isPending}
                          onClick={() => {
                            const ok = window.confirm(
                              `Delete vendor "${v.name}"? This cannot be undone.`,
                            );
                            if (!ok) return;
                            setActionError("");
                            deleteVendor.mutate(v.id);
                          }}
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length ? (
          <p className="px-4 py-10 text-center text-sm text-[#8A8072]">No vendors yet.</p>
        ) : null}
      </div>

      {editingVendor ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/25 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditingVendor(null);
          }}
        >
          <div className="surface w-full max-w-lg p-5">
            <h3 className="text-lg font-semibold text-[#2A2A2A]">Edit vendor</h3>
            <div className="mt-4 grid gap-3">
              <label className="text-xs font-medium uppercase tracking-wide text-[#7E7569]">
                Name
                <input
                  className="input-base mt-1"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </label>
              <label className="text-xs font-medium uppercase tracking-wide text-[#7E7569]">
                GST
                <input
                  className="input-base mt-1"
                  value={formGst}
                  onChange={(e) => setFormGst(e.target.value)}
                />
              </label>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="inline-flex rounded-xl border border-[#E5DED3] bg-white px-4 py-2 text-sm font-medium text-[#4E463B] transition hover:bg-[#F8F5EF]"
                onClick={() => setEditingVendor(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex rounded-xl bg-[#C8B693] px-4 py-2 text-sm font-medium text-[#2A2A2A] transition hover:brightness-95 disabled:opacity-60"
                disabled={updateVendor.isPending}
                onClick={() => {
                  const name = formName.trim();
                  if (!name) {
                    setActionError("Vendor name is required.");
                    return;
                  }
                  setActionError("");
                  updateVendor.mutate({
                    id: editingVendor.id,
                    name,
                    gstNumber: formGst.trim() || undefined,
                  });
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
