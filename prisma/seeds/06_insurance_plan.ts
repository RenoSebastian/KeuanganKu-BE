import { PrismaClient, InsuranceType } from '@prisma/client';
import { getDateOffsets } from './helpers';

export const seedInsurancePlans = async (prisma: PrismaClient) => {
    console.log('🌱 Seeding 06_insurance_plan...');

    const users = await prisma.user.findMany({ where: { role: 'USER' }, select: { id: true } });
    const { T0, T_MIN_6, T_MIN_14 } = getDateOffsets();
    const timestamps = [T0, T_MIN_6, T_MIN_14];

    const payloads: any[] = [];

    for (const user of users) {
        for (const date of timestamps) {
            // Logika: Kebutuhan UP = Pengeluaran Tahunan x 10 Tahun (Rule of Thumb)
            const monthlyExpense = 10_000_000;
            const coverageNeeded = monthlyExpense * 12 * 10; // 1.2 Milyar

            payloads.push({
                userId: user.id,
                type: InsuranceType.LIFE,
                createdAt: date, // Retention Key
                updatedAt: date,

                dependentCount: 2,
                monthlyExpense: monthlyExpense,
                existingDebt: 100_000_000,
                existingCoverage: 200_000_000, // Punya BPJS TK dsb
                protectionDuration: 10,
                inflationRate: 5.0,
                returnRate: 7.0,
                finalExpense: 50_000_000, // Biaya pemakaman dll

                // Hasil Hitung (Simulasi)
                coverageNeeded: coverageNeeded - 200_000_000 + 100_000_000 + 50_000_000,
                recommendation: 'Disarankan menambah Term Life Insurance sebesar 1 Milyar.',
            });
        }
    }

    await prisma.insurancePlan.createMany({ data: payloads });
    console.log(`✅ Insurance Plans Seeded: ${payloads.length} records.`);
};