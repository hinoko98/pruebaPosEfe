import { z } from "zod";

export const correspondentTransactionStatusSchema = z.enum(["REGISTERED", "VOIDED"]);
export const correspondentTransactionSourceSchema = z.enum(["MANUAL", "IMAGE", "FILE_IMPORT", "API"]);
export const correspondentCatalogDirectionSchema = z.enum(["IN", "OUT"]);

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
  approvalCode: z.string().trim().min(4, "Ingresa el numero de aprobacion o ID interno").max(40).optional().nullable(),
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

export const updateCorrespondentTransactionSchema = z.object({
  transactionId: z.string().uuid("transactionId invalido"),
  typeId: z.string().uuid("typeId invalido"),
  approvalCode: z.string().trim().min(4, "Ingresa el numero de aprobacion o ID interno").max(40).optional().nullable(),
  amount: z.number().int("El valor debe ser entero").positive("El valor debe ser mayor a 0"),
  performedAt: z.string().datetime("Fecha de operacion invalida"),
});

export type UpdateCorrespondentTransactionInput = z.infer<typeof updateCorrespondentTransactionSchema>;

export const getCorrespondentTransactionDetailSchema = z.object({
  transactionId: z.string().uuid("transactionId invalido"),
});

export type GetCorrespondentTransactionDetailInput = z.infer<typeof getCorrespondentTransactionDetailSchema>;

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
  openingBalance: z.number().int("El saldo base debe ser entero").optional().default(0),
  reportedBalance: z.number().int("El valor reportado debe ser entero"),
  note: z.string().trim().max(300).optional().nullable(),
});

export type CreateCorrespondentClosureInput = z.infer<typeof createCorrespondentClosureSchema>;

export const createCorrespondentPlatformSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio").max(80, "Nombre demasiado largo"),
  requiresEvidence: z.boolean().optional().default(false),
  supportsOcr: z.boolean().optional().default(false),
  supportsFileImport: z.boolean().optional().default(false),
});

export type CreateCorrespondentPlatformInput = z.infer<typeof createCorrespondentPlatformSchema>;

export const createCorrespondentTransactionTypeSchema = z.object({
  platformId: z.string().uuid("platformId invalido"),
  name: z.string().trim().min(2, "El nombre es obligatorio").max(80, "Nombre demasiado largo"),
  direction: correspondentCatalogDirectionSchema.default("IN"),
});

export type CreateCorrespondentTransactionTypeInput = z.infer<typeof createCorrespondentTransactionTypeSchema>;

export const updateCorrespondentPlatformSchema = z.object({
  platformId: z.string().uuid("platformId invalido"),
  name: z.string().trim().min(2, "El nombre es obligatorio").max(80, "Nombre demasiado largo"),
  requiresEvidence: z.boolean().optional().default(false),
  supportsOcr: z.boolean().optional().default(false),
  supportsFileImport: z.boolean().optional().default(false),
});

export type UpdateCorrespondentPlatformInput = z.infer<typeof updateCorrespondentPlatformSchema>;

export const updateCorrespondentTransactionTypeSchema = z.object({
  typeId: z.string().uuid("typeId invalido"),
  name: z.string().trim().min(2, "El nombre es obligatorio").max(80, "Nombre demasiado largo"),
  direction: correspondentCatalogDirectionSchema.default("IN"),
});

export type UpdateCorrespondentTransactionTypeInput = z.infer<typeof updateCorrespondentTransactionTypeSchema>;

export const deleteCorrespondentPlatformSchema = z.object({
  platformId: z.string().uuid("platformId invalido"),
});

export type DeleteCorrespondentPlatformInput = z.infer<typeof deleteCorrespondentPlatformSchema>;

export const deleteCorrespondentTransactionTypeSchema = z.object({
  typeId: z.string().uuid("typeId invalido"),
});

export type DeleteCorrespondentTransactionTypeInput = z.infer<typeof deleteCorrespondentTransactionTypeSchema>;
