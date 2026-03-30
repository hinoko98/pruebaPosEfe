import { lazy, Suspense } from "react";
import { Navigate, useRoutes } from "react-router-dom";

import PermissionRoute from "@/app/routes/PermissionRoute";
import RoleRoute from "@/app/routes/RoleRoute";
import { APP_PERMISSION_KEYS } from "@/features/user/app-permissions";
import ProtectedRoute from "@/features/auth/components/ProtectedRoute";
import { useAuth } from "@/features/auth/hooks/useAuth";

const Login = lazy(() => import("@/features/auth/view/LoginView"));
const ProfileView = lazy(() => import("@/features/account/views/ProfileView"));
const SecurityView = lazy(() => import("@/features/account/views/SecurityView"));
const SettingsView = lazy(() => import("@/features/account/views/SettingsView"));
const AdminLayout = lazy(() => import("@/features/access/admin/layout/AdminLayout"));
const AdminHomeView = lazy(() => import("@/features/access/admin/views/AdminHomeView"));
const EmployeeLayout = lazy(() => import("@/features/access/employee/layout/EmployeeLayout"));
const EmployeeHomeView = lazy(() => import("@/features/access/employee/views/EmployeeHomeView"));
const NoAccessView = lazy(() => import("@/features/access/shared/views/NoAccessView"));
const CashView = lazy(() => import("@/features/cash/views/CashView"));
const CustomersView = lazy(() => import("@/features/customers/views/CustomersView"));
const ProductListView = lazy(() => import("@/features/products/views/ProductListView"));
const PurchasesView = lazy(() => import("@/features/purchases/views/PurchasesView"));
const SuppliersView = lazy(() => import("@/features/purchases/views/SuppliersView"));
const ReportsView = lazy(() => import("@/features/reports/views/ReportsView"));
const PosView = lazy(() => import("@/features/sales/views/PosView"));
const SalesHistoryView = lazy(() => import("@/features/sales/views/SalesHistoryView"));
const UserView = lazy(() =>
  import("@/features/user/views/UserView").then((module) => ({ default: module.UserView }))
);
const RolePermissionsView = lazy(() =>
  import("@/features/user/views/RolePermissionsView").then((module) => ({ default: module.RolePermissionsView }))
);
const InventoryMovesView = lazy(() => import("@/features/inventory/views/InventoryMovesView"));
const CorrespondentView = lazy(() => import("@/features/correspondent/views/CorrespondentView"));
const CorrespondentClosuresView = lazy(() => import("@/features/correspondent/views/CorrespondentClosuresView"));
const CorrespondentSettingsView = lazy(() => import("@/features/correspondent/views/CorrespondentSettingsView"));

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />
        <h1 className="text-lg font-semibold text-gray-900">Cargando sistema</h1>
        <p className="mt-2 text-sm text-gray-600">Estamos preparando la pantalla que necesitas.</p>
      </div>
    </div>
  );
}

function IndexRedirect() {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  return user.role === "ADMIN" ? <Navigate to="/admin" replace /> : <Navigate to="/app" replace />;
}

