import { z } from "zod";

import { paymentMethodSchema } from "./sales.schema";

export const accountingRangeSchema = z
  .object({
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
  })
  .optional()
  .default({});

export type AccountingRangeInput = z.infer<typeof accountingRangeSchema>;

export const createAccountingCreditSchema = z.object({
  saleId: z.string().uuid("saleId invalido"),
  customerId: z.string().uuid("customerId invalido"),
  total: z.number().int("El valor debe ser entero").positive("El valor debe ser mayor a 0").optional(),
  dueDate: z.string().datetime("Fecha de vencimiento invalida").optional().nullable(),
});

export type CreateAccountingCreditInput = z.infer<typeof createAccountingCreditSchema>;

export const createAccountingPaymentSchema = z.object({
  creditId: z.string().uuid("creditId invalido"),
  amount: z.number().int("El valor debe ser entero").positive("El valor debe ser mayor a 0"),
  method: paymentMethodSchema.optional().default("CASH"),
  note: z.string().trim().max(250).optional().nullable(),
});

export type CreateAccountingPaymentInput = z.infer<typeof createAccountingPaymentSchema>;

export const createAccountingCreditNoteSchema = z.object({
  saleId: z.string().uuid("saleId invalido"),
  amount: z.number().int("El valor debe ser entero").positive("El valor debe ser mayor a 0"),
  reason: z.string().trim().max(250).optional().nullable(),
});

export type CreateAccountingCreditNoteInput = z.infer<typeof createAccountingCreditNoteSchema>;

export const createAccountingExpenseSchema = z.object({
  amount: z.number().int("El valor debe ser entero").positive("El valor debe ser mayor a 0"),
  note: z.string().trim().min(2, "La descripcion es obligatoria").max(250),
  type: z.enum(["EXPENSE_OUT", "WITHDRAWAL_OUT"]).optional().default("EXPENSE_OUT"),
});

export type CreateAccountingExpenseInput = z.infer<typeof createAccountingExpenseSchema>;
