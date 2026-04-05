import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import HelpHint from "@/components/ui/HelpHint";
import { useAuth } from "@/features/auth/hooks/useAuth";

type NavItem = {
  label: string;
  path: string;
  adminOnly?: boolean;
};

export function CorrespondentModuleNav() {
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
        label: "Cuadre de caja",
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
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box display="flex" alignItems="center" gap={0.5}>
            <Typography variant="h5">Modulo corresponsal</Typography>
            <HelpHint title="Cuatro vistas separadas para registrar, consultar, cuadrar y administrar los corresponsales." />
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
