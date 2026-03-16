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
  constructor(private readonly auditService: AuditService) { }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // User didapat dari JWT Guard
    const method = request.method;
    const url = request.url;

    // Filter: Hanya log request yang mengubah data (POST/PATCH/DELETE/PUT) atau aksi Login
    const shouldLog = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method) || url.includes('login');

    return next.handle().pipe(
      tap(() => {
        if (user && shouldLog) {
          // Tangkap Target ID dari params URL jika tersedia
          const targetUserId = request.params.id || undefined;

          // [PHASE 2: ENHANCEMENT] Ekstraksi Payload untuk ketelitian rekam jejak
          // Clone body agar manipulasi sanitasi tidak mengubah actual request object
          const payload = request.body ? { ...request.body } : {};

          // Sanitasi Data Sensitif (Zero-Trust)
          if (payload.password) payload.password = '***MASKED***';
          if (payload.oldPassword) payload.oldPassword = '***MASKED***';
          if (payload.refreshToken) payload.refreshToken = '***MASKED***';

          // Eksekusi asinkron secara aman (Fire and Forget)
          this.auditService.logAccess({
            actorId: user.id,
            targetUserId: targetUserId,
            action: `${method} ${url}`,
            metadata: {
              ip: request.ip,
              userAgent: request.headers['user-agent'],
              payload: payload, // Detail yang krusial untuk investigasi forensik
            },
          }).catch((err) => console.error('Audit Interceptor Error:', err));
        }
      }),
    );
  }
}