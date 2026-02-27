import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    // 1. Ambil Metadata Role dari Handler (Method) atau Class (Controller)
    // getAllAndOverride memungkinkan role di Method menimpa role di Controller
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 2. Jika tidak ada decorator @Roles, berarti route ini PUBLIC (dalam konteks role)
    if (!requiredRoles) {
      return true;
    }

    // 3. Ambil User dari Request Object (disuntikkan oleh JwtStrategy)
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Safety Check: Jika JwtAuthGuard lupa dipasang atau token invalid
    if (!user) {
      this.logger.error(
        'RolesGuard Error: No user found in request. Ensure @UseGuards(JwtAuthGuard) is placed before RolesGuard.',
      );
      throw new UnauthorizedException(
        'Sesi tidak valid atau Anda belum login.',
      );
    }

    // 4. Validasi Role (Strict Check)
    const hasRole = requiredRoles.some((role) => user.role === role);

    if (!hasRole) {
      // Audit Log: Mencatat percobaan akses ilegal
      this.logger.warn(
        `Access Denied: User ID ${user.id} (Role: ${user.role}) attempted to access resource requiring [${requiredRoles.join(', ')}]`,
      );

      throw new ForbiddenException(
        `Akses ditolak. Resource ini khusus untuk role: ${requiredRoles.join(
          ' atau ',
        )}.`,
      );
    }

    return true;
  }
}