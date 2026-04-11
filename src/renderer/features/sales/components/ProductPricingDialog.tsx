import { useEffect, useMemo, useState } from "react";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
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
  const [specialRuleId, setSpecialRuleId] = useState("");
  const [qty, setQty] = useState("1");
  const [manualUnitPrice, setManualUnitPrice] = useState("");

  useEffect(() => {
    if (!open || !product?.pricingConfig?.enabled) return;
    setSpecialRuleId("");
    setQty("1");
    setManualUnitPrice("");
  }, [open, product]);

  const normalizedQty = Math.max(1, Math.round(Number(qty || 1)));
  const normalizedManualUnitPrice = normalizeManualValue(manualUnitPrice);

  const pricingResult = useMemo(() => {
    if (!product) return null;

    return resolveProductPricingQuote({
      fallbackPrice: product.price,
      pricingConfig: product.pricingConfig,
      qty: normalizedQty,
      specialRuleId: specialRuleId || null,
      manualUnitPrice: normalizedManualUnitPrice,
      canOverrideMinimum: canEditManualPrice,
    });
  }, [canEditManualPrice, normalizedManualUnitPrice, normalizedQty, product, specialRuleId]);

  const quantityButtons = useMemo(() => {
    const config = product?.pricingConfig;
    if (!config?.enabled) return [];
    return config.quantityScales.map((scale) => scale.minQty);
  }, [product]);

  const handleConfirm = () => {
    if (!pricingResult?.ok) return;

    onConfirm({
      qty: normalizedQty,
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
                Define la cantidad, usa un atajo de escala si te sirve y activa una tarifa especial solo si aplica.
              </Typography>
            </Box>
          ) : null}

          {!product?.pricingConfig?.enabled ? (
            <Alert severity="warning">Este producto no tiene reglas de precio por cantidad activas.</Alert>
          ) : (
            <>
              <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "160px 1fr" }} gap={2}>
                <TextField
                  label="Cantidad"
                  type="number"
                  inputProps={{ min: 1, step: 1 }}
                  value={qty}
                  onChange={(event) => setQty(event.target.value)}
                />
                <Stack spacing={1}>
                  <Typography variant="body2" color="text.secondary">
                    Atajos por escala
                  </Typography>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    {[1, ...quantityButtons].filter((value, index, values) => values.indexOf(value) === index).map((value) => (
                      <Chip
                        key={value}
                        label={`${value} und`}
                        color={normalizedQty === value ? "primary" : "default"}
                        variant={normalizedQty === value ? "filled" : "outlined"}
                        onClick={() => setQty(String(value))}
                        clickable
                      />
                    ))}
                  </Box>
                </Stack>
              </Box>

              <Box
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  p: 1.5,
                }}
              >
                <Stack spacing={1}>
                  <Typography variant="subtitle2" fontWeight={800}>
                    Tarifas especiales
                  </Typography>
                  {product.pricingConfig.specialPriceRules.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Este producto no tiene tarifas especiales configuradas.
                    </Typography>
                  ) : (
                    <Box display="flex" gap={1} flexWrap="wrap">
                      <Chip
                        label="Sin tarifa especial"
                        color={!specialRuleId ? "primary" : "default"}
                        variant={!specialRuleId ? "filled" : "outlined"}
                        onClick={() => setSpecialRuleId("")}
                        clickable
                      />
                      {product.pricingConfig.specialPriceRules.map((rule) => (
                        <Chip
                          key={rule.id}
                          label={`${rule.label} · ${fmt(rule.unitPrice)}`}
                          color={specialRuleId === rule.id ? "primary" : "default"}
                          variant={specialRuleId === rule.id ? "filled" : "outlined"}
                          onClick={() => setSpecialRuleId(rule.id)}
                          clickable
                        />
                      ))}
                    </Box>
                  )}
                </Stack>
              </Box>

              <Alert severity="info">
                Base {fmt(product.pricingConfig.basePrice)}
                {product.pricingConfig.minimumPrice > 0 ? ` | Minimo ${fmt(product.pricingConfig.minimumPrice)}` : ""}
                {product.pricingConfig.quantityScales.length > 0
                  ? ` | ${product.pricingConfig.quantityScales.length} escalas configuradas`
                  : " | Sin escalas adicionales"}
              </Alert>

              {canEditManualPrice ? (
                <TextField
                  label="Precio manual autorizado"
                  type="number"
                  inputProps={{ min: 0, step: 1 }}
                  value={manualUnitPrice}
                  onChange={(event) => setManualUnitPrice(event.target.value)}
                  helperText="Opcional. Solo para roles autorizados."
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
        <Button variant="contained" onClick={handleConfirm} disabled={!pricingResult?.ok}>
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
