import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth/hooks/useAuth";

export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return null; // o un Loader
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <Outlet />;
}
