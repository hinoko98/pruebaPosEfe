import { BrowserWindow, app, ipcMain, Menu } from "electron";
import bcrypt from "bcryptjs";
import "dotenv/config";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CorrespondentDirection, CommissionMode, CorrespondentTransactionStatus, CorrespondentReconciliationStatus, CorrespondentOcrStatus, CorrespondentClosureStatus, SaleStatus, CashSessionStatus, PaymentMethod, CashMovementType, InventoryMovementType, PurchaseStatus, Role, PrismaClient } from "@prisma/client";
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
    name: z.string().optional()
  }).optional()
});
const createUserInputSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  newUsername: z.string().trim().min(3).max(50),
  newPassword: z.string().min(6).max(200),
  role: roleSchema.optional().default("EMPLOYEE")
});
const paymentMethodSchema = z.enum(["CASH", "CARD", "TRANSFER"]);
const saleItemInputSchema = z.object({
  productId: z.string().uuid("productId invalido"),
  qty: z.number().int("La cantidad debe ser entera").positive("La cantidad debe ser mayor a 0")
});
const createSaleSchema = z.object({
  customer: z.string().trim().max(120).optional().default("Consumidor final"),
  paymentMethod: paymentMethodSchema.optional().default("CASH"),
  amountPaid: z.number().min(0).optional(),
  items: z.array(saleItemInputSchema).min(1, "La venta debe tener al menos un item"),
  clientTotal: z.number().min(0).optional()
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
const correspondentEvidenceInputSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.string().trim().max(120).optional(),
  dataBase64: z.string().min(1),
  ocrRawText: z.string().trim().max(1e4).optional()
});
const createCorrespondentTransactionSchema = z.object({
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
  rawExtractedText: z.string().trim().max(1e4).optional().nullable(),
  source: correspondentTransactionSourceSchema.optional().default("MANUAL"),
  evidence: correspondentEvidenceInputSchema.optional()
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
  reportedBalance: z.number().int("El valor reportado debe ser entero").min(0),
  note: z.string().trim().max(300).optional().nullable()
});
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
    const platforms = await prisma2.correspondentPlatform.findMany({
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
      orderBy: { name: "asc" }
    });
    return {
      success: true,
      platforms: platforms.map((platform) => ({
        id: platform.id,
        code: platform.code,
        name: platform.name,
        requiresEvidence: platform.requiresEvidence,
        supportsOcr: platform.supportsOcr,
        supportsFileImport: platform.supportsFileImport,
        types: platform.transactionTypes.map((type) => ({
          id: type.id,
          code: type.code,
          name: type.name,
          direction: type.direction,
          requiresCustomerDocument: type.requiresCustomerDocument,
          requiresExternalReference: type.requiresExternalReference
        })),
        commissionRules: platform.commissionRules.map((rule) => ({
          id: rule.id,
          typeId: rule.typeId,
          mode: rule.mode,
          value: rule.value,
          minAmount: rule.minAmount,
          maxAmount: rule.maxAmount
        }))
      }))
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
          { externalReference: { contains: search } },
          { customerName: { contains: search } },
          { customerDocument: { contains: search } },
          { targetAccount: { contains: search } },
          { targetPhone: { contains: search } },
          { note: { contains: search } }
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
  ipcMain2.handle("correspondent:transaction:create", async (_event, payload) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
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
    if (platform.requiresEvidence && !data.evidence) {
      return { success: false, message: "Esta plataforma requiere evidencia del comprobante" };
    }
    if (type.requiresExternalReference && !((_a = data.externalReference) == null ? void 0 : _a.trim())) {
      return { success: false, message: "La referencia externa es obligatoria para este tipo" };
    }
    if (type.requiresCustomerDocument && !((_b = data.customerDocument) == null ? void 0 : _b.trim())) {
      return { success: false, message: "El documento del cliente es obligatorio para este tipo" };
    }
    const duplicate = await prisma2.correspondentTransaction.findFirst({
      where: {
        platformId: platform.id,
        typeId: type.id,
        amount: data.amount,
        externalReference: ((_c = data.externalReference) == null ? void 0 : _c.trim()) || null,
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
      const transaction = await prisma2.correspondentTransaction.create({
        data: {
          platformId: platform.id,
          typeId: type.id,
          cashSessionId: (activeCashSession == null ? void 0 : activeCashSession.id) ?? null,
          cashRegisterId: (activeCashSession == null ? void 0 : activeCashSession.registerId) ?? null,
          registeredByUserId: currentSessionUser2.id,
          status: CorrespondentTransactionStatus.REGISTERED,
          source: data.source,
          ocrStatus: ((_d = data.evidence) == null ? void 0 : _d.ocrRawText) ? CorrespondentOcrStatus.PROCESSED : platform.supportsOcr ? CorrespondentOcrStatus.NEEDS_REVIEW : CorrespondentOcrStatus.NOT_REQUESTED,
          reconciliationStatus: CorrespondentReconciliationStatus.PENDING,
          externalReference: ((_e = data.externalReference) == null ? void 0 : _e.trim()) || null,
          customerName: ((_f = data.customerName) == null ? void 0 : _f.trim()) || null,
          customerDocument: ((_g = data.customerDocument) == null ? void 0 : _g.trim()) || null,
          targetAccount: ((_h = data.targetAccount) == null ? void 0 : _h.trim()) || null,
          targetPhone: ((_i = data.targetPhone) == null ? void 0 : _i.trim()) || null,
          amount: data.amount,
          commissionAmount: computedCommission,
          netAmount,
          performedAt,
          note: ((_j = data.note) == null ? void 0 : _j.trim()) || null,
          rawExtractedText: ((_k = data.rawExtractedText) == null ? void 0 : _k.trim()) || ((_l = data.evidence) == null ? void 0 : _l.ocrRawText) || null,
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
        orderBy: { name: "asc" }
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
    return {
      success: true,
      businessDate: businessDate.toISOString(),
      closures: platforms.map((platform) => {
        const platformTransactions = transactionsByPlatform[platform.id] ?? [];
        const summary = summarizeCorrespondentTransactions(platformTransactions);
        const closure = closureByPlatform.get(platform.id) ?? null;
        return {
          platformId: platform.id,
          platform: platform.name,
          totalIn: summary.totalIn,
          totalOut: summary.totalOut,
          totalCommission: summary.totalCommission,
          expectedBalance: summary.totalIn - summary.totalOut + summary.totalCommission,
          transactionsCount: summary.transactionsCount,
          pendingTransactions: summary.pendingClosureCount,
          closure: closure ? {
            id: closure.id,
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
    const expectedBalance = summary.totalIn - summary.totalOut + summary.totalCommission;
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
const createProductSchema = z.object({
  name: z.string({ message: "El nombre es obligatorio" }).trim().min(2, "Mínimo 2 caracteres").max(120, "Máximo 120 caracteres"),
  barcode: z.string().trim().min(1).max(50).optional().nullable(),
  sku: z.string().trim().min(1).max(50).optional().nullable(),
  price: z.number({ message: "El precio es obligatorio" }).positive("El precio debe ser mayor a 0"),
  cost: z.number().min(0, "El costo no puede ser negativo").optional().default(0),
  marginPercent: z.number().min(0, "La ganancia no puede ser negativa").optional().default(0),
  hasTax: z.boolean().optional().default(false),
  taxRate: z.number().min(0).max(1, "taxRate debe ser entre 0 y 1 (ej: 0.19)").optional().default(0),
  stock: z.number().int("El stock debe ser un número entero").min(0, "El stock no puede ser negativo").optional().default(0),
  categoryId: z.string().uuid().optional().nullable(),
  subcategoryId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional().default(true)
});
const updateProductSchema = z.object({
  id: z.string().uuid("ID de producto inválido"),
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(120).optional(),
  barcode: z.string().trim().min(1).max(50).optional().nullable(),
  sku: z.string().trim().min(1).max(50).optional().nullable(),
  price: z.number().positive("El precio debe ser mayor a 0").optional(),
  cost: z.number().min(0).optional(),
  marginPercent: z.number().min(0).optional(),
  hasTax: z.boolean().optional(),
  taxRate: z.number().min(0).max(1).optional(),
  stock: z.number().int().min(0).optional(),
  categoryId: z.string().uuid().optional().nullable(),
  subcategoryId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional()
});
z.object({
  productId: z.string().uuid("ID de producto inválido"),
  delta: z.number().int("El ajuste debe ser un número entero").refine((n) => n !== 0, "El ajuste no puede ser 0"),
  reason: z.string().trim().max(200).optional()
});
z.object({
  barcode: z.string().trim().min(1, "Barcode no puede estar vacío")
});
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
  note: z.string().trim().max(300).optional().nullable(),
  cashBreakdown: z.record(z.string(), z.number()).optional().default({}),
  correspondentBalances: z.array(cashPlatformAmountSchema).optional().default([])
});
const closeCashSessionSchema = z.object({
  sessionId: z.string().uuid(),
  countedCashAmount: z.number().min(0),
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
    return "Tarjeta";
  if (value === PaymentMethod.TRANSFER)
    return "Transferencia";
  return "Efectivo";
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
            <div>Pago: ${paymentMethodLabel(sale.paymentMethod)}</div>
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
    const [activeSession, recentSessions, platforms] = await Promise.all([
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
              createdAt: true
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
      prisma2.cashSession.findMany({
        include: {
          register: true,
          user: { select: { username: true, name: true } }
        },
        orderBy: { openedAt: "desc" },
        take: 20
      }),
      prisma2.correspondentPlatform.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" }
      })
    ]);
    if (!activeSession) {
      return {
        success: true,
        activeSession: null,
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
            countedAmount: session.countedAmount,
            differenceAmount: session.differenceAmount
          };
        })
      };
    }
    const sessionMeta = parseSessionMeta(activeSession.note);
    const opening = sessionMeta.opening ?? {};
    const closing = sessionMeta.closing ?? {};
    const openingCorrespondent = opening.correspondentBalances || [];
    const closingCorrespondent = closing.correspondentBalances || [];
    const openingMap = new Map(openingCorrespondent.map((item) => [item.platformId, item.amount]));
    const closingMap = new Map(closingCorrespondent.map((item) => [item.platformId, item.amount]));
    const salesCash = activeSession.sales.filter((sale) => sale.paymentMethod === PaymentMethod.CASH).reduce((sum, sale) => sum + sale.total, 0);
    const salesCard = activeSession.sales.filter((sale) => sale.paymentMethod === PaymentMethod.CARD).reduce((sum, sale) => sum + sale.total, 0);
    const salesTransfer = activeSession.sales.filter((sale) => sale.paymentMethod === PaymentMethod.TRANSFER).reduce((sum, sale) => sum + sale.total, 0);
    const manualIncome = activeSession.movements.filter((move) => move.type === CashMovementType.INCOME_IN).reduce((sum, move) => sum + move.amount, 0);
    const manualExpense = activeSession.movements.filter((move) => move.type === CashMovementType.EXPENSE_OUT || move.type === CashMovementType.WITHDRAWAL_OUT).reduce((sum, move) => sum + move.amount, 0);
    const expectedCash = activeSession.openingAmount + salesCash + manualIncome - manualExpense;
    const correspondentByPlatform = platforms.map((platform) => {
      const platformTransactions = activeSession.correspondentTransactions.filter(
        (transaction) => transaction.platform.id === platform.id
      );
      const totalIn = platformTransactions.filter((transaction) => transaction.type.direction === CorrespondentDirection.IN).reduce((sum, transaction) => sum + transaction.amount, 0);
      const totalOut = platformTransactions.filter((transaction) => transaction.type.direction === CorrespondentDirection.OUT).reduce((sum, transaction) => sum + transaction.amount, 0);
      const totalCommission = platformTransactions.reduce(
        (sum, transaction) => sum + transaction.commissionAmount,
        0
      );
      const openingAmount = openingMap.get(platform.id) ?? 0;
      const expectedAmount = openingAmount + totalIn - totalOut + totalCommission;
      const countedAmount = closingMap.get(platform.id) ?? null;
      return {
        platformId: platform.id,
        platform: platform.name,
        openingAmount,
        totalIn,
        totalOut,
        totalCommission,
        expectedAmount,
        countedAmount,
        differenceAmount: countedAmount === null ? null : countedAmount - expectedAmount
      };
    });
    return {
      success: true,
      activeSession: {
        id: activeSession.id,
        registerName: activeSession.register.name,
        user: activeSession.user.name ?? activeSession.user.username,
        openedAt: activeSession.openedAt.toISOString(),
        openingAmount: activeSession.openingAmount,
        expectedCash,
        countedCashAmount: activeSession.countedAmount,
        cashDifferenceAmount: activeSession.countedAmount === null ? null : activeSession.countedAmount - expectedCash,
        salesCash,
        salesCard,
        salesTransfer,
        manualIncome,
        manualExpense,
        openingBreakdown: opening.cashBreakdown ?? {},
        closingBreakdown: closing.cashBreakdown ?? {},
        correspondent: correspondentByPlatform,
        recentActivity: [
          ...activeSession.sales.map((sale) => ({
            id: sale.id,
            createdAt: sale.createdAt.toISOString(),
            type: "Venta",
            detail: `${sale.invoiceNumber} - ${sale.customer}`,
            amount: sale.total
          })),
          ...activeSession.correspondentTransactions.map((transaction) => ({
            id: transaction.id,
            createdAt: transaction.performedAt.toISOString(),
            type: "Corresponsal",
            detail: `${transaction.platform.name} - ${transaction.type.name}`,
            amount: transaction.amount
          })),
          ...activeSession.movements.map((move) => ({
            id: move.id,
            createdAt: move.createdAt.toISOString(),
            type: move.type,
            detail: move.note || "Movimiento de caja",
            amount: move.amount
          }))
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 30)
      },
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
          countedAmount: session.countedAmount,
          differenceAmount: session.differenceAmount
        };
      })
    };
  });
  ipcMain2.handle("cash:open", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion" };
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
    const meta = stringifySessionMeta({
      opening: {
        cashBreakdown: parsed.data.cashBreakdown,
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
        expectedAmount: parsed.data.openingCashAmount,
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
    const parsed = closeCashSessionSchema.safeParse(payload);
    if (!parsed.success)
      return { success: false, message: "Datos invalidos para cierre de caja" };
    const session = await prisma2.cashSession.findUnique({
      where: { id: parsed.data.sessionId },
      include: {
        sales: true,
        movements: true,
        correspondentTransactions: {
          where: { status: "REGISTERED" },
          include: {
            type: { select: { direction: true } }
          }
        }
      }
    });
    if (!session || session.status !== CashSessionStatus.OPEN) {
      return { success: false, message: "La caja seleccionada no está abierta" };
    }
    const salesCash = session.sales.filter((sale) => sale.paymentMethod === PaymentMethod.CASH).reduce((sum, sale) => sum + sale.total, 0);
    const manualIncome = session.movements.filter((move) => move.type === CashMovementType.INCOME_IN).reduce((sum, move) => sum + move.amount, 0);
    const manualExpense = session.movements.filter((move) => move.type === CashMovementType.EXPENSE_OUT || move.type === CashMovementType.WITHDRAWAL_OUT).reduce((sum, move) => sum + move.amount, 0);
    const expectedCash = session.openingAmount + salesCash + manualIncome - manualExpense;
    const differenceAmount = parsed.data.countedCashAmount - expectedCash;
    const previousMeta = parseSessionMeta(session.note);
    const updatedMeta = stringifySessionMeta({
      ...previousMeta,
      closing: {
        cashBreakdown: parsed.data.cashBreakdown,
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
          expectedAmount: expectedCash,
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
            note: "Diferencia de cierre"
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
      users: users.map((user) => ({
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
        salesCount: user._count.sales,
        sessionsCount: user._count.cashSessions
      }))
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
    const parsed = createCustomerSchema.safeParse(payload);
    if (!parsed.success)
      return { success: false, message: "Datos invalidos para el cliente" };
    try {
      const customer = await prisma2.customer.create({
        data: {
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
    } catch {
      return { success: false, message: "No se pudo crear el cliente. Verifica documento o correo duplicado." };
    }
  });
  ipcMain2.handle("customers:update", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion" };
    const parsed = updateCustomerSchema.safeParse(payload);
    if (!parsed.success)
      return { success: false, message: "Datos invalidos para actualizar el cliente" };
    const current = await prisma2.customer.findUnique({ where: { id: parsed.data.id } });
    if (!current)
      return { success: false, message: "Cliente no encontrado" };
    const nextData = {
      name: buildFullName(parsed.data.firstName, parsed.data.lastName),
      document: buildDocumentValue(parsed.data.documentType, parsed.data.documentNumber),
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      isActive: parsed.data.isActive ?? current.isActive
    };
    try {
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
    } catch {
      return { success: false, message: "No se pudo actualizar el cliente. Verifica documento o correo duplicado." };
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
    const parsed = createSupplierSchema.safeParse(payload);
    if (!parsed.success)
      return { success: false, message: "Datos invalidos para el proveedor" };
    try {
      const supplier = await prisma2.supplier.create({
        data: {
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
    } catch {
      return { success: false, message: "No se pudo crear el proveedor. Verifica documento o correo duplicado." };
    }
  });
  ipcMain2.handle("suppliers:update", async (_event, payload) => {
    const currentSessionUser2 = getCurrentSessionUser();
    if (!currentSessionUser2)
      return { success: false, message: "Debes iniciar sesion" };
    const parsed = updateSupplierSchema.safeParse(payload);
    if (!parsed.success)
      return { success: false, message: "Datos invalidos para actualizar el proveedor" };
    const current = await prisma2.supplier.findUnique({ where: { id: parsed.data.id } });
    if (!current)
      return { success: false, message: "Proveedor no encontrado" };
    const nextData = {
      name: parsed.data.name,
      taxId: buildDocumentValue(parsed.data.documentType, parsed.data.documentNumber),
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      contactName: parsed.data.contactName || null,
      isActive: parsed.data.isActive ?? current.isActive
    };
    try {
      await prisma2.supplier.update({
        where: { id: current.id },
        data: nextData
      });
      await logAudit(prisma2, currentSessionUser2, "suppliers", "update", "Supplier", current.id, current, nextData);
      return { success: true };
    } catch {
      return { success: false, message: "No se pudo actualizar el proveedor. Verifica documento o correo duplicado." };
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
        return createdPurchase;
      });
      await logAudit(prisma2, currentSessionUser2, "purchases", "create", "Purchase", purchase.id, void 0, {
        number: purchase.number,
        supplier: supplier.name,
        total: purchase.total
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
    const parsed = saleByIdSchema.safeParse(payload);
    if (!parsed.success)
      return { success: false, message: "Venta invalida" };
    const [sale, settings] = await Promise.all([
      prisma2.sale.findUnique({
        where: { id: parsed.data.saleId },
        include: {
          cashier: { select: { username: true, name: true } },
          items: { orderBy: { createdAt: "asc" } }
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
      paymentMethod: sale.paymentMethod,
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
async function bootstrapAppData() {
  await ensureCorrespondentSchemaIfNeeded(prisma);
  await seedAdminIfNeeded(prisma);
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
  registerBackofficeIpcHandlers({
    ipcMain,
    prisma,
    getCurrentSessionUser: () => currentSessionUser,
    getConnectedAt: () => appConnectedAt
  });
  createWindow();
  void bootstrapAppData().catch((error) => {
    console.error("Error inicializando modulos en segundo plano:", error);
  });
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
  currentSessionUser = {
    id: user.id,
    username: user.username,
    name: user.name ?? void 0,
    role: user.role
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
  const { newUsername, newPassword, name, role } = parsed.data;
  const passwordHash = await bcrypt.hash(newPassword, 10);
  try {
    await prisma.user.create({
      data: {
        username: newUsername,
        name: (name == null ? void 0 : name.trim()) || null,
        passwordHash,
        role: role ?? Role.EMPLOYEE
      }
    });
    return { success: true };
  } catch {
    return { success: false, message: "Usuario duplicado" };
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
  if (!currentSessionUser) {
    return { success: false, message: "Debes iniciar sesion para vender" };
  }
  const parsed = createSaleSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, message: "Datos invalidos para la venta" };
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
  const amountPaid = parsed.data.amountPaid ?? total;
  const changeAmount = parsed.data.paymentMethod === "CASH" ? Math.max(0, amountPaid - total) : 0;
  if (parsed.data.clientTotal !== void 0 && Math.abs(parsed.data.clientTotal - total) > 1) {
    return { success: false, message: "El total enviado no coincide con el calculo del sistema" };
  }
  if (parsed.data.paymentMethod === "CASH" && amountPaid < total) {
    return { success: false, message: "El efectivo recibido no alcanza para cubrir la venta" };
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
          customer: parsed.data.customer,
          paymentMethod: parsed.data.paymentMethod,
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
            create: {
              method: parsed.data.paymentMethod,
              amount: amountPaid
            }
          }
        }
      });
      if (activeCashSession && parsed.data.paymentMethod === "CASH") {
        await tx.cashMovement.create({
          data: {
            sessionId: activeCashSession.id,
            type: CashMovementType.SALE_IN,
            amount: total,
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
      { label: "Tarjeta", value: paymentSummary.CARD ?? 0 },
      { label: "Transferencia", value: paymentSummary.TRANSFER ?? 0 }
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
