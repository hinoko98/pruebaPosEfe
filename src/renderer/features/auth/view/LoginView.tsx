import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

import ButtonUI from "@/components/ui/Button";
import { useAuth } from "@/features/auth/hooks/useAuth";

const loginFieldSx = {
  "& .MuiInputLabel-root": {
    color: "#000000",
  },
  "& .MuiInputLabel-root.Mui-focused": {
    color: "#000000",
  },
  "& .MuiInputBase-input": {
    color: "#000000",
  },
  "& .MuiOutlinedInput-root": {
    color: "#000000",
    backgroundColor: "#ffffff",
  },
  "& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline": {
    borderColor: "#cbd5e1",
  },
  "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "#94a3b8",
  },
  "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: "#000000",
  },
  "& .MuiFormHelperText-root": {
    color: "#000000",
  },
};

export default function Login() {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!user.trim() || !password.trim()) {
      setError("Campos requeridos");
      return;
    }

    try {
      const response = await window.api.login({
        username: user,
        password,
      });

      if (response.success) {
        login(response.user);
        navigate("/", { replace: true });
      } else {
        setError(response.message || "Error al iniciar sesion");
      }
    } catch (err) {
      console.error("Error en login:", err);
      setError("Error de conexion con el sistema");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-12">
      <div className="w-full min-h-full max-w-md rounded-2xl bg-white text-black shadow-2xl">
        <br />
        <div className="text-center">
          <h1 className="text-3xl font-bold text-black">Bienvenido</h1>
          <p className="text-sm text-black/70">Ingresa tus credenciales para continuar</p>
        </div>
        <div>
          <form onSubmit={handleLogin} noValidate>
            <Stack spacing={2} p={3}>
              <TextField
                label="Usuario"
                type="text"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                variant="outlined"
                fullWidth
                autoFocus
                required
                error={!user.trim() && !!error}
                helperText={!user.trim() && error ? "El usuario es obligatorio" : ""}
                sx={loginFieldSx}
              />

              <TextField
                label="Contrasena"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                variant="outlined"
                fullWidth
                required
                sx={loginFieldSx}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          aria-label="toggle password visibility"
                          sx={{ color: "#000000" }}
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              {error ? <p className="mt-2 text-center font-medium text-red-600">{error}</p> : null}

              <div className="space-y-4 pt-4">
                <ButtonUI type="submit" variant="primary" color="primary" fullWidth size="lg">
                  Iniciar sesion
                </ButtonUI>
              </div>
            </Stack>
          </form>
        </div>
      </div>
    </div>
  );
}
