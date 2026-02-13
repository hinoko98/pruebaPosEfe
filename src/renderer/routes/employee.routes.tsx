import { Route } from "react-router-dom";
import EmployeeHomeView from "@/features/access/employee/views/EmployeeHomeView";

export default function EmployeeRoutes() {
  return (
    <Route path="/app">
      <Route index element={<EmployeeHomeView />} />
      {/* Más rutas employee aquí */}
      {/* <Route path="pos" element={<POSView />} /> */}
    </Route>
  );
}
