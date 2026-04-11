export type Money = number;

export type CustomerSegment = "GENERAL" | "DOCENTE";

export type ProductPricingScale = {
  minQty: number;
  unitPrice: number;
};

export type ProductPricingSpecialRule = {
  id: string;
  label: string;
  unitPrice: number;
};

export type ProductPricingSheetType = {
  id: string;
  name: string;
  basePrice: number;
  minimumPrice: number | null;
  quantityScales: ProductPricingScale[];
  specialPriceRules: ProductPricingSpecialRule[];
};

export type ProductPricingConfig = {
  enabled: boolean;
  minimumPrice: number;
  sheetTypes: ProductPricingSheetType[];
};

export type Product = {
  id: string;
  sku?: string;
  barcode?: string | null;
  name: string;
  price: Money;
  pricingConfig?: ProductPricingConfig | null;
  cost?: Money;
  taxRate?: number;
  stock?: number;
  category?: string | null;
  subcategory?: string | null;
};

export type CartItem = {
  lineId: string;
  productId: string;
  name: string;
  sku?: string;
  price: Money;
  qty: number;
  taxRate?: number;
  sheetTypeId?: string | null;
  sheetTypeName?: string | null;
  specialRuleId?: string | null;
  specialRuleLabel?: string | null;
  pricingSourceLabel?: string | null;
  minimumPrice?: number;
  pricingEnabled?: boolean;
  manualUnitPrice?: number | null;
};

export type PaymentMethod = "CASH" | "CARD" | "TRANSFER";

export type Payment = {
  method: PaymentMethod;
  amount: Money;
};
