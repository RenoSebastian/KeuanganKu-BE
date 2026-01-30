import { PrismaClient } from '@prisma/client';

export const seedMasterData = async (prisma: PrismaClient) => {
    console.log('🌱 Seeding 01_master_data...');

    // Menggunakan Transaction untuk atomicity
    await prisma.$transaction(async (tx) => {
        // Upsert Unit Kerja (Idempotent: Aman dijalankan berulang)
        const units = [
            { kode: 'IT-01', nama: 'Divisi Teknologi Informasi' },
            { kode: 'FIN-01', nama: 'Divisi Keuangan & Akuntansi' },
            { kode: 'HR-01', nama: 'Divisi SDM & Umum' },
            { kode: 'BOD-01', nama: 'Direksi' },
        ];

        for (const unit of units) {
            await tx.unitKerja.upsert({
                where: { kodeUnit: unit.kode },
                update: { namaUnit: unit.nama }, // Update nama jika berubah
                create: {
                    kodeUnit: unit.kode,
                    namaUnit: unit.nama,
                },
            });
        }
    });

    console.log('✅ Master Data Seeded.');
};