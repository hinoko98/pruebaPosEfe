// src/renderer/features/sales/components/TotalsCard.tsx
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";

export default function TotalsCard({
  totals,
}: {
  totals: { subtotal: number; tax: number; total: number; paid: number; due: number };
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1}>
        <Typography fontWeight={800}>Totales</Typography>
        <Stack direction="row" justifyContent="space-between">
          <Typography color="text.secondary">Subtotal</Typography>
          <Typography>{totals.subtotal}</Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between">
          <Typography color="text.secondary">Impuestos</Typography>
          <Typography>{totals.tax}</Typography>
        </Stack>
        <Divider />
        <Stack direction="row" justifyContent="space-between">
          <Typography fontWeight={800}>Total</Typography>
          <Typography fontWeight={800}>{totals.total}</Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between">
          <Typography color="text.secondary">Pagado</Typography>
          <Typography>{totals.paid}</Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between">
          <Typography color="text.secondary">Pendiente</Typography>
          <Typography>{totals.due}</Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}