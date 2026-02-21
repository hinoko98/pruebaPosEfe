// src/renderer/features/sales/types.ts
export type Money = number;

export type Product = {
  id: string;
  sku?: string;       // código interno
  barcode?: string;   // EAN/UPC
  name: string;
  price: Money;
  taxRate?: number;   // 0.19 etc
};

export type CartItem = {
  lineId: string;     // id único de línea (no del producto)
  productId: string;
  name: string;
  price: Money;
  qty: number;
  taxRate?: number;
};

export type PaymentMethod = "CASH" | "CARD" | "TRANSFER";

export type Payment = {
  method: PaymentMethod;
  amount: Money;
};