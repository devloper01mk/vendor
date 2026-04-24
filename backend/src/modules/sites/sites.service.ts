import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateSiteDto } from "./dto/create-site.dto";
import { UpdateSiteDto } from "./dto/update-site.dto";

const INTERNAL_MEMBER_ALLOCATION_SITE = "General Site";

@Injectable()
export class SitesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.site.findMany({
      where: { name: { not: INTERNAL_MEMBER_ALLOCATION_SITE } },
      orderBy: { name: "asc" },
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
