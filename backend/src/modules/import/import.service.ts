import { BadRequestException, Injectable } from "@nestjs/common";
import {
  Prisma,
  RequirementStatus,
} from "@prisma/client";
import * as XLSX from "xlsx";
import { parse as parseCsv } from "csv-parse/sync";
import { PrismaService } from "../../prisma/prisma.service";
import { ImportColumnMapDto } from "./dto/import-mapping.dto";

@Injectable()
export class ImportService {
  constructor(private readonly prisma: PrismaService) {}

  async importBuffer(params: {
    buffer: Buffer;
    mime: string;
    columns: ImportColumnMapDto;
    userId: string;
  }) {
    const { buffer, mime, columns, userId } = params;
    const rows = this.parseRows(buffer, mime);
    if (!rows.length) throw new BadRequestException("Empty file");

    const header = rows[0].map((c) => String(c ?? "").trim());
    const idx = (title: string) => {
      const i = header.findIndex((h) => h.toLowerCase() === title.toLowerCase());
      if (i === -1) throw new BadRequestException(`Missing column: ${title}`);
      return i;
    };

    const col = {
      item: idx(columns.itemName),
      brand: columns.brand ? idx(columns.brand) : -1,
      site: idx(columns.siteName),
      vendor: idx(columns.vendorName),
      amount: idx(columns.totalAmount),
      status: columns.status ? idx(columns.status) : -1,
      bill: columns.billReceived ? idx(columns.billReceived) : -1,
      date: idx(columns.entryDate),
      pay: columns.paymentAmount ? idx(columns.paymentAmount) : -1,
      notes: columns.notes ? idx(columns.notes) : -1,
    };

    const created: string[] = [];
    const errors: { row: number; message: string }[] = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      try {
        const itemName = String(row[col.item] ?? "").trim();
        if (!itemName) continue;

        const vendorName = String(row[col.vendor] ?? "").trim();
        const siteName = String(row[col.site] ?? "").trim();
        if (!vendorName || !siteName) {
          errors.push({ row: r + 1, message: "Vendor and site required" });
          continue;
        }

        const vendor = await this.upsertVendor(vendorName);
        const site = await this.upsertSite(siteName);

        const total = this.parseAmount(row[col.amount]);
        const brand =
          col.brand >= 0 ? String(row[col.brand] ?? "").trim() || null : null;
        const statusRaw = col.status >= 0 ? String(row[col.status] ?? "").trim() : "";
        const status =
          statusRaw.toLowerCase() === "completed"
            ? RequirementStatus.COMPLETED
            : RequirementStatus.PENDING;

        const billRaw = col.bill >= 0 ? String(row[col.bill] ?? "").trim().toLowerCase() : "";
        const billReceived = billRaw === "yes" || billRaw === "y" || billRaw === "true";

        const entryDate = this.parseDate(row[col.date]);
        const notes =
          col.notes >= 0 ? String(row[col.notes] ?? "").trim() || null : null;

        const req = await this.prisma.requirement.create({
          data: {
            itemName,
            brand,
            quantity: new Prisma.Decimal(1),
            totalAmount: new Prisma.Decimal(total),
            status,
            billReceived,
            entryDate,
            notes,
            vendorId: vendor.id,
            siteId: site.id,
            createdById: userId,
          },
        });
        created.push(req.id);

        if (col.pay >= 0) {
          const payAmt = this.parseAmount(row[col.pay]);
          if (payAmt > 0) {
            await this.prisma.payment.create({
              data: {
                requirementId: req.id,
                amount: new Prisma.Decimal(payAmt),
                recordedById: userId,
              },
            });
          }
        }
      } catch (e) {
        errors.push({
          row: r + 1,
          message: e instanceof Error ? e.message : "Row failed",
        });
      }
    }

    return { imported: created.length, requirementIds: created, errors };
  }

  private parseRows(buffer: Buffer, mime: string): unknown[][] {
    if (mime.includes("csv") || mime === "text/plain") {
      const text = buffer.toString("utf8");
      const rows = parseCsv(text, {
        relax_column_count: true,
        skip_empty_lines: true,
      }) as unknown[][];
      return rows;
    }
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheet = wb.SheetNames[0];
    if (!sheet) throw new BadRequestException("No sheet");
    const data = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet], {
      header: 1,
      raw: false,
    });
    return data as unknown[][];
  }

  private async upsertVendor(name: string) {
    const existing = await this.prisma.vendor.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (existing) return existing;
    return this.prisma.vendor.create({ data: { name } });
  }

  private async upsertSite(name: string) {
    const existing = await this.prisma.site.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (existing) return existing;
    return this.prisma.site.create({ data: { name } });
  }

  private parseAmount(v: unknown) {
    if (v === null || v === undefined) throw new BadRequestException("Amount missing");
    const n =
      typeof v === "number"
        ? v
        : Number(String(v).replace(/[,\s₹]/g, "").replace(/^[^0-9.-]+/, ""));
    if (!Number.isFinite(n)) throw new BadRequestException("Invalid amount");
    return n;
  }

  private parseDate(v: unknown) {
    if (v instanceof Date && !Number.isNaN(v.getTime())) {
      return v;
    }
    const s = String(v ?? "").trim();
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) throw new BadRequestException(`Invalid date: ${s}`);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
