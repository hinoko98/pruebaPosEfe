import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { alpha, useTheme } from "@mui/material/styles";

import type { Payment, PaymentMethod } from "../types";
import { fmt } from "../views/PosView";

type CheckoutMode = "CASH" | "TRANSFER" | "COMBINED";

type DraftPayment = {
  id: string;
  method: PaymentMethod;
  amount: string;
};

export type PaymentDialogSubmit = {
  payments: Payment[];
  registerDebt: boolean;
  dueDate: string | null;
  debtAmount: number;
};

const METHOD_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "CASH", label: "Efectivo" },
  { value: "TRANSFER", label: "Transferencia" },
];

function createDraftPayment(method: PaymentMethod = "CASH", amount = ""): DraftPayment {
  return {
    id: crypto.randomUUID(),
    method,
    amount,
  };
}

function getModeFromPayments(payments: Payment[]): CheckoutMode | null {
  const activePayments = payments.filter((payment) => payment.amount > 0);
  if (activePayments.length === 0) return null;
  if (activePayments.length === 1) {
    return activePayments[0].method === "TRANSFER" ? "TRANSFER" : "CASH";
  }
  return "COMBINED";
}

export default function PaymentDialog({
  open,
  total,
  saving,
  initialPayments,
  customerName,
  canRegisterDebt,
  onClose,
  onConfirm,
}: {
  open: boolean;
  total: number;
  saving?: boolean;
  initialPayments?: Payment[];
  customerName?: string;
  canRegisterDebt?: boolean;
  onClose: () => void;
  onConfirm: (payload: PaymentDialogSubmit) => Promise<void> | void;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [mode, setMode] = useState<CheckoutMode | null>(null);
  const [payments, setPayments] = useState<DraftPayment[]>([createDraftPayment()]);
  const [registerDebt, setRegisterDebt] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const colors = useMemo(
    () => ({
      muted: theme.palette.text.secondary,
      text: theme.palette.text.primary,
      primary: theme.palette.primary.main,
      success: theme.palette.success.main,
      warning: theme.palette.warning.main,
      danger: theme.palette.error.main,
      border: theme.palette.divider,
      soft: isDark ? alpha(theme.palette.common.white, 0.04) : alpha(theme.palette.primary.main, 0.04),
      warningSoft: isDark ? alpha(theme.palette.warning.main, 0.16) : "#fff8e6",
      warningBorder: isDark ? alpha(theme.palette.warning.main, 0.35) : "#f1e1ae",
    }),
    [isDark, theme]
  );

  useEffect(() => {
    if (!open) return;

    const sourcePayments =
      initialPayments && initialPayments.some((payment) => payment.amount > 0)
        ? initialPayments
        : [{ method: "CASH" as PaymentMethod, amount: 0 }];

    setMode(getModeFromPayments(sourcePayments));
    setPayments(
      sourcePayments.map((payment) =>
        createDraftPayment(payment.method, payment.amount > 0 ? String(payment.amount) : "")
      )
    );
    setRegisterDebt(false);
    setDueDate("");
  }, [initialPayments, open]);

  const normalizedPayments = useMemo(
    () =>
      payments
        .map((payment) => ({
          id: payment.id,
          method: payment.method,
          amount: Math.max(0, Number(payment.amount || 0)),
        }))
        .filter((payment) => Number.isFinite(payment.amount)),
    [payments]
  );

  const totalReceived = normalizedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const cashReceived = normalizedPayments
    .filter((payment) => payment.method === "CASH")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const cashDraft = payments[0];
  const remaining = Math.max(0, total - totalReceived);
  const change = Math.max(0, totalReceived - total);
  const invalidChangeSource = change > cashReceived;
  const debtEnabled = Boolean(registerDebt && canRegisterDebt && remaining > 0);
  const hasAnyPayment = normalizedPayments.some((payment) => payment.amount > 0);
  const canContinue =
    !invalidChangeSource &&
    (remaining === 0 || debtEnabled) &&
    (hasAnyPayment || debtEnabled);

  const handleSelectMode = (nextMode: CheckoutMode) => {
    setMode(nextMode);

    if (nextMode === "CASH") {
      setPayments([createDraftPayment("CASH")]);
      return;
    }

    if (nextMode === "TRANSFER") {
      setPayments([createDraftPayment("TRANSFER", String(total))]);
      return;
    }

    setPayments([createDraftPayment("CASH"), createDraftPayment("TRANSFER")]);
  };

  const handlePaymentChange = (id: string, patch: Partial<DraftPayment>) => {
    setPayments((prev) => prev.map((payment) => (payment.id === id ? { ...payment, ...patch } : payment)));
  };

  const handleAddPayment = () => {
    setPayments((prev) => [...prev, createDraftPayment("TRANSFER")]);
  };

  const handleRemovePayment = (id: string) => {
    setPayments((prev) => (prev.length <= 1 ? prev : prev.filter((payment) => payment.id !== id)));
  };

  const handleConfirm = async () => {
    if (!canContinue) return;

    const payload = normalizedPayments
      .filter((payment) => payment.amount > 0)
      .map((payment) => ({
        method: payment.method,
        amount: Math.round(payment.amount),
      }));

    await onConfirm({
      payments: payload,
      registerDebt: debtEnabled,
      dueDate: debtEnabled && dueDate ? dueDate : null,
      debtAmount: debtEnabled ? Math.round(remaining) : 0,
    });
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ pb: 1.5, fontWeight: 800 }}>Pagar factura</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={3}>
          <Stack spacing={0.5} alignItems="center">
            <Typography sx={{ color: colors.muted, fontWeight: 800, letterSpacing: 0.4 }}>TOTAL</Typography>
            <Typography sx={{ fontSize: 32, fontWeight: 900, color: colors.text }}>{fmt(total)}</Typography>
          </Stack>

          {mode ? (
            <Stack spacing={3}>
              <Box display="flex" justifyContent="flex-end">
                <Button
                  variant="text"
                  onClick={() => setMode(null)}
                  sx={{ textTransform: "none", fontWeight: 800, color: colors.primary }}
                >
                  Cambiar metodo
                </Button>
              </Box>

              <Stack spacing={0.5} alignItems="center" sx={{ mt: -2 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: colors.muted }}>
                  Total recibido {fmt(totalReceived)}
                </Typography>
                <Typography
                  sx={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: change > 0 ? colors.success : debtEnabled ? colors.warning : remaining > 0 ? colors.danger : colors.muted,
                  }}
                >
                  {change > 0
                    ? `Vueltas: ${fmt(change)}`
                    : debtEnabled
                      ? `Saldo a cartera: ${fmt(remaining)}`
                      : `Por cobrar: ${fmt(remaining)}`}
                </Typography>
              </Stack>

              {mode === "CASH" && cashDraft ? (
                <TextField
                  label="Efectivo recibido"
                  type="number"
                  value={cashDraft.amount}
                  onChange={(event) => handlePaymentChange(cashDraft.id, { amount: event.target.value })}
                  inputProps={{ min: 0, step: "100" }}
                  autoFocus
                  fullWidth
                />
              ) : null}

              {mode === "TRANSFER" ? (
                <Box
                  sx={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 3,
                    p: 2,
                    display: "grid",
                    gap: 1.5,
                  }}
                >
                  <Typography sx={{ fontSize: 13, fontWeight: 800, color: colors.muted }}>Metodo de pago</Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                    <TextField value="Transferencia" fullWidth InputProps={{ readOnly: true }} />
                    <TextField value={fmt(total)} fullWidth InputProps={{ readOnly: true }} />
                  </Stack>
                </Box>
              ) : null}

              {mode === "COMBINED" ? (
                <Stack spacing={1.5}>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr auto" },
                      gap: 1,
                      px: 1.5,
                      py: 1.25,
                      borderRadius: 2,
                      background: colors.soft,
                      color: colors.muted,
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    <span>Metodo de pago</span>
                    <span>Valor del pago</span>
                    <span />
                  </Box>

                  {payments.map((payment) => (
                    <Box
                      key={payment.id}
                      sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr auto" },
                        gap: 1.5,
                        alignItems: "center",
                      }}
                    >
                      <Select
                        value={payment.method}
                        onChange={(event) =>
                          handlePaymentChange(payment.id, { method: event.target.value as PaymentMethod })
                        }
                        fullWidth
                      >
                        {METHOD_OPTIONS.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>

                      <TextField
                        type="number"
                        value={payment.amount}
                        onChange={(event) => handlePaymentChange(payment.id, { amount: event.target.value })}
                        inputProps={{ min: 0, step: "100" }}
                        fullWidth
                      />

                      <IconButton
                        onClick={() => handleRemovePayment(payment.id)}
                        disabled={payments.length === 1}
                        sx={{
                          border: `1px solid ${colors.border}`,
                          borderRadius: 2,
                          width: 42,
                          height: 42,
                        }}
                      >
                        <CloseMiniIcon />
                      </IconButton>
                    </Box>
                  ))}

                  <Box>
                    <Button
                      onClick={handleAddPayment}
                      variant="text"
                      sx={{ textTransform: "none", fontWeight: 800, color: colors.primary }}
                    >
                      + Agregar metodo
                    </Button>
                  </Box>
                </Stack>
              ) : null}

              {invalidChangeSource ? (
                <Alert severity="warning">Las vueltas solo pueden salir del valor registrado en efectivo.</Alert>
              ) : null}

              {!invalidChangeSource && remaining > 0 ? (
                <Alert severity={canRegisterDebt ? "warning" : "info"}>
                  {canRegisterDebt
                    ? `Faltan ${fmt(remaining)}. Puedes enviarlos a cuenta por cobrar para ${customerName ?? "el cliente"} desde aqui.`
                    : `Faltan ${fmt(remaining)} para completar la venta.`}
                </Alert>
              ) : null}

              {canRegisterDebt ? (
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    border: `1px solid ${colors.warningBorder}`,
                    background: colors.warningSoft,
                    display: "grid",
                    gap: 1.25,
                  }}
                >
                  <FormControlLabel
                    control={
                      <Switch
                        checked={registerDebt}
                        onChange={(event) => setRegisterDebt(event.target.checked)}
                        size="small"
                        disabled={remaining === 0}
                      />
                    }
                    label="Enviar saldo pendiente a cartera"
                  />

                  {registerDebt && remaining > 0 ? (
                    <TextField
                      label="Vencimiento"
                      type="date"
                      value={dueDate}
                      onChange={(event) => setDueDate(event.target.value)}
                      InputLabelProps={{ shrink: true }}
                      size="small"
                      fullWidth
                    />
                  ) : null}
                </Box>
              ) : null}
            </Stack>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
                gap: 2,
              }}
            >
              <MethodCard
                title="Efectivo"
                icon={<CashIcon />}
                onClick={() => handleSelectMode("CASH")}
              />
              <MethodCard
                title="Transferencia"
                icon={<TransferIcon />}
                onClick={() => handleSelectMode("TRANSFER")}
              />
              <MethodCard
                title="Combinado"
                icon={<CombinedIcon />}
                onClick={() => handleSelectMode("COMBINED")}
              />
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        {mode ? (
          <Button variant="contained" onClick={() => void handleConfirm()} disabled={!canContinue || saving}>
            {saving ? "Procesando..." : "Continuar"}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}

function MethodCard({
  title,
  icon,
  onClick,
}: {
  title: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  return (
    <Button
      onClick={onClick}
      variant="outlined"
      sx={{
        height: 150,
        borderRadius: 3,
        borderColor: theme.palette.divider,
        color: theme.palette.text.secondary,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        textTransform: "none",
        fontSize: 17,
        fontWeight: 800,
        backgroundColor: theme.palette.background.paper,
        "&:hover": {
          borderColor: theme.palette.primary.main,
          color: theme.palette.primary.main,
          backgroundColor: isDark ? alpha(theme.palette.primary.main, 0.1) : alpha(theme.palette.primary.main, 0.05),
        },
      }}
    >
      {icon}
      {title}
    </Button>
  );
}

function CashIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="7" width="18" height="12" rx="2" />
      <rect x="7" y="4" width="12" height="8" rx="2" />
      <circle cx="12" cy="13" r="2.4" />
    </svg>
  );
}

function TransferIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 10h18" />
      <path d="M5 10V7l7-3 7 3v3" />
      <path d="M6 20h12" />
      <path d="M7 10v6M12 10v6M17 10v6" />
    </svg>
  );
}

function CombinedIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3v18" />
      <path d="M8.5 7.5C8.5 6.1 9.8 5 11.5 5h1c1.7 0 3 1.1 3 2.5S14.2 10 12.5 10h-1C9.8 10 8.5 11.1 8.5 12.5S9.8 15 11.5 15h1c1.7 0 3 1.1 3 2.5S14.2 20 12.5 20h-1c-1.7 0-3-1.1-3-2.5" />
      <path d="M5 12h2M17 12h2" />
    </svg>
  );
}

function CloseMiniIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
