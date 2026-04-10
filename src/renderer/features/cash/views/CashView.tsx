import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
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
import { useAuth } from "@/features/auth/hooks/useAuth";
import { hasPermission } from "@/features/auth/permissions";
import { APP_PERMISSION_KEYS } from "@/features/user/app-permissions";
import { useTablePagination } from "@/hooks/useTablePagination";

type CashSummary = Awaited<ReturnType<typeof window.api.getCashSummary>>;
type HistoryRow = CashSummary["recentSessions"][number];
type CatalogPlatform = Awaited<ReturnType<typeof window.api.getCorrespondentCatalog>>["platforms"][number];
type FeedbackState = { severity: "success" | "error" | "info"; message: string } | null;
type Denomination = { key: string; label: string; value: number };

const DENOMINATIONS: Denomination[] = [
  { key: "100000", label: "$100.000", value: 100000 },
  { key: "50000", label: "$50.000", value: 50000 },
  { key: "20000", label: "$20.000", value: 20000 },
  { key: "10000", label: "$10.000", value: 10000 },
  { key: "5000", label: "$5.000", value: 5000 },
  { key: "2000", label: "$2.000", value: 2000 },
  { key: "1000", label: "$1.000", value: 1000 },
  { key: "500", label: "$500", value: 500 },
  { key: "200", label: "$200", value: 200 },
  { key: "100", label: "$100", value: 100 },
  { key: "50", label: "$50", value: 50 },
];

const currency = (value: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
const emptyBreakdown = () => Object.fromEntries(DENOMINATIONS.map((item) => [item.key, 0])) as Record<string, number>;
const normalizeBreakdown = (source?: Record<string, number>) => ({ ...emptyBreakdown(), ...(source ?? {}) });
const breakdownTotal = (breakdown: Record<string, number>) =>
  DENOMINATIONS.reduce((sum, item) => sum + item.value * Number(breakdown[item.key] ?? 0), 0);
const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString("es-CO") : "Sin registro");
const differenceSeverity = (value: number): "success" | "info" | "warning" => (value === 0 ? "success" : value > 0 ? "info" : "warning");

