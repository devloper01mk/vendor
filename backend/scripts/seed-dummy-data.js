/**
 * Idempotent dummy rows for local testing (sites, vendors, requirements, payments, invoice).
 * Safe to re-run: skips if a requirement with __DEMO_SEED__ in notes exists.
 *
 * Usage: npm run db:seed-dummy
 * Needs: at least one user (e.g. npm run db:ensure-admin)
 */
const { PrismaClient, RequirementStatus } = require("@prisma/client");

const MARKER = "__DEMO_SEED__";

async function main() {
  const prisma = new PrismaClient();

  const done = await prisma.requirement.findFirst({
    where: { notes: { contains: MARKER } },
  });
  if (done) {
    console.log("Dummy data already present — skipped.");
    await prisma.$disconnect();
    return;
  }

  const creator =
    (await prisma.user.findFirst({
      where: { email: "admin@example.com" },
    })) ??
    (await prisma.user.findFirst({
      where: { role: "ADMIN" },
    }));
  if (!creator) {
    console.error("No user found. Run: npm run db:ensure-admin");
    process.exit(1);
  }

  const siteMandau = await prisma.site.upsert({
    where: { code: "MANDAU" },
    update: {},
    create: { name: "Mandau", code: "MANDAU" },
  });
  const siteHingona = await prisma.site.upsert({
    where: { code: "HINGONA" },
    update: {},
    create: { name: "Hingona", code: "HINGONA" },
  });

  let vendor = await prisma.vendor.findFirst({ where: { name: "Sample Electricals" } });
  if (!vendor) {
    vendor = await prisma.vendor.create({
      data: {
        name: "Sample Electricals",
        gstNumber: "27AAAAA0000A1Z5",
        phone: "+91-9000000000",
      },
    });
  }

  let vendor2 = await prisma.vendor.findFirst({ where: { name: "Demo Plumbing Co" } });
  if (!vendor2) {
    vendor2 = await prisma.vendor.create({
      data: {
        name: "Demo Plumbing Co",
        gstNumber: "27BBBBB0000B1Z5",
        phone: "+91-9111111111",
      },
    });
  }

  const reqPending = await prisma.requirement.create({
    data: {
      itemName: "Copper wire 2.5 sq.mm (dummy)",
      brand: "Polycab",
      quantity: "4",
      totalAmount: "12800.50",
      status: RequirementStatus.PENDING,
      billReceived: false,
      entryDate: new Date("2026-03-15T12:00:00.000Z"),
      notes: `Local dummy · ${MARKER}`,
      vendorId: vendor.id,
      siteId: siteMandau.id,
      createdById: creator.id,
    },
  });

  const reqPaid = await prisma.requirement.create({
    data: {
      itemName: "MCB 32A double pole (dummy)",
      brand: "Legrand",
      quantity: "12",
      totalAmount: "8640.00",
      status: RequirementStatus.COMPLETED,
      billReceived: true,
      entryDate: new Date("2026-03-22T12:00:00.000Z"),
      notes: `Paid dummy row · ${MARKER}`,
      vendorId: vendor.id,
      siteId: siteHingona.id,
      createdById: creator.id,
    },
  });

  await prisma.payment.create({
    data: {
      amount: "5000.00",
      paidAt: new Date("2026-03-25T10:30:00.000Z"),
      method: "NEFT",
      note: "Partial payment (dummy)",
      requirementId: reqPaid.id,
      recordedById: creator.id,
    },
  });
  await prisma.payment.create({
    data: {
      amount: "3640.00",
      paidAt: new Date("2026-03-28T14:00:00.000Z"),
      method: "UPI",
      note: "Balance (dummy)",
      requirementId: reqPaid.id,
      recordedById: creator.id,
    },
  });

  await prisma.invoice.create({
    data: {
      fileUrl: "http://localhost:4000/uploads/dummy/sample-invoice.pdf",
      fileKey: "dummy/sample-invoice.pdf",
      mimeType: "application/pdf",
      originalName: "sample-invoice.pdf",
      gstDetails: {
        invoiceNo: "DUMMY-INV-001",
        items: [{ description: "MCB 32A", taxableValue: 7322.03, gstRate: 18 }],
      },
      requirementId: reqPaid.id,
      uploadedById: creator.id,
    },
  });

  await prisma.requirement.create({
    data: {
      itemName: "LED panel 40W (dummy)",
      brand: "Havells",
      quantity: "8",
      totalAmount: "11200.00",
      status: RequirementStatus.PENDING,
      billReceived: false,
      entryDate: new Date("2026-04-01T12:00:00.000Z"),
      notes: `Another line · ${MARKER}`,
      vendorId: vendor.id,
      siteId: siteHingona.id,
      createdById: creator.id,
    },
  });

  await prisma.requirement.create({
    data: {
      itemName: "CPVC pipes bundle (dummy)",
      brand: "Astral",
      quantity: "2",
      totalAmount: "9450.75",
      status: RequirementStatus.PENDING,
      billReceived: false,
      entryDate: new Date("2026-04-03T12:00:00.000Z"),
      notes: `Second vendor · ${MARKER}`,
      vendorId: vendor2.id,
      siteId: siteMandau.id,
      createdById: creator.id,
    },
  });

  console.log(
    "Dummy data inserted: 2 sites, 2 vendors, 4 requirements, 2 payments, 1 invoice (marker __DEMO_SEED__).",
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
