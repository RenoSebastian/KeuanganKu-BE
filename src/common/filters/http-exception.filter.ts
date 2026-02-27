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
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('GlobalFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 1. Tentukan Status Code
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // 2. Ekstraksi Response Asli dari NestJS
    const exceptionRes: any =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal Server Error' };

    // 3. Logika Pembakuan Kode Operasional (SaaS Resilience)
    // Kita memetakan pesan error spesifik ke kode yang dipahami Frontend Interceptor.
    let errorCode = 'ERR_INTERNAL_SERVER';
    const message = typeof exceptionRes === 'string' ? exceptionRes : exceptionRes.message || exceptionRes;

    if (status === HttpStatus.UNAUTHORIZED) {
      errorCode = 'ERR_UNAUTHORIZED';

      // Deteksi Skenario Sesi Digantikan (Last-In Wins impact)
      if (message.includes('Concurrent Login') || message.includes('perangkat lain')) {
        errorCode = 'ERR_SESSION_SUPERSEDED';
      }
      // Deteksi Skenario Sesi expired di Redis
      else if (message.includes('Sesi aktif tidak ditemukan') || message.includes('Sesi telah berakhir')) {
        errorCode = 'ERR_SESSION_EXPIRED';
      }
      // Deteksi Mismatch Device ID (Zero Trust Guard)
      else if (message.includes('Device Mismatch')) {
        errorCode = 'ERR_DEVICE_MISMATCH';
      }
    }
    else if (status === HttpStatus.FORBIDDEN) {
      errorCode = 'ERR_FORBIDDEN';
    }
    else if (status === HttpStatus.TOO_MANY_REQUESTS) {
      errorCode = 'ERR_RATE_LIMIT_EXCEEDED';
    }
    else if (status === HttpStatus.BAD_REQUEST) {
      errorCode = 'ERR_BAD_REQUEST';
    }

    // 4. LOGGING (Winston Integration)
    const stackTrace = exception instanceof Error ? exception.stack : '';
    this.logger.error(
      `${request.method} ${request.url} - Status: ${status} - Code: ${errorCode} - Msg: ${JSON.stringify(message)}`,
      stackTrace,
    );

    // 5. Response Sanitized (Contract for AppMySite / Frontend)
    response.status(status).json({
      success: false,
      statusCode: status,
      errorCode: errorCode, // Field utama untuk interceptor Frontend
      timestamp: new Date().toISOString(),
      path: request.url,
      message: message,
    });
  }
}