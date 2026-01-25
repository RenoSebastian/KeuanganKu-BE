// File: src/common/guards/roles.guard.ts

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Ambil Metadata Role dari Handler (Method) atau Class (Controller)
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 2. Jika tidak ada decorator @Roles, berarti route ini PUBLIC (dalam konteks role)
    // Security Note: Tetap butuh JwtAuthGuard jika route ini private.
    if (!requiredRoles) {
      return true;
    }

    // 3. Ambil User dari Request Object
    // Note: User disuntikkan oleh JwtStrategy (request.user)
    const { user } = context.switchToHttp().getRequest();

    // Safety Check: Jika JwtAuthGuard lupa dipasang tapi RolesGuard dipasang
    if (!user) {
      console.error('RolesGuard Error: User not found in request. Did you forget @UseGuards(JwtAuthGuard)?');
      throw new ForbiddenException('User context missing');
    }

    // 4. Validasi Role
    // Cek apakah role user ada di dalam daftar requiredRoles
    const hasRole = requiredRoles.some((role) => user.role === role);

    if (!hasRole) {
      // Optional: Log percobaan akses ilegal
      // console.warn(`Access Denied: User ${user.email} with role ${user.role} tried to access restricted resource.`);
    }

    return hasRole;
  }
}