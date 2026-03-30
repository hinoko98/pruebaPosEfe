import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { metodoPagoLabel } from "@/lib/display";

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
  onPrint: () => void;
  printing?: boolean;
  canPrint?: boolean;
}) {
  if (!sale) return null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Factura {sale.invoiceNumber}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="success">
            Puedes revisar la factura aquí mismo o mandarla a imprimir sin ir al historial.
          </Alert>

          <Stack spacing={0.5}>
            <Typography variant="body2" color="text.secondary">Cliente: {sale.customer}</Typography>
            <Typography variant="body2" color="text.secondary">Fecha: {new Date(sale.createdAt).toLocaleString("es-CO")}</Typography>
            <Typography variant="body2" color="text.secondary">Cajero: {sale.cashier}</Typography>
            <Typography variant="body2" color="text.secondary">Pago: {paymentSummary(sale)}</Typography>
          </Stack>

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
              {sale.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell align="right">{item.qty}</TableCell>
                  <TableCell align="right">{currency(item.price)}</TableCell>
                  <TableCell align="right">{currency(item.lineTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

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
          <Button variant="contained" onClick={onPrint} disabled={printing}>
            {printing ? "Imprimiendo..." : "Imprimir"}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
