/* eslint-disable react-refresh/only-export-components */
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";

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
import { getReferenceUnitPrice } from "../../../../shared/productPricing";

export type PricingMode = "margin" | "price";

type ProductPricingScaleFormState = {
  id: string;
  minQty: string;
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
  pricingBasePrice: string;
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

function createScale(minQty: number, unitPrice: number): ProductPricingScaleFormState {
  return {
    id: crypto.randomUUID(),
    minQty: String(minQty),
    unitPrice: String(unitPrice),
  };
}

function createSpecialRule(label = "", unitPrice = 0, id: string = crypto.randomUUID()): ProductPricingSpecialRuleFormState {
  return {
    id,
    label,
    unitPrice: String(unitPrice),
  };
}

function buildQuantityScalePreset() {
  return [
    createScale(1, 300),
    createScale(10, 270),
    createScale(20, 240),
    createScale(50, 200),
    createScale(100, 150),
  ];
}

function buildSpecialRulePreset() {
  return [createSpecialRule("Tarifa especial", 100)];
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

function buildPricingScales(form: ProductFormState): ProductPricingScale[] {
  return form.pricingScales
    .map((scale) => ({
      minQty: Math.max(1, integerFromString(scale.minQty)),
      unitPrice: integerFromString(scale.unitPrice),
    }))
    .filter((scale) => scale.unitPrice > 0)
    .sort((left, right) => left.minQty - right.minQty);
}

function buildSpecialRules(form: ProductFormState): ProductPricingSpecialRule[] {
  return form.pricingSpecialRules
    .map((rule) => ({
      id: rule.id,
      label: rule.label.trim(),
      unitPrice: integerFromString(rule.unitPrice),
    }))
    .filter((rule) => rule.label.length > 0 && rule.unitPrice > 0);
}

function buildPricingConfig(form: ProductFormState): ProductPricingConfig | null {
  if (!form.pricingEnabled) return null;

  const basePrice = integerFromString(form.pricingBasePrice);
  if (basePrice <= 0) return null;

  return {
    enabled: true,
    basePrice,
    minimumPrice: integerFromString(form.pricingMinimumPrice),
    quantityScales: buildPricingScales(form),
    specialPriceRules: buildSpecialRules(form),
  };
}

export function applyPricingMode(form: ProductFormState, pricingMode: PricingMode) {
  if (form.pricingEnabled) {
    const pricingConfig = buildPricingConfig(form);
    const referencePrice = getReferenceUnitPrice(numberFromString(form.price), pricingConfig);
    return syncMarginFromPrice({ ...form, price: String(referencePrice) });
  }

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
  pricingBasePrice: "300",
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
    pricingBasePrice: String(pricingConfig?.basePrice ?? product.price ?? 0),
    pricingMinimumPrice: String(pricingConfig?.minimumPrice ?? 0),
    pricingScales:
      pricingConfig?.quantityScales.map((scale) => createScale(scale.minQty, scale.unitPrice)) ?? [],
    pricingSpecialRules:
      pricingConfig?.specialPriceRules.map((rule) => createSpecialRule(rule.label, rule.unitPrice, rule.id)) ?? [],
  };
}

export function productFormToPayload(form: ProductFormState): ProductFormInput {
  const pricingConfig = buildPricingConfig(form);
  const referencePrice = pricingConfig
    ? getReferenceUnitPrice(numberFromString(form.price), pricingConfig)
    : numberFromString(form.price);

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
    price: referencePrice,
    pricingConfig,
    isActive: form.isActive,
  };
}

