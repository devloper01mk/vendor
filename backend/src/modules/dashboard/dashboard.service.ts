import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../common/decorators/current-user.decorator";

const INTERNAL_MEMBER_ALLOCATION_ITEM = "Member Fund Allocation";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(user: RequestUser, from?: string, to?: string) {
    const dateFilter: Prisma.RequirementWhereInput =
      from || to
        ? {
            entryDate: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
            itemName: { not: INTERNAL_MEMBER_ALLOCATION_ITEM },
          }
        : { itemName: { not: INTERNAL_MEMBER_ALLOCATION_ITEM } };

    if (user.role === "MEMBER") {
      dateFilter.createdById = user.sub;
    }

    const requirements = await this.prisma.requirement.findMany({
      where: dateFilter,
      select: {
        id: true,
        itemName: true,
        totalAmount: true,
        billReceived: true,
        isFlagged: true,
        status: true,
        entryDate: true,
        vendor: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
        payments: { select: { amount: true } },
        invoice: { select: { id: true } },
      },
    });

    let totalCommitted = new Prisma.Decimal(0);
    let totalPaid = new Prisma.Decimal(0);
    const vendorPending = new Map<string, { name: string; pending: Prisma.Decimal }>();
    const siteSpend = new Map<string, { name: string; paid: Prisma.Decimal }>();
    const monthly = new Map<string, { paid: Prisma.Decimal; committed: Prisma.Decimal }>();

    const alerts: {
      type: "pending_payment" | "missing_invoice";
      requirementId: string;
      message: string;
    }[] = [];

    for (const r of requirements) {
      totalCommitted = totalCommitted.add(r.totalAmount);
      let paid = new Prisma.Decimal(0);
      for (const p of r.payments) paid = paid.add(p.amount);
      totalPaid = totalPaid.add(paid);
      const pending = r.totalAmount.sub(paid);

      const vKey = r.vendor.id;
      const vPrev = vendorPending.get(vKey) ?? {
        name: r.vendor.name,
        pending: new Prisma.Decimal(0),
      };
      vPrev.pending = vPrev.pending.add(pending);
      vendorPending.set(vKey, vPrev);

      const sKey = r.site.id;
      const sPrev = siteSpend.get(sKey) ?? {
        name: r.site.name,
        paid: new Prisma.Decimal(0),
      };
      sPrev.paid = sPrev.paid.add(paid);
      siteSpend.set(sKey, sPrev);

      const monthKey = `${r.entryDate.getFullYear()}-${String(r.entryDate.getMonth() + 1).padStart(2, "0")}`;
      const mPrev = monthly.get(monthKey) ?? {
        paid: new Prisma.Decimal(0),
        committed: new Prisma.Decimal(0),
      };
      mPrev.paid = mPrev.paid.add(paid);
      mPrev.committed = mPrev.committed.add(r.totalAmount);
      monthly.set(monthKey, mPrev);

      if (pending.gt(new Prisma.Decimal("0.01"))) {
        alerts.push({
          type: "pending_payment",
          requirementId: r.id,
          message: `${r.vendor.name}: ${pending.toString()} pending`,
        });
      }
      if (!r.billReceived && paid.gt(0)) {
        alerts.push({
          type: "missing_invoice",
          requirementId: r.id,
          message: `Payment recorded without bill flag / invoice`,
        });
      }
    }

    const totalPending = totalCommitted.sub(totalPaid);
    const allocationPaidAtFilter =
      from || to
        ? {
            paidAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {};

    const paidToUsersRows = await this.prisma.payment.findMany({
      where: {
        ...allocationPaidAtFilter,
        requirement: {
          itemName: INTERNAL_MEMBER_ALLOCATION_ITEM,
        },
      },
      select: { amount: true },
    });
    const totalPaidToUsers = paidToUsersRows.reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));
    const investorRows = await this.prisma.investorEntry.findMany({
      where:
        from || to
          ? {
              paymentReceivedDate: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : undefined,
      select: { amount: true },
    });
    const totalInvestorReceived = investorRows.reduce((sum, row) => sum.add(row.amount), new Prisma.Decimal(0));

    let receivedFromAdmin = new Prisma.Decimal(0);
    let receivedFromAdminRows: {
      id: string;
      amount: string;
      paidAt: Date;
      method: string | null;
    }[] = [];
    if (user.role === "MEMBER") {
      const allocationRows = await this.prisma.payment.findMany({
        where: {
          ...allocationPaidAtFilter,
          requirement: {
            createdById: user.sub,
            itemName: INTERNAL_MEMBER_ALLOCATION_ITEM,
          },
        },
        orderBy: { paidAt: "desc" },
        select: { id: true, amount: true, paidAt: true, method: true },
      });
      receivedFromAdmin = allocationRows.reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));
      receivedFromAdminRows = allocationRows.map((row) => ({
        id: row.id,
        amount: row.amount.toString(),
        paidAt: row.paidAt,
        method: row.method,
      }));
    }
    const availableBalance = receivedFromAdmin.sub(totalPaid);

    return {
      totals: {
        committed: totalCommitted.toString(),
        paid: totalPaid.toString(),
        pending: totalPending.toString(),
      },
      userFunding: {
        paidToUsers: totalPaidToUsers.toString(),
      },
      investor: {
        totalReceived: totalInvestorReceived.toString(),
      },
      memberWallet:
        user.role === "MEMBER"
          ? {
              received: receivedFromAdmin.toString(),
              spent: totalPaid.toString(),
              balance: availableBalance.toString(),
              receivedPayments: receivedFromAdminRows,
            }
          : null,
      vendorPending: [...vendorPending.entries()].map(([id, v]) => ({
        vendorId: id,
        name: v.name,
        pending: v.pending.toString(),
      })),
      siteSpend: [...siteSpend.entries()].map(([id, s]) => ({
        siteId: id,
        name: s.name,
        paid: s.paid.toString(),
      })),
      monthly: [...monthly.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, v]) => ({
          month,
          paid: v.paid.toString(),
          committed: v.committed.toString(),
        })),
      highlighted: requirements
        .filter((r) => r.isFlagged)
        .slice(0, 8)
        .map((r) => ({
          requirementId: r.id,
          itemName: r.itemName,
          vendorName: r.vendor.name,
          siteName: r.site.name,
        })),
      alerts: alerts.slice(0, 50),
      requirementsTracked: requirements.length,
    };
  }
}
