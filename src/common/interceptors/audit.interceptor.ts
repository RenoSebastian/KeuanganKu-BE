import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../modules/audit/audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // User didapat dari JWT Guard
    const method = request.method;
    const url = request.url;

    // Filter: Hanya log request yang mengubah data (POST/PATCH/DELETE) atau Login
    // GET request biasa (selain login) seringkali tidak perlu dilog untuk menghemat storage,
    // kecuali GET sensitif yang sudah ditangani manual di Service (seperti Deep Dive Direksi).
    const shouldLog = ['POST', 'PATCH', 'DELETE'].includes(method) || url.includes('login');

    return next.handle().pipe(
      tap(() => {
        // Pastikan ada user dan masuk kriteria logging
        if (user && shouldLog) {
          // Coba ambil Target ID dari params URL (jika ada)
          // Contoh: /director/employees/:id/checkup -> params.id
          const targetUserId = request.params.id || undefined;

          // [FIX] Menggunakan logAccess dengan 1 parameter Object DTO
          // Fire-and-forget: catch error agar tidak memblokir response
          this.auditService.logAccess({
            actorId: user.id,
            targetUserId: targetUserId,
            action: `${method} ${url}`,
            metadata: {
              ip: request.ip,
              userAgent: request.headers['user-agent'],
            },
          }).catch((err) => console.error('Audit Log Error:', err));
        }
      }),
    );
  }
}