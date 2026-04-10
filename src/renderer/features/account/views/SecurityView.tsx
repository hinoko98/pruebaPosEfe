import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { useAuth } from "@/features/auth/hooks/useAuth";

export default function SecurityView() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const profilePath = useMemo(() => {
    return user?.role === "ADMIN" ? "/admin/profile" : "/app/profile";
  }, [user?.role]);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Seguridad
        </Typography>
        <Typography variant="body2" color="text.secondary">
          La configuracion de seguridad del usuario ahora se administra desde Mi perfil.
        </Typography>
      </Box>

      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography fontWeight={600}>Accede a tu perfil para cambiar la contrasena y revisar tus datos personales.</Typography>
            <Box>
              <Button variant="contained" onClick={() => navigate(profilePath)}>
                Ir a Mi perfil
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
