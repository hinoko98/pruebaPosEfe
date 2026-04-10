export type Money = number;

export type Product = {
  id: string;
  sku?: string;
  barcode?: string | null;
  name: string;
  price: Money;
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
};

export type PaymentMethod = "CASH" | "CARD" | "TRANSFER";

export type Payment = {
  method: PaymentMethod;
  amount: Money;
};
