import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../common/decorators/current-user.decorator";
import { CreateInvestorEntryDto } from "./dto/create-investor-entry.dto";
import { UpdateInvestorEntryDto } from "./dto/update-investor-entry.dto";

@Injectable()
export class InvestorsService {
  constructor(private readonly prisma: PrismaService) {}

  private mapEntry(row: {
    id: string;
    name: string;
    amount: { toString(): string };
    date: Date;
    paymentReceivedDate: Date;
    paymentMode: string;
    note: string | null;
    createdBy: { id: string; name: string; email: string } | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
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

  async list() {
    const rows = await this.prisma.investorEntry.findMany({
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
    return rows.map((row) => this.mapEntry(row));
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
    return this.mapEntry(row);
  }

  async update(id: string, dto: UpdateInvestorEntryDto) {
    try {
      const row = await this.prisma.investorEntry.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          amount: dto.amount,
          date: dto.date ? new Date(dto.date) : undefined,
          paymentReceivedDate: dto.paymentReceivedDate ? new Date(dto.paymentReceivedDate) : undefined,
          paymentMode: dto.paymentMode?.trim(),
          note: dto.note !== undefined ? dto.note.trim() || null : undefined,
        },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });
      return this.mapEntry(row);
    } catch {
      throw new NotFoundException("Investor entry not found");
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.investorEntry.delete({ where: { id } });
      return { ok: true };
    } catch {
      throw new NotFoundException("Investor entry not found");
    }
  }
}
