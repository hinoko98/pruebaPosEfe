export type Money = number;

export type CustomerSegment = "GENERAL" | "DOCENTE";

export type ProductPricingScale = {
  minQty: number;
  unitPrice: number;
};

export type ProductPricingCustomerRule = {
  customerSegment: CustomerSegment;
  unitPrice: number;
};

export type ProductPricingSheetType = {
  id: string;
  name: string;
  basePrice: number;
  minimumPrice: number | null;
  quantityScales: ProductPricingScale[];
  customerSegmentRules: ProductPricingCustomerRule[];
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
  pricingSourceLabel?: string | null;
  minimumPrice?: number;
  pricingEnabled?: boolean;
};

export type PaymentMethod = "CASH" | "CARD" | "TRANSFER";

export type Payment = {
  method: PaymentMethod;
  amount: Money;
};
