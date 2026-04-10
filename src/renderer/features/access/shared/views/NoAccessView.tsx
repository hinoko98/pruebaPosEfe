import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Link as RouterLink } from "react-router-dom";

import { useAuth } from "@/features/auth/hooks/useAuth";

export default function NoAccessView() {
  const { user } = useAuth();
  const homePath = user?.role === "ADMIN" ? "/admin" : "/app";

  return (
    <Stack
      spacing={2}
      alignItems="center"
      justifyContent="center"
      textAlign="center"
      sx={{ minHeight: "70vh", px: 3 }}
    >
      <Typography variant="h3" fontWeight={800}>
        Sin acceso a este modulo
      </Typography>
      <Typography color="text.secondary" maxWidth={560}>
        Tu perfil no tiene permisos para entrar aqui. Si necesitas este acceso, ajusta el rol desde
        administracion o vuelve al panel principal.
      </Typography>
      <Button component={RouterLink} to={homePath} variant="contained">
        Volver al inicio
      </Button>
    </Stack>
  );
}
