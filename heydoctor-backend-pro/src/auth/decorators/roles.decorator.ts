import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/user-role.enum';

export const ROLES_KEY = 'roles';

/** Restrict route to one or more {@link UserRole} values (use with {@link RolesGuard}). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
