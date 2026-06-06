/* eslint-disable react-refresh/only-export-components */
import { Dispatch, ReactNode, SetStateAction, useEffect, useMemo, useState } from "react";

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import {
  PRODUCT_TAX_OPTIONS,
  PRODUCT_UNIT_OPTIONS,
  getTaxConfig,
  getTaxOptionFromValues,
  type ProductTaxOption,
  type ProductUnitOption,
} from "@/features/products/constants";
import {
  calculateMarginFromPrice,
  calculateSalePrice,
  type CategoryOption,
  type SubcategoryMap,
} from "@/features/products/services/products.api";
import type {
  Product,
  ProductFormInput,
  ProductPricingConfig,
  ProductPricingScale,
  ProductPricingSpecialRule,
} from "@/features/products/types";

export type PricingMode = "margin" | "price";

type ProductPricingScaleFormState = {
  id: string;
  minQty: string;
  label: string;
  unitPrice: string;
};

type ProductPricingSpecialRuleFormState = {
  id: string;
  label: string;
  unitPrice: string;
};

export type ProductFormState = {
  name: string;
  barcode: string;
  categoryId: string;
  subcategoryId: string;
  unitMeasure: ProductUnitOption;
  cost: string;
  marginPercent: string;
  taxRate: string;
  stock: string;
  price: string;
  hasTax: boolean;
  isActive: boolean;
  pricingEnabled: boolean;
  pricingMinimumPrice: string;
  pricingScales: ProductPricingScaleFormState[];
  pricingSpecialRules: ProductPricingSpecialRuleFormState[];
};

type ProductFormFieldsProps = {
  form: ProductFormState;
  setForm: Dispatch<SetStateAction<ProductFormState>>;
  pricingMode: PricingMode;
  setPricingMode: Dispatch<SetStateAction<PricingMode>>;
  categories: CategoryOption[];
  subcategoryMap: SubcategoryMap;
  skuValue?: string | null;
  showStatus?: boolean;
};

type ProductCreateViewProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: ProductFormInput) => void;
  categories: CategoryOption[];
  subcategoryMap: SubcategoryMap;
};

function currency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function numberFromString(value: string) {
  return Number(String(value || 0).replace(",", "."));
}

function integerFromString(value: string) {
  return Math.max(0, Math.round(numberFromString(value)));
}

function fixedString(value: number) {
  return Number.isFinite(value) ? String(Number(value.toFixed(2))) : "0";
}

function calculateProfitValue(cost: number, price: number, hasTax: boolean, taxRate: number) {
  const baseSalePrice = hasTax && taxRate > 0 ? price / (1 + taxRate) : price;
  return Math.round(baseSalePrice - cost);
}

function scaleMarginLabel(cost: number, price: number, hasTax: boolean, taxRate: number) {
  return fixedString(calculateMarginFromPrice(cost, price, hasTax, taxRate));
}

function scaleProfitLabel(cost: number, price: number, hasTax: boolean, taxRate: number) {
  return String(calculateProfitValue(cost, price, hasTax, taxRate));
}

function priceFromScaleMargin(cost: number, marginPercent: string, hasTax: boolean, taxRate: number) {
  return String(calculateSalePrice(cost, numberFromString(marginPercent), hasTax, taxRate));
}

function createScale(
  minQty = 1,
  unitPrice = 0,
  label = "",
  id: string = crypto.randomUUID()
): ProductPricingScaleFormState {
  return { id, minQty: String(minQty), label, unitPrice: String(unitPrice) };
}

function createSpecialRule(
  label = "Tarifa especial",
  unitPrice = 0,
  id: string = crypto.randomUUID()
): ProductPricingSpecialRuleFormState {
  return { id, label, unitPrice: String(unitPrice) };
}

function buildQuantityScalePreset(basePrice: number) {
  return [
    createScale(10, Math.round(basePrice * 0.9), "10 unidades"),
    createScale(20, Math.round(basePrice * 0.8), "20 unidades"),
    createScale(50, Math.round(basePrice * 0.67), "50 unidades"),
    createScale(100, Math.round(basePrice * 0.5), "100 unidades"),
  ];
}

