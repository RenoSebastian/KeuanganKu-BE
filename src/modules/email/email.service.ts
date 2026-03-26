import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

// Mengimpor fungsi murni (Pure Function) untuk rendering template
import { getPasswordResetOtpTemplate } from './templates/password-reset.template';
// [NEW] Impor template Magic Link yang baru kita buat
import { getMagicLinkTemplate } from './templates/magic-link.template';

/**
 * EmailService
 * Pattern: Pure Fabrication & Indirection (GRASP)
 * Bertindak sebagai perantara (wrapper) antara business logic aplikasi 
 * dengan kompleksitas library pihak ketiga (@nestjs-modules/mailer / Nodemailer).
 */
@Injectable()
export class EmailService {
    // Inisialisasi logger standar NestJS untuk pelacakan I/O asynchronous
    private readonly logger = new Logger(EmailService.name);

    // Dependency Injection untuk MailerService
    constructor(private readonly mailerService: MailerService) { }

    /**
     * [NEW] ALUR FORGOT PASSWORD (MAGIC LINK)
     * Pattern: Information Expert
     * @param to Alamat email tujuan
     * @param userName Nama pengguna untuk personalisasi sapaan
     * @param magicLink Tautan utuh yang berisi Secure Token
     * @param ttlMinutes Batas waktu kedaluwarsa (default 15 menit)
     */
    async sendMagicLinkReset(to: string, userName: string, magicLink: string, ttlMinutes: number = 15): Promise<boolean> {
        this.logger.debug(`Memulai perakitan template Magic Link untuk: ${to}`);

        const htmlContent = getMagicLinkTemplate(userName, magicLink, ttlMinutes);
        const subject = 'Aksi Diperlukan: Atur Ulang Kata Sandi - KeuanganKu';

        return this.sendEmail(to, subject, htmlContent);
    }

    /**
     * [LEGACY] ALUR FORGOT PASSWORD (OTP)
     * Dipertahankan untuk backward compatibility jika klien lama masih menggunakan alur OTP manual.
     */
    async sendPasswordResetOTP(to: string, userName: string, otpCode: string, ttlMinutes: number = 5): Promise<boolean> {
        this.logger.debug(`Memulai perakitan template OTP Reset Password untuk: ${to}`);
        const htmlContent = getPasswordResetOtpTemplate(userName, otpCode, ttlMinutes);
        const subject = 'Kode Pemulihan Kata Sandi - KeuanganKu';

        return this.sendEmail(to, subject, htmlContent);
    }

    /**
     * Mengeksekusi pengiriman email secara asinkronus.
     * [REFACTORED] Menerapkan pola Fail-Fast. Exception dilempar secara eksplisit 
     * agar Controller dapat membatalkan transaksi dan merespon dengan status HTTP yang tepat (503/400).
     */
    async sendEmail(to: string, subject: string, htmlContent: string): Promise<boolean> {
        // 1. Defensive Programming: Cegah eksekusi I/O TCP jika input tidak valid
        if (!to || !subject || !htmlContent) {
            this.logger.warn(`[ABORTED] Pengiriman dibatalkan. Parameter tidak lengkap. (To: ${!!to})`);
            throw new ServiceUnavailableException('Parameter pengiriman email tidak lengkap atau tidak valid.');
        }

        this.logger.debug(`Mempersiapkan pengiriman email ke: ${to} dengan subjek: "${subject}"`);

        try {
            // 2. Eksekusi komunikasi jaringan ke server SMTP
            await this.mailerService.sendMail({
                to: to,
                subject: subject,
                html: htmlContent,
            });

            this.logger.log(`[SUCCESS] Email berhasil dikirimkan ke: ${to}`);
            return true;

        } catch (error: any) {
            // 3. Stabilisasi Log: Penangkapan error granular
            const errorMessage = error?.message || 'Unknown SMTP Error';
            const errorCode = error?.code || 'NO_CODE';
            const errorStack = error?.stack || '';

            this.logger.error(
                `[FAILED] Gagal mengirim email ke: ${to} | Code: ${errorCode} | Alasan: ${errorMessage}`,
                errorStack
            );

            // [REFACTORED] Melemparkan HttpException secara eksplisit untuk mencegah Silent Failure
            throw new ServiceUnavailableException(
                `Gagal berkomunikasi dengan server email (${errorCode}). Silakan coba beberapa saat lagi.`
            );
        }
    }

    /**
     * Mengeksekusi pengiriman email massal (Bulk Email) dengan Fault Tolerance.
     * Menggunakan Promise.allSettled untuk mencegah cascading failure pada iterasi.
     */
    async sendBulkEmail(to: string[], subject: string, htmlContent: string): Promise<void> {
        if (!Array.isArray(to) || to.length === 0) {
            this.logger.warn('[ABORTED] Mencoba mengirim bulk email namun daftar penerima kosong atau tidak valid.');
            return;
        }

        this.logger.debug(`Mempersiapkan pengiriman bulk email ke ${to.length} penerima.`);

        // Menangkap exception individual agar kegagalan satu email tidak membatalkan batch lainnya
        const promises = to.map(email =>
            this.sendEmail(email, subject, htmlContent)
                .catch(err => {
                    this.logger.warn(`Bulk send fail untuk ${email}: ${err.message}`);
                    return false;
                })
        );

        const results = await Promise.allSettled(promises);

        const failedCount = results.filter(
            r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value === false)
        ).length;
        const successCount = to.length - failedCount;

        this.logger.log(`[BULK RESULT] Selesai diproses. Berhasil: ${successCount}, Gagal: ${failedCount}`);
    }
}