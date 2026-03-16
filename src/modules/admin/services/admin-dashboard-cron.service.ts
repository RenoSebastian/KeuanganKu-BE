import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AdminAnalyticsService } from './admin-analytics.service';
import { RedisService } from '../../redis/redis.service';
import { DashboardMetricsResponseDto } from '../dto/dashboard-metrics-response.dto';

@Injectable()
export class AdminDashboardCronService implements OnModuleInit {
    private readonly logger = new Logger(AdminDashboardCronService.name);

    // Key harus sama persis dengan yang digunakan di AdminDashboardService
    private readonly METRICS_CACHE_KEY = 'admin:dashboard:metrics';

    // Masa kedaluwarsa cache diset lebih lama dari interval Cron (misal: 2 jam)
    // Ini menjamin jika eksekusi Cron berikutnya gagal, data lama masih tersedia sementara waktu.
    private readonly CACHE_TTL_SECONDS = 7200;

    constructor(
        private readonly analyticsService: AdminAnalyticsService,
        private readonly redisService: RedisService,
    ) { }

    /**
     * Cache Warm-up:
     * Menjalankan sinkronisasi pertama kali secara otomatis sesaat setelah 
     * aplikasi Node.js/NestJS selesai melakukan inisialisasi modul (booting).
     */
    async onModuleInit() {
        this.logger.log('Menjalankan Inisialisasi Cache Dashboard Admin (Warm-up)...');
        await this.syncDashboardMetrics();
    }

    /**
     * Menjalankan sinkronisasi metrik secara berkala.
     * Menggunakan CronExpression.EVERY_HOUR (berjalan setiap jam di menit ke-0).
     * Anda dapat mengubahnya menjadi EVERY_30_MINUTES atau EVERY_DAY_AT_MIDNIGHT sesuai kebutuhan analitik.
     */
    @Cron(CronExpression.EVERY_HOUR)
    async handleCron() {
        this.logger.log('Cron Job: Sinkronisasi rutin Dashboard Metrics dimulai...');
        await this.syncDashboardMetrics();
    }

    /**
     * Inti logika sinkronisasi data analitik
     */
    private async syncDashboardMetrics() {
        try {
            const startTime = Date.now();

            // Eksekusi fungsi komputasi berat secara paralel di level database
            const [revenue, users, systemUsage] = await Promise.all([
                this.analyticsService.calculateRevenueMetrics(),
                this.analyticsService.calculateUserMetrics(),
                this.analyticsService.calculateFeatureUtilization()
            ]);

            // Bentuk DTO sesuai kontrak
            const response: DashboardMetricsResponseDto = {
                revenue,
                users,
                systemUsage,
                lastUpdatedAt: new Date()
            };

            // Simpan atau timpa (overwrite) data di Redis
            await this.redisService.set(
                this.METRICS_CACHE_KEY,
                JSON.stringify(response),
                this.CACHE_TTL_SECONDS
            );

            const executionTime = Date.now() - startTime;
            this.logger.log(`[SUCCESS] Sinkronisasi Dashboard Metrics selesai dalam ${executionTime}ms. Cache terbarui.`);

        } catch (error) {
            // Kita wajib menangkap error di sini agar Node.js process tidak crash
            // apabila saat Cron berjalan, koneksi ke PostgreSQL atau Redis sedang terputus sementara.
            this.logger.error(`[FAILED] Gagal menyinkronkan Dashboard Metrics: ${error.message}`, error.stack);
        }
    }
}