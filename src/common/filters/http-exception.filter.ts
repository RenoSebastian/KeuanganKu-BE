import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  // Logger khusus untuk Filter, agar mudah dicari di log file dengan keyword [GlobalFilter]
  private readonly logger = new Logger('GlobalFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 1. Tentukan Status Code
    // Jika error dari Nest (misal 404/400), pakai statusnya.
    // Jika error code crash (misal TypeError), default ke 500.
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // 2. Tentukan Pesan Error
    const res: any =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal Server Error' };

    const errorMessage = typeof res === 'string' ? res : res.message;
    
    // 3. Ambil Stack Trace (Jejak Error di kodingan)
    // Jika production, mungkin kita tidak ingin log stack trace terlalu detail, 
    // tapi untuk file log internal, ini WAJIB ada.
    const stackTrace = exception instanceof Error ? exception.stack : '';

    // 4. LOGGING KE FILE (Winston)
    // Format: [METHOD] URL - Status - Error Message
    // Parameter ke-2 (stackTrace) akan otomatis disimpan Winston sebagai meta data
    this.logger.error(
      `${request.method} ${request.url} - Status: ${status} - Error: ${JSON.stringify(errorMessage)}`,
      stackTrace,
    );

    // 5. Response ke User (Sanitized)
    // Jangan pernah kirim stack trace ke user (security risk).
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: errorMessage,
    });
  }
}