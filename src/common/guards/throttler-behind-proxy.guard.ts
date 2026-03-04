import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler'; // [UPDATE] Import Type Detail
import { ExecutionContext } from '@nestjs/common';

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
    protected async getTracker(req: Record<string, any>): Promise<string> {
        // Logic untuk menangani IP di belakang Proxy/Load Balancer
        if (req.headers && req.headers['x-forwarded-for']) {
            const xForwardedFor = req.headers['x-forwarded-for'];
            if (Array.isArray(xForwardedFor)) {
                return xForwardedFor[0];
            }
            return xForwardedFor.split(',')[0].trim();
        }

        // Fallback ke IP koneksi langsung
        return req.ip;
    }

    // [FIX] Perbaiki Signature: Tambahkan parameter 'throttlerLimitDetail'
    protected async throwThrottlingException(
        context: ExecutionContext,
        throttlerLimitDetail: ThrottlerLimitDetail
    ): Promise<void> {
        // Kita biarkan default, tapi teruskan kedua parameter ke super
        await super.throwThrottlingException(context, throttlerLimitDetail);
    }
}