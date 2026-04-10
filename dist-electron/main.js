import { BrowserWindow, app, ipcMain, Menu } from "electron";
import bcrypt from "bcryptjs";
import "dotenv/config";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CorrespondentDirection, CommissionMode, CorrespondentTransactionStatus, CorrespondentReconciliationStatus, CorrespondentOcrStatus, Role, CorrespondentClosureStatus, SaleStatus, CashSessionStatus, PaymentMethod, CashMovementType, InventoryMovementType, PurchaseStatus, CreditStatus, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const roleSchema = z.enum(["ADMIN", "EMPLOYEE"]);
const loginInputSchema = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(200)
});
z.object({
  success: z.boolean(),
  message: z.string().optional(),
  user: z.object({
    id: z.string(),
    username: z.string(),
    role: roleSchema,
    name: z.string().optional(),
    roleProfileId: z.string().nullable().optional(),
    roleProfileName: z.string().nullable().optional(),
    permissions: z.array(z.string()).optional()
  }).optional()
});
const birthDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable();
const phoneSchema = z.string().trim().regex(/^\d{10}$/).optional().nullable();
const baseUserProfileSchema = z.object({
  internalCode: z.string().trim().max(30).optional().nullable(),
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  documentNumber: z.string().trim().regex(/^\d{6,20}$/),
  email: z.string().trim().email().max(120).optional().nullable(),
  phone: phoneSchema,
  address: z.string().trim().max(180).optional().nullable(),
  birthDate: birthDateSchema,
  role: roleSchema.optional().default("EMPLOYEE"),
  roleProfileId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional().default(true)
});
const createUserInputSchema = baseUserProfileSchema.extend({
  newPassword: z.string().min(6).max(200)
});
const updateUserInputSchema = baseUserProfileSchema.extend({
  id: z.string().uuid(),
  newPassword: z.string().min(6).max(200).optional().or(z.literal(""))
});
const ownProfileSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string().optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  email: z.string().trim().email().max(120).optional().nullable(),
  phone: phoneSchema,
  birthDate: birthDateSchema,
  role: roleSchema
});
z.object({
  success: z.boolean(),
  message: z.string().optional(),
  profile: ownProfileSchema.optional()
});
const updateOwnProfileInputSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  birthDate: birthDateSchema
});
const changeOwnPasswordInputSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(6).max(200),
  confirmPassword: z.string().min(6).max(200)
});
const createRoleProfileInputSchema = z.object({
  name: z.string().trim().min(3, "Minimo 3 caracteres").max(80, "Maximo 80 caracteres"),
  description: z.string().trim().max(240).optional().nullable(),
  baseRole: roleSchema.default("EMPLOYEE"),
  permissionKeys: z.array(z.string().trim().min(1)).min(1, "Debes seleccionar al menos un permiso"),
  isActive: z.boolean().optional().default(true)
});
const updateRoleProfileInputSchema = z.object({
  id: z.string().uuid("ID de rol invalido"),
  name: z.string().trim().min(3, "Minimo 3 caracteres").max(80, "Maximo 80 caracteres"),
  description: z.string().trim().max(240).optional().nullable(),
  permissionKeys: z.array(z.string().trim().min(1)).min(1, "Debes seleccionar al menos un permiso"),
  isActive: z.boolean().optional().default(true)
});
const paymentMethodSchema = z.enum(["CASH", "CARD", "TRANSFER"]);
const salePaymentInputSchema = z.object({
  method: paymentMethodSchema,
  amount: z.number().min(0, "El monto del pago no puede ser negativo")
});
const saleItemInputSchema = z.object({
  productId: z.string().uuid("productId invalido"),
  qty: z.number().int("La cantidad debe ser entera").positive("La cantidad debe ser mayor a 0")
});
const createSaleSchema = z.object({
  customer: z.string().trim().max(120).optional().default("Consumidor final"),
  customerId: z.string().uuid("customerId invalido").optional().nullable(),
  paymentMethod: paymentMethodSchema.optional().default("CASH"),
  amountPaid: z.number().min(0).optional(),
  payments: z.array(salePaymentInputSchema).min(1, "Debes registrar al menos un pago").optional(),
  items: z.array(saleItemInputSchema).min(1, "La venta debe tener al menos un item"),
  clientTotal: z.number().min(0).optional(),
  allowDebt: z.boolean().optional().default(false)
});
z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    saleId: z.string().uuid(),
    invoiceNumber: z.string(),
    total: z.number(),
    amountPaid: z.number(),
    changeAmount: z.number()
  }),
  z.object({
    success: z.literal(false),
    message: z.string()
  })
]);
const correspondentTransactionStatusSchema = z.enum(["REGISTERED", "VOIDED"]);
const correspondentTransactionSourceSchema = z.enum(["MANUAL", "IMAGE", "FILE_IMPORT", "API"]);
const correspondentCatalogDirectionSchema = z.enum(["IN", "OUT"]);
const correspondentEvidenceInputSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.string().trim().max(120).optional(),
  dataBase64: z.string().min(1),
  ocrRawText: z.string().trim().max(1e4).optional()
});
const createCorrespondentTransactionSchema = z.object({
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
  rawExtractedText: z.string().trim().max(1e4).optional().nullable(),
  source: correspondentTransactionSourceSchema.optional().default("MANUAL"),
  evidence: correspondentEvidenceInputSchema.optional()
});
const updateCorrespondentTransactionSchema = z.object({
  transactionId: z.string().uuid("transactionId invalido"),
  typeId: z.string().uuid("typeId invalido"),
  approvalCode: z.string().trim().min(4, "Ingresa el numero de aprobacion o ID interno").max(40).optional().nullable(),
  amount: z.number().int("El valor debe ser entero").positive("El valor debe ser mayor a 0"),
  performedAt: z.string().datetime("Fecha de operacion invalida")
});
const getCorrespondentTransactionDetailSchema = z.object({
  transactionId: z.string().uuid("transactionId invalido")
});
const listCorrespondentTransactionsSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  platformId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  status: correspondentTransactionStatusSchema.optional(),
  search: z.string().trim().max(80).optional()
}).optional().default({});
const listCorrespondentClosuresSchema = z.object({
  businessDate: z.string().datetime().optional()
}).optional().default({});
const createCorrespondentClosureSchema = z.object({
  platformId: z.string().uuid("platformId invalido"),
  businessDate: z.string().datetime("Fecha de cierre invalida"),
  openingBalance: z.number().int("El saldo base debe ser entero").optional().default(0),
  reportedBalance: z.number().int("El valor reportado debe ser entero"),
  note: z.string().trim().max(300).optional().nullable()
});
const createCorrespondentPlatformSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio").max(80, "Nombre demasiado largo"),
  requiresEvidence: z.boolean().optional().default(false),
  supportsOcr: z.boolean().optional().default(false),
  supportsFileImport: z.boolean().optional().default(false)
});
const createCorrespondentTransactionTypeSchema = z.object({
  platformId: z.string().uuid("platformId invalido"),
  name: z.string().trim().min(2, "El nombre es obligatorio").max(80, "Nombre demasiado largo"),
  direction: correspondentCatalogDirectionSchema.default("IN")
});
const updateCorrespondentPlatformSchema = z.object({
  platformId: z.string().uuid("platformId invalido"),
  name: z.string().trim().min(2, "El nombre es obligatorio").max(80, "Nombre demasiado largo"),
  requiresEvidence: z.boolean().optional().default(false),
  supportsOcr: z.boolean().optional().default(false),
  supportsFileImport: z.boolean().optional().default(false)
});
const updateCorrespondentTransactionTypeSchema = z.object({
  typeId: z.string().uuid("typeId invalido"),
  name: z.string().trim().min(2, "El nombre es obligatorio").max(80, "Nombre demasiado largo"),
  direction: correspondentCatalogDirectionSchema.default("IN")
});
const deleteCorrespondentPlatformSchema = z.object({
  platformId: z.string().uuid("platformId invalido")
});
const deleteCorrespondentTransactionTypeSchema = z.object({
  typeId: z.string().uuid("typeId invalido")
});
const CODE_REGEX = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
function stripDiacritics(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function normalizeCodeInput(value) {
  return stripDiacritics(value).toUpperCase().replace(/[_\s]+/g, "-").replace(/[^A-Z0-9-]/g, "").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}
function normalizePrefixedCode(value, prefix) {
  const normalizedPrefix = normalizeCodeInput(prefix);
  const normalizedValue = normalizeCodeInput(value);
  if (!normalizedValue)
    return `${normalizedPrefix}-`;
  if (normalizedValue === normalizedPrefix)
    return `${normalizedPrefix}-`;
  if (normalizedValue.startsWith(`${normalizedPrefix}-`))
    return normalizedValue;
  const trimmedValue = normalizedValue.startsWith(normalizedPrefix) ? normalizedValue.slice(normalizedPrefix.length).replace(/^-+/, "") : normalizedValue;
  return `${normalizedPrefix}-${trimmedValue}`;
}
function isValidCode(value, minLength = 4, maxLength = 40) {
  return value.length >= minLength && value.length <= maxLength && CODE_REGEX.test(value);
}
function suggestNextCode(existingCodes, prefix, digits = 4) {
  const normalizedPrefix = normalizeCodeInput(prefix);
  const matcher = new RegExp(`^${normalizedPrefix}-(\\d+)$`);
  let currentMax = 0;
  for (const code of existingCodes) {
    const normalizedCode = normalizeCodeInput(code || "");
    const match = normalizedCode.match(matcher);
    if (!match)
      continue;
    currentMax = Math.max(currentMax, Number(match[1] || 0));
  }
  return `${normalizedPrefix}-${String(currentMax + 1).padStart(digits, "0")}`;
}
function resolveManagedCode(params) {
  var _a;
  const candidate = ((_a = params.desiredCode) == null ? void 0 : _a.trim()) ? normalizePrefixedCode(params.desiredCode, params.prefix) : suggestNextCode(params.existingCodes, params.prefix, params.digits);
  if (!isValidCode(candidate, params.minLength, params.maxLength)) {
    throw new Error(`El codigo debe usar solo letras, numeros y guiones.`);
  }
  const normalizedExisting = new Set(
    params.existingCodes.map((code) => normalizeCodeInput(code || "")).filter(Boolean)
  );
  if (normalizedExisting.has(candidate)) {
    throw new Error(`El codigo ${candidate} ya existe.`);
  }
  return candidate;
}
function resolveLooseCode(params) {
  var _a;
  const candidate = ((_a = params.desiredCode) == null ? void 0 : _a.trim()) ? normalizeCodeInput(params.desiredCode) : suggestNextCode(params.existingCodes, params.generatedPrefix, params.digits);
  if (!isValidCode(candidate, params.minLength, params.maxLength)) {
    throw new Error(`El codigo debe usar solo letras, numeros y guiones.`);
  }
  const normalizedExisting = new Set(
    params.existingCodes.map((code) => normalizeCodeInput(code || "")).filter(Boolean)
  );
  if (normalizedExisting.has(candidate)) {
    throw new Error(`El codigo ${candidate} ya existe.`);
  }
  return candidate;
}
const sharedCorrespondentTypes = [
  { code: "RETIRO", name: "Retiro", direction: CorrespondentDirection.OUT, requiresCustomerDocument: true, requiresExternalReference: true, sortOrder: 10 },
  { code: "DEPOSITO", name: "Deposito", direction: CorrespondentDirection.IN, requiresCustomerDocument: true, requiresExternalReference: true, sortOrder: 20 },
  { code: "CONSIGNACION", name: "Consignacion", direction: CorrespondentDirection.IN, requiresCustomerDocument: true, requiresExternalReference: true, sortOrder: 30 },
  { code: "RECAUDO", name: "Recaudo", direction: CorrespondentDirection.IN, requiresExternalReference: true, sortOrder: 40 },
  { code: "PAGO", name: "Pago", direction: CorrespondentDirection.IN, requiresExternalReference: true, sortOrder: 50 },
  { code: "RECARGA", name: "Recarga", direction: CorrespondentDirection.IN, sortOrder: 60 },
  { code: "CONSULTA", name: "Consulta", direction: CorrespondentDirection.NEUTRAL, sortOrder: 70 },
  { code: "GIRO_ENVIO", name: "Giro envio", direction: CorrespondentDirection.IN, requiresCustomerDocument: true, requiresExternalReference: true, sortOrder: 80 },
  { code: "GIRO_PAGO", name: "Giro pago", direction: CorrespondentDirection.OUT, requiresCustomerDocument: true, requiresExternalReference: true, sortOrder: 90 }
];
const correspondentSeedCatalog = [
  {
    code: "PUNTORED",
    name: "Puntored",
    requiresEvidence: true,
    supportsOcr: true,
    supportsFileImport: true,
    types: sharedCorrespondentTypes
  },
  {
    code: "PTM",
    name: "PTM",
    requiresEvidence: true,
    supportsOcr: true,
    supportsFileImport: true,
    types: sharedCorrespondentTypes
  },
  {
    code: "CBOGOTA",
    name: "Corresponsal Bogota",
    requiresEvidence: true,
    supportsOcr: true,
    types: sharedCorrespondentTypes
  },
  {
    code: "BANCOLOMBIA",
    name: "Corresponsal Bancolombia",
    requiresEvidence: true,
    supportsOcr: true,
    types: [
      ...sharedCorrespondentTypes,
      { code: "NEQUI_RETIRO", name: "Nequi retiro", direction: CorrespondentDirection.OUT, requiresExternalReference: true, sortOrder: 95 },
      { code: "NEQUI_DEPOSITO", name: "Nequi deposito", direction: CorrespondentDirection.IN, requiresExternalReference: true, sortOrder: 96 }
    ]
  },
  {
    code: "COOPENESSA",
    name: "Coopenessa",
    requiresEvidence: true,
    supportsOcr: false,
    types: sharedCorrespondentTypes
  }
];
function money$2(value) {
  return Math.round(value);
}
function startOfDay(date = /* @__PURE__ */ new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
function endOfDay(date = /* @__PURE__ */ new Date()) {
  const next = startOfDay(date);
  next.setDate(next.getDate() + 1);
  return next;
}
function normalizeBusinessDate(value) {
  if (!value)
    return startOfDay(/* @__PURE__ */ new Date());
  return startOfDay(new Date(value));
}
function sanitizeFileName(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}
function serializeJson(value) {
  return JSON.stringify(value ?? null);
}
function normalizeCode(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toUpperCase();
}
async function buildUniquePlatformCode(prisma2, name) {
  const baseCode = normalizeCode(name) || "CORRESPONSAL";
  let code = baseCode;
  let counter = 2;
  while (await prisma2.correspondentPlatform.findUnique({ where: { code }, select: { id: true } })) {
    code = `${baseCode}_${counter}`;
    counter += 1;
  }
  return code;
}
async function buildUniqueTypeCode(prisma2, platformId, name) {
  const baseCode = normalizeCode(name) || "TIPO";
  let code = baseCode;
  let counter = 2;
  while (await prisma2.correspondentTransactionType.findUnique({
    where: { platformId_code: { platformId, code } },
    select: { id: true }
  })) {
    code = `${baseCode}_${counter}`;
    counter += 1;
  }
  return code;
}
function parseContextId(context, key) {
  if (!context)
    return null;
  const match = context.match(new RegExp(`${key}:([^;]+)`));
  return (match == null ? void 0 : match[1]) ?? null;
}
async function buildCorrespondentCatalogAuditMaps(prisma2) {
  const logs = await prisma2.correspondentAuditLog.findMany({
    where: {
      action: {
        in: ["create_platform", "update_platform", "create_transaction_type", "update_transaction_type"]
      }
    },
    include: {
      user: {
        select: {
          username: true,
          name: true
        }
      }
    },
    orderBy: { createdAt: "asc" }
  });
  const platformCreatedBy = /* @__PURE__ */ new Map();
  const platformUpdatedBy = /* @__PURE__ */ new Map();
  const typeCreatedBy = /* @__PURE__ */ new Map();
  const typeUpdatedBy = /* @__PURE__ */ new Map();
  for (const log of logs) {
    const actor = {
      user: log.user ? log.user.name ?? log.user.username : null,
      at: log.createdAt.toISOString()
    };
    const platformId = parseContextId(log.context, "platform");
    const typeId = parseContextId(log.context, "type");
    if (log.action === "create_platform" && platformId && !platformCreatedBy.has(platformId)) {
      platformCreatedBy.set(platformId, actor);
    }
    if (log.action === "update_platform" && platformId) {
      platformUpdatedBy.set(platformId, actor);
    }
    if (log.action === "create_transaction_type" && typeId && !typeCreatedBy.has(typeId)) {
      typeCreatedBy.set(typeId, actor);
    }
    if (log.action === "update_transaction_type" && typeId) {
      typeUpdatedBy.set(typeId, actor);
    }
  }
  return {
    platformCreatedBy,
    platformUpdatedBy,
    typeCreatedBy,
    typeUpdatedBy
  };
}
async function ensureCorrespondentSchemaIfNeeded(prismaClient) {
  const statements = [
    `PRAGMA foreign_keys = ON;`,
    `CREATE TABLE IF NOT EXISTS "CorrespondentPlatform" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "code" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "requiresEvidence" BOOLEAN NOT NULL DEFAULT false,
      "supportsOcr" BOOLEAN NOT NULL DEFAULT false,
      "supportsFileImport" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "CorrespondentPlatform_code_key" ON "CorrespondentPlatform"("code");`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "CorrespondentPlatform_name_key" ON "CorrespondentPlatform"("name");`,
    `CREATE TABLE IF NOT EXISTS "CorrespondentTransactionType" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "platformId" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "direction" TEXT NOT NULL DEFAULT 'NEUTRAL',
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "requiresCustomerDocument" BOOLEAN NOT NULL DEFAULT false,
      "requiresExternalReference" BOOLEAN NOT NULL DEFAULT false,
      "allowsCommissionOverride" BOOLEAN NOT NULL DEFAULT true,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CorrespondentTransactionType_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "CorrespondentPlatform" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "CorrespondentTransactionType_platformId_code_key" ON "CorrespondentTransactionType"("platformId", "code");`,
    `CREATE INDEX IF NOT EXISTS "CorrespondentTransactionType_platformId_idx" ON "CorrespondentTransactionType"("platformId");`,
    `CREATE INDEX IF NOT EXISTS "CorrespondentTransactionType_isActive_idx" ON "CorrespondentTransactionType"("isActive");`,
    `CREATE TABLE IF NOT EXISTS "CorrespondentCommissionRule" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "platformId" TEXT NOT NULL,
      "typeId" TEXT,
      "mode" TEXT NOT NULL DEFAULT 'NONE',
      "value" REAL NOT NULL DEFAULT 0,
      "minAmount" INTEGER,
      "maxAmount" INTEGER,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "validFrom" DATETIME,
      "validTo" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CorrespondentCommissionRule_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "CorrespondentPlatform" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "CorrespondentCommissionRule_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "CorrespondentTransactionType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    );`,
    `CREATE INDEX IF NOT EXISTS "CorrespondentCommissionRule_platformId_idx" ON "CorrespondentCommissionRule"("platformId");`,
    `CREATE INDEX IF NOT EXISTS "CorrespondentCommissionRule_typeId_idx" ON "CorrespondentCommissionRule"("typeId");`,
    `CREATE INDEX IF NOT EXISTS "CorrespondentCommissionRule_isActive_idx" ON "CorrespondentCommissionRule"("isActive");`,
    `CREATE TABLE IF NOT EXISTS "CorrespondentDailyClosure" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "platformId" TEXT NOT NULL,
      "cashSessionId" TEXT,
      "businessDate" DATETIME NOT NULL,
      "totalIn" INTEGER NOT NULL DEFAULT 0,
      "totalOut" INTEGER NOT NULL DEFAULT 0,
      "totalCommission" INTEGER NOT NULL DEFAULT 0,
      "transactionsCount" INTEGER NOT NULL DEFAULT 0,
      "expectedBalance" INTEGER NOT NULL DEFAULT 0,
      "reportedBalance" INTEGER NOT NULL,
      "differenceAmount" INTEGER NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'CLOSED',
      "note" TEXT,
      "closedByUserId" TEXT NOT NULL,
      "closedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CorrespondentDailyClosure_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "CorrespondentPlatform" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "CorrespondentDailyClosure_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "CorrespondentDailyClosure_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "CorrespondentDailyClosure_platformId_businessDate_key" ON "CorrespondentDailyClosure"("platformId", "businessDate");`,
    `CREATE INDEX IF NOT EXISTS "CorrespondentDailyClosure_platformId_idx" ON "CorrespondentDailyClosure"("platformId");`,
    `CREATE INDEX IF NOT EXISTS "CorrespondentDailyClosure_cashSessionId_idx" ON "CorrespondentDailyClosure"("cashSessionId");`,
    `CREATE INDEX IF NOT EXISTS "CorrespondentDailyClosure_businessDate_idx" ON "CorrespondentDailyClosure"("businessDate");`,
    `CREATE INDEX IF NOT EXISTS "CorrespondentDailyClosure_closedByUserId_idx" ON "CorrespondentDailyClosure"("closedByUserId");`,
    `CREATE TABLE IF NOT EXISTS "CorrespondentTransaction" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "approvalCode" TEXT,
      "platformId" TEXT NOT NULL,
      "typeId" TEXT NOT NULL,
      "cashSessionId" TEXT,
      "cashRegisterId" TEXT,
      "registeredByUserId" TEXT NOT NULL,
      "reviewedByUserId" TEXT,
      "dailyClosureId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'REGISTERED',
      "source" TEXT NOT NULL DEFAULT 'MANUAL',
      "ocrStatus" TEXT NOT NULL DEFAULT 'NOT_REQUESTED',
      "reconciliationStatus" TEXT NOT NULL DEFAULT 'PENDING',
      "externalReference" TEXT,
      "customerName" TEXT,
      "customerDocument" TEXT,
      "targetAccount" TEXT,
      "targetPhone" TEXT,
      "amount" INTEGER NOT NULL,
      "commissionAmount" INTEGER NOT NULL DEFAULT 0,
      "netAmount" INTEGER NOT NULL DEFAULT 0,
      "performedAt" DATETIME NOT NULL,
      "note" TEXT,
      "rawExtractedText" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CorrespondentTransaction_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "CorrespondentPlatform" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "CorrespondentTransaction_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "CorrespondentTransactionType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "CorrespondentTransaction_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "CorrespondentTransaction_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "CashRegister" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "CorrespondentTransaction_registeredByUserId_fkey" FOREIGN KEY ("registeredByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "CorrespondentTransaction_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "CorrespondentTransaction_dailyClosureId_fkey" FOREIGN KEY ("dailyClosureId") REFERENCES "CorrespondentDailyClosure" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    );`,
    `CREATE INDEX IF NOT EXISTS "CorrespondentTransaction_platformId_idx" ON "CorrespondentTransaction"("platformId");`,
    `CREATE INDEX IF NOT EXISTS "CorrespondentTransaction_typeId_idx" ON "CorrespondentTransaction"("typeId");`,
    `CREATE INDEX IF NOT EXISTS "CorrespondentTransaction_cashSessionId_idx" ON "CorrespondentTransaction"("cashSessionId");`,
    `CREATE INDEX IF NOT EXISTS "CorrespondentTransaction_cashRegisterId_idx" ON "CorrespondentTransaction"("cashRegisterId");`,
    `CREATE INDEX IF NOT EXISTS "CorrespondentTransaction_registeredByUserId_idx" ON "CorrespondentTransaction"("registeredByUserId");`,
    `CREATE INDEX IF NOT EXISTS "CorrespondentTransaction_reviewedByUserId_idx" ON "CorrespondentTransaction"("reviewedByUserId");`,
    `CREATE INDEX IF NOT EXISTS "CorrespondentTransaction_dailyClosureId_idx" ON "CorrespondentTransaction"("dailyClosureId");`,
    `CREATE INDEX IF NOT EXISTS "CorrespondentTransaction_performedAt_idx" ON "CorrespondentTransaction"("performedAt");`,
    `CREATE INDEX IF NOT EXISTS "CorrespondentTransaction_status_idx" ON "CorrespondentTransaction"("status");`,
    `CREATE INDEX IF NOT EXISTS "CorrespondentTransaction_reconciliationStatus_idx" ON "CorrespondentTransaction"("reconciliationStatus");`,
    `CREATE TABLE IF NOT EXISTS "CorrespondentEvidence" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "transactionId" TEXT NOT NULL,
      "fileName" TEXT NOT NULL,
      "filePath" TEXT NOT NULL,
      "mimeType" TEXT,
      "fileSize" INTEGER,
      "fileHash" TEXT,
      "ocrRawText" TEXT,
      "capturedByUserId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CorrespondentEvidence_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "CorrespondentTransaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "CorrespondentEvidence_capturedByUserId_fkey" FOREIGN KEY ("capturedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    );`,
    `CREATE INDEX IF NOT EXISTS "CorrespondentEvidence_transactionId_idx" ON "CorrespondentEvidence"("transactionId");`,
    `CREATE INDEX IF NOT EXISTS "CorrespondentEvidence_capturedByUserId_idx" ON "CorrespondentEvidence"("capturedByUserId");`,
    `CREATE TABLE IF NOT EXISTS "CorrespondentAuditLog" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "transactionId" TEXT,
      "userId" TEXT,
      "action" TEXT NOT NULL,
      "context" TEXT,
      "beforeJson" TEXT,
      "afterJson" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CorrespondentAuditLog_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "CorrespondentTransaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "CorrespondentAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    );`,
    `CREATE INDEX IF NOT EXISTS "CorrespondentAuditLog_transactionId_idx" ON "CorrespondentAuditLog"("transactionId");`,
    `CREATE INDEX IF NOT EXISTS "CorrespondentAuditLog_userId_idx" ON "CorrespondentAuditLog"("userId");`,
    `CREATE INDEX IF NOT EXISTS "CorrespondentAuditLog_createdAt_idx" ON "CorrespondentAuditLog"("createdAt");`
  ];
  for (const statement of statements) {
    await prismaClient.$executeRawUnsafe(statement);
  }
  const transactionColumns = await prismaClient.$queryRawUnsafe(
    `PRAGMA table_info("CorrespondentTransaction");`
  );
  const transactionColumnSet = new Set(transactionColumns.map((column) => column.name));
  if (!transactionColumnSet.has("approvalCode")) {
    await prismaClient.$executeRawUnsafe(`ALTER TABLE "CorrespondentTransaction" ADD COLUMN "approvalCode" TEXT;`);
  }
  const transactions = await prismaClient.correspondentTransaction.findMany({
    select: {
      id: true,
      approvalCode: true
    },
    orderBy: [{ createdAt: "asc" }, { performedAt: "asc" }]
  });
  const assignedApprovalCodes = [];
  const assignedSet = /* @__PURE__ */ new Set();
  for (const transaction of transactions) {
    const normalizedCurrentCode = normalizeCodeInput(transaction.approvalCode || "");
    const canKeepCurrentCode = Boolean(normalizedCurrentCode) && isValidCode(normalizedCurrentCode, 4, 40) && !assignedSet.has(normalizedCurrentCode);
    const approvalCode = canKeepCurrentCode ? normalizedCurrentCode : resolveLooseCode({
      existingCodes: assignedApprovalCodes,
      generatedPrefix: "APR",
      digits: 6,
      maxLength: 40
    });
    if (approvalCode !== transaction.approvalCode) {
      await prismaClient.correspondentTransaction.update({
        where: { id: transaction.id },
        data: { approvalCode }
      });
    }
    assignedApprovalCodes.push(approvalCode);
    assignedSet.add(approvalCode);
  }
  await prismaClient.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "CorrespondentTransaction_approvalCode_key" ON "CorrespondentTransaction"("approvalCode");`
  );
}
async function seedCorrespondentCatalogIfNeeded(prismaClient) {
  for (const platformSeed of correspondentSeedCatalog) {
    const platform = await prismaClient.correspondentPlatform.upsert({
      where: { code: platformSeed.code },
      update: {
        name: platformSeed.name,
        isActive: true,
        requiresEvidence: platformSeed.requiresEvidence ?? false,
        supportsOcr: platformSeed.supportsOcr ?? false,
        supportsFileImport: platformSeed.supportsFileImport ?? false
      },
      create: {
        code: platformSeed.code,
        name: platformSeed.name,
        isActive: true,
        requiresEvidence: platformSeed.requiresEvidence ?? false,
        supportsOcr: platformSeed.supportsOcr ?? false,
        supportsFileImport: platformSeed.supportsFileImport ?? false
      }
    });
    for (const typeSeed of platformSeed.types) {
      await prismaClient.correspondentTransactionType.upsert({
        where: {
          platformId_code: {
            platformId: platform.id,
            code: typeSeed.code
          }
        },
        update: {
          name: typeSeed.name,
          direction: typeSeed.direction,
          isActive: true,
          requiresCustomerDocument: typeSeed.requiresCustomerDocument ?? false,
          requiresExternalReference: typeSeed.requiresExternalReference ?? false,
          allowsCommissionOverride: true,
          sortOrder: typeSeed.sortOrder ?? 0
        },
        create: {
          platformId: platform.id,
          code: typeSeed.code,
          name: typeSeed.name,
          direction: typeSeed.direction,
          isActive: true,
          requiresCustomerDocument: typeSeed.requiresCustomerDocument ?? false,
          requiresExternalReference: typeSeed.requiresExternalReference ?? false,
          allowsCommissionOverride: true,
          sortOrder: typeSeed.sortOrder ?? 0
        }
      });
    }
    const rulesCount = await prismaClient.correspondentCommissionRule.count({
      where: { platformId: platform.id }
    });
    if (rulesCount === 0) {
      await prismaClient.correspondentCommissionRule.create({
        data: {
          platformId: platform.id,
          mode: CommissionMode.NONE,
          value: 0,
          isActive: true
        }
      });
    }
  }
}
async function getActiveCashSessionForUser(prisma2, userId) {
  return prisma2.cashSession.findFirst({
    where: { userId, status: "OPEN" },
    include: { register: true },
    orderBy: { openedAt: "desc" }
  });
}
async function resolveCommissionAmount(prisma2, platformId, typeId, amount, performedAt) {
  const rules = await prisma2.correspondentCommissionRule.findMany({
    where: {
      platformId,
      isActive: true,
      OR: [{ typeId }, { typeId: null }],
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: performedAt } }] },
        { OR: [{ validTo: null }, { validTo: { gte: performedAt } }] },
        { OR: [{ minAmount: null }, { minAmount: { lte: amount } }] },
        { OR: [{ maxAmount: null }, { maxAmount: { gte: amount } }] }
      ]
    }
  });
  const bestRule = rules.sort((a, b) => {
    var _a, _b;
    if (a.typeId === typeId && b.typeId !== typeId)
      return -1;
    if (a.typeId !== typeId && b.typeId === typeId)
      return 1;
    return (((_a = b.validFrom) == null ? void 0 : _a.getTime()) ?? 0) - (((_b = a.validFrom) == null ? void 0 : _b.getTime()) ?? 0);
  })[0] ?? null;
  if (!bestRule)
    return 0;
  if (bestRule.mode === CommissionMode.FIXED)
    return money$2(bestRule.value);
  if (bestRule.mode === CommissionMode.PERCENTAGE)
    return money$2(amount * bestRule.value / 100);
  return 0;
}
function summarizeCorrespondentTransactions(transactions) {
  return transactions.reduce(
    (acc, transaction) => {
      if (transaction.status === CorrespondentTransactionStatus.VOIDED) {
        acc.voidedCount += 1;
        return acc;
      }
      acc.transactionsCount += 1;
      acc.totalCommission += transaction.commissionAmount;
      acc.withEvidenceCount += transaction.evidences.length > 0 ? 1 : 0;
      acc.pendingClosureCount += transaction.dailyClosureId ? 0 : 1;
      if (transaction.type.direction === CorrespondentDirection.IN)
        acc.totalIn += transaction.amount;
      if (transaction.type.direction === CorrespondentDirection.OUT)
        acc.totalOut += transaction.amount;
      if (transaction.type.direction === CorrespondentDirection.NEUTRAL)
        acc.neutralCount += 1;
      return acc;
    },
    {
      totalIn: 0,
      totalOut: 0,
      totalCommission: 0,
      transactionsCount: 0,
      withEvidenceCount: 0,
      pendingClosureCount: 0,
      voidedCount: 0,
      neutralCount: 0
    }
  );
}
async function saveCorrespondentEvidence(params) {
  const normalizedDate = /* @__PURE__ */ new Date();
  const folder = path.join(
    params.app.getPath("userData"),
    "correspondent-evidence",
    String(normalizedDate.getFullYear()),
    String(normalizedDate.getMonth() + 1).padStart(2, "0"),
    String(normalizedDate.getDate()).padStart(2, "0"),
    params.platformCode.toLowerCase()
  );
  await mkdir(folder, { recursive: true });
  const safeName = sanitizeFileName(params.evidence.fileName);
  const targetPath = path.join(folder, `${Date.now()}-${safeName}`);
  const base64Data = params.evidence.dataBase64.includes(",") ? params.evidence.dataBase64.split(",").pop() ?? "" : params.evidence.dataBase64;
  const fileBuffer = Buffer.from(base64Data, "base64");
  await writeFile(targetPath, fileBuffer);
  return {
    fileName: params.evidence.fileName,
    filePath: targetPath,
    mimeType: params.evidence.mimeType ?? null,
    fileSize: fileBuffer.byteLength,
    fileHash: createHash("sha256").update(fileBuffer).digest("hex"),
    ocrRawText: params.evidence.ocrRawText ?? null
  };
}
async function logCorrespondentAction(params) {
  var _a, _b;
  await params.prisma.correspondentAuditLog.create({
    data: {
      transactionId: params.transactionId ?? null,
      userId: ((_a = params.currentSessionUser) == null ? void 0 : _a.id) ?? null,
      action: params.action,
      context: params.context ?? null,
      beforeJson: params.beforeJson === void 0 ? null : serializeJson(params.beforeJson),
      afterJson: params.afterJson === void 0 ? null : serializeJson(params.afterJson)
    }
  });
  await params.prisma.auditLog.create({
    data: {
      userId: ((_b = params.currentSessionUser) == null ? void 0 : _b.id) ?? null,
      module: "correspondent",
      action: params.action,
      entity: params.transactionId ? "CorrespondentTransaction" : "CorrespondentDailyClosure",
      entityId: params.transactionId ?? null,
      beforeJson: params.beforeJson === void 0 ? null : serializeJson(params.beforeJson),
      afterJson: params.afterJson === void 0 ? null : serializeJson(params.afterJson)
    }
  });
}
async function getCorrespondentTransactionsForDay(prisma2, businessDate, platformId) {
  return prisma2.correspondentTransaction.findMany({
    where: {
      platformId,
      performedAt: {
        gte: startOfDay(businessDate),
        lt: endOfDay(businessDate)
      }
    },
    include: {
      platform: true,
      type: true,
      evidences: { select: { id: true } },
      registeredBy: { select: { id: true, username: true, name: true } },
      dailyClosure: { select: { id: true, businessDate: true, status: true } }
    },
    orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }]
  });
}
async function getCorrespondentTransactionDetail(prisma2, transactionId) {
  return prisma2.correspondentTransaction.findUnique({
    where: { id: transactionId },
    include: {
      platform: true,
      type: true,
      registeredBy: { select: { id: true, username: true, name: true } },
      auditLogs: {
        include: {
          user: {
            select: { id: true, username: true, name: true }
          }
        },
        orderBy: { createdAt: "desc" }
      },
      dailyClosure: {
        select: {
          id: true,
          businessDate: true
        }
      }
    }
  });
}
function registerCorrespondentIpcHandlers({
  app: app2,
  ipcMain: ipcMain2,
  prisma: prisma2,
  getCurrentSessionUser
}) {
  ipcMain2.handle("correspondent:catalog", async () => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2) {
      return { success: false, message: "Debes iniciar sesion", platforms: [] };
    }
    const [platforms, auditMaps] = await Promise.all([
      prisma2.correspondentPlatform.findMany({
        where: { isActive: true },
        include: {
          transactionTypes: {
            where: { isActive: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
          },
          commissionRules: {
            where: { isActive: true },
            orderBy: [{ validFrom: "desc" }]
          }
        },
        orderBy: [{ createdAt: "asc" }, { name: "asc" }]
      }),
      buildCorrespondentCatalogAuditMaps(prisma2)
    ]);
    return {
      success: true,
      platforms: platforms.map((platform) => {
        var _a, _b, _c;
        return {
          id: platform.id,
          code: platform.code,
          name: platform.name,
          requiresEvidence: platform.requiresEvidence,
          supportsOcr: platform.supportsOcr,
          supportsFileImport: platform.supportsFileImport,
          createdAt: platform.createdAt.toISOString(),
          updatedAt: platform.updatedAt.toISOString(),
          createdBy: ((_a = auditMaps.platformCreatedBy.get(platform.id)) == null ? void 0 : _a.user) ?? null,
          updatedBy: ((_b = auditMaps.platformUpdatedBy.get(platform.id)) == null ? void 0 : _b.user) ?? ((_c = auditMaps.platformCreatedBy.get(platform.id)) == null ? void 0 : _c.user) ?? null,
          types: platform.transactionTypes.map((type) => {
            var _a2, _b2, _c2;
            return {
              id: type.id,
              code: type.code,
              name: type.name,
              direction: type.direction,
              requiresCustomerDocument: type.requiresCustomerDocument,
              requiresExternalReference: type.requiresExternalReference,
              createdAt: type.createdAt.toISOString(),
              updatedAt: type.updatedAt.toISOString(),
              createdBy: ((_a2 = auditMaps.typeCreatedBy.get(type.id)) == null ? void 0 : _a2.user) ?? null,
              updatedBy: ((_b2 = auditMaps.typeUpdatedBy.get(type.id)) == null ? void 0 : _b2.user) ?? ((_c2 = auditMaps.typeCreatedBy.get(type.id)) == null ? void 0 : _c2.user) ?? null
            };
          }),
          commissionRules: platform.commissionRules.map((rule) => ({
            id: rule.id,
            typeId: rule.typeId,
            mode: rule.mode,
            value: rule.value,
            minAmount: rule.minAmount,
            maxAmount: rule.maxAmount
          }))
        };
      })
    };
  });
  ipcMain2.handle("correspondent:dashboard", async () => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2) {
      return { success: false, message: "Debes iniciar sesion" };
    }
    const businessDate = startOfDay(/* @__PURE__ */ new Date());
    const transactions = await getCorrespondentTransactionsForDay(prisma2, businessDate);
    const summary = summarizeCorrespondentTransactions(transactions);
    const perPlatformMap = transactions.reduce((acc, transaction) => {
      const current = acc[transaction.platformId] ?? {
        platformId: transaction.platformId,
        platform: transaction.platform.name,
        totalIn: 0,
        totalOut: 0,
        totalCommission: 0,
        count: 0,
        pendingClosureCount: 0
      };
      if (transaction.status !== CorrespondentTransactionStatus.VOIDED) {
        current.count += 1;
        current.totalCommission += transaction.commissionAmount;
        current.pendingClosureCount += transaction.dailyClosureId ? 0 : 1;
        if (transaction.type.direction === CorrespondentDirection.IN)
          current.totalIn += transaction.amount;
        if (transaction.type.direction === CorrespondentDirection.OUT)
          current.totalOut += transaction.amount;
      }
      acc[transaction.platformId] = current;
      return acc;
    }, {});
    return {
      success: true,
      totals: {
        totalIn: summary.totalIn,
        totalOut: summary.totalOut,
        totalCommission: summary.totalCommission,
        expectedBalance: summary.totalIn - summary.totalOut + summary.totalCommission,
        transactionsCount: summary.transactionsCount,
        withEvidenceCount: summary.withEvidenceCount,
        pendingClosureCount: summary.pendingClosureCount,
        voidedCount: summary.voidedCount
      },
      perPlatform: Object.values(perPlatformMap).sort((a, b) => a.platform.localeCompare(b.platform, "es")),
      recentTransactions: transactions.slice(0, 10).map((transaction) => ({
        id: transaction.id,
        approvalCode: transaction.approvalCode,
        platform: transaction.platform.name,
        type: transaction.type.name,
        amount: transaction.amount,
        commissionAmount: transaction.commissionAmount,
        externalReference: transaction.externalReference,
        customerName: transaction.customerName,
        performedAt: transaction.performedAt.toISOString(),
        status: transaction.status,
        registeredBy: transaction.registeredBy.name ?? transaction.registeredBy.username,
        hasEvidence: transaction.evidences.length > 0
      }))
    };
  });
  ipcMain2.handle("correspondent:transactions:list", async (_event, payload) => {
    var _a;
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2) {
      return { success: false, message: "Debes iniciar sesion", transactions: [] };
    }
    const parsed = listCorrespondentTransactionsSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, message: "Filtros invalidos", transactions: [] };
    }
    const filters = parsed.data;
    const search = (_a = filters.search) == null ? void 0 : _a.trim();
    const transactions = await prisma2.correspondentTransaction.findMany({
      where: {
        platformId: filters.platformId,
        registeredByUserId: filters.userId,
        status: filters.status,
        performedAt: filters.dateFrom || filters.dateTo ? {
          ...filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {},
          ...filters.dateTo ? { lt: endOfDay(new Date(filters.dateTo)) } : {}
        } : void 0,
        OR: search ? [
          { approvalCode: { contains: search } },
          { externalReference: { contains: search } },
          { customerName: { contains: search } },
          { customerDocument: { contains: search } },
          { targetAccount: { contains: search } },
          { targetPhone: { contains: search } },
          { note: { contains: search } },
          { platform: { is: { name: { contains: search } } } },
          { type: { is: { name: { contains: search } } } },
          {
            registeredBy: {
              is: {
                OR: [
                  { username: { contains: search } },
                  { name: { contains: search } }
                ]
              }
            }
          }
        ] : void 0
      },
      include: {
        platform: true,
        type: true,
        registeredBy: { select: { id: true, username: true, name: true } },
        evidences: { select: { id: true, fileName: true } },
        dailyClosure: { select: { id: true, status: true } }
      },
      orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
      take: 150
    });
    return {
      success: true,
      transactions: transactions.map((transaction) => {
        var _a2, _b;
        return {
          id: transaction.id,
          approvalCode: transaction.approvalCode,
          platformId: transaction.platformId,
          platform: transaction.platform.name,
          typeId: transaction.typeId,
          type: transaction.type.name,
          direction: transaction.type.direction,
          amount: transaction.amount,
          commissionAmount: transaction.commissionAmount,
          netAmount: transaction.netAmount,
          externalReference: transaction.externalReference,
          customerName: transaction.customerName,
          customerDocument: transaction.customerDocument,
          targetAccount: transaction.targetAccount,
          targetPhone: transaction.targetPhone,
          performedAt: transaction.performedAt.toISOString(),
          status: transaction.status,
          source: transaction.source,
          registeredBy: transaction.registeredBy.name ?? transaction.registeredBy.username,
          note: transaction.note,
          hasEvidence: transaction.evidences.length > 0,
          evidenceCount: transaction.evidences.length,
          closureId: ((_a2 = transaction.dailyClosure) == null ? void 0 : _a2.id) ?? null,
          closureStatus: ((_b = transaction.dailyClosure) == null ? void 0 : _b.status) ?? null
        };
      })
    };
  });
  ipcMain2.handle("correspondent:transaction:detail", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2) {
      return { success: false, message: "Debes iniciar sesion" };
    }
    const parsed = getCorrespondentTransactionDetailSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, message: "Transaccion invalida" };
    }
    const transaction = await getCorrespondentTransactionDetail(prisma2, parsed.data.transactionId);
    if (!transaction) {
      return { success: false, message: "La transaccion ya no existe" };
    }
    return {
      success: true,
      transaction: {
        id: transaction.id,
        approvalCode: transaction.approvalCode,
        platformId: transaction.platformId,
        platform: transaction.platform.name,
        typeId: transaction.typeId,
        type: transaction.type.name,
        amount: transaction.amount,
        commissionAmount: transaction.commissionAmount,
        netAmount: transaction.netAmount,
        performedAt: transaction.performedAt.toISOString(),
        createdAt: transaction.createdAt.toISOString(),
        updatedAt: transaction.updatedAt.toISOString(),
        registeredBy: transaction.registeredBy.name ?? transaction.registeredBy.username,
        note: transaction.note,
        status: transaction.status,
        auditTrail: transaction.auditLogs.map((entry) => ({
          id: entry.id,
          action: entry.action,
          createdAt: entry.createdAt.toISOString(),
          user: entry.user ? entry.user.name ?? entry.user.username : null,
          beforeJson: entry.beforeJson,
          afterJson: entry.afterJson,
          context: entry.context
        }))
      }
    };
  });
  ipcMain2.handle("correspondent:transaction:create", async (_event, payload) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2) {
      return { success: false, message: "Debes iniciar sesion para registrar movimientos" };
    }
    const parsed = createCorrespondentTransactionSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, message: "Datos invalidos para el corresponsal" };
    }
    const data = parsed.data;
    const performedAt = new Date(data.performedAt);
    const [platform, type, activeCashSession] = await Promise.all([
      prisma2.correspondentPlatform.findUnique({ where: { id: data.platformId } }),
      prisma2.correspondentTransactionType.findUnique({ where: { id: data.typeId } }),
      getActiveCashSessionForUser(prisma2, currentSessionUser2.id)
    ]);
    if (!platform || !platform.isActive) {
      return { success: false, message: "La plataforma seleccionada no esta disponible" };
    }
    if (!type || !type.isActive || type.platformId !== platform.id) {
      return { success: false, message: "El tipo de transaccion no corresponde a la plataforma" };
    }
    const duplicate = await prisma2.correspondentTransaction.findFirst({
      where: {
        platformId: platform.id,
        typeId: type.id,
        amount: data.amount,
        externalReference: ((_a = data.externalReference) == null ? void 0 : _a.trim()) || null,
        performedAt: {
          gte: new Date(performedAt.getTime() - 10 * 60 * 1e3),
          lte: new Date(performedAt.getTime() + 10 * 60 * 1e3)
        },
        status: CorrespondentTransactionStatus.REGISTERED
      }
    });
    if (duplicate) {
      return { success: false, message: "Parece un duplicado reciente. Verifica antes de registrar." };
    }
    const computedCommission = data.commissionAmount ?? await resolveCommissionAmount(prisma2, platform.id, type.id, data.amount, performedAt);
    const netAmount = type.direction === CorrespondentDirection.OUT ? data.amount - computedCommission : data.amount + computedCommission;
    const evidencePayload = data.evidence ? await saveCorrespondentEvidence({ app: app2, platformCode: platform.code, evidence: data.evidence }) : null;
    try {
      const existingApprovalCodes = (await prisma2.correspondentTransaction.findMany({
        select: { approvalCode: true }
      })).map((transaction2) => transaction2.approvalCode);
      const approvalCode = resolveLooseCode({
        desiredCode: data.approvalCode,
        existingCodes: existingApprovalCodes,
        generatedPrefix: "APR",
        digits: 6,
        maxLength: 40
      });
      const transaction = await prisma2.correspondentTransaction.create({
        data: {
          approvalCode,
          platformId: platform.id,
          typeId: type.id,
          cashSessionId: (activeCashSession == null ? void 0 : activeCashSession.id) ?? null,
          cashRegisterId: (activeCashSession == null ? void 0 : activeCashSession.registerId) ?? null,
          registeredByUserId: currentSessionUser2.id,
          status: CorrespondentTransactionStatus.REGISTERED,
          source: data.source,
          ocrStatus: ((_b = data.evidence) == null ? void 0 : _b.ocrRawText) ? CorrespondentOcrStatus.PROCESSED : platform.supportsOcr ? CorrespondentOcrStatus.NEEDS_REVIEW : CorrespondentOcrStatus.NOT_REQUESTED,
          reconciliationStatus: CorrespondentReconciliationStatus.PENDING,
          externalReference: ((_c = data.externalReference) == null ? void 0 : _c.trim()) || null,
          customerName: ((_d = data.customerName) == null ? void 0 : _d.trim()) || null,
          customerDocument: ((_e = data.customerDocument) == null ? void 0 : _e.trim()) || null,
          targetAccount: ((_f = data.targetAccount) == null ? void 0 : _f.trim()) || null,
          targetPhone: ((_g = data.targetPhone) == null ? void 0 : _g.trim()) || null,
          amount: data.amount,
          commissionAmount: computedCommission,
          netAmount,
          performedAt,
          note: ((_h = data.note) == null ? void 0 : _h.trim()) || null,
          rawExtractedText: ((_i = data.rawExtractedText) == null ? void 0 : _i.trim()) || ((_j = data.evidence) == null ? void 0 : _j.ocrRawText) || null,
          evidences: evidencePayload ? {
            create: {
              ...evidencePayload,
              capturedByUserId: currentSessionUser2.id
            }
          } : void 0
        },
        include: {
          platform: true,
          type: true,
          evidences: { select: { id: true } }
        }
      });
      await logCorrespondentAction({
        prisma: prisma2,
        currentSessionUser: currentSessionUser2,
        transactionId: transaction.id,
        action: "create_transaction",
        afterJson: {
          approvalCode: transaction.approvalCode,
          platform: transaction.platform.name,
          type: transaction.type.name,
          amount: transaction.amount,
          commissionAmount: transaction.commissionAmount,
          hasEvidence: transaction.evidences.length > 0
        }
      });
      return {
        success: true,
        transaction: {
          id: transaction.id,
          approvalCode: transaction.approvalCode,
          platform: transaction.platform.name,
          type: transaction.type.name,
          amount: transaction.amount,
          commissionAmount: transaction.commissionAmount,
          netAmount: transaction.netAmount,
          hasEvidence: transaction.evidences.length > 0
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo registrar la transaccion";
      return { success: false, message };
    }
  });
  ipcMain2.handle("correspondent:transaction:update", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2) {
      return { success: false, message: "Debes iniciar sesion para editar movimientos" };
    }
    const parsed = updateCorrespondentTransactionSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, message: "Datos invalidos para actualizar la transaccion" };
    }
    const existingTransaction = await prisma2.correspondentTransaction.findUnique({
      where: { id: parsed.data.transactionId },
      include: {
        platform: true,
        type: true
      }
    });
    if (!existingTransaction) {
      return { success: false, message: "La transaccion ya no existe" };
    }
    if (existingTransaction.dailyClosureId) {
      return { success: false, message: "No puedes editar una transaccion que ya hace parte de un cuadre" };
    }
    if (existingTransaction.status === CorrespondentTransactionStatus.VOIDED) {
      return { success: false, message: "No puedes editar una transaccion anulada" };
    }
    const nextType = await prisma2.correspondentTransactionType.findUnique({
      where: { id: parsed.data.typeId }
    });
    if (!nextType || !nextType.isActive || nextType.platformId !== existingTransaction.platformId) {
      return { success: false, message: "El nuevo tipo no pertenece al mismo corresponsal" };
    }
    const nextPerformedAt = new Date(parsed.data.performedAt);
    const nextCommissionAmount = await resolveCommissionAmount(
      prisma2,
      existingTransaction.platformId,
      nextType.id,
      parsed.data.amount,
      nextPerformedAt
    );
    const nextNetAmount = nextType.direction === CorrespondentDirection.OUT ? parsed.data.amount - nextCommissionAmount : parsed.data.amount + nextCommissionAmount;
    try {
      const existingApprovalCodes = (await prisma2.correspondentTransaction.findMany({
        where: { NOT: { id: existingTransaction.id } },
        select: { approvalCode: true }
      })).map((transaction) => transaction.approvalCode);
      const approvalCode = resolveLooseCode({
        desiredCode: parsed.data.approvalCode ?? existingTransaction.approvalCode,
        existingCodes: existingApprovalCodes,
        generatedPrefix: "APR",
        digits: 6,
        maxLength: 40
      });
      const updatedTransaction = await prisma2.correspondentTransaction.update({
        where: { id: existingTransaction.id },
        data: {
          approvalCode,
          typeId: nextType.id,
          amount: parsed.data.amount,
          commissionAmount: nextCommissionAmount,
          netAmount: nextNetAmount,
          performedAt: nextPerformedAt,
          reviewedByUserId: currentSessionUser2.id
        },
        include: {
          platform: true,
          type: true,
          evidences: { select: { id: true } }
        }
      });
      await logCorrespondentAction({
        prisma: prisma2,
        currentSessionUser: currentSessionUser2,
        transactionId: updatedTransaction.id,
        action: "update_transaction",
        beforeJson: {
          approvalCode: existingTransaction.approvalCode,
          type: existingTransaction.type.name,
          amount: existingTransaction.amount,
          performedAt: existingTransaction.performedAt.toISOString(),
          commissionAmount: existingTransaction.commissionAmount
        },
        afterJson: {
          approvalCode: updatedTransaction.approvalCode,
          type: updatedTransaction.type.name,
          amount: updatedTransaction.amount,
          performedAt: updatedTransaction.performedAt.toISOString(),
          commissionAmount: updatedTransaction.commissionAmount
        }
      });
      return {
        success: true,
        transaction: {
          id: updatedTransaction.id,
          approvalCode: updatedTransaction.approvalCode,
          platform: updatedTransaction.platform.name,
          type: updatedTransaction.type.name,
          amount: updatedTransaction.amount,
          commissionAmount: updatedTransaction.commissionAmount,
          netAmount: updatedTransaction.netAmount,
          hasEvidence: updatedTransaction.evidences.length > 0
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar la transaccion";
      return { success: false, message };
    }
  });
  ipcMain2.handle("correspondent:platform:create", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2 || currentSessionUser2.role !== Role.ADMIN) {
      return { success: false, message: "Solo el administrador puede crear corresponsales" };
    }
    const parsed = createCorrespondentPlatformSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, message: "Datos invalidos para el corresponsal" };
    }
    const platformName = parsed.data.name.trim();
    const duplicate = await prisma2.correspondentPlatform.findFirst({
      where: { name: { equals: platformName } },
      select: { id: true }
    });
    if (duplicate) {
      return { success: false, message: "Ya existe un corresponsal con ese nombre" };
    }
    try {
      const created = await prisma2.correspondentPlatform.create({
        data: {
          code: await buildUniquePlatformCode(prisma2, platformName),
          name: platformName,
          isActive: true,
          requiresEvidence: parsed.data.requiresEvidence,
          supportsOcr: parsed.data.supportsOcr,
          supportsFileImport: parsed.data.supportsFileImport
        }
      });
      await prisma2.correspondentCommissionRule.create({
        data: {
          platformId: created.id,
          mode: CommissionMode.NONE,
          value: 0,
          isActive: true
        }
      });
      await logCorrespondentAction({
        prisma: prisma2,
        currentSessionUser: currentSessionUser2,
        action: "create_platform",
        context: `platform:${created.id}`,
        afterJson: {
          platform: created.name,
          code: created.code
        }
      });
      return { success: true, platformId: created.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear el corresponsal";
      return { success: false, message };
    }
  });
  ipcMain2.handle("correspondent:platform:update", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2 || currentSessionUser2.role !== Role.ADMIN) {
      return { success: false, message: "Solo el administrador puede editar corresponsales" };
    }
    const parsed = updateCorrespondentPlatformSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, message: "Datos invalidos para actualizar el corresponsal" };
    }
    const existingPlatform = await prisma2.correspondentPlatform.findUnique({
      where: { id: parsed.data.platformId }
    });
    if (!existingPlatform) {
      return { success: false, message: "El corresponsal ya no existe" };
    }
    const duplicate = await prisma2.correspondentPlatform.findFirst({
      where: {
        name: { equals: parsed.data.name.trim() },
        NOT: { id: existingPlatform.id }
      },
      select: { id: true }
    });
    if (duplicate) {
      return { success: false, message: "Ya existe otro corresponsal con ese nombre" };
    }
    try {
      const updated = await prisma2.correspondentPlatform.update({
        where: { id: existingPlatform.id },
        data: {
          name: parsed.data.name.trim(),
          requiresEvidence: parsed.data.requiresEvidence,
          supportsOcr: parsed.data.supportsOcr,
          supportsFileImport: parsed.data.supportsFileImport
        }
      });
      await logCorrespondentAction({
        prisma: prisma2,
        currentSessionUser: currentSessionUser2,
        action: "update_platform",
        context: `platform:${updated.id}`,
        beforeJson: {
          name: existingPlatform.name,
          requiresEvidence: existingPlatform.requiresEvidence,
          supportsOcr: existingPlatform.supportsOcr,
          supportsFileImport: existingPlatform.supportsFileImport
        },
        afterJson: {
          name: updated.name,
          requiresEvidence: updated.requiresEvidence,
          supportsOcr: updated.supportsOcr,
          supportsFileImport: updated.supportsFileImport
        }
      });
      return { success: true, platformId: updated.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar el corresponsal";
      return { success: false, message };
    }
  });
  ipcMain2.handle("correspondent:platform:delete", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2 || currentSessionUser2.role !== Role.ADMIN) {
      return { success: false, message: "Solo el administrador puede eliminar corresponsales" };
    }
    const parsed = deleteCorrespondentPlatformSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, message: "Corresponsal invalido" };
    }
    const existingPlatform = await prisma2.correspondentPlatform.findUnique({
      where: { id: parsed.data.platformId },
      include: {
        transactionTypes: {
          select: { id: true }
        }
      }
    });
    if (!existingPlatform) {
      return { success: false, message: "El corresponsal ya no existe" };
    }
    try {
      await prisma2.$transaction(async (tx) => {
        await tx.correspondentPlatform.update({
          where: { id: existingPlatform.id },
          data: { isActive: false }
        });
        if (existingPlatform.transactionTypes.length > 0) {
          await tx.correspondentTransactionType.updateMany({
            where: { platformId: existingPlatform.id },
            data: { isActive: false }
          });
        }
      });
      await logCorrespondentAction({
        prisma: prisma2,
        currentSessionUser: currentSessionUser2,
        action: "delete_platform",
        context: `platform:${existingPlatform.id}`,
        beforeJson: {
          name: existingPlatform.name
        }
      });
      return { success: true, platformId: existingPlatform.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo eliminar el corresponsal";
      return { success: false, message };
    }
  });
  ipcMain2.handle("correspondent:type:create", async (_event, payload) => {
    var _a;
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2 || currentSessionUser2.role !== Role.ADMIN) {
      return { success: false, message: "Solo el administrador puede crear tipos" };
    }
    const parsed = createCorrespondentTransactionTypeSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, message: "Datos invalidos para el tipo" };
    }
    const platform = await prisma2.correspondentPlatform.findUnique({
      where: { id: parsed.data.platformId },
      include: {
        transactionTypes: {
          select: { sortOrder: true },
          orderBy: { sortOrder: "desc" },
          take: 1
        }
      }
    });
    if (!platform || !platform.isActive) {
      return { success: false, message: "El corresponsal ya no existe" };
    }
    const typeName = parsed.data.name.trim();
    const duplicate = await prisma2.correspondentTransactionType.findFirst({
      where: {
        platformId: platform.id,
        name: { equals: typeName }
      },
      select: { id: true }
    });
    if (duplicate) {
      return { success: false, message: "Ese corresponsal ya tiene un tipo con ese nombre" };
    }
    try {
      const created = await prisma2.correspondentTransactionType.create({
        data: {
          platformId: platform.id,
          code: await buildUniqueTypeCode(prisma2, platform.id, typeName),
          name: typeName,
          direction: parsed.data.direction,
          isActive: true,
          sortOrder: (((_a = platform.transactionTypes[0]) == null ? void 0 : _a.sortOrder) ?? 0) + 10
        }
      });
      await logCorrespondentAction({
        prisma: prisma2,
        currentSessionUser: currentSessionUser2,
        action: "create_transaction_type",
        context: `platform:${platform.id};type:${created.id}`,
        afterJson: {
          platform: platform.name,
          type: created.name,
          direction: created.direction
        }
      });
      return { success: true, typeId: created.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear el tipo";
      return { success: false, message };
    }
  });
  ipcMain2.handle("correspondent:type:update", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2 || currentSessionUser2.role !== Role.ADMIN) {
      return { success: false, message: "Solo el administrador puede editar tipos" };
    }
    const parsed = updateCorrespondentTransactionTypeSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, message: "Datos invalidos para actualizar el tipo" };
    }
    const existingType = await prisma2.correspondentTransactionType.findUnique({
      where: { id: parsed.data.typeId }
    });
    if (!existingType) {
      return { success: false, message: "El tipo ya no existe" };
    }
    const duplicate = await prisma2.correspondentTransactionType.findFirst({
      where: {
        platformId: existingType.platformId,
        name: { equals: parsed.data.name.trim() },
        NOT: { id: existingType.id }
      },
      select: { id: true }
    });
    if (duplicate) {
      return { success: false, message: "Ya existe otro tipo con ese nombre en el corresponsal" };
    }
    try {
      const updated = await prisma2.correspondentTransactionType.update({
        where: { id: existingType.id },
        data: {
          name: parsed.data.name.trim(),
          direction: parsed.data.direction
        }
      });
      await logCorrespondentAction({
        prisma: prisma2,
        currentSessionUser: currentSessionUser2,
        action: "update_transaction_type",
        context: `platform:${existingType.platformId};type:${updated.id}`,
        beforeJson: {
          name: existingType.name,
          direction: existingType.direction
        },
        afterJson: {
          name: updated.name,
          direction: updated.direction
        }
      });
      return { success: true, typeId: updated.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar el tipo";
      return { success: false, message };
    }
  });
  ipcMain2.handle("correspondent:type:delete", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2 || currentSessionUser2.role !== Role.ADMIN) {
      return { success: false, message: "Solo el administrador puede eliminar tipos" };
    }
    const parsed = deleteCorrespondentTransactionTypeSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, message: "Tipo invalido" };
    }
    const existingType = await prisma2.correspondentTransactionType.findUnique({
      where: { id: parsed.data.typeId }
    });
    if (!existingType) {
      return { success: false, message: "El tipo ya no existe" };
    }
    try {
      await prisma2.correspondentTransactionType.update({
        where: { id: existingType.id },
        data: { isActive: false }
      });
      await logCorrespondentAction({
        prisma: prisma2,
        currentSessionUser: currentSessionUser2,
        action: "delete_transaction_type",
        context: `platform:${existingType.platformId};type:${existingType.id}`,
        beforeJson: {
          name: existingType.name,
          direction: existingType.direction
        }
      });
      return { success: true, typeId: existingType.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo eliminar el tipo";
      return { success: false, message };
    }
  });
  ipcMain2.handle("correspondent:closures:list", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2) {
      return { success: false, message: "Debes iniciar sesion", closures: [] };
    }
    const parsed = listCorrespondentClosuresSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, message: "Fecha de cierre invalida", closures: [] };
    }
    const businessDate = normalizeBusinessDate(parsed.data.businessDate);
    const [platforms, closures, transactions] = await Promise.all([
      prisma2.correspondentPlatform.findMany({
        where: { isActive: true },
        orderBy: [{ createdAt: "asc" }, { name: "asc" }]
      }),
      prisma2.correspondentDailyClosure.findMany({
        where: { businessDate },
        include: {
          platform: true,
          closedBy: { select: { username: true, name: true } }
        },
        orderBy: { closedAt: "desc" }
      }),
      getCorrespondentTransactionsForDay(prisma2, businessDate)
    ]);
    const closureByPlatform = new Map(closures.map((closure) => [closure.platformId, closure]));
    const transactionsByPlatform = transactions.reduce((acc, transaction) => {
      acc[transaction.platformId] = [...acc[transaction.platformId] ?? [], transaction];
      return acc;
    }, {});
    const totals = summarizeCorrespondentTransactions(transactions);
    return {
      success: true,
      businessDate: businessDate.toISOString(),
      totals: {
        totalIn: totals.totalIn,
        totalOut: totals.totalOut,
        netTotal: totals.totalIn - totals.totalOut,
        transactionsCount: totals.transactionsCount
      },
      closures: platforms.map((platform) => {
        const platformTransactions = transactionsByPlatform[platform.id] ?? [];
        const summary = summarizeCorrespondentTransactions(platformTransactions);
        const closure = closureByPlatform.get(platform.id) ?? null;
        const breakdownMap = platformTransactions.reduce((acc, transaction) => {
          if (transaction.status === CorrespondentTransactionStatus.VOIDED) {
            return acc;
          }
          const current = acc[transaction.typeId] ?? {
            typeId: transaction.typeId,
            type: transaction.type.name,
            direction: transaction.type.direction,
            total: 0,
            count: 0
          };
          current.total += transaction.amount;
          current.count += 1;
          acc[transaction.typeId] = current;
          return acc;
        }, {});
        return {
          platformId: platform.id,
          platform: platform.name,
          totalIn: summary.totalIn,
          totalOut: summary.totalOut,
          totalCommission: summary.totalCommission,
          expectedBalance: summary.totalIn - summary.totalOut + summary.totalCommission,
          transactionsCount: summary.transactionsCount,
          pendingTransactions: summary.pendingClosureCount,
          breakdown: Object.values(breakdownMap).sort((a, b) => a.type.localeCompare(b.type, "es")),
          closure: closure ? {
            id: closure.id,
            expectedBalance: closure.expectedBalance,
            reportedBalance: closure.reportedBalance,
            differenceAmount: closure.differenceAmount,
            status: closure.status,
            closedAt: closure.closedAt.toISOString(),
            closedBy: closure.closedBy.name ?? closure.closedBy.username,
            note: closure.note
          } : null
        };
      })
    };
  });
  ipcMain2.handle("correspondent:closure:create", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2) {
      return { success: false, message: "Debes iniciar sesion para cerrar" };
    }
    const parsed = createCorrespondentClosureSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, message: "Datos invalidos para el cierre" };
    }
    const data = parsed.data;
    const businessDate = normalizeBusinessDate(data.businessDate);
    const existing = await prisma2.correspondentDailyClosure.findFirst({
      where: {
        platformId: data.platformId,
        businessDate
      }
    });
    if (existing) {
      return { success: false, message: "La plataforma ya fue cerrada para esa fecha" };
    }
    const [platform, transactions, activeCashSession] = await Promise.all([
      prisma2.correspondentPlatform.findUnique({ where: { id: data.platformId } }),
      getCorrespondentTransactionsForDay(prisma2, businessDate, data.platformId),
      getActiveCashSessionForUser(prisma2, currentSessionUser2.id)
    ]);
    if (!platform) {
      return { success: false, message: "Plataforma no encontrada" };
    }
    const openTransactions = transactions.filter(
      (transaction) => transaction.status === CorrespondentTransactionStatus.REGISTERED && !transaction.dailyClosureId
    );
    const summary = summarizeCorrespondentTransactions(openTransactions);
    const expectedBalance = data.openingBalance + summary.totalIn - summary.totalOut + summary.totalCommission;
    const differenceAmount = data.reportedBalance - expectedBalance;
    try {
      const closure = await prisma2.$transaction(async (tx) => {
        var _a;
        const createdClosure = await tx.correspondentDailyClosure.create({
          data: {
            platformId: platform.id,
            cashSessionId: (activeCashSession == null ? void 0 : activeCashSession.id) ?? null,
            businessDate,
            totalIn: summary.totalIn,
            totalOut: summary.totalOut,
            totalCommission: summary.totalCommission,
            transactionsCount: summary.transactionsCount,
            expectedBalance,
            reportedBalance: data.reportedBalance,
            differenceAmount,
            status: differenceAmount === 0 ? CorrespondentClosureStatus.CLOSED : CorrespondentClosureStatus.WITH_DIFFERENCE,
            note: ((_a = data.note) == null ? void 0 : _a.trim()) || null,
            closedByUserId: currentSessionUser2.id
          }
        });
        if (openTransactions.length > 0) {
          await tx.correspondentTransaction.updateMany({
            where: {
              id: { in: openTransactions.map((transaction) => transaction.id) }
            },
            data: {
              dailyClosureId: createdClosure.id
            }
          });
        }
        return createdClosure;
      });
      await logCorrespondentAction({
        prisma: prisma2,
        currentSessionUser: currentSessionUser2,
        action: "create_closure",
        context: `platform:${platform.id};closure:${closure.id}`,
        afterJson: {
          platform: platform.name,
          businessDate: businessDate.toISOString(),
          expectedBalance,
          reportedBalance: data.reportedBalance,
          differenceAmount
        }
      });
      return {
        success: true,
        closure: {
          id: closure.id,
          expectedBalance,
          reportedBalance: closure.reportedBalance,
          differenceAmount: closure.differenceAmount,
          status: closure.status
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo cerrar la plataforma";
      return { success: false, message };
    }
  });
}
const treasurySourceMediumSchema = z.enum(["CASH", "TRANSFER", "CORRESPONDENT"]);
const accountingRangeSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional()
}).optional().default({});
const createAccountingCreditSchema = z.object({
  saleId: z.string().uuid("saleId invalido"),
  customerId: z.string().uuid("customerId invalido"),
  total: z.number().int("El valor debe ser entero").positive("El valor debe ser mayor a 0").optional(),
  dueDate: z.string().datetime("Fecha de vencimiento invalida").optional().nullable()
});
const createAccountingPaymentSchema = z.object({
  creditId: z.string().uuid("creditId invalido"),
  amount: z.number().int("El valor debe ser entero").positive("El valor debe ser mayor a 0"),
  method: paymentMethodSchema.optional().default("CASH"),
  note: z.string().trim().max(250).optional().nullable()
});
const createAccountingCreditNoteSchema = z.object({
  saleId: z.string().uuid("saleId invalido"),
  amount: z.number().int("El valor debe ser entero").positive("El valor debe ser mayor a 0"),
  reason: z.string().trim().max(250).optional().nullable()
});
const createAccountingExpenseSchema = z.object({
  amount: z.number().int("El valor debe ser entero").positive("El valor debe ser mayor a 0"),
  note: z.string().trim().min(2, "La descripcion es obligatoria").max(250),
  type: z.enum(["EXPENSE_OUT", "WITHDRAWAL_OUT"]).optional().default("EXPENSE_OUT"),
  sourceMedium: treasurySourceMediumSchema.optional().default("CASH"),
  sourcePlatformId: z.string().uuid("Plataforma invalida").optional().nullable()
});
const productUnitMeasureSchema = z.enum([
  "UNIDAD",
  "PAR",
  "METRO",
  "CENTIMETRO",
  "CAJA",
  "PAQUETE",
  "DOCENA",
  "ROLLO",
  "BOLSA",
  "BOTELLA",
  "FRASCO",
  "LIBRA",
  "KILO",
  "LITRO"
]);
const allowedTaxRates = [0, 0.05, 0.19];
function validateAllowedTaxRate(taxRate, ctx) {
  if (taxRate === void 0)
    return;
  if (!allowedTaxRates.includes(taxRate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "El IVA permitido es: no aplica, 0%, 5% o 19%",
      path: ["taxRate"]
    });
  }
}
const createProductSchema = z.object({
  name: z.string({ message: "El nombre es obligatorio" }).trim().min(2, "Minimo 2 caracteres").max(120, "Maximo 120 caracteres"),
  barcode: z.string().trim().min(1).max(50).optional().nullable(),
  sku: z.string().trim().min(1).max(50).optional().nullable(),
  unitMeasure: productUnitMeasureSchema.optional().default("UNIDAD"),
  price: z.number({ message: "El precio es obligatorio" }).positive("El precio debe ser mayor a 0"),
  cost: z.number().min(0, "El costo no puede ser negativo").optional().default(0),
  marginPercent: z.number().min(0, "La ganancia no puede ser negativa").optional().default(0),
  hasTax: z.boolean().optional().default(false),
  taxRate: z.number().min(0).max(1).optional().default(0),
  stock: z.number().int("El stock debe ser un numero entero").min(0, "El stock no puede ser negativo").optional().default(0),
  categoryId: z.string().uuid().optional().nullable(),
  subcategoryId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional().default(true)
}).superRefine((data, ctx) => {
  validateAllowedTaxRate(data.taxRate, ctx);
});
const updateProductSchema = z.object({
  id: z.string().uuid("ID de producto invalido"),
  name: z.string().trim().min(2, "Minimo 2 caracteres").max(120).optional(),
  barcode: z.string().trim().min(1).max(50).optional().nullable(),
  sku: z.string().trim().min(1).max(50).optional().nullable(),
  unitMeasure: productUnitMeasureSchema.optional(),
  price: z.number().positive("El precio debe ser mayor a 0").optional(),
  cost: z.number().min(0).optional(),
  marginPercent: z.number().min(0).optional(),
  hasTax: z.boolean().optional(),
  taxRate: z.number().min(0).max(1).optional(),
  stock: z.number().int().min(0).optional(),
  categoryId: z.string().uuid().optional().nullable(),
  subcategoryId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional()
}).superRefine((data, ctx) => {
  validateAllowedTaxRate(data.taxRate, ctx);
});
z.object({
  productId: z.string().uuid("ID de producto invalido"),
  delta: z.number().int("El ajuste debe ser un numero entero").refine((n) => n !== 0, "El ajuste no puede ser 0"),
  reason: z.string().trim().max(200).optional()
});
z.object({
  barcode: z.string().trim().min(1, "Barcode no puede estar vacio")
});
const adminSections = [
  {
    title: "Contabilidad",
    groups: [
      {
        title: "Inicio y documentos",
        permissions: [
          "Ver detalle de operaciones",
          "Ver graficas y tablas de la pagina de inicio",
          "Eliminar archivos adjuntos en documentos"
        ]
      },
      {
        title: "Facturas de venta",
        permissions: [
          "Ver listado",
          "Ver detalles",
          "Crear nuevas facturas",
          "Editar facturas por cobrar",
          "Editar facturas borrador",
          "Editar descuentos en facturas",
          "Editar precios de los items de venta en facturas",
          "Eliminar",
          "Anular",
          "Exportar facturas en Excel",
          "Convertir facturas en recurrentes"
        ]
      },
      {
        title: "Facturas recurrentes",
        permissions: [
          "Ver listado",
          "Ver detalles",
          "Crear nuevas facturas recurrentes",
          "Editar facturas recurrentes",
          "Eliminar"
        ]
      },
      {
        title: "Notas de credito",
        permissions: [
          "Ver listado",
          "Ver detalles",
          "Crear nuevas notas de credito",
          "Editar notas de credito",
          "Eliminar",
          "Exportar notas de credito en Excel"
        ]
      },
      {
        title: "Cotizaciones",
        permissions: [
          "Ver listado",
          "Ver detalles",
          "Crear nuevas cotizaciones",
          "Editar cotizaciones",
          "Editar descuentos en cotizaciones",
          "Editar precios de productos de venta en cotizaciones",
          "Eliminar",
          "Exportar cotizaciones en Excel"
        ]
      },
      {
        title: "Remisiones",
        permissions: [
          "Ver listado",
          "Ver detalles",
          "Crear nuevas remisiones",
          "Editar",
          "Editar descuento",
          "Editar precios de items de venta en remisiones",
          "Eliminar",
          "Anular",
          "Exportar remisiones en Excel",
          "Editar plantillas de impresion"
        ]
      },
      {
        title: "Terminos, numeraciones y vendedores",
        permissions: [
          "Crear nuevos terminos de pago",
          "Editar terminos de pago",
          "Eliminar terminos de pago",
          "Crear nuevas numeraciones",
          "Editar numeraciones",
          "Eliminar numeraciones",
          "Activar o desactivar numeraciones",
          "Crear nuevos vendedores",
          "Editar vendedores",
          "Eliminar vendedores",
          "Activar o desactivar vendedores"
        ]
      },
      {
        title: "Compras y proveedores",
        permissions: [
          "Ver listado de facturas de proveedores",
          "Ver detalles de facturas de proveedores",
          "Crear nuevas facturas de proveedores",
          "Editar facturas de proveedores",
          "Exportar facturas de proveedores en Excel",
          "Eliminar facturas de proveedores",
          "Crear nuevos pagos recurrentes",
          "Editar pagos recurrentes",
          "Eliminar pagos recurrentes",
          "Crear nuevas ordenes de compra",
          "Editar ordenes de compra",
          "Eliminar ordenes de compra",
          "Anular ordenes de compra",
          "Exportar ordenes de compra en Excel"
        ]
      },
      {
        title: "Notas debito, pagos y gastos",
        permissions: [
          "Crear nuevas notas debito",
          "Editar notas debito",
          "Eliminar notas debito",
          "Anular notas debito",
          "Exportar notas debito",
          "Crear pago menor",
          "Ver detalle de pago menor",
          "Editar pago menor",
          "Eliminar pago menor",
          "Anular pago menor",
          "Ver listado de recibos de caja",
          "Ver detalles de recibos de caja",
          "Crear nuevos recibos de caja",
          "Editar recibos de caja",
          "Ver listado de gastos",
          "Ver detalles de gastos",
          "Crear nuevos comprobantes de egreso",
          "Editar comprobantes de egreso",
          "Eliminar comprobantes de egreso",
          "Anular comprobantes de egreso",
          "Exportar transacciones en Excel"
        ]
      },
      {
        title: "Bancos e integraciones",
        permissions: [
          "Ver listado de bancos",
          "Ver detalles de bancos",
          "Agregar nuevos bancos",
          "Editar bancos",
          "Eliminar bancos",
          "Ver saldos",
          "Conciliar bancos",
          "Activar o desactivar bancos",
          "Activar integraciones bancarias",
          "Crear conexion con banco",
          "Borrar conexion con banco",
          "Ver listado de conexiones con bancos",
          "Actualizar conexion con banco"
        ]
      },
      {
        title: "Reportes comerciales y financieros",
        permissions: [
          "Ver reporte de ventas generales",
          "Exportar reporte de ventas generales",
          "Ver reporte de ventas por item",
          "Exportar reporte de ventas por item",
          "Ver reporte de ventas por cliente",
          "Exportar reporte de ventas por cliente",
          "Ver rentabilidad por item",
          "Exportar rentabilidad por item",
          "Ver ventas por vendedor",
          "Exportar ventas por vendedor",
          "Ver estado de cuenta de clientes",
          "Exportar estado de cuenta de clientes",
          "Exportar reporte de ventas diarias",
          "Exportar ventas con exencion de IVA",
          "Ver reporte de cuentas por cobrar",
          "Exportar reporte de cuentas por cobrar",
          "Ver reporte de cuentas por pagar",
          "Exportar reporte de cuentas por pagar",
          "Ver reporte de ingresos y gastos",
          "Exportar reporte de ingresos y gastos",
          "Ver reporte de flujo de efectivo",
          "Exportar reporte de flujo de efectivo",
          "Ver reporte de inventario valorizado",
          "Exportar reporte de inventario valorizado",
          "Ver reporte de transacciones",
          "Exportar reporte de transacciones",
          "Ver reporte de compras",
          "Exportar reporte de compras",
          "Ver reporte anual",
          "Ver estado de resultados",
          "Exportar estado de resultados",
          "Ver estado de situacion financiera",
          "Exportar estado de situacion financiera",
          "Ver reporte de movimientos por cuenta contable",
          "Exportar reporte de movimientos por cuenta contable",
          "Ver libro diario",
          "Exportar libro diario",
          "Ver reporte de auxiliar por tercero",
          "Exportar reporte de auxiliar por tercero",
          "Ver balance de prueba",
          "Exportar balance de prueba",
          "Exportar balance de prueba por tercero",
          "Ver diferencia en cambio de bancos",
          "Ver flujo de caja",
          "Compartir reportes"
        ]
      },
      {
        title: "Impuestos, DIAN y configuracion tributaria",
        permissions: [
          "Ver configuracion",
          "Editar configuracion",
          "Sincronizar datos desde la DIAN",
          "Ver reporte detallado de impuesto",
          "Exportar reporte detallado de impuestos",
          "Ver reporte DIOT",
          "Exportar reporte DIOT",
          "Exportar comprobante de informe diario",
          "Ver Formulario 350",
          "Exportar Formulario 350",
          "Ver certificados de retencion",
          "Exportar certificados de retencion",
          "Configurar informacion exogena",
          "Exportar reportes exogena",
          "Exportar informe contador"
        ]
      },
      {
        title: "Items, inventario y contactos",
        permissions: [
          "Ver listado de items",
          "Ver costos del negocio",
          "Ver detalles de items",
          "Crear nuevos items de venta",
          "Editar items",
          "Eliminar items",
          "Exportar listado de items en Excel",
          "Importar listado de items desde Excel",
          "Actualizar masivamente los items de venta",
          "Ver listado de ajustes de inventario",
          "Ver detalles de ajustes de inventario",
          "Agregar nuevos ajustes de inventario",
          "Editar ajustes de inventario",
          "Eliminar ajustes de inventario",
          "Exportar ajustes de inventario en Excel",
          "Importar ajustes de inventario con AI",
          "Crear nuevas variantes",
          "Editar variantes",
          "Eliminar variantes",
          "Activar o desactivar variantes",
          "Crear nuevos campos adicionales",
          "Editar campos adicionales",
          "Eliminar campos adicionales",
          "Activar o desactivar campos adicionales",
          "Crear nuevos almacenes",
          "Editar almacenes",
          "Eliminar almacenes",
          "Activar o desactivar almacenes",
          "Crear nuevas transferencias",
          "Editar transferencias",
          "Eliminar transferencias",
          "Crear nuevas listas de precios",
          "Editar listas de precios",
          "Eliminar listas de precios",
          "Ver todos los contactos",
          "Ver listado de clientes",
          "Ver listado de proveedores",
          "Ver detalles de todos los contactos",
          "Ver detalles de clientes",
          "Ver detalles de proveedores",
          "Agregar nuevos contactos",
          "Editar contactos",
          "Eliminar contactos",
          "Exportar listado de contactos en Excel",
          "Importar contactos desde Excel",
          "Usar los contactos registrados",
          "Editar limites de credito"
        ]
      },
      {
        title: "Contabilidad general",
        permissions: [
          "Ver listado de cuentas contables",
          "Ver detalles de cuentas contables",
          "Agregar nuevas cuentas contables",
          "Editar cuentas contables",
          "Eliminar cuentas contables",
          "Importar cuentas contables",
          "Exportar cuentas contables",
          "Ver listado de asientos contables",
          "Ver detalles de asientos contables",
          "Agregar nuevos asientos contables",
          "Editar asientos contables",
          "Eliminar asientos contables",
          "Exportar asientos contables",
          "Importar asientos contables",
          "Agregar nuevos tipos de comprobante contable",
          "Editar tipos de comprobante contable",
          "Eliminar tipos de comprobante contable",
          "Abrir o cerrar periodos contables",
          "Crear numeracion contable",
          "Editar numeracion contable",
          "Eliminar numeracion contable",
          "Ver detalles de numeracion contable",
          "Listar numeraciones contables",
          "Actualizar estado de numeracion contable",
          "Ver conciliador fiscal",
          "Editar conciliador fiscal",
          "Editar informacion general",
          "Agregar nuevas monedas",
          "Editar monedas",
          "Eliminar monedas",
          "Agregar nuevos centros de costos",
          "Editar centros de costos",
          "Eliminar centros de costos",
          "Activar o desactivar centros de costos",
          "Agregar nuevas retenciones",
          "Editar retenciones",
          "Eliminar retenciones",
          "Activar o desactivar retenciones",
          "Agregar nuevos impuestos",
          "Editar impuestos",
          "Eliminar impuestos",
          "Activar o desactivar impuestos",
          "Detalle de operaciones: ver listado",
          "Detalle de operaciones: ver detalles",
          "Detalle de operaciones: agregar",
          "Detalle de operaciones: editar",
          "Detalle de operaciones: eliminar",
          "Registrar depreciacion"
        ]
      }
    ]
  },
  {
    title: "POS",
    groups: [
      {
        title: "Operacion POS",
        permissions: [
          "Acceder al modulo Facturar",
          "Crear ventas desde POS",
          "Cambiar cliente en la factura",
          "Gestionar pagos en efectivo, transferencia y combinado",
          "Ver historial de ventas",
          "Anular ventas",
          "Imprimir factura"
        ]
      },
      {
        title: "Caja y control diario",
        permissions: [
          "Abrir caja",
          "Cerrar caja",
          "Registrar movimientos manuales",
          "Ver arqueos y diferencias",
          "Consultar resumen de caja"
        ]
      },
      {
        title: "Operacion de tienda",
        permissions: [
          "Ver productos y stock",
          "Crear productos",
          "Editar productos",
          "Archivar productos",
          "Ver clientes",
          "Crear clientes",
          "Editar clientes",
          "Ver compras y proveedores",
          "Gestionar corresponsal"
        ]
      }
    ]
  },
  {
    title: "Configuraciones generales",
    groups: [
      {
        title: "Usuarios y seguridad",
        permissions: [
          "Ver usuarios",
          "Crear usuarios",
          "Editar usuarios",
          "Activar o desactivar usuarios",
          "Ver roles y permisos",
          "Administrar el rol Administrador",
          "Puede agregar o eliminar usuarios"
        ]
      },
      {
        title: "Negocio y sistema",
        permissions: [
          "Editar configuracion general del negocio",
          "Editar informacion fiscal",
          "Configurar numeraciones",
          "Configurar impuestos",
          "Configurar listas de precios",
          "Configurar almacenes",
          "Sincronizar informacion"
        ]
      }
    ]
  }
];
const employeeSections = [
  {
    title: "POS",
    groups: [
      {
        title: "Operacion POS",
        permissions: [
          "Acceder al modulo Facturar",
          "Crear ventas desde POS",
          "Gestionar pago en efectivo",
          "Gestionar pago por transferencia",
          "Ver historial de ventas",
          "Imprimir factura"
        ]
      },
      {
        title: "Caja y tienda",
        permissions: [
          "Abrir caja",
          "Cerrar caja",
          "Ver resumen de caja",
          "Ver productos y stock",
          "Ver clientes",
          "Crear clientes"
        ]
      }
    ]
  },
  {
    title: "Configuraciones generales",
    groups: [
      {
        title: "Restricciones",
        permissions: [
          "Sin acceso a crear usuarios",
          "Sin acceso a editar roles",
          "Sin acceso a configuraciones fiscales",
          "Sin acceso a reportes financieros avanzados"
        ]
      }
    ]
  }
];
const ROLE_DEFINITIONS = [
  {
    key: "ADMIN",
    name: "Administrador",
    description: "Acceso completo a todas las secciones del sistema, puede agregar o eliminar usuarios y administrar la configuracion general.",
    sections: adminSections
  },
  {
    key: "EMPLOYEE",
    name: "Empleado",
    description: "Acceso operativo para ventas y caja, con permisos limitados sobre configuracion, usuarios y reportes sensibles.",
    sections: employeeSections
  }
];
function getRoleDefinition(role) {
  return ROLE_DEFINITIONS.find((entry) => entry.key === role) ?? ROLE_DEFINITIONS[0];
}
function slugify(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function buildPermissionKey(sectionTitle, groupTitle, label) {
  return [slugify(sectionTitle), slugify(groupTitle), slugify(label)].filter(Boolean).join(".");
}
function flattenRolePermissionCatalog(role) {
  return role.sections.flatMap(
    (section) => section.groups.flatMap(
      (group) => group.permissions.map((permission) => ({
        key: buildPermissionKey(section.title, group.title, permission),
        label: permission,
        sectionTitle: section.title,
        groupTitle: group.title
      }))
    )
  );
}
function getPermissionCatalogItem(roleKey, permissionKey) {
  return flattenRolePermissionCatalog(getRoleDefinition(roleKey)).find((item) => item.key === permissionKey) ?? null;
}
const APP_PERMISSION_KEYS = {
  posAccess: buildPermissionKey("POS", "Operacion POS", "Acceder al modulo Facturar"),
  salesCreate: buildPermissionKey("POS", "Operacion POS", "Crear ventas desde POS"),
  salesChangeCustomer: buildPermissionKey("POS", "Operacion POS", "Cambiar cliente en la factura"),
  salesManagePayments: buildPermissionKey("POS", "Operacion POS", "Gestionar pagos en efectivo, transferencia y combinado"),
  salesHistory: buildPermissionKey("POS", "Operacion POS", "Ver historial de ventas"),
  salesPrint: buildPermissionKey("POS", "Operacion POS", "Imprimir factura"),
  cashOpen: buildPermissionKey("POS", "Caja y control diario", "Abrir caja"),
  cashClose: buildPermissionKey("POS", "Caja y control diario", "Cerrar caja"),
  cashView: buildPermissionKey("POS", "Caja y control diario", "Consultar resumen de caja"),
  productsView: buildPermissionKey("Contabilidad", "Items, inventario y contactos", "Ver listado de items"),
  productsCreate: buildPermissionKey("Contabilidad", "Items, inventario y contactos", "Crear nuevos items de venta"),
  productsEdit: buildPermissionKey("Contabilidad", "Items, inventario y contactos", "Editar items"),
  productsDelete: buildPermissionKey("Contabilidad", "Items, inventario y contactos", "Eliminar items"),
  stockMovesView: buildPermissionKey("Contabilidad", "Items, inventario y contactos", "Ver listado de ajustes de inventario"),
  purchasesView: buildPermissionKey("Contabilidad", "Compras y proveedores", "Ver listado de facturas de proveedores"),
  purchasesDetails: buildPermissionKey("Contabilidad", "Compras y proveedores", "Ver detalles de facturas de proveedores"),
  purchasesCreate: buildPermissionKey("Contabilidad", "Compras y proveedores", "Crear nuevas facturas de proveedores"),
  suppliersView: buildPermissionKey("Contabilidad", "Items, inventario y contactos", "Ver listado de proveedores"),
  suppliersCreate: buildPermissionKey("Contabilidad", "Items, inventario y contactos", "Agregar nuevos contactos"),
  suppliersEdit: buildPermissionKey("Contabilidad", "Items, inventario y contactos", "Editar contactos"),
  usersView: buildPermissionKey("Configuraciones generales", "Usuarios y seguridad", "Ver usuarios"),
  usersCreate: buildPermissionKey("Configuraciones generales", "Usuarios y seguridad", "Crear usuarios"),
  usersEdit: buildPermissionKey("Configuraciones generales", "Usuarios y seguridad", "Editar usuarios"),
  rolesView: buildPermissionKey("Configuraciones generales", "Usuarios y seguridad", "Ver roles y permisos"),
  rolesManage: buildPermissionKey("Configuraciones generales", "Usuarios y seguridad", "Administrar el rol Administrador"),
  customersView: buildPermissionKey("Contabilidad", "Items, inventario y contactos", "Ver listado de clientes"),
  customersCreate: buildPermissionKey("Contabilidad", "Items, inventario y contactos", "Agregar nuevos contactos"),
  customersEdit: buildPermissionKey("Contabilidad", "Items, inventario y contactos", "Editar contactos"),
  correspondentView: buildPermissionKey("POS", "Operacion de tienda", "Gestionar corresponsal"),
  reportsView: buildPermissionKey("Contabilidad", "Reportes comerciales y financieros", "Ver reporte de ventas generales"),
  settingsView: buildPermissionKey("Configuraciones generales", "Negocio y sistema", "Editar configuracion general del negocio")
};
const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(80)
});
const createSubcategorySchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(2).max(80)
});
const deleteByIdSchema = z.object({
  id: z.string().uuid()
});
const documentTypeSchema = z.enum([
  "Cédula",
  "NIT",
  "Cédula de extranjería",
  "Pasaporte",
  "Tarjeta de identidad"
]);
const createCustomerSchema = z.object({
  internalCode: z.string().trim().max(30).optional().nullable(),
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().max(80).optional().default(""),
  documentType: documentTypeSchema.optional().default("Cédula"),
  documentNumber: z.string().trim().max(40).optional().nullable(),
  phone: z.string().trim().regex(/^\d{10}$/).optional().nullable(),
  email: z.string().trim().email().max(120).optional().nullable(),
  address: z.string().trim().max(180).optional().nullable(),
  isActive: z.boolean().optional().default(true)
});
const updateCustomerSchema = createCustomerSchema.extend({
  id: z.string().uuid()
});
const createSupplierSchema = z.object({
  internalCode: z.string().trim().max(30).optional().nullable(),
  name: z.string().trim().min(2).max(120),
  contactName: z.string().trim().max(120).optional().nullable(),
  documentType: documentTypeSchema.optional().default("NIT"),
  documentNumber: z.string().trim().max(40).optional().nullable(),
  phone: z.string().trim().regex(/^\d{10}$/).optional().nullable(),
  email: z.string().trim().email().max(120).optional().nullable(),
  address: z.string().trim().max(180).optional().nullable(),
  isActive: z.boolean().optional().default(true)
});
const updateSupplierSchema = createSupplierSchema.extend({
  id: z.string().uuid()
});
const createPurchaseSchema = z.object({
  supplierId: z.string().uuid(),
  purchasedAt: z.string().datetime().optional(),
  note: z.string().trim().max(300).optional().nullable(),
  markAsPaid: z.boolean().optional().default(false),
  paymentMedium: z.enum(["CASH", "TRANSFER", "CORRESPONDENT"]).optional().default("CASH"),
  paymentPlatformId: z.string().uuid().optional().nullable(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      qty: z.number().int().positive(),
      cost: z.number().positive(),
      taxRate: z.number().min(0).max(1).optional().default(0.19)
    })
  ).min(1)
});
const cashPlatformAmountSchema = z.object({
  platformId: z.string().uuid(),
  amount: z.number().min(0)
});
const openCashSessionSchema = z.object({
  openingCashAmount: z.number().min(0),
  openingTransferAmount: z.number().min(0).optional().default(0),
  note: z.string().trim().max(300).optional().nullable(),
  cashBreakdown: z.record(z.string(), z.number()).optional().default({}),
  correspondentBalances: z.array(cashPlatformAmountSchema).optional().default([])
});
const closeCashSessionSchema = z.object({
  sessionId: z.string().uuid(),
  countedCashAmount: z.number().min(0),
  countedTransferAmount: z.number().min(0).optional().default(0),
  note: z.string().trim().max(300).optional().nullable(),
  cashBreakdown: z.record(z.string(), z.number()).optional().default({}),
  correspondentBalances: z.array(cashPlatformAmountSchema).optional().default([])
});
const businessSettingsSchema = z.object({
  businessName: z.string().trim().max(120).optional().nullable(),
  taxId: z.string().trim().max(40).optional().nullable(),
  address: z.string().trim().max(180).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  invoicePrefix: z.string().trim().max(10).optional().nullable(),
  defaultTaxRate: z.number().min(0).max(1).optional(),
  allowNegativeStock: z.boolean().optional(),
  receiptFooter: z.string().trim().max(400).optional().nullable()
});
const salesListFilterSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  cashierId: z.string().uuid().optional(),
  status: z.nativeEnum(SaleStatus).optional(),
  search: z.string().trim().max(80).optional()
}).optional().default({});
const saleByIdSchema = z.object({
  saleId: z.string().uuid()
});
function money$1(value) {
  return Math.round(value);
}
const BUSINESS_CITY_SEPARATOR = "|||CITY|||";
function mergeBusinessAddress(address, city) {
  const normalizedAddress = (address == null ? void 0 : address.trim()) || "";
  const normalizedCity = (city == null ? void 0 : city.trim()) || "";
  if (!normalizedCity)
    return normalizedAddress || null;
  return `${normalizedAddress}${BUSINESS_CITY_SEPARATOR}${normalizedCity}`;
}
function splitBusinessAddress(rawAddress) {
  var _a, _b;
  if (!rawAddress)
    return { address: "", city: "" };
  const parts = rawAddress.split(BUSINESS_CITY_SEPARATOR);
  return {
    address: ((_a = parts[0]) == null ? void 0 : _a.trim()) || "",
    city: ((_b = parts[1]) == null ? void 0 : _b.trim()) || ""
  };
}
function calculateSalePrice(cost, marginPercent = 0, hasTax = false, taxRate = 0) {
  const basePrice = Number(cost || 0) * (1 + Number(marginPercent || 0) / 100);
  const total = hasTax ? basePrice * (1 + Number(taxRate || 0)) : basePrice;
  return money$1(total);
}
function paymentMethodLabel(value) {
  if (value === PaymentMethod.CARD)
    return "Transferencia";
  if (value === PaymentMethod.TRANSFER)
    return "Transferencia";
  return "Efectivo";
}
function paymentSummaryLabel(payments, fallback) {
  if (!payments || payments.length <= 1)
    return paymentMethodLabel(fallback);
  return payments.map((payment) => `${paymentMethodLabel(payment.method)} $${payment.amount.toLocaleString("es-CO")}`).join(" + ");
}
function buildInvoiceHtml(sale) {
  const rows = sale.items.map(
    (item) => `
        <tr>
          <td>${item.name}</td>
          <td style="text-align:center">${item.qty}</td>
          <td style="text-align:right">$${item.price.toLocaleString("es-CO")}</td>
          <td style="text-align:right">$${item.lineTotal.toLocaleString("es-CO")}</td>
        </tr>
      `
  ).join("");
  const businessAddress = [sale.address, sale.city].filter(Boolean).join(" - ");
  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${sale.invoiceNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; margin: 24px; }
          h1, h2, p { margin: 0; }
          .header { margin-bottom: 16px; }
          .meta { margin-top: 10px; font-size: 12px; color: #4b5563; line-height: 1.6; }
          table { width: 100%; border-collapse: collapse; margin-top: 18px; }
          th, td { border-bottom: 1px solid #e5e7eb; padding: 8px 4px; font-size: 12px; }
          th { text-transform: uppercase; color: #6b7280; font-size: 11px; }
          .totals { margin-top: 18px; width: 260px; margin-left: auto; }
          .totals-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px; }
          .totals-row.total { border-top: 1px solid #d1d5db; padding-top: 8px; font-weight: 700; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${sale.businessName || "Factura de venta"}</h1>
          <div class="meta">
            ${sale.taxId ? `<div>NIT: ${sale.taxId}</div>` : ""}
            ${businessAddress ? `<div>Dirección: ${businessAddress}</div>` : ""}
            <div>Factura: ${sale.invoiceNumber}</div>
            <div>Fecha: ${sale.createdAt.toLocaleString("es-CO")}</div>
            <div>Cliente: ${sale.customer}</div>
            <div>Cajero: ${sale.cashier.name ?? sale.cashier.username}</div>
            <div>Pago: ${sale.paymentSummary}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="text-align:left">Producto</th>
              <th>Cant.</th>
              <th style="text-align:right">Precio</th>
              <th style="text-align:right">Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="totals">
          <div class="totals-row"><span>Subtotal</span><strong>$${sale.subtotal.toLocaleString("es-CO")}</strong></div>
          <div class="totals-row"><span>IVA</span><strong>$${sale.tax.toLocaleString("es-CO")}</strong></div>
          <div class="totals-row total"><span>Total</span><strong>$${sale.total.toLocaleString("es-CO")}</strong></div>
        </div>
        ${sale.receiptFooter ? `<p style="margin-top: 20px; font-size: 12px; color: #4b5563;">${sale.receiptFooter}</p>` : ""}
      </body>
    </html>
  `;
}
async function ensureAdminSession(getCurrentSessionUser) {
  const currentSessionUser2 = getCurrentSessionUser();
  if (!currentSessionUser2 || currentSessionUser2.role !== Role.ADMIN) {
    throw new Error("Solo admins pueden ejecutar esta accion");
  }
  return currentSessionUser2;
}
function hasSessionPermission(currentSessionUser2, permissionKey) {
  var _a;
  if (!permissionKey)
    return true;
  return Boolean((_a = currentSessionUser2 == null ? void 0 : currentSessionUser2.permissions) == null ? void 0 : _a.includes(permissionKey));
}
function actorLabel(currentSessionUser2) {
  var _a;
  return ((_a = currentSessionUser2 == null ? void 0 : currentSessionUser2.name) == null ? void 0 : _a.trim()) || (currentSessionUser2 == null ? void 0 : currentSessionUser2.username) || "Sistema";
}
function buildFullName(firstName, lastName) {
  return [firstName.trim(), (lastName == null ? void 0 : lastName.trim()) || ""].filter(Boolean).join(" ");
}
function buildDocumentValue(documentType, documentNumber) {
  const normalizedNumber = documentNumber == null ? void 0 : documentNumber.trim();
  if (!normalizedNumber)
    return null;
  return `${documentType || "Cédula"}: ${normalizedNumber}`;
}
async function getAuditUserMap(prisma2, entity, entityIds, action, newestFirst = false) {
  var _a, _b, _c;
  if (entityIds.length === 0) {
    return /* @__PURE__ */ new Map();
  }
  const logs = await prisma2.auditLog.findMany({
    where: {
      entity,
      action,
      entityId: { in: entityIds }
    },
    include: {
      user: {
        select: {
          name: true,
          username: true
        }
      }
    },
    orderBy: { createdAt: newestFirst ? "desc" : "asc" }
  });
  const result = /* @__PURE__ */ new Map();
  for (const log of logs) {
    if (!log.entityId || result.has(log.entityId))
      continue;
    result.set(log.entityId, ((_b = (_a = log.user) == null ? void 0 : _a.name) == null ? void 0 : _b.trim()) || ((_c = log.user) == null ? void 0 : _c.username) || "Sistema");
  }
  return result;
}
function parseSessionMeta(note) {
  if (!note)
    return {};
  try {
    return JSON.parse(note);
  } catch {
    return {};
  }
}
function stringifySessionMeta(meta) {
  return JSON.stringify(meta);
}
function toAmountMap(items) {
  return new Map((items ?? []).map((item) => [item.platformId, Number(item.amount || 0)]));
}
function normalizeTreasuryMedium(value) {
  if (value === "TRANSFER" || value === "CORRESPONDENT")
    return value;
  return "CASH";
}
function parseTreasuryMovementMeta(note) {
  if (!note)
    return null;
  try {
    const parsed = JSON.parse(note);
    if (!parsed || typeof parsed !== "object")
      return null;
    if (!parsed.medium && !parsed.label && !parsed.sourceType)
      return null;
    return {
      ...parsed,
      medium: normalizeTreasuryMedium(parsed.medium)
    };
  } catch {
    return null;
  }
}
function buildTreasuryMovementNote(meta) {
  return JSON.stringify(meta);
}
function resolveMovementLabel(note, fallback = "Movimiento de caja") {
  const meta = parseTreasuryMovementMeta(note);
  return (meta == null ? void 0 : meta.label) || (meta == null ? void 0 : meta.userNote) || note || fallback;
}
function resolveMovementMedium(note) {
  var _a;
  return ((_a = parseTreasuryMovementMeta(note)) == null ? void 0 : _a.medium) ?? "CASH";
}
function resolveMovementPlatformId(note) {
  var _a;
  return ((_a = parseTreasuryMovementMeta(note)) == null ? void 0 : _a.platformId) ?? null;
}
function resolveMovementPlatformName(note) {
  var _a;
  return ((_a = parseTreasuryMovementMeta(note)) == null ? void 0 : _a.platformName) ?? null;
}
function buildDateRangeFilter(dateFrom, dateTo) {
  return dateFrom || dateTo ? {
    ...dateFrom ? { gte: new Date(dateFrom) } : {},
    ...dateTo ? { lte: new Date(dateTo) } : {}
  } : void 0;
}
function getSessionSection(meta, key) {
  const raw = meta[key];
  return raw && typeof raw === "object" ? raw : {};
}
function getSectionTransferAmount(section) {
  return Number(section.transferAmount ?? 0);
}
function buildSalePaymentTotals(sales) {
  return sales.reduce(
    (acc, sale) => {
      if (sale.payments && sale.payments.length > 0) {
        for (const payment of sale.payments) {
          if (payment.method === PaymentMethod.CASH)
            acc.cash += payment.amount;
          if (payment.method === PaymentMethod.TRANSFER || payment.method === PaymentMethod.CARD) {
            acc.transfer += payment.amount;
          }
        }
        return acc;
      }
      if (sale.paymentMethod === PaymentMethod.CASH) {
        acc.cash += sale.total;
      } else {
        acc.transfer += sale.total;
      }
      return acc;
    },
    { cash: 0, transfer: 0 }
  );
}
function buildCorrespondentMovementMap(movements) {
  const map = /* @__PURE__ */ new Map();
  for (const move of movements) {
    const medium = resolveMovementMedium(move.note);
    if (medium !== "CORRESPONDENT")
      continue;
    const platformId = resolveMovementPlatformId(move.note);
    if (!platformId)
      continue;
    const current = map.get(platformId) ?? { manualIncome: 0, manualExpense: 0, platformName: resolveMovementPlatformName(move.note) };
    if (move.type === CashMovementType.INCOME_IN)
      current.manualIncome += move.amount;
    if (move.type === CashMovementType.EXPENSE_OUT || move.type === CashMovementType.WITHDRAWAL_OUT) {
      current.manualExpense += move.amount;
    }
    if (!current.platformName)
      current.platformName = resolveMovementPlatformName(move.note);
    map.set(platformId, current);
  }
  return map;
}
function buildSessionTreasurySnapshot(params) {
  const sessionMeta = parseSessionMeta(params.session.note);
  const opening = getSessionSection(sessionMeta, "opening");
  const closing = getSessionSection(sessionMeta, "closing");
  const openingCorrespondent = toAmountMap(
    opening.correspondentBalances ?? []
  );
  const closingCorrespondent = toAmountMap(
    closing.correspondentBalances ?? []
  );
  const openingTransferAmount = getSectionTransferAmount(opening);
  const countedTransferAmount = closing.transferAmount === void 0 ? null : getSectionTransferAmount(closing);
  const saleTotals = buildSalePaymentTotals(params.session.sales);
  const cashManualIncome = params.session.movements.filter((move) => move.type === CashMovementType.INCOME_IN && resolveMovementMedium(move.note) === "CASH").reduce((sum, move) => sum + move.amount, 0);
  const transferManualIncome = params.session.movements.filter((move) => move.type === CashMovementType.INCOME_IN && resolveMovementMedium(move.note) === "TRANSFER").reduce((sum, move) => sum + move.amount, 0);
  const cashManualExpense = params.session.movements.filter(
    (move) => (move.type === CashMovementType.EXPENSE_OUT || move.type === CashMovementType.WITHDRAWAL_OUT) && resolveMovementMedium(move.note) === "CASH"
  ).reduce((sum, move) => sum + move.amount, 0);
  const transferManualExpense = params.session.movements.filter(
    (move) => (move.type === CashMovementType.EXPENSE_OUT || move.type === CashMovementType.WITHDRAWAL_OUT) && resolveMovementMedium(move.note) === "TRANSFER"
  ).reduce((sum, move) => sum + move.amount, 0);
  const correspondentManualMap = buildCorrespondentMovementMap(params.session.movements);
  const expectedCash = params.session.openingAmount + saleTotals.cash + cashManualIncome - cashManualExpense;
  const expectedTransferAmount = openingTransferAmount + saleTotals.transfer + transferManualIncome - transferManualExpense;
  const correspondentByPlatform = params.platforms.map((platform) => {
    const platformTransactions = params.session.correspondentTransactions.filter(
      (transaction) => transaction.platform.id === platform.id
    );
    const totalIn = platformTransactions.filter((transaction) => transaction.type.direction === CorrespondentDirection.IN).reduce((sum, transaction) => sum + transaction.amount, 0);
    const totalOut = platformTransactions.filter((transaction) => transaction.type.direction === CorrespondentDirection.OUT).reduce((sum, transaction) => sum + transaction.amount, 0);
    const totalCommission = platformTransactions.reduce((sum, transaction) => sum + transaction.commissionAmount, 0);
    const manualAdjustments = correspondentManualMap.get(platform.id) ?? {
      manualIncome: 0,
      manualExpense: 0,
      platformName: platform.name
    };
    const openingAmount = openingCorrespondent.get(platform.id) ?? 0;
    const expectedAmount = openingAmount + totalIn - totalOut + totalCommission + manualAdjustments.manualIncome - manualAdjustments.manualExpense;
    const countedAmount = closingCorrespondent.has(platform.id) ? closingCorrespondent.get(platform.id) ?? 0 : null;
    return {
      platformId: platform.id,
      platform: platform.name,
      openingAmount,
      totalIn,
      totalOut,
      totalCommission,
      manualIncome: manualAdjustments.manualIncome,
      manualExpense: manualAdjustments.manualExpense,
      expectedAmount,
      countedAmount,
      differenceAmount: countedAmount === null ? null : countedAmount - expectedAmount
    };
  });
  const openingCorrespondentTotal = correspondentByPlatform.reduce((sum, item) => sum + item.openingAmount, 0);
  const correspondentExpectedTotal = correspondentByPlatform.reduce((sum, item) => sum + item.expectedAmount, 0);
  const countedCorrespondentTotal = correspondentByPlatform.reduce(
    (sum, item) => sum + (item.countedAmount ?? item.expectedAmount),
    0
  );
  const countedCashAmount = closing.cashBreakdown && typeof closing.cashBreakdown === "object" ? null : params.session.countedAmount ?? null;
  const expectedAvailableTotal = expectedCash + expectedTransferAmount + correspondentExpectedTotal;
  const countedAvailableTotal = (params.session.countedAmount ?? expectedCash) + (countedTransferAmount ?? expectedTransferAmount) + countedCorrespondentTotal;
  return {
    sessionMeta,
    opening,
    closing,
    openingTransferAmount,
    countedTransferAmount,
    salesCash: saleTotals.cash,
    salesTransfer: saleTotals.transfer,
    cashManualIncome,
    transferManualIncome,
    cashManualExpense,
    transferManualExpense,
    expectedCash,
    expectedTransferAmount,
    openingCorrespondentTotal,
    correspondentExpectedTotal,
    countedCorrespondentTotal,
    correspondentByPlatform,
    expectedAvailableTotal,
    countedAvailableTotal,
    countedCashAmount
  };
}
function startOfToday() {
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}
function deriveCreditStatus(balance, total, dueDate) {
  if (total <= 0)
    return CreditStatus.CANCELLED;
  if (balance <= 0)
    return CreditStatus.PAID;
  if (dueDate && dueDate.getTime() < startOfToday().getTime())
    return CreditStatus.OVERDUE;
  if (balance < total)
    return CreditStatus.PARTIAL;
  return CreditStatus.PENDING;
}
function mapSaleStatusFromReturns(total, returnedTotal) {
  if (returnedTotal >= total)
    return SaleStatus.RETURNED;
  if (returnedTotal > 0)
    return SaleStatus.PARTIALLY_RETURNED;
  return SaleStatus.COMPLETED;
}
async function ensureBackofficeSchemaIfNeeded(prismaClient) {
  const customerColumns = await prismaClient.$queryRawUnsafe(`PRAGMA table_info("Customer");`);
  const supplierColumns = await prismaClient.$queryRawUnsafe(`PRAGMA table_info("Supplier");`);
  const customerColumnSet = new Set(customerColumns.map((column) => column.name));
  const supplierColumnSet = new Set(supplierColumns.map((column) => column.name));
  if (!customerColumnSet.has("internalCode")) {
    await prismaClient.$executeRawUnsafe(`ALTER TABLE "Customer" ADD COLUMN "internalCode" TEXT;`);
  }
  if (!supplierColumnSet.has("internalCode")) {
    await prismaClient.$executeRawUnsafe(`ALTER TABLE "Supplier" ADD COLUMN "internalCode" TEXT;`);
  }
  const customers = await prismaClient.customer.findMany({
    select: {
      id: true,
      internalCode: true
    },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }]
  });
  const assignedCustomerCodes = [];
  for (const customer of customers) {
    const internalCode = resolveManagedCode({
      desiredCode: customer.internalCode,
      existingCodes: assignedCustomerCodes,
      prefix: "CLI",
      digits: 4,
      maxLength: 30
    });
    if (internalCode !== customer.internalCode) {
      await prismaClient.customer.update({
        where: { id: customer.id },
        data: { internalCode }
      });
    }
    assignedCustomerCodes.push(internalCode);
  }
  const suppliers = await prismaClient.supplier.findMany({
    select: {
      id: true,
      internalCode: true
    },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }]
  });
  const assignedSupplierCodes = [];
  for (const supplier of suppliers) {
    const internalCode = resolveManagedCode({
      desiredCode: supplier.internalCode,
      existingCodes: assignedSupplierCodes,
      prefix: "PRV",
      digits: 4,
      maxLength: 30
    });
    if (internalCode !== supplier.internalCode) {
      await prismaClient.supplier.update({
        where: { id: supplier.id },
        data: { internalCode }
      });
    }
    assignedSupplierCodes.push(internalCode);
  }
  await prismaClient.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Customer_internalCode_key" ON "Customer"("internalCode");`
  );
  await prismaClient.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Supplier_internalCode_key" ON "Supplier"("internalCode");`
  );
}
function getSkuPrefix(name, categoryName) {
  const source = (categoryName || name || "PRD").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return (source.slice(0, 3) || "PRD").padEnd(3, "X");
}
async function generateSku(prisma2, name, categoryName) {
  const prefix = getSkuPrefix(name, categoryName);
  const count = await prisma2.product.count({
    where: { sku: { startsWith: prefix } }
  });
  return `${prefix}-${String(count + 1).padStart(3, "0")}`;
}
async function generatePurchaseNumber(prisma2) {
  const count = await prisma2.purchase.count();
  return `CP-${String(count + 1).padStart(6, "0")}`;
}
async function logAudit(prisma2, currentSessionUser2, module, action, entity, entityId, beforeJson, afterJson) {
  await prisma2.auditLog.create({
    data: {
      userId: (currentSessionUser2 == null ? void 0 : currentSessionUser2.id) ?? null,
      module,
      action,
      entity,
      entityId: entityId ?? null,
      beforeJson: beforeJson === void 0 ? null : JSON.stringify(beforeJson),
      afterJson: afterJson === void 0 ? null : JSON.stringify(afterJson)
    }
  });
}
function registerBackofficeIpcHandlers({
  ipcMain: ipcMain2,
  prisma: prisma2,
  getCurrentSessionUser,
  getConnectedAt
}) {
  ipcMain2.handle("app:status", async () => ({
    success: true,
    connectedAt: getConnectedAt().toISOString(),
    now: (/* @__PURE__ */ new Date()).toISOString()
  }));
  ipcMain2.handle("settings:get", async () => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion" };
    const settings = await prisma2.businessSettings.findUnique({
      where: { id: "default" }
    });
    const addressParts = splitBusinessAddress(settings == null ? void 0 : settings.address);
    return {
      success: true,
      settings: {
        businessName: (settings == null ? void 0 : settings.businessName) || "",
        taxId: (settings == null ? void 0 : settings.taxId) || "",
        address: addressParts.address,
        city: addressParts.city,
        invoicePrefix: (settings == null ? void 0 : settings.invoicePrefix) || "FV",
        defaultTaxRate: (settings == null ? void 0 : settings.defaultTaxRate) ?? 0.19,
        allowNegativeStock: (settings == null ? void 0 : settings.allowNegativeStock) ?? false,
        receiptFooter: (settings == null ? void 0 : settings.receiptFooter) || ""
      }
    };
  });
  ipcMain2.handle("settings:update", async (_event, payload) => {
    const currentSessionUser2 = await ensureAdminSession(getCurrentSessionUser);
    if (!hasSessionPermission(currentSessionUser2, APP_PERMISSION_KEYS.settingsView)) {
      return { success: false, message: "Tu rol no puede editar la configuracion general" };
    }
    const parsed = businessSettingsSchema.safeParse(payload);
    if (!parsed.success)
      return { success: false, message: "Configuracion invalida" };
    const data = parsed.data;
    await prisma2.businessSettings.upsert({
      where: { id: "default" },
      update: {
        businessName: data.businessName || null,
        taxId: data.taxId || null,
        address: mergeBusinessAddress(data.address, data.city),
        invoicePrefix: data.invoicePrefix || "FV",
        defaultTaxRate: data.defaultTaxRate ?? 0.19,
        allowNegativeStock: data.allowNegativeStock ?? false,
        receiptFooter: data.receiptFooter || null
      },
      create: {
        id: "default",
        businessName: data.businessName || null,
        taxId: data.taxId || null,
        address: mergeBusinessAddress(data.address, data.city),
        invoicePrefix: data.invoicePrefix || "FV",
        defaultTaxRate: data.defaultTaxRate ?? 0.19,
        allowNegativeStock: data.allowNegativeStock ?? false,
        receiptFooter: data.receiptFooter || null
      }
    });
    await logAudit(prisma2, currentSessionUser2, "settings", "update", "BusinessSettings", "default", void 0, data);
    return { success: true };
  });
  ipcMain2.handle("cash:summary", async () => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion" };
    const [activeSession, previousClosedSession, recentSessions, platforms] = await Promise.all([
      prisma2.cashSession.findFirst({
        where: { status: CashSessionStatus.OPEN },
        include: {
          register: true,
          user: { select: { username: true, name: true } },
          sales: {
            select: {
              id: true,
              invoiceNumber: true,
              customer: true,
              total: true,
              paymentMethod: true,
              createdAt: true,
              payments: {
                select: {
                  method: true,
                  amount: true
                }
              }
            },
            orderBy: { createdAt: "desc" }
          },
          movements: {
            orderBy: { createdAt: "desc" }
          },
          correspondentTransactions: {
            where: { status: "REGISTERED" },
            include: {
              platform: { select: { id: true, name: true } },
              type: { select: { name: true, direction: true } }
            },
            orderBy: { performedAt: "desc" }
          }
        },
        orderBy: { openedAt: "desc" }
      }),
      prisma2.cashSession.findFirst({
        where: { status: CashSessionStatus.CLOSED },
        include: {
          register: true,
          user: { select: { username: true, name: true } }
        },
        orderBy: { closedAt: "desc" }
      }),
      prisma2.cashSession.findMany({
        include: {
          register: true,
          user: { select: { username: true, name: true } }
        },
        orderBy: { openedAt: "desc" },
        take: 20
      }),
      prisma2.correspondentPlatform.findMany({
        orderBy: { name: "asc" }
      })
    ]);
    const previousReference = previousClosedSession ? (() => {
      var _a;
      const previousMeta = parseSessionMeta(previousClosedSession.note);
      const previousClosing = getSessionSection(previousMeta, "closing");
      const previousCorrespondentMap = toAmountMap(
        previousClosing.correspondentBalances ?? []
      );
      const closingRows = platforms.map((platform) => ({
        platformId: platform.id,
        platform: platform.name,
        countedAmount: previousCorrespondentMap.get(platform.id) ?? 0
      })).filter((item) => item.countedAmount > 0);
      const countedTransferAmount2 = getSectionTransferAmount(previousClosing);
      return {
        sessionId: previousClosedSession.id,
        registerName: previousClosedSession.register.name,
        user: previousClosedSession.user.name ?? previousClosedSession.user.username,
        closedAt: ((_a = previousClosedSession.closedAt) == null ? void 0 : _a.toISOString()) ?? null,
        countedCashAmount: previousClosedSession.countedAmount ?? 0,
        countedTransferAmount: countedTransferAmount2,
        countedAvailableAmount: (previousClosedSession.countedAmount ?? 0) + countedTransferAmount2 + closingRows.reduce((sum, item) => sum + item.countedAmount, 0),
        closingBreakdown: previousClosing.cashBreakdown && typeof previousClosing.cashBreakdown === "object" ? previousClosing.cashBreakdown : {},
        correspondent: closingRows
      };
    })() : null;
    if (!activeSession) {
      return {
        success: true,
        activeSession: null,
        previousReference,
        recentSessions: recentSessions.map((session) => {
          var _a;
          return {
            id: session.id,
            registerName: session.register.name,
            user: session.user.name ?? session.user.username,
            status: session.status,
            openedAt: session.openedAt.toISOString(),
            closedAt: ((_a = session.closedAt) == null ? void 0 : _a.toISOString()) ?? null,
            openingAmount: session.openingAmount,
            openingAvailableAmount: session.openingAmount + getSectionTransferAmount(getSessionSection(parseSessionMeta(session.note), "opening")) + (getSessionSection(parseSessionMeta(session.note), "opening").correspondentBalances ?? []).reduce((sum, item) => sum + Number(item.amount || 0), 0),
            countedAmount: session.countedAmount,
            countedAvailableAmount: (session.countedAmount ?? 0) + getSectionTransferAmount(getSessionSection(parseSessionMeta(session.note), "closing")) + (getSessionSection(parseSessionMeta(session.note), "closing").correspondentBalances ?? []).reduce((sum, item) => sum + Number(item.amount || 0), 0),
            differenceAmount: session.differenceAmount
          };
        })
      };
    }
    const treasury = buildSessionTreasurySnapshot({
      session: activeSession,
      platforms
    });
    const openingAvailableAmount = activeSession.openingAmount + treasury.openingTransferAmount + treasury.openingCorrespondentTotal;
    const countedCashAmount = activeSession.countedAmount ?? treasury.expectedCash;
    const countedTransferAmount = treasury.countedTransferAmount ?? treasury.expectedTransferAmount;
    const openingComparison = previousReference ? {
      cashDifferenceAmount: activeSession.openingAmount - previousReference.countedCashAmount,
      transferDifferenceAmount: treasury.openingTransferAmount - previousReference.countedTransferAmount,
      correspondentDifferenceTotal: treasury.correspondentByPlatform.reduce((sum, item) => {
        var _a;
        const previousAmount = ((_a = previousReference.correspondent.find((previous) => previous.platformId === item.platformId)) == null ? void 0 : _a.countedAmount) ?? 0;
        return sum + (item.openingAmount - previousAmount);
      }, 0),
      differenceAmount: openingAvailableAmount - previousReference.countedAvailableAmount
    } : null;
    return {
      success: true,
      activeSession: {
        id: activeSession.id,
        registerName: activeSession.register.name,
        user: activeSession.user.name ?? activeSession.user.username,
        openedAt: activeSession.openedAt.toISOString(),
        openingAmount: activeSession.openingAmount,
        openingTransferAmount: treasury.openingTransferAmount,
        openingAvailableAmount,
        expectedCash: treasury.expectedCash,
        expectedTransferAmount: treasury.expectedTransferAmount,
        expectedAvailableAmount: treasury.expectedAvailableTotal,
        countedCashAmount,
        countedTransferAmount,
        countedAvailableAmount: countedCashAmount + countedTransferAmount + treasury.correspondentByPlatform.reduce(
          (sum, item) => sum + (item.countedAmount ?? item.expectedAmount),
          0
        ),
        cashDifferenceAmount: countedCashAmount - treasury.expectedCash,
        transferDifferenceAmount: countedTransferAmount - treasury.expectedTransferAmount,
        availableDifferenceAmount: countedCashAmount + countedTransferAmount + treasury.correspondentByPlatform.reduce(
          (sum, item) => sum + (item.countedAmount ?? item.expectedAmount),
          0
        ) - treasury.expectedAvailableTotal,
        salesCash: treasury.salesCash,
        salesCard: 0,
        salesTransfer: treasury.salesTransfer,
        manualIncome: treasury.cashManualIncome,
        manualExpense: treasury.cashManualExpense,
        manualTransferIncome: treasury.transferManualIncome,
        manualTransferExpense: treasury.transferManualExpense,
        openingBreakdown: treasury.opening.cashBreakdown && typeof treasury.opening.cashBreakdown === "object" ? treasury.opening.cashBreakdown : {},
        closingBreakdown: treasury.closing.cashBreakdown && typeof treasury.closing.cashBreakdown === "object" ? treasury.closing.cashBreakdown : {},
        correspondent: treasury.correspondentByPlatform,
        openingComparison,
        recentActivity: [
          ...activeSession.sales.flatMap(
            (sale) => (sale.payments && sale.payments.length > 0 ? sale.payments : [
              {
                method: sale.paymentMethod,
                amount: sale.total
              }
            ]).map((payment, index) => ({
              id: `${sale.id}-${payment.method}-${index}`,
              createdAt: sale.createdAt.toISOString(),
              type: "Venta",
              medium: payment.method === PaymentMethod.CASH ? "Efectivo" : payment.method === PaymentMethod.CARD ? "Transferencia" : "Transferencia",
              detail: `${sale.invoiceNumber} - ${sale.customer}`,
              amount: payment.amount,
              signedAmount: payment.amount
            }))
          ),
          ...activeSession.correspondentTransactions.map((transaction) => ({
            id: transaction.id,
            createdAt: transaction.performedAt.toISOString(),
            type: "Corresponsal",
            medium: transaction.platform.name,
            detail: `${transaction.type.name}${transaction.commissionAmount > 0 ? ` + comision ${transaction.commissionAmount.toLocaleString("es-CO")}` : ""}`,
            amount: transaction.amount,
            signedAmount: transaction.type.direction === CorrespondentDirection.OUT ? -transaction.amount : transaction.amount
          })),
          ...activeSession.movements.map((move) => ({
            id: move.id,
            createdAt: move.createdAt.toISOString(),
            type: move.type,
            medium: resolveMovementMedium(move.note) === "TRANSFER" ? "Transferencias" : resolveMovementMedium(move.note) === "CORRESPONDENT" ? resolveMovementPlatformName(move.note) || "Corresponsal" : "Efectivo",
            detail: resolveMovementLabel(move.note),
            amount: move.amount,
            signedAmount: move.type === CashMovementType.EXPENSE_OUT || move.type === CashMovementType.WITHDRAWAL_OUT ? -move.amount : move.amount
          }))
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 30)
      },
      previousReference,
      recentSessions: recentSessions.map((session) => {
        var _a;
        return {
          id: session.id,
          registerName: session.register.name,
          user: session.user.name ?? session.user.username,
          status: session.status,
          openedAt: session.openedAt.toISOString(),
          closedAt: ((_a = session.closedAt) == null ? void 0 : _a.toISOString()) ?? null,
          openingAmount: session.openingAmount,
          openingAvailableAmount: session.openingAmount + getSectionTransferAmount(getSessionSection(parseSessionMeta(session.note), "opening")) + (getSessionSection(parseSessionMeta(session.note), "opening").correspondentBalances ?? []).reduce((sum, item) => sum + Number(item.amount || 0), 0),
          countedAmount: session.countedAmount,
          countedAvailableAmount: (session.countedAmount ?? 0) + getSectionTransferAmount(getSessionSection(parseSessionMeta(session.note), "closing")) + (getSessionSection(parseSessionMeta(session.note), "closing").correspondentBalances ?? []).reduce((sum, item) => sum + Number(item.amount || 0), 0),
          differenceAmount: session.differenceAmount
        };
      })
    };
  });
  ipcMain2.handle("cash:open", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser2, APP_PERMISSION_KEYS.cashOpen)) {
      return { success: false, message: "Tu rol no puede abrir caja" };
    }
    const parsed = openCashSessionSchema.safeParse(payload);
    if (!parsed.success)
      return { success: false, message: "Datos invalidos para apertura de caja" };
    const existing = await prisma2.cashSession.findFirst({
      where: { status: CashSessionStatus.OPEN }
    });
    if (existing)
      return { success: false, message: "Ya existe una caja abierta" };
    const register = await prisma2.cashRegister.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" }
    });
    if (!register)
      return { success: false, message: "No hay caja activa configurada" };
    const openingAvailableAmount = parsed.data.openingCashAmount + parsed.data.openingTransferAmount + parsed.data.correspondentBalances.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const meta = stringifySessionMeta({
      opening: {
        cashBreakdown: parsed.data.cashBreakdown,
        transferAmount: parsed.data.openingTransferAmount,
        correspondentBalances: parsed.data.correspondentBalances,
        note: parsed.data.note || null
      }
    });
    const session = await prisma2.cashSession.create({
      data: {
        registerId: register.id,
        userId: currentSessionUser2.id,
        status: CashSessionStatus.OPEN,
        openingAmount: parsed.data.openingCashAmount,
        expectedAmount: openingAvailableAmount,
        note: meta
      }
    });
    await prisma2.cashMovement.create({
      data: {
        sessionId: session.id,
        type: CashMovementType.OPENING,
        amount: parsed.data.openingCashAmount,
        note: parsed.data.note || "Apertura de caja"
      }
    });
    return { success: true, sessionId: session.id };
  });
  ipcMain2.handle("cash:close", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser2, APP_PERMISSION_KEYS.cashClose)) {
      return { success: false, message: "Tu rol no puede cerrar caja" };
    }
    const parsed = closeCashSessionSchema.safeParse(payload);
    if (!parsed.success)
      return { success: false, message: "Datos invalidos para cierre de caja" };
    const session = await prisma2.cashSession.findUnique({
      where: { id: parsed.data.sessionId },
      include: {
        sales: {
          include: {
            payments: {
              select: {
                method: true,
                amount: true
              }
            }
          }
        },
        movements: true,
        correspondentTransactions: {
          where: { status: "REGISTERED" },
          include: {
            platform: { select: { id: true, name: true } },
            type: { select: { name: true, direction: true } }
          }
        }
      }
    });
    if (!session || session.status !== CashSessionStatus.OPEN) {
      return { success: false, message: "La caja seleccionada no está abierta" };
    }
    const platforms = await prisma2.correspondentPlatform.findMany({
      orderBy: { name: "asc" }
    });
    const treasury = buildSessionTreasurySnapshot({
      session,
      platforms
    });
    const expectedCash = treasury.expectedCash;
    const cashDifferenceAmount = parsed.data.countedCashAmount - expectedCash;
    const countedCorrespondentTotal = treasury.correspondentByPlatform.reduce((sum, item) => {
      var _a;
      const counted = (_a = parsed.data.correspondentBalances.find((entry) => entry.platformId === item.platformId)) == null ? void 0 : _a.amount;
      return sum + Number(counted ?? item.expectedAmount);
    }, 0);
    const expectedAvailableAmount = expectedCash + treasury.expectedTransferAmount + treasury.correspondentExpectedTotal;
    const countedAvailableAmount = parsed.data.countedCashAmount + parsed.data.countedTransferAmount + countedCorrespondentTotal;
    const differenceAmount = countedAvailableAmount - expectedAvailableAmount;
    const previousMeta = parseSessionMeta(session.note);
    const updatedMeta = stringifySessionMeta({
      ...previousMeta,
      closing: {
        cashBreakdown: parsed.data.cashBreakdown,
        transferAmount: parsed.data.countedTransferAmount,
        correspondentBalances: parsed.data.correspondentBalances,
        note: parsed.data.note || null
      }
    });
    await prisma2.$transaction(async (tx) => {
      await tx.cashSession.update({
        where: { id: session.id },
        data: {
          status: CashSessionStatus.CLOSED,
          countedAmount: parsed.data.countedCashAmount,
          expectedAmount: expectedAvailableAmount,
          differenceAmount,
          note: updatedMeta,
          closedAt: /* @__PURE__ */ new Date()
        }
      });
      await tx.cashMovement.create({
        data: {
          sessionId: session.id,
          type: CashMovementType.CLOSING,
          amount: parsed.data.countedCashAmount,
          note: parsed.data.note || "Cierre de caja"
        }
      });
      if (differenceAmount !== 0) {
        await tx.cashMovement.create({
          data: {
            sessionId: session.id,
            type: CashMovementType.DIFFERENCE,
            amount: differenceAmount,
            note: buildTreasuryMovementNote({
              label: `Diferencia general de cierre (${cashDifferenceAmount >= 0 ? "POS" : "negativa"} en efectivo: ${cashDifferenceAmount.toLocaleString("es-CO")})`,
              medium: "CASH",
              sourceType: "MANUAL"
            })
          }
        });
      }
    });
    return { success: true };
  });
  ipcMain2.handle("users:list", async () => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion", users: [] };
    const users = await prisma2.user.findMany({
      orderBy: [{ role: "asc" }, { username: "asc" }],
      include: {
        roleProfile: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            sales: true,
            cashSessions: true
          }
        }
      }
    });
    return {
      success: true,
      users: users.map((user) => {
        var _a, _b, _c;
        return {
          id: user.id,
          internalCode: user.internalCode,
          name: user.name,
          firstName: user.firstName ?? user.name,
          lastName: user.lastName,
          username: user.username,
          documentNumber: user.documentNumber,
          email: user.email,
          phone: user.phone,
          address: user.address,
          birthDate: ((_a = user.birthDate) == null ? void 0 : _a.toISOString().slice(0, 10)) ?? null,
          role: user.role,
          roleProfileId: ((_b = user.roleProfile) == null ? void 0 : _b.id) ?? null,
          roleProfileName: ((_c = user.roleProfile) == null ? void 0 : _c.name) ?? null,
          isActive: user.isActive,
          createdAt: user.createdAt.toISOString(),
          salesCount: user._count.sales,
          sessionsCount: user._count.cashSessions
        };
      })
    };
  });
  ipcMain2.handle("products:categories:list", async () => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2) {
      return { success: false, message: "Debes iniciar sesion", categories: [] };
    }
    const categories = await prisma2.productCategory.findMany({
      orderBy: { name: "asc" },
      include: {
        subcategories: {
          where: { isActive: true },
          orderBy: { name: "asc" }
        }
      }
    });
    return {
      success: true,
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        isActive: category.isActive,
        subcategories: category.subcategories.map((subcategory) => ({
          id: subcategory.id,
          name: subcategory.name,
          isActive: subcategory.isActive
        }))
      }))
    };
  });
  ipcMain2.handle("products:list-admin", async () => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2) {
      return { success: false, message: "Debes iniciar sesion", products: [] };
    }
    const products = await prisma2.product.findMany({
      include: {
        category: true,
        subcategory: true
      },
      orderBy: { name: "asc" }
    });
    const productIds = products.map((product) => product.id);
    const createdByMap = await getAuditUserMap(prisma2, "Product", productIds, "create");
    const updatedByMap = await getAuditUserMap(prisma2, "Product", productIds, "update", true);
    return {
      success: true,
      products: products.map((product) => {
        var _a, _b;
        return {
          id: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          unitMeasure: product.unitMeasure,
          price: product.price,
          cost: product.cost,
          marginPercent: product.marginPercent,
          hasTax: product.hasTax,
          taxRate: product.taxRate,
          stock: product.stock,
          categoryId: product.categoryId,
          subcategoryId: product.subcategoryId,
          categoryName: ((_a = product.category) == null ? void 0 : _a.name) ?? null,
          subcategoryName: ((_b = product.subcategory) == null ? void 0 : _b.name) ?? null,
          isActive: product.isActive,
          createdAt: product.createdAt.toISOString(),
          updatedAt: product.updatedAt.toISOString(),
          createdBy: createdByMap.get(product.id) ?? null,
          updatedBy: updatedByMap.get(product.id) ?? createdByMap.get(product.id) ?? null
        };
      })
    };
  });
  ipcMain2.handle("products:create", async (_event, payload) => {
    var _a;
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser2, APP_PERMISSION_KEYS.productsCreate)) {
      return { success: false, message: "Tu rol no puede crear productos" };
    }
    const parsed = createProductSchema.safeParse(payload);
    if (!parsed.success)
      return { success: false, message: "Datos invalidos para el producto" };
    const data = parsed.data;
    const category = data.categoryId ? await prisma2.productCategory.findUnique({ where: { id: data.categoryId } }) : null;
    const sku = ((_a = data.sku) == null ? void 0 : _a.trim()) || await generateSku(prisma2, data.name, category == null ? void 0 : category.name);
    try {
      const product = await prisma2.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            name: data.name,
            sku,
            barcode: data.barcode || null,
            unitMeasure: data.unitMeasure ?? "UNIDAD",
            price: money$1(data.price),
            cost: money$1(data.cost ?? 0),
            marginPercent: data.marginPercent ?? 0,
            hasTax: data.hasTax ?? false,
            taxRate: data.hasTax ? data.taxRate ?? 0 : 0,
            stock: data.stock ?? 0,
            categoryId: data.categoryId ?? null,
            subcategoryId: data.subcategoryId ?? null,
            isActive: data.isActive ?? true
          }
        });
        if ((data.stock ?? 0) > 0) {
          await tx.inventoryMovement.create({
            data: {
              productId: created.id,
              type: InventoryMovementType.MANUAL_IN,
              qty: data.stock ?? 0,
              stockBefore: 0,
              stockAfter: data.stock ?? 0,
              referenceType: "PRODUCT_CREATE",
              referenceId: created.id,
              note: `Stock inicial registrado por ${actorLabel(currentSessionUser2)}`
            }
          });
        }
        return created;
      });
      await logAudit(prisma2, currentSessionUser2, "products", "create", "Product", product.id, void 0, {
        name: product.name,
        sku: product.sku
      });
      return { success: true, productId: product.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear el producto";
      return { success: false, message };
    }
  });
  ipcMain2.handle("products:update", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser2, APP_PERMISSION_KEYS.productsEdit)) {
      return { success: false, message: "Tu rol no puede editar productos" };
    }
    const parsed = updateProductSchema.safeParse(payload);
    if (!parsed.success)
      return { success: false, message: "Datos invalidos para actualizar el producto" };
    const current = await prisma2.product.findUnique({ where: { id: parsed.data.id } });
    if (!current)
      return { success: false, message: "Producto no encontrado" };
    try {
      await prisma2.$transaction(async (tx) => {
        await tx.product.update({
          where: { id: parsed.data.id },
          data: {
            name: parsed.data.name ?? current.name,
            sku: parsed.data.sku ?? current.sku,
            barcode: parsed.data.barcode === void 0 ? current.barcode : parsed.data.barcode,
            unitMeasure: parsed.data.unitMeasure ?? current.unitMeasure,
            price: parsed.data.price === void 0 ? current.price : money$1(parsed.data.price),
            cost: parsed.data.cost === void 0 ? current.cost : money$1(parsed.data.cost),
            marginPercent: parsed.data.marginPercent ?? current.marginPercent,
            hasTax: parsed.data.hasTax ?? current.hasTax,
            taxRate: parsed.data.hasTax === false ? 0 : parsed.data.taxRate ?? current.taxRate,
            stock: parsed.data.stock ?? current.stock,
            categoryId: parsed.data.categoryId === void 0 ? current.categoryId : parsed.data.categoryId,
            subcategoryId: parsed.data.subcategoryId === void 0 ? current.subcategoryId : parsed.data.subcategoryId,
            isActive: parsed.data.isActive ?? current.isActive
          }
        });
        if (parsed.data.stock !== void 0 && parsed.data.stock !== current.stock) {
          const delta = parsed.data.stock - current.stock;
          await tx.inventoryMovement.create({
            data: {
              productId: current.id,
              type: delta > 0 ? InventoryMovementType.ADJUSTMENT_IN : InventoryMovementType.ADJUSTMENT_OUT,
              qty: Math.abs(delta),
              stockBefore: current.stock,
              stockAfter: parsed.data.stock,
              referenceType: "PRODUCT_EDIT",
              referenceId: current.id,
              note: `Ajuste manual por ${actorLabel(currentSessionUser2)}`
            }
          });
        }
      });
      await logAudit(prisma2, currentSessionUser2, "products", "update", "Product", current.id, current, parsed.data);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar el producto";
      return { success: false, message };
    }
  });
  ipcMain2.handle("products:delete", async (_event, payload) => {
    const currentSessionUser2 = await ensureAdminSession(getCurrentSessionUser);
    if (!hasSessionPermission(currentSessionUser2, APP_PERMISSION_KEYS.productsDelete)) {
      return { success: false, message: "Tu rol no puede archivar productos" };
    }
    const parsed = deleteByIdSchema.safeParse(payload);
    if (!parsed.success)
      return { success: false, message: "Producto invalido" };
    const current = await prisma2.product.findUnique({ where: { id: parsed.data.id } });
    if (!current)
      return { success: false, message: "Producto no encontrado" };
    await prisma2.product.update({
      where: { id: parsed.data.id },
      data: { isActive: false }
    });
    await logAudit(prisma2, currentSessionUser2, "products", "archive", "Product", current.id, current, {
      isActive: false
    });
    return { success: true };
  });
  ipcMain2.handle("products:category:create", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser2, APP_PERMISSION_KEYS.productsEdit)) {
      return { success: false, message: "Tu rol no puede administrar categorias" };
    }
    const parsed = createCategorySchema.safeParse(payload);
    if (!parsed.success)
      return { success: false, message: "Categoria invalida" };
    try {
      await prisma2.productCategory.create({
        data: { name: parsed.data.name, isActive: true }
      });
      return { success: true };
    } catch {
      return { success: false, message: "La categoria ya existe" };
    }
  });
  ipcMain2.handle("products:category:delete", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser2, APP_PERMISSION_KEYS.productsEdit)) {
      return { success: false, message: "Tu rol no puede administrar categorias" };
    }
    const parsed = deleteByIdSchema.safeParse(payload);
    if (!parsed.success)
      return { success: false, message: "Categoria invalida" };
    await prisma2.productCategory.delete({
      where: { id: parsed.data.id }
    });
    return { success: true };
  });
  ipcMain2.handle("products:subcategory:create", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser2, APP_PERMISSION_KEYS.productsEdit)) {
      return { success: false, message: "Tu rol no puede administrar subcategorias" };
    }
    const parsed = createSubcategorySchema.safeParse(payload);
    if (!parsed.success)
      return { success: false, message: "Subcategoria invalida" };
    try {
      await prisma2.productSubcategory.create({
        data: {
          categoryId: parsed.data.categoryId,
          name: parsed.data.name,
          isActive: true
        }
      });
      return { success: true };
    } catch {
      return { success: false, message: "La subcategoria ya existe en esa categoria" };
    }
  });
  ipcMain2.handle("products:subcategory:delete", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser2, APP_PERMISSION_KEYS.productsEdit)) {
      return { success: false, message: "Tu rol no puede administrar subcategorias" };
    }
    const parsed = deleteByIdSchema.safeParse(payload);
    if (!parsed.success)
      return { success: false, message: "Subcategoria invalida" };
    await prisma2.productSubcategory.delete({
      where: { id: parsed.data.id }
    });
    return { success: true };
  });
  ipcMain2.handle("customers:list", async () => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion", customers: [] };
    const customers = await prisma2.customer.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { sales: true, credits: true }
        }
      }
    });
    const customerIds = customers.map((customer) => customer.id);
    const createdByMap = await getAuditUserMap(prisma2, "Customer", customerIds, "create");
    return {
      success: true,
      customers: customers.map((customer) => ({
        id: customer.id,
        internalCode: customer.internalCode,
        name: customer.name,
        document: customer.document,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        isActive: customer.isActive,
        salesCount: customer._count.sales,
        creditsCount: customer._count.credits,
        createdAt: customer.createdAt.toISOString(),
        createdBy: createdByMap.get(customer.id) ?? null
      }))
    };
  });
  ipcMain2.handle("customers:create", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser2, APP_PERMISSION_KEYS.customersCreate)) {
      return { success: false, message: "Tu rol no puede crear clientes" };
    }
    const parsed = createCustomerSchema.safeParse(payload);
    if (!parsed.success)
      return { success: false, message: "Datos invalidos para el cliente" };
    try {
      const existingInternalCodes = (await prisma2.customer.findMany({
        select: { internalCode: true }
      })).map((customer2) => customer2.internalCode);
      const internalCode = resolveManagedCode({
        desiredCode: parsed.data.internalCode,
        existingCodes: existingInternalCodes,
        prefix: "CLI",
        digits: 4,
        maxLength: 30
      });
      const customer = await prisma2.customer.create({
        data: {
          internalCode,
          name: buildFullName(parsed.data.firstName, parsed.data.lastName),
          document: buildDocumentValue(parsed.data.documentType, parsed.data.documentNumber),
          phone: parsed.data.phone || null,
          email: parsed.data.email || null,
          address: parsed.data.address || null,
          creditLimit: 0,
          notes: null,
          isActive: parsed.data.isActive ?? true
        }
      });
      await logAudit(prisma2, currentSessionUser2, "customers", "create", "Customer", customer.id, void 0, {
        name: customer.name,
        document: customer.document
      });
      return { success: true, customerId: customer.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear el cliente. Verifica documento o correo duplicado.";
      return { success: false, message };
    }
  });
  ipcMain2.handle("customers:update", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser2, APP_PERMISSION_KEYS.customersEdit)) {
      return { success: false, message: "Tu rol no puede editar clientes" };
    }
    const parsed = updateCustomerSchema.safeParse(payload);
    if (!parsed.success)
      return { success: false, message: "Datos invalidos para actualizar el cliente" };
    const current = await prisma2.customer.findUnique({ where: { id: parsed.data.id } });
    if (!current)
      return { success: false, message: "Cliente no encontrado" };
    try {
      const existingInternalCodes = (await prisma2.customer.findMany({
        where: { NOT: { id: current.id } },
        select: { internalCode: true }
      })).map((customer) => customer.internalCode);
      const internalCode = resolveManagedCode({
        desiredCode: parsed.data.internalCode,
        existingCodes: existingInternalCodes,
        prefix: "CLI",
        digits: 4,
        maxLength: 30
      });
      const nextData = {
        internalCode,
        name: buildFullName(parsed.data.firstName, parsed.data.lastName),
        document: buildDocumentValue(parsed.data.documentType, parsed.data.documentNumber),
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        address: parsed.data.address || null,
        isActive: parsed.data.isActive ?? current.isActive
      };
      await prisma2.customer.update({
        where: { id: current.id },
        data: {
          ...nextData,
          creditLimit: 0,
          notes: null
        }
      });
      await logAudit(prisma2, currentSessionUser2, "customers", "update", "Customer", current.id, current, nextData);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar el cliente. Verifica documento o correo duplicado.";
      return { success: false, message };
    }
  });
  ipcMain2.handle("suppliers:list", async () => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion", suppliers: [] };
    const suppliers = await prisma2.supplier.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { purchases: true }
        }
      }
    });
    const supplierIds = suppliers.map((supplier) => supplier.id);
    const createdByMap = await getAuditUserMap(prisma2, "Supplier", supplierIds, "create");
    return {
      success: true,
      suppliers: suppliers.map((supplier) => ({
        id: supplier.id,
        internalCode: supplier.internalCode,
        name: supplier.name,
        document: supplier.taxId,
        phone: supplier.phone,
        email: supplier.email,
        address: supplier.address,
        contactName: supplier.contactName,
        isActive: supplier.isActive,
        purchasesCount: supplier._count.purchases,
        createdAt: supplier.createdAt.toISOString(),
        createdBy: createdByMap.get(supplier.id) ?? null
      }))
    };
  });
  ipcMain2.handle("suppliers:create", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser2, APP_PERMISSION_KEYS.suppliersCreate)) {
      return { success: false, message: "Tu rol no puede crear proveedores" };
    }
    const parsed = createSupplierSchema.safeParse(payload);
    if (!parsed.success)
      return { success: false, message: "Datos invalidos para el proveedor" };
    try {
      const existingInternalCodes = (await prisma2.supplier.findMany({
        select: { internalCode: true }
      })).map((supplier2) => supplier2.internalCode);
      const internalCode = resolveManagedCode({
        desiredCode: parsed.data.internalCode,
        existingCodes: existingInternalCodes,
        prefix: "PRV",
        digits: 4,
        maxLength: 30
      });
      const supplier = await prisma2.supplier.create({
        data: {
          internalCode,
          name: parsed.data.name,
          taxId: buildDocumentValue(parsed.data.documentType, parsed.data.documentNumber),
          phone: parsed.data.phone || null,
          email: parsed.data.email || null,
          address: parsed.data.address || null,
          contactName: parsed.data.contactName || null,
          isActive: parsed.data.isActive ?? true
        }
      });
      await logAudit(prisma2, currentSessionUser2, "suppliers", "create", "Supplier", supplier.id, void 0, {
        name: supplier.name,
        taxId: supplier.taxId
      });
      return { success: true, supplierId: supplier.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear el proveedor. Verifica documento o correo duplicado.";
      return { success: false, message };
    }
  });
  ipcMain2.handle("suppliers:update", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser2, APP_PERMISSION_KEYS.suppliersEdit)) {
      return { success: false, message: "Tu rol no puede editar proveedores" };
    }
    const parsed = updateSupplierSchema.safeParse(payload);
    if (!parsed.success)
      return { success: false, message: "Datos invalidos para actualizar el proveedor" };
    const current = await prisma2.supplier.findUnique({ where: { id: parsed.data.id } });
    if (!current)
      return { success: false, message: "Proveedor no encontrado" };
    try {
      const existingInternalCodes = (await prisma2.supplier.findMany({
        where: { NOT: { id: current.id } },
        select: { internalCode: true }
      })).map((supplier) => supplier.internalCode);
      const internalCode = resolveManagedCode({
        desiredCode: parsed.data.internalCode,
        existingCodes: existingInternalCodes,
        prefix: "PRV",
        digits: 4,
        maxLength: 30
      });
      const nextData = {
        internalCode,
        name: parsed.data.name,
        taxId: buildDocumentValue(parsed.data.documentType, parsed.data.documentNumber),
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        address: parsed.data.address || null,
        contactName: parsed.data.contactName || null,
        isActive: parsed.data.isActive ?? current.isActive
      };
      await prisma2.supplier.update({
        where: { id: current.id },
        data: nextData
      });
      await logAudit(prisma2, currentSessionUser2, "suppliers", "update", "Supplier", current.id, current, nextData);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar el proveedor. Verifica documento o correo duplicado.";
      return { success: false, message };
    }
  });
  ipcMain2.handle("purchases:list", async () => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion", purchases: [] };
    const purchases = await prisma2.purchase.findMany({
      include: {
        supplier: {
          select: { name: true }
        },
        items: {
          select: { qty: true }
        }
      },
      orderBy: { purchasedAt: "desc" },
      take: 200
    });
    const purchaseIds = purchases.map((purchase) => purchase.id);
    const createdByMap = await getAuditUserMap(prisma2, "Purchase", purchaseIds, "create");
    return {
      success: true,
      purchases: purchases.map((purchase) => ({
        id: purchase.id,
        number: purchase.number,
        supplierId: purchase.supplierId,
        supplier: purchase.supplier.name,
        status: purchase.status,
        subtotal: purchase.subtotal,
        tax: purchase.tax,
        total: purchase.total,
        balance: purchase.balance,
        note: purchase.note,
        purchasedAt: purchase.purchasedAt.toISOString(),
        itemsCount: purchase.items.reduce((sum, item) => sum + item.qty, 0),
        createdBy: createdByMap.get(purchase.id) ?? null
      }))
    };
  });
  ipcMain2.handle("purchases:get-detail", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser2, APP_PERMISSION_KEYS.purchasesDetails)) {
      return { success: false, message: "Tu rol no puede ver el detalle de compras" };
    }
    const parsed = deleteByIdSchema.safeParse(payload);
    if (!parsed.success)
      return { success: false, message: "Compra invalida" };
    const purchase = await prisma2.purchase.findUnique({
      where: { id: parsed.data.id },
      include: {
        supplier: true,
        items: {
          include: {
            product: {
              select: { name: true, sku: true }
            }
          },
          orderBy: { createdAt: "asc" }
        }
      }
    });
    if (!purchase)
      return { success: false, message: "Compra no encontrada" };
    const createdByMap = await getAuditUserMap(prisma2, "Purchase", [purchase.id], "create");
    return {
      success: true,
      purchase: {
        id: purchase.id,
        number: purchase.number,
        supplier: purchase.supplier.name,
        status: purchase.status,
        subtotal: purchase.subtotal,
        tax: purchase.tax,
        total: purchase.total,
        balance: purchase.balance,
        note: purchase.note,
        purchasedAt: purchase.purchasedAt.toISOString(),
        createdBy: createdByMap.get(purchase.id) ?? null,
        items: purchase.items.map((item) => ({
          id: item.id,
          productName: item.product.name,
          productSku: item.product.sku,
          qty: item.qty,
          cost: item.cost,
          taxRate: item.taxRate,
          subtotal: item.subtotal,
          total: item.subtotal + money$1(item.subtotal * item.taxRate)
        }))
      }
    };
  });
  ipcMain2.handle("purchases:create", async (_event, payload) => {
    const currentSessionUser2 = await ensureAdminSession(getCurrentSessionUser);
    if (!hasSessionPermission(currentSessionUser2, APP_PERMISSION_KEYS.purchasesCreate)) {
      return { success: false, message: "Tu rol no puede registrar compras" };
    }
    const parsed = createPurchaseSchema.safeParse(payload);
    if (!parsed.success)
      return { success: false, message: "Datos invalidos para la compra" };
    const supplier = await prisma2.supplier.findUnique({ where: { id: parsed.data.supplierId } });
    if (!supplier)
      return { success: false, message: "Proveedor no encontrado" };
    const productIds = parsed.data.items.map((item) => item.productId);
    const products = await prisma2.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true
      }
    });
    if (products.length !== productIds.length) {
      return { success: false, message: "Uno o más productos no están disponibles" };
    }
    const productMap = new Map(products.map((product) => [product.id, product]));
    const normalizedItems = parsed.data.items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new Error("Producto no encontrado");
      }
      const subtotal2 = money$1(item.cost * item.qty);
      const tax2 = money$1(subtotal2 * (item.taxRate ?? 0));
      return {
        product,
        qty: item.qty,
        cost: money$1(item.cost),
        taxRate: item.taxRate ?? 0,
        subtotal: subtotal2,
        tax: tax2,
        total: subtotal2 + tax2
      };
    });
    const subtotal = normalizedItems.reduce((sum, item) => sum + item.subtotal, 0);
    const tax = normalizedItems.reduce((sum, item) => sum + item.tax, 0);
    const total = subtotal + tax;
    const purchasedAt = parsed.data.purchasedAt ? new Date(parsed.data.purchasedAt) : /* @__PURE__ */ new Date();
    const status = parsed.data.markAsPaid ? PurchaseStatus.PAID : PurchaseStatus.RECEIVED;
    const balance = parsed.data.markAsPaid ? 0 : total;
    const paymentMedium = normalizeTreasuryMedium(parsed.data.paymentMedium);
    const paymentPlatform = paymentMedium === "CORRESPONDENT" && parsed.data.paymentPlatformId ? await prisma2.correspondentPlatform.findUnique({
      where: { id: parsed.data.paymentPlatformId },
      select: { id: true, name: true }
    }) : null;
    if (paymentMedium === "CORRESPONDENT" && !paymentPlatform) {
      return { success: false, message: "Selecciona un corresponsal valido para pagar la compra" };
    }
    const activeSession = parsed.data.markAsPaid ? await prisma2.cashSession.findFirst({
      where: { status: CashSessionStatus.OPEN },
      orderBy: { openedAt: "desc" }
    }) : null;
    if (parsed.data.markAsPaid && !activeSession) {
      return { success: false, message: "Abre el control diario antes de registrar compras pagadas" };
    }
    try {
      const purchase = await prisma2.$transaction(async (tx) => {
        const number = await generatePurchaseNumber(tx);
        const createdPurchase = await tx.purchase.create({
          data: {
            supplierId: parsed.data.supplierId,
            number,
            status,
            subtotal,
            tax,
            total,
            balance,
            note: parsed.data.note || null,
            purchasedAt,
            items: {
              create: normalizedItems.map((item) => ({
                productId: item.product.id,
                qty: item.qty,
                cost: item.cost,
                taxRate: item.taxRate,
                subtotal: item.subtotal
              }))
            }
          }
        });
        for (const item of normalizedItems) {
          const nextStock = item.product.stock + item.qty;
          const weightedCost = nextStock <= 0 ? item.cost : money$1((item.product.stock * item.product.cost + item.subtotal) / nextStock);
          const nextPrice = calculateSalePrice(
            weightedCost,
            item.product.marginPercent,
            item.product.hasTax,
            item.product.taxRate
          );
          await tx.product.update({
            where: { id: item.product.id },
            data: {
              stock: nextStock,
              cost: weightedCost,
              price: nextPrice
            }
          });
          await tx.inventoryMovement.create({
            data: {
              productId: item.product.id,
              type: InventoryMovementType.PURCHASE_IN,
              qty: item.qty,
              stockBefore: item.product.stock,
              stockAfter: nextStock,
              referenceType: "PURCHASE",
              referenceId: createdPurchase.id,
              note: `${createdPurchase.number} - ${supplier.name} - registrado por ${actorLabel(currentSessionUser2)}`
            }
          });
        }
        if (parsed.data.markAsPaid && activeSession) {
          await tx.cashMovement.create({
            data: {
              sessionId: activeSession.id,
              type: CashMovementType.EXPENSE_OUT,
              amount: total,
              note: buildTreasuryMovementNote({
                label: `Compra pagada ${createdPurchase.number} - ${supplier.name}`,
                medium: paymentMedium,
                platformId: (paymentPlatform == null ? void 0 : paymentPlatform.id) ?? null,
                platformName: (paymentPlatform == null ? void 0 : paymentPlatform.name) ?? null,
                sourceType: "PURCHASE",
                userNote: parsed.data.note || null
              })
            }
          });
        }
        return createdPurchase;
      });
      await logAudit(prisma2, currentSessionUser2, "purchases", "create", "Purchase", purchase.id, void 0, {
        number: purchase.number,
        supplier: supplier.name,
        total: purchase.total,
        markAsPaid: parsed.data.markAsPaid,
        paymentMedium,
        paymentPlatform: (paymentPlatform == null ? void 0 : paymentPlatform.name) ?? null
      });
      return { success: true, purchaseId: purchase.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo registrar la compra";
      return { success: false, message };
    }
  });
  ipcMain2.handle("inventory:list", async () => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion", moves: [] };
    const moves = await prisma2.inventoryMovement.findMany({
      include: {
        product: {
          select: { id: true, name: true, sku: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });
    return {
      success: true,
      moves: moves.map((move) => ({
        id: move.id,
        productId: move.productId,
        productName: move.product.name,
        productSku: move.product.sku,
        type: move.type,
        qty: move.qty,
        stockBefore: move.stockBefore,
        stockAfter: move.stockAfter,
        referenceType: move.referenceType,
        referenceId: move.referenceId,
        note: move.note,
        createdAt: move.createdAt.toISOString()
      }))
    };
  });
  ipcMain2.handle("sales:list", async (_event, payload) => {
    var _a;
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion", sales: [] };
    const parsed = salesListFilterSchema.safeParse(payload);
    if (!parsed.success)
      return { success: false, message: "Filtros invalidos", sales: [] };
    const filters = parsed.data;
    const query = (_a = filters.search) == null ? void 0 : _a.trim();
    const sales = await prisma2.sale.findMany({
      where: {
        createdAt: filters.dateFrom || filters.dateTo ? {
          ...filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {},
          ...filters.dateTo ? { lt: new Date(filters.dateTo) } : {}
        } : void 0,
        cashierId: filters.cashierId,
        status: filters.status,
        OR: query ? [
          { invoiceNumber: { contains: query } },
          { customer: { contains: query } }
        ] : void 0
      },
      include: {
        cashier: {
          select: { username: true, name: true }
        },
        items: {
          select: { qty: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });
    return {
      success: true,
      sales: sales.map((sale) => ({
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        customer: sale.customer,
        paymentMethod: sale.paymentMethod,
        subtotal: sale.subtotal,
        tax: sale.tax,
        total: sale.total,
        status: sale.status,
        createdAt: sale.createdAt.toISOString(),
        cashier: sale.cashier.name ?? sale.cashier.username,
        itemsCount: sale.items.reduce((sum, item) => sum + item.qty, 0)
      }))
    };
  });
  ipcMain2.handle("sales:get-detail", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion" };
    const parsed = saleByIdSchema.safeParse(payload);
    if (!parsed.success)
      return { success: false, message: "Venta invalida" };
    const sale = await prisma2.sale.findUnique({
      where: { id: parsed.data.saleId },
      include: {
        cashier: {
          select: { username: true, name: true }
        },
        items: {
          orderBy: { createdAt: "asc" }
        },
        payments: true
      }
    });
    if (!sale)
      return { success: false, message: "Venta no encontrada" };
    return {
      success: true,
      sale: {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        customer: sale.customer,
        paymentMethod: sale.paymentMethod,
        subtotal: sale.subtotal,
        tax: sale.tax,
        total: sale.total,
        status: sale.status,
        createdAt: sale.createdAt.toISOString(),
        cashier: sale.cashier.name ?? sale.cashier.username,
        items: sale.items.map((item) => ({
          id: item.id,
          name: item.name,
          qty: item.qty,
          price: item.price,
          taxRate: item.taxRate,
          lineSubtotal: item.lineSubtotal,
          lineTax: item.lineTax,
          lineTotal: item.lineTotal
        })),
        payments: sale.payments.map((payment) => ({
          id: payment.id,
          method: payment.method,
          amount: payment.amount,
          reference: payment.reference
        }))
      }
    };
  });
  ipcMain2.handle("sales:print-invoice", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser2, APP_PERMISSION_KEYS.salesPrint)) {
      return { success: false, message: "Tu rol no puede imprimir facturas" };
    }
    const parsed = saleByIdSchema.safeParse(payload);
    if (!parsed.success)
      return { success: false, message: "Venta invalida" };
    const [sale, settings] = await Promise.all([
      prisma2.sale.findUnique({
        where: { id: parsed.data.saleId },
        include: {
          cashier: { select: { username: true, name: true } },
          items: { orderBy: { createdAt: "asc" } },
          payments: true
        }
      }),
      prisma2.businessSettings.findUnique({
        where: { id: "default" }
      })
    ]);
    if (!sale)
      return { success: false, message: "Venta no encontrada" };
    const addressParts = splitBusinessAddress(settings == null ? void 0 : settings.address);
    const html = buildInvoiceHtml({
      businessName: settings == null ? void 0 : settings.businessName,
      taxId: settings == null ? void 0 : settings.taxId,
      address: addressParts.address,
      city: addressParts.city,
      receiptFooter: settings == null ? void 0 : settings.receiptFooter,
      invoiceNumber: sale.invoiceNumber,
      customer: sale.customer,
      paymentSummary: paymentSummaryLabel(sale.payments, sale.paymentMethod),
      total: sale.total,
      subtotal: sale.subtotal,
      tax: sale.tax,
      createdAt: sale.createdAt,
      cashier: sale.cashier,
      items: sale.items.map((item) => ({
        name: item.name,
        qty: item.qty,
        price: item.price,
        lineTotal: item.lineTotal
      }))
    });
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: false
      }
    });
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return await new Promise((resolve) => {
      printWindow.webContents.print(
        {
          silent: false,
          printBackground: true
        },
        (success, failureReason) => {
          printWindow.close();
          if (!success) {
            resolve({ success: false, message: failureReason || "No se pudo imprimir" });
            return;
          }
          resolve({ success: true });
        }
      );
    });
  });
  ipcMain2.handle("accounting:summary", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser2, APP_PERMISSION_KEYS.reportsView)) {
      return { success: false, message: "Tu rol no puede consultar contabilidad" };
    }
    const parsed = accountingRangeSchema.safeParse(payload);
    if (!parsed.success)
      return { success: false, message: "Filtros invalidos" };
    const createdAt = buildDateRangeFilter(parsed.data.dateFrom, parsed.data.dateTo);
    const [customers, sales, credits, payments, creditNotes, expenses] = await Promise.all([
      prisma2.customer.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          internalCode: true,
          name: true,
          document: true,
          phone: true
        }
      }),
      prisma2.sale.findMany({
        where: {
          ...createdAt ? { createdAt } : {},
          status: { not: SaleStatus.CANCELLED }
        },
        include: {
          customerRef: {
            select: {
              id: true,
              name: true
            }
          },
          credits: {
            orderBy: { createdAt: "desc" }
          },
          returns: true,
          payments: {
            orderBy: { createdAt: "asc" },
            select: {
              method: true,
              amount: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 150
      }),
      prisma2.customerCredit.findMany({
        where: createdAt ? { createdAt } : void 0,
        include: {
          customer: {
            select: {
              id: true,
              name: true
            }
          },
          sale: {
            select: {
              id: true,
              invoiceNumber: true
            }
          },
          payments: {
            select: {
              amount: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 150
      }),
      prisma2.customerPayment.findMany({
        where: createdAt ? { createdAt } : void 0,
        include: {
          customer: {
            select: {
              name: true
            }
          },
          credit: {
            select: {
              id: true,
              sale: {
                select: {
                  id: true,
                  invoiceNumber: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 150
      }),
      prisma2.saleReturn.findMany({
        where: createdAt ? { createdAt } : void 0,
        include: {
          sale: {
            select: {
              id: true,
              invoiceNumber: true,
              customer: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 150
      }),
      prisma2.cashMovement.findMany({
        where: {
          ...createdAt ? { createdAt } : {},
          type: { in: [CashMovementType.EXPENSE_OUT, CashMovementType.WITHDRAWAL_OUT] }
        },
        include: {
          session: {
            include: {
              register: {
                select: { name: true }
              },
              user: {
                select: { username: true, name: true }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 150
      })
    ]);
    const mappedCredits = credits.map((credit) => {
      var _a;
      const status = deriveCreditStatus(credit.balance, credit.total, credit.dueDate);
      return {
        id: credit.id,
        saleId: credit.saleId,
        invoiceNumber: credit.sale.invoiceNumber,
        customerId: credit.customerId,
        customerName: credit.customer.name,
        total: credit.total,
        balance: credit.balance,
        paidAmount: credit.payments.reduce((sum, payment) => sum + payment.amount, 0),
        status,
        dueDate: ((_a = credit.dueDate) == null ? void 0 : _a.toISOString()) ?? null,
        createdAt: credit.createdAt.toISOString()
      };
    });
    const mappedSales = sales.map((sale) => {
      var _a, _b;
      const returnedTotal = sale.returns.reduce((sum, entry) => sum + entry.total, 0);
      const credit = sale.credits[0] ?? null;
      const paidAtSale = sale.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const netSaleTotal = Math.max(sale.total - returnedTotal, 0);
      const pendingAmount = credit ? credit.balance : Math.max(netSaleTotal - paidAtSale, 0);
      const collectionStatus = returnedTotal >= sale.total ? "RETURNED" : pendingAmount <= 0 ? "PAID" : paidAtSale > 0 ? "PARTIAL" : "PENDING";
      const paymentSummary = sale.payments.length ? sale.payments.map((payment) => `${paymentMethodLabel(payment.method)} $${payment.amount.toLocaleString("es-CO")}`).join(" + ") : credit ? "Pendiente por cartera" : paymentMethodLabel(sale.paymentMethod);
      return {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        customer: sale.customer,
        customerId: ((_a = sale.customerRef) == null ? void 0 : _a.id) ?? null,
        total: sale.total,
        paidAtSale,
        pendingAmount,
        returnedTotal,
        grossProfit: sale.profit,
        paymentSummary,
        collectionStatus,
        status: sale.status,
        createdAt: sale.createdAt.toISOString(),
        availableCreditTotal: Math.max(sale.total - returnedTotal, 0),
        availableCreditNoteTotal: Math.max(sale.total - returnedTotal, 0),
        credit: credit ? {
          id: credit.id,
          total: credit.total,
          balance: credit.balance,
          status: deriveCreditStatus(credit.balance, credit.total, credit.dueDate),
          dueDate: ((_b = credit.dueDate) == null ? void 0 : _b.toISOString()) ?? null
        } : null
      };
    });
    const paymentSummaryMap = /* @__PURE__ */ new Map();
    for (const method of [PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.TRANSFER]) {
      paymentSummaryMap.set(method, { salesAmount: 0, collectionsAmount: 0 });
    }
    for (const sale of sales) {
      if (sale.payments.length === 0) {
        const current = paymentSummaryMap.get(sale.paymentMethod) ?? { salesAmount: 0, collectionsAmount: 0 };
        current.salesAmount += sale.total;
        paymentSummaryMap.set(sale.paymentMethod, current);
        continue;
      }
      for (const payment of sale.payments) {
        const current = paymentSummaryMap.get(payment.method) ?? { salesAmount: 0, collectionsAmount: 0 };
        current.salesAmount += payment.amount;
        paymentSummaryMap.set(payment.method, current);
      }
    }
    for (const payment of payments) {
      const current = paymentSummaryMap.get(payment.method) ?? { salesAmount: 0, collectionsAmount: 0 };
      current.collectionsAmount += payment.amount;
      paymentSummaryMap.set(payment.method, current);
    }
    const collectedSalesTotal = mappedSales.reduce((sum, sale) => sum + sale.paidAtSale, 0);
    const collectionsTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const pendingSalesBalance = mappedSales.reduce((sum, sale) => sum + sale.pendingAmount, 0);
    const grossProfitTotal = mappedSales.reduce((sum, sale) => sum + sale.grossProfit, 0);
    const movementHistory = [
      ...mappedSales.map((sale) => ({
        id: `sale-${sale.id}`,
        createdAt: sale.createdAt,
        category: "SALE",
        title: `Venta ${sale.invoiceNumber}`,
        detail: `${sale.customer} | cobrado al momento $${sale.paidAtSale.toLocaleString("es-CO")} | pendiente $${sale.pendingAmount.toLocaleString("es-CO")}`,
        medium: sale.paymentSummary,
        amount: sale.total,
        direction: "IN",
        reference: sale.invoiceNumber,
        operationalImpact: sale.paidAtSale
      })),
      ...payments.map((payment) => {
        var _a, _b;
        return {
          id: `collection-${payment.id}`,
          createdAt: payment.createdAt.toISOString(),
          category: "COLLECTION",
          title: `Abono cartera ${((_a = payment.credit) == null ? void 0 : _a.sale.invoiceNumber) ?? ""}`.trim(),
          detail: `${payment.customer.name} | ${payment.note || "Sin detalle"}`,
          medium: paymentMethodLabel(payment.method),
          amount: payment.amount,
          direction: "IN",
          reference: ((_b = payment.credit) == null ? void 0 : _b.sale.invoiceNumber) ?? null,
          operationalImpact: payment.amount
        };
      }),
      ...creditNotes.map((note) => ({
        id: `credit-note-${note.id}`,
        createdAt: note.createdAt.toISOString(),
        category: "CREDIT_NOTE",
        title: `Nota credito ${note.sale.invoiceNumber}`,
        detail: `${note.sale.customer} | ${note.reason || "Ajuste sobre venta"}`,
        medium: "Ajuste comercial",
        amount: note.total,
        direction: "OUT",
        reference: note.sale.invoiceNumber,
        operationalImpact: -note.total
      })),
      ...expenses.map((expense) => {
        var _a, _b, _c;
        return {
          id: `expense-${expense.id}`,
          createdAt: expense.createdAt.toISOString(),
          category: "EXPENSE",
          title: expense.type === CashMovementType.WITHDRAWAL_OUT ? "Retiro operativo" : "Gasto operativo",
          detail: resolveMovementLabel(expense.note),
          medium: ((_a = parseTreasuryMovementMeta(expense.note)) == null ? void 0 : _a.medium) === "CORRESPONDENT" ? ((_b = parseTreasuryMovementMeta(expense.note)) == null ? void 0 : _b.platformName) || "Corresponsal" : ((_c = parseTreasuryMovementMeta(expense.note)) == null ? void 0 : _c.medium) === "TRANSFER" ? "Transferencias" : "Efectivo",
          amount: expense.amount,
          direction: "OUT",
          reference: null,
          operationalImpact: -expense.amount
        };
      })
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 250);
    return {
      success: true,
      summary: {
        salesCount: mappedSales.length,
        salesTotal: mappedSales.reduce((sum, sale) => sum + sale.total, 0),
        collectedSalesTotal,
        pendingSalesBalance,
        pendingCreditsCount: mappedCredits.filter((credit) => credit.balance > 0).length,
        pendingCreditsBalance: mappedCredits.reduce((sum, credit) => sum + credit.balance, 0),
        paymentsTotal: collectionsTotal,
        collectionsTotal,
        operationalIncomeTotal: collectedSalesTotal + collectionsTotal,
        creditNotesTotal: creditNotes.reduce((sum, note) => sum + note.total, 0),
        expensesTotal: expenses.reduce((sum, expense) => sum + expense.amount, 0),
        grossProfitTotal,
        averageTicket: mappedSales.length > 0 ? money$1(mappedSales.reduce((sum, sale) => sum + sale.total, 0) / mappedSales.length) : 0,
        netOperationalBalance: collectedSalesTotal + collectionsTotal - creditNotes.reduce((sum, note) => sum + note.total, 0) - expenses.reduce((sum, expense) => sum + expense.amount, 0)
      },
      customers: customers.map((customer) => ({
        id: customer.id,
        internalCode: customer.internalCode,
        name: customer.name,
        document: customer.document,
        phone: customer.phone
      })),
      paymentSummary: [...paymentSummaryMap.entries()].map(([method, totals]) => ({
        method,
        label: paymentMethodLabel(method),
        salesAmount: totals.salesAmount,
        collectionsAmount: totals.collectionsAmount,
        totalAmount: totals.salesAmount + totals.collectionsAmount
      })),
      movementHistory,
      sales: mappedSales,
      credits: mappedCredits,
      payments: payments.map((payment) => {
        var _a, _b;
        return {
          id: payment.id,
          creditId: payment.creditId,
          saleId: ((_a = payment.credit) == null ? void 0 : _a.sale.id) ?? null,
          invoiceNumber: ((_b = payment.credit) == null ? void 0 : _b.sale.invoiceNumber) ?? null,
          customerName: payment.customer.name,
          method: payment.method,
          amount: payment.amount,
          note: payment.note,
          createdAt: payment.createdAt.toISOString()
        };
      }),
      creditNotes: creditNotes.map((note) => ({
        id: note.id,
        saleId: note.saleId,
        invoiceNumber: note.sale.invoiceNumber,
        customerName: note.sale.customer,
        total: note.total,
        reason: note.reason,
        createdAt: note.createdAt.toISOString()
      })),
      expenses: expenses.map((expense) => {
        const meta = parseTreasuryMovementMeta(expense.note);
        return {
          id: expense.id,
          sessionId: expense.sessionId,
          registerName: expense.session.register.name,
          userName: expense.session.user.name ?? expense.session.user.username,
          type: expense.type,
          amount: expense.amount,
          note: resolveMovementLabel(expense.note),
          sourceMedium: (meta == null ? void 0 : meta.medium) ?? "CASH",
          sourcePlatform: (meta == null ? void 0 : meta.platformName) ?? null,
          createdAt: expense.createdAt.toISOString()
        };
      })
    };
  });
  ipcMain2.handle("accounting:credit:create", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser2, APP_PERMISSION_KEYS.reportsView)) {
      return { success: false, message: "Tu rol no puede registrar cartera" };
    }
    const parsed = createAccountingCreditSchema.safeParse(payload);
    if (!parsed.success)
      return { success: false, message: "Datos invalidos para la cartera" };
    const sale = await prisma2.sale.findUnique({
      where: { id: parsed.data.saleId },
      include: {
        credits: true,
        returns: true
      }
    });
    if (!sale)
      return { success: false, message: "La venta ya no existe" };
    if (sale.credits.length > 0)
      return { success: false, message: "La venta ya tiene una cuenta por cobrar asociada" };
    const customer = await prisma2.customer.findUnique({
      where: { id: parsed.data.customerId },
      select: { id: true, name: true, isActive: true }
    });
    if (!customer || !customer.isActive) {
      return { success: false, message: "Selecciona un cliente activo para crear la cuenta por cobrar" };
    }
    const returnedTotal = sale.returns.reduce((sum, entry) => sum + entry.total, 0);
    const availableTotal = Math.max(sale.total - returnedTotal, 0);
    const total = parsed.data.total ?? availableTotal;
    if (availableTotal <= 0)
      return { success: false, message: "La venta no tiene saldo disponible para cartera" };
    if (total > availableTotal)
      return { success: false, message: "El valor supera el saldo disponible de la venta" };
    try {
      const result = await prisma2.$transaction(async (tx) => {
        const credit = await tx.customerCredit.create({
          data: {
            customerId: customer.id,
            saleId: sale.id,
            total,
            balance: total,
            dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
            status: deriveCreditStatus(total, total, parsed.data.dueDate ? new Date(parsed.data.dueDate) : null)
          }
        });
        await tx.sale.update({
          where: { id: sale.id },
          data: {
            customerId: customer.id,
            customer: customer.name,
            status: SaleStatus.CREDIT
          }
        });
        return credit;
      });
      await logAudit(prisma2, currentSessionUser2, "accounting", "create", "CustomerCredit", result.id, void 0, {
        saleId: sale.id,
        customerId: customer.id,
        total
      });
      return { success: true, creditId: result.id, message: "Cuenta por cobrar creada correctamente." };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "No se pudo crear la cuenta por cobrar" };
    }
  });
  ipcMain2.handle("accounting:payment:create", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser2, APP_PERMISSION_KEYS.reportsView)) {
      return { success: false, message: "Tu rol no puede registrar pagos" };
    }
    const parsed = createAccountingPaymentSchema.safeParse(payload);
    if (!parsed.success)
      return { success: false, message: "Datos invalidos para el abono" };
    const credit = await prisma2.customerCredit.findUnique({
      where: { id: parsed.data.creditId },
      include: {
        sale: {
          include: {
            returns: true
          }
        }
      }
    });
    if (!credit)
      return { success: false, message: "La cuenta por cobrar ya no existe" };
    if (credit.balance <= 0)
      return { success: false, message: "La cuenta por cobrar ya se encuentra saldada" };
    if (parsed.data.amount > credit.balance)
      return { success: false, message: "El abono supera el saldo pendiente" };
    const cashSession = await prisma2.cashSession.findFirst({
      where: { status: CashSessionStatus.OPEN },
      orderBy: { openedAt: "desc" }
    });
    if (!cashSession) {
      return { success: false, message: "Abre el control diario antes de registrar abonos" };
    }
    try {
      const result = await prisma2.$transaction(async (tx) => {
        const payment = await tx.customerPayment.create({
          data: {
            customerId: credit.customerId,
            creditId: credit.id,
            method: parsed.data.method,
            amount: parsed.data.amount,
            note: parsed.data.note || null
          }
        });
        const paidAmount = credit.total - credit.balance + parsed.data.amount;
        const nextBalance = Math.max(credit.total - paidAmount, 0);
        const nextStatus = deriveCreditStatus(nextBalance, credit.total, credit.dueDate);
        await tx.customerCredit.update({
          where: { id: credit.id },
          data: {
            balance: nextBalance,
            status: nextStatus
          }
        });
        await tx.cashMovement.create({
          data: {
            sessionId: cashSession.id,
            type: CashMovementType.INCOME_IN,
            amount: parsed.data.amount,
            note: buildTreasuryMovementNote({
              label: `Abono cartera ${credit.sale.invoiceNumber}`,
              medium: parsed.data.method === PaymentMethod.CASH ? "CASH" : "TRANSFER",
              sourceType: "ACCOUNTING_PAYMENT",
              userNote: parsed.data.note || null
            })
          }
        });
        if (nextBalance <= 0) {
          const returnedTotal = credit.sale.returns.reduce((sum, entry) => sum + entry.total, 0);
          await tx.sale.update({
            where: { id: credit.saleId },
            data: {
              status: mapSaleStatusFromReturns(credit.sale.total, returnedTotal)
            }
          });
        }
        return payment;
      });
      await logAudit(prisma2, currentSessionUser2, "accounting", "create", "CustomerPayment", result.id, void 0, {
        creditId: credit.id,
        amount: parsed.data.amount,
        method: parsed.data.method
      });
      return { success: true, paymentId: result.id, message: "Abono registrado correctamente." };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "No se pudo registrar el abono" };
    }
  });
  ipcMain2.handle("accounting:credit-note:create", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser2, APP_PERMISSION_KEYS.reportsView)) {
      return { success: false, message: "Tu rol no puede registrar notas credito" };
    }
    const parsed = createAccountingCreditNoteSchema.safeParse(payload);
    if (!parsed.success)
      return { success: false, message: "Datos invalidos para la nota credito" };
    const sale = await prisma2.sale.findUnique({
      where: { id: parsed.data.saleId },
      include: {
        returns: true,
        credits: true
      }
    });
    if (!sale)
      return { success: false, message: "La venta ya no existe" };
    const returnedTotal = sale.returns.reduce((sum, entry) => sum + entry.total, 0);
    const availableAmount = Math.max(sale.total - returnedTotal, 0);
    if (availableAmount <= 0)
      return { success: false, message: "La venta no tiene saldo disponible para nota credito" };
    if (parsed.data.amount > availableAmount)
      return { success: false, message: "La nota credito supera el saldo disponible de la venta" };
    try {
      const result = await prisma2.$transaction(async (tx) => {
        const creditNote = await tx.saleReturn.create({
          data: {
            saleId: sale.id,
            total: parsed.data.amount,
            reason: parsed.data.reason || null
          }
        });
        const nextReturnedTotal = returnedTotal + parsed.data.amount;
        await tx.sale.update({
          where: { id: sale.id },
          data: {
            status: mapSaleStatusFromReturns(sale.total, nextReturnedTotal)
          }
        });
        const credit = sale.credits[0];
        if (credit) {
          const paidAmount = Math.max(credit.total - credit.balance, 0);
          const nextTotal = Math.max(credit.total - parsed.data.amount, 0);
          const nextBalance = Math.max(nextTotal - paidAmount, 0);
          await tx.customerCredit.update({
            where: { id: credit.id },
            data: {
              total: nextTotal,
              balance: nextBalance,
              status: deriveCreditStatus(nextBalance, nextTotal, credit.dueDate)
            }
          });
        }
        return creditNote;
      });
      await logAudit(prisma2, currentSessionUser2, "accounting", "create", "SaleReturn", result.id, void 0, {
        saleId: sale.id,
        total: parsed.data.amount
      });
      return { success: true, creditNoteId: result.id, message: "Nota credito registrada correctamente." };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "No se pudo registrar la nota credito" };
    }
  });
  ipcMain2.handle("accounting:expense:create", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser2, APP_PERMISSION_KEYS.reportsView)) {
      return { success: false, message: "Tu rol no puede registrar gastos" };
    }
    const parsed = createAccountingExpenseSchema.safeParse(payload);
    if (!parsed.success)
      return { success: false, message: "Datos invalidos para el gasto" };
    const activeSession = await prisma2.cashSession.findFirst({
      where: { status: CashSessionStatus.OPEN },
      orderBy: { openedAt: "desc" }
    });
    if (!activeSession)
      return { success: false, message: "Abre caja general antes de registrar gastos o retiros" };
    const sourceMedium = normalizeTreasuryMedium(parsed.data.sourceMedium);
    const sourcePlatform = sourceMedium === "CORRESPONDENT" && parsed.data.sourcePlatformId ? await prisma2.correspondentPlatform.findUnique({
      where: { id: parsed.data.sourcePlatformId },
      select: { id: true, name: true }
    }) : null;
    if (sourceMedium === "CORRESPONDENT" && !sourcePlatform) {
      return { success: false, message: "Selecciona un corresponsal valido para registrar el egreso" };
    }
    try {
      const expense = await prisma2.cashMovement.create({
        data: {
          sessionId: activeSession.id,
          type: parsed.data.type,
          amount: parsed.data.amount,
          note: buildTreasuryMovementNote({
            label: parsed.data.note,
            medium: sourceMedium,
            platformId: (sourcePlatform == null ? void 0 : sourcePlatform.id) ?? null,
            platformName: (sourcePlatform == null ? void 0 : sourcePlatform.name) ?? null,
            sourceType: "EXPENSE",
            userNote: parsed.data.note
          })
        }
      });
      await logAudit(prisma2, currentSessionUser2, "accounting", "create", "CashMovement", expense.id, void 0, {
        type: parsed.data.type,
        amount: parsed.data.amount,
        note: parsed.data.note,
        sourceMedium,
        sourcePlatform: (sourcePlatform == null ? void 0 : sourcePlatform.name) ?? null
      });
      return { success: true, expenseId: expense.id, message: "Gasto registrado correctamente." };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "No se pudo registrar el gasto" };
    }
  });
}
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win = null;
let prisma;
let appConnectedAt = /* @__PURE__ */ new Date();
let currentSessionUser = null;
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "mascot.png"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false
  });
  Menu.setApplicationMenu(null);
  win.maximize();
  win.show();
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
function getSeedConfig() {
  const enabled = (process.env.SEED_ADMIN_ENABLED ?? "false").toLowerCase() === "true";
  const username = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const name = process.env.SEED_ADMIN_NAME ?? "Administrador";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "";
  const bcryptRounds = Number(process.env.BCRYPT_ROUNDS ?? "10");
  if (enabled && password.trim().length < 8) {
    throw new Error("SEED_ADMIN_PASSWORD es obligatorio y debe tener minimo 8 caracteres.");
  }
  if (!Number.isFinite(bcryptRounds) || bcryptRounds < 8 || bcryptRounds > 15) {
    throw new Error("BCRYPT_ROUNDS invalido. Usa un valor entre 8 y 15.");
  }
  return { enabled, username, name, password, bcryptRounds };
}
async function seedAdminIfNeeded(prismaClient) {
  const cfg = getSeedConfig();
  if (!cfg.enabled)
    return;
  const adminExists = await prismaClient.user.findFirst({ where: { role: Role.ADMIN } });
  if (adminExists)
    return;
  const passwordHash = await bcrypt.hash(cfg.password, cfg.bcryptRounds);
  await prismaClient.user.create({
    data: {
      username: cfg.username,
      name: cfg.name,
      role: Role.ADMIN,
      passwordHash,
      isActive: true
    }
  });
}
async function seedCoreConfigIfNeeded(prismaClient) {
  await prismaClient.businessSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      businessName: "Mi Miscelanea",
      currencyCode: "COP",
      defaultTaxRate: 0.19,
      invoicePrefix: "FV",
      lowStockThreshold: 5
    }
  });
  await prismaClient.cashRegister.upsert({
    where: { name: "Caja principal" },
    update: {},
    create: {
      name: "Caja principal",
      branchName: "Tienda principal",
      isActive: true
    }
  });
}
async function logLoginEvent(params) {
  try {
    await prisma.loginEvent.create({
      data: {
        userId: params.userId ?? null,
        username: params.username,
        success: params.success,
        reason: params.reason,
        occurredAt: /* @__PURE__ */ new Date(),
        appVersion: app.getVersion(),
        osPlatform: os.platform(),
        osRelease: os.release(),
        deviceName: os.hostname()
      }
    });
  } catch (error) {
    console.error("Error registrando login:", error);
  }
}
function money(value) {
  return Math.round(value);
}
function startOfRange(range) {
  const now = /* @__PURE__ */ new Date();
  if (range === "day") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (range === "week") {
    const start = new Date(now);
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
function buildInvoiceNumber(prefix, sequence) {
  return `${prefix}-${String(sequence).padStart(6, "0")}`;
}
function normalizeOptionalText(value) {
  const normalized = value == null ? void 0 : value.trim();
  return normalized ? normalized : null;
}
function buildUserDisplayName(firstName, lastName) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}
function normalizeUsernamePart(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}
function buildUsernameBase(firstName, lastName, documentNumber) {
  const firstPart = normalizeUsernamePart(firstName).slice(0, 3).padEnd(3, "x");
  const lastPart = normalizeUsernamePart(lastName).slice(0, 3).padEnd(3, "x");
  const documentDigits = documentNumber.replace(/\D/g, "");
  const documentPart = documentDigits.slice(-3).padStart(3, "0");
  return `${firstPart}${lastPart}${documentPart}`;
}
async function generateUniqueUsername(params) {
  const baseUsername = buildUsernameBase(params.firstName, params.lastName, params.documentNumber);
  let counter = 0;
  let candidate = baseUsername;
  let existing = true;
  while (existing) {
    const suffix = counter === 0 ? "" : String(counter + 1).padStart(2, "0");
    candidate = `${baseUsername}${suffix}`;
    existing = Boolean(
      await params.prismaClient.user.findFirst({
        where: {
          username: candidate,
          ...params.excludeUserId ? { NOT: { id: params.excludeUserId } } : {}
        },
        select: { id: true }
      })
    );
    counter += 1;
  }
  return candidate;
}
function parseBirthDate(value) {
  if (!value)
    return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day)
    return null;
  return new Date(Date.UTC(year, month - 1, day));
}
function mapRoleKeyToPrismaRole(roleKey) {
  return roleKey === "ADMIN" ? Role.ADMIN : Role.EMPLOYEE;
}
function roleProfileSystemKey(roleKey) {
  return `SYSTEM_${roleKey}`;
}
function hasCurrentSessionPermission(permissionKey) {
  var _a;
  if (!permissionKey)
    return true;
  return Boolean((_a = currentSessionUser == null ? void 0 : currentSessionUser.permissions) == null ? void 0 : _a.includes(permissionKey));
}
async function loadPermissionKeysForRoleProfile(prismaClient, roleProfileId) {
  if (!roleProfileId)
    return [];
  const records = await prismaClient.rolePermission.findMany({
    where: {
      roleProfileId,
      allowed: true
    },
    select: { permissionKey: true },
    orderBy: { permissionKey: "asc" }
  });
  return records.map((record) => record.permissionKey);
}
async function resolveRoleProfileForUser(prismaClient, userId) {
  var _a, _b, _c, _d;
  const user = await prismaClient.user.findUnique({
    where: { id: userId },
    include: {
      roleProfile: {
        include: {
          permissions: {
            where: { allowed: true },
            orderBy: { permissionKey: "asc" }
          }
        }
      }
    }
  });
  if (!user)
    return null;
  const permissions = ((_a = user.roleProfile) == null ? void 0 : _a.permissions.map((permission) => permission.permissionKey)) ?? ((_b = await prismaClient.roleProfile.findUnique({
    where: { key: roleProfileSystemKey(user.role) },
    include: {
      permissions: {
        where: { allowed: true },
        orderBy: { permissionKey: "asc" }
      }
    }
  })) == null ? void 0 : _b.permissions.map((permission) => permission.permissionKey)) ?? [];
  return {
    roleProfileId: ((_c = user.roleProfile) == null ? void 0 : _c.id) ?? null,
    roleProfileName: ((_d = user.roleProfile) == null ? void 0 : _d.name) ?? null,
    permissions
  };
}
async function ensureUserSchemaIfNeeded(prismaClient) {
  const columns = await prismaClient.$queryRawUnsafe(`PRAGMA table_info("User");`);
  const existingColumns = new Set(columns.map((column) => column.name));
  const statements = [];
  if (!existingColumns.has("firstName")) {
    statements.push(`ALTER TABLE "User" ADD COLUMN "firstName" TEXT;`);
  }
  if (!existingColumns.has("lastName")) {
    statements.push(`ALTER TABLE "User" ADD COLUMN "lastName" TEXT;`);
  }
  if (!existingColumns.has("documentNumber")) {
    statements.push(`ALTER TABLE "User" ADD COLUMN "documentNumber" TEXT;`);
  }
  if (!existingColumns.has("email")) {
    statements.push(`ALTER TABLE "User" ADD COLUMN "email" TEXT;`);
  }
  if (!existingColumns.has("phone")) {
    statements.push(`ALTER TABLE "User" ADD COLUMN "phone" TEXT;`);
  }
  if (!existingColumns.has("address")) {
    statements.push(`ALTER TABLE "User" ADD COLUMN "address" TEXT;`);
  }
  if (!existingColumns.has("birthDate")) {
    statements.push(`ALTER TABLE "User" ADD COLUMN "birthDate" DATETIME;`);
  }
  if (!existingColumns.has("internalCode")) {
    statements.push(`ALTER TABLE "User" ADD COLUMN "internalCode" TEXT;`);
  }
  for (const statement of statements) {
    await prismaClient.$executeRawUnsafe(statement);
  }
  await prismaClient.$executeRawUnsafe(`
    UPDATE "User"
    SET "firstName" = "name"
    WHERE "name" IS NOT NULL
      AND ("firstName" IS NULL OR TRIM("firstName") = '');
  `);
  await prismaClient.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "User_documentNumber_key" ON "User"("documentNumber");`
  );
  const users = await prismaClient.user.findMany({
    select: {
      id: true,
      internalCode: true
    },
    orderBy: [{ createdAt: "asc" }, { username: "asc" }]
  });
  const assignedCodes = [];
  for (const user of users) {
    const internalCode = resolveManagedCode({
      desiredCode: user.internalCode,
      existingCodes: assignedCodes,
      prefix: "USR",
      digits: 4,
      maxLength: 30
    });
    if (internalCode !== user.internalCode) {
      await prismaClient.user.update({
        where: { id: user.id },
        data: { internalCode }
      });
    }
    assignedCodes.push(internalCode);
  }
  await prismaClient.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "User_internalCode_key" ON "User"("internalCode");`
  );
}
async function ensureProductSchemaIfNeeded(prismaClient) {
  const columns = await prismaClient.$queryRawUnsafe(`PRAGMA table_info("Product");`);
  const existingColumns = new Set(columns.map((column) => column.name));
  if (!existingColumns.has("unitMeasure")) {
    await prismaClient.$executeRawUnsafe(
      `ALTER TABLE "Product" ADD COLUMN "unitMeasure" TEXT NOT NULL DEFAULT 'UNIDAD';`
    );
  }
  await prismaClient.$executeRawUnsafe(`
    UPDATE "Product"
    SET "unitMeasure" = 'UNIDAD'
    WHERE "unitMeasure" IS NULL OR TRIM("unitMeasure") = '';
  `);
}
async function ensureRoleSchemaIfNeeded(prismaClient) {
  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RoleProfile" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "key" TEXT,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "baseRole" TEXT NOT NULL DEFAULT 'EMPLOYEE',
      "isSystem" BOOLEAN NOT NULL DEFAULT false,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prismaClient.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "RoleProfile_key_key" ON "RoleProfile"("key");
  `);
  await prismaClient.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "RoleProfile_name_key" ON "RoleProfile"("name");
  `);
  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RolePermission" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "roleProfileId" TEXT NOT NULL,
      "permissionKey" TEXT NOT NULL,
      "allowed" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "RolePermission_roleProfileId_fkey" FOREIGN KEY ("roleProfileId") REFERENCES "RoleProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  await prismaClient.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "RolePermission_roleProfileId_permissionKey_key"
    ON "RolePermission"("roleProfileId", "permissionKey");
  `);
  await prismaClient.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "RolePermission_roleProfileId_idx"
    ON "RolePermission"("roleProfileId");
  `);
  const userColumns = await prismaClient.$queryRawUnsafe(`PRAGMA table_info("User");`);
  const existingUserColumns = new Set(userColumns.map((column) => column.name));
  if (!existingUserColumns.has("roleProfileId")) {
    await prismaClient.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "roleProfileId" TEXT;`);
  }
  await prismaClient.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "User_roleProfileId_idx"
    ON "User"("roleProfileId");
  `);
}
async function seedRoleProfilesIfNeeded(prismaClient) {
  for (const definition of ROLE_DEFINITIONS) {
    const permissionCatalog = flattenRolePermissionCatalog(definition);
    const existingProfile = await prismaClient.roleProfile.findUnique({
      where: { key: roleProfileSystemKey(definition.key) },
      select: { id: true }
    });
    const roleProfile = existingProfile ? await prismaClient.roleProfile.update({
      where: { id: existingProfile.id },
      data: {
        name: definition.name,
        description: definition.description,
        baseRole: mapRoleKeyToPrismaRole(definition.key),
        isSystem: true
      }
    }) : await prismaClient.roleProfile.create({
      data: {
        key: roleProfileSystemKey(definition.key),
        name: definition.name,
        description: definition.description,
        baseRole: mapRoleKeyToPrismaRole(definition.key),
        isSystem: true,
        isActive: true
      }
    });
    const existingPermissionCount = await prismaClient.rolePermission.count({
      where: { roleProfileId: roleProfile.id }
    });
    if (existingPermissionCount === 0 && permissionCatalog.length > 0) {
      await prismaClient.rolePermission.createMany({
        data: permissionCatalog.map((permission) => ({
          roleProfileId: roleProfile.id,
          permissionKey: permission.key,
          allowed: true
        }))
      });
    }
  }
  const systemProfiles = await prismaClient.roleProfile.findMany({
    where: { key: { in: ROLE_DEFINITIONS.map((definition) => roleProfileSystemKey(definition.key)) } },
    select: { id: true, baseRole: true }
  });
  for (const profile of systemProfiles) {
    await prismaClient.user.updateMany({
      where: {
        role: profile.baseRole,
        roleProfileId: null
      },
      data: {
        roleProfileId: profile.id
      }
    });
  }
}
async function bootstrapAppData() {
  await ensureCorrespondentSchemaIfNeeded(prisma);
  await seedCoreConfigIfNeeded(prisma);
  await seedCorrespondentCatalogIfNeeded(prisma);
  registerCorrespondentIpcHandlers({
    app,
    ipcMain,
    prisma,
    getCurrentSessionUser: () => currentSessionUser
  });
}
app.whenReady().then(async () => {
  const dbPath = path.join(app.getPath("userData"), "app.db").replace(/\\/g, "/");
  process.env.DATABASE_URL = `file:${dbPath}`;
  prisma = new PrismaClient();
  appConnectedAt = /* @__PURE__ */ new Date();
  await ensureUserSchemaIfNeeded(prisma);
  await ensureRoleSchemaIfNeeded(prisma);
  await ensureBackofficeSchemaIfNeeded(prisma);
  await seedAdminIfNeeded(prisma);
  await seedRoleProfilesIfNeeded(prisma);
  await ensureProductSchemaIfNeeded(prisma);
  registerBackofficeIpcHandlers({
    ipcMain,
    prisma,
    getCurrentSessionUser: () => currentSessionUser,
    getConnectedAt: () => appConnectedAt
  });
  await bootstrapAppData();
  createWindow();
}).catch((error) => {
  console.error("No se pudo inicializar la aplicacion POS.", error);
  app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
ipcMain.handle("auth:login", async (_event, payload) => {
  const parsed = loginInputSchema.safeParse(payload);
  if (!parsed.success) {
    await logLoginEvent({
      username: String((payload == null ? void 0 : payload.username) ?? ""),
      success: false,
      reason: "invalid_payload"
    });
    return { success: false, message: "Datos invalidos" };
  }
  const { username, password } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { username }
  });
  if (!user || !user.isActive) {
    await logLoginEvent({
      username,
      success: false,
      reason: "user_not_found_or_inactive"
    });
    return { success: false, message: "Usuario o contrasena incorrectos" };
  }
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    await logLoginEvent({
      userId: user.id,
      username,
      success: false,
      reason: "wrong_password"
    });
    return { success: false, message: "Usuario o contrasena incorrectos" };
  }
  await logLoginEvent({
    userId: user.id,
    username,
    success: true
  });
  const roleProfile = await resolveRoleProfileForUser(prisma, user.id);
  currentSessionUser = {
    id: user.id,
    username: user.username,
    name: user.name ?? void 0,
    role: user.role,
    roleProfileId: (roleProfile == null ? void 0 : roleProfile.roleProfileId) ?? null,
    roleProfileName: (roleProfile == null ? void 0 : roleProfile.roleProfileName) ?? null,
    permissions: (roleProfile == null ? void 0 : roleProfile.permissions) ?? []
  };
  return {
    success: true,
    user: currentSessionUser
  };
});
ipcMain.handle("auth:createUser", async (_event, payload) => {
  const parsed = createUserInputSchema.safeParse(payload);
  if (!parsed.success)
    return { success: false, message: "Datos invalidos" };
  if (!currentSessionUser || currentSessionUser.role !== Role.ADMIN) {
    return { success: false, message: "Solo admins pueden crear usuarios" };
  }
  if (!hasCurrentSessionPermission(APP_PERMISSION_KEYS.usersCreate)) {
    return { success: false, message: "Tu rol no puede crear usuarios" };
  }
  const {
    internalCode: desiredInternalCode,
    firstName,
    lastName,
    documentNumber,
    email,
    phone,
    address,
    birthDate,
    newPassword,
    role,
    roleProfileId,
    isActive
  } = parsed.data;
  const passwordHash = await bcrypt.hash(newPassword, 10);
  const fullName = buildUserDisplayName(firstName, lastName);
  try {
    const duplicateDocument = await prisma.user.findFirst({
      where: { documentNumber },
      select: { id: true }
    });
    if (duplicateDocument) {
      return { success: false, message: "La cedula ya esta registrada para otro usuario" };
    }
    const selectedRoleProfile = roleProfileId ? await prisma.roleProfile.findUnique({
      where: { id: roleProfileId },
      select: { id: true, baseRole: true, isActive: true }
    }) : await prisma.roleProfile.findUnique({
      where: { key: roleProfileSystemKey(role ?? Role.EMPLOYEE) },
      select: { id: true, baseRole: true, isActive: true }
    });
    if (!selectedRoleProfile || !selectedRoleProfile.isActive) {
      return { success: false, message: "El perfil de rol seleccionado no esta disponible" };
    }
    const username = await generateUniqueUsername({
      prismaClient: prisma,
      firstName,
      lastName,
      documentNumber
    });
    const existingInternalCodes = (await prisma.user.findMany({
      select: { internalCode: true }
    })).map((user) => user.internalCode);
    const internalCode = resolveManagedCode({
      desiredCode: desiredInternalCode,
      existingCodes: existingInternalCodes,
      prefix: "USR",
      digits: 4,
      maxLength: 30
    });
    await prisma.user.create({
      data: {
        internalCode,
        username,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        name: fullName,
        documentNumber,
        email: normalizeOptionalText(email),
        phone: normalizeOptionalText(phone),
        address: normalizeOptionalText(address),
        birthDate: parseBirthDate(birthDate),
        passwordHash,
        role: selectedRoleProfile.baseRole,
        roleProfileId: selectedRoleProfile.id,
        isActive: isActive ?? true
      }
    });
    return { success: true, username };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear el usuario";
    return { success: false, message };
  }
});
ipcMain.handle("users:update", async (_event, payload) => {
  const parsed = updateUserInputSchema.safeParse(payload);
  if (!parsed.success)
    return { success: false, message: "Datos invalidos" };
  if (!currentSessionUser || currentSessionUser.role !== Role.ADMIN) {
    return { success: false, message: "Solo admins pueden editar usuarios" };
  }
  if (!hasCurrentSessionPermission(APP_PERMISSION_KEYS.usersEdit)) {
    return { success: false, message: "Tu rol no puede editar usuarios" };
  }
  const {
    id,
    internalCode: desiredInternalCode,
    firstName,
    lastName,
    documentNumber,
    email,
    phone,
    address,
    birthDate,
    newPassword,
    role,
    roleProfileId,
    isActive
  } = parsed.data;
  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, isActive: true, roleProfileId: true, internalCode: true }
  });
  if (!existingUser) {
    return { success: false, message: "El usuario ya no existe" };
  }
  const duplicateDocument = await prisma.user.findFirst({
    where: {
      documentNumber,
      NOT: { id }
    },
    select: { id: true }
  });
  if (duplicateDocument) {
    return { success: false, message: "La cedula ya esta registrada para otro usuario" };
  }
  const selectedRoleProfile = roleProfileId ? await prisma.roleProfile.findUnique({
    where: { id: roleProfileId },
    select: { id: true, baseRole: true, isActive: true, name: true }
  }) : await prisma.roleProfile.findUnique({
    where: { key: roleProfileSystemKey(role ?? existingUser.role) },
    select: { id: true, baseRole: true, isActive: true, name: true }
  });
  if (!selectedRoleProfile || !selectedRoleProfile.isActive) {
    return { success: false, message: "El perfil de rol seleccionado no esta disponible" };
  }
  if (existingUser.role === Role.ADMIN && (selectedRoleProfile.baseRole !== Role.ADMIN || !isActive)) {
    const remainingAdmins = await prisma.user.count({
      where: {
        role: Role.ADMIN,
        isActive: true,
        NOT: { id }
      }
    });
    if (remainingAdmins === 0) {
      return { success: false, message: "Debe existir al menos un administrador activo" };
    }
  }
  const username = await generateUniqueUsername({
    prismaClient: prisma,
    firstName,
    lastName,
    documentNumber,
    excludeUserId: id
  });
  const fullName = buildUserDisplayName(firstName, lastName);
  try {
    const existingInternalCodes = (await prisma.user.findMany({
      where: { NOT: { id } },
      select: { internalCode: true }
    })).map((user) => user.internalCode);
    const internalCode = resolveManagedCode({
      desiredCode: desiredInternalCode,
      existingCodes: existingInternalCodes,
      prefix: "USR",
      digits: 4,
      maxLength: 30
    });
    await prisma.user.update({
      where: { id },
      data: {
        internalCode,
        username,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        name: fullName,
        documentNumber,
        email: normalizeOptionalText(email),
        phone: normalizeOptionalText(phone),
        address: normalizeOptionalText(address),
        birthDate: parseBirthDate(birthDate),
        role: selectedRoleProfile.baseRole,
        roleProfileId: selectedRoleProfile.id,
        isActive,
        ...(newPassword == null ? void 0 : newPassword.trim()) ? {
          passwordHash: await bcrypt.hash(newPassword, 10)
        } : {}
      }
    });
    if (currentSessionUser.id === id) {
      currentSessionUser = {
        ...currentSessionUser,
        username,
        name: fullName,
        role: selectedRoleProfile.baseRole,
        roleProfileId: selectedRoleProfile.id,
        roleProfileName: selectedRoleProfile.name,
        permissions: await loadPermissionKeysForRoleProfile(prisma, selectedRoleProfile.id)
      };
    }
    return { success: true, username };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar el usuario";
    return { success: false, message };
  }
});
ipcMain.handle("auth:get-profile", async () => {
  var _a;
  if (!currentSessionUser) {
    return { success: false, message: "Debes iniciar sesion" };
  }
  const profile = await prisma.user.findUnique({
    where: { id: currentSessionUser.id },
    select: {
      id: true,
      username: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      birthDate: true,
      role: true
    }
  });
  if (!profile) {
    return { success: false, message: "Tu usuario ya no existe" };
  }
  return {
    success: true,
    profile: {
      ...profile,
      birthDate: ((_a = profile.birthDate) == null ? void 0 : _a.toISOString().slice(0, 10)) ?? null
    }
  };
});
ipcMain.handle("auth:update-profile", async (_event, payload) => {
  var _a;
  const parsed = updateOwnProfileInputSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, message: "Datos invalidos" };
  }
  if (!currentSessionUser) {
    return { success: false, message: "Debes iniciar sesion" };
  }
  const { firstName, lastName, phone, birthDate } = parsed.data;
  const fullName = buildUserDisplayName(firstName, lastName);
  const updated = await prisma.user.update({
    where: { id: currentSessionUser.id },
    data: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      name: fullName,
      phone: normalizeOptionalText(phone),
      birthDate: parseBirthDate(birthDate)
    },
    select: {
      id: true,
      username: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      birthDate: true,
      role: true
    }
  });
  currentSessionUser = {
    ...currentSessionUser,
    name: fullName
  };
  return {
    success: true,
    user: currentSessionUser,
    profile: {
      ...updated,
      birthDate: ((_a = updated.birthDate) == null ? void 0 : _a.toISOString().slice(0, 10)) ?? null
    }
  };
});
ipcMain.handle("auth:change-password", async (_event, payload) => {
  const parsed = changeOwnPasswordInputSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, message: "Datos invalidos" };
  }
  if (!currentSessionUser) {
    return { success: false, message: "Debes iniciar sesion" };
  }
  const { currentPassword, newPassword, confirmPassword } = parsed.data;
  if (newPassword !== confirmPassword) {
    return { success: false, message: "La confirmacion no coincide con la nueva contrasena" };
  }
  const user = await prisma.user.findUnique({
    where: { id: currentSessionUser.id },
    select: { id: true, passwordHash: true }
  });
  if (!user) {
    return { success: false, message: "Tu usuario ya no existe" };
  }
  const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isCurrentValid) {
    return { success: false, message: "La contrasena actual es incorrecta" };
  }
  const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
  if (isSamePassword) {
    return { success: false, message: "La nueva contrasena debe ser diferente a la anterior" };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(newPassword, 10)
    }
  });
  return { success: true };
});
ipcMain.handle("roles:list", async () => {
  if (!currentSessionUser || currentSessionUser.role !== Role.ADMIN) {
    return { success: false, message: "Solo admins pueden ver roles", roles: [] };
  }
  if (!hasCurrentSessionPermission(APP_PERMISSION_KEYS.rolesView)) {
    return { success: false, message: "Tu rol no puede ver roles", roles: [] };
  }
  const roles = await prisma.roleProfile.findMany({
    include: {
      permissions: {
        where: { allowed: true },
        orderBy: { permissionKey: "asc" },
        select: { permissionKey: true }
      },
      _count: {
        select: { users: true }
      }
    },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }]
  });
  return {
    success: true,
    roles: roles.map((roleProfile) => ({
      id: roleProfile.id,
      key: roleProfile.key,
      name: roleProfile.name,
      description: roleProfile.description,
      baseRole: roleProfile.baseRole,
      isSystem: roleProfile.isSystem,
      isActive: roleProfile.isActive,
      permissionKeys: roleProfile.permissions.map((permission) => permission.permissionKey),
      usersCount: roleProfile._count.users,
      createdAt: roleProfile.createdAt.toISOString(),
      updatedAt: roleProfile.updatedAt.toISOString()
    }))
  };
});
ipcMain.handle("roles:create", async (_event, payload) => {
  const parsed = createRoleProfileInputSchema.safeParse(payload);
  if (!parsed.success)
    return { success: false, message: "Datos invalidos para el rol" };
  if (!currentSessionUser || currentSessionUser.role !== Role.ADMIN) {
    return { success: false, message: "Solo admins pueden crear roles" };
  }
  if (!hasCurrentSessionPermission(APP_PERMISSION_KEYS.rolesManage)) {
    return { success: false, message: "Tu rol no puede crear roles" };
  }
  if (parsed.data.permissionKeys.length > 0) {
    const invalidPermission = parsed.data.permissionKeys.find(
      (permissionKey) => !getPermissionCatalogItem(parsed.data.baseRole, permissionKey)
    );
    if (invalidPermission) {
      return { success: false, message: "Uno o mas permisos no pertenecen al rol base seleccionado" };
    }
  }
  try {
    const created = await prisma.roleProfile.create({
      data: {
        name: parsed.data.name.trim(),
        description: normalizeOptionalText(parsed.data.description),
        baseRole: parsed.data.baseRole,
        isSystem: false,
        isActive: parsed.data.isActive ?? true,
        permissions: {
          create: parsed.data.permissionKeys.map((permissionKey) => ({
            permissionKey,
            allowed: true
          }))
        }
      },
      select: { id: true }
    });
    return { success: true, roleId: created.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear el rol";
    return { success: false, message };
  }
});
ipcMain.handle("roles:update", async (_event, payload) => {
  const parsed = updateRoleProfileInputSchema.safeParse(payload);
  if (!parsed.success)
    return { success: false, message: "Datos invalidos para el rol" };
  if (!currentSessionUser || currentSessionUser.role !== Role.ADMIN) {
    return { success: false, message: "Solo admins pueden editar roles" };
  }
  if (!hasCurrentSessionPermission(APP_PERMISSION_KEYS.rolesManage)) {
    return { success: false, message: "Tu rol no puede editar roles" };
  }
  const existing = await prisma.roleProfile.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, baseRole: true, isSystem: true, name: true }
  });
  if (!existing) {
    return { success: false, message: "El rol ya no existe" };
  }
  const invalidPermission = parsed.data.permissionKeys.find(
    (permissionKey) => !getPermissionCatalogItem(existing.baseRole, permissionKey)
  );
  if (invalidPermission) {
    return { success: false, message: "Uno o mas permisos no pertenecen al rol base seleccionado" };
  }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.roleProfile.update({
        where: { id: parsed.data.id },
        data: {
          name: parsed.data.name.trim(),
          description: normalizeOptionalText(parsed.data.description),
          isActive: parsed.data.isActive ?? true
        }
      });
      await tx.rolePermission.deleteMany({ where: { roleProfileId: parsed.data.id } });
      await tx.rolePermission.createMany({
        data: parsed.data.permissionKeys.map((permissionKey) => ({
          roleProfileId: parsed.data.id,
          permissionKey,
          allowed: true
        }))
      });
    });
    if (currentSessionUser.roleProfileId === parsed.data.id) {
      currentSessionUser = {
        ...currentSessionUser,
        roleProfileName: parsed.data.name.trim(),
        permissions: parsed.data.permissionKeys
      };
    }
    return { success: true, roleId: parsed.data.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar el rol";
    return { success: false, message };
  }
});
ipcMain.handle("auth:logout", async () => {
  currentSessionUser = null;
  return { success: true };
});
ipcMain.handle("products:list", async () => {
  const products = await prisma.product.findMany({
    where: { isActive: true, stock: { gt: 0 } },
    include: {
      category: true,
      subcategory: true
    },
    orderBy: { name: "asc" }
  });
  return products.map((product) => {
    var _a, _b;
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      price: product.price,
      cost: product.cost,
      taxRate: product.taxRate,
      stock: product.stock,
      category: ((_a = product.category) == null ? void 0 : _a.name) ?? null,
      subcategory: ((_b = product.subcategory) == null ? void 0 : _b.name) ?? null
    };
  });
});
ipcMain.handle("sales:create", async (_event, payload) => {
  var _a, _b, _c;
  if (!currentSessionUser) {
    return { success: false, message: "Debes iniciar sesion para vender" };
  }
  if (!hasCurrentSessionPermission(APP_PERMISSION_KEYS.salesCreate)) {
    return { success: false, message: "Tu rol no puede registrar ventas" };
  }
  if (!hasCurrentSessionPermission(APP_PERMISSION_KEYS.salesManagePayments)) {
    return { success: false, message: "Tu rol no puede gestionar pagos" };
  }
  const parsed = createSaleSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, message: "Datos invalidos para la venta" };
  }
  let selectedCustomer = null;
  if (parsed.data.customerId) {
    selectedCustomer = await prisma.customer.findFirst({
      where: {
        id: parsed.data.customerId,
        isActive: true
      },
      select: {
        id: true,
        name: true
      }
    });
    if (!selectedCustomer) {
      return { success: false, message: "El cliente seleccionado ya no esta disponible" };
    }
  }
  const saleCustomerName = (selectedCustomer == null ? void 0 : selectedCustomer.name) ?? ((_a = parsed.data.customer) == null ? void 0 : _a.trim()) ?? "Consumidor final";
  if (saleCustomerName !== "Consumidor final" && !hasCurrentSessionPermission(APP_PERMISSION_KEYS.salesChangeCustomer)) {
    return { success: false, message: "Tu rol no puede cambiar el cliente en la factura" };
  }
  const productIds = parsed.data.items.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      isActive: true
    }
  });
  if (products.length !== productIds.length) {
    return { success: false, message: "Uno o mas productos ya no estan disponibles" };
  }
  const productMap = new Map(products.map((product) => [product.id, product]));
  const normalizedItems = parsed.data.items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new Error("Producto no encontrado");
    }
    if (product.stock < item.qty) {
      throw new Error(`Stock insuficiente para ${product.name}`);
    }
    const lineSubtotal = money(product.price * item.qty);
    const lineTax = money(lineSubtotal * product.taxRate);
    const lineTotal = lineSubtotal + lineTax;
    const lineProfit = money((product.price - product.cost) * item.qty);
    return {
      product,
      qty: item.qty,
      lineSubtotal,
      lineTax,
      lineTotal,
      lineProfit
    };
  });
  const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineSubtotal, 0);
  const tax = normalizedItems.reduce((sum, item) => sum + item.lineTax, 0);
  const total = subtotal + tax;
  const costTotal = normalizedItems.reduce((sum, item) => sum + item.product.cost * item.qty, 0);
  const profit = normalizedItems.reduce((sum, item) => sum + item.lineProfit, 0);
  const requestedPayments = parsed.data.payments && parsed.data.payments.length > 0 ? parsed.data.payments : [
    {
      method: parsed.data.paymentMethod,
      amount: parsed.data.amountPaid ?? total
    }
  ];
  const normalizedPayments = requestedPayments.map((payment) => ({
    method: payment.method,
    amount: money(payment.amount)
  })).filter((payment) => payment.amount > 0);
  if (normalizedPayments.length === 0 && !parsed.data.allowDebt) {
    return { success: false, message: "Debes registrar al menos un pago para completar la venta" };
  }
  const amountPaid = normalizedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const changeAmount = Math.max(0, amountPaid - total);
  const cashReceived = normalizedPayments.filter((payment) => payment.method === "CASH").reduce((sum, payment) => sum + payment.amount, 0);
  if (changeAmount > cashReceived) {
    return { success: false, message: "Las vueltas solo pueden salir de un pago en efectivo" };
  }
  let remainingAmount = total;
  const appliedTotals = /* @__PURE__ */ new Map();
  for (const payment of normalizedPayments) {
    if (remainingAmount <= 0)
      break;
    const appliedAmount = Math.min(payment.amount, remainingAmount);
    if (appliedAmount <= 0)
      continue;
    appliedTotals.set(
      payment.method,
      (appliedTotals.get(payment.method) ?? 0) + appliedAmount
    );
    remainingAmount -= appliedAmount;
  }
  const primaryPaymentMethod = ((_b = [...appliedTotals.entries()].sort((a, b) => b[1] - a[1])[0]) == null ? void 0 : _b[0]) ?? (((_c = normalizedPayments[0]) == null ? void 0 : _c.method) ?? parsed.data.paymentMethod);
  const appliedCashAmount = appliedTotals.get(PaymentMethod.CASH) ?? 0;
  if (parsed.data.clientTotal !== void 0 && Math.abs(parsed.data.clientTotal - total) > 1) {
    return { success: false, message: "El total enviado no coincide con el calculo del sistema" };
  }
  if (amountPaid < total && !parsed.data.allowDebt) {
    return { success: false, message: "El pago recibido no alcanza para cubrir la venta" };
  }
  try {
    const sale = await prisma.$transaction(async (tx) => {
      const nextSequence = await tx.sale.count() + 1;
      const businessSettings = await tx.businessSettings.findUnique({
        where: { id: "default" },
        select: { invoicePrefix: true }
      });
      const invoiceNumber = buildInvoiceNumber((businessSettings == null ? void 0 : businessSettings.invoicePrefix) || "FV", nextSequence);
      const activeCashSession = await tx.cashSession.findFirst({
        where: {
          userId: currentSessionUser.id,
          status: "OPEN"
        },
        orderBy: { openedAt: "desc" }
      });
      const createdSale = await tx.sale.create({
        data: {
          invoiceNumber,
          customer: saleCustomerName,
          customerId: (selectedCustomer == null ? void 0 : selectedCustomer.id) ?? null,
          paymentMethod: primaryPaymentMethod,
          subtotal,
          tax,
          total,
          costTotal,
          profit,
          cashierId: currentSessionUser.id,
          cashSessionId: (activeCashSession == null ? void 0 : activeCashSession.id) ?? null,
          items: {
            create: normalizedItems.map((item) => ({
              productId: item.product.id,
              sku: item.product.sku,
              barcode: item.product.barcode,
              name: item.product.name,
              price: item.product.price,
              cost: item.product.cost,
              qty: item.qty,
              taxRate: item.product.taxRate,
              lineSubtotal: item.lineSubtotal,
              lineTax: item.lineTax,
              lineTotal: item.lineTotal,
              lineProfit: item.lineProfit
            }))
          },
          payments: {
            create: normalizedPayments.map((payment) => ({
              method: payment.method,
              amount: payment.amount
            }))
          }
        }
      });
      if (activeCashSession && appliedCashAmount > 0) {
        await tx.cashMovement.create({
          data: {
            sessionId: activeCashSession.id,
            type: CashMovementType.SALE_IN,
            amount: appliedCashAmount,
            note: createdSale.invoiceNumber
          }
        });
      }
      for (const item of normalizedItems) {
        await tx.product.update({
          where: { id: item.product.id },
          data: {
            stock: { decrement: item.qty }
          }
        });
        await tx.inventoryMovement.create({
          data: {
            productId: item.product.id,
            type: InventoryMovementType.SALE_OUT,
            qty: item.qty,
            stockBefore: item.product.stock,
            stockAfter: item.product.stock - item.qty,
            referenceType: "SALE",
            referenceId: createdSale.id,
            note: createdSale.invoiceNumber
          }
        });
      }
      return createdSale;
    });
    return {
      success: true,
      saleId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      total,
      amountPaid,
      changeAmount
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar la venta";
    return { success: false, message };
  }
});
ipcMain.handle("dashboard:stats", async (_event, range = "day") => {
  const normalizedRange = ["day", "week", "month"].includes(range) ? range : "day";
  const startDate = startOfRange(normalizedRange);
  const sales = await prisma.sale.findMany({
    where: { createdAt: { gte: startDate } },
    include: { items: true },
    orderBy: { createdAt: "desc" }
  });
  const revenue = sales.reduce((sum, sale) => sum + sale.total, 0);
  const profit = sales.reduce((sum, sale) => sum + sale.profit, 0);
  const tax = sales.reduce((sum, sale) => sum + sale.tax, 0);
  const averageTicket = sales.length > 0 ? money(revenue / sales.length) : 0;
  const paymentSummary = sales.reduce((acc, sale) => {
    acc[sale.paymentMethod] = (acc[sale.paymentMethod] ?? 0) + sale.total;
    return acc;
  }, {});
  const topProductsMap = sales.flatMap((sale) => sale.items).reduce((acc, item) => {
    const current = acc[item.name] ?? { name: item.name, qty: 0, total: 0 };
    current.qty += item.qty;
    current.total += item.lineTotal;
    acc[item.name] = current;
    return acc;
  }, {});
  const topProducts = Object.values(topProductsMap).sort((a, b) => b.qty - a.qty).slice(0, 5);
  const lowStock = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: [{ stock: "asc" }, { name: "asc" }],
    take: 5,
    select: {
      id: true,
      name: true,
      stock: true,
      sku: true
    }
  });
  return {
    range: normalizedRange,
    totals: {
      salesCount: sales.length,
      revenue,
      profit,
      tax,
      averageTicket
    },
    paymentSummary: [
      { label: "Efectivo", value: paymentSummary.CASH ?? 0 },
      { label: "Transferencia", value: (paymentSummary.CARD ?? 0) + (paymentSummary.TRANSFER ?? 0) }
    ],
    topProducts,
    recentSales: sales.slice(0, 6).map((sale) => ({
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      customer: sale.customer,
      total: sale.total,
      createdAt: sale.createdAt.toISOString(),
      itemsCount: sale.items.length
    })),
    lowStock
  };
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("quit", async () => {
  await (prisma == null ? void 0 : prisma.$disconnect());
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL,
  seedAdminIfNeeded
};
