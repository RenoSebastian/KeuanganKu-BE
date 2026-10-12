import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { DiscountType, VoucherUsageStatus } from '@prisma/client';
import { CreateVoucherDto, UpdateVoucherDto } from '../dto/create-voucher.dto';

@Injectable()
export class VoucherService {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Memvalidasi kode voucher untuk user dan paket tertentu
     */
    async validateVoucher(userId: string, rawCode: string, planId: string) {
        if (!rawCode || !rawCode.trim()) {
            throw new BadRequestException('Kode voucher wajib diisi');
        }

        const code = rawCode.trim().toUpperCase();

        // 1. Ambil Voucher
        const voucher = await this.prisma.voucher.findUnique({
            where: { code },
        });

        if (!voucher || !voucher.isActive) {
            throw new BadRequestException('Kode voucher tidak valid atau sudah dinonaktifkan');
        }

        // 2. Cek apakah user sudah pernah menggunakan voucher ini (1x per akun)
        const existingUsage = await this.prisma.voucherUsage.findFirst({
            where: {
                voucherId: voucher.id,
                userId,
                status: {
                    in: [VoucherUsageStatus.PENDING, VoucherUsageStatus.CONFIRMED],
                },
            },
        });

        if (existingUsage) {
            throw new BadRequestException(
                'Kode voucher ini sudah pernah Anda gunakan sebelumnya',
            );
        }

        // 3. Ambil Plan untuk kalkulasi harga
        const plan = await this.prisma.subscriptionPlan.findUnique({
            where: { id: planId },
        });

        if (!plan || !plan.isActive) {
            throw new NotFoundException('Paket langganan tidak ditemukan atau tidak aktif');
        }

        const basePrice = Number(plan.price);

        // 4. Cek minimal transaksi jika diset
        if (voucher.minPurchaseAmount && basePrice < Number(voucher.minPurchaseAmount)) {
            throw new BadRequestException(
                `Minimal pembelian untuk voucher ini adalah Rp ${Number(voucher.minPurchaseAmount).toLocaleString('id-ID')}`,
            );
        }

        // 5. Hitung Nilai Diskon
        let discountAmount = 0;
        if (voucher.discountType === DiscountType.PERCENTAGE) {
            discountAmount = (basePrice * Number(voucher.discountValue)) / 100;
            if (voucher.maxDiscountAmount && discountAmount > Number(voucher.maxDiscountAmount)) {
                discountAmount = Number(voucher.maxDiscountAmount);
            }
        } else if (voucher.discountType === DiscountType.FIXED_AMOUNT) {
            discountAmount = Math.min(basePrice, Number(voucher.discountValue));
        }

        // Pembulatan integer rupiah
        discountAmount = Math.round(discountAmount);
        const finalPrice = Math.max(0, basePrice - discountAmount);

        return {
            isValid: true,
            voucher: {
                id: voucher.id,
                code: voucher.code,
                name: voucher.name,
                discountType: voucher.discountType,
                discountValue: Number(voucher.discountValue),
            },
            originalPrice: basePrice,
            discountAmount,
            finalPrice,
        };
    }

    // ==========================================
    // ADMIN OPERATIONS
    // ==========================================

    async getAllVouchers() {
        const vouchers = await this.prisma.voucher.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: {
                        usages: true,
                        orders: true,
                    },
                },
            },
        });

        return JSON.parse(JSON.stringify(vouchers));
    }

    async createVoucher(dto: CreateVoucherDto) {
        const code = dto.code.trim().toUpperCase();

        const existing = await this.prisma.voucher.findUnique({
            where: { code },
        });

        if (existing) {
            throw new BadRequestException(`Kode voucher ${code} sudah terdaftar`);
        }

        const voucher = await this.prisma.voucher.create({
            data: {
                code,
                name: dto.name,
                discountType: dto.discountType,
                discountValue: dto.discountValue,
                maxDiscountAmount: dto.maxDiscountAmount ?? null,
                minPurchaseAmount: dto.minPurchaseAmount ?? null,
                isActive: dto.isActive ?? true,
            },
        });

        return JSON.parse(JSON.stringify(voucher));
    }

    async updateVoucher(id: string, dto: UpdateVoucherDto) {
        const voucher = await this.prisma.voucher.findUnique({
            where: { id },
        });

        if (!voucher) {
            throw new NotFoundException('Voucher tidak ditemukan');
        }

        const dataToUpdate: any = { ...dto };
        if (dto.code) {
            dataToUpdate.code = dto.code.trim().toUpperCase();
        }

        const updated = await this.prisma.voucher.update({
            where: { id },
            data: dataToUpdate,
        });

        return JSON.parse(JSON.stringify(updated));
    }

    async toggleVoucher(id: string) {
        const voucher = await this.prisma.voucher.findUnique({
            where: { id },
        });

        if (!voucher) {
            throw new NotFoundException('Voucher tidak ditemukan');
        }

        const updated = await this.prisma.voucher.update({
            where: { id },
            data: { isActive: !voucher.isActive },
        });

        return JSON.parse(JSON.stringify(updated));
    }

    async deleteVoucher(id: string) {
        const voucher = await this.prisma.voucher.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { usages: true, orders: true },
                },
            },
        });

        if (!voucher) {
            throw new NotFoundException('Voucher tidak ditemukan');
        }

        // Jika sudah ada riwayat transaksi, nonaktifkan saja untuk integritas audit
        if (voucher._count.usages > 0 || voucher._count.orders > 0) {
            await this.prisma.voucher.update({
                where: { id },
                data: { isActive: false },
            });
            return { message: 'Voucher dinonaktifkan karena telah memiliki riwayat penggunaan' };
        }

        await this.prisma.voucher.delete({
            where: { id },
        });

        return { message: 'Voucher berhasil dihapus secara permanen' };
    }
}
