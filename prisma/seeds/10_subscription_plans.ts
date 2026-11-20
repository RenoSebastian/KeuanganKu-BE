import { PrismaClient, SubscriptionTier } from '@prisma/client';

export const seedSubscriptionPlans = async (prisma: PrismaClient) => {
    console.log('Seeding Subscription Plans (3-Tier Architecture)...');

    // 1. Nonaktifkan paket legacy tanpa menghapusnya agar Foreign Key history & subscriber lama tetap utuh
    const legacyCodes = ['MONTHLY_1', 'MONTHLY_6', 'YEARLY_1'];
    await prisma.subscriptionPlan.updateMany({
        where: { code: { in: legacyCodes } },
        data: {
            isActive: false,
            tier: SubscriptionTier.GOLD, // User legacy aktif tetap mendapat akses penuh (Gold) sampai habis masa aktif
        },
    });

    // 2. Paket Aktif Baru (Feature-Gated Tiering, Unlimited Usage)
    // Catatan: Tier BRONZE adalah paket gratis bawaan (default) bagi semua user tanpa perlu order.
    const plans = [
        {
            code: 'SILVER_MONTHLY',
            name: 'Silver',
            tier: SubscriptionTier.SILVER,
            description: 'Paket lengkap untuk memahami kondisi keuangan, merencanakan masa depan, dan mencapai tujuan finansial Anda.',
            durationMonths: 1,
            price: 29000,
            bonusQuota: 0,
            isActive: true,
        },
        {
            code: 'GOLD_MONTHLY',
            name: 'Gold',
            tier: SubscriptionTier.GOLD,
            description: 'Solusi menyeluruh untuk perencanaan keuangan jangka panjang yang lebih aman, terarah, dan berkelanjutan.',
            durationMonths: 1,
            price: 49000,
            bonusQuota: 0,
            isActive: true,
        },
    ];

    for (const plan of plans) {
        await prisma.subscriptionPlan.upsert({
            where: { code: plan.code },
            update: {
                name: plan.name,
                tier: plan.tier,
                description: plan.description,
                durationMonths: plan.durationMonths,
                price: plan.price,
                bonusQuota: plan.bonusQuota,
                isActive: plan.isActive,
            },
            create: {
                code: plan.code,
                name: plan.name,
                tier: plan.tier,
                description: plan.description,
                durationMonths: plan.durationMonths,
                price: plan.price,
                bonusQuota: plan.bonusQuota,
                isActive: plan.isActive,
            },
        });
        console.log(`✅ Synced plan: ${plan.name} (${plan.tier}) at Rp ${plan.price}/bulan`);
    }

    console.log('Subscription Plans seeding completed.');
};