export function validateProductForm(form: ProductFormState) {
  if (!form.name.trim()) return "El nombre es obligatorio.";
  if (numberFromString(form.cost) < 0) return "El costo no puede ser negativo.";
  if (integerFromString(form.stock) < 0) return "El stock no puede ser negativo.";
  if (numberFromString(form.marginPercent) < 0) return "La ganancia no puede ser negativa.";
  if (numberFromString(form.price) < 0) return "El precio de referencia no puede ser negativo.";
  if (form.hasTax && numberFromString(form.taxRate) < 0) return "El IVA no puede ser negativo.";
  if (form.subcategoryId && !form.categoryId) return "Primero selecciona una categoria para usar subcategoria.";

  if (!form.pricingEnabled) {
    return null;
  }

  const basePrice = integerFromString(form.pricingBasePrice);
  if (basePrice <= 0) {
    return "El precio base debe ser mayor a 0.";
  }

  const minimumPrice = integerFromString(form.pricingMinimumPrice);
  const usedScaleQuantities = new Set<number>();

  for (const scale of form.pricingScales) {
    const minQty = Math.max(1, integerFromString(scale.minQty));
    const unitPrice = integerFromString(scale.unitPrice);

    if (unitPrice <= 0) {
      return "Cada escala debe tener un precio unitario valido.";
    }

    if (unitPrice < minimumPrice) {
      return "Las escalas no pueden quedar por debajo del minimo permitido.";
    }

    if (usedScaleQuantities.has(minQty)) {
      return "No repitas la misma cantidad minima en las escalas.";
    }

    usedScaleQuantities.add(minQty);
  }

  const usedRuleLabels = new Set<string>();
  for (const rule of form.pricingSpecialRules) {
    const label = rule.label.trim().toLowerCase();
    const unitPrice = integerFromString(rule.unitPrice);

    if (!label) {
      return "Cada tarifa especial debe tener un nombre.";
    }

    if (unitPrice <= 0) {
      return "Cada tarifa especial debe tener un precio valido.";
    }

    if (unitPrice < minimumPrice) {
      return "Las tarifas especiales no pueden quedar por debajo del minimo permitido.";
    }

    if (usedRuleLabels.has(label)) {
      return "No repitas tarifas especiales dentro del mismo producto.";
    }

    usedRuleLabels.add(label);
  }

  return null;
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
  const pricingConfig = useMemo(() => buildPricingConfig(form), [form]);
  const referenceDynamicPrice = useMemo(
    () => getReferenceUnitPrice(numberFromString(form.price), pricingConfig),
    [form.price, pricingConfig]
  );
  const lowestSpecialRulePrice = useMemo(() => {
    const prices = form.pricingSpecialRules
      .map((rule) => integerFromString(rule.unitPrice))
      .filter((price) => price > 0);
    return prices.length > 0 ? Math.min(...prices) : null;
  }, [form.pricingSpecialRules]);

  useEffect(() => {
    if (form.pricingEnabled) {
      if (String(referenceDynamicPrice) !== form.price) {
        setForm((prev) => syncMarginFromPrice({ ...prev, price: String(referenceDynamicPrice) }));
      }
      return;
    }

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
  }, [
    form.cost,
    form.marginPercent,
    form.price,
    form.hasTax,
    form.pricingEnabled,
    form.taxRate,
    pricingMode,
    referenceDynamicPrice,
    setForm,
  ]);

  const replaceWithPrintPreset = () => {
    setForm((prev) => ({
      ...prev,
      pricingEnabled: true,
      pricingBasePrice: "300",
      pricingScales: buildQuantityScalePreset(),
      pricingSpecialRules: buildSpecialRulePreset(),
    }));
  };

  const addScale = () => {
    setForm((prev) => ({
      ...prev,
      pricingScales: [...prev.pricingScales, createScale(1, integerFromString(prev.pricingBasePrice) || 0)],
    }));
  };

  const updateScale = (
    scaleId: string,
    patch: Partial<Pick<ProductPricingScaleFormState, "minQty" | "unitPrice">>
  ) => {
    setForm((prev) => ({
      ...prev,
      pricingScales: prev.pricingScales.map((scale) => (scale.id === scaleId ? { ...scale, ...patch } : scale)),
    }));
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
      pricingSpecialRules: [
        ...prev.pricingSpecialRules,
        createSpecialRule("Tarifa especial", integerFromString(prev.pricingBasePrice) || 0),
      ],
    }));
  };

  const updateSpecialRule = (
    ruleId: string,
    patch: Partial<Pick<ProductPricingSpecialRuleFormState, "label" | "unitPrice">>
  ) => {
    setForm((prev) => ({
      ...prev,
      pricingSpecialRules: prev.pricingSpecialRules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)),
    }));
  };

  const removeSpecialRule = (ruleId: string) => {
    setForm((prev) => ({
      ...prev,
      pricingSpecialRules: prev.pricingSpecialRules.filter((rule) => rule.id !== ruleId),
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
        <TextField
          label="Nombre"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          required
          fullWidth
        />

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

        <TextField
          label="Codigo de barras"
          value={form.barcode}
          onChange={(event) => setForm((prev) => ({ ...prev, barcode: event.target.value }))}
          fullWidth
        />

        <TextField
          label="Stock inicial"
          type="number"
          inputProps={{ min: 0, step: 1 }}
          value={form.stock}
          onChange={(event) => setForm((prev) => ({ ...prev, stock: event.target.value }))}
          fullWidth
        />
      </Box>

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(3, 1fr)" }} gap={2}>
        <TextField
          label="Costo inicial"
          type="number"
          inputProps={{ min: 0, step: "0.01" }}
          value={form.cost}
          onChange={(event) =>
            setForm((prev) => applyPricingMode({ ...prev, cost: event.target.value }, pricingMode))
          }
          fullWidth
        />

        <TextField
          label={form.pricingEnabled ? "Precio de referencia" : "Precio final"}
          type="number"
          inputProps={{ min: 0, step: "0.01" }}
          value={form.price}
          onChange={(event) => {
            if (form.pricingEnabled) return;
            setPricingMode("price");
            setForm((prev) => syncMarginFromPrice({ ...prev, price: event.target.value }));
          }}
          helperText={
            form.pricingEnabled
              ? "Se calcula automaticamente con la configuracion escalonada."
              : "Precio unitario del producto."
          }
          InputProps={{ readOnly: form.pricingEnabled }}
          fullWidth
        />

        <TextField
          label="Ganancia estimada"
          value={`${estimatedMargin}%`}
          helperText="Se calcula automaticamente con costo, IVA y precio."
          InputProps={{ readOnly: true }}
          fullWidth
        />
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
              setForm((prev) =>
                syncMarginFromPrice({
                  ...prev,
                  hasTax: option.hasTax,
                  taxRate: String(option.taxRate),
                })
              );
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
              ? `Desde ${currency(referenceDynamicPrice)} | ${form.pricingScales.length} escalas`
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
                  El sistema calcula automaticamente por cantidad y puede activar una tarifa especial controlada.
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
                          event.target.checked && prev.pricingScales.length === 0 ? buildQuantityScalePreset() : prev.pricingScales,
                        pricingSpecialRules:
                          event.target.checked && prev.pricingSpecialRules.length === 0
                            ? buildSpecialRulePreset()
                            : prev.pricingSpecialRules,
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
                  Orden aplicada en venta: primero se evalua la cantidad ingresada, luego la tarifa especial si se activa
                  en caja, y al final el minimo permitido. No hay descuento libre.
                </Alert>

                <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(4, 1fr)" }} gap={2}>
                  <TextField
                    label="Precio base"
                    type="number"
                    inputProps={{ min: 0, step: 1 }}
                    value={form.pricingBasePrice}
                    onChange={(event) => setForm((prev) => ({ ...prev, pricingBasePrice: event.target.value }))}
                  />
                  <TextField
                    label="Precio minimo permitido"
                    type="number"
                    inputProps={{ min: 0, step: 1 }}
                    value={form.pricingMinimumPrice}
                    onChange={(event) => setForm((prev) => ({ ...prev, pricingMinimumPrice: event.target.value }))}
                  />
                  <TextField
                    label="Escalas configuradas"
                    value={String(form.pricingScales.length)}
                    InputProps={{ readOnly: true }}
                  />
                  <TextField
                    label="Tarifa especial mas baja"
                    value={lowestSpecialRulePrice ? currency(lowestSpecialRulePrice) : "No configurada"}
                    InputProps={{ readOnly: true }}
                  />
                </Box>

                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Button variant="outlined" onClick={replaceWithPrintPreset}>
                    Cargar ejemplo de impresiones
                  </Button>
                </Stack>

                <Stack spacing={2}>
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
                          El sistema toma la escala de mayor cantidad minima que cumpla con la cantidad vendida.
                        </Typography>

                        {form.pricingScales.length === 0 ? (
                          <Alert severity="warning">
                            Sin escalas configuradas. El producto usara solo el precio base.
                          </Alert>
                        ) : (
                          <Stack spacing={1.25}>
                            {form.pricingScales.map((scale) => (
                              <Box
                                key={scale.id}
                                display="grid"
                                gridTemplateColumns={{ xs: "1fr", md: "160px 1fr auto" }}
                                gap={2}
                                alignItems="center"
                              >
                                <TextField
                                  label="Desde cantidad"
                                  type="number"
                                  inputProps={{ min: 1, step: 1 }}
                                  value={scale.minQty}
                                  onChange={(event) => updateScale(scale.id, { minQty: event.target.value })}
                                />
                                <TextField
                                  label="Precio unitario"
                                  type="number"
                                  inputProps={{ min: 0, step: 1 }}
                                  value={scale.unitPrice}
                                  onChange={(event) => updateScale(scale.id, { unitPrice: event.target.value })}
                                />
                                <Tooltip title="Eliminar escala">
                                  <span>
                                    <IconButton color="error" onClick={() => removeScale(scale.id)}>
                                      <DeleteOutlineIcon />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              </Box>
                            ))}
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
                              Tarifas especiales
                            </Typography>
                            <Chip
                              size="small"
                              label={`${form.pricingSpecialRules.length} tarifas`}
                              color="secondary"
                              variant="outlined"
                            />
                          </Box>
                          <Button variant="outlined" onClick={addSpecialRule}>
                            Agregar tarifa especial
                          </Button>
                        </Box>

                        <Typography variant="body2" color="text.secondary">
                          Son reglas opcionales que el cajero activa al agregar el producto a la venta.
                        </Typography>

                        {form.pricingSpecialRules.length === 0 ? (
                          <Alert severity="info">
                            Este producto no tiene tarifas especiales configuradas.
                          </Alert>
                        ) : (
                          <Stack spacing={1.25}>
                            {form.pricingSpecialRules.map((rule) => (
                              <Box
                                key={rule.id}
                                display="grid"
                                gridTemplateColumns={{ xs: "1fr", md: "1.2fr 180px auto" }}
                                gap={2}
                                alignItems="center"
                              >
                                <TextField
                                  label="Nombre de tarifa"
                                  value={rule.label}
                                  onChange={(event) => updateSpecialRule(rule.id, { label: event.target.value })}
                                />
                                <TextField
                                  label="Precio unitario"
                                  type="number"
                                  inputProps={{ min: 0, step: 1 }}
                                  value={rule.unitPrice}
                                  onChange={(event) => updateSpecialRule(rule.id, { unitPrice: event.target.value })}
                                />
                                <Tooltip title="Eliminar tarifa especial">
                                  <span>
                                    <IconButton color="error" onClick={() => removeSpecialRule(rule.id)}>
                                      <DeleteOutlineIcon />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              </Box>
                            ))}
                          </Stack>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Stack>
              </>
            ) : (
              <Alert severity="info">
                Usa esta opcion solo si el producto vende siempre al mismo precio. Para impresiones, copias y servicios
                similares conviene activar las reglas escalonadas.
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>

      {showStatus ? (
        <FormControlLabel
          control={
            <Switch
              checked={form.isActive}
              onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
            />
          }
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
    setPricingMode("price");
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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>Formulario rapido de producto</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Completa los datos del producto y, si aplica, define las escalas por cantidad y las tarifas especiales.
        </Typography>
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
          Crear producto
        </Button>
      </DialogActions>
    </Dialog>
  );
}
