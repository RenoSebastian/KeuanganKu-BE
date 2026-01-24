import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client'; // Import Enum dari Prisma Generated Client

// Key metadata yang konsisten
export const ROLES_KEY = 'roles';

// Decorator yang Type-Safe.
// Contoh penggunaan di Controller: @Roles(Role.DIRECTOR, Role.ADMIN)
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);