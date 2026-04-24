/** Mirrors API shapes for requirements / expenses. */

export type RequirementRow = {
  id: string;
  itemName: string;
  brand: string | null;
  quantity: string;
  totalAmount: string;
  status: string;
  billReceived: boolean;
  entryDate: string;
  notes?: string | null;
  paidTotal: string;
  remaining: string;
  vendor: { id: string; name: string };
  site: { id: string; name: string };
  createdBy: { id: string; name: string; email: string };
  isFlagged?: boolean;
  flagReason?: string | null;
  flaggedAt?: string | null;
  flaggedBy?: { id: string; name: string; email: string } | null;
  payments: {
    id: string;
    amount: string;
    paidAt: string;
    recordedBy: { id: string; name: string };
  }[];
  invoice: {
    id: string;
    fileUrl: string;
    originalName: string;
  } | null;
  updateLogs?: {
    id: string;
    previousData: Record<string, unknown>;
    changedBy: { id: string; name: string; email: string };
    createdAt: string;
  }[];
};

export type DashboardSummary = {
  totals: { committed: string; paid: string; pending: string };
  userFunding?: { paidToUsers: string };
  vendorPending: { vendorId: string; name: string; pending: string }[];
  siteSpend: { siteId: string; name: string; paid: string }[];
  monthly: { month: string; paid: string; committed: string }[];
  alerts: { type: string; requirementId: string; message: string }[];
};

export type VendorRow = {
  id: string;
  name: string;
  gstNumber: string | null;
  totals: { committed: string; paid: string; pending: string };
};
