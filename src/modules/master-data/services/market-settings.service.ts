import {
    Injectable,
    Logger,
    OnModuleInit,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { Prisma } from '@prisma/client';

// Interface sederhana untuk Update Payload
// (Jika Anda sudah membuat file terpisah di ./dto/update-market-settings.dto.ts, 
// Anda bisa menghapus interface ini dan meng-import dari sana)
export interface UpdateMarketSettingsDto {
    inflationRate?: number;
    interestRate?: number;
    riskFreeRate?: number;
    goldPrice?: number;
}

@Injectable()
export class MarketSettingsService implements OnModuleInit {
    private readonly logger = new Logger(MarketSettingsService.name);

    // In-Memory Cache sederhana untuk mengurangi beban DB saat trafik tinggi
    private cachedSettings: any = null;
    private lastFetchTime = 0;
    private readonly CACHE_TTL = 60 * 1000; // 1 Menit Cache

    constructor(
        private readonly prisma: PrismaService,
        private readonly auditService: AuditService,
    ) { }

    /**
     * Saat module di-load, pastikan data settings sudah ada di DB.
     * Jika belum (fresh deploy), buat data default.
     */
    async onModuleInit() {
        await this.ensureSettingsExist();
    }

    /**
     * [PUBLIC] Get Current Market Rates
     * Digunakan oleh FinancialService untuk kalkulasi dan MasterDataController.
     * [FIX] Nama fungsi diubah menjadi getSettings agar sesuai dengan Controller.
     */
    async getSettings() {
        const now = Date.now();

        // Jika cache masih valid, return cache
        if (this.cachedSettings && now - this.lastFetchTime < this.CACHE_TTL) {
            return this.cachedSettings;
        }

        // Jika expired, fetch dari DB
        const settings = await this.prisma.globalMarketSettings.findFirst();

        if (!settings) {
            // Safety net: Harusnya tidak terjadi karena onModuleInit
            return this.ensureSettingsExist();
        }

        // Update Cache
        this.cachedSettings = settings;
        this.lastFetchTime = now;

        return settings;
    }

    /**
     * [ADMIN] Update Market Rates ("Kebijakan Moneter")
     * Admin mengubah suku bunga/inflasi. Aksi ini SANGAT SENSITIF.
     * Wajib dicatat di AdminActivityLog.
     */
    async updateSettings(adminId: string, payload: UpdateMarketSettingsDto) {
        try {
            // 1. Ambil data lama untuk Snapshot Audit
            // [FIX] Menggunakan pemanggilan fungsi yang sudah di-rename
            const currentSettings = await this.getSettings();

            // 2. Validasi Angka (Simple Sanity Check)
            this.validateRates(payload);

            // 3. Update Database (Singleton Update)
            // Kita asumsikan hanya ada 1 row, jadi update row pertama yang ditemukan
            const updatedSettings = await this.prisma.globalMarketSettings.update({
                where: { id: currentSettings.id },
                data: {
                    ...payload,
                    updatedBy: adminId,
                    updatedAt: new Date(),
                },
            });

            // 4. Invalidate Cache agar user langsung dapat data baru
            this.cachedSettings = null;

            // 5. Log Audit Activity (Critical)
            await this.auditService.logAdminAction({
                adminId: adminId,
                action: 'UPDATE_MARKET_SETTINGS',
                targetUserId: 'SYSTEM', // Targetnya adalah sistem, bukan user spesifik
                details: {
                    before: {
                        inflation: Number(currentSettings.inflationRate),
                        interest: Number(currentSettings.interestRate),
                        gold: Number(currentSettings.goldPrice),
                    },
                    after: payload,
                    reason: 'Adjustment by Central Admin',
                },
            }).catch(e => this.logger.warn(`Audit log failed: ${e.message}`)); // Safety catch

            this.logger.log(`Market settings updated by Admin ${adminId}`);
            return updatedSettings;

        } catch (error: any) {
            this.logger.error(`Failed to update market settings: ${error.message}`);
            // Forward BadRequestException jika itu dari validateRates
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Gagal menyimpan konfigurasi pasar.');
        }
    }

    /**
     * [INTERNAL] Ensure Default Settings
     * Memastikan tabel tidak kosong saat aplikasi start.
     */
    private async ensureSettingsExist() {
        const existing = await this.prisma.globalMarketSettings.findFirst();
        if (existing) {
            this.cachedSettings = existing;
            return existing;
        }

        this.logger.warn('Global Market Settings not found. Seeding default values...');

        // Default Values (Hardcoded Safety Net)
        return this.prisma.globalMarketSettings.create({
            data: {
                inflationRate: 5.0,      // 5%
                interestRate: 4.5,       // BI Rate
                riskFreeRate: 6.0,       // Obligasi
                goldPrice: 1350000,      // Harga Emas/gram
                updatedBy: 'SYSTEM_INIT',
            },
        });
    }

    /**
     * Helper: Validasi Logika Bisnis
     */
    private validateRates(payload: UpdateMarketSettingsDto) {
        if (payload.inflationRate !== undefined && (payload.inflationRate < 0 || payload.inflationRate > 100)) {
            throw new BadRequestException('Tingkat inflasi harus antara 0 - 100%');
        }
        if (payload.interestRate !== undefined && (payload.interestRate < 0 || payload.interestRate > 50)) {
            throw new BadRequestException('Suku bunga tidak wajar (> 50% atau negatif)');
        }
        if (payload.goldPrice !== undefined && payload.goldPrice <= 0) {
            throw new BadRequestException('Harga emas harus positif');
        }
    }
}