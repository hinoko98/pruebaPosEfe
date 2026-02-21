import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";

import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PhoneIphoneOutlinedIcon from "@mui/icons-material/PhoneIphoneOutlined";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import GppGoodOutlinedIcon from "@mui/icons-material/GppGoodOutlined";

import { useAuth } from "@/features/auth/hooks/useAuth";

type Status = "active" | "inactive";

function StatusChip({ status }: { status: Status }) {
  if (status === "active") return <Chip size="small" label="Activado" variant="outlined" />;
  return <Chip size="small" label="Desactivado" variant="outlined" />;
}

export default function SecurityView() {
  const { user } = useAuth() as any;

  // Simulado (luego lo conectas con DB/config)
  const email = user?.email ?? "—";
  const passwordEnabled = true; // tu sistema por ahora usa password
  const phoneEnabled = false;
  const twoFAEnabled = false;
  const googleLoginEnabled = false; // si luego metes OAuth

  const handleManage = (key: string) => {
    // Aquí decides: abrir un modal, navegar a otra vista, etc.
    // Ej: navigate(`/app/security/${key}`)
    console.log("Manage:", key);
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Seguridad
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Administra tus métodos de verificación y acceso.
      </Typography>

      <Card sx={{ mt: 2, borderRadius: 3 }}>
        <CardContent sx={{ pb: 0 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            Métodos de verificación
          </Typography>
        </CardContent>

        <List sx={{ px: 1 }}>
          {/* Correo */}
          <ListItem
            secondaryAction={
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  {email}
                </Typography>
                <Button variant="contained" onClick={() => handleManage("email")}>
                  Administrar
                </Button>
              </Stack>
            }
          >
            <ListItemIcon>
              <EmailOutlinedIcon />
            </ListItemIcon>
            <ListItemText
              primary={<Typography fontWeight={700}>Correo electrónico</Typography>}
              secondary={
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Actualiza o cambia tu correo electrónico si lo necesitas para recibir códigos de verificación.
                  </Typography>
                  {/* Nota tipo advertencia (como la imagen) */}
                  <Typography variant="caption" color="warning.main">
                    Nota: por ahora no hay verificación por correo (solo UI). Se conectará a backend.
                  </Typography>
                </Box>
              }
            />
          </ListItem>

          <Divider variant="inset" component="li" />

          {/* Contraseña */}
          <ListItem
            secondaryAction={
              <Stack direction="row" spacing={2} alignItems="center">
                <StatusChip status={passwordEnabled ? "active" : "inactive"} />
                <Button variant="contained" onClick={() => handleManage("password")}>
                  Administrar
                </Button>
              </Stack>
            }
          >
            <ListItemIcon>
              <LockOutlinedIcon />
            </ListItemIcon>
            <ListItemText
              primary={<Typography fontWeight={700}>Contraseña</Typography>}
              secondary={
                <Typography variant="body2" color="text.secondary">
                  Usa tu contraseña para iniciar sesión en tu cuenta.
                </Typography>
              }
            />
          </ListItem>

          <Divider variant="inset" component="li" />

          {/* Número de teléfono */}
          <ListItem
            secondaryAction={
              <Stack direction="row" spacing={2} alignItems="center">
                <StatusChip status={phoneEnabled ? "active" : "inactive"} />
                <Button variant="contained" onClick={() => handleManage("phone")}>
                  Administrar
                </Button>
              </Stack>
            }
          >
            <ListItemIcon>
              <PhoneIphoneOutlinedIcon />
            </ListItemIcon>
            <ListItemText
              primary={<Typography fontWeight={700}>Número de teléfono</Typography>}
              secondary={
                <Typography variant="body2" color="text.secondary">
                  Usa tu número de teléfono para recibir códigos de verificación.
                </Typography>
              }
            />
          </ListItem>

          <Divider variant="inset" component="li" />

          {/* 2FA */}
          <ListItem
            secondaryAction={
              <Stack direction="row" spacing={2} alignItems="center">
                <StatusChip status={twoFAEnabled ? "active" : "inactive"} />
                <Button variant="contained" onClick={() => handleManage("2fa")}>
                  Administrar
                </Button>
              </Stack>
            }
          >
            <ListItemIcon>
              <VerifiedUserOutlinedIcon />
            </ListItemIcon>
            <ListItemText
              primary={<Typography fontWeight={700}>Autenticación de dos pasos</Typography>}
              secondary={
                <Typography variant="body2" color="text.secondary">
                  Usa una app autenticadora para proteger tu cuenta.
                </Typography>
              }
            />
          </ListItem>

          <Divider variant="inset" component="li" />

          {/* Login Google */}
          <ListItem
            secondaryAction={
              <Stack direction="row" spacing={2} alignItems="center">
                <StatusChip status={googleLoginEnabled ? "active" : "inactive"} />
                <Button variant="contained" onClick={() => handleManage("google")}>
                  Administrar
                </Button>
              </Stack>
            }
          >
            <ListItemIcon>
              <GppGoodOutlinedIcon />
            </ListItemIcon>
            <ListItemText
              primary={<Typography fontWeight={700}>Inicio de sesión con Google</Typography>}
              secondary={
                <Typography variant="body2" color="text.secondary">
                  Usa tu cuenta de Google para iniciar sesión y recibir verificaciones.
                </Typography>
              }
            />
          </ListItem>
        </List>

        {/* padding inferior para que no se vea cortado */}
        <Box sx={{ height: 10 }} />
      </Card>
    </Box>
  );
}
