import { PrismaClient, EducationModuleStatus, QuizQuestionType } from '@prisma/client';
import { seedGlobalSettings } from './seeds/01_global_settings';
import { seedUsers } from './seeds/02_users';
// import { seedMasterData } from './seeds/01_master_data';
// import { seedUsers } from './seeds/02_users';
// import { seedFinancialCheckups } from './seeds/03_financial_checkup';
// import { seedBudgetPlans } from './seeds/04_budget_plan';
// import { seedEducationPlans } from './seeds/05_education_plan';
// import { seedInsurancePlans } from './seeds/06_insurance_plan';
// import { seedPensionPlans } from './seeds/07_pension_plan';
// import { seedGoalPlans } from './seeds/08_goal_plan';
// import { educationModulesSeed } from './seeds/09_education_modules';
import { seedSubscriptionPlans } from './seeds/10_subscription_plans';

const prisma = new PrismaClient();

async function main() {
  const startTime = performance.now();
  console.log('🚀 Starting Full Database Seeding...');
  console.log('========================================');

  try {
    // --- LEVEL 1: FOUNDATION ---
    console.log('\n[1/4] 🌱 Seeding Foundation (Master Data & Users)...');
    // await seedMasterData(prisma);
    await seedSubscriptionPlans(prisma);
    // await seedUsers(prisma);
    await seedGlobalSettings(prisma);
    await seedUsers(prisma);

    // --- LEVEL 2: CORE FINANCIAL ---
    console.log('\n[2/4] 💸 Seeding Core Financials...');
    // await seedFinancialCheckups(prisma);
    // await seedBudgetPlans(prisma);

    // --- LEVEL 3: ADVANCED PLANNING ---
    console.log('\n[3/4] 📈 Seeding Advanced Calculators...');
    // await seedEducationPlans(prisma);
    // await seedInsurancePlans(prisma);
    // await seedPensionPlans(prisma);
    // await seedGoalPlans(prisma);

    // --- LEVEL 4: LEARNING CENTER (SINKRON DENGAN SCHEMA) ---
    console.log('\n[4/4] 📚 Seeding Learning Modules & Quizzes...');

    // for (const moduleData of educationModulesSeed) {
    //   const {
    //     sections,
    //     quiz,
    //     categorySlug,
    //     coverImage,
    //     durationMinutes,
    //     order, // Diekstrak agar tidak masuk ke spread ...moduleProps
    //     ...moduleProps
    //   } = moduleData;

    //   // 1. Pastikan Kategori Eksis
    //   const category = await prisma.educationCategory.findUnique({
    //     where: { slug: categorySlug }
    //   });

    //   if (!category) {
    //     console.warn(`   ⚠️  Category ${categorySlug} not found. Creating fallback...`);
    //     await prisma.educationCategory.create({
    //       data: {
    //         name: categorySlug.replace('-', ' ').toUpperCase(),
    //         slug: categorySlug,
    //         displayOrder: 99,
    //         iconUrl: 'https://cdn-icons-png.flaticon.com/512/3330/3330314.png'
    //       }
    //     });
    //   }

    //   // 2. Bersihkan data lama (Idempotency)
    //   await prisma.educationModule.deleteMany({
    //     where: { slug: moduleProps.slug },
    //   });

    //   // 3. Buat Modul Baru
    //   await prisma.educationModule.create({
    //     data: {
    //       ...moduleProps,
    //       thumbnailUrl: coverImage,
    //       readingTime: durationMinutes,
    //       // CATATAN: 'order' tidak dimasukkan karena tidak ada di schema EducationModule Anda
    //       category: {
    //         connect: { slug: categorySlug }
    //       },
    //       sections: {
    //         create: sections.map((sec) => ({
    //           title: sec.title,
    //           contentMarkdown: sec.content,
    //           sectionOrder: sec.order,
    //         })),
    //       },
    //       quiz: {
    //         create: {
    //           description: quiz.description,
    //           timeLimit: quiz.timeLimit,
    //           passingScore: quiz.passingScore,
    //           maxAttempts: quiz.maxAttempts,
    //           questions: {
    //             create: quiz.questions.map((q) => ({
    //               questionText: q.questionText,
    //               type: q.type,
    //               orderIndex: q.orderIndex,
    //               explanation: q.explanation,
    //               options: {
    //                 create: q.options.map((opt) => ({
    //                   optionText: opt.optionText,
    //                   isCorrect: opt.isCorrect,
    //                 })),
    //               },
    //             })),
    //           },
    //         },
    //       },
    //     },
    //   });
    //   console.log(`   ✅ Created Module: ${moduleProps.title}`);
    // }

  } catch (e) {
    console.error('\n❌ Seeding Failed:', e);
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