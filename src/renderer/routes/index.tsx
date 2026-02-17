import { Navigate, useRoutes } from "react-router-dom";
import Login from "@/features/auth/view/LoginView";

import ProtectedRoute from "@/features/auth/components/ProtectedRoute";
import RoleRoute from "@/routes/RoleRoute";

import AdminLayout from "@/features/access/admin/layout/AdminLayout";
import AdminHomeView from "@/features/access/admin/views/AdminHomeView";
import ProductListView from "@/features/products/views/ProductListView";

import ProfileView from "@/features/account/views/ProfileView";
import SecurityView from "@/features/account/views/SecurityView";
import SettingsView from "@/features/account/views/SettingsView";

import EmployeeLayout from "@/features/access/employee/layout/EmployeeLayout";
import EmployeeHomeView from "@/features/access/employee/views/EmployeeHomeView";

import { useAuth } from "@/features/auth/hooks/useAuth";

function IndexRedirect() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return user.role === "ADMIN"
    ? <Navigate to="/admin" replace />
    : <Navigate to="/app" replace />;
}

export default function AppRoutes() {
  return useRoutes([
    { path: "/login", element: <Login /> },

    {
      element: <ProtectedRoute />,
      children: [
        { path: "/", element: <IndexRedirect /> },

        {
          element: <RoleRoute allow={["ADMIN"]} />,
          children: [
            {
              path: "/admin",
              element: <AdminLayout />,
              children: [
                { index: true, element: <AdminHomeView /> },
                { path: "products", element: <ProductListView /> },
                { path: "customers", element: <div>Clientes</div> },
                { path: "profile", element: <ProfileView /> },
                { path: "security", element: <SecurityView /> },
                { path: "settings", element: <SettingsView /> },
              ],
            },
          ],
        },

        {
          element: <RoleRoute allow={["EMPLOYEE", "ADMIN"]} />,
          children: [
            {
              path: "/app",
              element: <EmployeeLayout />,
              children: [
                { index: true, element: <EmployeeHomeView /> },
                { path: "profile", element: <ProfileView /> },
                { path: "security", element: <SecurityView /> },
                { path: "settings", element: <SettingsView /> },
              ],
            },
          ],
        },

        { path: "/no-access", element: <div>No tienes acceso</div> },
      ],
    },

    { path: "*", element: <Navigate to="/" replace /> },
  ]);
}
