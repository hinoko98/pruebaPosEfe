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

import type { Product } from "../types";
import { resolveProductPricingQuote } from "../../../../shared/productPricing";
import { fmt } from "../views/PosView";

type ProductPricingDialogProps = {
  open: boolean;
  product: Product | null;
  canEditManualPrice: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    qty: number;
    sheetTypeId: string;
    specialRuleId?: string | null;
    manualUnitPrice?: number | null;
  }) => void;
};

function normalizeManualValue(value: string) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

export default function ProductPricingDialog({
  open,
  product,
  canEditManualPrice,
  onClose,
  onConfirm,
}: ProductPricingDialogProps) {
  const [sheetTypeId, setSheetTypeId] = useState("");
  const [specialRuleId, setSpecialRuleId] = useState("");
  const [qty, setQty] = useState("1");
  const [manualUnitPrice, setManualUnitPrice] = useState("");

  useEffect(() => {
    if (!open || !product?.pricingConfig?.enabled) return;
    setSheetTypeId(product.pricingConfig.sheetTypes[0]?.id ?? "");
    setSpecialRuleId("");
    setQty("1");
    setManualUnitPrice("");
  }, [open, product]);

  const normalizedQty = Math.max(1, Math.round(Number(qty || 1)));
  const normalizedManualUnitPrice = normalizeManualValue(manualUnitPrice);

  const selectedSheetType = product?.pricingConfig?.sheetTypes.find((sheet) => sheet.id === sheetTypeId) ?? null;

  useEffect(() => {
    if (!selectedSheetType) return;
    if (!selectedSheetType.specialPriceRules.some((rule) => rule.id === specialRuleId)) {
      setSpecialRuleId("");
    }
  }, [selectedSheetType, specialRuleId]);

  const pricingResult = useMemo(() => {
    if (!product) return null;

    return resolveProductPricingQuote({
      fallbackPrice: product.price,
      pricingConfig: product.pricingConfig,
      qty: normalizedQty,
      sheetTypeId,
      specialRuleId: specialRuleId || null,
      manualUnitPrice: normalizedManualUnitPrice,
      canOverrideMinimum: canEditManualPrice,
    });
  }, [canEditManualPrice, normalizedManualUnitPrice, normalizedQty, product, sheetTypeId, specialRuleId]);

  const handleConfirm = () => {
    if (!pricingResult?.ok || !pricingResult.quote.sheetTypeId) return;

    onConfirm({
      qty: normalizedQty,
      sheetTypeId: pricingResult.quote.sheetTypeId,
      specialRuleId: pricingResult.quote.specialRuleId,
      manualUnitPrice: normalizedManualUnitPrice,
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
                Selecciona hoja, cantidad y, si corresponde, activa una tarifa especial controlada por el sistema.
              </Typography>
            </Box>
          ) : null}

          {!product?.pricingConfig?.enabled ? (
            <Alert severity="warning">Este producto no tiene reglas de precio por cantidad activas.</Alert>
          ) : (
            <>
              <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "1fr 150px" }} gap={2}>
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
                <>
                  <TextField
                    select
                    label="Tarifa especial"
                    value={specialRuleId}
                    onChange={(event) => setSpecialRuleId(event.target.value)}
                    helperText={
                      selectedSheetType.specialPriceRules.length > 0
                        ? "Opcional. Si la activas, esta tarifa sobrescribe el precio base o la escala."
                        : "Esta hoja no tiene tarifas especiales configuradas."
                    }
                    disabled={selectedSheetType.specialPriceRules.length === 0}
                  >
                    <MenuItem value="">Sin tarifa especial</MenuItem>
                    {selectedSheetType.specialPriceRules.map((rule) => (
                      <MenuItem key={rule.id} value={rule.id}>
                        {rule.label} - {fmt(rule.unitPrice)}
                      </MenuItem>
                    ))}
                  </TextField>

                  <Alert severity="info">
                    Base {fmt(selectedSheetType.basePrice)}
                    {selectedSheetType.minimumPrice !== null ? ` | Minimo ${fmt(selectedSheetType.minimumPrice)}` : ""}
                    {selectedSheetType.quantityScales.length > 0
                      ? ` | ${selectedSheetType.quantityScales.length} escalas configuradas`
                      : " | Sin escalas adicionales"}
                  </Alert>
                </>
              ) : null}

              {canEditManualPrice ? (
                <TextField
                  label="Precio manual autorizado"
                  type="number"
                  inputProps={{ min: 0, step: 1 }}
                  value={manualUnitPrice}
                  onChange={(event) => setManualUnitPrice(event.target.value)}
                  helperText="Opcional. Solo para roles autorizados; nunca quedara por debajo del minimo sin permiso."
                />
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
                    <Row label="Minimo aplicado" value={pricingResult.quote.minimumApplied ? "Si" : "No"} />
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
