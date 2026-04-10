import { useEffect, useState } from "react";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import FloatingAlert from "@/components/feedback/FloatingAlert";

function currency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function EmployeeHomeView() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof window.api.getDashboardStats>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    window.api
      .getDashboardStats("day")
      .then((response) => {
        if (!mounted) return;
        setStats(response);
      })
      .catch(() => {
        if (!mounted) return;
        setError("No se pudo cargar el panel del cajero.");
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">Panel de cajero</Typography>
        <Typography variant="body2" color="text.secondary">
          Resumen del dia usando datos reales de ventas e inventario.
        </Typography>
      </Box>

      <FloatingAlert
        feedback={error ? { severity: "error", message: error } : null}
        onClose={() => setError(null)}
      />

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(3, 1fr)" }} gap={2}>
        <QuickCard title="Ventas hoy" value={String(stats?.totals.salesCount ?? 0)} helper="Facturas registradas" />
        <QuickCard title="Ingresos hoy" value={currency(stats?.totals.revenue ?? 0)} helper="Ventas del turno" />
        <QuickCard title="Ticket promedio" value={currency(stats?.totals.averageTicket ?? 0)} helper="Promedio por factura" />
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6">Sugerencias operativas</Typography>
          <Stack spacing={1.5} sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Si el cliente pide su factura despues de vender, puedes verla e imprimirla desde el POS y desde historial.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Los movimientos de inventario se generan automaticamente al vender o ajustar stock.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Revisa los clientes registrados cuando la venta requiera trazabilidad o actualización de datos.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

function QuickCard({
  title,
  value,
  helper,
}: {
  title: string;
  value: string;
  helper: string;
}) {
  return (
    <Card>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h4" sx={{ mt: 1 }}>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {helper}
        </Typography>
      </CardContent>
    </Card>
  );
}
