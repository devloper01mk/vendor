import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, RequirementStatus, UserRole } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AddPaymentDto } from "./dto/add-payment.dto";
import { CreateRequirementDto } from "./dto/create-requirement.dto";
import {
  ListRequirementsQueryDto,
  RequirementFlowFilter,
} from "./dto/list-requirements.query.dto";
import { ToggleHighlightDto } from "./dto/toggle-highlight.dto";
import { UpdateRequirementDto } from "./dto/update-requirement.dto";
import { UpdateRequirementPaymentDto } from "./dto/update-requirement-payment.dto";
import type { RequestUser } from "../../common/decorators/current-user.decorator";

type InvoiceFileMeta = {
  filename: string;
  originalName: string;
  mimeType: string;
};

const INTERNAL_MEMBER_ALLOCATION_ITEM = "Member Fund Allocation";

/** Include graph for API responses that carry `updateLogs` (keep in sync across list/getOne/detail). */
const REQUIREMENT_DETAIL_INCLUDE = Prisma.validator<Prisma.RequirementInclude>()({
  vendor: true,
  site: true,
  createdBy: { select: { id: true, name: true, email: true } },
  flaggedBy: { select: { id: true, name: true, email: true } },
  payments: {
    include: { recordedBy: { select: { id: true, name: true } } },
    orderBy: { paidAt: "desc" },
  },
  invoice: true,
  updateLogs: {
    include: { changedBy: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  },
});

type RequirementDetailRow = Prisma.RequirementGetPayload<{
  include: typeof REQUIREMENT_DETAIL_INCLUDE;
}>;

@Injectable()
export class RequirementsService {
  constructor(private readonly prisma: PrismaService) {}

  private baseUrl() {
    return process.env.PUBLIC_BASE_URL ?? "http://localhost:4000";
  }

  private sumPayments(payments: { amount: Prisma.Decimal }[]) {
    return payments.reduce(
      (a, p) => a.add(p.amount),
      new Prisma.Decimal(0),
    );
  }

  private mapRequirement(row: RequirementDetailRow) {
    const paid = this.sumPayments(row.payments);
    const remaining = row.totalAmount.sub(paid);
    const isInternalAllocation = row.itemName === INTERNAL_MEMBER_ALLOCATION_ITEM;
    const uiType = isInternalAllocation
      ? "RECEIVED"
      : remaining.gt(new Prisma.Decimal("0.01"))
        ? "PENDING"
        : "SENT";
    return {
      id: row.id,
      itemName: row.itemName,
      brand: row.brand,
      details: row.brand,
      brandPersonName: row.vendor.name,
      quantity: row.quantity.toString(),
      totalAmount: row.totalAmount.toString(),
      status: row.status,
      billReceived: row.billReceived,
      billStatus: row.billReceived ? "yes" : "no",
      entryDate: row.entryDate,
      notes: row.notes,
      isFlagged: row.isFlagged,
      flagReason: row.flagReason,
      flaggedAt: row.flaggedAt,
      flaggedBy: row.flaggedBy,
      vendor: row.vendor,
      site: row.site,
      createdBy: row.createdBy,
      paidTotal: paid.toString(),
      remaining: remaining.toString(),
      isFullyPaid: remaining.lte(new Prisma.Decimal(0)),
      uiType,
      payments: row.payments.map((p) => ({
        id: p.id,
        amount: p.amount.toString(),
        paidAt: p.paidAt,
        method: p.method,
        note: p.note,
        recordedBy: p.recordedBy,
        createdAt: p.createdAt,
      })),
      invoice: row.invoice
        ? {
            id: row.invoice.id,
            fileUrl: row.invoice.fileUrl,
            fileKey: row.invoice.fileKey,
            mimeType: row.invoice.mimeType,
            originalName: row.invoice.originalName,
            gstDetails: row.invoice.gstDetails,
            createdAt: row.invoice.createdAt,
          }
        : null,
      updateLogs: row.updateLogs.map((log) => ({
        id: log.id,
        previousData: log.previousData,
        changedBy: log.changedBy,
        createdAt: log.createdAt,
      })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async list(user: RequestUser, query: ListRequirementsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const flow = query.flow ?? RequirementFlowFilter.ALL;
    const where: Prisma.RequirementWhereInput = {};
    if (flow === RequirementFlowFilter.RECEIVED) {
      where.itemName = INTERNAL_MEMBER_ALLOCATION_ITEM;
    } else {
      where.itemName = { not: INTERNAL_MEMBER_ALLOCATION_ITEM };
    }

    if (query.vendorId) where.vendorId = query.vendorId;
    if (query.siteId) where.siteId = query.siteId;
    if (query.status) where.status = query.status;
    if (flow === RequirementFlowFilter.PENDING) {
      where.status = RequirementStatus.PENDING;
    } else if (flow === RequirementFlowFilter.SENT) {
      where.status = RequirementStatus.COMPLETED;
    }
    if (query.from || query.to) {
      where.entryDate = {};
      if (query.from) where.entryDate.gte = new Date(query.from);
      if (query.to) where.entryDate.lte = new Date(query.to);
    }
    if (query.search) {
      where.OR = [
        { itemName: { contains: query.search, mode: "insensitive" } },
        { brand: { contains: query.search, mode: "insensitive" } },
      ];
    }

    if (user.role === "MEMBER") {
      where.createdById = user.sub;
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.requirement.count({ where }),
      this.prisma.requirement.findMany({
        where,
        orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: REQUIREMENT_DETAIL_INCLUDE,
      }),
    ]);

    return {
      items: rows.map((r) => this.mapRequirement(r)),
      total,
      page,
      limit,
      hasMore: page * limit < total,
    };
  }

  async getOne(id: string, user: RequestUser) {
    const row = await this.prisma.requirement.findUnique({
      where: { id },
      include: REQUIREMENT_DETAIL_INCLUDE,
    });
    if (!row) throw new NotFoundException("Requirement not found");
    if (user.role === "MEMBER" && row.createdBy.id !== user.sub) {
      throw new ForbiddenException("You can only access your own entries");
    }
    return this.mapRequirement(row);
  }

  async create(userId: string, dto: CreateRequirementDto) {
    const row = await this.prisma.requirement.create({
      data: {
        itemName: dto.itemName,
        brand: dto.brand,
        quantity: new Prisma.Decimal(dto.quantity),
        totalAmount: new Prisma.Decimal(dto.totalAmount),
        status: dto.status ?? RequirementStatus.PENDING,
        billReceived:
          dto.billStatus !== undefined ? dto.billStatus === "yes" : (dto.billReceived ?? false),
        entryDate: new Date(dto.entryDate),
        notes: dto.notes,
        vendorId: dto.vendorId,
        siteId: dto.siteId,
        createdById: userId,
      },
      include: REQUIREMENT_DETAIL_INCLUDE,
    });
    return this.mapRequirement(row);
  }

  async update(id: string, userId: string, dto: UpdateRequirementDto) {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const previous = await tx.requirement.findUnique({
          where: { id },
        });
        if (!previous) throw new NotFoundException("Requirement not found");
        if (previous.createdById !== userId) {
          throw new ForbiddenException("You can only update your own entries");
        }

        await tx.requirement.update({
          where: { id },
          data: {
            itemName: dto.itemName,
            brand: dto.brand,
            quantity: dto.quantity !== undefined ? new Prisma.Decimal(dto.quantity) : undefined,
            totalAmount:
              dto.totalAmount !== undefined ? new Prisma.Decimal(dto.totalAmount) : undefined,
            status: dto.status,
            billReceived:
              dto.billStatus !== undefined ? dto.billStatus === "yes" : dto.billReceived,
            entryDate: dto.entryDate !== undefined ? new Date(dto.entryDate) : undefined,
            notes: dto.notes,
            vendorId: dto.vendorId,
            siteId: dto.siteId,
          },
        });

        await tx.requirementUpdateLog.create({
          data: {
            requirementId: id,
            changedById: userId,
            previousData: {
              action: "REQUIREMENT_EDIT",
              itemName: previous.itemName,
              brand: previous.brand,
              quantity: previous.quantity.toString(),
              totalAmount: previous.totalAmount.toString(),
              status: previous.status,
              billReceived: previous.billReceived,
              entryDate: previous.entryDate.toISOString(),
              notes: previous.notes,
              vendorId: previous.vendorId,
              siteId: previous.siteId,
            },
          },
        });

        const fresh = await tx.requirement.findUnique({
          where: { id },
          include: REQUIREMENT_DETAIL_INCLUDE,
        });
        if (!fresh) throw new NotFoundException("Requirement not found");
        return fresh;
      });
      return this.mapRequirement(row);
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new NotFoundException("Requirement not found");
    }
  }

  async toggleHighlight(id: string, user: RequestUser, dto: ToggleHighlightDto) {
    const existing = await this.prisma.requirement.findUnique({
      where: { id },
      select: { id: true, createdById: true },
    });
    if (!existing) throw new NotFoundException("Requirement not found");
    if (user.role === "MEMBER" && existing.createdById !== user.sub) {
      throw new ForbiddenException("You can only highlight your own entries");
    }

    const row = await this.prisma.requirement.update({
      where: { id },
      data: dto.flagged
        ? {
            isFlagged: true,
            flagReason: dto.reason ?? "Needs review",
            flaggedAt: new Date(),
            flaggedById: user.sub,
          }
        : {
            isFlagged: false,
            flagReason: null,
            flaggedAt: null,
            flaggedById: null,
          },
      include: REQUIREMENT_DETAIL_INCLUDE,
    });
    return this.mapRequirement(row);
  }

  async remove(id: string, user: RequestUser) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Only administrators can delete transactions");
    }
    const existing = await this.prisma.requirement.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("Requirement not found");

    try {
      await this.prisma.requirement.delete({ where: { id } });
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new NotFoundException("Requirement not found");
    }
    return { ok: true };
  }

  async addPayment(requirementId: string, user: RequestUser, dto: AddPaymentDto) {
    const req = await this.prisma.requirement.findUnique({
      where: { id: requirementId },
      include: { payments: true },
    });
    if (!req) throw new NotFoundException("Requirement not found");
    if (user.role === "MEMBER" && req.createdById !== user.sub) {
      throw new ForbiddenException("You can only add payments to your own entries");
    }

    const paid = this.sumPayments(req.payments);
    const amount = new Prisma.Decimal(dto.amount);
    const next = paid.add(amount);

    await this.prisma.payment.create({
      data: {
        requirementId,
        recordedById: user.sub,
        amount,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
        method: dto.method,
        note: dto.note,
      },
    });

    const updatedPaid = next;
    const isComplete =
      updatedPaid.sub(req.totalAmount).abs().lte(new Prisma.Decimal("0.01")) ||
      updatedPaid.gte(req.totalAmount);

    if (isComplete && req.status !== RequirementStatus.COMPLETED) {
      await this.prisma.requirement.update({
        where: { id: requirementId },
        data: { status: RequirementStatus.COMPLETED },
      });
    }

    await this.prisma.requirementUpdateLog.create({
      data: {
        requirementId,
        changedById: user.sub,
        previousData: {
          action: "PAYMENT_ADDED",
          amount: dto.amount,
          method: dto.method ?? null,
          note: dto.note ?? null,
          paidAt: (dto.paidAt ? new Date(dto.paidAt) : new Date()).toISOString(),
          requirementStatusBefore: req.status,
          paidTotalBefore: paid.toString(),
        },
      },
    });

    return this.getOne(requirementId, user);
  }

  async updatePayment(paymentId: string, user: RequestUser, dto: UpdateRequirementPaymentDto) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        requirement: true,
      },
    });
    if (!payment) throw new NotFoundException("Payment not found");

    if (user.role === "MEMBER" && payment.requirement.createdById !== user.sub) {
      throw new ForbiddenException("You can only update payments for your own entries");
    }

    const paymentBefore = {
      amount: payment.amount.toString(),
      paidAt: payment.paidAt.toISOString(),
      method: payment.method,
      note: payment.note,
    };

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        amount: new Prisma.Decimal(dto.amount),
        paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
        method: dto.method !== undefined ? dto.method : undefined,
        note: dto.note !== undefined ? dto.note : undefined,
      },
    });

    await this.prisma.requirementUpdateLog.create({
      data: {
        requirementId: payment.requirementId,
        changedById: user.sub,
        previousData: {
          action: "PAYMENT_UPDATED",
          paymentId,
          before: paymentBefore,
        },
      },
    });

    const req = await this.prisma.requirement.findUnique({
      where: { id: payment.requirementId },
      include: { payments: true },
    });
    if (req) {
      const paid = this.sumPayments(req.payments);
      const isComplete =
        paid.sub(req.totalAmount).abs().lte(new Prisma.Decimal("0.01")) ||
        paid.gte(req.totalAmount);
      await this.prisma.requirement.update({
        where: { id: req.id },
        data: { status: isComplete ? RequirementStatus.COMPLETED : RequirementStatus.PENDING },
      });
    }

    return this.getOne(payment.requirementId, { sub: user.sub, role: user.role, email: user.email });
  }

  async attachInvoice(
    requirementId: string,
    userId: string,
    file: InvoiceFileMeta,
    gstDetails?: Prisma.JsonValue,
  ) {
    const req = await this.prisma.requirement.findUnique({ where: { id: requirementId } });
    if (!req) throw new NotFoundException("Requirement not found");
    if (req.createdById !== userId) {
      throw new ForbiddenException("You can only upload invoice for your own entries");
    }

    const relative = `invoices/${file.filename}`;
    const fileUrl = `${this.baseUrl()}/uploads/${relative}`;

    const existing = await this.prisma.invoice.findUnique({
      where: { requirementId },
    });

    if (existing) {
      await this.prisma.invoice.update({
        where: { id: existing.id },
        data: {
          fileUrl,
          fileKey: relative,
          mimeType: file.mimeType,
          originalName: file.originalName,
          gstDetails: gstDetails ?? undefined,
          uploadedById: userId,
        },
      });
    } else {
      await this.prisma.invoice.create({
        data: {
          requirementId,
          uploadedById: userId,
          fileUrl,
          fileKey: relative,
          mimeType: file.mimeType,
          originalName: file.originalName,
          gstDetails: gstDetails ?? undefined,
        },
      });
    }

    await this.prisma.requirement.update({
      where: { id: requirementId },
      data: { billReceived: true },
    });

    await this.prisma.requirementUpdateLog.create({
      data: {
        requirementId,
        changedById: userId,
        previousData: {
          action: existing ? "INVOICE_REPLACED" : "INVOICE_ATTACHED",
          billReceivedBefore: req.billReceived,
          originalName: file.originalName,
        },
      },
    });

    return this.getOne(requirementId, { sub: userId, role: "MEMBER", email: "" });
  }
}
