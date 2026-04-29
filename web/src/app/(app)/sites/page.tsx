"use client";

import { ApiError } from "@/core/api/http";
import { useApi } from "@/core/use-api";
import { useAuthStore } from "@/features/auth/auth.store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type SiteRow = {
  id: string;
  name: string;
  code?: string | null;
  address?: string | null;
  imageUrl?: string | null;
  metrics?: {
    totalSpent: string;
    transactions: number;
    status: "ACTIVE" | "INACTIVE";
  };
};

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Session expired or not signed in. Please log in again.";
    return err.message || `Request failed (${err.status})`;
  }
  if (err instanceof Error) return err.message;
  return "Failed to load sites.";
}

export default function SitesPage() {
  const api = useApi();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canDelete = user?.role === "ADMIN";
  const [createOpen, setCreateOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<{ id: string; name: string; code: string; address: string } | null>(null);
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [imageName, setImageName] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [actionError, setActionError] = useState("");

  const q = useQuery({
    queryKey: ["sites"],
    queryFn: () => api.get<SiteRow[]>("/sites"),
  });

  async function uploadSiteImage(siteId: string, file: File) {
    const form = new FormData();
    form.append("file", file);
    await api.postMultipart(`/sites/${siteId}/image`, form);
  }

  const createSite = useMutation({
    mutationFn: async (vars: { name: string; code?: string; address?: string }) =>
      api.post<SiteRow>("/sites", {
        name: vars.name,
        code: vars.code?.trim() || undefined,
        address: vars.address?.trim() || undefined,
      }),
    onSuccess: async (createdSite) => {
      if (imageFile) {
        await uploadSiteImage(createdSite.id, imageFile);
      }
      await qc.invalidateQueries({ queryKey: ["sites"] });
      setCreateOpen(false);
      setFormName("");
      setFormCode("");
      setFormAddress("");
      setImageName(null);
      setImageFile(null);
      setActionError("");
    },
    onError: (err) => setActionError(errorMessage(err)),
  });

  const updateSite = useMutation({
    mutationFn: async (vars: { id: string; name: string; code?: string; address?: string }) =>
      api.patch<SiteRow>(`/sites/${vars.id}`, {
        name: vars.name,
        code: vars.code?.trim() || undefined,
        address: vars.address?.trim() || undefined,
      }),
    onSuccess: async (updatedSite) => {
      if (imageFile) {
        await uploadSiteImage(updatedSite.id, imageFile);
      }
      await qc.invalidateQueries({ queryKey: ["sites"] });
      setEditingSite(null);
      setFormName("");
      setFormCode("");
      setFormAddress("");
      setImageName(null);
      setImageFile(null);
      setActionError("");
    },
    onError: (err) => setActionError(errorMessage(err)),
  });

  const deleteSite = useMutation({
    mutationFn: async (id: string) => api.delete(`/sites/${id}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["sites"] });
      setActionError("");
    },
    onError: (err) => setActionError(errorMessage(err)),
  });

  if (q.isLoading) return <p className="text-sm text-[#857B6E]">Loading sites...</p>;
  if (q.isError) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-red-600">Could not load sites</p>
        <p className="text-sm text-[#857B6E]">{errorMessage(q.error)}</p>
      </div>
    );
  }

  const rows = Array.isArray(q.data) ? q.data : null;
  if (!rows) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-red-600">Unexpected response</p>
        <p className="text-sm text-[#857B6E]">The server did not return a site list.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#2A2A2A]">Sites</h1>
          <p className="mt-1 text-sm text-[#7C7266]">Track site spend and activity.</p>
        </div>
        <button
          type="button"
          className="inline-flex h-10 items-center rounded-lg bg-[#C8B693] px-4 text-sm font-medium text-[#2A2A2A] transition hover:brightness-95"
          onClick={() => {
            setCreateOpen(true);
            setEditingSite(null);
            setFormName("");
            setFormCode("");
            setFormAddress("");
            setImageName(null);
            setImageFile(null);
            setActionError("");
          }}
        >
          Add site
        </button>
      </div>

      {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}

      <div className="surface overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[#E5DED3] bg-[#FBF9F5] text-xs uppercase tracking-wide text-[#7E7569]">
            <tr>
              <th className="px-4 py-3 font-medium">Site</th>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Address</th>
              <th className="px-4 py-3 font-medium">Total spent</th>
              <th className="px-4 py-3 font-medium">Transactions</th>
              <th className="w-[1%] px-3 py-3 text-right font-medium whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEE7DD]">
            {rows.map((s) => (
              <tr key={s.id} className="transition hover:bg-[#FAF7F2] active:opacity-95">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[#E5DED3] bg-[#F4EFE7] text-sm font-semibold text-[#6B5D49]">
                      {s.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.imageUrl} alt={s.name} className="h-full w-full object-cover" />
                      ) : (
                        <span>{getSiteInitial(s.name)}</span>
                      )}
                    </div>
                    <span className="font-medium text-[#2A2A2A]">{s.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[#6F6659]">{s.code ?? "—"}</td>
                <td className="px-4 py-3 text-[#6F6659]">{s.address ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums tone-positive">{s.metrics?.totalSpent ?? "0"}</td>
                <td className="px-4 py-3 tabular-nums text-[#4B4338]">{s.metrics?.transactions ?? 0}</td>
                <td className="w-[1%] px-3 py-3 text-right whitespace-nowrap">
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      className="inline-flex rounded-lg border border-[#E5DED3] bg-white px-3 py-1.5 text-xs font-medium text-[#4E463B] transition hover:bg-[#F8F5EF]"
                      onClick={() => {
                        setEditingSite({
                          id: s.id,
                          name: s.name,
                          code: s.code ?? "",
                          address: s.address ?? "",
                        });
                        setCreateOpen(false);
                        setFormName(s.name);
                        setFormCode(s.code ?? "");
                        setFormAddress(s.address ?? "");
                        setImageName(null);
                        setImageFile(null);
                        setActionError("");
                      }}
                    >
                      Edit
                    </button>
                    {canDelete ? (
                      <button
                        type="button"
                        className="inline-flex rounded-lg border border-[#E5DED3] bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-[#F8F5EF]"
                        disabled={deleteSite.isPending}
                        onClick={() => {
                          const ok = window.confirm(`Delete site "${s.name}"? This cannot be undone.`);
                          if (!ok) return;
                          setActionError("");
                          deleteSite.mutate(s.id);
                        }}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <p className="px-4 py-10 text-center text-sm text-[#8A8072]">No sites yet.</p> : null}
      </div>

      {createOpen || editingSite ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/25 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setCreateOpen(false);
              setEditingSite(null);
            }
          }}
        >
          <div className="surface w-full max-w-lg p-5">
            <h3 className="text-lg font-semibold text-[#2A2A2A]">{createOpen ? "Add site" : "Edit site"}</h3>
            <div className="mt-4 grid gap-3">
              <label className="text-xs font-medium uppercase tracking-wide text-[#7E7569]">
                Site image
                <input
                  type="file"
                  accept="image/*"
                  className="input-base mt-1"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setImageFile(f ?? null);
                    setImageName(f?.name ?? null);
                  }}
                />
                <p className="mt-1 text-[11px] normal-case tracking-normal text-[#857B6E]">
                  {imageName ? `Selected: ${imageName}` : "Select image to upload"}
                </p>
              </label>
              <label className="text-xs font-medium uppercase tracking-wide text-[#7E7569]">
                Name
                <input className="input-base mt-1" value={formName} onChange={(e) => setFormName(e.target.value)} />
              </label>
              <label className="text-xs font-medium uppercase tracking-wide text-[#7E7569]">
                Code
                <input className="input-base mt-1" value={formCode} onChange={(e) => setFormCode(e.target.value)} />
              </label>
              <label className="text-xs font-medium uppercase tracking-wide text-[#7E7569]">
                Address
                <textarea
                  className="input-base mt-1"
                  rows={3}
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                />
              </label>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="inline-flex rounded-xl border border-[#E5DED3] bg-white px-4 py-2 text-sm font-medium text-[#4E463B] transition hover:bg-[#F8F5EF]"
                onClick={() => {
                  setCreateOpen(false);
                  setEditingSite(null);
                  setImageName(null);
                  setImageFile(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex rounded-xl bg-[#C8B693] px-4 py-2 text-sm font-medium text-[#2A2A2A] transition hover:brightness-95 disabled:opacity-60"
                disabled={createSite.isPending || updateSite.isPending}
                onClick={() => {
                  const name = formName.trim();
                  if (!name) {
                    setActionError("Site name is required.");
                    return;
                  }
                  setActionError("");
                  if (createOpen) {
                    createSite.mutate({ name, code: formCode, address: formAddress });
                    return;
                  }
                  if (!editingSite) return;
                  updateSite.mutate({ id: editingSite.id, name, code: formCode, address: formAddress });
                }}
              >
                {createOpen ? "Create" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getSiteInitial(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "S";
  return trimmed[0]?.toUpperCase() ?? "S";
}
