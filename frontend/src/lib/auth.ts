export function hasRequiredRole(user: any, requiredRoles?: string[]) {
  if (!requiredRoles || requiredRoles.length === 0) return true;
  if (!user || !user.roles) return false;
  return requiredRoles.some((role) => user.roles.includes(role));
}

export async function getCurrentUser() {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok || res.status === 401 || res.status === 403) {
    throw new Error("Not authenticated");
  }
  const user = await res.json();
  user.roles = user.role ? [user.role] : [];
  return user;
}

export async function logout() {
  const res = await fetch("/api/auth/current", {
    method: "DELETE",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Logout failed");
  }

  // 로그아웃 성공 시 로그인 페이지로 리다이렉트
  location.hash = "#/login";
}
