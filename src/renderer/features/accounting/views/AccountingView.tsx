import { useEffect, useMemo, useState } from "react";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import FloatingAlert from "@/components/feedback/FloatingAlert";
import HelpHint from "@/components/ui/HelpHint";
import { metodoPagoLabel } from "@/lib/display";

type AccountingSummary = Awaited<ReturnType<typeof window.api.getAccountingSummary>>;
type FeedbackState = { severity: "success" | "error" | "info"; message: string } | null;

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

function creditStatusLabel(status: AccountingSummary["credits"][number]["status"]) {
  if (status === "PARTIAL") return "Abono parcial";
  if (status === "PAID") return "Pagada";
  if (status === "OVERDUE") return "Vencida";
  if (status === "CANCELLED") return "Cancelada";
  return "Pendiente";
}

function expenseTypeLabel(type: AccountingSummary["expenses"][number]["type"]) {
  return type === "WITHDRAWAL_OUT" ? "Retiro" : "Gasto";
}

export default function AccountingView() {
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [data, setData] = useState<AccountingSummary | null>(null);
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date();
    return toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [dateTo, setDateTo] = useState(() => toDateInputValue());
  const [activeTab, setActiveTab] = useState(0);

  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [creditNoteDialogOpen, setCreditNoteDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);

  const [creditSaleId, setCreditSaleId] = useState("");
  const [creditCustomerId, setCreditCustomerId] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditDueDate, setCreditDueDate] = useState("");

  const [paymentCreditId, setPaymentCreditId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TRANSFER">("CASH");
  const [paymentNote, setPaymentNote] = useState("");

  const [creditNoteSaleId, setCreditNoteSaleId] = useState("");
  const [creditNoteAmount, setCreditNoteAmount] = useState("");
  const [creditNoteReason, setCreditNoteReason] = useState("");

  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseNote, setExpenseNote] = useState("");
  const [expenseType, setExpenseType] = useState<"EXPENSE_OUT" | "WITHDRAWAL_OUT">("EXPENSE_OUT");

  async function loadData() {
    setLoading(true);
    try {
      const response = await window.api.getAccountingSummary({
        dateFrom: new Date(`${dateFrom}T00:00:00`).toISOString(),
        dateTo: new Date(`${dateTo}T23:59:59`).toISOString(),
      });

      if (!response.success) {
        throw new Error(response.message || "No se pudo cargar la contabilidad");
      }

      setData(response);
    } catch (error) {
      setFeedback({
        severity: "error",
        message: error instanceof Error ? error.message : "No se pudo cargar la contabilidad",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [dateFrom, dateTo]);

  const availableSalesForCredit = useMemo(
    () => (data?.sales ?? []).filter((sale) => !sale.credit && sale.availableCreditTotal > 0),
    [data?.sales]
  );
  const availableCustomers = data?.customers ?? [];
  const pendingCredits = useMemo(
    () => (data?.credits ?? []).filter((credit) => credit.balance > 0 && credit.status !== "CANCELLED"),
    [data?.credits]
  );
  const availableSalesForCreditNote = useMemo(
    () => (data?.sales ?? []).filter((sale) => sale.availableCreditNoteTotal > 0),
    [data?.sales]
  );

  useEffect(() => {
    if (!creditSaleId && availableSalesForCredit.length > 0) {
      setCreditSaleId(availableSalesForCredit[0].id);
    }
    if (creditSaleId && !availableSalesForCredit.some((sale) => sale.id === creditSaleId)) {
      setCreditSaleId(availableSalesForCredit[0]?.id ?? "");
    }
    if (!paymentCreditId && pendingCredits.length > 0) {
      setPaymentCreditId(pendingCredits[0].id);
    }
    if (paymentCreditId && !pendingCredits.some((credit) => credit.id === paymentCreditId)) {
      setPaymentCreditId(pendingCredits[0]?.id ?? "");
    }
    if (!creditNoteSaleId && availableSalesForCreditNote.length > 0) {
      setCreditNoteSaleId(availableSalesForCreditNote[0].id);
    }
    if (creditNoteSaleId && !availableSalesForCreditNote.some((sale) => sale.id === creditNoteSaleId)) {
      setCreditNoteSaleId(availableSalesForCreditNote[0]?.id ?? "");
    }
  }, [
    availableSalesForCredit,
    availableSalesForCreditNote,
    creditNoteSaleId,
    creditSaleId,
    paymentCreditId,
    pendingCredits,
  ]);

  const selectedSaleForCredit = availableSalesForCredit.find((sale) => sale.id === creditSaleId) ?? null;
  const selectedCredit = pendingCredits.find((credit) => credit.id === paymentCreditId) ?? null;
  const selectedSaleForCreditNote = availableSalesForCreditNote.find((sale) => sale.id === creditNoteSaleId) ?? null;

  useEffect(() => {
    if (selectedSaleForCredit?.customerId) {
      setCreditCustomerId((current) => current || selectedSaleForCredit.customerId || "");
    }
  }, [selectedSaleForCredit?.customerId]);

  useEffect(() => {
    if (selectedSaleForCredit && !creditAmount) {
      setCreditAmount(String(selectedSaleForCredit.availableCreditTotal));
    }
  }, [creditAmount, selectedSaleForCredit]);

  useEffect(() => {
    if (selectedCredit && !paymentAmount) {
      setPaymentAmount(String(selectedCredit.balance));
    }
  }, [paymentAmount, selectedCredit]);

  useEffect(() => {
    if (selectedSaleForCreditNote && !creditNoteAmount) {
      setCreditNoteAmount(String(selectedSaleForCreditNote.availableCreditNoteTotal));
    }
  }, [creditNoteAmount, selectedSaleForCreditNote]);

  async function handleCreateCredit() {
    if (!selectedSaleForCredit || !creditCustomerId) {
      setFeedback({ severity: "error", message: "Selecciona la venta y el cliente para crear la cartera." });
      return false;
    }

    const amount = Number(creditAmount || 0);
    if (amount <= 0) {
      setFeedback({ severity: "error", message: "Ingresa un valor valido para la cuenta por cobrar." });
      return false;
    }

    const response = await window.api.createAccountingCredit({
      saleId: selectedSaleForCredit.id,
      customerId: creditCustomerId,
      total: amount,
      dueDate: creditDueDate ? new Date(`${creditDueDate}T23:59:59`).toISOString() : null,
    });

    setFeedback({
      severity: response.success ? "success" : "error",
      message: response.message || (response.success ? "Cuenta por cobrar creada correctamente." : "No se pudo crear la cartera."),
    });

    if (response.success) {
      setCreditAmount("");
      setCreditDueDate("");
      await loadData();
    }

    return response.success;
  }

  async function handleCreatePayment() {
    if (!selectedCredit) {
      setFeedback({ severity: "error", message: "Selecciona una cuenta por cobrar para registrar el abono." });
      return false;
    }

    const amount = Number(paymentAmount || 0);
    if (amount <= 0) {
      setFeedback({ severity: "error", message: "Ingresa un valor valido para el abono." });
      return false;
    }

    const response = await window.api.createAccountingPayment({
      creditId: selectedCredit.id,
      amount,
      method: paymentMethod,
      note: paymentNote.trim() || null,
    });

    setFeedback({
      severity: response.success ? "success" : "error",
      message: response.message || (response.success ? "Abono registrado correctamente." : "No se pudo registrar el abono."),
    });

    if (response.success) {
      setPaymentAmount("");
      setPaymentNote("");
      await loadData();
    }

    return response.success;
  }

  async function handleCreateCreditNote() {
    if (!selectedSaleForCreditNote) {
      setFeedback({ severity: "error", message: "Selecciona una venta para crear la nota credito." });
      return false;
    }

    const amount = Number(creditNoteAmount || 0);
    if (amount <= 0) {
      setFeedback({ severity: "error", message: "Ingresa un valor valido para la nota credito." });
      return false;
    }

    const response = await window.api.createAccountingCreditNote({
      saleId: selectedSaleForCreditNote.id,
      amount,
      reason: creditNoteReason.trim() || null,
    });

    setFeedback({
      severity: response.success ? "success" : "error",
      message:
        response.message || (response.success ? "Nota credito registrada correctamente." : "No se pudo registrar la nota credito."),
    });

    if (response.success) {
      setCreditNoteAmount("");
      setCreditNoteReason("");
      await loadData();
    }

    return response.success;
  }

  async function handleCreateExpense() {
    const amount = Number(expenseAmount || 0);
    if (amount <= 0 || expenseNote.trim().length < 2) {
      setFeedback({ severity: "error", message: "Ingresa valor y descripcion para registrar el gasto." });
      return false;
    }

    const response = await window.api.createAccountingExpense({
      amount,
      note: expenseNote.trim(),
      type: expenseType,
    });

    setFeedback({
      severity: response.success ? "success" : "error",
      message: response.message || (response.success ? "Gasto registrado correctamente." : "No se pudo registrar el gasto."),
    });

    if (response.success) {
      setExpenseAmount("");
      setExpenseNote("");
      await loadData();
    }

    return response.success;
  }

  if (loading && !data) {
    return (
      <Stack spacing={3}>
        <Box display="flex" alignItems="center" gap={0.5}>
          <Typography variant="h4">Contabilidad</Typography>
          <HelpHint title="Controla cartera, abonos, notas credito y gastos operativos usando datos reales de ventas y caja." />
        </Box>
        <Alert severity="info">Cargando contabilidad...</Alert>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={2} flexWrap="wrap">
        <Box display="flex" alignItems="center" gap={0.5}>
          <Typography variant="h4">Contabilidad</Typography>
          <HelpHint title="Gestiona cartera, abonos, notas credito y gastos operativos con trazabilidad directa sobre ventas y caja." />
        </Box>
        <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(2, minmax(180px, 1fr))" }} gap={1}>
          <TextField
            label="Fecha inicial"
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
          />
          <TextField
            label="Fecha final"
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
          />
        </Box>
      </Box>

      <FloatingAlert feedback={feedback} onClose={() => setFeedback(null)} />

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(5, 1fr)" }} gap={2}>
        <MetricCard title="Cartera pendiente" value={currency(data?.summary.pendingCreditsBalance ?? 0)} helper={`${data?.summary.pendingCreditsCount ?? 0} cuenta(s)`} />
        <MetricCard title="Abonos" value={currency(data?.summary.paymentsTotal ?? 0)} helper="Ingresos aplicados a cartera" />
        <MetricCard title="Notas credito" value={currency(data?.summary.creditNotesTotal ?? 0)} helper="Ajustes sobre ventas" />
        <MetricCard title="Gastos" value={currency(data?.summary.expensesTotal ?? 0)} helper="Salidas operativas desde caja" />
        <MetricCard title="Balance operativo" value={currency(data?.summary.netOperationalBalance ?? 0)} helper="Abonos menos ajustes y gastos" />
      </Box>

      <Card>
        <CardContent sx={{ pb: 1 }}>
          <Tabs value={activeTab} onChange={(_event, value) => setActiveTab(value)} variant="scrollable" scrollButtons="auto">
            <Tab label="Cartera" />
            <Tab label="Abonos" />
            <Tab label="Notas credito" />
            <Tab label="Gastos" />
          </Tabs>
        </CardContent>
      </Card>

      {activeTab === 0 ? (
        <AccountingTableCard
          title="Cuentas por cobrar"
          description="Pasa ventas pendientes a cartera y revisa su saldo desde una sola vista."
          actionLabel="Crear cuenta por cobrar"
          onAction={() => setCreditDialogOpen(true)}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Factura</TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="right">Saldo</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data?.credits ?? []).map((credit) => (
                <TableRow key={credit.id} hover>
                  <TableCell>{credit.invoiceNumber}</TableCell>
                  <TableCell>{credit.customerName}</TableCell>
                  <TableCell>{creditStatusLabel(credit.status)}</TableCell>
                  <TableCell align="right">{currency(credit.total)}</TableCell>
                  <TableCell align="right">{currency(credit.balance)}</TableCell>
                </TableRow>
              ))}
              {(data?.credits ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No hay cartera para el rango seleccionado.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </AccountingTableCard>
      ) : null}

      {activeTab === 1 ? (
        <AccountingTableCard
          title="Abonos registrados"
          description="Registra pagos parciales o totales sobre cartera activa."
          actionLabel="Registrar abono"
          onAction={() => setPaymentDialogOpen(true)}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Fecha</TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell>Factura</TableCell>
                <TableCell>Metodo</TableCell>
                <TableCell align="right">Valor</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data?.payments ?? []).map((payment) => (
                <TableRow key={payment.id} hover>
                  <TableCell>{new Date(payment.createdAt).toLocaleString("es-CO")}</TableCell>
                  <TableCell>{payment.customerName}</TableCell>
                  <TableCell>{payment.invoiceNumber ?? "Sin factura"}</TableCell>
                  <TableCell>{metodoPagoLabel(payment.method)}</TableCell>
                  <TableCell align="right">{currency(payment.amount)}</TableCell>
                </TableRow>
              ))}
              {(data?.payments ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No hay abonos para el rango seleccionado.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </AccountingTableCard>
      ) : null}

      {activeTab === 2 ? (
        <AccountingTableCard
          title="Notas credito"
          description="Aplica ajustes o devoluciones sobre ventas registradas."
          actionLabel="Registrar nota credito"
          onAction={() => setCreditNoteDialogOpen(true)}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Fecha</TableCell>
                <TableCell>Factura</TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell align="right">Valor</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data?.creditNotes ?? []).map((note) => (
                <TableRow key={note.id} hover>
                  <TableCell>{new Date(note.createdAt).toLocaleString("es-CO")}</TableCell>
                  <TableCell>{note.invoiceNumber}</TableCell>
                  <TableCell>{note.customerName}</TableCell>
                  <TableCell align="right">{currency(note.total)}</TableCell>
                </TableRow>
              ))}
              {(data?.creditNotes ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    No hay notas credito para el rango seleccionado.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </AccountingTableCard>
      ) : null}

      {activeTab === 3 ? (
        <AccountingTableCard
          title="Gastos y retiros"
          description="Controla salidas operativas ligadas a caja sin mezclarlas con corresponsal."
          actionLabel="Registrar salida"
          onAction={() => setExpenseDialogOpen(true)}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Fecha</TableCell>
                <TableCell>Caja</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Detalle</TableCell>
                <TableCell align="right">Valor</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data?.expenses ?? []).map((expense) => (
                <TableRow key={expense.id} hover>
                  <TableCell>{new Date(expense.createdAt).toLocaleString("es-CO")}</TableCell>
                  <TableCell>{expense.registerName}</TableCell>
                  <TableCell>{expenseTypeLabel(expense.type)}</TableCell>
                  <TableCell>{expense.note || "Sin detalle"}</TableCell>
                  <TableCell align="right">{currency(expense.amount)}</TableCell>
                </TableRow>
              ))}
              {(data?.expenses ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No hay gastos ni retiros para el rango seleccionado.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </AccountingTableCard>
      ) : null}

      <Dialog open={creditDialogOpen} onClose={() => setCreditDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Crear cuenta por cobrar</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              select
              label="Venta"
              value={creditSaleId}
              onChange={(event) => {
                setCreditSaleId(event.target.value);
                setCreditAmount("");
              }}
              size="small"
              fullWidth
            >
              {availableSalesForCredit.map((sale) => (
                <MenuItem key={sale.id} value={sale.id}>
                  {sale.invoiceNumber} | {sale.customer} | {currency(sale.availableCreditTotal)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Cliente"
              value={creditCustomerId}
              onChange={(event) => setCreditCustomerId(event.target.value)}
              size="small"
              fullWidth
            >
              {availableCustomers.map((customer) => (
                <MenuItem key={customer.id} value={customer.id}>
                  {customer.internalCode ? `${customer.internalCode} | ` : ""}
                  {customer.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Valor a cartera"
              value={creditAmount}
              onChange={(event) => setCreditAmount(event.target.value.replace(/\D/g, ""))}
              size="small"
              fullWidth
            />
            <TextField
              label="Vencimiento"
              type="date"
              value={creditDueDate}
              onChange={(event) => setCreditDueDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreditDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={async () => {
              const success = await handleCreateCredit();
              if (success) setCreditDialogOpen(false);
            }}
          >
            Crear cartera
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={paymentDialogOpen} onClose={() => setPaymentDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Registrar abono</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              select
              label="Cuenta por cobrar"
              value={paymentCreditId}
              onChange={(event) => {
                setPaymentCreditId(event.target.value);
                setPaymentAmount("");
              }}
              size="small"
              fullWidth
            >
              {pendingCredits.map((credit) => (
                <MenuItem key={credit.id} value={credit.id}>
                  {credit.invoiceNumber} | {credit.customerName} | saldo {currency(credit.balance)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Valor del abono"
              value={paymentAmount}
              onChange={(event) => setPaymentAmount(event.target.value.replace(/\D/g, ""))}
              size="small"
              fullWidth
            />
            <TextField
              select
              label="Metodo"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value as "CASH" | "TRANSFER")}
              size="small"
              fullWidth
            >
              <MenuItem value="CASH">Efectivo</MenuItem>
              <MenuItem value="TRANSFER">Transferencia</MenuItem>
            </TextField>
            <TextField
              label="Detalle"
              value={paymentNote}
              onChange={(event) => setPaymentNote(event.target.value)}
              size="small"
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={async () => {
              const success = await handleCreatePayment();
              if (success) setPaymentDialogOpen(false);
            }}
          >
            Registrar abono
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={creditNoteDialogOpen} onClose={() => setCreditNoteDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Registrar nota credito</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              select
              label="Venta"
              value={creditNoteSaleId}
              onChange={(event) => {
                setCreditNoteSaleId(event.target.value);
                setCreditNoteAmount("");
              }}
              size="small"
              fullWidth
            >
              {availableSalesForCreditNote.map((sale) => (
                <MenuItem key={sale.id} value={sale.id}>
                  {sale.invoiceNumber} | {sale.customer} | disponible {currency(sale.availableCreditNoteTotal)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Valor de la nota"
              value={creditNoteAmount}
              onChange={(event) => setCreditNoteAmount(event.target.value.replace(/\D/g, ""))}
              size="small"
              fullWidth
            />
            <TextField
              label="Motivo"
              value={creditNoteReason}
              onChange={(event) => setCreditNoteReason(event.target.value)}
              size="small"
              multiline
              minRows={2}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreditNoteDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={async () => {
              const success = await handleCreateCreditNote();
              if (success) setCreditNoteDialogOpen(false);
            }}
          >
            Registrar nota credito
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={expenseDialogOpen} onClose={() => setExpenseDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Registrar salida</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Valor"
              value={expenseAmount}
              onChange={(event) => setExpenseAmount(event.target.value.replace(/\D/g, ""))}
              size="small"
              fullWidth
            />
            <TextField
              select
              label="Tipo"
              value={expenseType}
              onChange={(event) => setExpenseType(event.target.value as "EXPENSE_OUT" | "WITHDRAWAL_OUT")}
              size="small"
              fullWidth
            >
              <MenuItem value="EXPENSE_OUT">Gasto operativo</MenuItem>
              <MenuItem value="WITHDRAWAL_OUT">Retiro de caja</MenuItem>
            </TextField>
            <TextField
              label="Descripcion"
              value={expenseNote}
              onChange={(event) => setExpenseNote(event.target.value)}
              size="small"
              multiline
              minRows={2}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExpenseDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={async () => {
              const success = await handleCreateExpense();
              if (success) setExpenseDialogOpen(false);
            }}
          >
            Registrar salida
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function AccountingTableCard({
  title,
  description,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box display="flex" justifyContent="space-between" alignItems="center" gap={1} flexWrap="wrap">
            <Box>
              <Typography variant="h6">{title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
            </Box>
            <Button variant="contained" size="small" onClick={onAction}>
              {actionLabel}
            </Button>
          </Box>
          <Box sx={{ overflowX: "auto" }}>{children}</Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function MetricCard({ title, value, helper }: { title: string; value: string; helper: string }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h5" sx={{ mt: 1, fontWeight: 700 }}>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {helper}
        </Typography>
      </CardContent>
    </Card>
  );
}