export default function CashView() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [catalog, setCatalog] = useState<CatalogPlatform[]>([]);
  const [openingBreakdown, setOpeningBreakdown] = useState<Record<string, number>>(emptyBreakdown());
  const [closingBreakdown, setClosingBreakdown] = useState<Record<string, number>>(emptyBreakdown());
  const [openingCorrespondent, setOpeningCorrespondent] = useState<Record<string, string>>({});
  const [closingCorrespondent, setClosingCorrespondent] = useState<Record<string, string>>({});
  const [openingTransfer, setOpeningTransfer] = useState("0");
  const [closingTransfer, setClosingTransfer] = useState("0");
  const [openingNote, setOpeningNote] = useState("");
  const [closingNote, setClosingNote] = useState("");

  const canOpenCash = hasPermission(user, APP_PERMISSION_KEYS.cashOpen);
  const canCloseCash = hasPermission(user, APP_PERMISSION_KEYS.cashClose);
  const activeSession = summary?.activeSession ?? null;
  const previousReference = summary?.previousReference ?? null;
  const correspondentRows = activeSession?.correspondent ?? [];
  const sessionsPagination = useTablePagination(summary?.recentSessions ?? []);
  const correspondentPagination = useTablePagination(correspondentRows);
  const activityPagination = useTablePagination(activeSession?.recentActivity ?? []);

  const openingCashTotal = useMemo(() => breakdownTotal(openingBreakdown), [openingBreakdown]);
  const closingCashTotal = useMemo(() => breakdownTotal(closingBreakdown), [closingBreakdown]);
  const openingTransferTotal = Number(openingTransfer || 0);
  const closingTransferTotal = Number(closingTransfer || 0);
  const openingCorrespondentTotal = useMemo(
    () =>
      activeSession
        ? correspondentRows.reduce((sum, item) => sum + item.openingAmount, 0)
        : catalog.reduce((sum, item) => sum + Number(openingCorrespondent[item.id] || 0), 0),
    [activeSession, catalog, correspondentRows, openingCorrespondent]
  );
  const countedCorrespondentTotal = useMemo(
    () =>
      correspondentRows.reduce(
        (sum, item) => sum + Number(closingCorrespondent[item.platformId] ?? item.countedAmount ?? item.expectedAmount),
        0
      ),
    [closingCorrespondent, correspondentRows]
  );
  const correspondentExpectedTotal = correspondentRows.reduce((sum, item) => sum + item.expectedAmount, 0);
  const correspondentMovementTotal = correspondentRows.reduce(
    (sum, item) => sum + item.totalIn - item.totalOut + item.totalCommission + item.manualIncome - item.manualExpense,
    0
  );
  const openingAvailableTotal = activeSession
    ? activeSession.openingAvailableAmount
    : openingCashTotal + openingTransferTotal + openingCorrespondentTotal;
  const expectedAvailableTotal = activeSession?.expectedAvailableAmount ?? openingAvailableTotal;
  const countedAvailableTotal = activeSession
    ? closingCashTotal + closingTransferTotal + countedCorrespondentTotal
    : openingAvailableTotal;
  const availableDifferenceTotal = activeSession ? countedAvailableTotal - expectedAvailableTotal : 0;

  const initializeForms = useCallback((nextSummary: CashSummary, nextCatalog: CatalogPlatform[]) => {
    if (nextSummary.activeSession) {
      setOpeningBreakdown(normalizeBreakdown(nextSummary.activeSession.openingBreakdown));
      setClosingBreakdown(normalizeBreakdown(nextSummary.activeSession.closingBreakdown));
      setOpeningTransfer(String(nextSummary.activeSession.openingTransferAmount ?? 0));
      setClosingTransfer(String(nextSummary.activeSession.countedTransferAmount ?? nextSummary.activeSession.expectedTransferAmount ?? 0));
      setOpeningCorrespondent(Object.fromEntries(nextSummary.activeSession.correspondent.map((item) => [item.platformId, String(item.openingAmount)])));
      setClosingCorrespondent(Object.fromEntries(nextSummary.activeSession.correspondent.map((item) => [item.platformId, String(item.countedAmount ?? item.expectedAmount)])));
      return;
    }
    setClosingBreakdown(emptyBreakdown());
    setClosingCorrespondent({});
    setClosingTransfer("0");
    setOpeningBreakdown(normalizeBreakdown(nextSummary.previousReference?.closingBreakdown));
    setOpeningTransfer(String(nextSummary.previousReference?.countedTransferAmount ?? 0));
    setOpeningCorrespondent(
      Object.fromEntries(
        nextCatalog.map((platform) => [
          platform.id,
          String(nextSummary.previousReference?.correspondent.find((item) => item.platformId === platform.id)?.countedAmount ?? 0),
        ])
      )
    );
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryResponse, catalogResponse] = await Promise.all([window.api.getCashSummary(), window.api.getCorrespondentCatalog()]);
      if (!summaryResponse.success) throw new Error(summaryResponse.message || "No se pudo cargar el control diario");
      if (!catalogResponse.success) throw new Error(catalogResponse.message || "No se pudo cargar el catalogo de corresponsales");
      setSummary(summaryResponse);
      setCatalog(catalogResponse.platforms);
      initializeForms(summaryResponse, catalogResponse.platforms);
    } catch (error) {
      setFeedback({ severity: "error", message: error instanceof Error ? error.message : "No se pudo cargar el control diario" });
    } finally {
      setLoading(false);
    }
  }, [initializeForms]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleOpenCash() {
    setSaving(true);
    try {
      const response = await window.api.openCashSession({
        openingCashAmount: openingCashTotal,
        openingTransferAmount: openingTransferTotal,
        note: openingNote.trim() || undefined,
        cashBreakdown: openingBreakdown,
        correspondentBalances: catalog.map((platform) => ({ platformId: platform.id, amount: Number(openingCorrespondent[platform.id] || 0) })),
      });
      setFeedback({ severity: response.success ? "success" : "error", message: response.message || (response.success ? "Control diario abierto correctamente." : "No se pudo abrir el control diario") });
      if (response.success) {
        setOpeningNote("");
        await loadData();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleCloseCash() {
    if (!activeSession) return;
    setSaving(true);
    try {
      const response = await window.api.closeCashSession({
        sessionId: activeSession.id,
        countedCashAmount: closingCashTotal,
        countedTransferAmount: closingTransferTotal,
        note: closingNote.trim() || undefined,
        cashBreakdown: closingBreakdown,
        correspondentBalances: correspondentRows.map((item) => ({ platformId: item.platformId, amount: Number(closingCorrespondent[item.platformId] || 0) })),
      });
      setFeedback({ severity: response.success ? "success" : "error", message: response.message || (response.success ? "Control diario cerrado correctamente." : "No se pudo cerrar el control diario") });
      if (response.success) {
        setClosingNote("");
        await loadData();
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Box display="flex" alignItems="center" justifyContent="center" minHeight={420}><CircularProgress /></Box>;

  return (
    <Stack spacing={3}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={2} flexWrap="wrap">
        <Box display="flex" alignItems="center" gap={0.5}>
          <Typography variant="h4">Cuadre general diario</Typography>
          <HelpHint title="Unifica efectivo, transferencias y corresponsales dentro de una sola apertura, operacion y cierre del dinero total del negocio." />
        </Box>
        <Button variant="outlined" onClick={() => void loadData()} disabled={saving}>Actualizar</Button>
      </Box>

      <FloatingAlert feedback={feedback} onClose={() => setFeedback(null)} />

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(5, 1fr)" }} gap={2}>
        <MetricCard title="Estado" value={activeSession ? "Control abierto" : "Control cerrado"} helper={activeSession ? activeSession.registerName : "Listo para abrir"} />
        <MetricCard title="Saldo inicial total" value={currency(openingAvailableTotal)} helper="Todo el dinero disponible al abrir" />
        <MetricCard title="Movimiento del dia" value={currency((activeSession ? activeSession.expectedCash - activeSession.openingAmount : 0) + (activeSession ? activeSession.expectedTransferAmount - activeSession.openingTransferAmount : 0) + correspondentMovementTotal)} helper="Impacto total de la jornada" />
        <MetricCard title="Saldo esperado" value={currency(expectedAvailableTotal)} helper="Lo que deberia existir segun sistema" />
        <MetricCard title="Historial" value={String(summary?.recentSessions.length ?? 0)} helper="Sesiones guardadas" />
      </Box>

      {previousReference ? <Alert severity="info">Cierre anterior: {currency(previousReference.countedAvailableAmount)} al {formatDateTime(previousReference.closedAt)}. Efectivo {currency(previousReference.countedCashAmount)}, transferencias {currency(previousReference.countedTransferAmount)}.</Alert> : null}
      {activeSession?.openingComparison ? <Alert severity={differenceSeverity(activeSession.openingComparison.differenceAmount)}>Comparacion apertura vs cierre anterior: total {currency(activeSession.openingComparison.differenceAmount)}, efectivo {currency(activeSession.openingComparison.cashDifferenceAmount)}, transferencias {currency(activeSession.openingComparison.transferDifferenceAmount)} y corresponsales {currency(activeSession.openingComparison.correspondentDifferenceTotal)}.</Alert> : null}

      {activeSession ? (
        <>
          <Card><CardContent><Box display="grid" gridTemplateColumns={{ xs: "1fr", xl: "repeat(4, 1fr)" }} gap={2}>
            <SummaryCard title="Efectivo" rows={[["Inicial", currency(activeSession.openingAmount)], ["Ventas", currency(activeSession.salesCash)], ["Ingresos", currency(activeSession.manualIncome)], ["Egresos", currency(-activeSession.manualExpense)], ["Esperado", currency(activeSession.expectedCash)], ["Contado", currency(closingCashTotal)], ["Diferencia", currency(closingCashTotal - activeSession.expectedCash)]]} />
            <SummaryCard title="Transferencias" rows={[["Inicial", currency(activeSession.openingTransferAmount)], ["Ventas", currency(activeSession.salesTransfer)], ["Ingresos", currency(activeSession.manualTransferIncome)], ["Egresos", currency(-activeSession.manualTransferExpense)], ["Esperado", currency(activeSession.expectedTransferAmount)], ["Contado", currency(closingTransferTotal)], ["Diferencia", currency(closingTransferTotal - activeSession.expectedTransferAmount)]]} />
            <SummaryCard title="Corresponsales" rows={[["Inicial", currency(openingCorrespondentTotal)], ["Movimiento", currency(correspondentMovementTotal)], ["Esperado", currency(correspondentExpectedTotal)], ["Contado", currency(countedCorrespondentTotal)], ["Diferencia", currency(countedCorrespondentTotal - correspondentExpectedTotal)]]} />
            <SummaryCard title="Disponible total" rows={[["Apertura", currency(openingAvailableTotal)], ["Esperado", currency(expectedAvailableTotal)], ["Contado", currency(countedAvailableTotal)], ["Diferencia general", currency(availableDifferenceTotal)]]} highlight />
          </Box></CardContent></Card>

          <Card><CardContent><Stack spacing={2}>
            <Typography variant="h6">Cierre consolidado</Typography>
            <SectionTitle title="Conteo de efectivo" helper={`Contado: ${currency(closingCashTotal)}`} />
            <DenominationGrid breakdown={closingBreakdown} onChange={setClosingBreakdown} disabled={!canCloseCash || saving} />
            <SectionTitle title="Saldo real en transferencias" helper={`Contado: ${currency(closingTransferTotal)}`} />
            <TextField label="Saldo real en transferencias" type="number" value={closingTransfer} onChange={(event) => setClosingTransfer(event.target.value)} inputProps={{ min: 0 }} disabled={!canCloseCash || saving} />
            <SectionTitle title="Saldos por corresponsal" helper={`Contado: ${currency(countedCorrespondentTotal)}`} />
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small"><TableHead><TableRow><TableCell>Corresponsal</TableCell><TableCell align="right">Inicial</TableCell><TableCell align="right">Entradas</TableCell><TableCell align="right">Salidas</TableCell><TableCell align="right">Comision</TableCell><TableCell align="right">Ajustes +</TableCell><TableCell align="right">Ajustes -</TableCell><TableCell align="right">Esperado</TableCell><TableCell align="right">Contado</TableCell><TableCell align="right">Diferencia</TableCell></TableRow></TableHead><TableBody>
                {correspondentPagination.paginatedRows.map((item) => {
                  const counted = Number(closingCorrespondent[item.platformId] || 0);
                  return <TableRow key={item.platformId} hover><TableCell>{item.platform}</TableCell><TableCell align="right">{currency(item.openingAmount)}</TableCell><TableCell align="right">{currency(item.totalIn)}</TableCell><TableCell align="right">{currency(item.totalOut)}</TableCell><TableCell align="right">{currency(item.totalCommission)}</TableCell><TableCell align="right">{currency(item.manualIncome)}</TableCell><TableCell align="right">{currency(item.manualExpense)}</TableCell><TableCell align="right">{currency(item.expectedAmount)}</TableCell><TableCell align="right" sx={{ minWidth: 140 }}><TextField size="small" type="number" value={closingCorrespondent[item.platformId] ?? String(item.expectedAmount)} onChange={(event) => setClosingCorrespondent((current) => ({ ...current, [item.platformId]: event.target.value }))} inputProps={{ min: 0 }} disabled={!canCloseCash || saving} /></TableCell><TableCell align="right">{currency(counted - item.expectedAmount)}</TableCell></TableRow>;
                })}
              </TableBody></Table>
              <TablePagination component="div" count={correspondentRows.length} page={correspondentPagination.page} onPageChange={correspondentPagination.handleChangePage} rowsPerPage={correspondentPagination.rowsPerPage} onRowsPerPageChange={correspondentPagination.handleChangeRowsPerPage} rowsPerPageOptions={[10, 15]} labelRowsPerPage="Filas" />
            </Box>
            <Alert severity={differenceSeverity(availableDifferenceTotal)}>Esperado total {currency(expectedAvailableTotal)}. Contado total {currency(countedAvailableTotal)}. Diferencia general {currency(availableDifferenceTotal)}.</Alert>
            <TextField label="Observacion de cierre" value={closingNote} onChange={(event) => setClosingNote(event.target.value)} multiline minRows={2} disabled={!canCloseCash || saving} />
            <Box display="flex" justifyContent="flex-end"><Button variant="contained" onClick={() => void handleCloseCash()} disabled={!canCloseCash || saving}>{saving ? "Cerrando..." : "Cerrar control diario"}</Button></Box>
          </Stack></CardContent></Card>

          <Card><CardContent><Stack spacing={2}>
            <Typography variant="h6">Movimientos recientes</Typography>
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small"><TableHead><TableRow><TableCell>Fecha</TableCell><TableCell>Tipo</TableCell><TableCell>Medio</TableCell><TableCell>Detalle</TableCell><TableCell align="right">Impacto</TableCell></TableRow></TableHead><TableBody>
                {(activeSession.recentActivity ?? []).length === 0 ? <TableRow><TableCell colSpan={5} align="center">Aun no hay movimientos registrados.</TableCell></TableRow> : null}
                {activityPagination.paginatedRows.map((activity) => <TableRow key={activity.id} hover><TableCell>{new Date(activity.createdAt).toLocaleString("es-CO")}</TableCell><TableCell>{activity.type}</TableCell><TableCell>{activity.medium}</TableCell><TableCell>{activity.detail}</TableCell><TableCell align="right" sx={{ color: activity.signedAmount < 0 ? "error.main" : "success.main", fontWeight: 700 }}>{currency(activity.signedAmount)}</TableCell></TableRow>)}
              </TableBody></Table>
              <TablePagination component="div" count={activeSession.recentActivity.length} page={activityPagination.page} onPageChange={activityPagination.handleChangePage} rowsPerPage={activityPagination.rowsPerPage} onRowsPerPageChange={activityPagination.handleChangeRowsPerPage} rowsPerPageOptions={[10, 15]} labelRowsPerPage="Filas" />
            </Box>
          </Stack></CardContent></Card>
        </>
      ) : (
        <Card><CardContent><Stack spacing={2.5}>
          <Typography variant="h6">Apertura del control diario</Typography>
          <Box display="grid" gridTemplateColumns={{ xs: "1fr", xl: "repeat(4, 1fr)" }} gap={2}>
            <SummaryCard title="Efectivo inicial" rows={[["Total", currency(openingCashTotal)]]} />
            <SummaryCard title="Transferencias iniciales" rows={[["Saldo", currency(openingTransferTotal)]]} />
            <SummaryCard title="Corresponsales iniciales" rows={[["Total", currency(openingCorrespondentTotal)], ["Plataformas", String(catalog.length)]]} />
            <SummaryCard title="Disponible al abrir" rows={[["Total inicial", currency(openingAvailableTotal)], ["Referencia", previousReference ? "Comparado con cierre anterior" : "Sin cierre previo"]]} highlight />
          </Box>
          <SectionTitle title="Efectivo inicial" helper={`Total efectivo: ${currency(openingCashTotal)}`} />
          <DenominationGrid breakdown={openingBreakdown} onChange={setOpeningBreakdown} disabled={!canOpenCash || saving} />
          <SectionTitle title="Saldo inicial en transferencias" helper={`Total transferencias: ${currency(openingTransferTotal)}`} />
          <TextField label="Saldo inicial en transferencias" type="number" value={openingTransfer} onChange={(event) => setOpeningTransfer(event.target.value)} inputProps={{ min: 0 }} disabled={!canOpenCash || saving} />
          <SectionTitle title="Saldos iniciales por corresponsal" helper={`Total corresponsales: ${currency(openingCorrespondentTotal)}`} />
          <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(2, 1fr)" }} gap={2}>{catalog.map((platform) => <TextField key={platform.id} label={platform.name} type="number" value={openingCorrespondent[platform.id] ?? "0"} onChange={(event) => setOpeningCorrespondent((current) => ({ ...current, [platform.id]: event.target.value }))} inputProps={{ min: 0 }} disabled={!canOpenCash || saving} />)}</Box>
          <TextField label="Observacion de apertura" value={openingNote} onChange={(event) => setOpeningNote(event.target.value)} multiline minRows={2} disabled={!canOpenCash || saving} />
          <Box display="flex" justifyContent="flex-end"><Button variant="contained" onClick={() => void handleOpenCash()} disabled={!canOpenCash || saving}>{saving ? "Abriendo..." : "Abrir control diario"}</Button></Box>
        </Stack></CardContent></Card>
      )}

      <Card><CardContent><Stack spacing={2}>
        <Typography variant="h6">Historial reciente</Typography>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small"><TableHead><TableRow><TableCell>Caja</TableCell><TableCell>Usuario</TableCell><TableCell>Estado</TableCell><TableCell>Apertura</TableCell><TableCell>Cierre</TableCell><TableCell align="right">Inicial</TableCell><TableCell align="right">Final</TableCell><TableCell align="right">Diferencia</TableCell></TableRow></TableHead><TableBody>
            {(summary?.recentSessions.length ?? 0) === 0 ? <TableRow><TableCell colSpan={8} align="center">No hay sesiones registradas.</TableCell></TableRow> : null}
            {sessionsPagination.paginatedRows.map((session) => <HistorySessionRow key={session.id} session={session} />)}
          </TableBody></Table>
          <TablePagination component="div" count={summary?.recentSessions.length ?? 0} page={sessionsPagination.page} onPageChange={sessionsPagination.handleChangePage} rowsPerPage={sessionsPagination.rowsPerPage} onRowsPerPageChange={sessionsPagination.handleChangeRowsPerPage} rowsPerPageOptions={[10, 15]} labelRowsPerPage="Filas" />
        </Box>
      </Stack></CardContent></Card>
    </Stack>
  );
}

function MetricCard({ title, value, helper }: { title: string; value: string; helper: string }) {
  return <Card><CardContent><Typography variant="body2" color="text.secondary">{title}</Typography><Typography variant="h5" sx={{ mt: 1 }}>{value}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{helper}</Typography></CardContent></Card>;
}

function SummaryCard({ title, rows, highlight = false }: { title: string; rows: Array<[string, string]>; highlight?: boolean }) {
  return <Card variant="outlined" sx={highlight ? { borderColor: "#7dd3fc", background: "#f8fdff" } : undefined}><CardContent><Stack spacing={1.25}><Typography variant="subtitle1" fontWeight={800}>{title}</Typography>{rows.map(([label, value]) => <Box key={`${title}-${label}`} display="flex" justifyContent="space-between" gap={2}><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="body2" fontWeight={700} textAlign="right">{value}</Typography></Box>)}</Stack></CardContent></Card>;
}

function SectionTitle({ title, helper }: { title: string; helper: string }) {
  return <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap"><Typography variant="subtitle1" fontWeight={700}>{title}</Typography><Typography variant="body2" color="text.secondary">{helper}</Typography></Box>;
}

function DenominationGrid({ breakdown, onChange, disabled }: { breakdown: Record<string, number>; onChange: React.Dispatch<React.SetStateAction<Record<string, number>>>; disabled: boolean }) {
  return <Box display="grid" gridTemplateColumns={{ xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }} gap={2}>{DENOMINATIONS.map((item) => <TextField key={item.key} label={item.label} type="number" value={breakdown[item.key] ?? 0} onChange={(event) => onChange((current) => ({ ...current, [item.key]: Math.max(0, Number(event.target.value || 0)) }))} inputProps={{ min: 0 }} helperText={`Total ${currency((breakdown[item.key] ?? 0) * item.value)}`} disabled={disabled} />)}</Box>;
}

function HistorySessionRow({ session }: { session: HistoryRow }) {
  return <TableRow hover><TableCell>{session.registerName}</TableCell><TableCell>{session.user}</TableCell><TableCell>{session.status === "OPEN" ? "Abierta" : session.status === "CLOSED" ? "Cerrada" : "Cancelada"}</TableCell><TableCell>{formatDateTime(session.openedAt)}</TableCell><TableCell>{formatDateTime(session.closedAt)}</TableCell><TableCell align="right">{currency(session.openingAvailableAmount ?? session.openingAmount)}</TableCell><TableCell align="right">{currency(session.countedAvailableAmount ?? session.countedAmount ?? 0)}</TableCell><TableCell align="right">{currency(session.differenceAmount)}</TableCell></TableRow>;
}
