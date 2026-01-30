import { PrismaClient } from '@prisma/client';
import { getDateOffsets } from './helpers';

export const seedPensionPlans = async (prisma: PrismaClient) => {
    console.log('🌱 Seeding 07_pension_plan...');

    const users = await prisma.user.findMany({ where: { role: 'USER' }, select: { id: true } });
    const { T0, T_MIN_6, T_MIN_14 } = getDateOffsets();
    const timestamps = [T0, T_MIN_6, T_MIN_14];
    const payloads: any[] = [];

    for (const user of users) {
        for (const date of timestamps) {
            // Rumus 4% Rule (Sangat disederhanakan untuk seeding)
            const currentExpense = 10_000_000;
            const futureValueExpense = currentExpense * Math.pow(1 + 0.05, 25); // 25 tahun lagi
            const fundNeeded = futureValueExpense * 12 * 20; // Cover 20 tahun masa pensiun

            payloads.push({
                userId: user.id,
                createdAt: date,
                updatedAt: date,

                currentAge: 30,
                retirementAge: 55,
                lifeExpectancy: 75,

                currentExpense: currentExpense,
                currentSaving: 50_000_000,
                inflationRate: 5.0,
                returnRate: 8.0,

                totalFundNeeded: fundNeeded,
                monthlySaving: fundNeeded / (25 * 12), // Nabung flat (tanpa bunga majemuk di seeding)
            });
        }
    }

    await prisma.pensionPlan.createMany({ data: payloads });
    console.log(`✅ Pension Plans Seeded: ${payloads.length} records.`);
};