import { useEffect, useMemo, useState } from "react";

import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import RestartAltOutlinedIcon from "@mui/icons-material/RestartAltOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";

import FloatingAlert from "@/components/feedback/FloatingAlert";
import HelpHint from "@/components/ui/HelpHint";
import { CorrespondentModuleNav } from "@/features/correspondent/components/CorrespondentModuleNav";
import type { CorrespondentDashboard, CorrespondentPlatform } from "@/features/correspondent/types";
import { formatCurrency, formatDate, formatTime } from "@/features/correspondent/utils";

type FeedbackState = { severity: "success" | "error" | "info"; message: string } | null;
type TransactionDraftRow = { id: string; typeId: string; amount: string };

const CASH_DENOMINATIONS = [100000, 50000, 20000, 10000, 5000, 2000] as const;

function createEmptyDenominationState() {
  return CASH_DENOMINATIONS.reduce<Record<string, string>>((acc, denomination) => {
    acc[String(denomination)] = "";
    return acc;
  }, {});
}

function sanitizeNumericInput(value: string) {
  return value.replace(/\D/g, "");
}

function createTransactionDraftRow(platform: CorrespondentPlatform | null): TransactionDraftRow {
  return {
    id: crypto.randomUUID(),
    typeId: platform?.types[0]?.id ?? "",
    amount: "",
  };
}

function SectionCard({
  title,
  tooltip,
  children,
}: {
  title: string;
  tooltip: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2.5,
        borderColor: "rgba(15, 23, 42, 0.08)",
        bgcolor: "#fbfcfd",
      }}
    >
      <CardContent sx={{ p: 1.5 }}>
        <Stack spacing={1.25}>
          <Box display="flex" alignItems="center" gap={0.5}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#0f172a" }}>
              {title}
            </Typography>
            <HelpHint title={tooltip} />
          </Box>
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}

