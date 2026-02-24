import { PrismaClient } from '@prisma/client';

export const seedSubscriptionPlans = async (prisma: PrismaClient) => {
    console.log('Seeding Subscription Plans...');

    const plans = [
        {
            code: 'MONTHLY_1',
            name: 'Monthly Pro',
            description: 'Akses penuh fitur konsultan selama 1 bulan. Ideal untuk mencoba.',
            durationMonths: 1,
            price: 175000,
            isActive: true,
        },
        {
            code: 'MONTHLY_6',
            name: 'Semi-Annual Pro',
            description: 'Komitmen jangka menengah. Hemat biaya bulanan untuk 6 bulan.',
            durationMonths: 6,
            price: 140000, // Diskon: Seharusnya 354.000 (Hemat ~29rb)
            isActive: true,
        },
        {
            code: 'YEARLY_1',
            name: 'Yearly Expert',
            description: 'Pilihan terbaik untuk profesional. Akses penuh 1 tahun dengan harga terbaik.',
            durationMonths: 12,
            price: 122500, // Diskon: Seharusnya 708.000 (Hemat ~108rb)
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
            console.log(`✅ Created plan: ${plan.name}`);
        } else {
            // Optional: Update price/name if changed in code
            await prisma.subscriptionPlan.update({
                where: { code: plan.code },
                data: {
                    name: plan.name,
                    description: plan.description,
                    durationMonths: plan.durationMonths,
                    price: plan.price,
                },
            });
            console.log(`🔄 Updated plan: ${plan.name}`);
        }
    }

    console.log('Subscription Plans seeding completed.');
};