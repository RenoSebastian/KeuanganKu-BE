import { PrismaClient, SchoolLevel, CostType } from '@prisma/client';
import { getDateOffsets } from './helpers';

export const seedEducationPlans = async (prisma: PrismaClient) => {
    console.log('🌱 Seeding 05_education_plan...');

    // 1. Fetch User IDs
    const users = await prisma.user.findMany({
        where: { role: 'USER' },
        select: { id: true }
    });

    const { T0, T_MIN_6, T_MIN_14 } = getDateOffsets();
    const timestamps = [T0, T_MIN_6, T_MIN_14];

    // [FIX 1] Explicit Typing untuk Array Promise agar tidak dianggap never[]
    const operations: Promise<any>[] = [];

    for (const user of users) {
        for (const date of timestamps) {
            // Simulasi anak umur 4 tahun saat data dibuat
            const childDob = new Date(date);
            childDob.setFullYear(date.getFullYear() - 4);

            // Kalkulasi kasar FV (Future Value)
            // FV = PV * (1 + r)^n
            const inflation = 0.10; // 10% inflasi pendidikan
            const baseCostTK = 15_000_000;
            // Masuk TK 1 tahun lagi dari "date" (umur 5)
            const futureCostTK = baseCostTK * Math.pow(1 + inflation, 1);

            operations.push(
                prisma.educationPlan.create({
                    data: {
                        userId: user.id,
                        childName: `Anak Simulasi (${date.toISOString().split('T')[0]})`,
                        childDob: childDob,
                        inflationRate: 10.0,
                        returnRate: 12.0,

                        // [FIX 2] Pastikan Anda sudah update schema.prisma menambahkan field ini
                        createdAt: date, // Retention Key
                        updatedAt: date,

                        method: 'GEOMETRIC',
                        stages: {
                            create: [
                                {
                                    level: SchoolLevel.TK,
                                    costType: CostType.ENTRY,
                                    currentCost: baseCostTK,
                                    futureCost: futureCostTK,
                                    yearsToStart: 1,
                                    monthlySaving: futureCostTK / 12, // Nabung setahun
                                },
                                {
                                    level: SchoolLevel.SD,
                                    costType: CostType.ENTRY,
                                    currentCost: 25_000_000,
                                    futureCost: 25_000_000 * Math.pow(1 + inflation, 3), // Masuk SD 3 tahun lagi
                                    yearsToStart: 3,
                                    monthlySaving: (25_000_000 * Math.pow(1 + inflation, 3)) / 36,
                                }
                            ]
                        }
                    }
                })
            );
        }
    }

    // Eksekusi Parallel
    // Promise.all memastikan semua operasi create selesai sebelum lanjut
    if (operations.length > 0) {
        await Promise.all(operations);
        console.log(`✅ Education Plans Seeded: ${operations.length} plans with stages.`);
    } else {
        console.log('⚠️ No Education Plans created (No users found).');
    }
};