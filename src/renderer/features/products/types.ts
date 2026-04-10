export type Money = number;

export type Product = {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  unitMeasure: string;
  price: Money;
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
  cost?: Money;
  marginPercent?: number;
  hasTax?: boolean;
  taxRate?: number;
  stock?: number;
  categoryId?: string | null;
  subcategoryId?: string | null;
  isActive?: boolean;
};
