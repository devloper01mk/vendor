"use client";

import type { RequirementRow, VendorRow } from "@/features/expenses/types";
import { formatDisplayDate, formatDisplayDateTime, formatLocalYmd } from "@/core/date-display";
import { getApiBaseUrl } from "@/core/config";
import { useApi } from "@/core/use-api";
import { useAuthStore } from "@/features/auth/auth.store";
import { AppSelect } from "@/components/ui/AppSelect";
import { CloseIconButton } from "@/components/ui/CloseIconButton";
import { DateRangeControls } from "@/components/ui/DateRangeControls";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DateRange } from "react-day-picker";
import { useEffect, useMemo, useRef, useState } from "react";

type ListResponse = {
  items: RequirementRow[];
  total: number;
  page: number;
  limit: number;
};

type RequirementsQueryCache = [unknown[], ListResponse | undefined][];

type UpdateLogEntry = NonNullable<RequirementRow["updateLogs"]>[number];

type LogTableRow = { field: string; previous: string; current: string };

/** Resolve stored vendor/site UUIDs to labels for update-log tables. */
type IdNameMaps = { vendorNameById: Map<string, string>; siteNameById: Map<string, string> };

const emptyIdNameMaps: IdNameMaps = {
  vendorNameById: new Map(),
  siteNameById: new Map(),
};

function resolveVendorDisplay(vendorId: string, row: RequirementRow, vendorNameById: Map<string, string>): string {
  const id = vendorId.trim();
  if (!id) return "—";
  if (id === row.vendor.id) return row.vendor.name;
  return vendorNameById.get(id) ?? id;
}

function resolveSiteDisplay(siteId: string, row: RequirementRow, siteNameById: Map<string, string>): string {
  const id = siteId.trim();
  if (!id) return "—";
  if (id === row.site.id) return row.site.name;
  return siteNameById.get(id) ?? id;
}

function logEventLabel(pd: Record<string, unknown>): string {
  const action = typeof pd.action === "string" ? pd.action : undefined;
  if (action === "PAYMENT_ADDED") return "Payment recorded";
  if (action === "PAYMENT_UPDATED") return "Payment updated";
  if (action === "INVOICE_ATTACHED") return "Invoice attached";
  if (action === "INVOICE_REPLACED") return "Invoice replaced";
  if (action === "REQUIREMENT_EDIT" || pd.itemName !== undefined) return "Expense fields edited";
  return "Update";
}

function cellsEffectivelyEqual(a: string, b: string): boolean {
  const ta = a.trim();
  const tb = b.trim();
  if (ta === tb) return true;
  const na = Number(ta.replace(/,/g, ""));
  const nb = Number(tb.replace(/,/g, ""));
  if (Number.isFinite(na) && Number.isFinite(nb) && Math.abs(na - nb) < 1e-6) return true;
  return false;
}

function isRequirementBodySnapshot(pd: Record<string, unknown>): boolean {
  if (pd.action === "REQUIREMENT_EDIT") return true;
  return pd.itemName !== undefined && pd.totalAmount !== undefined;
}

function requirementDetailToSnapshot(row: RequirementRow): Record<string, string> {
  return {
    "Item name": row.itemName,
    "Details / brand": row.brand ?? "—",
    Quantity: row.quantity,
    "Total amount": row.totalAmount,
    Status: row.status,
    "Bill received": row.billReceived ? "Yes" : "No",
    "Entry date": row.entryDate.slice(0, 10),
    Notes: row.notes?.trim() ? row.notes : "—",
    "Brand/person": row.vendor.name,
    Site: row.site.name,
  };
}

function requirementPreviousDataToSnapshot(
  pd: Record<string, unknown>,
  row: RequirementRow,
  maps: IdNameMaps,
): Record<string, string> {
  const vendorId = pd.vendorId != null ? String(pd.vendorId) : "";
  const siteId = pd.siteId != null ? String(pd.siteId) : "";
  return {
    "Item name": pd.itemName != null ? String(pd.itemName) : "—",
    "Details / brand": pd.brand != null ? String(pd.brand) : "—",
    Quantity: pd.quantity != null ? String(pd.quantity) : "—",
    "Total amount": pd.totalAmount != null ? String(pd.totalAmount) : "—",
    Status: pd.status != null ? String(pd.status) : "—",
    "Bill received": pd.billReceived === true ? "Yes" : pd.billReceived === false ? "No" : "—",
    "Entry date": pd.entryDate != null ? String(pd.entryDate).slice(0, 10) : "—",
    Notes: pd.notes != null && String(pd.notes).trim() ? String(pd.notes) : "—",
    "Brand/person": resolveVendorDisplay(vendorId, row, maps.vendorNameById),
    Site: resolveSiteDisplay(siteId, row, maps.siteNameById),
  };
}

/** State of expense fields right after the edit at `logIndex` (logs = newest first). */
function postEditRequirementSnapshot(
  logs: NonNullable<RequirementRow["updateLogs"]>,
  logIndex: number,
  row: RequirementRow,
  maps: IdNameMaps,
): Record<string, string> {
  if (logIndex <= 0) return requirementDetailToSnapshot(row);
  for (let j = logIndex - 1; j >= 0; j -= 1) {
    const pd = logs[j].previousData as Record<string, unknown>;
    if (isRequirementBodySnapshot(pd)) {
      return requirementPreviousDataToSnapshot(pd, row, maps);
    }
  }
  return requirementDetailToSnapshot(row);
}

