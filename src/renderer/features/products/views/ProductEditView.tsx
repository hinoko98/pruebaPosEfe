import { useEffect, useState } from "react";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";

import type { CategoryOption, SubcategoryMap } from "@/features/products/services/products.api";
import type { Product, ProductFormInput } from "@/features/products/types";
import {
  applyPricingMode,
  PricingMode,
  ProductFormFields,
  ProductFormState,
  emptyProductFormState,
  productFormToPayload,
  productToFormState,
  validateProductForm,
} from "@/features/products/views/ProductCreateView";

type ProductEditViewProps = {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  onSubmit: (payload: ProductFormInput) => void;
  categories: CategoryOption[];
  subcategoryMap: SubcategoryMap;
};

export default function ProductEditView({
  open,
  product,
  onClose,
  onSubmit,
  categories,
  subcategoryMap,
}: ProductEditViewProps) {
  const [form, setForm] = useState<ProductFormState>(emptyProductFormState);
  const [pricingMode, setPricingMode] = useState<PricingMode>("margin");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !product) return;
    setForm(productToFormState(product));
    setPricingMode("price");
    setError(null);
  }, [open, product]);

  const handleSave = () => {
    if (!form) return;

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

  if (!product) {
    return null;
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Editar producto</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mt: 2 }}>
          Ajusta los datos principales del producto sin salir del listado.
        </Alert>
        {error ? <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert> : null}
        <ProductFormFields
          form={form}
          setForm={setForm}
          pricingMode={pricingMode}
          setPricingMode={setPricingMode}
          categories={categories}
          subcategoryMap={subcategoryMap}
          skuValue={product.sku}
          showStatus
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancelar
        </Button>
        <Button onClick={handleSave} variant="contained">
          Guardar cambios
        </Button>
      </DialogActions>
    </Dialog>
  );
}
