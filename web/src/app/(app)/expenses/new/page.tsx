"use client";

/**
 * End-to-end flow: create requirement → record payment → attach invoice (PDF/image).
 * Demonstrates multipart + JSON fields against the Nest API.
 */

import type { VendorRow } from "@/features/expenses/types";
import { useApi } from "@/core/use-api";
import { useAuthStore } from "@/features/auth/auth.store";
import { AppSelect } from "@/components/ui/AppSelect";
import { CloseIconButton } from "@/components/ui/CloseIconButton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function NewExpensePage() {
  const api = useApi();
  const qc = useQueryClient();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const fileRef = useRef<HTMLInputElement>(null);
  const isReadOnly = user?.role === "ADMIN" || user?.role === "ACCOUNT_HEAD";

  const vendorsQ = useQuery({ queryKey: ["vendors"], queryFn: () => api.get<VendorRow[]>("/vendors"), enabled: !isReadOnly });
  const sitesQ = useQuery({
    queryKey: ["sites"],
    queryFn: () => api.get<{ id: string; name: string }[]>("/sites"),
    enabled: !isReadOnly,
  });

  const [vendorId, setVendorId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [itemName, setItemName] = useState("");
  const [brand, setBrand] = useState("");
  const [qty, setQty] = useState("1");
  const [total, setTotal] = useState("");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [billStatus, setBillStatus] = useState<"yes" | "no">("no");
  const [payAmount, setPayAmount] = useState("");
  const [gst, setGst] = useState('{"gstin":"","taxableValue":"","cgst":"","sgst":""}');
  const [msg, setMsg] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      setMsg(null);
      const body = {
        vendorId,
        siteId,
        itemName,
        brand: brand || undefined,
        quantity: Number(qty),
        totalAmount: Number(total),
        entryDate: new Date(entryDate).toISOString(),
        status: "PENDING",
        billStatus,
      };
      const row = await api.post<{ id: string }>("/requirements", body);
      if (payAmount && Number(payAmount) > 0) {
        await api.post(`/requirements/${row.id}/payments`, { amount: Number(payAmount) });
      }
      const f = fileRef.current?.files?.[0];
      if (billStatus === "yes" && f) {
        const form = new FormData();
        form.append("file", f);
        form.append("gstDetails", gst);
        await api.postMultipart(`/requirements/${row.id}/invoice`, form);
      }
      return row.id;
    },
    onSuccess: async (id) => {
      await qc.invalidateQueries({ queryKey: ["requirements"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      setMsg(`Saved. Requirement ${id}`);
      router.push("/expenses");
    },
    onError: () => setMsg("Could not save. Check fields and API."),
  });

  useEffect(() => {
    if (isReadOnly) {
      router.replace("/expenses");
    }
  }, [isReadOnly, router]);

  if (isReadOnly) {
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <Link
            href="/expenses"
            className="inline-flex items-center rounded-xl border border-[#E5DED3] bg-white px-3 py-1.5 text-sm font-medium text-[#4E463B] transition hover:bg-[#F8F5EF]"
          >
            Back
          </Link>
          <CloseIconButton onClick={() => router.push("/expenses")} />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">New transaction</h1>
        <p className="mt-1 text-sm text-muted">Requirement, optional payment, optional invoice</p>
      </div>

      <div className="surface space-y-4 p-6">
        <AppSelect
          value={vendorId}
          onChange={setVendorId}
          options={[
            { value: "", label: "Select Brand/Person" },
            ...(vendorsQ.data ?? []).map((v) => ({ value: v.id, label: v.name })),
          ]}
        />
        <AppSelect
          value={siteId}
          onChange={setSiteId}
          options={[
            { value: "", label: "Select site" },
            ...(sitesQ.data ?? []).map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
        <input
          className="input-base"
          placeholder="Item name"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
        />
        <input
          className="input-base"
          placeholder="Details"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        />
        <label className="text-xs text-muted">Bill status</label>
        <AppSelect
          value={billStatus}
          onChange={(value) => setBillStatus(value as "yes" | "no")}
          options={[
            { value: "no", label: "No" },
            { value: "yes", label: "Yes" },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            className="input-base"
            placeholder="Qty"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <input
            className="input-base"
            placeholder="Total amount"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
          />
        </div>
        <input
          type="date"
          className="input-base"
          value={entryDate}
          onChange={(e) => setEntryDate(e.target.value)}
        />
        <input
          className="input-base"
          placeholder="Initial payment (optional)"
          value={payAmount}
          onChange={(e) => setPayAmount(e.target.value)}
        />
        {billStatus === "yes" ? (
          <div>
          <label className="text-xs text-muted">Invoice PDF / image + GST JSON</label>
          <input ref={fileRef} type="file" accept="application/pdf,image/*" className="mt-1 block w-full text-sm" />
          <textarea
            className="input-base mt-2 font-mono text-xs"
            rows={3}
            value={gst}
            onChange={(e) => setGst(e.target.value)}
          />
          </div>
        ) : null}
        {msg ? <p className="text-sm text-muted">{msg}</p> : null}
        <button
          type="button"
          disabled={create.isPending || !vendorId || !siteId || !itemName || !total}
          onClick={() => create.mutate()}
          className="btn-primary w-full disabled:opacity-40"
        >
          {create.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
