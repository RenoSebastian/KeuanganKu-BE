import { PrismaClient, DiscountType, VerificationStatus, VoucherUsageStatus, SubscriptionStatus } from '@prisma/client';
import { VoucherService } from '../src/modules/subscription/services/voucher.service';
import { SubscriptionService } from '../src/modules/subscription/services/subscription.service';
import { AdminSubscriptionService } from '../src/modules/subscription/services/admin-subscription.service';
import { MediaStorageService } from '../src/modules/media/services/media-storage.service';
import { NotificationGateway } from '../src/modules/notification/notification.gateway';
import { NotificationService } from '../src/modules/notification/notification.service';
import { UserQuotaService } from '../src/modules/users/services/user-quota.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { RedisService } from '../src/modules/redis/redis.service';

const prisma = new PrismaClient();

// Mock dependencies for gateway & external services
const mockNotificationGateway = {
    broadcastToAdmins: () => {},
    sendToUser: () => {},
} as unknown as NotificationGateway;

const mockMediaStorageService = {
    uploadFile: async () => ({
        url: 'https://example.com/proof.jpg',
        path: '/tmp/proof.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
    }),
} as unknown as MediaStorageService;

const mockNotificationService = {
    create: async () => {},
    createAndSend: async () => {},
} as unknown as NotificationService;

const mockUserQuotaService = {
    addQuota: async () => {},
} as unknown as UserQuotaService;

const mockAuditService = {
    log: async () => {},
    logAdminAction: async () => {},
    logActivity: async () => {},
} as unknown as AuditService;

const mockRedisService = {
    del: async () => {},
} as unknown as RedisService;

