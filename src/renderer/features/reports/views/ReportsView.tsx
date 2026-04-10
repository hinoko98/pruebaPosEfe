import { useCallback, useEffect, useMemo, useState } from "react";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import FloatingAlert from "@/components/feedback/FloatingAlert";
import HelpHint from "@/components/ui/HelpHint";
import { useTablePagination } from "@/hooks/useTablePagination";

type FeedbackState = { severity: "success" | "error" | "info"; message: string } | null;
type SaleRow = Awaited<ReturnType<typeof window.api.listSales>>["sales"][number];
type PurchaseRow = Awaited<ReturnType<typeof window.api.listPurchases>>["purchases"][number];
type InventoryMoveRow = Awaited<ReturnType<typeof window.api.listInventoryMoves>>["moves"][number];
type CustomerRow = Awaited<ReturnType<typeof window.api.listCustomers>>["customers"][number];
type CorrespondentRow = Awaited<ReturnType<typeof window.api.listCorrespondentTransactions>>["transactions"][number];
type CashSummary = Awaited<ReturnType<typeof window.api.getCashSummary>>;

function currency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function toDateInputValue(value = new Date()) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function isWithinRange(value: string, dateFrom: string, dateTo: string) {
  const time = new Date(value).getTime();
  const start = new Date(`${dateFrom}T00:00:00`).getTime();
  const end = new Date(`${dateTo}T23:59:59`).getTime();
  return time >= start && time <= end;
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

export default function ReportsView() {
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date();
    return toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [dateTo, setDateTo] = useState(() => toDateInputValue());
  const [search, setSearch] = useState("");
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [moves, setMoves] = useState<InventoryMoveRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [correspondentTransactions, setCorrespondentTransactions] = useState<CorrespondentRow[]>([]);
  const [cashSummary, setCashSummary] = useState<CashSummary | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const dateFromIso = new Date(`${dateFrom}T00:00:00`).toISOString();
      const dateToIso = new Date(`${dateTo}T23:59:59`).toISOString();
      const [salesResponse, purchasesResponse, movesResponse, customersResponse, correspondentResponse, cashResponse] =
        await Promise.all([
          window.api.listSales({ dateFrom: dateFromIso, dateTo: dateToIso }),
          window.api.listPurchases(),
          window.api.listInventoryMoves(),
          window.api.listCustomers(),
          window.api.listCorrespondentTransactions({ dateFrom: dateFromIso, dateTo: dateToIso }),
          window.api.getCashSummary(),
        ]);

      if (!salesResponse.success) throw new Error(salesResponse.message || "No se pudo cargar ventas");
      if (!purchasesResponse.success) throw new Error(purchasesResponse.message || "No se pudo cargar compras");
      if (!movesResponse.success) throw new Error(movesResponse.message || "No se pudo cargar inventario");
      if (!customersResponse.success) throw new Error(customersResponse.message || "No se pudo cargar clientes");
      if (!correspondentResponse.success) throw new Error(correspondentResponse.message || "No se pudo cargar corresponsal");
      if (!cashResponse.success) throw new Error(cashResponse.message || "No se pudo cargar caja");

      setSales(salesResponse.sales);
      setPurchases(purchasesResponse.purchases);
      setMoves(movesResponse.moves);
      setCustomers(customersResponse.customers);
      setCorrespondentTransactions(correspondentResponse.transactions);
      setCashSummary(cashResponse);
    } catch (error) {
      setFeedback({
        severity: "error",
        message: error instanceof Error ? error.message : "No se pudieron cargar los reportes",
      });
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const normalizedSearch = normalizeText(search);

  const filteredSales = useMemo(
    () =>
      sales.filter((sale) =>
        [sale.invoiceNumber, sale.customer, sale.cashier, sale.paymentMethod]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch)
      ),
    [normalizedSearch, sales]
  );

  const filteredPurchases = useMemo(
    () =>
      purchases.filter(
        (purchase) =>
          isWithinRange(purchase.purchasedAt, dateFrom, dateTo) &&
          [purchase.number, purchase.supplier, purchase.createdBy || ""].join(" ").toLowerCase().includes(normalizedSearch)
      ),
    [dateFrom, dateTo, normalizedSearch, purchases]
  );

  const filteredMoves = useMemo(
    () =>
      moves.filter(
        (move) =>
          isWithinRange(move.createdAt, dateFrom, dateTo) &&
          [move.productName, move.productSku, move.type, move.note || ""].join(" ").toLowerCase().includes(normalizedSearch)
      ),
    [dateFrom, dateTo, moves, normalizedSearch]
  );

  const filteredCorrespondent = useMemo(
    () =>
      correspondentTransactions.filter((transaction) =>
        [transaction.platform, transaction.type, transaction.registeredBy, transaction.externalReference || ""]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch)
      ),
    [correspondentTransactions, normalizedSearch]
  );

  const filteredCashSessions = useMemo(
    () =>
      (cashSummary?.recentSessions ?? []).filter(
        (session) =>
          isWithinRange(session.openedAt, dateFrom, dateTo) &&
          [session.registerName, session.user, session.status].join(" ").toLowerCase().includes(normalizedSearch)
      ),
    [cashSummary?.recentSessions, dateFrom, dateTo, normalizedSearch]
  );

  const salesPagination = useTablePagination(filteredSales);
  const purchasesPagination = useTablePagination(filteredPurchases);
  const correspondentPagination = useTablePagination(filteredCorrespondent);
  const cashPagination = useTablePagination(filteredCashSessions);

  const salesTotal = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
  const purchasesTotal = filteredPurchases.reduce((sum, purchase) => sum + purchase.total, 0);
  const correspondentIn = filteredCorrespondent
    .filter((item) => item.direction === "IN")
    .reduce((sum, item) => sum + item.amount, 0);
  const correspondentOut = filteredCorrespondent
    .filter((item) => item.direction === "OUT")
    .reduce((sum, item) => sum + item.amount, 0);

  const salesByDay = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const sale of filteredSales) {
      const key = new Date(sale.createdAt).toLocaleDateString("es-CO");
      grouped.set(key, (grouped.get(key) ?? 0) + sale.total);
    }
    return Array.from(grouped.entries()).map(([label, value]) => ({ label, value }));
  }, [filteredSales]);

  const salesByPayment = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const sale of filteredSales) {
      const key = sale.paymentMethod === "CASH" ? "Efectivo" : "Transferencia";
      grouped.set(key, (grouped.get(key) ?? 0) + sale.total);
    }
    return Array.from(grouped.entries()).map(([label, value]) => ({ label, value }));
  }, [filteredSales]);

  const correspondentByPlatform = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const row of filteredCorrespondent) {
      grouped.set(row.platform, (grouped.get(row.platform) ?? 0) + row.amount);
    }
    return Array.from(grouped.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredCorrespondent]);

  const inventoryByType = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const move of filteredMoves) {
      grouped.set(move.type, (grouped.get(move.type) ?? 0) + 1);
    }
    return Array.from(grouped.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredMoves]);

  const exportCsv = () => {
    const rows = [
      ["Modulo", "Documento", "Fecha", "Usuario", "Valor"],
      ...filteredSales.map((sale) => ["Venta", sale.invoiceNumber, sale.createdAt, sale.cashier, String(sale.total)]),
      ...filteredPurchases.map((purchase) => ["Compra", purchase.number, purchase.purchasedAt, purchase.createdBy || "", String(purchase.total)]),
      ...filteredCorrespondent.map((row) => ["Corresponsal", row.platform, row.performedAt, row.registeredBy, String(row.amount)]),
    ];

    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reportes-${dateFrom}-${dateTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" minHeight={420}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={2} flexWrap="wrap">
        <Box display="flex" alignItems="center" gap={0.5}>
          <Typography variant="h4">Reportes y analítica</Typography>
          <HelpHint title="Consolida ventas, compras, caja, clientes, corresponsal e inventario para revisar el comportamiento real del negocio." />
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => window.print()}>
            Imprimir
          </Button>
          <Button variant="contained" onClick={exportCsv}>
            Exportar CSV
          </Button>
        </Stack>
      </Box>

      <FloatingAlert feedback={feedback} onClose={() => setFeedback(null)} />

      <Card>
        <CardContent>
          <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(3, 1fr)" }} gap={2}>
            <TextField
              label="Fecha inicial"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Fecha final"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Buscar"
              placeholder="Factura, cliente, usuario o corresponsal"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Box>
        </CardContent>
      </Card>

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(4, 1fr)" }} gap={2}>
        <MetricCard title="Ventas" value={currency(salesTotal)} helper={`${filteredSales.length} facturas`} />
        <MetricCard title="Compras" value={currency(purchasesTotal)} helper={`${filteredPurchases.length} registros`} />
        <MetricCard title="Corresponsal entrada" value={currency(correspondentIn)} helper="Movimientos IN" />
        <MetricCard title="Corresponsal salida" value={currency(correspondentOut)} helper="Movimientos OUT" />
      </Box>

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", xl: "1.2fr 1fr" }} gap={2}>
        <ChartCard title="Ventas por día" subtitle="Comportamiento diario en el rango filtrado">
          <BarChart rows={salesByDay} />
        </ChartCard>

        <ChartCard title="Ventas por método de pago" subtitle="Distribución del valor vendido">
          <ShareBars rows={salesByPayment} />
        </ChartCard>
      </Box>

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", xl: "1fr 1fr" }} gap={2}>
        <ChartCard title="Corresponsal por plataforma" subtitle="Valor total movido por corresponsal">
          <ShareBars rows={correspondentByPlatform} />
        </ChartCard>

        <ChartCard title="Movimientos de inventario" subtitle="Cantidad de movimientos por tipo">
          <ShareBars rows={inventoryByType} />
        </ChartCard>
      </Box>

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(4, 1fr)" }} gap={2}>
        <MetricCard title="Clientes activos" value={String(customers.filter((customer) => customer.isActive).length)} helper="Base de clientes disponible" />
        <MetricCard title="Clientes con ventas" value={String(customers.filter((customer) => customer.salesCount > 0).length)} helper="Clientes con historial" />
        <MetricCard title="Sesiones de caja" value={String(filteredCashSessions.length)} helper="Sesiones recientes filtradas" />
        <MetricCard title="Movimientos inventario" value={String(filteredMoves.length)} helper="Dentro del rango de fechas" />
      </Box>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Historial de ventas</Typography>
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Factura</TableCell>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Cliente</TableCell>
                    <TableCell>Cajero</TableCell>
                    <TableCell>Método</TableCell>
                    <TableCell align="right">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {salesPagination.paginatedRows.map((sale) => (
                    <TableRow key={sale.id} hover>
                      <TableCell>{sale.invoiceNumber}</TableCell>
                      <TableCell>{new Date(sale.createdAt).toLocaleString("es-CO")}</TableCell>
                      <TableCell>{sale.customer}</TableCell>
                      <TableCell>{sale.cashier}</TableCell>
                      <TableCell>{sale.paymentMethod === "CASH" ? "Efectivo" : "Transferencia"}</TableCell>
                      <TableCell align="right">{currency(sale.total)}</TableCell>
                    </TableRow>
                  ))}
                  {filteredSales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        No hay ventas para ese filtro.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={filteredSales.length}
                page={salesPagination.page}
                onPageChange={salesPagination.handleChangePage}
                rowsPerPage={salesPagination.rowsPerPage}
                onRowsPerPageChange={salesPagination.handleChangeRowsPerPage}
                rowsPerPageOptions={[10, 15]}
                labelRowsPerPage="Filas"
              />
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", xl: "1fr 1fr" }} gap={2}>
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Historial de compras</Typography>
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Compra</TableCell>
                      <TableCell>Fecha</TableCell>
                      <TableCell>Proveedor</TableCell>
                      <TableCell>Usuario</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {purchasesPagination.paginatedRows.map((purchase) => (
                      <TableRow key={purchase.id} hover>
                        <TableCell>{purchase.number}</TableCell>
                        <TableCell>{new Date(purchase.purchasedAt).toLocaleString("es-CO")}</TableCell>
                        <TableCell>{purchase.supplier}</TableCell>
                        <TableCell>{purchase.createdBy || "Sin registro"}</TableCell>
                        <TableCell align="right">{currency(purchase.total)}</TableCell>
                      </TableRow>
                    ))}
                    {filteredPurchases.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          No hay compras para ese filtro.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
                <TablePagination
                  component="div"
                  count={filteredPurchases.length}
                  page={purchasesPagination.page}
                  onPageChange={purchasesPagination.handleChangePage}
                  rowsPerPage={purchasesPagination.rowsPerPage}
                  onRowsPerPageChange={purchasesPagination.handleChangeRowsPerPage}
                  rowsPerPageOptions={[10, 15]}
                  labelRowsPerPage="Filas"
                />
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Historial de corresponsal</Typography>
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Fecha</TableCell>
                      <TableCell>Corresponsal</TableCell>
                      <TableCell>Tipo</TableCell>
                      <TableCell>Usuario</TableCell>
                      <TableCell align="right">Valor</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {correspondentPagination.paginatedRows.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell>{new Date(row.performedAt).toLocaleString("es-CO")}</TableCell>
                        <TableCell>{row.platform}</TableCell>
                        <TableCell>{row.type}</TableCell>
                        <TableCell>{row.registeredBy}</TableCell>
                        <TableCell align="right">{currency(row.amount)}</TableCell>
                      </TableRow>
                    ))}
                    {filteredCorrespondent.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          No hay movimientos de corresponsal para ese filtro.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
                <TablePagination
                  component="div"
                  count={filteredCorrespondent.length}
                  page={correspondentPagination.page}
                  onPageChange={correspondentPagination.handleChangePage}
                  rowsPerPage={correspondentPagination.rowsPerPage}
                  onRowsPerPageChange={correspondentPagination.handleChangeRowsPerPage}
                  rowsPerPageOptions={[10, 15]}
                  labelRowsPerPage="Filas"
                />
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Caja general y sesiones</Typography>
            {cashSummary?.activeSession ? (
              <Alert severity="info">
                Caja activa en {cashSummary.activeSession.registerName} con esperado de {currency(cashSummary.activeSession.expectedCash)}.
              </Alert>
            ) : null}
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Caja</TableCell>
                    <TableCell>Usuario</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell>Apertura</TableCell>
                    <TableCell>Cierre</TableCell>
                    <TableCell align="right">Diferencia</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cashPagination.paginatedRows.map((session) => (
                    <TableRow key={session.id} hover>
                      <TableCell>{session.registerName}</TableCell>
                      <TableCell>{session.user}</TableCell>
                      <TableCell>{session.status === "OPEN" ? "Abierta" : session.status === "CLOSED" ? "Cerrada" : "Cancelada"}</TableCell>
                      <TableCell>{new Date(session.openedAt).toLocaleString("es-CO")}</TableCell>
                      <TableCell>{session.closedAt ? new Date(session.closedAt).toLocaleString("es-CO") : "Pendiente"}</TableCell>
                      <TableCell align="right">{currency(session.differenceAmount)}</TableCell>
                    </TableRow>
                  ))}
                  {filteredCashSessions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        No hay sesiones de caja para ese filtro.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={filteredCashSessions.length}
                page={cashPagination.page}
                onPageChange={cashPagination.handleChangePage}
                rowsPerPage={cashPagination.rowsPerPage}
                onRowsPerPageChange={cashPagination.handleChangeRowsPerPage}
                rowsPerPageOptions={[10, 15]}
                labelRowsPerPage="Filas"
              />
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

function MetricCard({ title, value, helper }: { title: string; value: string; helper: string }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h5" sx={{ mt: 1 }}>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {helper}
        </Typography>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6">{title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          </Box>
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}

function BarChart({ rows }: { rows: Array<{ label: string; value: number }> }) {
  const maxValue = Math.max(...rows.map((row) => row.value), 0);

  if (rows.length === 0) {
    return <Typography color="text.secondary">No hay datos para graficar en este rango.</Typography>;
  }

  return (
    <Box display="flex" alignItems="flex-end" gap={1.5} minHeight={220}>
      {rows.map((row) => (
        <Box key={row.label} flex={1} display="flex" flexDirection="column" justifyContent="flex-end" alignItems="center" gap={1}>
          <Typography variant="caption" fontWeight={700}>
            {currency(row.value)}
          </Typography>
          <Box
            sx={{
              width: "100%",
              minHeight: 12,
              height: `${Math.max(12, Math.round((row.value / maxValue) * 140))}px`,
              borderRadius: 2,
              background: "linear-gradient(180deg, #0ea5e9 0%, #0f766e 100%)",
            }}
          />
          <Typography variant="caption" color="text.secondary" textAlign="center">
            {row.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function ShareBars({ rows }: { rows: Array<{ label: string; value: number }> }) {
  const topRows = rows.slice(0, 8);
  const maxValue = Math.max(...topRows.map((row) => row.value), 0);

  if (topRows.length === 0) {
    return <Typography color="text.secondary">No hay datos para graficar en este rango.</Typography>;
  }

  return (
    <Stack spacing={1.5}>
      {topRows.map((row) => (
        <Box key={row.label}>
          <Box display="flex" justifyContent="space-between" gap={2} mb={0.5}>
            <Typography variant="body2">{row.label}</Typography>
            <Typography variant="body2" fontWeight={700}>
              {currency(row.value)}
            </Typography>
          </Box>
          <Divider sx={{ mb: 0.75, opacity: 0 }} />
          <Box sx={{ height: 10, borderRadius: 999, bgcolor: "#e2e8f0", overflow: "hidden" }}>
            <Box
              sx={{
                width: `${maxValue === 0 ? 0 : Math.max(8, (row.value / maxValue) * 100)}%`,
                height: "100%",
                borderRadius: 999,
                background: "linear-gradient(90deg, #38bdf8 0%, #0f766e 100%)",
              }}
            />
          </Box>
        </Box>
      ))}
    </Stack>
  );
}
