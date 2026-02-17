import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { Role } from "@/features/auth/types";

export default function RoleRoute({ allow }: { allow: Role[] }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!allow.includes(user.role)) return <Navigate to="/no-access" replace />;

  return <Outlet />;
}