async function runFullVoucherSuite() {
    console.log('\n============================================================');
    console.log('🚀 RUNNING RIGOROUS AUTOMATED VOUCHER SYSTEM TEST SUITE');
    console.log('============================================================\n');

    const voucherService = new VoucherService(prisma as any);
    const subscriptionService = new SubscriptionService(
        prisma as any,
        mockMediaStorageService,
        mockNotificationGateway,
        voucherService
    );
    const adminSubscriptionService = new AdminSubscriptionService(
        prisma as any,
        mockNotificationService,
        mockUserQuotaService,
        mockAuditService,
        mockRedisService,
        mockNotificationGateway
    );

    // Setup Test Entities
    const testAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!testAdmin) throw new Error('Admin user required in database for testing');

    const testPlan = await prisma.subscriptionPlan.findFirst({ where: { code: 'MONTHLY_1' } });
    if (!testPlan) throw new Error('MONTHLY_1 plan required in database for testing');

    // Create 2 unique test users
    const userA = await prisma.user.create({
        data: {
            email: `test_user_a_${Date.now()}@test.com`,
            passwordHash: 'dummy_hash',
            fullName: 'Test User A',
            role: 'USER',
        },
    });

    const userB = await prisma.user.create({
        data: {
            email: `test_user_b_${Date.now()}@test.com`,
            passwordHash: 'dummy_hash',
            fullName: 'Test User B',
            role: 'USER',
        },
    });

    const mockProofFile = {
        buffer: Buffer.from('fake-image-bytes'),
        originalname: 'transfer-proof.jpg',
        mimetype: 'image/jpeg',
        size: 1234,
    } as Express.Multer.File;

    try {
        // -----------------------------------------------------------------
        // TEST 1: Sanitasi & Validasi Input Voucher
        // -----------------------------------------------------------------
        console.log('▶ [TEST 1] Menguji sanitasi & validasi voucher...');

        // 1a. Input huruf kecil dan spasi ("  engine50  ")
        const val1 = await voucherService.validateVoucher(userA.id, '  engine50  ', testPlan.id);
        if (val1.voucher.code !== 'ENGINE50' || val1.discountAmount !== 75000 || val1.finalPrice !== 75000) {
            throw new Error(`Sanitasi huruf kecil & spasi gagal: ${JSON.stringify(val1)}`);
        }
        console.log('   ✅ 1a. Input "  engine50  " otomatis disanitasi menjadi ENGINE50 & diskon 50% akurat.');

        // 1b. Kode tidak terdaftar
        let errorThrown = false;
        try {
            await voucherService.validateVoucher(userA.id, 'KODE_NGASAL', testPlan.id);
        } catch (e: any) {
            errorThrown = true;
            if (!e.message.includes('tidak valid')) throw new Error('Pesan error kode ngasal tidak sesuai');
        }
        if (!errorThrown) throw new Error('Kode tidak valid seharusnya melempar BadRequestException');
        console.log('   ✅ 1b. Kode tidak terdaftar ditolak dengan pesan error yang tepat.');

        // -----------------------------------------------------------------
        // TEST 2: Transaksi Order Berlangganan dengan Voucher (User A)
        // -----------------------------------------------------------------
        console.log('\n▶ [TEST 2] Menguji pembuatan order dengan voucher...');

        const orderResult = await subscriptionService.subscribe(
            userA.id,
            { planId: testPlan.id, uniqueCode: 555, voucherCode: 'engine50' },
            mockProofFile
        );

        const createdOrder = await prisma.subscriptionOrder.findUnique({
            where: { id: orderResult.order.id },
            include: { voucher: true, voucherUsage: true },
        });

        if (!createdOrder) throw new Error('Order tidak tersimpan di DB');
        if (Number(createdOrder.snapshotPrice) !== 75000) {
            throw new Error(`snapshotPrice salah: ${createdOrder.snapshotPrice}, expected 75000`);
        }
        if (Number(createdOrder.discountAmount) !== 75000) {
            throw new Error(`discountAmount salah: ${createdOrder.discountAmount}, expected 75000`);
        }
        if (!createdOrder.voucherId || createdOrder.voucher?.code !== 'ENGINE50') {
            throw new Error(`Relasi voucherId tidak terpasang di order`);
        }

        const usageRecordA = await prisma.voucherUsage.findFirst({
            where: { userId: userA.id, voucherId: createdOrder.voucherId },
        });

        if (!usageRecordA || usageRecordA.status !== VoucherUsageStatus.PENDING) {
            throw new Error(`VoucherUsage record tidak berstatus PENDING`);
        }
        console.log(`   ✅ 2. Order tersimpan: Snapshot Price Rp ${createdOrder.snapshotPrice}, Discount Rp ${createdOrder.discountAmount}, Status Usage PENDING.`);

        // -----------------------------------------------------------------
        // TEST 3: Pencegahan Double Claim (Aturan 1 Akun = 1x Pakai)
        // -----------------------------------------------------------------
        console.log('\n▶ [TEST 3] Menguji pembatasan 1x pakai per akun (Anti-Double Claim)...');

        let doubleClaimBlocked = false;
        try {
            await voucherService.validateVoucher(userA.id, 'ENGINE50', testPlan.id);
        } catch (e: any) {
            if (e.message.includes('sudah pernah Anda gunakan')) {
                doubleClaimBlocked = true;
            }
        }
        if (!doubleClaimBlocked) {
            throw new Error('User A seharusnya tidak bisa memvalidasi voucher ENGINE50 untuk kedua kalinya!');
        }

        let subscribeDoubleBlocked = false;
        try {
            await subscriptionService.subscribe(
                userA.id,
                { planId: testPlan.id, uniqueCode: 123, voucherCode: 'ENGINE50' },
                mockProofFile
            );
        } catch (e: any) {
            if (e.message.includes('sudah pernah Anda gunakan')) {
                subscribeDoubleBlocked = true;
            }
        }
        if (!subscribeDoubleBlocked) {
            throw new Error('User A seharusnya tidak bisa checkout kedua kalinya dengan voucher yang sama!');
        }
        console.log('   ✅ 3. Double claim berhasil diblokir secara mutlak pada validasi dan saat checkout.');

        // -----------------------------------------------------------------
        // TEST 4: Verifikasi Admin VALID -> Status Usage menjadi CONFIRMED
        // -----------------------------------------------------------------
        console.log('\n▶ [TEST 4] Menguji verifikasi admin VALID...');

        await adminSubscriptionService.verifyOrder(testAdmin.id, {
            orderId: createdOrder.id,
            status: VerificationStatus.VALID,
        });

        const verifiedUsageA = await prisma.voucherUsage.findFirst({
            where: { orderId: createdOrder.id },
        });

        if (!verifiedUsageA || verifiedUsageA.status !== VoucherUsageStatus.CONFIRMED) {
            throw new Error(`Status VoucherUsage seharusnya CONFIRMED setelah di-approve admin`);
        }
        console.log('   ✅ 4. Verifikasi VALID sukses: VoucherUsage berubah menjadi CONFIRMED.');

        // -----------------------------------------------------------------
        // TEST 5: Verifikasi Admin INVALID -> Status REVERTED & Rollback Hak User
        // -----------------------------------------------------------------
        console.log('\n▶ [TEST 5] Menguji mekanisme Rollback saat order ditolak Admin (INVALID)...');

        // User B membuat order dengan ENGINE50
        const orderBResult = await subscriptionService.subscribe(
            userB.id,
            { planId: testPlan.id, uniqueCode: 888, voucherCode: 'ENGINE50' },
            mockProofFile
        );

        // Sebelum diverifikasi, voucher terkunci untuk User B
        let blockedBeforeReject = false;
        try {
            await voucherService.validateVoucher(userB.id, 'ENGINE50', testPlan.id);
        } catch (e) {
            blockedBeforeReject = true;
        }
        if (!blockedBeforeReject) throw new Error('Voucher harusnya terkunci sementara order PENDING');

        // Admin REJECT order User B karena bukti transfer salah
        await adminSubscriptionService.verifyOrder(testAdmin.id, {
            orderId: orderBResult.order.id,
            status: VerificationStatus.INVALID,
            adminNotes: 'Bukti transfer tidak valid/palsu',
        });

        const rejectedUsageB = await prisma.voucherUsage.findFirst({
            where: { orderId: orderBResult.order.id },
        });

        if (!rejectedUsageB || rejectedUsageB.status !== VoucherUsageStatus.REVERTED) {
            throw new Error(`Status VoucherUsage seharusnya REVERTED setelah order ditolak admin`);
        }
        console.log('   ✅ 5a. Order ditolak: Status VoucherUsage berhasil diubah ke REVERTED.');

        // Hak User B harus pulih kembali: User B bisa memvalidasi ENGINE50 lagi!
        const recoveryVal = await voucherService.validateVoucher(userB.id, 'ENGINE50', testPlan.id);
        if (!recoveryVal.isValid || recoveryVal.finalPrice !== 75000) {
            throw new Error('Hak voucher User B gagal dipulihkan setelah order ditolak');
        }
        console.log('   ✅ 5b. Hak voucher User B pulih! User B berhasil memvalidasi voucher kembali.');

        // User B berhasil checkout ulang!
        const reorderB = await subscriptionService.subscribe(
            userB.id,
            { planId: testPlan.id, uniqueCode: 999, voucherCode: 'ENGINE50' },
            mockProofFile
        );
        if (Number(reorderB.order.snapshotPrice) !== 75000) {
            throw new Error('Checkout ulang setelah reject gagal mendapatkan diskon');
        }
        console.log('   ✅ 5c. User B berhasil order ulang menggunakan voucher yang sama.');

        // -----------------------------------------------------------------
        // TEST 6: Admin Kill Switch & Management
        // -----------------------------------------------------------------
        console.log('\n▶ [TEST 6] Menguji Kill Switch Admin (Toggle Nonaktif & Aktif)...');

        const engineVoucher = await prisma.voucher.findUniqueOrThrow({ where: { code: 'ENGINE50' } });

        // Toggle Nonaktif
        await voucherService.toggleVoucher(engineVoucher.id);
        let killedBlocked = false;
        try {
            // User baru yang belum pernah pakai
            await voucherService.validateVoucher(testAdmin.id, 'ENGINE50', testPlan.id);
        } catch (e: any) {
            if (e.message.includes('dinonaktifkan')) killedBlocked = true;
        }
        if (!killedBlocked) throw new Error('Kill switch gagal: Voucher nonaktif masih bisa divalidasi');
        console.log('   ✅ 6a. Kill switch sukses: Voucher yang dinonaktifkan langsung ditolak secara realtime.');

        // Toggle Aktif Kembali
        await voucherService.toggleVoucher(engineVoucher.id);
        const restoredVal = await voucherService.validateVoucher(testAdmin.id, 'ENGINE50', testPlan.id);
        if (!restoredVal.isValid) throw new Error('Voucher gagal diaktifkan kembali');
        console.log('   ✅ 6b. Voucher berhasil diaktifkan kembali dan berfungsi normal.');

        console.log('\n============================================================');
        console.log('🏆 SEMUA 6 SKENARIO PENGUJIAN OTOMATIS LULUS SEMPURNA (100%)');
        console.log('============================================================\n');

    } finally {
        // CLEANUP: Bersihkan data uji coba agar database tetap bersih
        console.log('🧹 Membersihkan record dummy uji coba dari database...');
        const userIds = [userA.id, userB.id];
        await prisma.voucherUsage.deleteMany({
            where: { userId: { in: userIds } },
        });
        await prisma.subscriptionPaymentAudit.deleteMany({
            where: { order: { userId: { in: userIds } } },
        });
        await prisma.userSubscription.deleteMany({
            where: { userId: { in: userIds } },
        });
        await prisma.subscriptionOrder.deleteMany({
            where: { userId: { in: userIds } },
        });
        await prisma.userQuotaLedger.deleteMany({
            where: { userId: { in: userIds } },
        });
        await prisma.user.deleteMany({
            where: { id: { in: userIds } },
        });
        console.log('✨ Database kembali bersih.');
        await prisma.$disconnect();
    }
}

runFullVoucherSuite().catch((err) => {
    console.error('\n❌ TEST SUITE FAILED:', err);
    process.exit(1);
});
