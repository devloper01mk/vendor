/** Shared aggregation helpers for Site ↔ Vendor drill-down. */

export type RequirementMoneyRow = {
  id: string;
  totalAmount: string;
  paidTotal: string;
  remaining: string;
  vendor: { id: string; name: string };
  site: { id: string; name: string };
};

export type PartnerAmount = {
  id: string;
  name: string;
  paid: number;
  pending: number;
  total: number;
  transactions: number;
};

export type MoneyTotals = {
  paid: number;
  pending: number;
  total: number;
  transactions: number;
};

function num(v: string | number | null | undefined) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function sumMoney(items: RequirementMoneyRow[]): MoneyTotals {
  return items.reduce(
    (acc, row) => {
      acc.paid += num(row.paidTotal);
      acc.pending += num(row.remaining);
      acc.total += num(row.totalAmount);
      acc.transactions += 1;
      return acc;
    },
    { paid: 0, pending: 0, total: 0, transactions: 0 },
  );
}

export function aggregateByVendor(items: RequirementMoneyRow[]): PartnerAmount[] {
  const map = new Map<string, PartnerAmount>();
  for (const row of items) {
    const id = row.vendor?.id;
    if (!id) continue;
    const prev = map.get(id) ?? {
      id,
      name: row.vendor.name,
      paid: 0,
      pending: 0,
      total: 0,
      transactions: 0,
    };
    prev.paid += num(row.paidTotal);
    prev.pending += num(row.remaining);
    prev.total += num(row.totalAmount);
    prev.transactions += 1;
    map.set(id, prev);
  }
  return Array.from(map.values()).sort((a, b) => b.pending - a.pending || b.paid - a.paid);
}

export function aggregateBySite(items: RequirementMoneyRow[]): PartnerAmount[] {
  const map = new Map<string, PartnerAmount>();
  for (const row of items) {
    const id = row.site?.id;
    if (!id) continue;
    const prev = map.get(id) ?? {
      id,
      name: row.site.name,
      paid: 0,
      pending: 0,
      total: 0,
      transactions: 0,
    };
    prev.paid += num(row.paidTotal);
    prev.pending += num(row.remaining);
    prev.total += num(row.totalAmount);
    prev.transactions += 1;
    map.set(id, prev);
  }
  return Array.from(map.values()).sort((a, b) => b.pending - a.pending || b.paid - a.paid);
}