function buildRequirementEditRows(
  logs: NonNullable<RequirementRow["updateLogs"]>,
  logIndex: number,
  row: RequirementRow,
  maps: IdNameMaps,
): LogTableRow[] {
  const pd = logs[logIndex].previousData as Record<string, unknown>;
  if (!isRequirementBodySnapshot(pd)) return [];
  const prevSnap = requirementPreviousDataToSnapshot(pd, row, maps);
  const currSnap = postEditRequirementSnapshot(logs, logIndex, row, maps);
  const keys = Array.from(new Set([...Object.keys(prevSnap), ...Object.keys(currSnap)]));
  const out: LogTableRow[] = [];
  for (const field of keys) {
    const previous = prevSnap[field] ?? "—";
    const current = currSnap[field] ?? "—";
    if (!cellsEffectivelyEqual(previous, current)) {
      out.push({ field, previous, current });
    }
  }
  if (out.length === 0) {
    for (const field of keys) {
      out.push({
        field,
        previous: prevSnap[field] ?? "—",
        current: currSnap[field] ?? "—",
      });
    }
  }
  return out;
}

function buildPaymentAddedRows(pd: Record<string, unknown>, logIndex: number, row: RequirementRow): LogTableRow[] {
  const amt = pd.amount != null ? String(pd.amount) : "—";
  const paidBefore = pd.paidTotalBefore != null ? String(pd.paidTotalBefore) : "—";
  const statusBefore =
    pd.requirementStatusBefore != null ? String(pd.requirementStatusBefore) : "—";
  const nb = Number(paidBefore.replace(/,/g, ""));
  const na = Number(amt.replace(/,/g, ""));
  const runningAfter =
    Number.isFinite(nb) && Number.isFinite(na) ? (nb + na).toFixed(2) : "—";
  const rows: LogTableRow[] = [
    { field: "Payment amount", previous: "—", current: amt },
    { field: "Running paid total", previous: paidBefore, current: runningAfter },
  ];
  if (logIndex === 0) {
    rows.push({ field: "Requirement status", previous: statusBefore, current: row.status });
  }
  return rows;
}

function buildPaymentUpdatedRows(
  pd: Record<string, unknown>,
  row: RequirementRow,
): LogTableRow[] {
  const before = pd.before as Record<string, unknown> | undefined;
  const paymentId = typeof pd.paymentId === "string" ? pd.paymentId : "";
  const pay = row.payments.find((p) => p.id === paymentId);
  if (!before && !pay) {
    return [{ field: "Payment", previous: "—", current: "Updated (details unavailable)" }];
  }
  const curAmount = pay?.amount ?? "—";
  const curPaidAt = pay?.paidAt ? pay.paidAt.slice(0, 10) : "—";
  const curMethod = pay?.method?.trim() ? String(pay.method) : "—";
  const curNote = pay?.note?.trim() ? String(pay.note) : "—";
  const rows: LogTableRow[] = [];
  if (before?.amount != null || pay) {
    rows.push({
      field: "Amount",
      previous: before?.amount != null ? String(before.amount) : "—",
      current: curAmount,
    });
  }
  rows.push({
    field: "Paid date",
    previous: before?.paidAt != null ? String(before.paidAt).slice(0, 10) : "—",
    current: curPaidAt,
  });
  rows.push({
    field: "Method",
    previous: before?.method != null && String(before.method).trim() ? String(before.method) : "—",
    current: curMethod,
  });
  rows.push({
    field: "Note",
    previous: before?.note != null && String(before.note).trim() ? String(before.note) : "—",
    current: curNote,
  });
  const filtered = rows.filter((r) => !cellsEffectivelyEqual(r.previous, r.current));
  return filtered.length > 0 ? filtered : rows;
}

function buildInvoiceRows(pd: Record<string, unknown>, logIndex: number, row: RequirementRow): LogTableRow[] {
  const action = typeof pd.action === "string" ? pd.action : "";
  const file = String(pd.originalName ?? "—");
  const billBefore = pd.billReceivedBefore === true ? "Yes" : pd.billReceivedBefore === false ? "No" : "—";
  const billAfter =
    logIndex === 0
      ? row.billReceived
        ? "Yes"
        : "No"
      : "Yes";
  return [
    { field: "Event", previous: "—", current: action.replace(/_/g, " ") },
    { field: "File name", previous: "—", current: file },
    { field: "Bill received", previous: billBefore, current: billAfter },
  ];
}

function buildLogTableRows(
  log: UpdateLogEntry,
  logIndex: number,
  logs: NonNullable<RequirementRow["updateLogs"]>,
  row: RequirementRow,
  maps: IdNameMaps = emptyIdNameMaps,
): LogTableRow[] {
  const pd = log.previousData as Record<string, unknown>;
  const action = typeof pd.action === "string" ? pd.action : undefined;

  if (action === "PAYMENT_ADDED") {
    return buildPaymentAddedRows(pd, logIndex, row);
  }
  if (action === "PAYMENT_UPDATED") {
    return buildPaymentUpdatedRows(pd, row);
  }
  if (action === "INVOICE_ATTACHED" || action === "INVOICE_REPLACED") {
    return buildInvoiceRows(pd, logIndex, row);
  }
  if (isRequirementBodySnapshot(pd)) {
    return buildRequirementEditRows(logs, logIndex, row, maps);
  }
  const raw = JSON.stringify(pd);
  return [
    {
      field: "Raw payload",
      previous: "—",
      current: raw.length > 200 ? `${raw.slice(0, 200)}…` : raw,
    },
  ];
}

