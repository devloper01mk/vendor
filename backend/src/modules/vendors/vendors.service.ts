import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { existsSync, readdirSync, rmSync } from "fs";
import { join } from "path";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../common/decorators/current-user.decorator";
import { CreateVendorDto } from "./dto/create-vendor.dto";
import { UpdateVendorDto } from "./dto/update-vendor.dto";

const INTERNAL_MEMBER_ALLOCATION_ITEM = "Member Fund Allocation";
const INTERNAL_MEMBER_ALLOCATION_VENDOR = "General Vendor";

@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

  private baseUrl() {
    return process.env.PUBLIC_BASE_URL ?? "http://localhost:4000";
  }

  private vendorImageDir() {
    return join(process.cwd(), "storage", "public", "vendors");
  }

  private resolveVendorImage(vendorId: string): string | null {
    const dir = this.vendorImageDir();
    if (!existsSync(dir)) return null;
    const files = readdirSync(dir).filter((name) => name.startsWith(`${vendorId}-`));
    if (!files.length) return null;
    const latest = files.sort().at(-1);
    if (!latest) return null;
    return `${this.baseUrl()}/uploads/vendors/${latest}`;
  }

  async listWithBalances(
    user: RequestUser,
    from?: string,
    to?: string,
    memberId?: string,
    search?: string,
  ) {
    const effectiveMemberId =
      user.role === "MEMBER" ? user.sub : memberId?.trim() ? memberId.trim() : undefined;
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
      ...(effectiveMemberId ? { createdById: effectiveMemberId } : {}),
    };

    const vendors = await this.prisma.vendor.findMany({
      where: {
        name: { not: INTERNAL_MEMBER_ALLOCATION_VENDOR },
        ...(search?.trim()
          ? {
              OR: [
                { name: { contains: search.trim(), mode: "insensitive" } },
                { gstNumber: { contains: search.trim(), mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
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
        imageUrl: this.resolveVendorImage(v.id),
        totals: {
          committed: totalCommitted.toString(),
          paid: totalPaid.toString(),
          pending: pending.toString(),
        },
      };
    });
  }

  async create(dto: CreateVendorDto) {
    const vendor = await this.prisma.vendor.create({ data: dto });
    return {
      ...vendor,
      imageUrl: this.resolveVendorImage(vendor.id),
    };
  }

  async update(id: string, dto: UpdateVendorDto) {
    try {
      const vendor = await this.prisma.vendor.update({ where: { id }, data: dto });
      return {
        ...vendor,
        imageUrl: this.resolveVendorImage(vendor.id),
      };
    } catch {
      throw new NotFoundException("Vendor not found");
    }
  }

  async attachImage(id: string, filename: string) {
    const existing = await this.prisma.vendor.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException("Vendor not found");

    const dir = this.vendorImageDir();
    if (existsSync(dir)) {
      const stale = readdirSync(dir).filter((name) => name.startsWith(`${id}-`) && name !== filename);
      for (const name of stale) {
        rmSync(join(dir, name), { force: true });
      }
    }

    return {
      id,
      imageUrl: `${this.baseUrl()}/uploads/vendors/${filename}`,
    };
  }

  async remove(id: string) {
    try {
      await this.prisma.vendor.delete({ where: { id } });
    } catch {
      throw new NotFoundException("Vendor not found");
    }
    const dir = this.vendorImageDir();
    if (existsSync(dir)) {
      const stale = readdirSync(dir).filter((name) => name.startsWith(`${id}-`));
      for (const name of stale) {
        rmSync(join(dir, name), { force: true });
      }
    }
    return { ok: true };
  }
}
