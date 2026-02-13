export type CreateSaleInput = {
  items: { variantId: string; qty: number; unitPrice: number }[];
  payments: { method: 'CASH' | 'CARD'; amount: number }[];
  customerId?: string;
};

export type CreateSaleResult = {
  saleId: string;
  ticketNumber: string;
  total: number;
};
