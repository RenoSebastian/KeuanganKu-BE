import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  // Kita inisialisasi Logger dengan context name 'HTTP'
  // agar di log file terlihat jelas sumbernya: [HTTP]
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // 1. Tangkap Request Masuk
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method, originalUrl, ip } = request;
    const userAgent = request.get('user-agent') || '';

    // Catat waktu mulai
    const now = Date.now();

    // 2. Teruskan ke Handler, lalu 'tap' saat Response kembali
    return next.handle().pipe(
      tap(() => {
        const statusCode = response.statusCode;
        const delay = Date.now() - now; // Hitung durasi proses (ms)

        // 3. Format Log Message
        // Contoh: [GET] /api/users - 200 - 45ms - Mozilla/5.0...
        const message = `${method} ${originalUrl} ${statusCode} ${delay}ms - ${userAgent} ${ip}`;

        // 4. Log sesuai status code
        if (statusCode >= 500) {
          this.logger.error(message);
        } else if (statusCode >= 400) {
          this.logger.warn(message);
        } else {
          this.logger.log(message);
        }
      }),
    );
  }
}