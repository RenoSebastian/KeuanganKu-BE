import {
    Injectable,
    ExecutionContext,
    ForbiddenException,
    UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class PasswordResetScopeGuard extends AuthGuard('jwt') {
    /**
     * Mengambil alih proses injeksi user dari JwtStrategy (Standard Passport NestJS).
     * Menerapkan prinsip "Fail-Safe Defaults" dari OWASP.
     */
    handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
        // 1. Validasi eksistensi dan integritas token dasar
        if (err || !user) {
            throw err || new UnauthorizedException('Token pemulihan tidak valid, rusak, atau telah kedaluwarsa.');
        }

        // 2. Validasi Scope (Inti Keamanan)
        // Asumsi: Di auth.service.ts saat OTP divalidasi, payload JWT yang di-sign adalah:
        // { sub: user.id, email: user.email, scope: 'password_reset_only' }
        if (user.scope !== 'password_reset_only') {
            // Melempar Forbidden (403), bukan Unauthorized (401), karena identitas diketahui 
            // namun wewenang token (scope) tidak diizinkan untuk rute ini.
            throw new ForbiddenException(
                'Akses ditolak (Privilege Escalation Blocked): Token otentikasi reguler tidak dapat digunakan untuk mengubah kredensial sistem.'
            );
        }

        // Mengembalikan user agar dapat disuntikkan ke object Request di Controller
        return user;
    }
}