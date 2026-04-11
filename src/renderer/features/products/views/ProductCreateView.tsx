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
import Divider from "@mui/material/Divider";
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
  CustomerSegment,
  Product,
  ProductFormInput,
  ProductPricingConfig,
  ProductPricingCustomerRule,
  ProductPricingScale,
  ProductPricingSheetType,
} from "@/features/products/types";
import { getReferenceUnitPrice } from "../../../../shared/productPricing";

export type PricingMode = "margin" | "price";

type ProductPricingScaleFormState = {
  id: string;
  minQty: string;
  unitPrice: string;
};

type ProductPricingSheetFormState = {
  id: string;
  name: string;
  basePrice: string;
  minimumPrice: string;
  teacherPrice: string;
  quantityScales: ProductPricingScaleFormState[];
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
  pricingSheetTypes: ProductPricingSheetFormState[];
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

const DOCENTE_SEGMENT: CustomerSegment = "DOCENTE";

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

function createSheet(
  name = "",
  basePrice = 0,
  options?: {
    minimumPrice?: number;
    teacherPrice?: number;
    quantityScales?: Array<{ minQty: number; unitPrice: number }>;
  }
): ProductPricingSheetFormState {
  return {
    id: crypto.randomUUID(),
    name,
    basePrice: String(basePrice),
    minimumPrice:
      options?.minimumPrice === undefined || options.minimumPrice === null ? "" : String(options.minimumPrice),
    teacherPrice:
      options?.teacherPrice === undefined || options.teacherPrice === null ? "" : String(options.teacherPrice),
    quantityScales: (options?.quantityScales ?? []).map((scale) => createScale(scale.minQty, scale.unitPrice)),
  };
}

function buildPrintPresetSheets() {
  return [
    createSheet("Carta", 300, {
      teacherPrice: 100,
      quantityScales: [
        { minQty: 1, unitPrice: 300 },
        { minQty: 10, unitPrice: 270 },
        { minQty: 20, unitPrice: 250 },
        { minQty: 50, unitPrice: 200 },
        { minQty: 100, unitPrice: 150 },
      ],
    }),
    createSheet("Oficio", 400),
  ];
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

function buildSheetRules(sheet: ProductPricingSheetFormState): ProductPricingCustomerRule[] {
  const teacherPrice = integerFromString(sheet.teacherPrice);
  if (teacherPrice <= 0) return [];

  return [
    {
      customerSegment: DOCENTE_SEGMENT,
      unitPrice: teacherPrice,
    },
  ];
}

function buildSheetScales(sheet: ProductPricingSheetFormState): ProductPricingScale[] {
  return sheet.quantityScales
    .map((scale) => ({
      minQty: Math.max(1, integerFromString(scale.minQty)),
      unitPrice: integerFromString(scale.unitPrice),
    }))
    .filter((scale) => scale.unitPrice > 0)
    .sort((left, right) => left.minQty - right.minQty);
}

function buildPricingConfig(form: ProductFormState): ProductPricingConfig | null {
  if (!form.pricingEnabled) return null;

  const sheetTypes: ProductPricingSheetType[] = form.pricingSheetTypes
    .map((sheet) => ({
      id: sheet.id,
      name: sheet.name.trim(),
      basePrice: integerFromString(sheet.basePrice),
      minimumPrice: sheet.minimumPrice.trim() ? integerFromString(sheet.minimumPrice) : null,
      quantityScales: buildSheetScales(sheet),
      customerSegmentRules: buildSheetRules(sheet),
    }))
    .filter((sheet) => sheet.name.length > 0 && sheet.basePrice > 0);

  return {
    enabled: true,
    minimumPrice: integerFromString(form.pricingMinimumPrice),
    sheetTypes,
  };
}

function getTeacherPrice(sheetType?: ProductPricingSheetType | null) {
  return (
    sheetType?.customerSegmentRules.find((rule) => rule.customerSegment === DOCENTE_SEGMENT)?.unitPrice ?? null
  );
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
  pricingMinimumPrice: "0",
  pricingSheetTypes: [],
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
    pricingSheetTypes:
      pricingConfig?.sheetTypes.map((sheetType) =>
        createSheet(sheetType.name, sheetType.basePrice, {
          minimumPrice: sheetType.minimumPrice ?? undefined,
          teacherPrice: getTeacherPrice(sheetType) ?? undefined,
          quantityScales: sheetType.quantityScales,
        })
      ) ?? [],
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

  if (form.pricingSheetTypes.length === 0) {
    return "Debes agregar al menos un tipo de hoja.";
  }

  const normalizedNames = new Set<string>();
  for (const sheet of form.pricingSheetTypes) {
    const name = sheet.name.trim().toLowerCase();
    if (!name) return "Cada tipo de hoja debe tener nombre.";
    if (normalizedNames.has(name)) return "No repitas tipos de hoja dentro del mismo producto.";
    normalizedNames.add(name);

    if (integerFromString(sheet.basePrice) <= 0) {
      return `El precio base de ${sheet.name.trim() || "la hoja"} debe ser mayor a 0.`;
    }

    const minimumPrice = sheet.minimumPrice.trim() ? integerFromString(sheet.minimumPrice) : null;
    if (minimumPrice !== null && minimumPrice < 0) {
      return `El minimo de ${sheet.name.trim() || "la hoja"} no puede ser negativo.`;
    }

    const usedScaleQuantities = new Set<number>();
    for (const scale of sheet.quantityScales) {
      const minQty = Math.max(1, integerFromString(scale.minQty));
      const unitPrice = integerFromString(scale.unitPrice);

      if (unitPrice <= 0) {
        return `Cada escala de ${sheet.name.trim() || "la hoja"} debe tener un precio valido.`;
      }

      if (usedScaleQuantities.has(minQty)) {
        return `No repitas la misma cantidad minima en ${sheet.name.trim() || "la hoja"}.`;
      }

      usedScaleQuantities.add(minQty);
    }
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
  const teacherPrices = form.pricingSheetTypes
    .map((sheet) => integerFromString(sheet.teacherPrice))
    .filter((price) => price > 0);
  const lowestTeacherPrice = teacherPrices.length > 0 ? Math.min(...teacherPrices) : null;

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

  const addSheet = () => {
    setForm((prev) => ({
      ...prev,
      pricingEnabled: true,
      pricingSheetTypes: [...prev.pricingSheetTypes, createSheet(`Hoja ${prev.pricingSheetTypes.length + 1}`)],
    }));
  };

  const replaceWithPrintPreset = () => {
    setForm((prev) => ({
      ...prev,
      pricingEnabled: true,
      pricingSheetTypes: buildPrintPresetSheets(),
      pricingMinimumPrice: prev.pricingMinimumPrice || "0",
    }));
  };

  const updateSheet = (sheetId: string, updater: (sheet: ProductPricingSheetFormState) => ProductPricingSheetFormState) => {
    setForm((prev) => ({
      ...prev,
      pricingSheetTypes: prev.pricingSheetTypes.map((sheet) => (sheet.id === sheetId ? updater(sheet) : sheet)),
    }));
  };

  const removeSheet = (sheetId: string) => {
    setForm((prev) => ({
      ...prev,
      pricingSheetTypes: prev.pricingSheetTypes.filter((sheet) => sheet.id !== sheetId),
    }));
  };

  const addScale = (sheetId: string) => {
    updateSheet(sheetId, (sheet) => ({
      ...sheet,
      quantityScales: [...sheet.quantityScales, createScale(1, integerFromString(sheet.basePrice) || 0)],
    }));
  };

  const updateScale = (
    sheetId: string,
    scaleId: string,
    patch: Partial<Pick<ProductPricingScaleFormState, "minQty" | "unitPrice">>
  ) => {
    updateSheet(sheetId, (sheet) => ({
      ...sheet,
      quantityScales: sheet.quantityScales.map((scale) =>
        scale.id === scaleId ? { ...scale, ...patch } : scale
      ),
    }));
  };

  const removeScale = (sheetId: string, scaleId: string) => {
    updateSheet(sheetId, (sheet) => ({
      ...sheet,
      quantityScales: sheet.quantityScales.filter((scale) => scale.id !== scaleId),
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
            <MenuItem value="">
              <em>Sin categoria</em>
            </MenuItem>
            {categories.map((category) => (
              <MenuItem key={category.id} value={category.id}>
                {category.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "1fr 1fr" }} gap={2}>
        <FormControl fullWidth>
          <InputLabel id="product-unit-measure-label">Unidad de medida</InputLabel>
          <Select
            labelId="product-unit-measure-label"
            value={form.unitMeasure}
            label="Unidad de medida"
            onChange={(event) =>
              setForm((prev) => ({ ...prev, unitMeasure: event.target.value as ProductUnitOption }))
            }
          >
            {PRODUCT_UNIT_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth disabled={!form.categoryId}>
          <InputLabel id="product-subcategory-label">Subcategoria</InputLabel>
          <Select
            labelId="product-subcategory-label"
            value={form.subcategoryId}
            label="Subcategoria"
            onChange={(event) => setForm((prev) => ({ ...prev, subcategoryId: event.target.value }))}
          >
            <MenuItem value="">
              <em>{form.categoryId ? "Sin subcategoria" : "Selecciona una categoria"}</em>
            </MenuItem>
            {availableSubcategories.map((subcategory) => (
              <MenuItem key={subcategory.id} value={subcategory.id}>
                {subcategory.name}
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
      </Box>

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(3, 1fr)" }} gap={2}>
        <TextField
          label="Cantidad inicial"
          type="number"
          inputProps={{ min: 0, step: "1" }}
          value={form.stock}
          onChange={(event) => setForm((prev) => ({ ...prev, stock: event.target.value }))}
          fullWidth
        />

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
              : "Precio unitario base del producto."
          }
          InputProps={{ readOnly: form.pricingEnabled }}
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
          label="Ganancia estimada"
          value={`${estimatedMargin}%`}
          helperText="Se calcula automaticamente con costo, IVA y precio de referencia."
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
                  Prioridad aplicada en venta: hoja, cantidad, tarifa especial y minimo permitido.
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
                        pricingSheetTypes:
                          event.target.checked && prev.pricingSheetTypes.length === 0
                            ? buildPrintPresetSheets()
                            : prev.pricingSheetTypes,
                      }))
                    }
                  />
                }
                label={form.pricingEnabled ? "Reglas activas" : "Precio fijo"}
              />
            </Box>

            {form.pricingEnabled ? (
              <>
                <Alert severity="info">
                  El POS tomara primero el tipo de hoja, luego buscara la escala por cantidad y, si el cliente
                  pertenece a un segmento especial como docente, aplicara esa tarifa. Si el resultado queda por
                  debajo del minimo, el sistema lo ajusta automaticamente salvo autorizacion superior.
                </Alert>

                <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(4, 1fr)" }} gap={2}>
                  <TextField
                    label="Minimo global"
                    type="number"
                    inputProps={{ min: 0, step: "1" }}
                    value={form.pricingMinimumPrice}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, pricingMinimumPrice: event.target.value }))
                    }
                    helperText="Se usa si la hoja no define uno propio."
                  />
                  <TextField
                    label="Precio referencia actual"
                    value={currency(referenceDynamicPrice)}
                    InputProps={{ readOnly: true }}
                  />
                  <TextField
                    label="Tarifa docente mas baja"
                    value={lowestTeacherPrice ? currency(lowestTeacherPrice) : "No configurada"}
                    InputProps={{ readOnly: true }}
                  />
                  <TextField
                    label="Tipos de hoja"
                    value={String(form.pricingSheetTypes.length)}
                    InputProps={{ readOnly: true }}
                  />
                </Box>

                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Button variant="outlined" onClick={replaceWithPrintPreset}>
                    Cargar ejemplo de impresiones
                  </Button>
                  <Button variant="contained" onClick={addSheet}>
                    Agregar tipo de hoja
                  </Button>
                </Stack>

                <Stack spacing={2}>
                  {form.pricingSheetTypes.map((sheet, sheetIndex) => (
                    <Card key={sheet.id} variant="outlined">
                      <CardContent>
                        <Stack spacing={2}>
                          <Box display="flex" justifyContent="space-between" alignItems="center" gap={2}>
                            <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                              <Typography variant="subtitle1" fontWeight={800}>
                                {sheet.name.trim() || `Tipo de hoja ${sheetIndex + 1}`}
                              </Typography>
                              <Chip
                                size="small"
                                label={`${sheet.quantityScales.length} escalas`}
                                color="primary"
                                variant="outlined"
                              />
                            </Box>

                            <Tooltip title="Eliminar tipo de hoja">
                              <span>
                                <IconButton
                                  color="error"
                                  onClick={() => removeSheet(sheet.id)}
                                  disabled={form.pricingSheetTypes.length === 1}
                                >
                                  <DeleteOutlineIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Box>

                          <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(4, 1fr)" }} gap={2}>
                            <TextField
                              label="Tipo de hoja"
                              value={sheet.name}
                              onChange={(event) =>
                                updateSheet(sheet.id, (current) => ({ ...current, name: event.target.value }))
                              }
                            />
                            <TextField
                              label="Precio base"
                              type="number"
                              inputProps={{ min: 0, step: "1" }}
                              value={sheet.basePrice}
                              onChange={(event) =>
                                updateSheet(sheet.id, (current) => ({ ...current, basePrice: event.target.value }))
                              }
                            />
                            <TextField
                              label="Minimo por hoja"
                              type="number"
                              inputProps={{ min: 0, step: "1" }}
                              value={sheet.minimumPrice}
                              onChange={(event) =>
                                updateSheet(sheet.id, (current) => ({ ...current, minimumPrice: event.target.value }))
                              }
                              helperText="Opcional"
                            />
                            <TextField
                              label="Tarifa docente"
                              type="number"
                              inputProps={{ min: 0, step: "1" }}
                              value={sheet.teacherPrice}
                              onChange={(event) =>
                                updateSheet(sheet.id, (current) => ({ ...current, teacherPrice: event.target.value }))
                              }
                              helperText="Opcional"
                            />
                          </Box>

                          <Divider />

                          <Stack spacing={1.5}>
                            <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
                              <Box>
                                <Typography variant="subtitle2" fontWeight={800}>
                                  Escalas por cantidad
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  El sistema toma la mayor escala cuya cantidad minima sea menor o igual a la vendida.
                                </Typography>
                              </Box>
                              <Button variant="outlined" onClick={() => addScale(sheet.id)}>
                                Agregar escala
                              </Button>
                            </Box>

                            {sheet.quantityScales.length === 0 ? (
                              <Alert severity="warning">
                                Esta hoja solo usara precio base mientras no agregues escalas.
                              </Alert>
                            ) : (
                              <Stack spacing={1.25}>
                                {sheet.quantityScales.map((scale) => (
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
                                      inputProps={{ min: 1, step: "1" }}
                                      value={scale.minQty}
                                      onChange={(event) =>
                                        updateScale(sheet.id, scale.id, { minQty: event.target.value })
                                      }
                                    />
                                    <TextField
                                      label="Precio unitario"
                                      type="number"
                                      inputProps={{ min: 0, step: "1" }}
                                      value={scale.unitPrice}
                                      onChange={(event) =>
                                        updateScale(sheet.id, scale.id, { unitPrice: event.target.value })
                                      }
                                    />
                                    <Button
                                      color="error"
                                      variant="text"
                                      onClick={() => removeScale(sheet.id, scale.id)}
                                    >
                                      Quitar
                                    </Button>
                                  </Box>
                                ))}
                              </Stack>
                            )}
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </>
            ) : (
              <Alert severity="info">
                Usa esta opcion solo si el producto vende siempre al mismo precio. Para impresiones, copias y
                servicios similares conviene dejar las reglas activas para evitar descuentos manuales fuera de control.
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Box
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          px: 2,
          py: 1.5,
          bgcolor: "grey.50",
        }}
      >
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1}>
          <TextField
            label="Resumen rapido"
            value={
              form.pricingEnabled
                ? `Desde ${currency(referenceDynamicPrice)} | Hojas ${form.pricingSheetTypes.length}`
                : `Costo ${currency(numberFromString(form.cost))} | Precio ${currency(numberFromString(form.price))}`
            }
            InputProps={{ readOnly: true }}
            sx={{ flex: 1 }}
          />
          <Typography variant="body2" color="text.secondary">
            {getTaxConfig(selectedTaxOption).label}
          </Typography>
        </Stack>
      </Box>

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
          Completa los datos del producto y, si aplica, define las reglas automaticas por hoja, cantidad y tipo de cliente.
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
