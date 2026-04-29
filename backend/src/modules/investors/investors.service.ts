import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../common/decorators/current-user.decorator";
import { CreateInvestorEntryDto } from "./dto/create-investor-entry.dto";

@Injectable()
export class InvestorsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.investorEntry.findMany({
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      amount: row.amount.toString(),
      date: row.date.toISOString(),
      paymentReceivedDate: row.paymentReceivedDate.toISOString(),
      paymentMode: row.paymentMode,
      note: row.note,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async create(actor: RequestUser, dto: CreateInvestorEntryDto) {
    const row = await this.prisma.investorEntry.create({
      data: {
        name: dto.name.trim(),
        amount: dto.amount,
        date: new Date(dto.date),
        paymentReceivedDate: new Date(dto.paymentReceivedDate),
        paymentMode: dto.paymentMode.trim(),
        note: dto.note?.trim() || null,
        createdById: actor.sub,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
    return {
      id: row.id,
      name: row.name,
      amount: row.amount.toString(),
      date: row.date.toISOString(),
      paymentReceivedDate: row.paymentReceivedDate.toISOString(),
      paymentMode: row.paymentMode,
      note: row.note,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