export default function AppRoutes() {
  const routes = useRoutes([
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
                {
                  element: <PermissionRoute permissionKey={APP_PERMISSION_KEYS.posAccess} />,
                  children: [{ path: "pos", element: <PosView /> }],
                },
                {
                  element: <PermissionRoute permissionKey={APP_PERMISSION_KEYS.salesHistory} />,
                  children: [{ path: "sales", element: <SalesHistoryView /> }],
                },
                {
                  element: <PermissionRoute permissionKey={APP_PERMISSION_KEYS.cashView} />,
                  children: [{ path: "cash", element: <CashView /> }],
                },
                {
                  element: <PermissionRoute permissionKey={APP_PERMISSION_KEYS.productsView} />,
                  children: [{ path: "products", element: <ProductListView /> }],
                },
                {
                  element: <PermissionRoute permissionKey={APP_PERMISSION_KEYS.stockMovesView} />,
                  children: [{ path: "stock-moves", element: <InventoryMovesView /> }],
                },
                {
                  element: <PermissionRoute permissionKey={APP_PERMISSION_KEYS.purchasesView} />,
                  children: [{ path: "purchases", element: <PurchasesView /> }],
                },
                {
                  element: <PermissionRoute permissionKey={APP_PERMISSION_KEYS.suppliersView} />,
                  children: [{ path: "suppliers", element: <SuppliersView /> }],
                },
                {
                  element: <PermissionRoute permissionKey={APP_PERMISSION_KEYS.usersView} />,
                  children: [{ path: "users", element: <UserView /> }],
                },
                {
                  element: <PermissionRoute permissionKey={APP_PERMISSION_KEYS.rolesView} />,
                  children: [{ path: "roles", element: <RolePermissionsView /> }],
                },
                {
                  element: <PermissionRoute permissionKey={APP_PERMISSION_KEYS.customersView} />,
                  children: [{ path: "customers", element: <CustomersView /> }],
                },
                {
                  element: <PermissionRoute permissionKey={APP_PERMISSION_KEYS.correspondentView} />,
                  children: [{ path: "correspondent", element: <CorrespondentView /> }],
                },
                { path: "correspondent/closures", element: <CorrespondentClosuresView /> },
                { path: "correspondent/settings", element: <CorrespondentSettingsView /> },
                {
                  element: <PermissionRoute permissionKey={APP_PERMISSION_KEYS.reportsView} />,
                  children: [{ path: "reports", element: <ReportsView /> }],
                },
                { path: "profile", element: <ProfileView /> },
                { path: "security", element: <SecurityView /> },
                {
                  element: <PermissionRoute permissionKey={APP_PERMISSION_KEYS.settingsView} />,
                  children: [{ path: "settings", element: <SettingsView /> }],
                },
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
                {
                  element: <PermissionRoute permissionKey={APP_PERMISSION_KEYS.posAccess} />,
                  children: [{ path: "pos", element: <PosView /> }],
                },
                {
                  element: <PermissionRoute permissionKey={APP_PERMISSION_KEYS.salesHistory} />,
                  children: [{ path: "sales", element: <SalesHistoryView /> }],
                },
                {
                  element: <PermissionRoute permissionKey={APP_PERMISSION_KEYS.cashView} />,
                  children: [{ path: "cash", element: <CashView /> }],
                },
                {
                  element: <PermissionRoute permissionKey={APP_PERMISSION_KEYS.customersView} />,
                  children: [{ path: "customers", element: <CustomersView /> }],
                },
                {
                  element: <PermissionRoute permissionKey={APP_PERMISSION_KEYS.correspondentView} />,
                  children: [{ path: "correspondent", element: <CorrespondentView /> }],
                },
                { path: "correspondent/closures", element: <CorrespondentClosuresView /> },
                {
                  element: <PermissionRoute permissionKey={APP_PERMISSION_KEYS.productsView} />,
                  children: [{ path: "products", element: <ProductListView /> }],
                },
                {
                  element: <PermissionRoute permissionKey={APP_PERMISSION_KEYS.stockMovesView} />,
                  children: [{ path: "stock-moves", element: <InventoryMovesView /> }],
                },
                {
                  element: <PermissionRoute permissionKey={APP_PERMISSION_KEYS.suppliersView} />,
                  children: [{ path: "suppliers", element: <SuppliersView /> }],
                },
                { path: "profile", element: <ProfileView /> },
                { path: "security", element: <SecurityView /> },
              ],
            },
          ],
        },
        { path: "/no-access", element: <NoAccessView /> },
      ],
    },
    { path: "*", element: <Navigate to="/" replace /> },
  ]);

  return <Suspense fallback={<RouteLoadingFallback />}>{routes}</Suspense>;
}
