import type { AuthUser } from "./types";

export function hasPermission(user: AuthUser | null | undefined, permissionKey?: string) {
  if (!permissionKey) return true;
  if (user?.role === "ADMIN") return true;
  return Boolean(user?.permissions?.includes(permissionKey));
}
