export type Money = number;

export type VariantAttrs = {
  color?: string;
  size?: string;
  lot?: string;
  expiresAt?: string; // ISO
};

export type ProductVariant = {
  id: string;
  productId: string;
  sku: string;
  barcode?: string;
  attrs: VariantAttrs;
  cost: Money;
  price: Money;
  isActive: boolean;
};

export type Product = {
  id: string;
  name: string;
  categoryId?: string;
  isActive: boolean;
};
