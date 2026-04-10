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
type CorrespondentPlatform = Awaited<ReturnType<typeof window.api.getCorrespondentCatalog>>["platforms"][number];
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

function saleCollectionStatusLabel(status: AccountingSummary["sales"][number]["collectionStatus"]) {
  if (status === "PAID") return "Cobrada";
  if (status === "PARTIAL") return "Cobro parcial";
  if (status === "RETURNED") return "Devuelta";
  return "Pendiente";
}

function expenseTypeLabel(type: AccountingSummary["expenses"][number]["type"]) {
  return type === "WITHDRAWAL_OUT" ? "Retiro" : "Gasto";
}

export default function AccountingView() {
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [data, setData] = useState<AccountingSummary | null>(null);
  const [correspondentPlatforms, setCorrespondentPlatforms] = useState<CorrespondentPlatform[]>([]);
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
  const [expenseSourceMedium, setExpenseSourceMedium] = useState<"CASH" | "TRANSFER" | "CORRESPONDENT">("CASH");
  const [expenseSourcePlatformId, setExpenseSourcePlatformId] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const [response, correspondentResponse] = await Promise.all([
        window.api.getAccountingSummary({
          dateFrom: new Date(`${dateFrom}T00:00:00`).toISOString(),
          dateTo: new Date(`${dateTo}T23:59:59`).toISOString(),
        }),
        window.api.getCorrespondentCatalog(),
      ]);
      if (!response.success) throw new Error(response.message || "No se pudo cargar la contabilidad");
      if (!correspondentResponse.success) throw new Error(correspondentResponse.message || "No se pudo cargar el catalogo de corresponsales");
      setData(response);
      setCorrespondentPlatforms(correspondentResponse.platforms);
    } catch (error) {
      setFeedback({ severity: "error", message: error instanceof Error ? error.message : "No se pudo cargar la contabilidad" });
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
    if (!creditSaleId && availableSalesForCredit.length > 0) setCreditSaleId(availableSalesForCredit[0].id);
    if (creditSaleId && !availableSalesForCredit.some((sale) => sale.id === creditSaleId)) setCreditSaleId(availableSalesForCredit[0]?.id ?? "");
    if (!paymentCreditId && pendingCredits.length > 0) setPaymentCreditId(pendingCredits[0].id);
    if (paymentCreditId && !pendingCredits.some((credit) => credit.id === paymentCreditId)) setPaymentCreditId(pendingCredits[0]?.id ?? "");
    if (!creditNoteSaleId && availableSalesForCreditNote.length > 0) setCreditNoteSaleId(availableSalesForCreditNote[0].id);
    if (creditNoteSaleId && !availableSalesForCreditNote.some((sale) => sale.id === creditNoteSaleId)) setCreditNoteSaleId(availableSalesForCreditNote[0]?.id ?? "");
  }, [availableSalesForCredit, availableSalesForCreditNote, creditNoteSaleId, creditSaleId, paymentCreditId, pendingCredits]);

  const selectedSaleForCredit = availableSalesForCredit.find((sale) => sale.id === creditSaleId) ?? null;
  const selectedCredit = pendingCredits.find((credit) => credit.id === paymentCreditId) ?? null;
  const selectedSaleForCreditNote = availableSalesForCreditNote.find((sale) => sale.id === creditNoteSaleId) ?? null;

  useEffect(() => {
    if (selectedSaleForCredit?.customerId) setCreditCustomerId((current) => current || selectedSaleForCredit.customerId || "");
  }, [selectedSaleForCredit?.customerId]);

  useEffect(() => {
    if (selectedSaleForCredit && !creditAmount) setCreditAmount(String(selectedSaleForCredit.availableCreditTotal));
  }, [creditAmount, selectedSaleForCredit]);

  useEffect(() => {
    if (selectedCredit && !paymentAmount) setPaymentAmount(String(selectedCredit.balance));
  }, [paymentAmount, selectedCredit]);

  useEffect(() => {
    if (selectedSaleForCreditNote && !creditNoteAmount) setCreditNoteAmount(String(selectedSaleForCreditNote.availableCreditNoteTotal));
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
    setFeedback({ severity: response.success ? "success" : "error", message: response.message || (response.success ? "Cuenta por cobrar creada correctamente." : "No se pudo crear la cartera.") });
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
    setFeedback({ severity: response.success ? "success" : "error", message: response.message || (response.success ? "Abono registrado correctamente." : "No se pudo registrar el abono.") });
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
    setFeedback({ severity: response.success ? "success" : "error", message: response.message || (response.success ? "Nota credito registrada correctamente." : "No se pudo registrar la nota credito.") });
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
    if (expenseSourceMedium === "CORRESPONDENT" && !expenseSourcePlatformId) {
      setFeedback({ severity: "error", message: "Selecciona el corresponsal desde el que sale el dinero." });
      return false;
    }
    const response = await window.api.createAccountingExpense({
      amount,
      note: expenseNote.trim(),
      type: expenseType,
      sourceMedium: expenseSourceMedium,
      sourcePlatformId: expenseSourceMedium === "CORRESPONDENT" ? expenseSourcePlatformId || null : null,
    });
    setFeedback({ severity: response.success ? "success" : "error", message: response.message || (response.success ? "Salida registrada correctamente." : "No se pudo registrar la salida.") });
    if (response.success) {
      setExpenseAmount("");
      setExpenseNote("");
      setExpenseSourceMedium("CASH");
      setExpenseSourcePlatformId("");
      await loadData();
    }
    return response.success;
  }

  if (loading && !data) {
    return <Stack spacing={3}><Box display="flex" alignItems="center" gap={0.5}><Typography variant="h4">Centro contable</Typography><HelpHint title="Consolida ventas, cartera, cobros, ajustes y gastos conectados con la operacion real del negocio." /></Box><Alert severity="info">Cargando centro contable...</Alert></Stack>;
  }

  return (
    <Stack spacing={3}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={2} flexWrap="wrap">
        <Box display="flex" alignItems="center" gap={0.5}>
          <Typography variant="h4">Centro contable</Typography>
          <HelpHint title="Une ventas contabilizadas, cartera, cobros, ajustes sobre ventas, salidas operativas y trazabilidad de movimientos en una sola vista financiera." />
        </Box>
        <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(2, minmax(180px, 1fr))" }} gap={1}>
          <TextField label="Fecha inicial" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} InputLabelProps={{ shrink: true }} size="small" />
          <TextField label="Fecha final" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} InputLabelProps={{ shrink: true }} size="small" />
        </Box>
      </Box>

      <FloatingAlert feedback={feedback} onClose={() => setFeedback(null)} />

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(6, 1fr)" }} gap={2}>
        <MetricCard title="Ventas contabilizadas" value={currency(data?.summary.salesTotal ?? 0)} helper={`${data?.summary.salesCount ?? 0} venta(s)`} />
        <MetricCard title="Cobrado al vender" value={currency(data?.summary.collectedSalesTotal ?? 0)} helper="Ingresos de venta aplicados al momento" />
        <MetricCard title="Pendiente por cobrar" value={currency(data?.summary.pendingCreditsBalance ?? 0)} helper={`${data?.summary.pendingCreditsCount ?? 0} cartera(s)`} />
        <MetricCard title="Cobrado por cartera" value={currency(data?.summary.collectionsTotal ?? 0)} helper="Recaudos posteriores" />
        <MetricCard title="Gastos operativos" value={currency(data?.summary.expensesTotal ?? 0)} helper="Salidas reales del negocio" />
        <MetricCard title="Balance operativo" value={currency(data?.summary.netOperationalBalance ?? 0)} helper="Resultado economico del periodo" />
      </Box>

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", xl: "1.4fr 1fr" }} gap={2}>
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Lectura financiera del periodo</Typography>
              <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(2, 1fr)" }} gap={2}>
                <ReadOnlyField label="Ingresos operativos reales" value={currency(data?.summary.operationalIncomeTotal ?? 0)} />
                <ReadOnlyField label="Utilidad bruta operativa" value={currency(data?.summary.grossProfitTotal ?? 0)} />
                <ReadOnlyField label="Pendiente por cobrar" value={currency(data?.summary.pendingSalesBalance ?? 0)} />
                <ReadOnlyField label="Ticket promedio" value={currency(data?.summary.averageTicket ?? 0)} />
                <ReadOnlyField label="Notas credito y devoluciones" value={currency(data?.summary.creditNotesTotal ?? 0)} />
                <ReadOnlyField label="Resultado operativo" value={currency(data?.summary.netOperationalBalance ?? 0)} />
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Medios de pago</Typography>
              {(data?.paymentSummary ?? []).map((item) => (
                <Box key={item.method} display="flex" justifyContent="space-between" gap={2}>
                  <Box>
                    <Typography variant="body2" fontWeight={700}>{item.label}</Typography>
                    <Typography variant="caption" color="text.secondary">Ventas {currency(item.salesAmount)} | Cartera {currency(item.collectionsAmount)}</Typography>
                  </Box>
                  <Typography variant="body2" fontWeight={700}>{currency(item.totalAmount)}</Typography>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Box>

      <Alert severity="info">
        Centro contable operativo activo. Siguiente capa recomendada: ingresos no operacionales, egresos no operacionales, movimientos internos entre medios, trazabilidad de anulaciones y conciliacion diaria contra caja general.
      </Alert>

      <Card><CardContent sx={{ pb: 1 }}><Tabs value={activeTab} onChange={(_event, value) => setActiveTab(value)} variant="scrollable" scrollButtons="auto"><Tab label="Centro de control" /><Tab label="Ventas y cobros" /><Tab label="Cartera" /><Tab label="Ajustes y devoluciones" /><Tab label="Gastos y salidas" /></Tabs></CardContent></Card>

      {activeTab === 0 ? (
        <AccountingTableCard title="Historial de movimientos contables" description="Traza que paso con el dinero de las ventas: ingreso por venta, cobros a cartera, ajustes y salidas operativas.">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Fecha</TableCell>
                <TableCell>Categoria</TableCell>
                <TableCell>Movimiento</TableCell>
                <TableCell>Medio</TableCell>
                <TableCell>Referencia</TableCell>
                <TableCell align="right">Impacto</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data?.movementHistory ?? []).map((movement) => (
                <TableRow key={movement.id} hover>
                  <TableCell>{new Date(movement.createdAt).toLocaleString("es-CO")}</TableCell>
                  <TableCell>{movement.category}</TableCell>
                  <TableCell><Typography variant="body2" fontWeight={700}>{movement.title}</Typography><Typography variant="caption" color="text.secondary">{movement.detail}</Typography></TableCell>
                  <TableCell>{movement.medium}</TableCell>
                  <TableCell>{movement.reference ?? "Sin referencia"}</TableCell>
                  <TableCell align="right" sx={{ color: movement.direction === "OUT" ? "error.main" : "success.main", fontWeight: 700 }}>{currency(movement.operationalImpact)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AccountingTableCard>
      ) : null}

      {activeTab === 1 ? (
        <AccountingTableCard title="Ventas contabilizadas y estado de cobro" description="Muestra cuanto se vendio, cuanto se cobro realmente y cuanto quedo pendiente por cliente y factura.">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Fecha</TableCell>
                <TableCell>Factura</TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell>Estado de cobro</TableCell>
                <TableCell>Medios</TableCell>
                <TableCell align="right">Venta</TableCell>
                <TableCell align="right">Cobrado</TableCell>
                <TableCell align="right">Pendiente</TableCell>
                <TableCell align="right">Utilidad bruta</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data?.sales ?? []).map((sale) => (
                <TableRow key={sale.id} hover>
                  <TableCell>{new Date(sale.createdAt).toLocaleString("es-CO")}</TableCell>
                  <TableCell>{sale.invoiceNumber}</TableCell>
                  <TableCell>{sale.customer}</TableCell>
                  <TableCell>{saleCollectionStatusLabel(sale.collectionStatus)}</TableCell>
                  <TableCell>{sale.paymentSummary}</TableCell>
                  <TableCell align="right">{currency(sale.total)}</TableCell>
                  <TableCell align="right">{currency(sale.paidAtSale)}</TableCell>
                  <TableCell align="right">{currency(sale.pendingAmount)}</TableCell>
                  <TableCell align="right">{currency(sale.grossProfit)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AccountingTableCard>
      ) : null}

      {activeTab === 2 ? (
        <Stack spacing={2}>
          <AccountingTableCard title="Cuentas por cobrar" description="Convierte ventas pendientes en cartera y controla saldo, vencimiento y cliente asociado." actionLabel="Crear cuenta por cobrar" onAction={() => setCreditDialogOpen(true)}>
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
              </TableBody>
            </Table>
          </AccountingTableCard>

          <AccountingTableCard title="Abonos e ingresos aplicados a cartera" description="Registra recaudos posteriores y deja trazado en que factura se aplico y por que medio ingreso el dinero." actionLabel="Registrar abono" onAction={() => setPaymentDialogOpen(true)}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Cliente</TableCell>
                  <TableCell>Factura</TableCell>
                  <TableCell>Metodo</TableCell>
                  <TableCell>Detalle</TableCell>
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
                    <TableCell>{payment.note || "Sin detalle"}</TableCell>
                    <TableCell align="right">{currency(payment.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AccountingTableCard>
        </Stack>
      ) : null}

      {activeTab === 3 ? (
        <AccountingTableCard title="Notas credito y ajustes sobre ventas" description="Registra devoluciones o correcciones que afectan el valor de la venta y el resultado del negocio." actionLabel="Registrar nota credito" onAction={() => setCreditNoteDialogOpen(true)}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Fecha</TableCell>
                <TableCell>Factura</TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell>Motivo</TableCell>
                <TableCell align="right">Valor</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data?.creditNotes ?? []).map((note) => (
                <TableRow key={note.id} hover>
                  <TableCell>{new Date(note.createdAt).toLocaleString("es-CO")}</TableCell>
                  <TableCell>{note.invoiceNumber}</TableCell>
                  <TableCell>{note.customerName}</TableCell>
                  <TableCell>{note.reason || "Ajuste sin detalle"}</TableCell>
                  <TableCell align="right">{currency(note.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AccountingTableCard>
      ) : null}

      {activeTab === 4 ? (
        <AccountingTableCard title="Gastos del negocio y salidas operativas" description="Controla egresos que afectaron el dinero del negocio e identifica desde que medio salio cada valor." actionLabel="Registrar salida" onAction={() => setExpenseDialogOpen(true)}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Fecha</TableCell>
                <TableCell>Caja</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Medio</TableCell>
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
                  <TableCell>{expense.sourceMedium === "CORRESPONDENT" ? expense.sourcePlatform || "Corresponsal" : expense.sourceMedium === "TRANSFER" ? "Transferencias" : "Efectivo"}</TableCell>
                  <TableCell>{expense.note || "Sin detalle"}</TableCell>
                  <TableCell align="right">{currency(expense.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AccountingTableCard>
      ) : null}

      <CreditDialog open={creditDialogOpen} onClose={() => setCreditDialogOpen(false)} sales={availableSalesForCredit} customers={availableCustomers} creditSaleId={creditSaleId} setCreditSaleId={setCreditSaleId} creditCustomerId={creditCustomerId} setCreditCustomerId={setCreditCustomerId} creditAmount={creditAmount} setCreditAmount={setCreditAmount} creditDueDate={creditDueDate} setCreditDueDate={setCreditDueDate} onSubmit={handleCreateCredit} />
      <PaymentDialog open={paymentDialogOpen} onClose={() => setPaymentDialogOpen(false)} credits={pendingCredits} paymentCreditId={paymentCreditId} setPaymentCreditId={setPaymentCreditId} paymentAmount={paymentAmount} setPaymentAmount={setPaymentAmount} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} paymentNote={paymentNote} setPaymentNote={setPaymentNote} onSubmit={handleCreatePayment} />
      <CreditNoteDialog open={creditNoteDialogOpen} onClose={() => setCreditNoteDialogOpen(false)} sales={availableSalesForCreditNote} creditNoteSaleId={creditNoteSaleId} setCreditNoteSaleId={setCreditNoteSaleId} creditNoteAmount={creditNoteAmount} setCreditNoteAmount={setCreditNoteAmount} creditNoteReason={creditNoteReason} setCreditNoteReason={setCreditNoteReason} onSubmit={handleCreateCreditNote} />
      <ExpenseDialog open={expenseDialogOpen} onClose={() => setExpenseDialogOpen(false)} expenseAmount={expenseAmount} setExpenseAmount={setExpenseAmount} expenseType={expenseType} setExpenseType={setExpenseType} expenseSourceMedium={expenseSourceMedium} setExpenseSourceMedium={setExpenseSourceMedium} expenseSourcePlatformId={expenseSourcePlatformId} setExpenseSourcePlatformId={setExpenseSourcePlatformId} correspondentPlatforms={correspondentPlatforms} expenseNote={expenseNote} setExpenseNote={setExpenseNote} onSubmit={handleCreateExpense} />
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
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box display="flex" justifyContent="space-between" alignItems="center" gap={1} flexWrap="wrap">
            <Box>
              <Typography variant="h6">{title}</Typography>
              <Typography variant="body2" color="text.secondary">{description}</Typography>
            </Box>
            {actionLabel && onAction ? <Button variant="contained" size="small" onClick={onAction}>{actionLabel}</Button> : null}
          </Box>
          <Box sx={{ overflowX: "auto" }}>{children}</Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function MetricCard({ title, value, helper }: { title: string; value: string; helper: string }) {
  return <Card><CardContent><Typography variant="body2" color="text.secondary">{title}</Typography><Typography variant="h5" sx={{ mt: 1, fontWeight: 700 }}>{value}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{helper}</Typography></CardContent></Card>;
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return <TextField label={label} value={value} InputProps={{ readOnly: true }} fullWidth />;
}

function CreditDialog(props: {
  open: boolean;
  onClose: () => void;
  sales: AccountingSummary["sales"];
  customers: AccountingSummary["customers"];
  creditSaleId: string;
  setCreditSaleId: React.Dispatch<React.SetStateAction<string>>;
  creditCustomerId: string;
  setCreditCustomerId: React.Dispatch<React.SetStateAction<string>>;
  creditAmount: string;
  setCreditAmount: React.Dispatch<React.SetStateAction<string>>;
  creditDueDate: string;
  setCreditDueDate: React.Dispatch<React.SetStateAction<string>>;
  onSubmit: () => Promise<boolean>;
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="sm">
      <DialogTitle>Crear cuenta por cobrar</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField select label="Venta" value={props.creditSaleId} onChange={(event) => { props.setCreditSaleId(event.target.value); props.setCreditAmount(""); }} size="small" fullWidth>
            {props.sales.map((sale) => <MenuItem key={sale.id} value={sale.id}>{sale.invoiceNumber} | {sale.customer} | {currency(sale.availableCreditTotal)}</MenuItem>)}
          </TextField>
          <TextField select label="Cliente" value={props.creditCustomerId} onChange={(event) => props.setCreditCustomerId(event.target.value)} size="small" fullWidth>
            {props.customers.map((customer) => <MenuItem key={customer.id} value={customer.id}>{customer.internalCode ? `${customer.internalCode} | ` : ""}{customer.name}</MenuItem>)}
          </TextField>
          <TextField label="Valor a cartera" value={props.creditAmount} onChange={(event) => props.setCreditAmount(event.target.value.replace(/\D/g, ""))} size="small" fullWidth />
          <TextField label="Vencimiento" type="date" value={props.creditDueDate} onChange={(event) => props.setCreditDueDate(event.target.value)} InputLabelProps={{ shrink: true }} size="small" fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={props.onClose}>Cancelar</Button><Button variant="contained" onClick={async () => { const success = await props.onSubmit(); if (success) props.onClose(); }}>Crear cartera</Button></DialogActions>
    </Dialog>
  );
}

function PaymentDialog(props: {
  open: boolean;
  onClose: () => void;
  credits: AccountingSummary["credits"];
  paymentCreditId: string;
  setPaymentCreditId: React.Dispatch<React.SetStateAction<string>>;
  paymentAmount: string;
  setPaymentAmount: React.Dispatch<React.SetStateAction<string>>;
  paymentMethod: "CASH" | "TRANSFER";
  setPaymentMethod: React.Dispatch<React.SetStateAction<"CASH" | "TRANSFER">>;
  paymentNote: string;
  setPaymentNote: React.Dispatch<React.SetStateAction<string>>;
  onSubmit: () => Promise<boolean>;
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="sm">
      <DialogTitle>Registrar abono</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField select label="Cuenta por cobrar" value={props.paymentCreditId} onChange={(event) => { props.setPaymentCreditId(event.target.value); props.setPaymentAmount(""); }} size="small" fullWidth>
            {props.credits.map((credit) => <MenuItem key={credit.id} value={credit.id}>{credit.invoiceNumber} | {credit.customerName} | saldo {currency(credit.balance)}</MenuItem>)}
          </TextField>
          <TextField label="Valor del abono" value={props.paymentAmount} onChange={(event) => props.setPaymentAmount(event.target.value.replace(/\D/g, ""))} size="small" fullWidth />
          <TextField select label="Metodo" value={props.paymentMethod} onChange={(event) => props.setPaymentMethod(event.target.value as "CASH" | "TRANSFER")} size="small" fullWidth>
            <MenuItem value="CASH">Efectivo</MenuItem>
            <MenuItem value="TRANSFER">Transferencia</MenuItem>
          </TextField>
          <TextField label="Detalle" value={props.paymentNote} onChange={(event) => props.setPaymentNote(event.target.value)} size="small" fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={props.onClose}>Cancelar</Button><Button variant="contained" onClick={async () => { const success = await props.onSubmit(); if (success) props.onClose(); }}>Registrar abono</Button></DialogActions>
    </Dialog>
  );
}

function CreditNoteDialog(props: {
  open: boolean;
  onClose: () => void;
  sales: AccountingSummary["sales"];
  creditNoteSaleId: string;
  setCreditNoteSaleId: React.Dispatch<React.SetStateAction<string>>;
  creditNoteAmount: string;
  setCreditNoteAmount: React.Dispatch<React.SetStateAction<string>>;
  creditNoteReason: string;
  setCreditNoteReason: React.Dispatch<React.SetStateAction<string>>;
  onSubmit: () => Promise<boolean>;
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="sm">
      <DialogTitle>Registrar nota credito</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField select label="Venta" value={props.creditNoteSaleId} onChange={(event) => { props.setCreditNoteSaleId(event.target.value); props.setCreditNoteAmount(""); }} size="small" fullWidth>
            {props.sales.map((sale) => <MenuItem key={sale.id} value={sale.id}>{sale.invoiceNumber} | {sale.customer} | disponible {currency(sale.availableCreditNoteTotal)}</MenuItem>)}
          </TextField>
          <TextField label="Valor de la nota" value={props.creditNoteAmount} onChange={(event) => props.setCreditNoteAmount(event.target.value.replace(/\D/g, ""))} size="small" fullWidth />
          <TextField label="Motivo" value={props.creditNoteReason} onChange={(event) => props.setCreditNoteReason(event.target.value)} size="small" multiline minRows={2} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={props.onClose}>Cancelar</Button><Button variant="contained" onClick={async () => { const success = await props.onSubmit(); if (success) props.onClose(); }}>Registrar nota credito</Button></DialogActions>
    </Dialog>
  );
}

function ExpenseDialog(props: {
  open: boolean;
  onClose: () => void;
  expenseAmount: string;
  setExpenseAmount: React.Dispatch<React.SetStateAction<string>>;
  expenseType: "EXPENSE_OUT" | "WITHDRAWAL_OUT";
  setExpenseType: React.Dispatch<React.SetStateAction<"EXPENSE_OUT" | "WITHDRAWAL_OUT">>;
  expenseSourceMedium: "CASH" | "TRANSFER" | "CORRESPONDENT";
  setExpenseSourceMedium: React.Dispatch<React.SetStateAction<"CASH" | "TRANSFER" | "CORRESPONDENT">>;
  expenseSourcePlatformId: string;
  setExpenseSourcePlatformId: React.Dispatch<React.SetStateAction<string>>;
  correspondentPlatforms: CorrespondentPlatform[];
  expenseNote: string;
  setExpenseNote: React.Dispatch<React.SetStateAction<string>>;
  onSubmit: () => Promise<boolean>;
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="sm">
      <DialogTitle>Registrar salida</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Valor" value={props.expenseAmount} onChange={(event) => props.setExpenseAmount(event.target.value.replace(/\D/g, ""))} size="small" fullWidth />
          <TextField select label="Tipo" value={props.expenseType} onChange={(event) => props.setExpenseType(event.target.value as "EXPENSE_OUT" | "WITHDRAWAL_OUT")} size="small" fullWidth>
            <MenuItem value="EXPENSE_OUT">Gasto operativo</MenuItem>
            <MenuItem value="WITHDRAWAL_OUT">Retiro de caja</MenuItem>
          </TextField>
          <TextField select label="Medio de salida" value={props.expenseSourceMedium} onChange={(event) => { const nextValue = event.target.value as "CASH" | "TRANSFER" | "CORRESPONDENT"; props.setExpenseSourceMedium(nextValue); if (nextValue !== "CORRESPONDENT") props.setExpenseSourcePlatformId(""); }} size="small" fullWidth>
            <MenuItem value="CASH">Efectivo</MenuItem>
            <MenuItem value="TRANSFER">Transferencias</MenuItem>
            <MenuItem value="CORRESPONDENT">Corresponsal</MenuItem>
          </TextField>
          {props.expenseSourceMedium === "CORRESPONDENT" ? <TextField select label="Plataforma corresponsal" value={props.expenseSourcePlatformId} onChange={(event) => props.setExpenseSourcePlatformId(event.target.value)} size="small" fullWidth>{props.correspondentPlatforms.map((platform) => <MenuItem key={platform.id} value={platform.id}>{platform.name}</MenuItem>)}</TextField> : null}
          <TextField label="Descripcion" value={props.expenseNote} onChange={(event) => props.setExpenseNote(event.target.value)} size="small" multiline minRows={2} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={props.onClose}>Cancelar</Button><Button variant="contained" onClick={async () => { const success = await props.onSubmit(); if (success) props.onClose(); }}>Registrar salida</Button></DialogActions>
    </Dialog>
  );
}
