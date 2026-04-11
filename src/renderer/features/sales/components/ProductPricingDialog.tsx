import { useEffect, useMemo, useState } from "react";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import type { CustomerSegment, Product } from "../types";
import { resolveProductPricingQuote } from "../../../../shared/productPricing";
import { fmt } from "../views/PosView";

type ProductPricingDialogProps = {
  open: boolean;
  product: Product | null;
  customerSegment: CustomerSegment;
  onClose: () => void;
  onConfirm: (payload: {
    qty: number;
    sheetTypeId: string;
  }) => void;
};

export default function ProductPricingDialog({
  open,
  product,
  customerSegment,
  onClose,
  onConfirm,
}: ProductPricingDialogProps) {
  const [sheetTypeId, setSheetTypeId] = useState("");
  const [qty, setQty] = useState("1");

  useEffect(() => {
    if (!open || !product?.pricingConfig?.enabled) return;
    setSheetTypeId(product.pricingConfig.sheetTypes[0]?.id ?? "");
    setQty("1");
  }, [open, product]);

  const normalizedQty = Math.max(1, Math.round(Number(qty || 1)));
  const pricingResult = useMemo(() => {
    if (!product) return null;

    return resolveProductPricingQuote({
      fallbackPrice: product.price,
      pricingConfig: product.pricingConfig,
      qty: normalizedQty,
      sheetTypeId,
      customerSegment,
    });
  }, [customerSegment, normalizedQty, product, sheetTypeId]);

  const selectedSheetType = product?.pricingConfig?.sheetTypes.find((sheet) => sheet.id === sheetTypeId) ?? null;

  const handleConfirm = () => {
    if (!pricingResult?.ok || !pricingResult.quote.sheetTypeId) return;

    onConfirm({
      qty: normalizedQty,
      sheetTypeId: pricingResult.quote.sheetTypeId,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Configurar precio por cantidad</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {product ? (
            <Box>
              <Typography variant="h6" fontWeight={800}>
                {product.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Define hoja y cantidad para calcular el precio correcto sin ajuste manual.
              </Typography>
            </Box>
          ) : null}

          {!product?.pricingConfig?.enabled ? (
            <Alert severity="warning">Este producto no tiene reglas de precio por cantidad activas.</Alert>
          ) : (
            <>
              <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "1fr 160px" }} gap={2}>
                <TextField
                  select
                  label="Tipo de hoja"
                  value={sheetTypeId}
                  onChange={(event) => setSheetTypeId(event.target.value)}
                >
                  {product.pricingConfig.sheetTypes.map((sheet) => (
                    <MenuItem key={sheet.id} value={sheet.id}>
                      {sheet.name}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  label="Cantidad"
                  type="number"
                  inputProps={{ min: 1, step: 1 }}
                  value={qty}
                  onChange={(event) => setQty(event.target.value)}
                />
              </Box>

              {selectedSheetType ? (
                <Alert severity="info">
                  Base {fmt(selectedSheetType.basePrice)}
                  {selectedSheetType.minimumPrice !== null ? ` | Minimo ${fmt(selectedSheetType.minimumPrice)}` : ""}
                  {customerSegment === "DOCENTE" ? " | Cliente docente detectado" : ""}
                </Alert>
              ) : null}

              {pricingResult && !pricingResult.ok ? (
                <Alert severity="error">{pricingResult.message}</Alert>
              ) : pricingResult?.ok ? (
                <Box
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 2,
                    bgcolor: "background.paper",
                  }}
                >
                  <Stack spacing={1}>
                    <Row label="Precio unitario" value={fmt(pricingResult.quote.unitPrice)} />
                    <Row label="Subtotal" value={fmt(pricingResult.quote.subtotal)} />
                    <Row label="Regla aplicada" value={pricingResult.quote.sourceLabel} />
                    <Row
                      label="Minimo aplicado"
                      value={pricingResult.quote.minimumApplied ? "Si" : "No"}
                    />
                  </Stack>
                </Box>
              ) : null}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={!pricingResult?.ok || !pricingResult.quote.sheetTypeId}
        >
          Agregar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Box display="flex" justifyContent="space-between" gap={2}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={700} textAlign="right">
        {value}
      </Typography>
    </Box>
  );
}
