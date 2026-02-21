// src/renderer/features/sales/components/PaymentPanel.tsx
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";

import type { Payment, PaymentMethod } from "../types";

const methods: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Efectivo" },
  { value: "CARD", label: "Tarjeta" },
  { value: "TRANSFER", label: "Transferencia" },
];

export default function PaymentPanel({
  payments,
  onChange,
  total,
  onFinalize,
  disabledFinalize,
}: {
  payments: Payment[];
  onChange: (p: Payment[]) => void;
  total: number;
  onFinalize: () => void;
  disabledFinalize?: boolean;
}) {
  const p0 = payments[0] ?? { method: "CASH", amount: 0 };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography fontWeight={800}>Pago</Typography>

        <TextField
          select
          label="Método"
          value={p0.method}
          onChange={(e) => onChange([{ ...p0, method: e.target.value as PaymentMethod }])}
        >
          {methods.map((m) => (
            <MenuItem key={m.value} value={m.value}>
              {m.label}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label="Monto"
          type="number"
          value={p0.amount}
          onChange={(e) => onChange([{ ...p0, amount: Number(e.target.value) }])}
        />

        <Divider />

        <Button
          variant="contained"
          size="large"
          disabled={disabledFinalize}
          onClick={onFinalize}
        >
          Cobrar ({total})
        </Button>

        <Typography variant="caption" color="text.secondary">
          Luego agregamos: múltiples pagos, cambio, impresión automática.
        </Typography>
      </Stack>
    </Paper>
  );
}