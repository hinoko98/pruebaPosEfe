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