function buildSpecialRulePreset(basePrice: number) {
  return createSpecialRule("Tarifa especial", Math.round(basePrice * 0.34));
}

function syncPriceFromMargin(form: ProductFormState): ProductFormState {
  const salePrice = calculateSalePrice(
    numberFromString(form.cost),
    numberFromString(form.marginPercent),
    form.hasTax,
    numberFromString(form.taxRate)
  );

  return { ...form, price: String(salePrice) };
}

function syncMarginFromPrice(form: ProductFormState): ProductFormState {
  const marginPercent = calculateMarginFromPrice(
    numberFromString(form.cost),
    numberFromString(form.price),
    form.hasTax,
    numberFromString(form.taxRate)
  );

  return { ...form, marginPercent: fixedString(marginPercent) };
}

function sortScaleStates(scales: ProductPricingScaleFormState[]) {
  return [...scales].sort(
    (left, right) => Math.max(1, integerFromString(left.minQty)) - Math.max(1, integerFromString(right.minQty))
  );
}

function buildPricingScales(form: ProductFormState): ProductPricingScale[] {
  return sortScaleStates(form.pricingScales)
    .map((scale) => ({
      minQty: Math.max(1, integerFromString(scale.minQty)),
      label: scale.label.trim() || null,
      unitPrice: integerFromString(scale.unitPrice),
    }))
    .filter((scale) => scale.unitPrice > 0);
}

function buildSpecialRules(form: ProductFormState): ProductPricingSpecialRule[] {
  const specialRule = form.pricingSpecialRules[0];
  if (!specialRule) return [];

  const unitPrice = integerFromString(specialRule.unitPrice);
  if (unitPrice <= 0 || !specialRule.label.trim()) return [];

  return [{ id: specialRule.id, label: specialRule.label.trim(), unitPrice }];
}

function buildPricingConfig(form: ProductFormState): ProductPricingConfig | null {
  if (!form.pricingEnabled) return null;

  return {
    enabled: true,
    basePrice: integerFromString(form.price),
    minimumPrice: integerFromString(form.pricingMinimumPrice),
    quantityScales: buildPricingScales(form),
    specialPriceRules: buildSpecialRules(form),
  };
}

export function applyPricingMode(form: ProductFormState, pricingMode: PricingMode) {
  return pricingMode === "price" ? syncMarginFromPrice(form) : syncPriceFromMargin(form);
}

export const emptyProductFormState: ProductFormState = syncPriceFromMargin({
  name: "",
  barcode: "",
  categoryId: "",
  subcategoryId: "",
  unitMeasure: "UNIDAD",
  cost: "0",
  marginPercent: "30",
  taxRate: "0.19",
  stock: "0",
  price: "0",
  hasTax: true,
  isActive: true,
  pricingEnabled: false,
  pricingMinimumPrice: "0",
  pricingScales: [],
  pricingSpecialRules: [],
});

export function productToFormState(product: Product): ProductFormState {
  const pricingConfig = product.pricingConfig;

  return {
    name: product.name,
    barcode: product.barcode ?? "",
    categoryId: product.categoryId ?? "",
    subcategoryId: product.subcategoryId ?? "",
    unitMeasure: (product.unitMeasure as ProductUnitOption) ?? "UNIDAD",
    cost: String(product.cost),
    marginPercent: fixedString(product.marginPercent),
    taxRate: fixedString(product.taxRate || 0.19),
    stock: String(product.stock),
    price: String(product.price),
    hasTax: product.hasTax,
    isActive: product.isActive,
    pricingEnabled: Boolean(pricingConfig?.enabled),
    pricingMinimumPrice: String(pricingConfig?.minimumPrice ?? 0),
    pricingScales:
      pricingConfig?.quantityScales.map((scale) => createScale(scale.minQty, scale.unitPrice, scale.label || "")) ?? [],
    pricingSpecialRules:
      pricingConfig?.specialPriceRules.map((rule) => createSpecialRule(rule.label, rule.unitPrice, rule.id)) ?? [],
  };
}

