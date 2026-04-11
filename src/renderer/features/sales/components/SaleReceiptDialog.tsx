import { useEffect, useState } from "react";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { useTablePagination } from "@/hooks/useTablePagination";
import { metodoPagoLabel } from "@/lib/display";

export type ReceiptPrintTemplate = "NORMAL" | "THERMAL_80" | "THERMAL_50";

type SaleDetail = NonNullable<Awaited<ReturnType<typeof window.api.getSaleDetail>>["sale"]>;

function currency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function paymentSummary(sale: SaleDetail) {
  if (sale.payments.length <= 1) return metodoPagoLabel(sale.paymentMethod);
  return sale.payments.map((payment) => `${metodoPagoLabel(payment.method)} ${currency(payment.amount)}`).join(" + ");
}

function printTemplateLabel(value: ReceiptPrintTemplate) {
  if (value === "THERMAL_80") return "Termica 80 mm";
  if (value === "THERMAL_50") return "Termica 50 mm";
  return "Impresora normal";
}

export default function SaleReceiptDialog({
  open,
  sale,
  onClose,
  onPrint,
  printing,
  canPrint = true,
}: {
  open: boolean;
  sale: SaleDetail | null;
  onClose: () => void;
  onPrint: (template: ReceiptPrintTemplate) => void;
  printing?: boolean;
  canPrint?: boolean;
}) {
  const [printTemplate, setPrintTemplate] = useState<ReceiptPrintTemplate>("NORMAL");
  const itemsPagination = useTablePagination(sale?.items ?? []);

  useEffect(() => {
    let active = true;

    async function loadDefaultTemplate() {
      if (!open) return;

      const response = await window.api.getBusinessSettings();
      if (!active || !response.success || !response.settings) return;

      setPrintTemplate(response.settings.defaultReceiptTemplate || "NORMAL");
    }

    void loadDefaultTemplate();

    return () => {
      active = false;
    };
  }, [open]);

  if (!sale) return null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Factura {sale.invoiceNumber}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="success">
            Puedes revisar la factura aqui mismo y elegir el formato antes de enviarla a impresion.
          </Alert>

          <Stack spacing={0.5}>
            <Typography variant="body2" color="text.secondary">Cliente: {sale.customer}</Typography>
            <Typography variant="body2" color="text.secondary">Fecha: {new Date(sale.createdAt).toLocaleString("es-CO")}</Typography>
            <Typography variant="body2" color="text.secondary">Cajero: {sale.cashier}</Typography>
            <Typography variant="body2" color="text.secondary">Pago: {paymentSummary(sale)}</Typography>
          </Stack>

          {canPrint ? (
            <TextField
              select
              label="Tipo de impresion"
              value={printTemplate}
              onChange={(event) => setPrintTemplate(event.target.value as ReceiptPrintTemplate)}
              helperText={`Se imprimira como ${printTemplateLabel(printTemplate)}.`}
            >
              <MenuItem value="NORMAL">Impresora normal</MenuItem>
              <MenuItem value="THERMAL_80">Termica 80 mm</MenuItem>
              <MenuItem value="THERMAL_50">Termica 50 mm</MenuItem>
            </TextField>
          ) : null}

          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Producto</TableCell>
                  <TableCell align="right">Cant.</TableCell>
                  <TableCell align="right">Precio</TableCell>
                  <TableCell align="right">Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {itemsPagination.paginatedRows.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell align="right">{item.qty}</TableCell>
                    <TableCell align="right">{currency(item.price)}</TableCell>
                    <TableCell align="right">{currency(item.lineTotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={sale.items.length}
              page={itemsPagination.page}
              onPageChange={itemsPagination.handleChangePage}
              rowsPerPage={itemsPagination.rowsPerPage}
              onRowsPerPageChange={itemsPagination.handleChangeRowsPerPage}
              rowsPerPageOptions={[10, 15]}
              labelRowsPerPage="Filas"
            />
          </Box>

          <Stack spacing={0.5} alignItems="flex-end">
            <Typography variant="body2">Subtotal: {currency(sale.subtotal)}</Typography>
            <Typography variant="body2">Impuestos: {currency(sale.tax)}</Typography>
            <Typography variant="h6">Total: {currency(sale.total)}</Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
        {canPrint ? (
          <Button variant="contained" onClick={() => onPrint(printTemplate)} disabled={printing}>
            {printing ? "Imprimiendo..." : "Imprimir"}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
