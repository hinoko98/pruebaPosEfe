import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { hasPermission } from "@/features/auth/permissions";

export default function PermissionRoute({ permissionKey }: { permissionKey: string }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (!hasPermission(user, permissionKey)) return <Navigate to="/no-access" replace />;

  return <Outlet />;
}
