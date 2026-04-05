import { useCallback, useEffect, useState } from "react";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import FloatingAlert from "@/components/feedback/FloatingAlert";
import HelpHint from "@/components/ui/HelpHint";
import { CorrespondentModuleNav } from "@/features/correspondent/components/CorrespondentModuleNav";
import type { CorrespondentClosureItem } from "@/features/correspondent/types";
import { formatCurrency, toDateInputValue } from "@/features/correspondent/utils";

type FeedbackState = { severity: "success" | "error" | "info"; message: string } | null;

export default function CorrespondentClosuresView() {
  const [businessDate, setBusinessDate] = useState(toDateInputValue());
  const [closures, setClosures] = useState<CorrespondentClosureItem[]>([]);
  const [totals, setTotals] = useState({
    totalIn: 0,
    totalOut: 0,
    netTotal: 0,
    transactionsCount: 0,
  });
  const [reportedValues, setReportedValues] = useState<Record<string, string>>({});
  const [openingBalances, setOpeningBalances] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingPlatform, setSavingPlatform] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const loadClosures = useCallback(async (dateValue = businessDate) => {
    setLoading(true);
    try {
      const response = await window.api.listCorrespondentClosures({
        businessDate: new Date(`${dateValue}T00:00:00`).toISOString(),
      });

      if (!response.success) {
        throw new Error(response.message || "No se pudieron cargar los cierres");
      }

      setTotals(response.totals);
      setClosures(response.closures);
      setReportedValues(
        Object.fromEntries(
          response.closures.map((closure) => [
            closure.platformId,
            String(closure.closure?.reportedBalance ?? closure.expectedBalance),
          ])
        )
      );
      setOpeningBalances(
        Object.fromEntries(
          response.closures.map((closure) => [
            closure.platformId,
            String((closure.closure?.expectedBalance ?? closure.expectedBalance) - closure.expectedBalance),
          ])
        )
      );
      setNotes(
        Object.fromEntries(response.closures.map((closure) => [closure.platformId, closure.closure?.note ?? ""]))
      );
    } catch (error) {
      setFeedback({
        severity: "error",
        message: error instanceof Error ? error.message : "No se pudieron cargar los cierres",
      });
    } finally {
      setLoading(false);
    }
  }, [businessDate]);

  useEffect(() => {
    void loadClosures();
  }, [loadClosures]);

  async function handleClosePlatform(platformId: string) {
    setSavingPlatform(platformId);
    try {
      const response = await window.api.createCorrespondentClosure({
        platformId,
        businessDate: new Date(`${businessDate}T00:00:00`).toISOString(),
        openingBalance: Number(openingBalances[platformId] || 0),
        reportedBalance: Number(reportedValues[platformId] || 0),
        note: notes[platformId] || undefined,
      });

      if (!response.success) {
        setFeedback({ severity: "error", message: response.message || "No se pudo cerrar la plataforma" });
        return;
      }

      setFeedback({ severity: "success", message: "Cierre registrado correctamente." });
      await loadClosures();
    } finally {
      setSavingPlatform(null);
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

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
              <Box display="flex" alignItems="center" gap={0.5}>
                <Typography variant="h5">Cuadre de caja</Typography>
                <HelpHint title="Resumen consolidado del dia con entradas, salidas y desglose por tipo para cada corresponsal." />
              </Box>
              <Stack direction="row" spacing={1}>
                <TextField
                  label="Fecha"
                  type="date"
                  value={businessDate}
                  onChange={(event) => setBusinessDate(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <Button variant="outlined" onClick={() => void loadClosures()}>
                  Consultar
                </Button>
              </Stack>
            </Box>

            <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(4, 1fr)" }} gap={2}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    Entradas
                  </Typography>
                  <Typography variant="h6">{formatCurrency(totals.totalIn)}</Typography>
                </CardContent>
              </Card>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    Salidas
                  </Typography>
                  <Typography variant="h6">{formatCurrency(totals.totalOut)}</Typography>
                </CardContent>
              </Card>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    Neto del dia
                  </Typography>
                  <Typography variant="h6">{formatCurrency(totals.netTotal)}</Typography>
                </CardContent>
              </Card>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    Operaciones
                  </Typography>
                  <Typography variant="h6">{totals.transactionsCount}</Typography>
                </CardContent>
              </Card>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", xl: "repeat(2, 1fr)" }} gap={2}>
        {closures.map((item) => (
          <Card key={item.platformId}>
            <CardContent>
              <Stack spacing={2}>
                {(() => {
                  const openingBalance = Number(openingBalances[item.platformId] || 0);
                  const expectedPlatformBalance = item.closure?.expectedBalance ?? openingBalance + item.expectedBalance;
                  const countedValue = Number(reportedValues[item.platformId] || 0);
                  const currentDifference = countedValue - expectedPlatformBalance;

                  return (
                    <>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={2}>
                  <Box>
                    <Typography variant="h6">{item.platform}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {item.transactionsCount} transacciones registradas
                    </Typography>
                  </Box>
                  {item.closure ? (
                    <Chip
                      label={item.closure.status === "CLOSED" ? "Cerrada" : "Con diferencia"}
                      color={item.closure.status === "CLOSED" ? "success" : "warning"}
                    />
                  ) : (
                    <Chip label="Pendiente" variant="outlined" />
                  )}
                </Box>

                <Box display="grid" gridTemplateColumns={{ xs: "1fr 1fr", md: "repeat(4, 1fr)" }} gap={2}>
                  <TextField label="Entradas" value={formatCurrency(item.totalIn)} InputProps={{ readOnly: true }} />
                  <TextField label="Salidas" value={formatCurrency(item.totalOut)} InputProps={{ readOnly: true }} />
                  <TextField
                    label="Movimiento del dia"
                    value={formatCurrency(item.expectedBalance)}
                    InputProps={{ readOnly: true }}
                  />
                  <TextField
                    label="Comisiones"
                    value={formatCurrency(item.totalCommission)}
                    InputProps={{ readOnly: true }}
                  />
                </Box>

                <Box>
                  <Typography variant="subtitle2">Desglose por tipo</Typography>
                  <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
                    {item.breakdown.map((row) => (
                      <Chip
                        key={row.typeId}
                        label={`${row.type}: ${formatCurrency(row.total)} (${row.count})`}
                        color={row.direction === "OUT" ? "warning" : row.direction === "IN" ? "success" : "default"}
                        variant="outlined"
                      />
                    ))}
                    {item.breakdown.length === 0 ? <Chip label="Sin movimientos" variant="outlined" /> : null}
                  </Box>
                </Box>

                <Typography variant="body2" color="text.secondary">
                  Pendientes por cerrar: {item.pendingTransactions}
                </Typography>

                <TextField
                  label="Saldo base en plataforma"
                  type="number"
                  value={openingBalances[item.platformId] ?? ""}
                  onChange={(event) =>
                    setOpeningBalances((prev) => ({ ...prev, [item.platformId]: event.target.value }))
                  }
                  disabled={Boolean(item.closure)}
                  inputProps={{ step: "100" }}
                />
                <TextField
                  label="Saldo esperado en plataforma"
                  value={formatCurrency(expectedPlatformBalance)}
                  InputProps={{ readOnly: true }}
                />
                <TextField
                  label="Saldo actual en plataforma"
                  type="number"
                  value={reportedValues[item.platformId] ?? ""}
                  onChange={(event) =>
                    setReportedValues((prev) => ({ ...prev, [item.platformId]: event.target.value }))
                  }
                  disabled={Boolean(item.closure)}
                  inputProps={{ step: "100" }}
                />
                <TextField
                  label="Observacion"
                  value={notes[item.platformId] ?? ""}
                  onChange={(event) => setNotes((prev) => ({ ...prev, [item.platformId]: event.target.value }))}
                  disabled={Boolean(item.closure)}
                  multiline
                  minRows={2}
                />

                {item.closure ? (
                  <Alert severity={item.closure.status === "CLOSED" ? "success" : "warning"}>
                    Cerrado por {item.closure.closedBy} con diferencia de {formatCurrency(item.closure.differenceAmount)}.
                  </Alert>
                ) : currentDifference !== 0 ? (
                  <Alert severity={currentDifference < 0 ? "warning" : "info"}>
                    Diferencia actual: {formatCurrency(currentDifference)}.
                  </Alert>
                ) : null}

                <Button
                  variant="contained"
                  disabled={Boolean(item.closure) || savingPlatform === item.platformId}
                  onClick={() => void handleClosePlatform(item.platformId)}
                >
                  {savingPlatform === item.platformId ? "Cerrando..." : "Cerrar plataforma"}
                </Button>
                    </>
                  );
                })()}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Stack>
  );
}
