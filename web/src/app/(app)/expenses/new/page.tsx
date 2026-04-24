"use client";

/**
 * End-to-end flow: create requirement → record payment → attach invoice (PDF/image).
 * Demonstrates multipart + JSON fields against the Nest API.
 */

import type { VendorRow } from "@/features/expenses/types";
import { useApi } from "@/core/use-api";
import { useAuthStore } from "@/features/auth/auth.store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
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
        billReceived: false,
      };
      const row = await api.post<{ id: string }>("/requirements", body);
      if (payAmount && Number(payAmount) > 0) {
        await api.post(`/requirements/${row.id}/payments`, { amount: Number(payAmount) });
      }
      const f = fileRef.current?.files?.[0];
      if (f) {
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
        <h1 className="text-3xl font-semibold tracking-tight">New transaction</h1>
        <p className="mt-1 text-sm text-muted">Requirement, optional payment, optional invoice</p>
      </div>

      <div className="surface space-y-4 p-6">
        <select
          className="input-base"
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
        >
          <option value="">Select vendor</option>
          {(vendorsQ.data ?? []).map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <select
          className="input-base"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
        >
          <option value="">Select site</option>
          {(sitesQ.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          className="input-base"
          placeholder="Item name"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
        />
        <input
          className="input-base"
          placeholder="Brand / source"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
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
