import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { existsSync, readdirSync, rmSync } from "fs";
import { join } from "path";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateSiteDto } from "./dto/create-site.dto";
import { UpdateSiteDto } from "./dto/update-site.dto";

const INTERNAL_MEMBER_ALLOCATION_SITE = "General Site";

@Injectable()
export class SitesService {
  constructor(private readonly prisma: PrismaService) {}

  private baseUrl() {
    return process.env.PUBLIC_BASE_URL ?? "http://localhost:4000";
  }

  private siteImageDir() {
    return join(process.cwd(), "storage", "public", "sites");
  }

  private resolveSiteImage(siteId: string): string | null {
    const dir = this.siteImageDir();
    if (!existsSync(dir)) return null;
    const files = readdirSync(dir).filter((name) => name.startsWith(`${siteId}-`));
    if (!files.length) return null;
    const latest = files.sort().at(-1);
    if (!latest) return null;
    return `${this.baseUrl()}/uploads/sites/${latest}`;
  }

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
        imageUrl: this.resolveSiteImage(site.id),
        metrics: {
          totalSpent: totalSpent.toString(),
          transactions: txCount,
          status: txCount > 0 ? "ACTIVE" : "INACTIVE",
        },
      };
    });
  }

  async create(dto: CreateSiteDto) {
    const site = await this.prisma.site.create({ data: dto });
    return {
      ...site,
      imageUrl: this.resolveSiteImage(site.id),
    };
  }

  async update(id: string, dto: UpdateSiteDto) {
    try {
      const site = await this.prisma.site.update({ where: { id }, data: dto });
      return {
        ...site,
        imageUrl: this.resolveSiteImage(site.id),
      };
    } catch {
      throw new NotFoundException("Site not found");
    }
  }

  async attachImage(id: string, filename: string) {
    const existing = await this.prisma.site.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException("Site not found");

    const dir = this.siteImageDir();
    if (existsSync(dir)) {
      const stale = readdirSync(dir).filter((name) => name.startsWith(`${id}-`) && name !== filename);
      for (const name of stale) {
        rmSync(join(dir, name), { force: true });
      }
    }

    return {
      id,
      imageUrl: `${this.baseUrl()}/uploads/sites/${filename}`,
    };
  }

  async remove(id: string) {
    try {
      await this.prisma.site.delete({ where: { id } });
    } catch {
      throw new NotFoundException("Site not found");
    }
    const dir = this.siteImageDir();
    if (existsSync(dir)) {
      const stale = readdirSync(dir).filter((name) => name.startsWith(`${id}-`));
      for (const name of stale) {
        rmSync(join(dir, name), { force: true });
      }
    }
    return { ok: true };
  }
}
