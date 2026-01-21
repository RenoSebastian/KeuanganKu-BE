import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Mulai seeding database...');

  // 1. SEED UNIT KERJA
  // Kita hardcode ID-nya supaya match dengan yang dikirim Frontend ("KANTOR_PUSAT")
  const unitUmum = await prisma.unitKerja.upsert({
    where: { id: 'KANTOR_PUSAT' },
    update: {},
    create: {
      id: 'KANTOR_PUSAT',
      namaUnit: 'Kantor Pusat PAM JAYA', // Sesuai schema: namaUnit
      kodeUnit: 'KP-001',                // Sesuai schema: kodeUnit
    },
  });

  const unitCabang = await prisma.unitKerja.upsert({
    where: { id: 'CABANG_BARAT' },
    update: {},
    create: {
      id: 'CABANG_BARAT',
      namaUnit: 'Kantor Cabang Barat',
      kodeUnit: 'KC-001',
    },
  });

  console.log('✅ Unit Kerja created:', { unitUmum, unitCabang });

  // 2. SEED ADMIN USER
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@pamjaya.co.id' },
    update: {},
    create: {
      email: 'admin@pamjaya.co.id',
      passwordHash: hashedPassword, // Sesuai schema: passwordHash
      fullName: 'Super Admin',
      nip: '99999999',
      role: 'ADMIN',
      unitKerjaId: 'KANTOR_PUSAT',
      dateOfBirth: new Date('1985-01-01'), // Wajib diisi sesuai schema
    },
  });

  console.log('✅ Admin user created:', admin);
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });