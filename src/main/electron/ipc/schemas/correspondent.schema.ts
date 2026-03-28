import { z } from "zod";

export const correspondentTransactionStatusSchema = z.enum(["REGISTERED", "VOIDED"]);
export const correspondentTransactionSourceSchema = z.enum(["MANUAL", "IMAGE", "FILE_IMPORT", "API"]);

export const correspondentEvidenceInputSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.string().trim().max(120).optional(),
  dataBase64: z.string().min(1),
  ocrRawText: z.string().trim().max(10000).optional(),
});

export type CorrespondentEvidenceInput = z.infer<typeof correspondentEvidenceInputSchema>;

export const createCorrespondentTransactionSchema = z.object({
  platformId: z.string().uuid("platformId invalido"),
  typeId: z.string().uuid("typeId invalido"),
  amount: z.number().int("El valor debe ser entero").positive("El valor debe ser mayor a 0"),
  commissionAmount: z.number().int("La comision debe ser entera").min(0).optional(),
  externalReference: z.string().trim().max(120).optional().nullable(),
  customerName: z.string().trim().max(120).optional().nullable(),
  customerDocument: z.string().trim().max(40).optional().nullable(),
  targetAccount: z.string().trim().max(60).optional().nullable(),
  targetPhone: z.string().trim().max(30).optional().nullable(),
  performedAt: z.string().datetime("Fecha de operacion invalida"),
  note: z.string().trim().max(300).optional().nullable(),
  rawExtractedText: z.string().trim().max(10000).optional().nullable(),
  source: correspondentTransactionSourceSchema.optional().default("MANUAL"),
  evidence: correspondentEvidenceInputSchema.optional(),
});

export type CreateCorrespondentTransactionInput = z.infer<typeof createCorrespondentTransactionSchema>;

export const listCorrespondentTransactionsSchema = z
  .object({
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    platformId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    status: correspondentTransactionStatusSchema.optional(),
    search: z.string().trim().max(80).optional(),
  })
  .optional()
  .default({});

export type ListCorrespondentTransactionsInput = z.infer<typeof listCorrespondentTransactionsSchema>;

export const listCorrespondentClosuresSchema = z
  .object({
    businessDate: z.string().datetime().optional(),
  })
  .optional()
  .default({});

export type ListCorrespondentClosuresInput = z.infer<typeof listCorrespondentClosuresSchema>;

export const createCorrespondentClosureSchema = z.object({
  platformId: z.string().uuid("platformId invalido"),
  businessDate: z.string().datetime("Fecha de cierre invalida"),
  reportedBalance: z.number().int("El valor reportado debe ser entero").min(0),
  note: z.string().trim().max(300).optional().nullable(),
});

export type CreateCorrespondentClosureInput = z.infer<typeof createCorrespondentClosureSchema>;
