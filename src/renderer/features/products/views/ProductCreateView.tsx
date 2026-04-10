import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
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
import type { Product, ProductFormInput } from "@/features/products/types";

export type PricingMode = "margin" | "price";

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

function fixedString(value: number) {
  return Number.isFinite(value) ? String(Number(value.toFixed(2))) : "0";
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
});

export function productToFormState(product: Product): ProductFormState {
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
    stock: numberFromString(form.stock),
    price: numberFromString(form.price),
    isActive: form.isActive,
  };
}

export function validateProductForm(form: ProductFormState) {
  if (!form.name.trim()) return "El nombre es obligatorio.";
  if (numberFromString(form.cost) < 0) return "El costo no puede ser negativo.";
  if (numberFromString(form.stock) < 0) return "El stock no puede ser negativo.";
  if (numberFromString(form.marginPercent) < 0) return "La ganancia no puede ser negativa.";
  if (numberFromString(form.price) < 0) return "El precio de venta no puede ser negativo.";
  if (form.hasTax && numberFromString(form.taxRate) < 0) return "El IVA no puede ser negativo.";
  if (form.subcategoryId && !form.categoryId) return "Primero selecciona una categoria para usar subcategoria.";
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
          label="Precio final"
          type="number"
          inputProps={{ min: 0, step: "0.01" }}
          value={form.price}
          onChange={(event) => {
            setPricingMode("price");
            setForm((prev) => syncMarginFromPrice({ ...prev, price: event.target.value }));
          }}
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
          helperText="Se calcula automaticamente con costo, IVA y precio final."
          InputProps={{ readOnly: true }}
          fullWidth
        />
      </Box>

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
            value={`Costo ${currency(numberFromString(form.cost))} | Precio ${currency(numberFromString(form.price))}`}
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
              onChange={(event) =>
                setForm((prev) => ({ ...prev, isActive: event.target.checked }))
              }
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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Formulario rapido de producto</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Completa solo los datos esenciales para crear el producto desde este modal.
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
