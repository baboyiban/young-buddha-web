export function hasRequiredRole(user: any, requiredRoles?: string[]) {
  if (!requiredRoles || requiredRoles.length === 0) return true;
  if (!user || !user.roles) return false;
  return requiredRoles.some((role) => user.roles.includes(role));
}

export async function getCurrentUser() {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) throw new Error("Not authenticated");
  const user = await res.json();
  user.roles = user.role ? [user.role] : [];
  return user;
}
