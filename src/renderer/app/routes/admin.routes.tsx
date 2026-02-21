import { Route } from "react-router-dom";

import AdminHomeView from "@/features/access/admin/views/AdminHomeView";
import AdminLayout from "@/features/access/admin/layout/AdminLayout";
import ProductListView from "@/features/products/views/ProductListView";

import ProfileView from "@/features/account/views/ProfileView";
import SecurityView from "@/features/account/views/SecurityView";
import SettingsView from "@/features/account/views/SettingsView";

export default function AdminRoutes(): JSX.Element {
  return (
    <>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminHomeView />} />
        <Route path="products" element={<ProductListView />} />
        <Route path="customers" element={<div>Clientes</div>} />
        <Route path="profile" element={<ProfileView />} />
        <Route path="security" element={<SecurityView />} />
        <Route path="settings" element={<SettingsView />} />
      </Route>
    </>
  );
}
