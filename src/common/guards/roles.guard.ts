import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client'; // Import Enum
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

    // 2. Jika tidak ada decorator @Roles, berarti route ini PUBLIC (tergantung JwtAuthGuard)
    if (!requiredRoles) {
      return true;
    }

    // 3. Ambil User dari Request Object
    // Note: User object ini disuntikkan oleh JwtStrategy saat validasi token sukses
    const { user } = context.switchToHttp().getRequest();

    // 4. Validasi Role
    // Pastikan user memiliki salah satu dari role yang diizinkan
    // Menggunakan Enum Comparison (Strict)
    return requiredRoles.some((role) => user.role === role);
  }
}