import { useEffect, useMemo, useState } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
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
import { CorrespondentModuleNav } from "@/features/correspondent/components/CorrespondentModuleNav";
import type { CorrespondentDashboard, CorrespondentPlatform } from "@/features/correspondent/types";
import { formatCurrency, formatDate, formatTime } from "@/features/correspondent/utils";

type FeedbackState = { severity: "success" | "error" | "info"; message: string } | null;

export default function CorrespondentView() {
  const [catalog, setCatalog] = useState<CorrespondentPlatform[]>([]);
  const [dashboard, setDashboard] = useState<CorrespondentDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [activePlatformId, setActivePlatformId] = useState<string | null>(null);
  const [typeId, setTypeId] = useState("");
  const [amount, setAmount] = useState("");

  const activePlatform = useMemo(
    () => catalog.find((platform) => platform.id === activePlatformId) ?? null,
    [catalog, activePlatformId]
  );

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!activePlatform) {
      setTypeId("");
      return;
    }

    setTypeId(activePlatform.types[0]?.id ?? "");
  }, [activePlatform]);

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

  async function handleRegister() {
    if (!activePlatform || !typeId || !amount) {
      setFeedback({ severity: "error", message: "Selecciona el tipo e ingresa el valor." });
      return;
    }

    setSaving(true);
    try {
      const response = await window.api.createCorrespondentTransaction({
        platformId: activePlatform.id,
        typeId,
        amount: Number(amount),
        performedAt: new Date().toISOString(),
        source: "MANUAL",
      });

      if (!response.success) {
        setFeedback({
          severity: "error",
          message: response.message || "No se pudo registrar la transaccion",
        });
        return;
      }

      setFeedback({
        severity: "success",
        message: "La transaccion fue registrada. El modal sigue abierto para continuar.",
      });
      setAmount("");
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  function closeModal() {
    setActivePlatformId(null);
    setAmount("");
    setTypeId("");
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
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Entradas del dia
            </Typography>
            <Typography variant="h5">{formatCurrency(dashboard?.totals.totalIn ?? 0)}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Salidas del dia
            </Typography>
            <Typography variant="h5">{formatCurrency(dashboard?.totals.totalOut ?? 0)}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Transacciones
            </Typography>
            <Typography variant="h5">{dashboard?.totals.transactionsCount ?? 0}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Pendientes de cuadre
            </Typography>
            <Typography variant="h5">{dashboard?.totals.pendingClosureCount ?? 0}</Typography>
          </CardContent>
        </Card>
      </Box>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
              <Box>
                <Typography variant="h5">Registro de transacciones</Typography>
                <Typography variant="body2" color="text.secondary">
                  Selecciona el corresponsal y registra en modal solo el tipo y el valor. La fecha y la hora se guardan automaticamente.
                </Typography>
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
                      minHeight: 140,
                      display: "block",
                      textAlign: "left",
                      p: 0,
                      borderRadius: 4,
                      overflow: "hidden",
                      borderColor: alpha(theme.palette.primary.main, 0.15),
                      background:
                        "linear-gradient(145deg, rgba(15,23,42,0.02) 0%, rgba(13,148,136,0.10) 100%)",
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
                          background: "linear-gradient(135deg, #0f766e 0%, #0f172a 100%)",
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
                        <Stack spacing={1.25}>
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
                              Operaciones
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {platformSummary?.count ?? 0}
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

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Ultimos registros del dia</Typography>
            {(dashboard?.recentTransactions ?? []).length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Todavia no hay transacciones registradas hoy.
              </Typography>
            ) : (
              <Box display="grid" gridTemplateColumns={{ xs: "1fr", lg: "repeat(2, 1fr)" }} gap={2}>
                {dashboard?.recentTransactions.map((transaction) => (
                  <Card key={transaction.id} variant="outlined">
                    <CardContent>
                      <Stack spacing={1}>
                        <Typography variant="subtitle1">{transaction.platform}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {transaction.type} | {formatCurrency(transaction.amount)}
                        </Typography>
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

      <Dialog open={Boolean(activePlatform)} onClose={(_event, reason) => {
        if (reason === "backdropClick") return;
        closeModal();
      }} fullWidth maxWidth="sm">
        <DialogTitle>{activePlatform?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} pt={1}>
            <Typography variant="body2" color="text.secondary">
              El movimiento se guarda con la fecha y hora actuales. El modal no se cierra al registrar.
            </Typography>
            <TextField
              select
              label="Tipo"
              value={typeId}
              onChange={(event) => setTypeId(event.target.value)}
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
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeModal}>Cerrar</Button>
          <Button variant="contained" onClick={() => void handleRegister()} disabled={saving}>
            {saving ? "Guardando..." : "Registrar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
