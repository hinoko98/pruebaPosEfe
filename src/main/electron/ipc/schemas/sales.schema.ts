import { z } from "zod";

export const paymentMethodSchema = z.enum(["CASH", "CARD", "TRANSFER"]);

export const saleItemInputSchema = z.object({
  productId: z.string().uuid("productId invalido"),
  qty: z.number().int("La cantidad debe ser entera").positive("La cantidad debe ser mayor a 0"),
});

export type SaleItemInput = z.infer<typeof saleItemInputSchema>;

export const createSaleSchema = z.object({
  customer: z.string().trim().max(120).optional().default("Consumidor final"),
  paymentMethod: paymentMethodSchema.optional().default("CASH"),
  amountPaid: z.number().min(0).optional(),
  items: z.array(saleItemInputSchema).min(1, "La venta debe tener al menos un item"),
  clientTotal: z.number().min(0).optional(),
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
