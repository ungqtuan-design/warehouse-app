import { randomBytes, scryptSync } from "node:crypto";

import { PrismaClient, LocationCode, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");

  return `${salt}:${hash}`;
}

async function main() {
  const adminPasswordHash = hashPassword("admin");

  await prisma.location.upsert({
    where: { code: LocationCode.KHO_TONG },
    update: { name: "Kho Tổng" },
    create: { code: LocationCode.KHO_TONG, name: "Kho Tổng" },
  });

  await prisma.location.upsert({
    where: { code: LocationCode.KHO_LE },
    update: { name: "Kho Lẻ" },
    create: { code: LocationCode.KHO_LE, name: "Kho Lẻ" },
  });

  const adminUser = await prisma.user.upsert({
    where: { username: "admin" },
    update: {
      name: "Administrator",
      role: UserRole.ADMIN,
      passwordHash: adminPasswordHash,
    },
    create: {
      username: "admin",
      name: "Administrator",
      role: UserRole.ADMIN,
      passwordHash: adminPasswordHash,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
