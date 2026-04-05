import { useEffect, useState } from "react";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import FloatingAlert from "@/components/feedback/FloatingAlert";
import { useTablePagination } from "@/hooks/useTablePagination";

type RangeFilter = "day" | "week" | "month";

function currency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function labelForRange(range: RangeFilter) {
  if (range === "day") return "Hoy";
  if (range === "week") return "Esta semana";
  return "Este mes";
}

export default function AdminHomeView() {
  const [range, setRange] = useState<RangeFilter>("day");
  const [stats, setStats] = useState<Awaited<ReturnType<typeof window.api.getDashboardStats>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recentSalesPagination = useTablePagination(stats?.recentSales ?? []);

  useEffect(() => {
    let mounted = true;

    window.api
      .getDashboardStats(range)
      .then((response) => {
        if (!mounted) return;
        setStats(response);
        setError(null);
      })
      .catch(() => {
        if (!mounted) return;
        setError("No se pudo cargar el dashboard.");
      });

    return () => {
      mounted = false;
    };
  }, [range]);

  return (
    <Stack spacing={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
        <Box>
          <Typography variant="h4">Resumen general</Typography>
          <Typography variant="body2" color="text.secondary">
            Resumen operativo del POS con ventas, ganancias y productos clave.
          </Typography>
        </Box>

        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel id="dashboard-range-label">Periodo</InputLabel>
          <Select
            labelId="dashboard-range-label"
            value={range}
            label="Periodo"
            onChange={(event) => setRange(event.target.value as RangeFilter)}
          >
            <MenuItem value="day">Diario</MenuItem>
            <MenuItem value="week">Semanal</MenuItem>
            <MenuItem value="month">Mensual</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <FloatingAlert
        feedback={error ? { severity: "error", message: error } : null}
        onClose={() => setError(null)}
      />

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(4, 1fr)" }} gap={2}>
        <MetricCard title={`Ventas ${labelForRange(range)}`} value={stats?.totals.salesCount ?? 0} helper="Facturas registradas" />
        <MetricCard title="Ingresos" value={currency(stats?.totals.revenue ?? 0)} helper="Total vendido" />
        <MetricCard title="Ganancia" value={currency(stats?.totals.profit ?? 0)} helper="Margen aproximado" />
        <MetricCard title="Ticket promedio" value={currency(stats?.totals.averageTicket ?? 0)} helper="Promedio por venta" />
      </Box>

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", xl: "1.4fr 1fr" }} gap={2}>
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Ventas recientes</Typography>
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Factura</TableCell>
                      <TableCell>Cliente</TableCell>
                      <TableCell align="right">Items</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentSalesPagination.paginatedRows.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell>{sale.invoiceNumber}</TableCell>
                        <TableCell>{sale.customer}</TableCell>
                        <TableCell align="right">{sale.itemsCount}</TableCell>
                        <TableCell align="right">{currency(sale.total)}</TableCell>
                      </TableRow>
                    ))}
                    {(stats?.recentSales ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4}>
                          <Typography variant="body2" color="text.secondary">
                            Aun no hay ventas en este periodo.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
                <TablePagination
                  component="div"
                  count={(stats?.recentSales ?? []).length}
                  page={recentSalesPagination.page}
                  onPageChange={recentSalesPagination.handleChangePage}
                  rowsPerPage={recentSalesPagination.rowsPerPage}
                  onRowsPerPageChange={recentSalesPagination.handleChangeRowsPerPage}
                  rowsPerPageOptions={[10, 15]}
                  labelRowsPerPage="Filas"
                />
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Stack spacing={2}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Métodos de pago</Typography>
                {(stats?.paymentSummary ?? []).map((item) => (
                  <Box key={item.label} display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      {item.label}
                    </Typography>
                    <Typography fontWeight={700}>{currency(item.value)}</Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Productos más vendidos</Typography>
                {(stats?.topProducts ?? []).map((product) => (
                  <Box key={product.name} display="flex" justifyContent="space-between" alignItems="center" gap={2}>
                    <Box>
                      <Typography fontWeight={700}>{product.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {product.qty} unidades
                      </Typography>
                    </Box>
                    <Typography fontWeight={700}>{currency(product.total)}</Typography>
                  </Box>
                ))}
                {(stats?.topProducts ?? []).length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Aun no hay productos vendidos en este periodo.
                  </Typography>
                ) : null}
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Stock bajo</Typography>
                {(stats?.lowStock ?? []).map((product) => (
                  <Box key={product.id} display="flex" justifyContent="space-between" alignItems="center" gap={2}>
                    <Box>
                      <Typography fontWeight={700}>{product.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {product.sku}
                      </Typography>
                    </Box>
                    <Chip label={`${product.stock} und`} color={product.stock <= 3 ? "error" : "warning"} size="small" />
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </Stack>
  );
}

function MetricCard({
  title,
  value,
  helper,
}: {
  title: string;
  value: string | number;
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
