/**
 * One-shot: create or reset password for bootstrap users (password login).
 * Usage: npm run db:ensure-admin
 *
 * Env (optional):
 *   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME
 *   ACCOUNT_HEAD_EMAIL, ACCOUNT_HEAD_PASSWORD, ACCOUNT_HEAD_NAME
 * If ACCOUNT_HEAD_PASSWORD is unset, uses ADMIN_PASSWORD (same password for both).
 */
const bcrypt = require("bcrypt");
const { PrismaClient, UserRole } = require("@prisma/client");

const adminEmail = (process.env.ADMIN_EMAIL || "admin@example.com").toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || "Admin12345!";
const adminName = process.env.ADMIN_NAME || "Admin";

const acctEmail = (process.env.ACCOUNT_HEAD_EMAIL || "accounts@example.com").toLowerCase();
const acctPassword = process.env.ACCOUNT_HEAD_PASSWORD || adminPassword;
const acctName = process.env.ACCOUNT_HEAD_NAME || "Account Head";

async function upsertUser(prisma, role, email, name, plain) {
  const passwordHash = await bcrypt.hash(plain, 12);
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name, role },
    create: {
      email,
      name,
      role,
      passwordHash,
    },
  });
}

async function main() {
  const prisma = new PrismaClient();
  await upsertUser(prisma, UserRole.ADMIN, adminEmail, adminName, adminPassword);
  console.log(`OK — ${adminEmail} (ADMIN)`);
  await upsertUser(prisma, UserRole.ACCOUNT_HEAD, acctEmail, acctName, acctPassword);
  console.log(`OK — ${acctEmail} (ACCOUNT_HEAD)`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
