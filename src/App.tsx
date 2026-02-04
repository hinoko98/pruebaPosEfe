import { Routes, Route, Navigate } from 'react-router-dom';
import Login from '@/features/auth/View/LoginView';           // Ajusta la ruta si Login está en otro lugar
import DashBoardUser from '@/features/access/user/View/DashBoardUserView';                   // Crea este archivo si no lo tienes
import ProtectedRoute from '@/features/auth/components/ProtectedRoute';  // Crea este si no lo tienes

export default function App() {
  return (
    <div className='p-8'>
      <Routes>
        {/* Rutas públicas */}
        <Route path="/login" element={<Login />} />
        
        {/* Rutas protegidas (requieren estar logueado) */}
        <Route element={<ProtectedRoute />}>
          <Route path="/home" element={<DashBoardUser />} />
          {/* Puedes agregar más rutas protegidas aquí en el futuro */}
          {/* <Route path="/perfil" element={<Perfil />} /> */}
        </Route>

        {/* Cualquier otra ruta → redirige a login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </div>
  );
}