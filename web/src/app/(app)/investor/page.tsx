"use client";

import { DateRangeControls } from "@/components/ui/DateRangeControls";
import { formatDisplayDate } from "@/core/date-display";
import { useApi } from "@/core/use-api";
import { useAuthStore } from "@/features/auth/auth.store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { DateRange } from "react-day-picker";
import { useEffect, useMemo, useState } from "react";

type InvestorEntry = {
  id: string;
  name: string;
  amount: string;
  date: string;
  paymentReceivedDate: string;
  paymentMode: string;
  note: string;
  createdBy?: { id: string; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
};

export default function InvestorPage() {
  const api = useApi();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const canViewInvestor = user?.role === "ADMIN";
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentReceivedDate, setPaymentReceivedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMode, setPaymentMode] = useState("");
  const [note, setNote] = useState("");
  const [filterRange, setFilterRange] = useState<DateRange | undefined>();
  const [filterPaymentMode, setFilterPaymentMode] = useState("");
  const [uiError, setUiError] = useState("");
  const [uiSuccess, setUiSuccess] = useState("");

  useEffect(() => {
    if (!canViewInvestor) router.replace("/dashboard");
  }, [canViewInvestor, router]);

  const investorsQ = useQuery({
    queryKey: ["investors"],
    queryFn: () => api.get<InvestorEntry[]>("/investors"),
    enabled: canViewInvestor,
  });

  const createInvestor = useMutation({
    mutationFn: async (payload: {
      name: string;
      amount: number;
      date: string;
      paymentReceivedDate: string;
      paymentMode: string;
      note?: string;
    }) => api.post<InvestorEntry>("/investors", payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["investors"] });
      setUiSuccess("Investor entry created successfully.");
    },
    onError: (err) => {
      setUiError(err instanceof Error ? err.message : "Could not create investor entry.");
    },
  });

  const updateInvestor = useMutation({
    mutationFn: async (payload: {
      id: string;
      name: string;
      amount: number;
      date: string;
      paymentReceivedDate: string;
      paymentMode: string;
      note?: string;
    }) =>
      api.patch<InvestorEntry>(`/investors/${payload.id}`, {
        name: payload.name,
        amount: payload.amount,
        date: payload.date,
        paymentReceivedDate: payload.paymentReceivedDate,
        paymentMode: payload.paymentMode,
        note: payload.note,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["investors"] });
      setUiSuccess("Investor entry updated successfully.");
    },
    onError: (err) => {
      setUiError(err instanceof Error ? err.message : "Could not update investor entry.");
    },
  });

  const deleteInvestor = useMutation({
    mutationFn: async (id: string) => api.delete(`/investors/${id}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["investors"] });
      setUiSuccess("Investor entry deleted successfully.");
    },
    onError: (err) => {
      setUiError(err instanceof Error ? err.message : "Could not delete investor entry.");
    },
  });

  const lastInvestorName = investorsQ.data?.[0]?.name ?? "";
  const paymentModeOptions = useMemo(() => {
    const modes = new Set<string>();
    for (const entry of investorsQ.data ?? []) {
      const mode = entry.paymentMode.trim();
      if (mode) modes.add(mode);
    }
    return Array.from(modes).sort((a, b) => a.localeCompare(b));
  }, [investorsQ.data]);
  const filteredInvestors = (investorsQ.data ?? []).filter((entry) => {
    const matchesDate =
      filterRange?.from || filterRange?.to
        ? (() => {
            const paidAt = new Date(entry.paymentReceivedDate);
            const paidAtYmd = new Date(paidAt.getFullYear(), paidAt.getMonth(), paidAt.getDate());
            if (filterRange?.from) {
              const from = new Date(filterRange.from.getFullYear(), filterRange.from.getMonth(), filterRange.from.getDate());
              if (paidAtYmd < from) return false;
            }
            if (filterRange?.to) {
              const to = new Date(filterRange.to.getFullYear(), filterRange.to.getMonth(), filterRange.to.getDate());
              if (paidAtYmd > to) return false;
            }
            return true;
          })()
        : true;
    const matchesMode = filterPaymentMode ? entry.paymentMode === filterPaymentMode : true;
    return matchesDate && matchesMode;
  });

  if (!canViewInvestor) return null;

  function handleSaveInvestor() {
    if (!name.trim()) {
      setUiError("Investor name is required.");
      return;
    }
    if (!paymentReceivedDate) {
      setUiError("Payment received date is required.");
      return;
    }
    if (!amount.trim()) {
      setUiError("Amount is required.");
      return;
    }
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setUiError("Enter a valid amount greater than 0.");
      return;
    }
    if (!paymentMode.trim()) {
      setUiError("Payment mode is required.");
      return;
    }
    setUiError("");
    const payload = {
      name: name.trim(),
      amount: parsedAmount,
      date: new Date(paymentReceivedDate).toISOString(),
      paymentReceivedDate: new Date(paymentReceivedDate).toISOString(),
      paymentMode: paymentMode.trim(),
      note: note.trim() || undefined,
    };
    const onSuccess = () => {
      setCreateOpen(false);
      setEditingId(null);
      setName("");
      setAmount("");
      setPaymentReceivedDate(new Date().toISOString().slice(0, 10));
      setPaymentMode("");
      setNote("");
      setUiError("");
    };
    if (editingId) {
      updateInvestor.mutate(
        { id: editingId, ...payload },
        { onSuccess },
      );
      return;
    }
    createInvestor.mutate(payload, { onSuccess });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#2A2A2A]">Investor</h1>
          <p className="mt-1 text-sm text-[#7C7266]">Track investor payments with mode and notes.</p>
        </div>
        <div className="flex flex-wrap items-end justify-start gap-3 lg:justify-end">
          <DateRangeControls compact customRange={filterRange} onRangeChange={setFilterRange} />
          <label className="text-xs font-medium uppercase tracking-wide text-[#7E7569]">
            Payment mode filter
            <select
              className="input-base mt-1 min-w-[180px]"
              value={filterPaymentMode}
              onChange={(e) => setFilterPaymentMode(e.target.value)}
            >
              <option value="">All payment modes</option>
              {paymentModeOptions.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="inline-flex h-10 items-center rounded-lg bg-[#C8B693] px-4 text-sm font-medium text-[#2A2A2A] transition hover:brightness-95"
            onClick={() => {
              setCreateOpen(true);
              setEditingId(null);
              setUiError("");
              setUiSuccess("");
              setName(lastInvestorName);
              setAmount("");
              setPaymentReceivedDate(new Date().toISOString().slice(0, 10));
              setPaymentMode("");
              setNote("");
            }}
          >
            Add investor
          </button>
        </div>
      </div>
      {uiError ? <p className="text-sm text-red-600">{uiError}</p> : null}
      {uiSuccess ? <p className="text-sm text-green-700">{uiSuccess}</p> : null}

      <section className="surface overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[#E5DED3] bg-[#FBF9F5] text-xs uppercase tracking-wide text-[#7E7569]">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Payment Received Date</th>
              <th className="px-4 py-3 font-medium">Payment mode</th>
              <th className="px-4 py-3 font-medium">Note</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEE7DD]">
            {filteredInvestors.map((entry) => (
              <tr key={entry.id}>
                <td className="px-4 py-3 font-medium text-[#2A2A2A]">{entry.name}</td>
                <td className="px-4 py-3 tabular-nums text-[#2A2A2A]">{entry.amount}</td>
                <td className="px-4 py-3 tabular-nums text-[#6F6659]">{formatDisplayDate(entry.paymentReceivedDate)}</td>
                <td className="px-4 py-3 text-[#6F6659]">{entry.paymentMode}</td>
                <td className="px-4 py-3 text-[#6F6659]">{entry.note || "—"}</td>
                <td className="px-4 py-3 text-[#6F6659]">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex rounded-lg border border-[#E5DED3] bg-white px-3 py-1.5 text-xs font-medium text-[#4E463B] transition hover:bg-[#F8F5EF]"
                      onClick={() => {
                        setCreateOpen(true);
                        setEditingId(entry.id);
                        setUiError("");
                        setUiSuccess("");
                        setName(entry.name);
                        setAmount(entry.amount);
                        setPaymentReceivedDate(entry.paymentReceivedDate.slice(0, 10));
                        setPaymentMode(entry.paymentMode);
                        setNote(entry.note || "");
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="inline-flex rounded-lg border border-[#E5DED3] bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-[#F8F5EF]"
                      disabled={deleteInvestor.isPending}
                      onClick={() => {
                        const ok = window.confirm(`Delete investor entry for "${entry.name}"?`);
                        if (!ok) return;
                        setUiError("");
                        setUiSuccess("");
                        deleteInvestor.mutate(entry.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {investorsQ.isLoading ? <p className="px-4 py-10 text-center text-sm text-[#8A8072]">Loading investor entries...</p> : null}
        {investorsQ.isError ? <p className="px-4 py-10 text-center text-sm text-red-600">Could not load investor entries.</p> : null}
        {!investorsQ.isLoading && !investorsQ.isError && !filteredInvestors.length ? (
          <p className="px-4 py-10 text-center text-sm text-[#8A8072]">
            {(filterRange?.from || filterRange?.to || filterPaymentMode.trim())
              ? "No investor entries for selected filters."
              : "No investor entries yet."}
          </p>
        ) : null}
      </section>

      {createOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/25 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setCreateOpen(false);
            }
          }}
        >
          <div className="surface w-full max-w-lg p-5">
            <h3 className="text-lg font-semibold text-[#2A2A2A]">{editingId ? "Edit investor" : "Add investor"}</h3>
            <div className="mt-4 grid gap-3">
              <label className="text-xs font-medium uppercase tracking-wide text-[#7E7569]">
                Name
                <input className="input-base mt-1" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="text-xs font-medium uppercase tracking-wide text-[#7E7569]">
                Amount
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="input-base mt-1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <label className="text-xs font-medium uppercase tracking-wide text-[#7E7569]">
                Payment received date
                <input
                  type="date"
                  className="input-base mt-1"
                  value={paymentReceivedDate}
                  onChange={(e) => setPaymentReceivedDate(e.target.value)}
                />
              </label>
              <label className="text-xs font-medium uppercase tracking-wide text-[#7E7569]">
                Payment mode
                <input
                  className="input-base mt-1"
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  placeholder="UPI / Bank transfer / Cash"
                />
              </label>
              <label className="text-xs font-medium uppercase tracking-wide text-[#7E7569]">
                Note
                <textarea className="input-base mt-1" value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="inline-flex rounded-xl border border-[#E5DED3] bg-white px-4 py-2 text-sm font-medium text-[#4E463B] transition hover:bg-[#F8F5EF]"
                onClick={() => {
                  setCreateOpen(false);
                  setEditingId(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex rounded-xl bg-[#C8B693] px-4 py-2 text-sm font-medium text-[#2A2A2A] transition hover:brightness-95"
                disabled={createInvestor.isPending || updateInvestor.isPending}
                onClick={handleSaveInvestor}
              >
                {createInvestor.isPending || updateInvestor.isPending
                  ? editingId
                    ? "Saving..."
                    : "Creating..."
                  : editingId
                    ? "Save"
                    : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
