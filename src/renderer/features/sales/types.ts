export type Money = number;

export type ProductPricingScale = {
  minQty: number;
  label?: string | null;
  unitPrice: number;
};

export type ProductPricingSpecialRule = {
  id: string;
  label: string;
  unitPrice: number;
};

export type ProductPricingConfig = {
  enabled: boolean;
  basePrice: number;
  minimumPrice: number;
  quantityScales: ProductPricingScale[];
  specialPriceRules: ProductPricingSpecialRule[];
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
  selectedScaleMinQty?: number | null;
  selectedScaleLabel?: string | null;
  specialRuleId?: string | null;
  specialRuleLabel?: string | null;
  pricingSource?: "BASE_PRICE" | "AUTO_SCALE" | "MANUAL_SCALE" | "SPECIAL_RULE" | "MANUAL_OVERRIDE";
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
