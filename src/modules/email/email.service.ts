import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

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
     * Mengeksekusi pengiriman email secara asinkronus.
     * Menerapkan prinsip Fire-and-Forget safety: Exception ditelan (swallowed) dan dicatat, 
     * memastikan caller tidak mengalami unhandled rejection.
     * * @param to Alamat email tujuan (penerima)
     * @param subject Subjek email
     * @param htmlContent Isi email dalam format HTML yang sudah di-render
     * @returns boolean Mengembalikan true jika berhasil dikirim, false jika gagal
     */
    async sendEmail(to: string, subject: string, htmlContent: string): Promise<boolean> {
        // 1. Defensive Programming: Cegah eksekusi I/O TCP jika input tidak valid
        if (!to || !subject || !htmlContent) {
            this.logger.warn(`[ABORTED] Pengiriman dibatalkan. Parameter tidak lengkap. (To: ${!!to})`);
            return false;
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
            // 3. Stabilisasi: Penangkapan error granular tanpa melakukan 'throw' ulang
            // Menggunakan 'any' dan optional chaining untuk keamanan jika tipe error bukan instance dari Error
            const errorMessage = error?.message || 'Unknown SMTP Error';
            const errorCode = error?.code || 'NO_CODE';
            const errorStack = error?.stack || '';

            this.logger.error(
                `[FAILED] Gagal mengirim email ke: ${to} | Code: ${errorCode} | Alasan: ${errorMessage}`,
                errorStack
            );

            // Graceful degradation: Kembalikan boolean false, biarkan proses bisnis utama di Controller tetap berjalan
            return false;
        }
    }

    /**
     * Mengeksekusi pengiriman email massal (Bulk Email) dengan Fault Tolerance.
     * Menggunakan Promise.allSettled untuk mencegah cascading failure pada iterasi.
     * * @param to Array dari alamat email tujuan
     * @param subject Subjek email
     * @param htmlContent Isi email dalam format HTML
     */
    async sendBulkEmail(to: string[], subject: string, htmlContent: string): Promise<void> {
        if (!Array.isArray(to) || to.length === 0) {
            this.logger.warn('[ABORTED] Mencoba mengirim bulk email namun daftar penerima kosong atau tidak valid.');
            return;
        }

        this.logger.debug(`Mempersiapkan pengiriman bulk email ke ${to.length} penerima.`);

        // Eksekusi paralel dengan toleransi kesalahan (satu gagal tidak membatalkan sisa antrean yang lain)
        const promises = to.map(email => this.sendEmail(email, subject, htmlContent));
        const results = await Promise.allSettled(promises);

        const failedCount = results.filter(
            r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value === false)
        ).length;
        const successCount = to.length - failedCount;

        this.logger.log(`[BULK RESULT] Selesai diproses. Berhasil: ${successCount}, Gagal: ${failedCount}`);
    }
}