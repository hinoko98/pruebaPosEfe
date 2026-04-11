import { z } from "zod";

export const paymentMethodSchema = z.enum(["CASH", "CARD", "TRANSFER"]);

const saleItemPricingContextSchema = z.object({
  sheetTypeId: z.string().trim().min(1, "Debes seleccionar el tipo de hoja"),
  manualUnitPrice: z.number().positive("El precio manual debe ser mayor a 0").optional().nullable(),
});

export const salePaymentInputSchema = z.object({
  method: paymentMethodSchema,
  amount: z.number().min(0, "El monto del pago no puede ser negativo"),
});

export const saleItemInputSchema = z.object({
  productId: z.string().uuid("productId invalido"),
  qty: z.number().int("La cantidad debe ser entera").positive("La cantidad debe ser mayor a 0"),
  pricingContext: saleItemPricingContextSchema.optional(),
});

export type SaleItemInput = z.infer<typeof saleItemInputSchema>;

export const createSaleSchema = z.object({
  customer: z.string().trim().max(120).optional().default("Consumidor final"),
  customerId: z.string().uuid("customerId invalido").optional().nullable(),
  paymentMethod: paymentMethodSchema.optional().default("CASH"),
  amountPaid: z.number().min(0).optional(),
  payments: z.array(salePaymentInputSchema).min(1, "Debes registrar al menos un pago").optional(),
  items: z.array(saleItemInputSchema).min(1, "La venta debe tener al menos un item"),
  clientTotal: z.number().min(0).optional(),
  allowDebt: z.boolean().optional().default(false),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export const createSaleResultSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    saleId: z.string().uuid(),
    invoiceNumber: z.string(),
    total: z.number(),
    amountPaid: z.number(),
    changeAmount: z.number(),
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
  }),
]);

export type CreateSaleResult = z.infer<typeof createSaleResultSchema>;
