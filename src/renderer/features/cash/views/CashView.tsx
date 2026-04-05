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
type CashSessionHistoryItem = CashSummary["recentSessions"][number];
type CorrespondentCatalogPlatform = Awaited<ReturnType<typeof window.api.getCorrespondentCatalog>>["platforms"][number];

type FeedbackState = { severity: "success" | "error" | "info"; message: string } | null;

type Denomination = {
  key: string;
  label: string;
  value: number;
};

const COLOMBIAN_DENOMINATIONS: Denomination[] = [
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

function currency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function createEmptyBreakdown() {
  return Object.fromEntries(COLOMBIAN_DENOMINATIONS.map((item) => [item.key, 0])) as Record<string, number>;
}

function normalizeBreakdown(source?: Record<string, number>) {
  const base = createEmptyBreakdown();
  for (const denomination of COLOMBIAN_DENOMINATIONS) {
    base[denomination.key] = Number(source?.[denomination.key] ?? 0);
  }
  return base;
}

function breakdownTotal(breakdown: Record<string, number>) {
  return COLOMBIAN_DENOMINATIONS.reduce(
    (sum, denomination) => sum + denomination.value * Number(breakdown[denomination.key] ?? 0),
    0
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return "Sin registro";
  return new Date(value).toLocaleString("es-CO");
}

export default function CashView() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [catalog, setCatalog] = useState<CorrespondentCatalogPlatform[]>([]);

  const [openingBreakdown, setOpeningBreakdown] = useState<Record<string, number>>(createEmptyBreakdown());
  const [closingBreakdown, setClosingBreakdown] = useState<Record<string, number>>(createEmptyBreakdown());
  const [openingCorrespondent, setOpeningCorrespondent] = useState<Record<string, string>>({});
  const [closingCorrespondent, setClosingCorrespondent] = useState<Record<string, string>>({});
  const [openingNote, setOpeningNote] = useState("");
  const [closingNote, setClosingNote] = useState("");

  const canOpenCash = hasPermission(user, APP_PERMISSION_KEYS.cashOpen);
  const canCloseCash = hasPermission(user, APP_PERMISSION_KEYS.cashClose);

  const activeSession = summary?.activeSession ?? null;
  const openingTotal = useMemo(() => breakdownTotal(openingBreakdown), [openingBreakdown]);
  const closingTotal = useMemo(() => breakdownTotal(closingBreakdown), [closingBreakdown]);
  const activeCorrespondentRows = activeSession?.correspondent ?? [];
  const activityPagination = useTablePagination(activeSession?.recentActivity ?? []);
  const sessionsPagination = useTablePagination(summary?.recentSessions ?? []);
  const correspondentPagination = useTablePagination(activeCorrespondentRows);

  const initializeForms = useCallback(
    (nextSummary: CashSummary, nextCatalog: CorrespondentCatalogPlatform[]) => {
      if (nextSummary.activeSession) {
        setClosingBreakdown(normalizeBreakdown(nextSummary.activeSession.closingBreakdown));
        setClosingCorrespondent(
          Object.fromEntries(
            nextSummary.activeSession.correspondent.map((item) => [
              item.platformId,
              String(item.countedAmount ?? item.expectedAmount),
            ])
          )
        );
      } else {
        setClosingBreakdown(createEmptyBreakdown());
        setClosingCorrespondent({});
      }

      const openingDefaults =
        nextSummary.activeSession?.openingBreakdown && Object.keys(nextSummary.activeSession.openingBreakdown).length > 0
          ? normalizeBreakdown(nextSummary.activeSession.openingBreakdown)
          : createEmptyBreakdown();
      setOpeningBreakdown(openingDefaults);

      const openingBase =
        nextSummary.activeSession?.correspondent && nextSummary.activeSession.correspondent.length > 0
          ? Object.fromEntries(
              nextSummary.activeSession.correspondent.map((item) => [item.platformId, String(item.openingAmount)])
            )
          : Object.fromEntries(nextCatalog.map((platform) => [platform.id, "0"]));

      setOpeningCorrespondent(openingBase);
    },
    []
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryResponse, catalogResponse] = await Promise.all([
        window.api.getCashSummary(),
        window.api.getCorrespondentCatalog(),
      ]);

      if (!summaryResponse.success) {
        throw new Error(summaryResponse.message || "No se pudo cargar la caja general");
      }

      if (!catalogResponse.success) {
        throw new Error(catalogResponse.message || "No se pudo cargar el catalogo de corresponsal");
      }

      setSummary(summaryResponse);
      setCatalog(catalogResponse.platforms);
      initializeForms(summaryResponse, catalogResponse.platforms);
    } catch (error) {
      setFeedback({
        severity: "error",
        message: error instanceof Error ? error.message : "No se pudo cargar la caja general",
      });
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
        openingCashAmount: openingTotal,
        note: openingNote.trim() || undefined,
        cashBreakdown: openingBreakdown,
        correspondentBalances: catalog.map((platform) => ({
          platformId: platform.id,
          amount: Number(openingCorrespondent[platform.id] || 0),
        })),
      });

      if (!response.success) {
        setFeedback({ severity: "error", message: response.message || "No se pudo abrir la caja general" });
        return;
      }

      setFeedback({ severity: "success", message: "Caja general abierta correctamente." });
      setOpeningNote("");
      await loadData();
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
        countedCashAmount: closingTotal,
        note: closingNote.trim() || undefined,
        cashBreakdown: closingBreakdown,
        correspondentBalances: activeSession.correspondent.map((item) => ({
          platformId: item.platformId,
          amount: Number(closingCorrespondent[item.platformId] || 0),
        })),
      });

      if (!response.success) {
        setFeedback({ severity: "error", message: response.message || "No se pudo cerrar la caja general" });
        return;
      }

      setFeedback({ severity: "success", message: "Caja general cerrada correctamente." });
      setClosingNote("");
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" minHeight={420}>
        <CircularProgress />
      </Box>
    );
  }

  const correspondentExpectedTotal = activeCorrespondentRows.reduce((sum, item) => sum + item.expectedAmount, 0);

  return (
    <Stack spacing={3}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={2} flexWrap="wrap">
        <Box display="flex" alignItems="center" gap={0.5}>
          <Typography variant="h4">Caja general</Typography>
          <HelpHint title="Controla apertura, cierre, conteo por denominaciones y saldos operativos del POS en una sola pantalla." />
        </Box>
        <Button variant="outlined" onClick={() => void loadData()} disabled={saving}>
          Actualizar
        </Button>
      </Box>

      <FloatingAlert feedback={feedback} onClose={() => setFeedback(null)} />

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(4, 1fr)" }} gap={2}>
        <MetricCard title="Estado" value={activeSession ? "Caja abierta" : "Caja cerrada"} helper={activeSession ? activeSession.registerName : "Lista para abrir"} />
        <MetricCard title="POS esperado" value={currency(activeSession?.expectedCash ?? openingTotal)} helper={activeSession ? "Basado en ventas y movimientos" : "Según denominaciones"} />
        <MetricCard title="Corresponsal esperado" value={currency(correspondentExpectedTotal)} helper={activeSession ? "Suma de plataformas activas" : "Se registra al abrir"} />
        <MetricCard title="Sesiones recientes" value={String(summary?.recentSessions.length ?? 0)} helper="Historial reciente guardado en base de datos" />
      </Box>

      {activeSession ? (
        <>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Resumen de la sesión activa</Typography>
                <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(4, 1fr)" }} gap={2}>
                  <ReadOnlyField label="Caja" value={activeSession.registerName} />
                  <ReadOnlyField label="Abierta por" value={activeSession.user} />
                  <ReadOnlyField label="Apertura" value={formatDateTime(activeSession.openedAt)} />
                  <ReadOnlyField label="Efectivo apertura" value={currency(activeSession.openingAmount)} />
                  <ReadOnlyField label="Ventas efectivo" value={currency(activeSession.salesCash)} />
                  <ReadOnlyField label="Transferencias" value={currency(activeSession.salesCard + activeSession.salesTransfer)} />
                  <ReadOnlyField label="Efectivo esperado" value={currency(activeSession.expectedCash)} />
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Cuadre general</Typography>
                <Typography variant="body2" color="text.secondary">
                  Registra el conteo final por denominación y el saldo contado de cada corresponsal.
                </Typography>

                <SectionTitle title="Conteo de efectivo POS" helper={`Contado actual: ${currency(closingTotal)}`} />
                <DenominationGrid breakdown={closingBreakdown} onChange={setClosingBreakdown} disabled={!canCloseCash || saving} />

                <SectionTitle title="Saldos del corresponsal" helper={`Total contado: ${currency(activeSession.correspondent.reduce((sum, item) => sum + Number(closingCorrespondent[item.platformId] || 0), 0))}`} />
                <Box sx={{ overflowX: "auto" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Corresponsal</TableCell>
                        <TableCell align="right">Apertura</TableCell>
                        <TableCell align="right">Entradas</TableCell>
                        <TableCell align="right">Salidas</TableCell>
                        <TableCell align="right">Esperado</TableCell>
                        <TableCell align="right">Contado</TableCell>
                        <TableCell align="right">Diferencia</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {correspondentPagination.paginatedRows.map((item) => {
                        const counted = Number(closingCorrespondent[item.platformId] || 0);
                        return (
                          <TableRow key={item.platformId} hover>
                            <TableCell>{item.platform}</TableCell>
                            <TableCell align="right">{currency(item.openingAmount)}</TableCell>
                            <TableCell align="right">{currency(item.totalIn)}</TableCell>
                            <TableCell align="right">{currency(item.totalOut)}</TableCell>
                            <TableCell align="right">{currency(item.expectedAmount)}</TableCell>
                            <TableCell align="right" sx={{ minWidth: 140 }}>
                              <TextField
                                size="small"
                                type="number"
                                value={closingCorrespondent[item.platformId] ?? String(item.expectedAmount)}
                                onChange={(event) =>
                                  setClosingCorrespondent((current) => ({
                                    ...current,
                                    [item.platformId]: event.target.value,
                                  }))
                                }
                                inputProps={{ min: 0 }}
                                disabled={!canCloseCash || saving}
                              />
                            </TableCell>
                            <TableCell align="right">{currency(counted - item.expectedAmount)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <TablePagination
                    component="div"
                    count={activeCorrespondentRows.length}
                    page={correspondentPagination.page}
                    onPageChange={correspondentPagination.handleChangePage}
                    rowsPerPage={correspondentPagination.rowsPerPage}
                    onRowsPerPageChange={correspondentPagination.handleChangeRowsPerPage}
                    rowsPerPageOptions={[10, 15]}
                    labelRowsPerPage="Filas"
                  />
                </Box>

                <TextField
                  label="Observación de cierre"
                  value={closingNote}
                  onChange={(event) => setClosingNote(event.target.value)}
                  multiline
                  minRows={2}
                  disabled={!canCloseCash || saving}
                />

                <Box display="flex" justifyContent="flex-end">
                  <Button variant="contained" onClick={() => void handleCloseCash()} disabled={!canCloseCash || saving}>
                    {saving ? "Cerrando..." : "Cerrar caja general"}
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <Box display="grid" gridTemplateColumns={{ xs: "1fr", xl: "1.2fr 1fr" }} gap={2}>
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6">Actividad reciente</Typography>
                  <Box sx={{ overflowX: "auto" }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Fecha</TableCell>
                          <TableCell>Tipo</TableCell>
                          <TableCell>Detalle</TableCell>
                          <TableCell align="right">Valor</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {activityPagination.paginatedRows.map((item) => (
                          <TableRow key={item.id} hover>
                            <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                            <TableCell>{item.type}</TableCell>
                            <TableCell>{item.detail}</TableCell>
                            <TableCell align="right">{currency(item.amount)}</TableCell>
                          </TableRow>
                        ))}
                        {activeSession.recentActivity.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} align="center">
                              No hay actividad reciente en la sesión actual.
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                    <TablePagination
                      component="div"
                      count={activeSession.recentActivity.length}
                      page={activityPagination.page}
                      onPageChange={activityPagination.handleChangePage}
                      rowsPerPage={activityPagination.rowsPerPage}
                      onRowsPerPageChange={activityPagination.handleChangeRowsPerPage}
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
                  <Typography variant="h6">Denominaciones de apertura</Typography>
                  <BreakdownSummary breakdown={activeSession.openingBreakdown} />
                  {activeSession.countedCashAmount !== null ? (
                    <>
                      <Typography variant="h6">Denominaciones de cierre</Typography>
                      <BreakdownSummary breakdown={activeSession.closingBreakdown} />
                    </>
                  ) : (
                    <Alert severity="info">Aún no se ha registrado el cierre de esta sesión.</Alert>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Box>
        </>
      ) : (
        <Card>
          <CardContent>
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="h6">Apertura de caja general</Typography>
                <Typography variant="body2" color="text.secondary">
                  Registra el efectivo inicial por denominación y, si aplica, el saldo inicial de cada corresponsal.
                </Typography>
              </Box>

              <SectionTitle title="Efectivo inicial POS" helper={`Total de apertura: ${currency(openingTotal)}`} />
              <DenominationGrid breakdown={openingBreakdown} onChange={setOpeningBreakdown} disabled={!canOpenCash || saving} />

              <SectionTitle title="Saldos iniciales del corresponsal" helper={`Total inicial: ${currency(catalog.reduce((sum, item) => sum + Number(openingCorrespondent[item.id] || 0), 0))}`} />
              <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(2, 1fr)" }} gap={2}>
                {catalog.map((platform) => (
                  <TextField
                    key={platform.id}
                    label={platform.name}
                    type="number"
                    value={openingCorrespondent[platform.id] ?? "0"}
                    onChange={(event) =>
                      setOpeningCorrespondent((current) => ({
                        ...current,
                        [platform.id]: event.target.value,
                      }))
                    }
                    inputProps={{ min: 0 }}
                    disabled={!canOpenCash || saving}
                  />
                ))}
              </Box>

              <TextField
                label="Observación de apertura"
                value={openingNote}
                onChange={(event) => setOpeningNote(event.target.value)}
                multiline
                minRows={2}
                disabled={!canOpenCash || saving}
              />

              <Box display="flex" justifyContent="flex-end">
                <Button variant="contained" onClick={() => void handleOpenCash()} disabled={!canOpenCash || saving}>
                  {saving ? "Abriendo..." : "Abrir caja general"}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Historial reciente de sesiones</Typography>
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
                  {sessionsPagination.paginatedRows.map((session) => (
                    <SessionHistoryRow key={session.id} session={session} />
                  ))}
                  {(summary?.recentSessions.length ?? 0) === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        No hay sesiones registradas.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={summary?.recentSessions.length ?? 0}
                page={sessionsPagination.page}
                onPageChange={sessionsPagination.handleChangePage}
                rowsPerPage={sessionsPagination.rowsPerPage}
                onRowsPerPageChange={sessionsPagination.handleChangeRowsPerPage}
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

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return <TextField label={label} value={value} InputProps={{ readOnly: true }} fullWidth />;
}

function SectionTitle({ title, helper }: { title: string; helper: string }) {
  return (
    <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
      <Typography variant="subtitle1" fontWeight={700}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {helper}
      </Typography>
    </Box>
  );
}

function DenominationGrid({
  breakdown,
  onChange,
  disabled,
}: {
  breakdown: Record<string, number>;
  onChange: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  disabled: boolean;
}) {
  return (
    <Box display="grid" gridTemplateColumns={{ xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }} gap={2}>
      {COLOMBIAN_DENOMINATIONS.map((denomination) => (
        <TextField
          key={denomination.key}
          label={denomination.label}
          type="number"
          value={breakdown[denomination.key] ?? 0}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              [denomination.key]: Math.max(0, Number(event.target.value || 0)),
            }))
          }
          inputProps={{ min: 0 }}
          helperText={`Total ${currency((breakdown[denomination.key] ?? 0) * denomination.value)}`}
          disabled={disabled}
        />
      ))}
    </Box>
  );
}

function BreakdownSummary({ breakdown }: { breakdown: Record<string, number> }) {
  const rows = COLOMBIAN_DENOMINATIONS.filter((item) => Number(breakdown[item.key] ?? 0) > 0);

  if (rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No hay denominaciones registradas.
      </Typography>
    );
  }

  return (
    <Stack spacing={1}>
      {rows.map((item) => (
        <Box key={item.key} display="flex" justifyContent="space-between" gap={2}>
          <Typography variant="body2">
            {item.label} x {breakdown[item.key]}
          </Typography>
          <Typography variant="body2" fontWeight={700}>
            {currency(item.value * Number(breakdown[item.key] ?? 0))}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

function SessionHistoryRow({ session }: { session: CashSessionHistoryItem }) {
  return (
    <TableRow hover>
      <TableCell>{session.registerName}</TableCell>
      <TableCell>{session.user}</TableCell>
      <TableCell>{session.status === "OPEN" ? "Abierta" : session.status === "CLOSED" ? "Cerrada" : "Cancelada"}</TableCell>
      <TableCell>{formatDateTime(session.openedAt)}</TableCell>
      <TableCell>{formatDateTime(session.closedAt)}</TableCell>
      <TableCell align="right">{currency(session.differenceAmount)}</TableCell>
    </TableRow>
  );
}
