import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha, useTheme } from "@mui/material/styles";

import HelpHint from "@/components/ui/HelpHint";
import { useAuth } from "@/features/auth/hooks/useAuth";

type NavItem = {
  label: string;
  path: string;
  adminOnly?: boolean;
};

export function CorrespondentModuleNav() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const items = useMemo<NavItem[]>(
    () => [
      { label: "Transacciones", path: user?.role === "ADMIN" ? "/admin/correspondent" : "/app/correspondent" },
      {
        label: "Historial",
        path: user?.role === "ADMIN" ? "/admin/correspondent/history" : "/app/correspondent/history",
      },
      {
        label: "Resumen diario",
        path: user?.role === "ADMIN" ? "/admin/correspondent/closures" : "/app/correspondent/closures",
      },
      {
        label: "Configuracion",
        path: "/admin/correspondent/settings",
        adminOnly: true,
      },
    ],
    [user?.role]
  );

  return (
    <Card
      sx={{
        borderRadius: 1.25,
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: "none",
        bgcolor: isDark ? alpha(theme.palette.common.white, 0.02) : theme.palette.background.paper,
      }}
    >
      <CardContent>
        <Stack spacing={2}>
          <Box display="flex" alignItems="center" gap={0.5}>
            <Typography variant="h5">Modulo corresponsal</Typography>
            <HelpHint title="Registra y consulta movimientos de corresponsal. El cuadre operativo diario se centraliza en Caja general." />
          </Box>

          <Box display="flex" gap={1} flexWrap="wrap">
            {items
              .filter((item) => !item.adminOnly || user?.role === "ADMIN")
              .map((item) => {
                const selected = location.pathname === item.path;
                return (
                  <Button
                    key={item.path}
                    variant={selected ? "contained" : "outlined"}
                    onClick={() => navigate(item.path)}
                    sx={{
                      borderRadius: 1,
                    }}
                  >
                    {item.label}
                  </Button>
                );
              })}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