export function productFormToPayload(form: ProductFormState): ProductFormInput {
  return {
    name: form.name.trim(),
    barcode: form.barcode.trim() || null,
    unitMeasure: form.unitMeasure,
    categoryId: form.categoryId || null,
    subcategoryId: form.subcategoryId || null,
    cost: numberFromString(form.cost),
    marginPercent: numberFromString(form.marginPercent),
    taxRate: form.hasTax ? numberFromString(form.taxRate) : 0,
    hasTax: form.hasTax,
    stock: integerFromString(form.stock),
    price: integerFromString(form.price),
    pricingConfig: buildPricingConfig(form),
    isActive: form.isActive,
  };
}

export function validateProductForm(form: ProductFormState) {
  if (!form.name.trim()) return "El nombre es obligatorio.";
  if (numberFromString(form.cost) < 0) return "El costo no puede ser negativo.";
  if (integerFromString(form.stock) < 0) return "El stock no puede ser negativo.";
  if (numberFromString(form.marginPercent) < 0) return "El margen no puede ser negativo.";
  if (numberFromString(form.marginPercent) >= 100) return "El margen debe ser menor a 100%.";
  if (integerFromString(form.price) <= 0) return "El precio base debe ser mayor a 0.";
  if (form.hasTax && numberFromString(form.taxRate) < 0) return "El IVA no puede ser negativo.";
  if (form.subcategoryId && !form.categoryId) return "Primero selecciona una categoria para usar subcategoria.";

  if (!form.pricingEnabled) return null;

  const minimumPrice = integerFromString(form.pricingMinimumPrice);
  if (form.pricingScales.length === 0) return "Debes configurar al menos una escala valida.";

  const usedScaleQuantities = new Set<number>();
  for (const scale of form.pricingScales) {
    const minQty = Math.max(1, integerFromString(scale.minQty));
    const unitPrice = integerFromString(scale.unitPrice);
    if (unitPrice <= 0) return "Cada escala debe tener un precio de venta valido.";
    if (unitPrice < minimumPrice) return "Las escalas no pueden quedar por debajo del minimo permitido.";
    if (usedScaleQuantities.has(minQty)) return "No puedes repetir cantidades dentro de las escalas.";
    usedScaleQuantities.add(minQty);
  }

  if (form.pricingSpecialRules.length > 1) return "Solo se permite una tarifa especial por producto.";

  const specialRule = form.pricingSpecialRules[0];
  if (specialRule) {
    const unitPrice = integerFromString(specialRule.unitPrice);
    if (!specialRule.label.trim()) return "La tarifa especial debe tener un nombre.";
    if (unitPrice <= 0) return "La tarifa especial debe tener un precio valido.";
    if (unitPrice < minimumPrice) return "La tarifa especial no puede quedar por debajo del minimo permitido.";
  }

  return null;
}

