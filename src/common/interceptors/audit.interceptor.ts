import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../modules/audit/audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Didapat dari JWT
    const method = request.method;
    const url = request.url;

    // Kita hanya log request yang mengubah data (POST/PATCH/DELETE) atau Login
    // Agar database log tidak penuh sampah GET request biasa
    const shouldLog = ['POST', 'PATCH', 'DELETE'].includes(method) || url.includes('login');

    return next.handle().pipe(
      tap(() => {
        if (user && shouldLog) {
          // Fire and forget (jangan tunggu log selesai agar user tidak loading lama)
          this.auditService.logActivity(
            user.id,
            `${method} ${url}`,
            { ip: request.ip, userAgent: request.headers['user-agent'] }
          ).catch(err => console.error('Audit Log Error:', err));
        }
      }),
    );
  }
}