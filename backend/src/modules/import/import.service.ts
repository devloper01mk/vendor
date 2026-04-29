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
  requirementId: "requirementId",
  itemName: "itemName",
  brand: "brand",
  siteName: "siteName",
  siteCode: "siteCode",
  siteAddress: "siteAddress",
  vendorName: "vendorName",
  vendorPhone: "vendorPhone",
  vendorAlternatePhone: "vendorAlternatePhone",
  vendorEmail: "vendorEmail",
  vendorGstNumber: "vendorGstNumber",
  vendorAddress: "vendorAddress",
  totalAmount: "totalAmount",
  status: "status",
  billReceived: "billReceived",
  entryDate: "entryDate",
  paymentAmount: "paymentAmount",
  notes: "notes",
};

const TEMPLATE_HEADERS = [
  "requirementId",
  "itemName",
  "brand",
  "siteName",
  "siteCode",
  "siteAddress",
  "vendorName",
  "vendorPhone",
  "vendorAlternatePhone",
  "vendorEmail",
  "vendorGstNumber",
  "vendorAddress",
  "totalAmount",
  "status",
  "billReceived",
  "entryDate",
  "paymentAmount",
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
      requirementId: columns.requirementId ? optionalIdx(columns.requirementId) : -1,
      item: idx(columns.itemName),
      brand: columns.brand ? idx(columns.brand) : -1,
      site: idx(columns.siteName),
      siteCode: columns.siteCode ? idx(columns.siteCode) : -1,
      siteAddress: columns.siteAddress ? idx(columns.siteAddress) : -1,
      vendor: idx(columns.vendorName),
      vendorPhone: columns.vendorPhone ? idx(columns.vendorPhone) : -1,
      vendorAlternatePhone: columns.vendorAlternatePhone ? idx(columns.vendorAlternatePhone) : -1,
      vendorEmail: columns.vendorEmail ? idx(columns.vendorEmail) : -1,
      vendorGstNumber: columns.vendorGstNumber ? idx(columns.vendorGstNumber) : -1,
      vendorAddress: columns.vendorAddress ? idx(columns.vendorAddress) : -1,
      amount: idx(columns.totalAmount),
      status: columns.status ? optionalIdx(columns.status) : -1,
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
        const requirementId =
          col.requirementId >= 0 ? String(row[col.requirementId] ?? "").trim() : "";
        const itemName = String(row[col.item] ?? "").trim();
        if (!itemName) continue;

        const vendorName = String(row[col.vendor] ?? "").trim();
        const siteName = String(row[col.site] ?? "").trim();
        if (!vendorName || !siteName) {
          errors.push({ row: r + 1, message: "Vendor and site required" });
          continue;
        }

        const vendor = await this.upsertVendor(vendorName, {
          phone: col.vendorPhone >= 0 ? String(row[col.vendorPhone] ?? "").trim() : "",
          alternatePhone:
            col.vendorAlternatePhone >= 0 ? String(row[col.vendorAlternatePhone] ?? "").trim() : "",
          email: col.vendorEmail >= 0 ? String(row[col.vendorEmail] ?? "").trim() : "",
          gstNumber: col.vendorGstNumber >= 0 ? String(row[col.vendorGstNumber] ?? "").trim() : "",
          address: col.vendorAddress >= 0 ? String(row[col.vendorAddress] ?? "").trim() : "",
        });
        const site = await this.upsertSite(siteName, {
          code: col.siteCode >= 0 ? String(row[col.siteCode] ?? "").trim() : "",
          address: col.siteAddress >= 0 ? String(row[col.siteAddress] ?? "").trim() : "",
        });

        const total = this.parseAmount(row[col.amount]);
        const brand =
          col.brand >= 0 ? String(row[col.brand] ?? "").trim() || null : null;
        const status = this.parseStatus(col.status >= 0 ? row[col.status] : "");
        const billReceived = this.parseBoolean(col.bill >= 0 ? row[col.bill] : "", false);

        const entryDate = this.parseDate(row[col.date]);
        const notes =
          col.notes >= 0 ? String(row[col.notes] ?? "").trim() || null : null;
        let reqId = requirementId;
        if (requirementId) {
          const existing = await this.prisma.requirement.findUnique({ where: { id: requirementId } });
          if (!existing) {
            errors.push({ row: r + 1, message: `requirementId not found: ${requirementId}` });
            continue;
          }
          const updated = await this.prisma.requirement.update({
            where: { id: requirementId },
            data: {
              itemName,
              brand,
              totalAmount: new Prisma.Decimal(total),
              status,
              billReceived,
              entryDate,
              notes,
              vendorId: vendor.id,
              siteId: site.id,
            },
          });
          reqId = updated.id;
        } else {
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
          reqId = req.id;
          created.push(req.id);
        }

        if (col.pay >= 0) {
          const payAmt = this.parseAmount(row[col.pay]);
          if (payAmt > 0) {
            await this.prisma.payment.create({
              data: {
                requirementId: reqId,
                amount: new Prisma.Decimal(payAmt),
                recordedById: userId,
              },
            });
          }
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

  private async upsertVendor(
    name: string,
    details: { phone: string; alternatePhone: string; email: string; gstNumber: string; address: string },
  ) {
    const existing = await this.prisma.vendor.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    const payload: Prisma.VendorUncheckedUpdateInput = {
      phone: details.phone || undefined,
      alternatePhone: details.alternatePhone || undefined,
      email: details.email || undefined,
      gstNumber: details.gstNumber || undefined,
      address: details.address || undefined,
    };
    if (existing) {
      if (Object.values(payload).some(Boolean)) {
        return this.prisma.vendor.update({
          where: { id: existing.id },
          data: payload,
        });
      }
      return existing;
    }
    return this.prisma.vendor.create({
      data: {
        name,
        phone: details.phone || null,
        alternatePhone: details.alternatePhone || null,
        email: details.email || null,
        gstNumber: details.gstNumber || null,
        address: details.address || null,
      },
    });
  }

  private async upsertSite(name: string, details: { code: string; address: string }) {
    const existing = await this.prisma.site.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    const payload: Prisma.SiteUncheckedUpdateInput = {
      code: details.code || undefined,
      address: details.address || undefined,
    };
    if (existing) {
      if (Object.values(payload).some(Boolean)) {
        return this.prisma.site.update({
          where: { id: existing.id },
          data: payload,
        });
      }
      return existing;
    }
    return this.prisma.site.create({
      data: {
        name,
        code: details.code || null,
        address: details.address || null,
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
        "",
        "Cement Bags",
        "UltraTech",
        "Site A",
        "SITE-A",
        "Andheri East",
        "ABC Suppliers",
        "9876543210",
        "",
        "abc@supplier.com",
        "27ABCDE1234F1Z5",
        "Mumbai",
        "12000",
        "PENDING",
        "yes",
        "2026-04-28",
        "0",
        "Optional remarks",
      ],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(templateRows), "TransactionsTemplate");

    const behaviorRows = [
      ["Behavior", "Description"],
      ["Dedup vendor", "vendorName is matched case-insensitively. Existing vendor is reused/updated."],
      ["Dedup site", "siteName is matched case-insensitively. Existing site is reused/updated."],
      ["Update transaction", "If requirementId is provided and found, that transaction is updated."],
      ["Create transaction", "If requirementId is empty, a new transaction is created."],
      ["Payment handling", "paymentAmount adds a new payment entry. Keep 0 or empty if no payment."],
      ["Status auto-sync", "After payment import, status becomes COMPLETED if fully paid, else PENDING."],
      ["Accepted status", "PENDING or COMPLETED (any other value defaults to PENDING)."],
      ["Accepted billReceived", "yes/no, true/false, y/n, 1/0."],
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
        itemName: r.itemName,
        brand: r.brand ?? "",
        siteName: r.site.name,
        siteCode: r.site.code ?? "",
        siteAddress: r.site.address ?? "",
        vendorName: r.vendor.name,
        vendorPhone: r.vendor.phone ?? "",
        vendorAlternatePhone: r.vendor.alternatePhone ?? "",
        vendorEmail: r.vendor.email ?? "",
        vendorGstNumber: r.vendor.gstNumber ?? "",
        vendorAddress: r.vendor.address ?? "",
        totalAmount: r.totalAmount.toString(),
        status: r.status,
        billReceived: r.billReceived ? "yes" : "no",
        entryDate: r.entryDate.toISOString().slice(0, 10),
        paymentAmount: "0",
        notes: r.notes ?? "",
        paidTotal: paid.toString(),
        remaining: r.totalAmount.sub(paid).toString(),
      };
    });

    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(data, {
      header: [
        ...TEMPLATE_HEADERS,
        "paidTotal",
        "remaining",
      ],
    });
    XLSX.utils.book_append_sheet(wb, sheet, "TransactionsData");
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Behavior", "Description"],
        ["paidTotal / remaining", "Read-only reference fields. Import ignores these two columns."],
        ["paymentAmount", "Put additional payment amount to add during import, else keep 0."],
      ]),
      "BehaviorAndRules",
    );
    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  }
}
