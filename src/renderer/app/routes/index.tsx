import { Navigate, useRoutes } from "react-router-dom";

import RoleRoute from "@/app/routes/RoleRoute";
import ProtectedRoute from "@/features/auth/components/ProtectedRoute";
import { useAuth } from "@/features/auth/hooks/useAuth";
import Login from "@/features/auth/view/LoginView";
import ProfileView from "@/features/account/views/ProfileView";
import SecurityView from "@/features/account/views/SecurityView";
import SettingsView from "@/features/account/views/SettingsView";
import AdminLayout from "@/features/access/admin/layout/AdminLayout";
import AdminHomeView from "@/features/access/admin/views/AdminHomeView";
import EmployeeLayout from "@/features/access/employee/layout/EmployeeLayout";
import EmployeeHomeView from "@/features/access/employee/views/EmployeeHomeView";
import CashView from "@/features/cash/views/CashView";
import CustomersView from "@/features/customers/views/CustomersView";
import ProductListView from "@/features/products/views/ProductListView";
import PurchasesView from "@/features/purchases/views/PurchasesView";
import SuppliersView from "@/features/purchases/views/SuppliersView";
import ReportsView from "@/features/reports/views/ReportsView";
import PosView from "@/features/sales/views/PosView";
import SalesHistoryView from "@/features/sales/views/SalesHistoryView";
import { UserView } from "@/features/user/views/UserView";
import InventoryMovesView from "@/features/inventory/views/InventoryMovesView";
import CorrespondentView from "@/features/correspondent/views/CorrespondentView";
import CorrespondentClosuresView from "@/features/correspondent/views/CorrespondentClosuresView";
import CorrespondentSettingsView from "@/features/correspondent/views/CorrespondentSettingsView";

function IndexRedirect() {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  return user.role === "ADMIN" ? <Navigate to="/admin" replace /> : <Navigate to="/app" replace />;
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
                { path: "pos", element: <PosView /> },
                { path: "sales", element: <SalesHistoryView /> },
                { path: "cash", element: <CashView /> },
                { path: "products", element: <ProductListView /> },
                { path: "stock-moves", element: <InventoryMovesView /> },
                { path: "purchases", element: <PurchasesView /> },
                { path: "suppliers", element: <SuppliersView /> },
                { path: "users", element: <UserView /> },
                { path: "customers", element: <CustomersView /> },
                { path: "correspondent", element: <CorrespondentView /> },
                { path: "correspondent/closures", element: <CorrespondentClosuresView /> },
                { path: "correspondent/settings", element: <CorrespondentSettingsView /> },
                { path: "reports", element: <ReportsView /> },
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
                { path: "pos", element: <PosView /> },
                { path: "sales", element: <SalesHistoryView /> },
                { path: "cash", element: <CashView /> },
                { path: "customers", element: <CustomersView /> },
                { path: "correspondent", element: <CorrespondentView /> },
                { path: "correspondent/closures", element: <CorrespondentClosuresView /> },
                { path: "products", element: <ProductListView /> },
                { path: "stock-moves", element: <InventoryMovesView /> },
                { path: "suppliers", element: <SuppliersView /> },
                { path: "profile", element: <ProfileView /> },
                { path: "security", element: <SecurityView /> },
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
