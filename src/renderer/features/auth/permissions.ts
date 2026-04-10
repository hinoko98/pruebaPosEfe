import type { AuthUser } from "./types";
import { hasPermissionKey } from "@/features/user/app-permissions";

export function hasPermission(user: AuthUser | null | undefined, permissionKey?: string) {
  if (!permissionKey) return true;
  if (user?.role === "ADMIN") return true;
  return hasPermissionKey(user?.permissions, permissionKey);
}
