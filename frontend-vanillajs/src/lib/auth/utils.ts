import type { User } from "../../types";
import { authService } from "./service";

export function hasRequiredRole(user: User, requiredRoles?: string[]): boolean {
  if (!requiredRoles || requiredRoles.length === 0) return true;
  if (!user || !user.role) return false;
  return requiredRoles.includes(user.role);
}

export async function requireAuth(): Promise<User> {
  try {
    return await authService.getCurrentUser();
  } catch (error) {
    location.hash = "#/login";
    throw error;
  }
}

export async function requireRole(roles: string[]): Promise<User> {
  const user = await requireAuth();
  if (!hasRequiredRole(user, roles)) throw new Error("권한이 부족합니다");
  return user;
}
