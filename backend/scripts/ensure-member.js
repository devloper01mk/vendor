/**
 * One-shot: create or reset password for a MEMBER user (mobile login).
 * Usage: npm run db:ensure-member
 *
 * Env (optional):
 *   MEMBER_EMAIL, MEMBER_PASSWORD, MEMBER_NAME
 */
const bcrypt = require("bcrypt");
const { PrismaClient, UserRole } = require("@prisma/client");

const memberEmail = (process.env.MEMBER_EMAIL || "user@example.com").toLowerCase();
const memberPassword = process.env.MEMBER_PASSWORD || "User12345!";
const memberName = process.env.MEMBER_NAME || "Mobile User";

async function main() {
  const prisma = new PrismaClient();
  const passwordHash = await bcrypt.hash(memberPassword, 12);
  await prisma.user.upsert({
    where: { email: memberEmail },
    update: { passwordHash, name: memberName, role: UserRole.MEMBER },
    create: {
      email: memberEmail,
      name: memberName,
      role: UserRole.MEMBER,
      passwordHash,
    },
  });
  console.log(`OK — ${memberEmail} (MEMBER)`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

