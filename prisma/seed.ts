import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Create Unit Kerja Dummy
  const unitIT = await prisma.unitKerja.upsert({
    where: { kodeUnit: 'IT-01' },
    update: {},
    create: {
      kodeUnit: 'IT-01',
      namaUnit: 'Divisi Teknologi Informasi',
    },
  });

  console.log({ unitIT });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });