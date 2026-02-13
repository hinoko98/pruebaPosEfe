import { Routes, Route, Navigate } from "react-router-dom";
import Login from "@/features/auth/view/LoginView";
import ProtectedRoute from "@/features/auth/components/ProtectedRoute";
import RoleRoute from "@/routes/RoleRoute";

import AdminRoutes from "@/routes/admin.routes";
import EmployeeRoutes from "@/routes/employee.routes";

import { useAuth } from "@/composables/useAuth";

function IndexRedirect() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return user.role === "ADMIN"
    ? <Navigate to="/admin" replace />
    : <Navigate to="/app" replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Pública */}
      <Route path="/login" element={<Login />} />

      {/* Protegidas */}
      <Route element={<ProtectedRoute />}>

        {/* Redirect automático */}
        <Route path="/" element={<IndexRedirect />} />

        {/* ADMIN */}
        <Route element={<RoleRoute allow={["ADMIN"]} />}>
          {AdminRoutes()}
        </Route>

        {/* EMPLOYEE */}
        <Route element={<RoleRoute allow={["EMPLOYEE", "ADMIN"]} />}>
          {EmployeeRoutes()}
        </Route>

        <Route path="/no-access" element={<div>No tienes acceso</div>} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
