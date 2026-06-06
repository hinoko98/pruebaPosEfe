import { useEffect, useMemo, useState } from "react";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Radio from "@mui/material/Radio";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
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
    selectedScaleMinQty?: number | null;
    specialRuleId?: string | null;
    manualUnitPrice?: number | null;
  }) => void;
};

type SelectionMode = "BASE" | "SCALE" | "SPECIAL" | "MANUAL";

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
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("BASE");
  const [selectedScaleMinQty, setSelectedScaleMinQty] = useState<number | null>(null);
  const [qty, setQty] = useState("1");
  const [manualUnitPrice, setManualUnitPrice] = useState("");

  useEffect(() => {
    if (!open || !product?.pricingConfig?.enabled) return;
    setSelectionMode("BASE");
    setSelectedScaleMinQty(null);
    setQty("1");
    setManualUnitPrice("");
  }, [open, product]);

  const normalizedQty = Math.max(1, Math.round(Number(qty || 1)));
  const normalizedManualUnitPrice = normalizeManualValue(manualUnitPrice);
  const specialRule = product?.pricingConfig?.specialPriceRules[0] ?? null;

  const preview = useMemo(() => {
    if (!product) return null;

    return resolveProductPricingQuote({
      fallbackPrice: product.price,
      pricingConfig: product.pricingConfig,
      qty: normalizedQty,
      selectedScaleMinQty: selectionMode === "SCALE" ? selectedScaleMinQty : null,
      specialRuleId: selectionMode === "SPECIAL" ? specialRule?.id ?? null : null,
      manualUnitPrice: selectionMode === "MANUAL" ? normalizedManualUnitPrice : null,
      canOverrideMinimum: canEditManualPrice,
    });
  }, [
    canEditManualPrice,
    normalizedManualUnitPrice,
    normalizedQty,
    product,
    selectedScaleMinQty,
    selectionMode,
    specialRule?.id,
  ]);

  const scaleRows = useMemo(() => {
    const config = product?.pricingConfig;
    if (!config?.enabled) return [];
    return [...config.quantityScales].sort((left, right) => left.minQty - right.minQty);
  }, [product]);

  const handleSelectBase = () => {
    setSelectionMode("BASE");
    setSelectedScaleMinQty(null);
    setQty("1");
  };

  const handleSelectScale = (scaleMinQty: number) => {
    setSelectionMode("SCALE");
    setSelectedScaleMinQty(scaleMinQty);
    setQty(String(scaleMinQty));
  };

  const handleSelectSpecial = () => {
    setSelectionMode("SPECIAL");
    setSelectedScaleMinQty(null);
    if (normalizedQty < 1) {
      setQty("1");
    }
  };

  const handleManualPriceChange = (value: string) => {
    setManualUnitPrice(value);
    setSelectionMode("MANUAL");
    setSelectedScaleMinQty(null);
  };

  const handleConfirm = () => {
    if (!preview?.ok) return;

    onConfirm({
      qty: normalizedQty,
      selectedScaleMinQty: selectionMode === "SCALE" ? selectedScaleMinQty : null,
      specialRuleId: selectionMode === "SPECIAL" ? specialRule?.id ?? null : null,
      manualUnitPrice: selectionMode === "MANUAL" ? normalizedManualUnitPrice : null,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Seleccionar precio por escala</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {product ? (
            <Box>
              <Typography variant="h6" fontWeight={800}>
                {product.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Elige una opcion de precio. El producto se agregara con la cantidad sugerida de la opcion seleccionada y
                luego podras ajustar la cantidad en la factura.
              </Typography>
            </Box>
          ) : null}

          {!product?.pricingConfig?.enabled ? (
            <Alert severity="warning">Este producto no tiene escalas configuradas.</Alert>
          ) : (
            <>
              <Alert severity="info">
                Precio base {fmt(product.price)}
                {product.pricingConfig.minimumPrice > 0 ? ` | Minimo permitido ${fmt(product.pricingConfig.minimumPrice)}` : ""}
                {specialRule ? ` | Tarifa especial ${fmt(specialRule.unitPrice)}` : ""}
              </Alert>

              <Box
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell width={72}>Sel.</TableCell>
                      <TableCell>Cantidad</TableCell>
                      <TableCell>Referencia</TableCell>
                      <TableCell align="right">Precio</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow hover selected={selectionMode === "BASE"} onClick={handleSelectBase} sx={{ cursor: "pointer" }}>
                      <TableCell padding="checkbox">
                        <Radio checked={selectionMode === "BASE"} onChange={handleSelectBase} />
                      </TableCell>
                      <TableCell>1</TableCell>
                      <TableCell>Precio base</TableCell>
                      <TableCell align="right">{fmt(product.price)}</TableCell>
                    </TableRow>
                    {scaleRows.map((scale) => (
                      <TableRow
                        key={scale.minQty}
                        hover
                        selected={selectionMode === "SCALE" && selectedScaleMinQty === scale.minQty}
                        onClick={() => handleSelectScale(scale.minQty)}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell padding="checkbox">
                          <Radio
                            checked={selectionMode === "SCALE" && selectedScaleMinQty === scale.minQty}
                            onChange={() => handleSelectScale(scale.minQty)}
                          />
                        </TableCell>
                        <TableCell>{scale.minQty}</TableCell>
                        <TableCell>{scale.label || `Escala desde ${scale.minQty} und`}</TableCell>
                        <TableCell align="right">{fmt(scale.unitPrice)}</TableCell>
                      </TableRow>
                    ))}
                    {specialRule ? (
                      <TableRow hover selected={selectionMode === "SPECIAL"} onClick={handleSelectSpecial} sx={{ cursor: "pointer" }}>
                        <TableCell padding="checkbox">
                          <Radio checked={selectionMode === "SPECIAL"} onChange={handleSelectSpecial} />
                        </TableCell>
                        <TableCell>1</TableCell>
                        <TableCell>{specialRule.label}</TableCell>
                        <TableCell align="right">{fmt(specialRule.unitPrice)}</TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </Box>

              <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: canEditManualPrice ? "1fr 1fr" : "1fr" }} gap={2}>
                <TextField
                  label="Cantidad a agregar"
                  type="number"
                  inputProps={{ min: 1, step: 1 }}
                  value={qty}
                  onChange={(event) => setQty(event.target.value)}
                  helperText="Se carga con la cantidad sugerida por la opcion elegida, pero puedes ajustarla."
                />

                {canEditManualPrice ? (
                  <TextField
                    label="Precio manual autorizado"
                    type="number"
                    inputProps={{ min: 0, step: 1 }}
                    value={manualUnitPrice}
                    onChange={(event) => handleManualPriceChange(event.target.value)}
                    helperText="Si lo diligencias, esta opcion reemplaza la seleccion de la tabla."
                  />
                ) : null}
              </Box>

              {preview && !preview.ok ? (
                <Alert severity="error">{preview.message}</Alert>
              ) : preview?.ok ? (
                <Box
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 2,
                  }}
                >
                  <Stack spacing={1}>
                    <Row label="Precio unitario" value={fmt(preview.quote.unitPrice)} />
                    <Row label="Subtotal" value={fmt(preview.quote.subtotal)} />
                    <Row label="Origen aplicado" value={preview.quote.sourceLabel} />
                    <Row label="Cantidad sugerida" value={String(normalizedQty)} />
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
        <Button variant="contained" onClick={handleConfirm} disabled={!preview?.ok}>
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