function ScaleRowFields({
  quantityLabel,
  labelValue,
  onLabelChange,
  priceValue,
  onPriceChange,
  marginValue,
  onMarginChange,
  profitValue,
  onRemove,
}: {
  quantityLabel: ReactNode;
  labelValue: string;
  onLabelChange: (value: string) => void;
  priceValue: string;
  onPriceChange: (value: string) => void;
  marginValue: string;
  onMarginChange: (value: string) => void;
  profitValue: string;
  onRemove: () => void;
}) {
  return (
    <Box
      display="grid"
      gridTemplateColumns={{ xs: "1fr", md: "140px 1.2fr 1fr 1fr 1fr auto" }}
      gap={2}
      alignItems="center"
    >
      {quantityLabel}
      <TextField label="Etiqueta opcional" value={labelValue} onChange={(event) => onLabelChange(event.target.value)} />
      <TextField
        label="Precio de venta"
        type="number"
        inputProps={{ min: 0, step: 1 }}
        value={priceValue}
        onChange={(event) => onPriceChange(event.target.value)}
      />
      <TextField
        label="% margen"
        type="number"
        inputProps={{ min: 0, step: "0.01" }}
        value={marginValue}
        onChange={(event) => onMarginChange(event.target.value)}
      />
      <TextField label="Ganancia $" value={profitValue} InputProps={{ readOnly: true }} />
      <Tooltip title="Eliminar">
        <span>
          <IconButton color="error" onClick={onRemove}>
            <DeleteOutlineIcon />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}

export function ProductFormFields({
  form,
  setForm,
  pricingMode,
  setPricingMode,
  categories,
  subcategoryMap,
  skuValue,
  showStatus,
}: ProductFormFieldsProps) {
  const availableSubcategories = useMemo(
    () => (form.categoryId ? subcategoryMap[form.categoryId] || [] : []),
    [form.categoryId, subcategoryMap]
  );
  const selectedTaxOption = getTaxOptionFromValues(form.hasTax, numberFromString(form.taxRate));
  const estimatedMargin = fixedString(
    calculateMarginFromPrice(
      numberFromString(form.cost),
      numberFromString(form.price),
      form.hasTax,
      numberFromString(form.taxRate)
    )
  );

  useEffect(() => {
    if (pricingMode === "price") {
      const nextMargin = fixedString(
        calculateMarginFromPrice(
          numberFromString(form.cost),
          numberFromString(form.price),
          form.hasTax,
          numberFromString(form.taxRate)
        )
      );

      if (nextMargin !== form.marginPercent) {
        setForm((prev) => ({ ...prev, marginPercent: nextMargin }));
      }
      return;
    }

    const nextPrice = String(
      calculateSalePrice(
        numberFromString(form.cost),
        numberFromString(form.marginPercent),
        form.hasTax,
        numberFromString(form.taxRate)
      )
    );

    if (nextPrice !== form.price) {
      setForm((prev) => ({ ...prev, price: nextPrice }));
    }
  }, [form.cost, form.marginPercent, form.price, form.hasTax, form.taxRate, pricingMode, setForm]);

  const addScale = () => {
    setForm((prev) => ({
      ...prev,
      pricingScales: sortScaleStates([...prev.pricingScales, createScale(1, integerFromString(prev.price), "")]),
    }));
  };

  const updateScale = (scaleId: string, patch: Partial<ProductPricingScaleFormState>) => {
    setForm((prev) => ({
      ...prev,
      pricingScales: sortScaleStates(
        prev.pricingScales.map((scale) => (scale.id === scaleId ? { ...scale, ...patch } : scale))
      ),
    }));
  };

  const updateScaleMargin = (scaleId: string, marginPercent: string) => {
    const nextPrice = priceFromScaleMargin(
      numberFromString(form.cost),
      marginPercent,
      form.hasTax,
      numberFromString(form.taxRate)
    );
    updateScale(scaleId, { unitPrice: nextPrice });
  };

  const removeScale = (scaleId: string) => {
    setForm((prev) => ({
      ...prev,
      pricingScales: prev.pricingScales.filter((scale) => scale.id !== scaleId),
    }));
  };

  const addSpecialRule = () => {
    setForm((prev) => ({
      ...prev,
      pricingSpecialRules:
        prev.pricingSpecialRules.length > 0
          ? prev.pricingSpecialRules
          : [buildSpecialRulePreset(integerFromString(prev.price))],
    }));
  };

  const updateSpecialRule = (ruleId: string, patch: Partial<ProductPricingSpecialRuleFormState>) => {
    setForm((prev) => ({
      ...prev,
      pricingSpecialRules: prev.pricingSpecialRules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)),
    }));
  };

  const updateSpecialRuleMargin = (ruleId: string, marginPercent: string) => {
    const nextPrice = priceFromScaleMargin(
      numberFromString(form.cost),
      marginPercent,
      form.hasTax,
      numberFromString(form.taxRate)
    );
    updateSpecialRule(ruleId, { unitPrice: nextPrice });
  };

  const removeSpecialRule = (ruleId: string) => {
    setForm((prev) => ({
      ...prev,
      pricingSpecialRules: prev.pricingSpecialRules.filter((rule) => rule.id !== ruleId),
    }));
  };

  const loadPrintPreset = () => {
    const basePrice = integerFromString(form.price) || 300;
    setForm((prev) => ({
      ...prev,
      pricingEnabled: true,
      pricingScales: buildQuantityScalePreset(basePrice),
      pricingSpecialRules: [buildSpecialRulePreset(basePrice)],
    }));
  };

  return (
    <Stack spacing={2.25} sx={{ mt: 1.5 }}>
      {skuValue ? (
        <Alert severity="info" sx={{ py: 0.5 }}>
          SKU actual: {skuValue}
        </Alert>
      ) : (
        <Alert severity="info" sx={{ py: 0.5 }}>
          El SKU se genera automaticamente al guardar el producto.
        </Alert>
      )}

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "1.25fr 1fr" }} gap={2}>
        <TextField label="Nombre" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required fullWidth />
        <FormControl fullWidth>
          <InputLabel id="product-category-label">Categoria</InputLabel>
          <Select
            labelId="product-category-label"
            value={form.categoryId}
            label="Categoria"
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                categoryId: event.target.value,
                subcategoryId:
                  subcategoryMap[event.target.value]?.some((item) => item.id === prev.subcategoryId)
                    ? prev.subcategoryId
                    : "",
              }))
            }
          >
            <MenuItem value="">Sin categoria</MenuItem>
            {categories.map((category) => (
              <MenuItem key={category.id} value={category.id}>
                {category.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(4, 1fr)" }} gap={2}>
        <FormControl fullWidth>
          <InputLabel id="product-subcategory-label">Subcategoria</InputLabel>
          <Select
            labelId="product-subcategory-label"
            value={form.subcategoryId}
            label="Subcategoria"
            disabled={!form.categoryId || availableSubcategories.length === 0}
            onChange={(event) => setForm((prev) => ({ ...prev, subcategoryId: event.target.value }))}
          >
            <MenuItem value="">Sin subcategoria</MenuItem>
            {availableSubcategories.map((subcategory) => (
              <MenuItem key={subcategory.id} value={subcategory.id}>
                {subcategory.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth>
          <InputLabel id="product-unit-label">Unidad</InputLabel>
          <Select
            labelId="product-unit-label"
            value={form.unitMeasure}
            label="Unidad"
            onChange={(event) => setForm((prev) => ({ ...prev, unitMeasure: event.target.value as ProductUnitOption }))}
          >
            {PRODUCT_UNIT_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField label="Codigo de barras" value={form.barcode} onChange={(event) => setForm((prev) => ({ ...prev, barcode: event.target.value }))} fullWidth />
        <TextField label="Stock inicial" type="number" inputProps={{ min: 0, step: 1 }} value={form.stock} onChange={(event) => setForm((prev) => ({ ...prev, stock: event.target.value }))} fullWidth />
      </Box>

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(3, 1fr)" }} gap={2}>
        <TextField label="Costo inicial" type="number" inputProps={{ min: 0, step: "0.01" }} value={form.cost} onChange={(event) => setForm((prev) => applyPricingMode({ ...prev, cost: event.target.value }, pricingMode))} fullWidth />
        <TextField
          label="Precio base"
          type="number"
          inputProps={{ min: 0, step: "0.01" }}
          value={form.price}
          onChange={(event) => {
            setPricingMode("price");
            setForm((prev) => syncMarginFromPrice({ ...prev, price: event.target.value }));
          }}
          helperText="Este es el precio base real del producto."
          fullWidth
        />
        <TextField label="Margen del precio base" value={`${estimatedMargin}%`} helperText="Se calcula con costo, IVA y precio base." InputProps={{ readOnly: true }} fullWidth />
      </Box>

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "1fr 1fr" }} gap={2}>
        <FormControl fullWidth>
          <InputLabel id="product-tax-label">IVA</InputLabel>
          <Select
            labelId="product-tax-label"
            value={selectedTaxOption}
            label="IVA"
            onChange={(event) => {
              const option = getTaxConfig(event.target.value as ProductTaxOption);
              setPricingMode("price");
              setForm((prev) => syncMarginFromPrice({ ...prev, hasTax: option.hasTax, taxRate: String(option.taxRate) }));
            }}
          >
            {PRODUCT_TAX_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          label="Resumen rapido"
          value={
            form.pricingEnabled
              ? `Base ${currency(numberFromString(form.price))} | ${form.pricingScales.length} escalas`
              : `Costo ${currency(numberFromString(form.cost))} | Precio ${currency(numberFromString(form.price))}`
          }
          InputProps={{ readOnly: true }}
          fullWidth
        />
      </Box>

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
              <Box>
                <Typography variant="h6" fontWeight={800}>
                  Configuracion de precio por cantidad
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Las escalas son una configuracion adicional. El precio base del producto no se reemplaza.
                </Typography>
              </Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.pricingEnabled}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        pricingEnabled: event.target.checked,
                        pricingScales:
                          event.target.checked && prev.pricingScales.length === 0
                            ? buildQuantityScalePreset(integerFromString(prev.price) || 300)
                            : prev.pricingScales,
                      }))
                    }
                  />
                }
                label={form.pricingEnabled ? "Permitir reglas por cantidad: si" : "Permitir reglas por cantidad: no"}
              />
            </Box>

            {form.pricingEnabled ? (
              <>
                <Alert severity="info">
                  En caja se abre un modal para elegir base, escala o tarifa especial. El precio base del producto sigue
                  siendo {currency(numberFromString(form.price))}.
                </Alert>

                <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(3, 1fr)" }} gap={2}>
                  <TextField label="Precio base del producto" value={currency(numberFromString(form.price))} InputProps={{ readOnly: true }} />
                  <TextField
                    label="Precio minimo permitido"
                    type="number"
                    inputProps={{ min: 0, step: 1 }}
                    value={form.pricingMinimumPrice}
                    onChange={(event) => setForm((prev) => ({ ...prev, pricingMinimumPrice: event.target.value }))}
                  />
                  <TextField label="Escalas configuradas" value={String(form.pricingScales.length)} InputProps={{ readOnly: true }} />
                </Box>

                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Button variant="outlined" onClick={loadPrintPreset}>
                    Cargar ejemplo rapido
                  </Button>
                </Stack>

                <Card variant="outlined">
                  <CardContent>
                    <Stack spacing={1.5}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
                        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                          <Typography variant="subtitle1" fontWeight={800}>
                            Escalas por cantidad
                          </Typography>
                          <Chip size="small" label={`${form.pricingScales.length} escalas`} color="primary" variant="outlined" />
                        </Box>
                        <Button variant="outlined" onClick={addScale}>
                          Agregar escala
                        </Button>
                      </Box>

                      <Typography variant="body2" color="text.secondary">
                        Cada escala tiene su propio precio y rentabilidad. No se permiten cantidades repetidas.
                      </Typography>

                      {form.pricingScales.length === 0 ? (
                        <Alert severity="warning">Debes crear al menos una escala valida mientras esta opcion este activa.</Alert>
                      ) : (
                        <Stack spacing={1.25}>
                          {sortScaleStates(form.pricingScales).map((scale) => {
                            const currentPrice = integerFromString(scale.unitPrice);
                            const scaleMargin = scaleMarginLabel(
                              numberFromString(form.cost),
                              currentPrice,
                              form.hasTax,
                              numberFromString(form.taxRate)
                            );
                            const scaleProfit = scaleProfitLabel(
                              numberFromString(form.cost),
                              currentPrice,
                              form.hasTax,
                              numberFromString(form.taxRate)
                            );

                            return (
                              <ScaleRowFields
                                key={scale.id}
                                quantityLabel={
                                  <TextField
                                    label="Cantidad"
                                    type="number"
                                    inputProps={{ min: 1, step: 1 }}
                                    value={scale.minQty}
                                    onChange={(event) => updateScale(scale.id, { minQty: event.target.value })}
                                  />
                                }
                                labelValue={scale.label}
                                onLabelChange={(value) => updateScale(scale.id, { label: value })}
                                priceValue={scale.unitPrice}
                                onPriceChange={(value) => updateScale(scale.id, { unitPrice: value })}
                                marginValue={scaleMargin}
                                onMarginChange={(value) => updateScaleMargin(scale.id, value)}
                                profitValue={currency(numberFromString(scaleProfit))}
                                onRemove={() => removeScale(scale.id)}
                              />
                            );
                          })}
                        </Stack>
                      )}
                    </Stack>
                  </CardContent>
                </Card>

                <Card variant="outlined">
                  <CardContent>
                    <Stack spacing={1.5}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
                        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                          <Typography variant="subtitle1" fontWeight={800}>
                            Tarifa especial
                          </Typography>
                          <Chip
                            size="small"
                            label={form.pricingSpecialRules.length > 0 ? "1 configurada" : "No configurada"}
                            color="secondary"
                            variant="outlined"
                          />
                        </Box>
                        {form.pricingSpecialRules.length === 0 ? (
                          <Button variant="outlined" onClick={addSpecialRule}>
                            Agregar tarifa especial
                          </Button>
                        ) : null}
                      </Box>

                      <Typography variant="body2" color="text.secondary">
                        Solo se permite una tarifa especial. Se activa manualmente en el modal de facturacion.
                      </Typography>

                      {form.pricingSpecialRules.length === 0 ? (
                        <Alert severity="info">No hay tarifa especial configurada para este producto.</Alert>
                      ) : (
                        form.pricingSpecialRules.map((rule) => {
                          const currentPrice = integerFromString(rule.unitPrice);
                          const ruleMargin = scaleMarginLabel(
                            numberFromString(form.cost),
                            currentPrice,
                            form.hasTax,
                            numberFromString(form.taxRate)
                          );
                          const ruleProfit = scaleProfitLabel(
                            numberFromString(form.cost),
                            currentPrice,
                            form.hasTax,
                            numberFromString(form.taxRate)
                          );

                          return (
                            <ScaleRowFields
                              key={rule.id}
                              quantityLabel={<TextField label="Tipo" value="Especial" InputProps={{ readOnly: true }} />}
                              labelValue={rule.label}
                              onLabelChange={(value) => updateSpecialRule(rule.id, { label: value })}
                              priceValue={rule.unitPrice}
                              onPriceChange={(value) => updateSpecialRule(rule.id, { unitPrice: value })}
                              marginValue={ruleMargin}
                              onMarginChange={(value) => updateSpecialRuleMargin(rule.id, value)}
                              profitValue={currency(numberFromString(ruleProfit))}
                              onRemove={() => removeSpecialRule(rule.id)}
                            />
                          );
                        })
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Alert severity="info">Este producto se vendera siempre con su precio base.</Alert>
            )}
          </Stack>
        </CardContent>
      </Card>

      {showStatus ? (
        <FormControlLabel
          control={<Switch checked={form.isActive} onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))} />}
          label={form.isActive ? "Producto activo" : "Producto inactivo"}
        />
      ) : null}
    </Stack>
  );
}

export default function ProductCreateView({
  open,
  onClose,
  onSubmit,
  categories,
  subcategoryMap,
}: ProductCreateViewProps) {
  const [form, setForm] = useState<ProductFormState>(emptyProductFormState);
  const [pricingMode, setPricingMode] = useState<PricingMode>("margin");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(emptyProductFormState);
    setPricingMode("margin");
    setError(null);
  }, [open]);

  const handleSave = () => {
    const normalizedForm = applyPricingMode(form, pricingMode);
    const validationError = validateProductForm(normalizedForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    onSubmit(productFormToPayload(normalizedForm));
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Nuevo producto</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mt: 2 }}>
          Registra el producto y, si aplica, configura sus escalas de cantidad como una capa adicional del precio base.
        </Alert>
        {error ? <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert> : null}
        <ProductFormFields
          form={form}
          setForm={setForm}
          pricingMode={pricingMode}
          setPricingMode={setPricingMode}
          categories={categories}
          subcategoryMap={subcategoryMap}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancelar
        </Button>
        <Button onClick={handleSave} variant="contained">
          Guardar producto
        </Button>
      </DialogActions>
    </Dialog>
  );
}
