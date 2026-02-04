import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FormEvent } from "react";

// Componentes MUI
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import Stack from "@mui/material/Stack";

import { useAuth } from "@/composables/useAuth";

export default function Login() {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(""); // Limpia errores previos

    if (!user.trim() || !password.trim()) {
      setError("Completa ambos campos");
      return;
    }

    try {
      const response = await (window as any).api.login({
        username: user,
        password,
      });

      if (response.success) {
        login(response.user); // Guarda el usuario en tu contexto/auth (incluye role)
        navigate("/home");
      } else {
        setError(response.message || "Error al iniciar sesión");
      }
    } catch (err) {
      console.error("Error en login:", err);
      setError("Error de conexión con el sistema");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-12">
      <div className="w-full min-h-full max-w-md bg-white rounded-2xl shadow-2xl">
        <br />
        {/* Título */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Bienvenido</h1>
          <p className="text-sm text-gray-600">
            Ingresa tus credenciales para continuar
          </p>
        </div>
        {/* Formulario con MUI */}
        <div>
          <form onSubmit={handleLogin}>
            <Stack spacing={2} p={3}>
              {/* Campo Email */}
              <TextField
                label="Usuario"
                type="text"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                variant="outlined"
                fullWidth
                autoFocus
                required
                // El label sube automáticamente al escribir o al tener valor
              />

              {/* Campo Contraseña con ojo */}
              <TextField
                label="Contraseña"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                variant="outlined"
                fullWidth
                required
                // El label sube automáticamente
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          aria-label="toggle password visibility"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              {error && (
                <p className="text-red-600 text-center font-medium mt-2">
                  {error}
                </p>
              )}

              {/* Botones */}
              <div className="space-y-4 pt-4">
                <Button
                  type="submit"
                  variant="contained"
                  color="primary" // o "success" si prefieres verde
                  fullWidth
                  size="large"
                  sx={{ py: 1.8 }} // un poco más alto como tu botón original
                >
                  Iniciar Sesión
                </Button>
              </div>
            </Stack>
          </form>
        </div>
      </div>
    </div>
  );
}
