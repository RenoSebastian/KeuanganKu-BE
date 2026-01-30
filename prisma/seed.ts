import { PrismaClient } from '@prisma/client';
import { seedMasterData } from './seeds/01_master_data';
import { seedUsers } from './seeds/02_users';
import { seedFinancialCheckups } from './seeds/03_financial_checkup';
import { seedBudgetPlans } from './seeds/04_budget_plan';
import { seedEducationPlans } from './seeds/05_education_plan';
import { seedInsurancePlans } from './seeds/06_insurance_plan';
import { seedPensionPlans } from './seeds/07_pension_plan';
import { seedGoalPlans } from './seeds/08_goal_plan';

const prisma = new PrismaClient();

async function main() {
  const startTime = performance.now();
  console.log('🚀 Starting Full Database Seeding...');
  console.log('========================================');

  try {
    // --- LEVEL 1: FOUNDATION ---
    // Master data dan User harus ada duluan agar Foreign Key tidak error.
    await seedMasterData(prisma);
    await seedUsers(prisma);

    // --- LEVEL 2: CORE FINANCIAL & RETENTION ---
    // Modul inti untuk diagnosa kesehatan finansial & budgeting bulanan.
    // Data ini krusial untuk validasi fitur Retention (T-14 bulan).
    await seedFinancialCheckups(prisma);
    await seedBudgetPlans(prisma);

    // --- LEVEL 3: ADVANCED PLANNING MODULES ---
    // Modul kalkulator spesifik (Pendidikan, Asuransi, Pensiun, Goals).
    // Menggunakan user_id yang sama dari Level 1.
    await seedEducationPlans(prisma);
    await seedInsurancePlans(prisma);
    await seedPensionPlans(prisma);
    await seedGoalPlans(prisma);

  } catch (e) {
    console.error('❌ Seeding Failed:', e);
    process.exit(1);
  } finally {
    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('========================================');
    console.log(`✨ Seeding Finished Successfully in ${duration}s`);
    await prisma.$disconnect();
  }
}

main();