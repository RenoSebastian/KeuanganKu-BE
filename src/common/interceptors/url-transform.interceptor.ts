import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class UrlTransformInterceptor implements NestInterceptor {
  private readonly baseUrl: string;

  constructor() {
    // Default to localhost:4000 if env variable is missing
    this.baseUrl = process.env.APP_URL || process.env.BACKEND_URL || 'http://localhost:4000';
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => this.transformResponse(data)),
    );
  }

  /**
   * Rekursif untuk mencari dan menyusun ulang URL gambar.
   * Tidak akan mengubah data jika format URL sudah valid absolute.
   */
  private transformResponse(data: any): any {
    // Basic types and null checks
    if (data === null || data === undefined || typeof data !== 'object') {
      return data;
    }

    // Jika Array, looping untuk merubah semua element
    if (Array.isArray(data)) {
      return data.map((item) => this.transformResponse(item));
    }

    // Jika Object, lakukan iterasi key-value
    const transformedObj = { ...data };

    for (const key of Object.keys(transformedObj)) {
      const value = transformedObj[key];

      // Pengecekan Khusus Target Object Keys (bisa diperluas)
      if (typeof value === 'string' && value.startsWith('/uploads/')) {
        // [RESOLUSI] Apabila menemukan relative URL statis, prefix dengan BASE_URL
        transformedObj[key] = `${this.baseUrl}${value}`;
      } else if (typeof value === 'object') {
        // Recursion untuk nested objects (contoh: order.user.avatarUrl)
        transformedObj[key] = this.transformResponse(value);
      }
    }

    return transformedObj;
  }
}
