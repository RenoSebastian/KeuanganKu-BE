import { PrismaClient } from '@prisma/client';
import { getDateOffsets } from './helpers';

export const seedGoalPlans = async (prisma: PrismaClient) => {
    console.log('🌱 Seeding 08_goal_plan...');

    const users = await prisma.user.findMany({ where: { role: 'USER' }, select: { id: true } });
    const { T0, T_MIN_6, T_MIN_14 } = getDateOffsets();
    const timestamps = [T0, T_MIN_6, T_MIN_14];
    const payloads: any[] = [];

    for (const user of users) {
        for (const date of timestamps) {
            const targetAmount = 250_000_000; // Beli Mobil
            // Target 5 tahun dari tanggal pembuatan simulasi
            const targetDate = new Date(date);
            targetDate.setFullYear(date.getFullYear() + 5);

            payloads.push({
                userId: user.id,
                createdAt: date, // Retention Key
                updatedAt: date,

                goalName: 'Beli Mobil Keluarga',
                targetAmount: targetAmount,
                targetDate: targetDate,

                inflationRate: 5.0,
                returnRate: 6.0,

                futureValue: targetAmount * Math.pow(1.05, 5),
                monthlySaving: (targetAmount * Math.pow(1.05, 5)) / 60,
            });
        }
    }

    await prisma.goalPlan.createMany({ data: payloads });
    console.log(`✅ Goal Plans Seeded: ${payloads.length} records.`);
};