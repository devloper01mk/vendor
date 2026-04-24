import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../common/decorators/current-user.decorator";
import { CreateVendorDto } from "./dto/create-vendor.dto";
import { UpdateVendorDto } from "./dto/update-vendor.dto";

const INTERNAL_MEMBER_ALLOCATION_ITEM = "Member Fund Allocation";
const INTERNAL_MEMBER_ALLOCATION_VENDOR = "General Vendor";

@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

  async listWithBalances(user: RequestUser, from?: string, to?: string) {
    const memberRequirementFilter: Prisma.RequirementWhereInput = {
      itemName: { not: INTERNAL_MEMBER_ALLOCATION_ITEM },
      ...(from || to
        ? {
            entryDate: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
      ...(user.role === "MEMBER" ? { createdById: user.sub } : {}),
    };

    const vendors = await this.prisma.vendor.findMany({
      where: {
        name: { not: INTERNAL_MEMBER_ALLOCATION_VENDOR },
      },
      orderBy: { name: "asc" },
      include: {
        requirements: {
          where: memberRequirementFilter,
          select: {
            totalAmount: true,
            payments: { select: { amount: true } },
          },
        },
      },
    });

    return vendors.map((v) => {
      let totalCommitted = new Prisma.Decimal(0);
      let totalPaid = new Prisma.Decimal(0);
      for (const r of v.requirements) {
        totalCommitted = totalCommitted.add(r.totalAmount);
        for (const p of r.payments) {
          totalPaid = totalPaid.add(p.amount);
        }
      }
      const pending = totalCommitted.sub(totalPaid);
      const { requirements: _, ...rest } = v;
      return {
        ...rest,
        totals: {
          committed: totalCommitted.toString(),
          paid: totalPaid.toString(),
          pending: pending.toString(),
        },
      };
    });
  }

  async create(dto: CreateVendorDto) {
    return this.prisma.vendor.create({ data: dto });
  }

  async update(id: string, dto: UpdateVendorDto) {
    try {
      return await this.prisma.vendor.update({ where: { id }, data: dto });
    } catch {
      throw new NotFoundException("Vendor not found");
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.vendor.delete({ where: { id } });
    } catch {
      throw new NotFoundException("Vendor not found");
    }
    return { ok: true };
  }
}
