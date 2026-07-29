import { PrismaClient, LocationCode } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.location.upsert({
    where: { code: LocationCode.KHO_TONG },
    update: { name: "kho tong" },
    create: { code: LocationCode.KHO_TONG, name: "kho tong" },
  });

  await prisma.location.upsert({
    where: { code: LocationCode.KHO_LE },
    update: { name: "kho le" },
    create: { code: LocationCode.KHO_LE, name: "kho le" },
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
