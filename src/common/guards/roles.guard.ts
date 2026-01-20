import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Cek apakah route ini butuh role khusus?
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true; // Kalau tidak ada label role, bebas masuk (asal login)
    }

    // 2. Ambil user dari request (yg sudah ditempel oleh JwtStrategy)
    const { user } = context.switchToHttp().getRequest();

    // 3. Cek apakah role user cocok
    return requiredRoles.some((role) => user.role === role);
  }
}