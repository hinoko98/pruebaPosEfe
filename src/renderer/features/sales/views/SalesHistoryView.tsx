import { useEffect, useMemo, useState } from "react";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
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
import SaleReceiptDialog, { type ReceiptPrintTemplate } from "@/features/sales/components/SaleReceiptDialog";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { hasPermission } from "@/features/auth/permissions";
import { APP_PERMISSION_KEYS } from "@/features/user/app-permissions";
import { useTablePagination } from "@/hooks/useTablePagination";
import { estadoVentaLabel } from "@/lib/display";

function currency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function SalesHistoryView() {
  const { user } = useAuth();
  const [sales, setSales] = useState<Awaited<ReturnType<typeof window.api.listSales>>["sales"]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<{ severity: "success" | "error" | "info"; message: string } | null>(null);
  const [selectedSale, setSelectedSale] = useState<NonNullable<Awaited<ReturnType<typeof window.api.getSaleDetail>>["sale"]> | null>(null);
  const [printing, setPrinting] = useState(false);
  const canPrintSales = hasPermission(user, APP_PERMISSION_KEYS.salesPrint);

  const loadSales = async () => {
    setLoading(true);
    const response = await window.api.listSales();
    if (!response.success) {
      setFeedback({ severity: "error", message: response.message || "No se pudo cargar el historial" });
      setLoading(false);
      return;
    }
    setSales(response.sales);
    setLoading(false);
  };

  useEffect(() => {
    void loadSales();
  }, []);

  const filteredSales = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sales;
    return sales.filter((sale) =>
      [sale.invoiceNumber, sale.customer, sale.cashier, estadoVentaLabel(sale.status)].join(" ").toLowerCase().includes(query)
    );
  }, [sales, search]);

  const totals = useMemo(() => {
    return filteredSales.reduce(
      (acc, sale) => {
        acc.count += 1;
        acc.total += sale.total;
        return acc;
      },
      { count: 0, total: 0 }
    );
  }, [filteredSales]);
  const salesPagination = useTablePagination(filteredSales);

  const handleOpenSale = async (saleId: string) => {
    const response = await window.api.getSaleDetail(saleId);
    if (!response.success || !response.sale) {
      setFeedback({ severity: "error", message: response.message || "No se pudo cargar la factura" });
      return;
    }
    setSelectedSale(response.sale);
  };

  const handlePrint = async (template: ReceiptPrintTemplate) => {
    if (!selectedSale) return;
    setPrinting(true);
    const response = await window.api.printSaleInvoice({ saleId: selectedSale.id, template });
    setPrinting(false);
    if (!response.success) {
      setFeedback({ severity: "error", message: response.message || "No se pudo imprimir la factura" });
      return;
    }
    setFeedback({ severity: "success", message: "Factura enviada a impresion." });
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Box display="flex" alignItems="center" gap={0.5}>
          <Typography variant="h4">Historial de ventas</Typography>
          <HelpHint title="Consulta facturas reales, revisa el estado de cada venta y reimprime comprobantes sin salir del flujo operativo." />
        </Box>
      </Box>

      <FloatingAlert feedback={feedback} onClose={() => setFeedback(null)} />

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(3, 1fr)" }} gap={2}>
        <Card><CardContent><Typography variant="body2" color="text.secondary">Facturas cargadas</Typography><Typography variant="h5">{totals.count}</Typography></CardContent></Card>
        <Card><CardContent><Typography variant="body2" color="text.secondary">Total listado</Typography><Typography variant="h5">{currency(totals.total)}</Typography></CardContent></Card>
        <Card><CardContent><Typography variant="body2" color="text.secondary">Promedio</Typography><Typography variant="h5">{currency(totals.count > 0 ? totals.total / totals.count : 0)}</Typography></CardContent></Card>
      </Box>

      <Card sx={{ p: 2 }}>
        <Stack spacing={2}>
          <TextField label="Buscar factura" placeholder="Factura, cliente o cajero" value={search} onChange={(event) => setSearch(event.target.value)} />

          {loading ? (
            <Alert severity="info">Cargando ventas...</Alert>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Factura</TableCell>
                    <TableCell>Cliente</TableCell>
                    <TableCell>Cajero</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell align="right">Items</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {salesPagination.paginatedRows.map((sale) => (
                    <TableRow key={sale.id} hover>
                      <TableCell>{sale.invoiceNumber}</TableCell>
                      <TableCell>{sale.customer}</TableCell>
                      <TableCell>{sale.cashier}</TableCell>
                      <TableCell><Chip size="small" label={estadoVentaLabel(sale.status)} variant="outlined" /></TableCell>
                      <TableCell align="right">{sale.itemsCount}</TableCell>
                      <TableCell align="right">{currency(sale.total)}</TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => void handleOpenSale(sale.id)}>Ver factura</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredSales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">No hay ventas para mostrar.</TableCell>
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
          )}
        </Stack>
      </Card>

      <SaleReceiptDialog
        open={Boolean(selectedSale)}
        sale={selectedSale}
        onClose={() => setSelectedSale(null)}
        onPrint={(template) => void handlePrint(template)}
        printing={printing}
        canPrint={canPrintSales}
      />
    </Stack>
  );
}
