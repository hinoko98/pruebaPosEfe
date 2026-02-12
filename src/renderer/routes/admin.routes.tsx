import { Route } from "react-router-dom";
import AdminHomeView from "@/features/access/admin/views/AdminHomeView";

export default function AdminRoutes() {
  return (
    <Route path="/admin">
      <Route index element={<AdminHomeView />} />
      {/* Aquí agregarás más rutas admin después */}
      {/* <Route path="products" element={<ProductsView />} /> */}
    </Route>
  );
}
