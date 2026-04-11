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
  name: string;
  sku?: string | null;
  barcode?: string | null;
  unitMeasure: string;
  price: Money;
  pricingConfig?: ProductPricingConfig | null;
  cost: Money;
  marginPercent: number;
  hasTax: boolean;
  taxRate: number;
  stock: number;
  categoryId?: string | null;
  subcategoryId?: string | null;
  categoryName?: string | null;
  subcategoryName?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  updatedBy?: string | null;
};

export type ProductFormInput = {
  name: string;
  sku?: string | null;
  barcode?: string | null;
  unitMeasure?: string;
  price?: Money;
  pricingConfig?: ProductPricingConfig | null;
  cost?: Money;
  marginPercent?: number;
  hasTax?: boolean;
  taxRate?: number;
  stock?: number;
  categoryId?: string | null;
  subcategoryId?: string | null;
  isActive?: boolean;
};
