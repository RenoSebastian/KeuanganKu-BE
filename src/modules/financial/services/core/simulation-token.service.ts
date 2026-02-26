import {
    Injectable,
    Logger,
    BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodeCrypto from 'crypto';

@Injectable()
export class SimulationTokenService {
    private readonly logger = new Logger(SimulationTokenService.name);
    private readonly RETENTION_SECRET: string;

    constructor(private readonly configService: ConfigService) {
        const secretEnv = this.configService.get<string>('RETENTION_SECRET');

        if (!secretEnv) {
            this.logger.warn(
                'WARNING: RETENTION_SECRET is not set in .env. Using unsafe default secret!',
            );
            this.RETENTION_SECRET =
                'DEFAULT_SECRET_DO_NOT_USE_IN_PROD_PLEASE_CHANGE_ME';
        } else {
            this.RETENTION_SECRET = secretEnv;
        }
    }

    /**
     * Membuat Token MGC (Magic Token) yang berisi payload terenkripsi + signature.
     * Format: base64(payload).signature
     */
    generateMgcToken(payload: any): string {
        const jsonString = JSON.stringify(payload);
        const payloadBase64 = Buffer.from(jsonString).toString('base64');
        const signature = this.createHmacSignature(payloadBase64);

        return `${payloadBase64}.${signature}`;
    }

    /**
     * Memverifikasi integritas token dan mengembalikan payload asli.
     * Melempar BadRequestException jika token rusak atau dimanipulasi.
     */
    verifyAndDecodeToken<T = any>(tokenString: string): T {
        const cleanToken = tokenString?.trim();

        if (!cleanToken || !cleanToken.includes('.')) {
            throw new BadRequestException(
                'Format file rusak: Token tidak memiliki struktur yang valid.',
            );
        }

        const [payloadBase64, providedSignature] = cleanToken.split('.');

        if (!payloadBase64 || !providedSignature) {
            throw new BadRequestException(
                'Format file rusak: Payload atau Signature hilang.',
            );
        }

        // Verifikasi Signature (HMAC)
        const expectedSignature = this.createHmacSignature(payloadBase64);

        // Timing safe compare untuk mencegah timing attack
        const signatureBuffer = Buffer.from(providedSignature);
        const expectedBuffer = Buffer.from(expectedSignature);

        const isValid =
            signatureBuffer.length === expectedBuffer.length &&
            nodeCrypto.timingSafeEqual(signatureBuffer, expectedBuffer);

        if (!isValid) {
            this.logger.error(`Import Failed: Signature Mismatch.`);
            throw new BadRequestException(
                'Validasi Gagal: File telah dimodifikasi atau Kunci Server tidak cocok.',
            );
        }

        // Decode Payload
        try {
            const payloadJson = Buffer.from(payloadBase64, 'base64').toString(
                'utf-8',
            );
            return JSON.parse(payloadJson) as T;
        } catch (error: any) {
            this.logger.error(`Import Failed: JSON Parse Error. ${error.message}`);
            throw new BadRequestException(
                'Gagal membaca data: Isi file (Payload) rusak/corrupt.',
            );
        }
    }

    /**
     * Membuat HMAC Signature menggunakan SHA256
     */
    private createHmacSignature(data: string): string {
        return nodeCrypto
            .createHmac('sha256', this.RETENTION_SECRET)
            .update(data)
            .digest('hex');
    }
}