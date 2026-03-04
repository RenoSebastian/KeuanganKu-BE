import { PrismaClient } from '@prisma/client';

export async function seedGlobalSettings(prisma: PrismaClient) {
    console.log('   ⚙️  Seeding Global Market Settings...');

    // Kita gunakan upsert agar id-nya statis (Singleton pattern) atau update jika sudah ada
    // Karena tabel ini tidak punya unique key selain ID, kita cek count dulu atau assume ID tertentu jika uuid

    const existing = await prisma.globalMarketSettings.findFirst();

    if (!existing) {
        await prisma.globalMarketSettings.create({
            data: {
                inflationRate: 5.0,      // 5%
                interestRate: 4.5,       // BI Rate
                riskFreeRate: 6.0,       // Obligasi
                goldPrice: 1350000,      // Harga Emas per gram
                updatedBy: 'SYSTEM_INIT'
            }
        });
        console.log('      ✅ Central Bank Settings Initialized');
    } else {
        console.log('      ⏩ Settings already exist. Skipping.');
    }
}