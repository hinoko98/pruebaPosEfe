// src/pages/Home.tsx
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export default function DashBoardUserView() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ padding: '3rem 2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Bienvenido a la aplicación</h1>
      <p>Has iniciado sesión correctamente.</p>
      
      <div style={{ marginTop: '2rem' }}>
        <button
          onClick={handleLogout}
          style={{
            padding: '0.8rem 1.5rem',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}