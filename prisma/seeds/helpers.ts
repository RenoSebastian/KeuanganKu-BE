import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt'; // Pastikan npm i bcrypt @types/bcrypt terinstall

// --- CONSTANTS ---
export const PASSWORD_HASH_SALT = 10;
export const DEFAULT_PASSWORD = 'Password123!';

// --- DATE MANIPULATION (Time Travel Logic) ---
export const getDateOffsets = () => {
    const now = new Date();

    // T-6 Bulan (Data Historis Aman)
    const past6Months = new Date(now);
    past6Months.setMonth(now.getMonth() - 6);

    // T-14 Bulan (Target Retention/Pruning)
    const past14Months = new Date(now);
    past14Months.setMonth(now.getMonth() - 14);

    return {
        T0: now,
        T_MIN_6: past6Months,
        T_MIN_14: past14Months
    };
};

// --- FINANCIAL ARCHETYPES (Factory Pattern) ---
// Memastikan angka finansial masuk akal (Assets > Liabilities untuk Sehat)
export const generateFinancialProfile = (type: 'HEALTHY' | 'RISKY') => {
    const isHealthy = type === 'HEALTHY';

    // Base numbers
    const incomeFixed = isHealthy ? 15_000_000 : 8_000_000;
    const incomeVariable = isHealthy ? 5_000_000 : 1_000_000;
    const monthlyExpense = isHealthy ? 8_000_000 : 9_500_000; // Risky: Besar pasak daripada tiang

    // Assets
    const assetCash = isHealthy ? 100_000_000 : 5_000_000;
    const assetInvestments = isHealthy ? 250_000_000 : 10_000_000;

    // Debts
    const debtConsumptive = isHealthy ? 10_000_000 : 50_000_000; // Risky punya utang konsumtif besar
    const debtProductive = isHealthy ? 150_000_000 : 0;

    // Calculated Totals
    const totalAssets = assetCash + assetInvestments + (isHealthy ? 500_000_000 : 0); // + Aset Rumah jika healthy
    const totalDebt = debtConsumptive + debtProductive;
    const netWorth = totalAssets - totalDebt;
    const surplus = (incomeFixed + incomeVariable) - monthlyExpense;

    // JSON Profile Structure
    const userProfile = {
        riskProfile: isHealthy ? 'MODERATE' : 'AGGRESSIVE',
        financialGoals: ['Dana Pensiun', 'Dana Pendidikan'],
        notes: isHealthy ? 'Kondisi keuangan stabil.' : 'Waspada rasio utang tinggi.'
    };

    // JSON Ratios (Logic Larman: Object analysis)
    const ratiosDetails = {
        savingRatio: isHealthy ? 0.3 : 0.05,
        debtServiceRatio: isHealthy ? 0.15 : 0.45, // > 35% is bad
        liquidityRatio: isHealthy ? 12 : 1, // Bulan bertahan hidup
    };

    return {
        data: {
            incomeFixed,
            incomeVariable,
            expenseLifestyle: monthlyExpense * 0.4,
            expenseFood: monthlyExpense * 0.3,
            expenseTransport: monthlyExpense * 0.1,
            expenseOther: monthlyExpense * 0.2,
            assetCash,
            assetStocks: assetInvestments,
            assetHome: isHealthy ? 500_000_000 : 0,
            debtCC: debtConsumptive,
            debtKPR: debtProductive,
            totalNetWorth: netWorth,
            surplusDeficit: surplus,
            healthScore: isHealthy ? 85 : 45,
            status: isHealthy ? 'SEHAT' : 'BAHAYA',
            userProfile,
            ratiosDetails
        }
    };
};

export const hashPassword = async (password: string) => {
    return await bcrypt.hash(password, PASSWORD_HASH_SALT);
};