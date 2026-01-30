import { PrismaClient } from '@prisma/client';
import { getDateOffsets, generateFinancialProfile } from './helpers';

export const seedBudgetPlans = async (prisma: PrismaClient) => {
    console.log('🌱 Seeding 04_budget_plan...');

    // 1. Ambil User ID (Hanya User Biasa)
    const users = await prisma.user.findMany({
        where: { role: 'USER' },
        select: { id: true, email: true },
    });

    if (users.length === 0) return;

    // 2. Setup Waktu (T0, T-6, T-14)
    const { T0, T_MIN_6, T_MIN_14 } = getDateOffsets();
    const timeframes = [
        { date: T0, month: T0.getMonth() + 1, year: T0.getFullYear() },
        { date: T_MIN_6, month: T_MIN_6.getMonth() + 1, year: T_MIN_6.getFullYear() },
        { date: T_MIN_14, month: T_MIN_14.getMonth() + 1, year: T_MIN_14.getFullYear() },
    ];

    const budgetPayloads: any[] = [];

    for (const user of users) {
        // Tentukan profil (Healthy/Risky) agar konsisten dengan Checkup
        const isEven = user.email.length % 2 === 0;
        const { data } = generateFinancialProfile(isEven ? 'RISKY' : 'HEALTHY');

        for (const tf of timeframes) {
            // Kalkulasi Balance
            const totalIncome = Number(data.incomeFixed) + Number(data.incomeVariable);

            // Breakdown Expense Sederhana untuk Budgeting
            // Asumsi: Living Cost adalah gabungan food + transport + lifestyle
            const livingCost = Number(data.expenseFood) + Number(data.expenseTransport) + Number(data.expenseLifestyle);
            const productiveDebt = Number(data.debtKPR) / 100; // Anggap cicilan 1% dari total utang
            const consumptiveDebt = Number(data.debtCC) / 10;
            const saving = totalIncome * (isEven ? 0.05 : 0.3); // Risky nabung dikit

            const totalExpense = livingCost + productiveDebt + consumptiveDebt + saving;
            const balance = totalIncome - totalExpense;
            const status = balance >= 0 ? 'SURPLUS' : 'DEFICIT';

            budgetPayloads.push({
                userId: user.id,
                month: tf.month,
                year: tf.year,
                createdAt: tf.date, // Trigger Retention
                updatedAt: tf.date,

                fixedIncome: data.incomeFixed,
                variableIncome: data.incomeVariable,
                totalIncome: totalIncome,

                livingCost: livingCost,
                productiveDebt: productiveDebt,
                consumptiveDebt: consumptiveDebt,
                insurance: 500000, // Flat assumption
                saving: saving,

                totalExpense: totalExpense,
                balance: balance,
                status: status,
            });
        }
    }

    // 3. Eksekusi Batch
    await prisma.budgetPlan.createMany({
        data: budgetPayloads,
        skipDuplicates: true,
    });

    console.log(`✅ Budget Plans Seeded: ${budgetPayloads.length} records.`);
};