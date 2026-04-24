import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, RequirementStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AddPaymentDto } from "./dto/add-payment.dto";
import { CreateRequirementDto } from "./dto/create-requirement.dto";
import { ListRequirementsQueryDto } from "./dto/list-requirements.query.dto";
import { ToggleHighlightDto } from "./dto/toggle-highlight.dto";
import { UpdateRequirementDto } from "./dto/update-requirement.dto";
import type { RequestUser } from "../../common/decorators/current-user.decorator";

type InvoiceFileMeta = {
  filename: string;
  originalName: string;
  mimeType: string;
};

const INTERNAL_MEMBER_ALLOCATION_ITEM = "Member Fund Allocation";

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

  private mapRequirement(
    row: Prisma.RequirementGetPayload<{
      include: {
        vendor: true;
        site: true;
        createdBy: { select: { id: true; name: true; email: true } };
        flaggedBy: { select: { id: true; name: true; email: true } };
        payments: { include: { recordedBy: { select: { id: true; name: true } } } };
        invoice: true;
        updateLogs: { include: { changedBy: { select: { id: true; name: true; email: true } } } };
      };
    }>,
  ) {
    const paid = this.sumPayments(row.payments);
    const remaining = row.totalAmount.sub(paid);
    return {
      id: row.id,
      itemName: row.itemName,
      brand: row.brand,
      quantity: row.quantity.toString(),
      totalAmount: row.totalAmount.toString(),
      status: row.status,
      billReceived: row.billReceived,
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
    const where: Prisma.RequirementWhereInput = {
      itemName: { not: INTERNAL_MEMBER_ALLOCATION_ITEM },
    };

    if (query.vendorId) where.vendorId = query.vendorId;
    if (query.siteId) where.siteId = query.siteId;
    if (query.status) where.status = query.status;
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
        orderBy: { entryDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
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
        },
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
      include: {
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
      },
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
        billReceived: dto.billReceived ?? false,
        entryDate: new Date(dto.entryDate),
        notes: dto.notes,
        vendorId: dto.vendorId,
        siteId: dto.siteId,
        createdById: userId,
      },
      include: {
        vendor: true,
        site: true,
        createdBy: { select: { id: true, name: true, email: true } },
        flaggedBy: { select: { id: true, name: true, email: true } },
        payments: {
          include: { recordedBy: { select: { id: true, name: true } } },
        },
        invoice: true,
        updateLogs: {
          include: { changedBy: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
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

        const updated = await tx.requirement.update({
          where: { id },
          data: {
            itemName: dto.itemName,
            brand: dto.brand,
            quantity: dto.quantity !== undefined ? new Prisma.Decimal(dto.quantity) : undefined,
            totalAmount:
              dto.totalAmount !== undefined ? new Prisma.Decimal(dto.totalAmount) : undefined,
            status: dto.status,
            billReceived: dto.billReceived,
            entryDate: dto.entryDate !== undefined ? new Date(dto.entryDate) : undefined,
            notes: dto.notes,
            vendorId: dto.vendorId,
            siteId: dto.siteId,
          },
          include: {
            vendor: true,
            site: true,
            createdBy: { select: { id: true, name: true, email: true } },
            flaggedBy: { select: { id: true, name: true, email: true } },
            payments: {
              include: { recordedBy: { select: { id: true, name: true } } },
            },
            invoice: true,
            updateLogs: {
              include: { changedBy: { select: { id: true, name: true, email: true } } },
              orderBy: { createdAt: "desc" },
              take: 10,
            },
          },
        });

        await tx.requirementUpdateLog.create({
          data: {
            requirementId: id,
            changedById: userId,
            previousData: {
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

        return updated;
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
      include: {
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
      },
    });
    return this.mapRequirement(row);
  }

  async remove(id: string, user: RequestUser) {
    const existing = await this.prisma.requirement.findUnique({
      where: { id },
      select: { createdById: true },
    });
    if (!existing) throw new NotFoundException("Requirement not found");
    if (user.role === "MEMBER" && existing.createdById !== user.sub) {
      throw new ForbiddenException("You can only delete your own entries");
    }

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

    return this.getOne(requirementId, { sub: user.sub, role: user.role, email: user.email });
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

    return this.getOne(requirementId, { sub: userId, role: "MEMBER", email: "" });
  }
}