function MetricCard({ title, value, helper }: { title: string; value: string; helper: string }) {
  return (
    <Card
      sx={{
        borderRadius: 4,
        border: "1px solid rgba(15, 23, 42, 0.08)",
        boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
      }}
    >
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h5" sx={{ mt: 1, fontWeight: 700, color: "#0f172a" }}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {helper}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function CorrespondentView() {
  const [catalog, setCatalog] = useState<CorrespondentPlatform[]>([]);
  const [dashboard, setDashboard] = useState<CorrespondentDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [activePlatformId, setActivePlatformId] = useState<string | null>(null);
  const [transactionRows, setTransactionRows] = useState<TransactionDraftRow[]>([]);
  const [valueReceived, setValueReceived] = useState("");
  const [denominationOpen, setDenominationOpen] = useState(false);
  const [denominations, setDenominations] = useState<Record<string, string>>(createEmptyDenominationState());
  const [coinsTotal, setCoinsTotal] = useState("");
  const [transferAmount, setTransferAmount] = useState("");

  const activePlatform = useMemo(
    () => catalog.find((platform) => platform.id === activePlatformId) ?? null,
    [catalog, activePlatformId]
  );

  const transactionDrafts = useMemo(
    () =>
      transactionRows.map((row) => ({
        ...row,
        type: activePlatform?.types.find((type) => type.id === row.typeId) ?? null,
        amountValue: row.amount ? Number(row.amount) : 0,
        signedAmount:
          (activePlatform?.types.find((type) => type.id === row.typeId)?.direction ?? "IN") === "OUT"
            ? -(row.amount ? Number(row.amount) : 0)
            : row.amount
              ? Number(row.amount)
              : 0,
      })),
    [activePlatform, transactionRows]
  );

  const transactionAmount = transactionDrafts.reduce((sum, row) => sum + row.signedAmount, 0);
  const isDisbursement = transactionAmount < 0;
  const expectedCashAmount = transactionAmount === 0 ? 0 : Math.abs(transactionAmount);
  const deliveredAmount = valueReceived ? Number(valueReceived) : null;
  const changeAmount = deliveredAmount !== null && expectedCashAmount > 0 ? deliveredAmount - expectedCashAmount : null;
  const rowTotals = CASH_DENOMINATIONS.map((denomination) => {
    const quantity = Number(denominations[String(denomination)] || 0);
    return {
      denomination,
      quantity,
      subtotal: denomination * quantity,
    };
  });
  const billsTotal = rowTotals.reduce((sum, row) => sum + row.subtotal, 0);
  const coinsValue = coinsTotal ? Number(coinsTotal) : 0;
  const transferValue = transferAmount ? Number(transferAmount) : 0;
  const totalReceivedFromCounter = billsTotal + coinsValue + transferValue;

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!activePlatform) {
      setTransactionRows([]);
      return;
    }

    setTransactionRows([createTransactionDraftRow(activePlatform)]);
    setValueReceived("");
    setDenominationOpen(false);
    setDenominations(createEmptyDenominationState());
    setCoinsTotal("");
    setTransferAmount("");
  }, [activePlatform]);

  useEffect(() => {
    if (!denominationOpen) return;
    setValueReceived(totalReceivedFromCounter > 0 ? String(totalReceivedFromCounter) : "");
  }, [coinsTotal, denominationOpen, denominations, totalReceivedFromCounter, transferAmount]);

  async function loadData() {
    setLoading(true);
    try {
      const [catalogResponse, dashboardResponse] = await Promise.all([
        window.api.getCorrespondentCatalog(),
        window.api.getCorrespondentDashboard(),
      ]);

      if (!catalogResponse.success) {
        throw new Error(catalogResponse.message || "No se pudo cargar el catalogo");
      }

      if (!dashboardResponse.success) {
        throw new Error(dashboardResponse.message || "No se pudo cargar el resumen");
      }

      setCatalog(catalogResponse.platforms);
      setDashboard(dashboardResponse);
    } catch (error) {
      setFeedback({
        severity: "error",
        message: error instanceof Error ? error.message : "No se pudo cargar el modulo",
      });
    } finally {
      setLoading(false);
    }
  }

  function clearCounter() {
    setDenominations(createEmptyDenominationState());
    setCoinsTotal("");
    setTransferAmount("");
  }

  function closeModal() {
    setActivePlatformId(null);
    setTransactionRows([]);
    setValueReceived("");
    setDenominationOpen(false);
    clearCounter();
  }

  function resetTransactionDrafts() {
    setTransactionRows([createTransactionDraftRow(activePlatform)]);
  }

  function handleAddTransactionRow() {
    setTransactionRows((current) => [...current, createTransactionDraftRow(activePlatform)]);
  }

  function handleTransactionRowChange(rowId: string, patch: Partial<TransactionDraftRow>) {
    setTransactionRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              ...patch,
            }
          : row
      )
    );
  }

  function handleRemoveTransactionRow(rowId: string) {
    setTransactionRows((current) =>
      current.length === 1 ? [createTransactionDraftRow(activePlatform)] : current.filter((row) => row.id !== rowId)
    );
  }

  async function handleRegister() {
    if (!activePlatform || transactionDrafts.length === 0) {
      setFeedback({ severity: "error", message: "Agrega al menos una transaccion para continuar." });
      return;
    }

    const invalidRow = transactionDrafts.find((row) => !row.typeId || row.amountValue <= 0);
    if (invalidRow) {
      setFeedback({ severity: "error", message: "Completa tipo y valor en cada transaccion antes de guardar." });
      return;
    }

    setSaving(true);
    try {
      const failures: string[] = [];
      let savedCount = 0;

      for (const row of transactionDrafts) {
        const response = await window.api.createCorrespondentTransaction({
          platformId: activePlatform.id,
          typeId: row.typeId,
          amount: row.amountValue,
          note: null,
          performedAt: new Date().toISOString(),
          source: "MANUAL",
        });

        if (!response.success) {
          failures.push(response.message || `No se pudo guardar la transaccion ${savedCount + failures.length + 1}.`);
          continue;
        }

        savedCount += 1;
      }

      if (savedCount === 0) {
        setFeedback({
          severity: "error",
          message: failures[0] || "No se pudo registrar ninguna transaccion.",
        });
        return;
      }

      setFeedback(
        failures.length > 0
          ? {
              severity: "info",
              message: `${savedCount} transaccion(es) guardadas. ${failures[0]}`,
            }
          : {
              severity: "success",
              message:
                savedCount === 1
                  ? "Transaccion guardada correctamente."
                  : `${savedCount} transacciones guardadas correctamente.`,
            }
      );
      resetTransactionDrafts();
      setValueReceived("");
      setDenominationOpen(false);
      clearCounter();
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

  return (
    <Stack spacing={3}>
      <CorrespondentModuleNav />

      <FloatingAlert feedback={feedback} onClose={() => setFeedback(null)} />

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(4, 1fr)" }} gap={2}>
        <MetricCard
          title="Entradas del dia"
          value={formatCurrency(dashboard?.totals.totalIn ?? 0)}
          helper="Total recibido por operaciones de corresponsal"
        />
        <MetricCard
          title="Salidas del dia"
          value={formatCurrency(dashboard?.totals.totalOut ?? 0)}
          helper="Efectivo entregado desde la caja"
        />
        <MetricCard
          title="Transacciones"
          value={String(dashboard?.totals.transactionsCount ?? 0)}
          helper="Movimientos registrados en la jornada"
        />
        <MetricCard
          title="Pendientes de cuadre"
          value={String(dashboard?.totals.pendingClosureCount ?? 0)}
          helper="Aun no incluidos en cierre diario"
        />
      </Box>

      <Card
        sx={{
          borderRadius: 5,
          border: "1px solid rgba(15, 23, 42, 0.08)",
          boxShadow: "0 22px 60px rgba(15, 23, 42, 0.08)",
        }}
      >
        <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
          <Stack spacing={3}>
            <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
              <Box display="flex" alignItems="center" gap={0.5}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  Registro operativo de corresponsal
                </Typography>
                <HelpHint title="Abre el modal del corresponsal, registra la aprobacion interna y usa la calculadora visual para contar efectivo sin salir del flujo." />
              </Box>
              <Button variant="outlined" onClick={() => void loadData()}>
                Actualizar
              </Button>
            </Box>

            <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(3, 1fr)", xl: "repeat(5, 1fr)" }} gap={2}>
              {catalog.map((platform) => {
                const platformSummary = dashboard?.perPlatform.find((item) => item.platformId === platform.id);
                const initials = platform.name
                  .split(" ")
                  .map((word) => word[0] ?? "")
                  .join("")
                  .slice(0, 3)
                  .toUpperCase();

                return (
                  <Button
                    key={platform.id}
                    variant="outlined"
                    onClick={() => setActivePlatformId(platform.id)}
                    sx={(theme) => ({
                      minHeight: 156,
                      display: "block",
                      textAlign: "left",
                      p: 0,
                      borderRadius: 4,
                      overflow: "hidden",
                      borderColor: alpha(theme.palette.primary.main, 0.12),
                      background: "linear-gradient(145deg, rgba(15,23,42,0.02) 0%, rgba(8,145,178,0.10) 100%)",
                      boxShadow: "0 14px 32px rgba(15, 23, 42, 0.08)",
                      transition: "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
                      "&:hover": {
                        borderColor: alpha(theme.palette.primary.main, 0.35),
                        boxShadow: "0 18px 40px rgba(15, 23, 42, 0.14)",
                        transform: "translateY(-3px)",
                      },
                    })}
                  >
                    <Stack spacing={0} width="100%" height="100%">
                      <Box
                        sx={{
                          px: 2,
                          py: 1.5,
                          color: "common.white",
                          background: "linear-gradient(135deg, #0f4c5c 0%, #0f172a 100%)",
                        }}
                      >
                        <Box display="flex" justifyContent="space-between" alignItems="center" gap={1}>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            {platform.name}
                          </Typography>
                          <Box
                            sx={{
                              minWidth: 42,
                              height: 42,
                              px: 1,
                              borderRadius: "999px",
                              display: "grid",
                              placeItems: "center",
                              bgcolor: "rgba(255,255,255,0.18)",
                              fontWeight: 800,
                              letterSpacing: "0.08em",
                            }}
                          >
                            {initials}
                          </Box>
                        </Box>
                      </Box>
                      <Box sx={{ p: 2 }}>
                        <Stack spacing={1.1}>
                          <Typography variant="body2" color="text.secondary">
                            {platform.types.length} tipos disponibles
                          </Typography>
                          <Divider />
                          <Box display="flex" justifyContent="space-between" gap={1}>
                            <Typography variant="body2" color="text.secondary">
                              Entradas
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: "success.dark" }}>
                              {formatCurrency(platformSummary?.totalIn ?? 0)}
                            </Typography>
                          </Box>
                          <Box display="flex" justifyContent="space-between" gap={1}>
                            <Typography variant="body2" color="text.secondary">
                              Salidas
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: "warning.dark" }}>
                              {formatCurrency(platformSummary?.totalOut ?? 0)}
                            </Typography>
                          </Box>
                          <Box display="flex" justifyContent="space-between" gap={1}>
                            <Typography variant="body2" color="text.secondary">
                              Pendientes
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {platformSummary?.pendingClosureCount ?? 0}
                            </Typography>
                          </Box>
                        </Stack>
                      </Box>
                    </Stack>
                  </Button>
                );
              })}
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 5, border: "1px solid rgba(15, 23, 42, 0.08)" }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Ultimos registros del dia
            </Typography>
            {(dashboard?.recentTransactions ?? []).length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Todavia no hay transacciones registradas hoy.
              </Typography>
            ) : (
              <Box display="grid" gridTemplateColumns={{ xs: "1fr", lg: "repeat(2, 1fr)" }} gap={2}>
                {dashboard?.recentTransactions.map((transaction) => (
                  <Card key={transaction.id} variant="outlined" sx={{ borderRadius: 3 }}>
                    <CardContent>
                      <Stack spacing={1.2}>
                        <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={1}>
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                              {transaction.platform}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {transaction.type}
                            </Typography>
                          </Box>
                        </Box>
                        <Box display="flex" justifyContent="space-between" alignItems="center" gap={2}>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: "#0f172a" }}>
                            {formatCurrency(transaction.amount)}
                          </Typography>
                          <Chip
                            size="small"
                            color={transaction.status === "VOIDED" ? "default" : "success"}
                            label={transaction.status === "VOIDED" ? "Anulada" : "Registrada"}
                          />
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(transaction.performedAt)} a las {formatTime(transaction.performedAt)} | {transaction.registeredBy}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(activePlatform)}
        onClose={(_event, reason) => {
          if (reason === "backdropClick") return;
          closeModal();
        }}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            borderRadius: 3,
            backgroundImage: "linear-gradient(180deg, rgba(248,250,252,1) 0%, rgba(255,255,255,1) 100%)",
            maxHeight: "92vh",
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack spacing={0.75}>
            <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
              <Box display="flex" alignItems="center" gap={0.5}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {activePlatform?.name}
                </Typography>
                <HelpHint title="Registra la transaccion y usa el apoyo visual de caja sin cambiar de pantalla." />
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip
                  label={
                    transactionDrafts.length <= 1
                      ? "1 transaccion en captura"
                      : `${transactionDrafts.length} transacciones en captura`
                  }
                  color="primary"
                  variant="outlined"
                />
                <Chip
                  label={
                    transactionAmount === 0
                      ? "Sin neto"
                      : `${isDisbursement ? "Neto a entregar" : "Neto a recibir"} ${formatCurrency(expectedCashAmount)}`
                  }
                  color={isDisbursement ? "warning" : "success"}
                  variant="outlined"
                />
                <Chip label={`Hora actual ${formatTime(new Date().toISOString())}`} variant="outlined" />
              </Stack>
            </Box>
          </Stack>
        </DialogTitle>

        <DialogContent dividers sx={{ borderColor: "rgba(15, 23, 42, 0.08)", px: 2, py: 1.5 }}>
          <Stack spacing={1.5}>
            <SectionCard
              title="Datos"
              tooltip="Estos campos si quedan guardados en la base de datos y ayudan a trazabilidad y control interno."
            >
              <Stack spacing={1.25}>
                <Box display="flex" justifyContent="space-between" alignItems="center" gap={1} flexWrap="wrap">
                  <Button size="small" variant="outlined" onClick={handleAddTransactionRow}>
                    Agregar transaccion
                  </Button>
                  <Chip
                    size="small"
                    color={isDisbursement ? "warning" : "success"}
                    label={
                      transactionAmount === 0
                        ? "Sin movimiento neto"
                        : `${isDisbursement ? "Caja entrega" : "Caja recibe"} ${formatCurrency(expectedCashAmount)}`
                    }
                    variant="outlined"
                  />
                </Box>

                <Stack spacing={1}>
                  {transactionDrafts.map((row, index) => (
                    <Box
                      key={row.id}
                      display="grid"
                      gridTemplateColumns={{ xs: "1fr 108px auto", sm: "1.25fr 0.8fr auto auto" }}
                      gap={1}
                      alignItems="center"
                      sx={{
                        p: 1,
                        borderRadius: 2,
                        border: "1px solid rgba(15, 23, 42, 0.08)",
                        bgcolor: "common.white",
                      }}
                    >
                      <TextField
                        select
                        label={transactionDrafts.length > 1 ? `Tipo ${index + 1}` : "Tipo de transaccion"}
                        value={row.typeId}
                        onChange={(event) => handleTransactionRowChange(row.id, { typeId: event.target.value })}
                        size="small"
                        fullWidth
                      >
                        {(activePlatform?.types ?? []).map((type) => (
                          <MenuItem key={type.id} value={type.id}>
                            {type.name}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        label="Valor"
                        value={row.amount}
                        onChange={(event) =>
                          handleTransactionRowChange(row.id, { amount: sanitizeNumericInput(event.target.value) })
                        }
                        inputProps={{ inputMode: "numeric" }}
                        size="small"
                        fullWidth
                      />
                      <Chip
                        size="small"
                        color={row.type?.direction === "OUT" ? "warning" : "success"}
                        label={row.type?.direction === "OUT" ? "Retiro" : "Deposito"}
                      />
                      {transactionDrafts.length > 1 ? (
                        <Button
                          size="small"
                          color="error"
                          variant="text"
                          onClick={() => handleRemoveTransactionRow(row.id)}
                          sx={{ minWidth: "auto", px: 1 }}
                        >
                          Quitar
                        </Button>
                      ) : (
                        <Box />
                      )}
                    </Box>
                  ))}
                </Stack>
              </Stack>
            </SectionCard>

            <SectionCard
              title="Calculo rapido"
              tooltip="Estos valores son solo visuales. No se guardan en base de datos ni aparecen en el historial."
            >
              <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(2, 1fr)" }} gap={1.25}>
                <TextField
                  label={isDisbursement ? "Valor separado en caja" : "Valor recibido en caja"}
                  value={valueReceived}
                  onChange={(event) => setValueReceived(sanitizeNumericInput(event.target.value))}
                  inputProps={{ inputMode: "numeric" }}
                  size="small"
                  fullWidth
                />
                <TextField
                  label={isDisbursement ? "Diferencia" : "Vueltos"}
                  value={
                    changeAmount === null
                      ? "Pendiente"
                      : changeAmount === 0
                        ? "Exacto"
                        : formatCurrency(Math.abs(changeAmount))
                  }
                  InputProps={{ readOnly: true }}
                  size="small"
                  fullWidth
                />
              </Box>

              {changeAmount === null || expectedCashAmount === 0 ? null : changeAmount < 0 ? (
                <Alert severity="error">
                  {isDisbursement
                    ? `Faltan ${formatCurrency(Math.abs(changeAmount))} para completar el retiro desde caja.`
                    : `Faltan ${formatCurrency(Math.abs(changeAmount))} para cubrir la operacion.`}
                </Alert>
              ) : changeAmount === 0 ? null : (
                <Alert severity={isDisbursement ? "info" : "success"}>
                  {isDisbursement
                    ? `Sobran ${formatCurrency(changeAmount)} frente al valor a entregar.`
                    : `Devuelve ${formatCurrency(changeAmount)} al cliente.`}
                </Alert>
              )}
            </SectionCard>

            <SectionCard
              title="Conteo"
              tooltip="Herramienta visual expandible para caja. Puedes sumar efectivo, monedas y una parte por transferencia."
            >
              <Stack spacing={1.25}>
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Button
                    size="small"
                    variant={denominationOpen ? "contained" : "outlined"}
                    startIcon={<CalculateOutlinedIcon />}
                    onClick={() => setDenominationOpen((current) => !current)}
                  >
                    {denominationOpen ? "Ocultar calculadora" : "Calcular efectivo recibido"}
                  </Button>
                  <Button size="small" variant="text" startIcon={<RestartAltOutlinedIcon />} onClick={clearCounter}>
                    Limpiar conteo
                  </Button>
                </Box>

                <Collapse in={denominationOpen}>
                  <Stack spacing={1.25} sx={{ pt: 0.75 }}>
                    <Box
                      display="grid"
                      gridTemplateColumns={{ xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }}
                      gap={1}
                    >
                      {rowTotals.map((row) => (
                        <Card key={row.denomination} variant="outlined" sx={{ borderRadius: 2, borderColor: "rgba(15, 23, 42, 0.08)" }}>
                          <CardContent sx={{ p: 1.25, "&:last-child": { pb: 1.25 } }}>
                            <Box
                              display="grid"
                              gridTemplateColumns="minmax(0, 1fr) 84px"
                              gap={1}
                              alignItems="center"
                            >
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  {formatCurrency(row.denomination)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Subtotal: {formatCurrency(row.subtotal)}
                                </Typography>
                              </Box>
                              <TextField
                                value={denominations[String(row.denomination)]}
                                onChange={(event) =>
                                  setDenominations((current) => ({
                                    ...current,
                                    [String(row.denomination)]: sanitizeNumericInput(event.target.value),
                                  }))
                                }
                                inputProps={{ inputMode: "numeric" }}
                                size="small"
                                fullWidth
                              />
                            </Box>
                          </CardContent>
                        </Card>
                      ))}
                    </Box>

                    <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(2, 1fr)" }} gap={1.25}>
                      <TextField
                        label="Total en monedas"
                        value={coinsTotal}
                        onChange={(event) => setCoinsTotal(sanitizeNumericInput(event.target.value))}
                        inputProps={{ inputMode: "numeric" }}
                        size="small"
                      />
                      <TextField
                        label="Abono por transferencia"
                        value={transferAmount}
                        onChange={(event) => setTransferAmount(sanitizeNumericInput(event.target.value))}
                        inputProps={{ inputMode: "numeric" }}
                        size="small"
                      />
                    </Box>

                    <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(3, 1fr)" }} gap={1}>
                      <Card variant="outlined" sx={{ borderRadius: 2 }}>
                        <CardContent sx={{ p: 1.25, "&:last-child": { pb: 1.25 } }}>
                          <Typography variant="caption" color="text.secondary">
                            Total billetes
                          </Typography>
                          <Typography variant="subtitle1" sx={{ mt: 0.5, fontWeight: 700 }}>
                            {formatCurrency(billsTotal)}
                          </Typography>
                        </CardContent>
                      </Card>
                      <Card variant="outlined" sx={{ borderRadius: 2 }}>
                        <CardContent sx={{ p: 1.25, "&:last-child": { pb: 1.25 } }}>
                          <Typography variant="caption" color="text.secondary">
                            Total monedas
                          </Typography>
                          <Typography variant="subtitle1" sx={{ mt: 0.5, fontWeight: 700 }}>
                            {formatCurrency(coinsValue)}
                          </Typography>
                        </CardContent>
                      </Card>
                      <Card
                        variant="outlined"
                        sx={{
                          borderRadius: 2,
                          borderColor: "rgba(15, 118, 110, 0.25)",
                          bgcolor: "rgba(15, 118, 110, 0.04)",
                        }}
                      >
                        <CardContent sx={{ p: 1.25, "&:last-child": { pb: 1.25 } }}>
                          <Typography variant="caption" color="text.secondary">
                            Total general recibido
                          </Typography>
                          <Typography variant="subtitle1" sx={{ mt: 0.5, fontWeight: 700, color: "#0f766e" }}>
                            {formatCurrency(totalReceivedFromCounter)}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Box>
                  </Stack>
                </Collapse>
              </Stack>
            </SectionCard>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 2, py: 1.5, justifyContent: "flex-end" }}>
          <Stack direction="row" spacing={1}>
            <Button size="small" color="error" variant="outlined" onClick={closeModal}>
              Cancelar
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<PaymentsOutlinedIcon />}
              onClick={() => void handleRegister()}
              disabled={saving}
            >
              {saving ? "Guardando..." : transactionDrafts.length > 1 ? "Guardar transacciones" : "Guardar transaccion"}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
