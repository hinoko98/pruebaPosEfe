export const PRODUCT_UNIT_OPTIONS = [
  { value: "UNIDAD", label: "Unidad" },
  { value: "PAR", label: "Par" },
  { value: "METRO", label: "Metro" },
  { value: "CENTIMETRO", label: "Centimetro" },
  { value: "CAJA", label: "Caja" },
  { value: "PAQUETE", label: "Paquete" },
  { value: "DOCENA", label: "Docena" },
  { value: "ROLLO", label: "Rollo" },
  { value: "BOLSA", label: "Bolsa" },
  { value: "BOTELLA", label: "Botella" },
  { value: "FRASCO", label: "Frasco" },
  { value: "LIBRA", label: "Libra" },
  { value: "KILO", label: "Kilo" },
  { value: "LITRO", label: "Litro" },
] as const;

export const PRODUCT_TAX_OPTIONS = [
  {
    value: "NONE",
    label: "No aplica / Excluido",
    hasTax: false,
    taxRate: 0,
  },
  {
    value: "EXEMPT_0",
    label: "Exento 0%",
    hasTax: true,
    taxRate: 0,
  },
  {
    value: "IVA_5",
    label: "IVA 5%",
    hasTax: true,
    taxRate: 0.05,
  },
  {
    value: "IVA_19",
    label: "IVA 19%",
    hasTax: true,
    taxRate: 0.19,
  },
] as const;

export type ProductUnitOption = (typeof PRODUCT_UNIT_OPTIONS)[number]["value"];
export type ProductTaxOption = (typeof PRODUCT_TAX_OPTIONS)[number]["value"];

export function getTaxOptionFromValues(hasTax: boolean, taxRate: number) {
  if (!hasTax && taxRate === 0) return "NONE" as ProductTaxOption;
  if (hasTax && taxRate === 0) return "EXEMPT_0" as ProductTaxOption;
  if (taxRate === 0.05) return "IVA_5" as ProductTaxOption;
  return "IVA_19" as ProductTaxOption;
}

export function getTaxConfig(option: ProductTaxOption) {
  return PRODUCT_TAX_OPTIONS.find((item) => item.value === option) ?? PRODUCT_TAX_OPTIONS[0];
}

export function getUnitLabel(unitMeasure?: string | null) {
  return PRODUCT_UNIT_OPTIONS.find((item) => item.value === unitMeasure)?.label ?? "Unidad";
}

export function getTaxLabel(hasTax: boolean, taxRate: number) {
  return getTaxConfig(getTaxOptionFromValues(hasTax, taxRate)).label;
}
