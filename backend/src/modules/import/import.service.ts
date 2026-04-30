import { BadRequestException, Injectable } from "@nestjs/common";
import {
  Prisma,
  RequirementStatus,
} from "@prisma/client";
import * as XLSX from "xlsx";
import { parse as parseCsv } from "csv-parse/sync";
import { PrismaService } from "../../prisma/prisma.service";
import { ImportColumnMapDto } from "./dto/import-mapping.dto";

const DEFAULT_IMPORT_COLUMNS: ImportColumnMapDto = {
  entryDate: "entryDate",
  itemName: "itemName",
  details: "details",
  brandPerson: "brandPerson",
  siteName: "siteName",
  totalAmount: "totalAmount",
  paidTotal: "paidTotal",
  status: "status",
  billStatus: "billStatus",
  notes: "notes",
};

const TEMPLATE_HEADERS = [
  "entryDate",
  "itemName",
  "details",
  "brandPerson",
  "siteName",
  "totalAmount",
  "paidTotal",
  "status",
  "billStatus",
  "notes",
];

@Injectable()
export class ImportService {
  constructor(private readonly prisma: PrismaService) {}

  async importBuffer(params: {
    buffer: Buffer;
    mime: string;
    columns?: ImportColumnMapDto;
    userId: string;
  }) {
    const { buffer, mime, userId } = params;
    const columns = { ...DEFAULT_IMPORT_COLUMNS, ...(params.columns ?? {}) };
    const rows = this.parseRows(buffer, mime);
    if (!rows.length) throw new BadRequestException("Empty file");

    const header = rows[0].map((c) => String(c ?? "").trim());
    const idx = (title: string) => {
      const i = header.findIndex((h) => h.toLowerCase() === title.toLowerCase());
      if (i === -1) throw new BadRequestException(`Missing column: ${title}`);
      return i;
    };
    const optionalIdx = (title: string) => header.findIndex((h) => h.toLowerCase() === title.toLowerCase());

    const col = {
      entryDate: idx(columns.entryDate),
      item: idx(columns.itemName),
      details: columns.details ? optionalIdx(columns.details) : -1,
      brandPerson: idx(columns.brandPerson),
      site: idx(columns.siteName),
      amount: idx(columns.totalAmount),
      paidTotal: columns.paidTotal ? optionalIdx(columns.paidTotal) : -1,
      status: columns.status ? optionalIdx(columns.status) : -1,
      billStatus: columns.billStatus ? optionalIdx(columns.billStatus) : -1,
      notes: columns.notes ? idx(columns.notes) : -1,
    };

    const created: string[] = [];
    const errors: { row: number; message: string }[] = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      try {
        const itemName = String(row[col.item] ?? "").trim();
        if (!itemName) continue;

        const vendorName = String(row[col.brandPerson] ?? "").trim();
        const siteName = String(row[col.site] ?? "").trim();
        if (!vendorName || !siteName) {
          errors.push({ row: r + 1, message: "Brand/Person and site required" });
          continue;
        }

        const vendor = await this.upsertVendor(vendorName);
        const site = await this.upsertSite(siteName);

        const total = this.parseAmount(row[col.amount]);
        const details = col.details >= 0 ? String(row[col.details] ?? "").trim() || null : null;
        const status = this.parseStatus(col.status >= 0 ? row[col.status] : "");
        const billReceived = this.parseBoolean(col.billStatus >= 0 ? row[col.billStatus] : "", false);

        const entryDate = this.parseDate(row[col.entryDate]);
        const notes =
          col.notes >= 0 ? String(row[col.notes] ?? "").trim() || null : null;
        const req = await this.prisma.requirement.create({
          data: {
            itemName,
            brand: details,
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
        const reqId = req.id;
        created.push(req.id);

        const paidTotal = col.paidTotal >= 0 ? this.parseAmount(row[col.paidTotal]) : 0;
        if (paidTotal > 0) {
          await this.prisma.payment.create({
            data: {
              requirementId: reqId,
              amount: new Prisma.Decimal(paidTotal),
              recordedById: userId,
            },
          });
        }
        // Always derive status from payment math:
        // paidTotal vs totalAmount determines COMPLETED/PENDING.
        await this.syncStatusFromPayments(reqId);
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
    if (existing) {
      return existing;
    }
    return this.prisma.vendor.create({
      data: {
        name,
      },
    });
  }

  private async upsertSite(name: string) {
    const existing = await this.prisma.site.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.site.create({
      data: {
        name,
      },
    });
  }

  private parseAmount(v: unknown) {
    if (v === null || v === undefined || String(v).trim() === "") return 0;
    const n =
      typeof v === "number"
        ? v
        : Number(String(v).replace(/[,\s₹]/g, "").replace(/^[^0-9.-]+/, ""));
    if (!Number.isFinite(n)) throw new BadRequestException("Invalid amount");
    return n;
  }

  private parseStatus(v: unknown) {
    const s = String(v ?? "").trim().toLowerCase();
    return s === "completed" ? RequirementStatus.COMPLETED : RequirementStatus.PENDING;
  }

  private parseBoolean(v: unknown, defaultValue = false) {
    const s = String(v ?? "").trim().toLowerCase();
    if (!s) return defaultValue;
    return s === "yes" || s === "y" || s === "true" || s === "1";
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

  private async syncStatusFromPayments(requirementId: string) {
    const req = await this.prisma.requirement.findUnique({
      where: { id: requirementId },
      include: { payments: true },
    });
    if (!req) return;
    const paid = req.payments.reduce((acc, p) => acc.add(p.amount), new Prisma.Decimal(0));
    const complete =
      paid.sub(req.totalAmount).abs().lte(new Prisma.Decimal("0.01")) ||
      paid.gte(req.totalAmount);
    await this.prisma.requirement.update({
      where: { id: requirementId },
      data: { status: complete ? RequirementStatus.COMPLETED : RequirementStatus.PENDING },
    });
  }

  async exportTemplateWorkbook() {
    const wb = XLSX.utils.book_new();
    const templateRows = [
      TEMPLATE_HEADERS,
      [
        "2026-04-28",
        "Cement Bags",
        "UltraTech",
        "ABC Suppliers",
        "Site A",
        "12000",
        "0",
        "PENDING",
        "yes",
        "Optional remarks",
      ],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(templateRows), "TransactionsTemplate");

    const behaviorRows = [
      ["Behavior", "Description"],
      ["Dedup Brand/Person", "brandPerson is matched case-insensitively. Existing row is reused/updated."],
      ["Dedup site", "siteName is matched case-insensitively. Existing site is reused/updated."],
      ["Create transaction", "Each row creates one transaction entry."],
      ["Payment handling", "paidTotal adds an initial payment. Keep 0 or empty if no payment."],
      ["Status auto-sync", "After payment import, status becomes COMPLETED if fully paid, else PENDING."],
      ["Accepted status", "PENDING or COMPLETED (any other value defaults to PENDING)."],
      ["Accepted billStatus", "yes/no, true/false, y/n, 1/0."],
      ["Date format", "Use YYYY-MM-DD for entryDate."],
      ["Important", "Do not rename column headers in TransactionsTemplate sheet."],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(behaviorRows), "BehaviorAndRules");

    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  }

  async exportDataWorkbook() {
    const rows = await this.prisma.requirement.findMany({
      orderBy: { entryDate: "desc" },
      include: {
        vendor: true,
        site: true,
        payments: true,
      },
    });
    const data = rows.map((r) => {
      const paid = r.payments.reduce((acc, p) => acc.add(p.amount), new Prisma.Decimal(0));
      return {
        requirementId: r.id,
        entryDate: r.entryDate.toISOString().slice(0, 10),
        itemName: r.itemName,
        details: r.brand ?? "",
        brandPerson: r.vendor.name,
        siteName: r.site.name,
        totalAmount: r.totalAmount.toString(),
        paidTotal: paid.toString(),
        status: r.status,
        billStatus: r.billReceived ? "yes" : "no",
        notes: r.notes ?? "",
      };
    });

    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(data, {
      header: TEMPLATE_HEADERS,
    });
    XLSX.utils.book_append_sheet(wb, sheet, "TransactionsData");
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Behavior", "Description"],
        ["paidTotal", "Initial paid amount for import. 0 means no payment."],
      ]),
      "BehaviorAndRules",
    );
    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  }
}
