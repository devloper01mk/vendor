import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateSiteDto } from "./dto/create-site.dto";
import { UpdateSiteDto } from "./dto/update-site.dto";

const INTERNAL_MEMBER_ALLOCATION_SITE = "General Site";

@Injectable()
export class SitesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.site.findMany({
      where: { name: { not: INTERNAL_MEMBER_ALLOCATION_SITE } },
      orderBy: { name: "asc" },
      include: {
        requirements: {
          select: {
            id: true,
            totalAmount: true,
            payments: { select: { amount: true } },
          },
        },
      },
    });

    return rows.map((site) => {
      let totalSpent = new Prisma.Decimal(0);
      for (const req of site.requirements) {
        for (const pay of req.payments) {
          totalSpent = totalSpent.add(pay.amount);
        }
      }

      const txCount = site.requirements.length;
      return {
        id: site.id,
        name: site.name,
        code: site.code,
        address: site.address,
        metrics: {
          totalSpent: totalSpent.toString(),
          transactions: txCount,
          status: txCount > 0 ? "ACTIVE" : "INACTIVE",
        },
      };
    });
  }

  create(dto: CreateSiteDto) {
    return this.prisma.site.create({ data: dto });
  }

  async update(id: string, dto: UpdateSiteDto) {
    try {
      return await this.prisma.site.update({ where: { id }, data: dto });
    } catch {
      throw new NotFoundException("Site not found");
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.site.delete({ where: { id } });
    } catch {
      throw new NotFoundException("Site not found");
    }
    return { ok: true };
  }
}
