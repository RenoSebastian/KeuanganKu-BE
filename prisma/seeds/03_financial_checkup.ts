import { PrismaClient, HealthStatus } from '@prisma/client';
import { getDateOffsets, generateFinancialProfile } from './helpers';

export const seedFinancialCheckups = async (prisma: PrismaClient) => {
    console.log('🌱 Seeding 03_financial_checkup...');

    // 1. Retrieve Target Users (Only Role USER)
    // Optimization: Select only ID to minimize memory footprint
    const users = await prisma.user.findMany({
        where: { role: 'USER' },
        select: { id: true, email: true },
    });

    if (users.length === 0) {
        console.warn('⚠️ No users found. Skipping financial checkup seeding.');
        return;
    }

    // 2. Prepare Data Batch
    const { T0, T_MIN_6, T_MIN_14 } = getDateOffsets();
    const timeframes = [
        { date: T0, label: 'Current Month' },
        { date: T_MIN_6, label: '6 Months Ago' },
        { date: T_MIN_14, label: '14 Months Ago (Retention Target)' },
    ];

    const checkupPayloads: any[] = [];

    // 3. Data Construction Loop (O(N * M) Complexity)
    for (const user of users) {
        // Logic: Alternate financial health based on User ID parity
        // User Ganjil = Sehat, User Genap = Bahaya (untuk variasi dashboard)
        const isEven = user.email.length % 2 === 0;
        const profileType = isEven ? 'RISKY' : 'HEALTHY';

        // Generate base profile logic
        const financialData = generateFinancialProfile(profileType);

        for (const timeframe of timeframes) {
            // Logic: Variation over time
            // Seiring waktu, net worth bertambah sedikit (inflasi simulasi)
            const timeVariation = timeframe.label === 'Current Month' ? 1.05 : 1.0;

            checkupPayloads.push({
                userId: user.id,
                checkDate: timeframe.date, // Business Date
                createdAt: timeframe.date, // System Date (CRITICAL for Retention Pruning)
                updatedAt: timeframe.date,

                // Spread calculated financial data
                ...financialData.data,

                // Apply variation
                totalNetWorth: Number(financialData.data.totalNetWorth) * timeVariation,

                // Explicit Enum Mapping
                status: financialData.data.status as HealthStatus,

                // Complex JSON Fields
                userProfile: financialData.data.userProfile,
                ratiosDetails: financialData.data.ratiosDetails,
            });
        }
    }

    // 4. Batch Insert (High Performance)
    // createMany digunakan untuk menghindari N+1 Insert Query
    const batchSize = 100;
    let insertedCount = 0;

    for (let i = 0; i < checkupPayloads.length; i += batchSize) {
        const batch = checkupPayloads.slice(i, i + batchSize);
        const result = await prisma.financialCheckup.createMany({
            data: batch,
            skipDuplicates: true, // Safety net
        });
        insertedCount += result.count;
    }

    console.log(`✅ Financial Checkups Seeded: ${insertedCount} records (across ${users.length} users).`);
    console.log(`   👉 Retention Validated: Checkups created at ${T_MIN_14.toISOString()} should be pruned.`);
};