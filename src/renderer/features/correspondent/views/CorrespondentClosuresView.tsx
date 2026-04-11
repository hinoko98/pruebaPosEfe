import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

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
import { formatCurrency, formatDate, toDateInputValue } from "@/features/correspondent/utils";

type FeedbackState = { severity: "success" | "error" | "info"; message: string } | null;
type SummaryMode = "day" | "range";

export default function CorrespondentClosuresView() {
  const navigate = useNavigate();
  const [dateFrom, setDateFrom] = useState(toDateInputValue());
  const [dateTo, setDateTo] = useState(toDateInputValue());
  const [summaryMode, setSummaryMode] = useState<SummaryMode>("day");
  const [closures, setClosures] = useState<CorrespondentClosureItem[]>([]);
  const [totals, setTotals] = useState({
    totalIn: 0,
    totalOut: 0,
    netTotal: 0,
    transactionsCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const cashRoute = useMemo(() => (window.location.pathname.startsWith("/admin") ? "/admin/cash" : "/app/cash"), []);

  const loadClosures = useCallback(
    async (fromValue = dateFrom, toValue = dateTo) => {
      if (fromValue > toValue) {
        setFeedback({ severity: "error", message: "La fecha inicial no puede ser mayor que la fecha final." });
        return;
      }

      setLoading(true);
      try {
        const isRange = fromValue !== toValue;
        const response = await window.api.listCorrespondentClosures(
          isRange
            ? {
                dateFrom: new Date(`${fromValue}T00:00:00`).toISOString(),
                dateTo: new Date(`${toValue}T00:00:00`).toISOString(),
              }
            : {
                businessDate: new Date(`${fromValue}T00:00:00`).toISOString(),
              }
        );

        if (!response.success) {
          throw new Error(response.message || "No se pudieron cargar los cierres");
        }

        setSummaryMode(response.mode);
        setTotals(response.totals);
        setClosures(response.closures);
      } catch (error) {
        setFeedback({
          severity: "error",
          message: error instanceof Error ? error.message : "No se pudieron cargar los cierres",
        });
      } finally {
        setLoading(false);
      }
    },
    [dateFrom, dateTo]
  );

  useEffect(() => {
    void loadClosures();
  }, [loadClosures]);

  const periodLabel = summaryMode === "range" ? "Neto del periodo" : "Neto del dia";
  const operationsLabel = summaryMode === "range" ? "Operaciones del periodo" : "Operaciones";

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
                <Typography variant="h5">Resumen del corresponsal</Typography>
                <HelpHint title="Consulta por plataforma lo que movio el corresponsal en un dia puntual o acumulado por rango. El cuadre operativo sigue registrandose desde Caja general." />
              </Box>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                <TextField
                  label="Desde"
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="Hasta"
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <Button variant="outlined" onClick={() => void loadClosures()}>
                  Consultar
                </Button>
              </Stack>
            </Box>

            <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
              <Chip
                label={
                  summaryMode === "range"
                    ? `Rango: ${formatDate(`${dateFrom}T00:00:00`)} al ${formatDate(`${dateTo}T00:00:00`)}`
                    : `Fecha: ${formatDate(`${dateFrom}T00:00:00`)}`
                }
                color="primary"
                variant="outlined"
              />
            </Box>

            <Alert
              severity="info"
              action={
                <Button color="inherit" size="small" onClick={() => navigate(cashRoute)}>
                  Ir a caja general
                </Button>
              }
            >
              El cuadre operativo diario de POS y corresponsal se registra desde Caja general. Esta vista queda como resumen de apoyo por plataforma.
            </Alert>

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
                    {periodLabel}
                  </Typography>
                  <Typography variant="h6">{formatCurrency(totals.netTotal)}</Typography>
                </CardContent>
              </Card>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    {operationsLabel}
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
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={2}>
                  <Box>
                    <Typography variant="h6">{item.platform}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {item.transactionsCount} transacciones registradas
                    </Typography>
                  </Box>
                  {summaryMode === "day" ? (
                    item.closure ? (
                      <Chip
                        label={item.closure.status === "CLOSED" ? "Cerrada" : "Con diferencia"}
                        color={item.closure.status === "CLOSED" ? "success" : "warning"}
                      />
                    ) : (
                      <Chip label="Pendiente" variant="outlined" />
                    )
                  ) : (
                    <Chip
                      label={item.closuresCount > 0 ? `${item.closuresCount} cierres en rango` : "Sin cierres en rango"}
                      variant="outlined"
                    />
                  )}
                </Box>

                <Box display="grid" gridTemplateColumns={{ xs: "1fr 1fr", md: "repeat(4, 1fr)" }} gap={2}>
                  <TextField label="Entradas" value={formatCurrency(item.totalIn)} InputProps={{ readOnly: true }} />
                  <TextField label="Salidas" value={formatCurrency(item.totalOut)} InputProps={{ readOnly: true }} />
                  <TextField
                    label={summaryMode === "range" ? "Movimiento del periodo" : "Movimiento del dia"}
                    value={formatCurrency(item.expectedBalance)}
                    InputProps={{ readOnly: true }}
                  />
                  <TextField
                    label="Total transacciones"
                    value={String(item.transactionsCount)}
                    type="number"
                    InputProps={{ readOnly: true }}
                  />
                </Box>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Stack>
  );
}
