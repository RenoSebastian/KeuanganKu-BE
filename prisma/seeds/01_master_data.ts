// import { PrismaClient } from '@prisma/client';

// export const seedMasterData = async (prisma: PrismaClient) => {
//     console.log('🌱 Seeding 01_master_data...');

//     // Menggunakan Transaction untuk atomicity pada Unit Kerja
//     await prisma.$transaction(async (tx) => {
//         const units = [
//             { kode: 'IT-01', nama: 'Divisi Teknologi Informasi' },
//             { kode: 'FIN-01', nama: 'Divisi Keuangan & Akuntansi' },
//             { kode: 'HR-01', nama: 'Divisi SDM & Umum' },
//             { kode: 'BOD-01', nama: 'Direksi' },
//         ];

//         for (const unit of units) {
//             await tx.unitKerja.upsert({
//                 where: { kodeUnit: unit.kode },
//                 update: { namaUnit: unit.nama },
//                 create: {
//                     kodeUnit: unit.kode,
//                     namaUnit: unit.nama,
//                 },
//             });
//         }
//     });

//     // 2. SEED EDUCATION CATEGORIES 
//     // [FIXED] Menghapus properti 'description' karena tidak ada di schema.prisma
//     const educationCategories = [
//         {
//             name: 'Perencanaan Dasar',
//             slug: 'perencanaan-dasar',
//             displayOrder: 1,
//             iconUrl: 'https://cdn-icons-png.flaticon.com/512/2617/2617304.png',
//         },
//         {
//             name: 'Analisis Keuangan',
//             slug: 'analisis-keuangan',
//             displayOrder: 2,
//             iconUrl: 'https://cdn-icons-png.flaticon.com/512/1570/1570998.png',
//         },
//         {
//             name: 'Tujuan Keuangan',
//             slug: 'tujuan-keuangan',
//             displayOrder: 3,
//             iconUrl: 'https://cdn-icons-png.flaticon.com/512/2850/2850343.png',
//         },
//     ];

//     for (const cat of educationCategories) {
//         await prisma.educationCategory.upsert({
//             where: { slug: cat.slug },
//             update: {
//                 name: cat.name,
//                 displayOrder: cat.displayOrder,
//                 iconUrl: cat.iconUrl,
//             },
//             create: {
//                 name: cat.name,
//                 slug: cat.slug,
//                 displayOrder: cat.displayOrder,
//                 iconUrl: cat.iconUrl,
//             },
//         });
//     }

//     console.log('✅ Master Data & Education Categories Seeded.');
// };