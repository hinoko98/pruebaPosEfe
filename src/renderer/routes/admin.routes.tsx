import { Route } from "react-router-dom";
import AdminHomeView from "@/features/access/admin/views/AdminHomeView";
import AdminLayout from "@/features/access/admin/layout/AdminLayout";
import ProductListView from "@/features/products/views/ProductListView";


export default function AdminRoutes() {
  return (
    <Route path="/admin" element={<AdminLayout />}>
    <Route index element={<AdminHomeView />} />
    <Route path="products" element={<ProductListView />} />
    <Route path="customers" element={<div>Clientes</div>} />
    <Route path="settings" element={<div>Configuración</div>} />
  </Route>
  );
}
