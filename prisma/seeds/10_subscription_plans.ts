import { PrismaClient } from '@prisma/client';

export const seedSubscriptionPlans = async (prisma: PrismaClient) => {
    console.log('Seeding Subscription Plans...');

    // Analisa Data: Harga yang dimasukkan ke DB adalah harga akhir (Net Price) yang akan di-checkout oleh user.
    // Logika harga coret (strikethrough) dan kalkulasi "hemat" akan ditangani secara dinamis di level komponen UI Frontend.
    const plans = [
        {
            code: 'MONTHLY_1',
            name: 'Monthly Plan',
            description: 'Akses penuh fitur kalkulator finansial selama 1 bulan.',
            durationMonths: 1,
            price: 25000,
            isActive: true,
        },
        {
            code: 'MONTHLY_6',
            name: '6-Month Plan',
            description: 'Bayar 4 bulan dapat 6 bulan. Solusi tepat perencanaan menengah.',
            durationMonths: 6,
            price: 99000, // Hemat Rp 51.000 dari normal Rp 150.000
            isActive: true,
        },
        {
            code: 'YEARLY_1',
            name: 'Annual Plan',
            description: 'Bayar 8 bulan dapat 12 bulan. Pilihan paling hemat akses setahun.',
            durationMonths: 12,
            price: 199000, // Hemat Rp 101.000 dari normal Rp 300.000
            isActive: true,
        },
    ];

    for (const plan of plans) {
        const existingPlan = await prisma.subscriptionPlan.findUnique({
            where: { code: plan.code },
        });

        if (!existingPlan) {
            await prisma.subscriptionPlan.create({
                data: {
                    code: plan.code,
                    name: plan.name,
                    description: plan.description,
                    durationMonths: plan.durationMonths,
                    price: plan.price,
                    isActive: plan.isActive,
                },
            });
            console.log(`✅ Created plan: ${plan.name} at Rp ${plan.price}`);
        } else {
            // Melakukan update (upsert manual) agar perubahan harga dan deskripsi baru 
            // langsung terefleksi ketika seeder dijalankan ulang di production
            await prisma.subscriptionPlan.update({
                where: { code: plan.code },
                data: {
                    name: plan.name,
                    description: plan.description,
                    durationMonths: plan.durationMonths,
                    price: plan.price,
                },
            });
            console.log(`🔄 Updated plan: ${plan.name} to Rp ${plan.price}`);
        }
    }

    console.log('Subscription Plans seeding completed.');
};