export default function ExpensesPage() {
  const api = useApi();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const isReadOnly = user?.role === "ADMIN" || user?.role === "ACCOUNT_HEAD";
  const canManageFlags = user?.role === "ADMIN" || user?.role === "ACCOUNT_HEAD";
  const canDeleteTransaction = user?.role === "ADMIN";
  const [vendorId, setVendorId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [detailRow, setDetailRow] = useState<RequirementRow | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentBillStatus, setPaymentBillStatus] = useState<"yes" | "no">("no");
  const [paymentInvoiceFile, setPaymentInvoiceFile] = useState<File | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [paymentUiError, setPaymentUiError] = useState("");
  const [invoiceUiError, setInvoiceUiError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [vendorIdDraft, setVendorIdDraft] = useState("");
  const [siteIdDraft, setSiteIdDraft] = useState("");
  const [itemNameDraft, setItemNameDraft] = useState("");
  const [brandDraft, setBrandDraft] = useState("");
  const [qtyDraft, setQtyDraft] = useState("1");
  const [totalDraft, setTotalDraft] = useState("");
  const [entryDateDraft, setEntryDateDraft] = useState(() => new Date().toISOString().slice(0, 10));
  const [billStatusDraft, setBillStatusDraft] = useState<"yes" | "no">("no");
  const [payAmountDraft, setPayAmountDraft] = useState("");
  const [createStatus, setCreateStatus] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const invoiceInputRef = useRef<HTMLInputElement | null>(null);
  const paymentInvoiceInputRef = useRef<HTMLInputElement | null>(null);
  const [paymentInvoiceRequirementId, setPaymentInvoiceRequirementId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteUiError, setDeleteUiError] = useState("");
  const from = customRange?.from ? formatLocalYmd(customRange.from) : "";
  const to = customRange?.to ? formatLocalYmd(customRange.to) : "";

  useEffect(() => {
    if (!detailRow) {
      setDeleteConfirmOpen(false);
      setDeleteUiError("");
    }
  }, [detailRow]);

  const vendorsQ = useQuery({
    queryKey: ["vendors"],
    queryFn: () =>
      api.get<VendorRow[]>("/vendors").then((rows) => rows.map((r) => ({ id: r.id, name: r.name }))),
  });
  const sitesQ = useQuery({
    queryKey: ["sites"],
    queryFn: () => api.get<{ id: string; name: string }[]>("/sites"),
  });

  const updateLogNameMaps = useMemo((): IdNameMaps => {
    const vendorNameById = new Map<string, string>();
    for (const v of vendorsQ.data ?? []) {
      vendorNameById.set(v.id, v.name);
    }
    const siteNameById = new Map<string, string>();
    for (const s of sitesQ.data ?? []) {
      siteNameById.set(s.id, s.name);
    }
    return { vendorNameById, siteNameById };
  }, [vendorsQ.data, sitesQ.data]);

  /** Include the open row’s vendor/site so log IDs always resolve to at least those names. */
  const updateLogNameMapsForDetail = useMemo((): IdNameMaps => {
    const vendorNameById = new Map(updateLogNameMaps.vendorNameById);
    const siteNameById = new Map(updateLogNameMaps.siteNameById);
    if (detailRow) {
      vendorNameById.set(detailRow.vendor.id, detailRow.vendor.name);
      siteNameById.set(detailRow.site.id, detailRow.site.name);
    }
    return { vendorNameById, siteNameById };
  }, [updateLogNameMaps, detailRow]);

  const query = useMemo(
    () => ({
      page: "1",
      limit: "100",
      ...(vendorId ? { vendorId } : {}),
      ...(siteId ? { siteId } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    }),
    [vendorId, siteId, from, to],
  );

  const listQ = useQuery({
    queryKey: ["requirements", query],
    queryFn: async () => {
      const firstPage = await api.get<ListResponse>("/requirements", query);
      const total = firstPage.total ?? firstPage.items.length;
      const perPage = Math.max(1, firstPage.limit || Number(query.limit) || 100);
      const totalPages = Math.max(1, Math.ceil(total / perPage));
      if (totalPages <= 1) return firstPage;

      const pageRequests: Promise<ListResponse>[] = [];
      for (let page = 2; page <= totalPages; page += 1) {
        pageRequests.push(api.get<ListResponse>("/requirements", { ...query, page: String(page) }));
      }
      const restPages = await Promise.all(pageRequests);
      return {
        ...firstPage,
        items: [firstPage.items, ...restPages.map((p) => p.items)].flat(),
      };
    },
  });

  const paymentStats = useMemo(() => {
    const rows = listQ.data?.items ?? [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const sevenDaysStart = new Date(todayStart);
    sevenDaysStart.setDate(sevenDaysStart.getDate() - 6);

    let today = 0;
    let yesterday = 0;
    let last7 = 0;
    const byUser = new Map<string, number>();

    for (const r of rows) {
      for (const p of r.payments ?? []) {
        const amount = Number(p.amount ?? 0);
        if (!Number.isFinite(amount)) continue;
        const paidAt = new Date(p.paidAt);
        if (paidAt >= todayStart && paidAt < tomorrowStart) today += amount;
        if (paidAt >= yesterdayStart && paidAt < todayStart) yesterday += amount;
        if (paidAt >= sevenDaysStart && paidAt < tomorrowStart) last7 += amount;
        if (p.recordedBy?.name) {
          byUser.set(p.recordedBy.name, (byUser.get(p.recordedBy.name) ?? 0) + amount);
        }
      }
    }

    return {
      today: today.toFixed(2),
      yesterday: yesterday.toFixed(2),
      last7: last7.toFixed(2),
      byUser: [...byUser.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, amount]) => ({ name, amount: amount.toFixed(2) })),
    };
  }, [listQ.data?.items]);

  const flagMutation = useMutation({
    mutationFn: ({ id, flagged }: { id: string; flagged: boolean }) =>
      api.patch(`/requirements/${id}/highlight`, {
        flagged,
        reason: flagged ? "Marked by admin for correction" : undefined,
      }),
    onMutate: async ({ id, flagged }) => {
      await qc.cancelQueries({ queryKey: ["requirements"] });
      const previous = qc.getQueriesData<ListResponse>({ queryKey: ["requirements"] }) as RequirementsQueryCache;
      const previousDetailRow = detailRow;

      qc.setQueriesData<ListResponse>({ queryKey: ["requirements"] }, (old) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((row) =>
            row.id === id
              ? {
                  ...row,
                  isFlagged: flagged,
                  flagReason: flagged ? "Marked by admin for correction" : null,
                }
              : row,
          ),
        };
      });

      setDetailRow((old) =>
        old?.id === id
          ? {
              ...old,
              isFlagged: flagged,
              flagReason: flagged ? "Marked by admin for correction" : null,
            }
          : old,
      );

      return { previous, previousDetailRow };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx?.previous) return;
      for (const [key, data] of ctx.previous) {
        qc.setQueryData(key, data);
      }
      if (ctx.previousDetailRow !== undefined) setDetailRow(ctx.previousDetailRow);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["requirements"] });
    },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: (id: string) => api.delete<{ ok: boolean }>(`/requirements/${id}`),
    onSuccess: async () => {
      setDetailRow(null);
      setDeleteConfirmOpen(false);
      setDeleteUiError("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["requirements"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
    onError: (err) => {
      setDeleteUiError(err instanceof Error ? err.message : "Could not delete transaction.");
    },
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.postMultipart<{ imported: number; updated: number; skipped: number; errors: string[] }>(
        "/import/spreadsheet",
        form,
      );
    },
    onSuccess: async (result) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["requirements"] }),
        qc.invalidateQueries({ queryKey: ["vendors"] }),
        qc.invalidateQueries({ queryKey: ["sites"] }),
      ]);
      setImportStatus(
        `Import complete: ${result.imported} imported, ${result.updated} updated, ${result.skipped} skipped.`,
      );
    },
    onError: (err) => {
      setImportStatus(err instanceof Error ? err.message : "Import failed.");
    },
  });

  const addPaymentMutation = useMutation({
    mutationFn: async (vars: { requirementId: string; amount: number; method?: string; note?: string; paidAt?: string }) =>
      api.post<RequirementRow>(`/requirements/${vars.requirementId}/payments`, {
        amount: vars.amount,
        method: vars.method || undefined,
        note: vars.note || undefined,
        paidAt: vars.paidAt || undefined,
      }),
    onSuccess: async (updated) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["requirements"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      setDetailRow(updated);
      setPaymentOpen(false);
      setPaymentAmount("");
      setPaymentMethod("");
      setPaymentNote("");
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setPaymentBillStatus("no");
      setPaymentInvoiceFile(null);
      setPaymentUiError("");
    },
    onError: (err) => {
      setPaymentUiError(err instanceof Error ? err.message : "Could not record payment.");
    },
  });

  const uploadPaymentInvoiceMutation = useMutation({
    mutationFn: async (vars: { requirementId: string; file: File }) => {
      const form = new FormData();
      form.append("file", vars.file);
      return api.postMultipart<RequirementRow>(`/requirements/${vars.requirementId}/invoice`, form);
    },
    onSuccess: async (updatedRow) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["requirements"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      setDetailRow(updatedRow);
      setInvoiceUiError("");
    },
    onError: (err) => {
      setInvoiceUiError(err instanceof Error ? err.message : "Could not upload invoice.");
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const body = {
        vendorId: vendorIdDraft,
        siteId: siteIdDraft,
        itemName: itemNameDraft,
        brand: brandDraft || undefined,
        quantity: Number(qtyDraft),
        totalAmount: Number(totalDraft),
        entryDate: new Date(entryDateDraft).toISOString(),
        status: "PENDING",
        billStatus: billStatusDraft,
      };
      const row = await api.post<{ id: string }>("/requirements", body);
      if (payAmountDraft && Number(payAmountDraft) > 0) {
        await api.post(`/requirements/${row.id}/payments`, { amount: Number(payAmountDraft) });
      }
      const invoiceFile = invoiceInputRef.current?.files?.[0];
      if (billStatusDraft === "yes" && invoiceFile) {
        const form = new FormData();
        form.append("file", invoiceFile);
        form.append("gstDetails", '{"gstin":"","taxableValue":"","cgst":"","sgst":""}');
        await api.postMultipart(`/requirements/${row.id}/invoice`, form);
      }
      return row.id;
    },
    onSuccess: async (id) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["requirements"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      setCreateStatus(`Saved. Requirement ${id}`);
      setCreateOpen(false);
      setVendorIdDraft("");
      setSiteIdDraft("");
      setItemNameDraft("");
      setBrandDraft("");
      setQtyDraft("1");
      setTotalDraft("");
      setEntryDateDraft(new Date().toISOString().slice(0, 10));
      setBillStatusDraft("no");
      setPayAmountDraft("");
      if (invoiceInputRef.current) invoiceInputRef.current.value = "";
    },
    onError: (err) => {
      setCreateStatus(err instanceof Error ? err.message : "Could not save. Check fields and try again.");
    },
  });

  function handleImportClick() {
    setImportStatus(null);
    fileInputRef.current?.click();
  }

  function handleExportClick() {
    setExportStatus(null);
    if (!token) {
      setExportStatus("Please sign in again.");
      return;
    }
    try {
      const base = getApiBaseUrl();
      const url = new URL(`${base}/import/spreadsheet/export`);
      url.searchParams.set("accessToken", token);
      window.open(url.toString(), "_blank", "noopener,noreferrer");
      setExportStatus("Export started.");
    } catch (err) {
      setExportStatus(err instanceof Error ? err.message : "Export failed.");
    }
  }

  if (listQ.isError) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-red-600">Could not load transactions</p>
        <p className="text-sm text-[#857B6E]">{listQ.error instanceof Error ? listQ.error.message : "Request failed"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#2A2A2A]">Transactions</h1>
          <p className="mt-1 text-sm text-[#7C7266]">Clean ledger view with consistent admin styling.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <DateRangeControls customRange={customRange} onRangeChange={setCustomRange} />
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              importMutation.mutate(file);
              e.currentTarget.value = "";
            }}
          />
          <button
            type="button"
            className="inline-flex items-center rounded-xl border border-[#E5DED3] bg-white px-4 py-2.5 text-sm font-medium text-[#4E463B] transition hover:bg-[#F8F5EF] disabled:opacity-60"
            onClick={handleImportClick}
            disabled={importMutation.isPending || listQ.isLoading}
          >
            {importMutation.isPending ? "Importing..." : "Import"}
          </button>
          <button
            type="button"
            className="inline-flex items-center rounded-xl border border-[#E5DED3] bg-white px-4 py-2.5 text-sm font-medium text-[#4E463B] transition hover:bg-[#F8F5EF] disabled:opacity-60"
            onClick={handleExportClick}
            disabled={importMutation.isPending}
          >
            Export
          </button>
          {!isReadOnly ? (
            <button
              type="button"
              className="inline-flex items-center rounded-xl bg-[#C8B693] px-4 py-2.5 text-sm font-medium text-[#2A2A2A] transition hover:brightness-95"
              onClick={() => {
                setCreateStatus(null);
                setCreateOpen(true);
              }}
            >
              Add expense
            </button>
          ) : null}
        </div>
      </div>
      {importStatus ? <p className="text-sm text-[#7C7266]">{importStatus}</p> : null}
      <p className="text-xs text-[#8A8072]">Import/Export columns use: Brand/Person, Details, Bill Status.</p>
      {exportStatus ? <p className="text-sm text-[#7C7266]">{exportStatus}</p> : null}

      <div className="rounded-2xl border border-[#E5DED3] bg-white p-3 shadow-[0_1px_2px_rgba(21,21,21,0.06),0_8px_24px_rgba(21,21,21,0.04)]">
        <div className="flex flex-wrap items-center gap-2">
          <AppSelect
            value={vendorId}
            onChange={setVendorId}
            className="h-10 min-w-[220px] rounded-lg border-[#ECE5DA] bg-[#FCFBF8] text-sm"
            options={[
              { value: "", label: "All Brand/Person" },
              ...(vendorsQ.data ?? []).map((v) => ({ value: v.id, label: v.name })),
            ]}
          />
          <AppSelect
            value={siteId}
            onChange={setSiteId}
            className="h-10 min-w-[220px] rounded-lg border-[#ECE5DA] bg-[#FCFBF8] text-sm"
            options={[
              { value: "", label: "All Site" },
              ...(sitesQ.data ?? []).map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        </div>
      </div>

      <div className="surface overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[#E5DED3] bg-[#FBF9F5] text-xs uppercase tracking-wide text-[#7E7569]">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium">Brand/Person</th>
              <th className="px-4 py-3 font-medium">Site</th>
              <th className="px-4 py-3 font-medium">Details</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Paid</th>
              <th className="px-4 py-3 font-medium">Due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEE7DD]">
            {(listQ.data?.items ?? []).map((r) => (
              <tr
                key={r.id}
                className={`cursor-pointer transition hover:bg-[#FAF7F2] active:opacity-95 ${r.isFlagged ? "bg-[#F3ECE1]" : ""}`}
                onClick={() => setDetailRow(r)}
              >
                <td className="px-4 py-3 tabular-nums text-[#7B7265]">
                  {formatDisplayDate(r.entryDate)}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{r.itemName}</div>
                  {r.brand ? <div className="text-xs text-[#8D8376]">{r.brand}</div> : null}
                </td>
                <td className="px-4 py-3">{r.vendor.name}</td>
                <td className="px-4 py-3">{r.site.name}</td>
                <td className="px-4 py-3">{r.brand || "—"}</td>
                <td className="px-4 py-3 tabular-nums tone-positive">{r.totalAmount}</td>
                <td className="px-4 py-3 tabular-nums text-[#2A2A2A]">{r.paidTotal}</td>
                <td className="px-4 py-3 tabular-nums tone-negative">{r.remaining}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!listQ.data?.items.length ? (
          <p className="px-4 py-10 text-center text-sm text-[#8A8072]">No rows match filters.</p>
        ) : null}
      </div>

      {canManageFlags ? (
        <section className="grid gap-4 md:grid-cols-3">
          <div className="surface p-4">
            <p className="text-xs uppercase tracking-wide text-[#7E7569]">Today paid</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums tone-positive">{paymentStats.today}</p>
          </div>
          <div className="surface p-4">
            <p className="text-xs uppercase tracking-wide text-[#7E7569]">Yesterday paid</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums tone-negative">{paymentStats.yesterday}</p>
          </div>
          <div className="surface p-4">
            <p className="text-xs uppercase tracking-wide text-[#7E7569]">Last 7 days paid</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-[#2A2A2A]">{paymentStats.last7}</p>
          </div>
        </section>
      ) : null}

      {canManageFlags ? (
        <section className="surface p-4">
          <h2 className="mb-3 text-sm font-medium text-[#7E7569]">Payments by recorder (visible rows)</h2>
          <ul className="divide-y divide-[#EEE7DD] rounded-xl border border-[#E5DED3]">
            {paymentStats.byUser.map((u) => (
              <li key={u.name} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>{u.name}</span>
                <span className="tabular-nums">{u.amount}</span>
              </li>
            ))}
            {!paymentStats.byUser.length ? (
              <li className="px-4 py-6 text-center text-sm text-[#8A8072]">No payment rows in selected range.</li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {detailRow ? (
        <div
          className="fixed inset-0 z-[120] flex justify-end bg-ink/30"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDetailRow(null);
          }}
        >
          <div className="h-dvh w-full max-w-xl overflow-auto border-l border-line bg-panel">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-panel px-4 py-3">
              <h3 className="text-base font-semibold">Expense details</h3>
              <CloseIconButton onClick={() => setDetailRow(null)} />
            </div>
            <div className="space-y-4 px-4 pt-3 pb-4 text-sm">
              <div className="rounded-xl border border-line bg-panel-muted p-3">
                <p className="text-lg font-semibold">{detailRow.itemName}</p>
                <p className="mt-1 text-xs text-muted">{detailRow.brand ?? "No details"}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Info label="Date" value={formatDisplayDate(detailRow.entryDate)} />
                <Info label="Status" value={detailRow.status} />
                <Info label="Brand/Person" value={detailRow.vendor.name} />
                <Info label="Site" value={detailRow.site.name} />
                <Info label="Details" value={detailRow.brand || "—"} />
                {user?.role !== "MEMBER" ? <Info label="Entry user" value={detailRow.createdBy.name} /> : null}
                <Info label="Quantity" value={detailRow.quantity} />
                <Info label="Total" value={detailRow.totalAmount} />
                <Info label="Paid" value={detailRow.paidTotal} />
                <Info label="Due" value={detailRow.remaining} />
                {user?.role !== "MEMBER" ? (
                  <Info label="Bill received" value={detailRow.billReceived ? "Yes" : "No"} />
                ) : null}
              </div>
              <div className="rounded-xl border border-line p-3">
                <p className="text-xs uppercase tracking-wide text-muted">Notes</p>
                <p className="mt-2">{detailRow.notes ?? "—"}</p>
              </div>
              {user?.role !== "MEMBER" ? (
                <div className="rounded-xl border border-line p-3">
                  <p className="text-xs uppercase tracking-wide text-muted">Invoice</p>
                  {detailRow.invoice?.fileUrl ? (
                    <a href={detailRow.invoice.fileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-ink underline-offset-2 hover:underline">
                      Download invoice
                    </a>
                  ) : (
                    <p className="mt-2 text-sm text-muted">No invoice attached.</p>
                  )}
                </div>
              ) : null}
              <div className="rounded-xl border border-line p-3">
                <p className="text-xs uppercase tracking-wide text-muted">Payment timeline</p>
                <input
                  ref={paymentInvoiceInputRef}
                  type="file"
                  className="hidden"
                  accept="application/pdf,image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    const requirementId = paymentInvoiceRequirementId;
                    if (!file || !requirementId) return;
                    setInvoiceUiError("");
                    uploadPaymentInvoiceMutation.mutate({ requirementId, file });
                    e.currentTarget.value = "";
                  }}
                />
                <div className="mt-2">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setEditingPaymentId(null);
                      setPaymentOpen(true);
                      setPaymentAmount("");
                      setPaymentMethod("");
                      setPaymentNote("");
                      setPaymentDate(new Date().toISOString().slice(0, 10));
                      setPaymentBillStatus("no");
                      setPaymentInvoiceFile(null);
                      setPaymentUiError("");
                    }}
                  >
                    Record payment
                  </button>
                </div>
                <div className="mt-2 overflow-x-auto">
                  {(() => {
                    const sorted = [...(detailRow.payments ?? [])].sort(
                      (a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime(),
                    );
                    let runningPaid = 0;
                    const total = Number(detailRow.totalAmount || 0);
                    if (!sorted.length) return null;
                    return (
                      <table className="min-w-full text-left text-xs">
                        <thead className="border-b border-line bg-panel-muted uppercase tracking-wide text-muted">
                          <tr>
                            <th className="px-2 py-2 font-medium">Date</th>
                            <th className="px-2 py-2 font-medium">Paid</th>
                            <th className="px-2 py-2 font-medium">Running paid</th>
                            <th className="px-2 py-2 font-medium">Remaining</th>
                            <th className="px-2 py-2 font-medium">Invoice</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {sorted.map((p) => {
                            const amount = Number(p.amount || 0);
                            runningPaid += Number.isFinite(amount) ? amount : 0;
                            const remaining = Math.max(total - runningPaid, 0);
                            return (
                              <tr key={p.id}>
                                <td className="px-2 py-2 text-muted">
                                  {formatDisplayDate(p.paidAt)}
                                </td>
                                <td className="px-2 py-2 tabular-nums">{amount.toFixed(2)}</td>
                                <td className="px-2 py-2 tabular-nums">{runningPaid.toFixed(2)}</td>
                                <td className="px-2 py-2 tabular-nums">{remaining.toFixed(2)}</td>
                                <td className="px-2 py-2">
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line text-ink transition hover:bg-panel-muted"
                                      title="Edit payment"
                                      onClick={() => {
                                        setEditingPaymentId(p.id);
                                        setPaymentOpen(true);
                                        setPaymentAmount(amount.toFixed(2));
                                        setPaymentMethod(p.method ?? "");
                                        setPaymentNote(p.note ?? "");
                                        setPaymentDate(p.paidAt.slice(0, 10));
                                        setPaymentBillStatus(detailRow.billStatus ?? (detailRow.billReceived ? "yes" : "no"));
                                        setPaymentInvoiceFile(null);
                                        setPaymentUiError("");
                                      }}
                                    >
                                      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
                                        <path
                                          fill="currentColor"
                                          d="M14.69 2.86a2 2 0 0 1 2.83 2.83l-8.4 8.4a1 1 0 0 1-.46.26l-3.2.8a1 1 0 0 1-1.21-1.21l.8-3.2a1 1 0 0 1 .26-.46l8.4-8.4ZM13.28 4.27 6.16 11.39l-.42 1.66 1.66-.42 7.12-7.12-1.24-1.24Z"
                                        />
                                      </svg>
                                    </button>
                                    {detailRow.invoice?.fileUrl ? (
                                      <a
                                        href={detailRow.invoice.fileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line text-ink transition hover:bg-panel-muted"
                                        title="Download invoice"
                                      >
                                        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
                                          <path
                                            fill="currentColor"
                                            d="M10 2a1 1 0 0 1 1 1v7.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.42L9 10.59V3a1 1 0 0 1 1-1Zm-6 13a1 1 0 0 1 1 1v1h10v-1a1 1 0 1 1 2 0v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1a1 1 0 0 1 1-1Z"
                                          />
                                        </svg>
                                      </a>
                                    ) : (
                                      <span className="text-muted">—</span>
                                    )}
                                    <button
                                      type="button"
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line text-ink transition hover:bg-panel-muted"
                                      title="Upload invoice"
                                      disabled={uploadPaymentInvoiceMutation.isPending}
                                      onClick={() => {
                                        setPaymentInvoiceRequirementId(detailRow.id);
                                        paymentInvoiceInputRef.current?.click();
                                      }}
                                    >
                                      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
                                        <path
                                          fill="currentColor"
                                          d="M10 3a1 1 0 0 1 1 1v6h2.59l-3.3 3.3a.4.4 0 0 1-.58 0L6.41 10H9V4a1 1 0 0 1 1-1Zm-6 12a1 1 0 0 1 1 1v1h10v-1a1 1 0 1 1 2 0v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1a1 1 0 0 1 1-1Z"
                                        />
                                      </svg>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    );
                  })()}
                  {!detailRow.payments?.length ? (
                    <p className="text-sm text-muted">No payment history yet.</p>
                  ) : null}
                  {invoiceUiError ? <p className="mt-2 text-sm text-red-600">{invoiceUiError}</p> : null}
                </div>
              </div>
              {canManageFlags ? (
                <div className="rounded-xl border border-line p-3">
                  <p className="text-xs uppercase tracking-wide text-muted">Flag</p>
                  <div className="mt-2 flex items-center gap-2">
                    {detailRow.isFlagged ? (
                      <span className="rounded-full bg-negative/20 px-2 py-1 text-xs font-medium text-negative">
                        Highlighted
                      </span>
                    ) : (
                      <span className="text-sm text-muted">Not highlighted</span>
                    )}
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => flagMutation.mutate({ id: detailRow.id, flagged: !detailRow.isFlagged })}
                    >
                      {detailRow.isFlagged ? "Remove highlight" : "Highlight"}
                    </button>
                  </div>
                </div>
              ) : null}
              {canDeleteTransaction ? (
                <div className="rounded-xl border border-red-200/80 bg-red-50/60 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-red-800">Delete transaction</p>
                  {!deleteConfirmOpen ? (
                    <button
                      type="button"
                      className="btn-secondary mt-2 border-red-300 text-red-900 hover:bg-red-100/80"
                      onClick={() => {
                        setDeleteConfirmOpen(true);
                        setDeleteUiError("");
                      }}
                    >
                      Delete this transaction
                    </button>
                  ) : (
                    <div className="mt-2 space-y-2">
                      <p className="text-sm text-red-950/90">
                        This permanently removes the expense, all payments, and the invoice record. This cannot be undone.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={deleteTransactionMutation.isPending}
                          onClick={() => setDeleteConfirmOpen(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-red-700 bg-red-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-800 disabled:opacity-60"
                          disabled={deleteTransactionMutation.isPending}
                          onClick={() => deleteTransactionMutation.mutate(detailRow.id)}
                        >
                          {deleteTransactionMutation.isPending ? "Deleting…" : "Delete permanently"}
                        </button>
                      </div>
                    </div>
                  )}
                  {deleteUiError ? <p className="mt-2 text-sm text-red-700">{deleteUiError}</p> : null}
                </div>
              ) : null}
              {user?.role !== "MEMBER" ? (
                <div className="rounded-xl border border-line p-3">
                  <p className="text-xs uppercase tracking-wide text-muted">Update logs</p>
                  <div className="mt-2 space-y-4">
                    {(detailRow.updateLogs ?? []).map((log, logIndex) => {
                      const logs = detailRow.updateLogs ?? [];
                      const pd = log.previousData as Record<string, unknown>;
                      const rows = buildLogTableRows(log, logIndex, logs, detailRow, updateLogNameMapsForDetail);
                      return (
                        <div key={log.id} className="rounded-lg border border-line bg-panel-muted p-3">
                          <p className="text-xs font-medium text-[#2A2A2A]">
                            {formatDisplayDateTime(log.createdAt)}
                            <span className="font-normal text-muted">
                              {" "}
                              · {log.changedBy.name} · {logEventLabel(pd)}
                            </span>
                          </p>
                          <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-white">
                            <table className="min-w-full text-left text-xs">
                              <thead>
                                <tr className="border-b border-line bg-[#FBF9F5] uppercase tracking-wide text-[#7E7569]">
                                  <th className="px-3 py-2 font-medium">Field</th>
                                  <th className="px-3 py-2 font-medium">Previous</th>
                                  <th className="px-3 py-2 font-medium">Current</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#EEE7DD]">
                                {rows.map((r, ri) => (
                                  <tr key={`${log.id}-${ri}`}>
                                    <td className="whitespace-nowrap px-3 py-2 font-medium text-[#2A2A2A]">
                                      {r.field}
                                    </td>
                                    <td className="max-w-[min(40vw,12rem)] break-words px-3 py-2 text-[#6B6258]">
                                      {r.previous}
                                    </td>
                                    <td className="max-w-[min(40vw,12rem)] break-words px-3 py-2 text-[#2A2A2A]">
                                      {r.current}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                    {!detailRow.updateLogs?.length ? <p className="text-sm text-muted">No update logs yet.</p> : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {paymentOpen && detailRow ? (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-ink/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setPaymentOpen(false);
              setEditingPaymentId(null);
            }
          }}
        >
          <div className="surface w-full max-w-lg p-4">
            <h4 className="text-base font-semibold">Record payment</h4>
            <p className="mt-1 text-xs text-muted">{detailRow.itemName}</p>
            <div className="mt-3 grid gap-3">
              <label className="label block">
                Amount
                <input
                  className="input-base mt-1 w-full"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </label>
              <label className="label block">
                Date
                <input
                  className="input-base mt-1 w-full"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </label>
              <label className="label block">
                Method
                <input
                  className="input-base mt-1 w-full"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                />
              </label>
              <label className="label block">
                Bill status
                <select
                  className="input-base mt-1 w-full"
                  value={paymentBillStatus}
                  onChange={(e) => setPaymentBillStatus(e.target.value as "yes" | "no")}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </label>
              {paymentBillStatus === "yes" ? (
              <label className="label block">
                Invoice upload (optional)
                <input
                  className="input-base mt-1 w-full"
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setPaymentInvoiceFile(e.target.files?.[0] ?? null)}
                />
              </label>
              ) : null}
              <label className="label block">
                Note
                <textarea className="input-base mt-1 w-full" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} />
              </label>
            </div>
            {paymentUiError ? <p className="mt-2 text-sm text-red-600">{paymentUiError}</p> : null}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setPaymentOpen(false);
                  setEditingPaymentId(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={addPaymentMutation.isPending}
                onClick={() => {
                  const amount = Number(paymentAmount);
                  if (!Number.isFinite(amount) || amount <= 0) {
                    setPaymentUiError("Enter a valid amount greater than 0.");
                    return;
                  }
                  setPaymentUiError("");
                  const payload = {
                    requirementId: detailRow.id,
                    amount,
                    method: paymentMethod,
                    note: paymentNote,
                    paidAt: paymentDate ? new Date(paymentDate).toISOString() : undefined,
                  };
                  if (editingPaymentId) {
                    api
                      .patch<RequirementRow>(`/requirements/payments/${editingPaymentId}`, {
                        amount: payload.amount,
                        method: payload.method || undefined,
                        note: payload.note || undefined,
                        paidAt: payload.paidAt,
                      })
                      .then(async (updated) => {
                        await api.patch<RequirementRow>(`/requirements/${detailRow.id}`, {
                          billStatus: paymentBillStatus,
                        });
                        setDetailRow(updated);
                        setPaymentOpen(false);
                        setEditingPaymentId(null);
                        setPaymentAmount("");
                        setPaymentMethod("");
                        setPaymentNote("");
                        setPaymentDate(new Date().toISOString().slice(0, 10));
                        setPaymentBillStatus("no");
                        setPaymentInvoiceFile(null);
                        await Promise.all([
                          qc.invalidateQueries({ queryKey: ["requirements"] }),
                          qc.invalidateQueries({ queryKey: ["dashboard"] }),
                        ]);
                      })
                      .catch((err) => {
                        setPaymentUiError(err instanceof Error ? err.message : "Could not update payment.");
                      });
                    return;
                  }
                  addPaymentMutation.mutate(
                    {
                      requirementId: payload.requirementId,
                      amount: payload.amount,
                      method: payload.method,
                      note: payload.note,
                      paidAt: payload.paidAt,
                    },
                    {
                      onSuccess: async (updated) => {
                        await api.patch<RequirementRow>(`/requirements/${updated.id}`, {
                          billStatus: paymentBillStatus,
                        });
                        if (paymentBillStatus === "yes" && paymentInvoiceFile) {
                          const form = new FormData();
                          form.append("file", paymentInvoiceFile);
                          const withInvoice = await api.postMultipart<RequirementRow>(
                            `/requirements/${updated.id}/invoice`,
                            form,
                          );
                          setDetailRow(withInvoice);
                          await Promise.all([
                            qc.invalidateQueries({ queryKey: ["requirements"] }),
                            qc.invalidateQueries({ queryKey: ["dashboard"] }),
                          ]);
                        }
                      },
                    },
                  );
                }}
              >
                {addPaymentMutation.isPending ? "Saving..." : editingPaymentId ? "Update payment" : "Save payment"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {createOpen ? (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-ink/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCreateOpen(false);
          }}
        >
          <div className="surface w-full max-w-2xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-base font-semibold">Add expense</h4>
              <CloseIconButton onClick={() => setCreateOpen(false)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="label block">
                Brand/Person
                <AppSelect
                  value={vendorIdDraft}
                  onChange={setVendorIdDraft}
                  options={[
                    { value: "", label: "Select Brand/Person" },
                    ...(vendorsQ.data ?? []).map((v) => ({ value: v.id, label: v.name })),
                  ]}
                />
              </label>
              <label className="label block">
                Site
                <AppSelect
                  value={siteIdDraft}
                  onChange={setSiteIdDraft}
                  options={[
                    { value: "", label: "Select site" },
                    ...(sitesQ.data ?? []).map((s) => ({ value: s.id, label: s.name })),
                  ]}
                />
              </label>
              <label className="label block sm:col-span-2">
                Item name
                <input
                  className="input-base mt-1 w-full"
                  value={itemNameDraft}
                  onChange={(e) => setItemNameDraft(e.target.value)}
                />
              </label>
              <label className="label block">
                Details
                <input className="input-base mt-1 w-full" value={brandDraft} onChange={(e) => setBrandDraft(e.target.value)} />
              </label>
              <label className="label block">
                Bill status
                <select
                  className="input-base mt-1 w-full"
                  value={billStatusDraft}
                  onChange={(e) => setBillStatusDraft(e.target.value as "yes" | "no")}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </label>
              <label className="label block">
                Quantity
                <input className="input-base mt-1 w-full" value={qtyDraft} onChange={(e) => setQtyDraft(e.target.value)} />
              </label>
              <label className="label block">
                Total amount
                <input className="input-base mt-1 w-full" value={totalDraft} onChange={(e) => setTotalDraft(e.target.value)} />
              </label>
              <label className="label block">
                Entry date
                <input
                  type="date"
                  className="input-base mt-1 w-full"
                  value={entryDateDraft}
                  onChange={(e) => setEntryDateDraft(e.target.value)}
                />
              </label>
              <label className="label block">
                Initial payment (optional)
                <input
                  className="input-base mt-1 w-full"
                  value={payAmountDraft}
                  onChange={(e) => setPayAmountDraft(e.target.value)}
                />
              </label>
              {billStatusDraft === "yes" ? (
                <label className="label block">
                  Invoice file (optional)
                  <input ref={invoiceInputRef} type="file" accept="application/pdf,image/*" className="input-base mt-1 w-full" />
                </label>
              ) : null}
            </div>
            {createStatus ? <p className="mt-3 text-sm text-[#7C7266]">{createStatus}</p> : null}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={
                  createMutation.isPending ||
                  !vendorIdDraft ||
                  !siteIdDraft ||
                  !itemNameDraft.trim() ||
                  !totalDraft
                }
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? "Saving..." : "Save expense"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}
