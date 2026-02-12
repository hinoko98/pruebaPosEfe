import { Routes, Route, Navigate } from "react-router-dom";
import Login from "@/features/auth/view/LoginView";
import DashBoardUser from "@/features/access/employee/views/DashBoardUserView";
import ProtectedRoute from "@/features/auth/components/ProtectedRoute";

export default function AppRoutes() {
  return (
    <Routes>
      {/* Públicas */}
      <Route path="/login" element={<Login />} />

      {/* Protegidas */}
      <Route element={<ProtectedRoute />}>
        <Route path="/home" element={<DashBoardUser />} />
      </Route>

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/home" replace />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
