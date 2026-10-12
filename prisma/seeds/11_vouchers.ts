import { PrismaClient, DiscountType } from '@prisma/client';

export const seedVouchers = async (prisma: PrismaClient) => {
    console.log('Seeding Vouchers...');

    const initialVouchers = [
        {
            code: 'ENGINE50',
            name: 'Diskon Spesial 50% Komunitas Engine',
            discountType: DiscountType.PERCENTAGE,
            discountValue: 50,
            isActive: true,
        },
        {
            code: 'HEMAT50RB',
            name: 'Potongan Langsung Rp 50.000',
            discountType: DiscountType.FIXED_AMOUNT,
            discountValue: 50000,
            isActive: true,
        },
    ];

    for (const voucher of initialVouchers) {
        const existing = await prisma.voucher.findUnique({
            where: { code: voucher.code },
        });

        if (!existing) {
            await prisma.voucher.create({
                data: voucher,
            });
            console.log(`✅ Created voucher: ${voucher.code} (${voucher.name})`);
        } else {
            await prisma.voucher.update({
                where: { code: voucher.code },
                data: voucher,
            });
            console.log(`ℹ️ Updated voucher: ${voucher.code}`);
        }
    }

    console.log('Vouchers seeding completed.');
};
