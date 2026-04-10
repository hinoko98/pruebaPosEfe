import type { App, IpcMain } from "electron";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

import {
  CommissionMode,
  CorrespondentClosureStatus,
  CorrespondentDirection,
  CorrespondentOcrStatus,
  CorrespondentReconciliationStatus,
  CorrespondentTransactionSource,
  CorrespondentTransactionStatus,
  PrismaClient,
  Role,
} from "@prisma/client";

import {
  createCorrespondentPlatformSchema,
  createCorrespondentClosureSchema,
  createCorrespondentTransactionSchema,
  createCorrespondentTransactionTypeSchema,
  deleteCorrespondentPlatformSchema,
  deleteCorrespondentTransactionTypeSchema,
  getCorrespondentTransactionDetailSchema,
  listCorrespondentClosuresSchema,
  listCorrespondentTransactionsSchema,
  updateCorrespondentPlatformSchema,
  updateCorrespondentTransactionTypeSchema,
  updateCorrespondentTransactionSchema,
} from "../ipc/schemas/correspondent.schema";
import { isValidCode, normalizeCodeInput, resolveLooseCode } from "../../../shared/internalCodes";

type CurrentSessionUser = {
  id: string;
  username: string;
  role: Role;
  name?: string;
} | null;

type CorrespondentTypeSeed = {
  code: string;
  name: string;
  direction: CorrespondentDirection;
  requiresCustomerDocument?: boolean;
  requiresExternalReference?: boolean;
  sortOrder?: number;
};

type CorrespondentPlatformSeed = {
  code: string;
  name: string;
  requiresEvidence?: boolean;
  supportsOcr?: boolean;
  supportsFileImport?: boolean;
  types: CorrespondentTypeSeed[];
};

type RegisterCorrespondentHandlersArgs = {
  app: App;
  ipcMain: IpcMain;
  prisma: PrismaClient;
  getCurrentSessionUser: () => CurrentSessionUser;
};

const sharedCorrespondentTypes: CorrespondentTypeSeed[] = [
  { code: "RETIRO", name: "Retiro", direction: CorrespondentDirection.OUT, requiresCustomerDocument: true, requiresExternalReference: true, sortOrder: 10 },
  { code: "DEPOSITO", name: "Deposito", direction: CorrespondentDirection.IN, requiresCustomerDocument: true, requiresExternalReference: true, sortOrder: 20 },
  { code: "CONSIGNACION", name: "Consignacion", direction: CorrespondentDirection.IN, requiresCustomerDocument: true, requiresExternalReference: true, sortOrder: 30 },
  { code: "RECAUDO", name: "Recaudo", direction: CorrespondentDirection.IN, requiresExternalReference: true, sortOrder: 40 },
  { code: "PAGO", name: "Pago", direction: CorrespondentDirection.IN, requiresExternalReference: true, sortOrder: 50 },
  { code: "RECARGA", name: "Recarga", direction: CorrespondentDirection.IN, sortOrder: 60 },
  { code: "CONSULTA", name: "Consulta", direction: CorrespondentDirection.NEUTRAL, sortOrder: 70 },
  { code: "GIRO_ENVIO", name: "Giro envio", direction: CorrespondentDirection.IN, requiresCustomerDocument: true, requiresExternalReference: true, sortOrder: 80 },
  { code: "GIRO_PAGO", name: "Giro pago", direction: CorrespondentDirection.OUT, requiresCustomerDocument: true, requiresExternalReference: true, sortOrder: 90 },
];

const correspondentSeedCatalog: CorrespondentPlatformSeed[] = [
  {
    code: "PUNTORED",
    name: "Puntored",
    requiresEvidence: true,
    supportsOcr: true,
    supportsFileImport: true,
    types: sharedCorrespondentTypes,
  },
  {
    code: "PTM",
    name: "PTM",
    requiresEvidence: true,
    supportsOcr: true,
    supportsFileImport: true,
    types: sharedCorrespondentTypes,
  },
  {
    code: "CBOGOTA",
    name: "Corresponsal Bogota",
    requiresEvidence: true,
    supportsOcr: true,
    types: sharedCorrespondentTypes,
  },
  {
    code: "BANCOLOMBIA",
    name: "Corresponsal Bancolombia",
    requiresEvidence: true,
    supportsOcr: true,
    types: [
      ...sharedCorrespondentTypes,
      { code: "NEQUI_RETIRO", name: "Nequi retiro", direction: CorrespondentDirection.OUT, requiresExternalReference: true, sortOrder: 95 },
      { code: "NEQUI_DEPOSITO", name: "Nequi deposito", direction: CorrespondentDirection.IN, requiresExternalReference: true, sortOrder: 96 },
    ],
  },
  {
    code: "COOPENESSA",
    name: "Coopenessa",
    requiresEvidence: true,
    supportsOcr: false,
    types: sharedCorrespondentTypes,
  },
];

function money(value: number) {
  return Math.round(value);
}

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date = new Date()) {
  const next = startOfDay(date);
  next.setDate(next.getDate() + 1);
  return next;
}

function normalizeBusinessDate(value?: string) {
  if (!value) return startOfDay(new Date());
  return startOfDay(new Date(value));
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function serializeJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

function normalizeCode(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

async function buildUniquePlatformCode(prisma: PrismaClient, name: string) {
  const baseCode = normalizeCode(name) || "CORRESPONSAL";
  let code = baseCode;
  let counter = 2;

  while (await prisma.correspondentPlatform.findUnique({ where: { code }, select: { id: true } })) {
    code = `${baseCode}_${counter}`;
    counter += 1;
  }

  return code;
}

async function buildUniqueTypeCode(prisma: PrismaClient, platformId: string, name: string) {
  const baseCode = normalizeCode(name) || "TIPO";
  let code = baseCode;
  let counter = 2;

  while (
    await prisma.correspondentTransactionType.findUnique({
      where: { platformId_code: { platformId, code } },
      select: { id: true },
    })
  ) {
    code = `${baseCode}_${counter}`;
    counter += 1;
  }

  return code;
}

type CatalogAuditActor = {
  user: string | null;
  at: string | null;
};

function parseContextId(context: string | null | undefined, key: "platform" | "type") {
  if (!context) return null;
  const match = context.match(new RegExp(`${key}:([^;]+)`));
  return match?.[1] ?? null;
}

async function buildCorrespondentCatalogAuditMaps(prisma: PrismaClient) {
  const logs = await prisma.correspondentAuditLog.findMany({
    where: {
      action: {
        in: ["create_platform", "update_platform", "create_transaction_type", "update_transaction_type"],
      },
    },
    include: {
      user: {
        select: {
          username: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const platformCreatedBy = new Map<string, CatalogAuditActor>();
  const platformUpdatedBy = new Map<string, CatalogAuditActor>();
  const typeCreatedBy = new Map<string, CatalogAuditActor>();
  const typeUpdatedBy = new Map<string, CatalogAuditActor>();

  for (const log of logs) {
    const actor = {
      user: log.user ? log.user.name ?? log.user.username : null,
      at: log.createdAt.toISOString(),
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
    typeUpdatedBy,
  };
}

export async function ensureCorrespondentSchemaIfNeeded(prismaClient: PrismaClient) {
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
    `CREATE INDEX IF NOT EXISTS "CorrespondentAuditLog_createdAt_idx" ON "CorrespondentAuditLog"("createdAt");`,
  ];

  for (const statement of statements) {
    await prismaClient.$executeRawUnsafe(statement);
  }

  const transactionColumns = await prismaClient.$queryRawUnsafe<Array<{ name: string }>>(
    `PRAGMA table_info("CorrespondentTransaction");`
  );
  const transactionColumnSet = new Set(transactionColumns.map((column) => column.name));

  if (!transactionColumnSet.has("approvalCode")) {
    await prismaClient.$executeRawUnsafe(`ALTER TABLE "CorrespondentTransaction" ADD COLUMN "approvalCode" TEXT;`);
  }

  const transactions = await prismaClient.correspondentTransaction.findMany({
    select: {
      id: true,
      approvalCode: true,
    },
    orderBy: [{ createdAt: "asc" }, { performedAt: "asc" }],
  });

  const assignedApprovalCodes: string[] = [];
  const assignedSet = new Set<string>();

  for (const transaction of transactions) {
    const normalizedCurrentCode = normalizeCodeInput(transaction.approvalCode || "");
    const canKeepCurrentCode =
      Boolean(normalizedCurrentCode) &&
      isValidCode(normalizedCurrentCode, 4, 40) &&
      !assignedSet.has(normalizedCurrentCode);

    const approvalCode = canKeepCurrentCode
      ? normalizedCurrentCode
      : resolveLooseCode({
          existingCodes: assignedApprovalCodes,
          generatedPrefix: "APR",
          digits: 6,
          maxLength: 40,
        });

    if (approvalCode !== transaction.approvalCode) {
      await prismaClient.correspondentTransaction.update({
        where: { id: transaction.id },
        data: { approvalCode },
      });
    }

    assignedApprovalCodes.push(approvalCode);
    assignedSet.add(approvalCode);
  }

  await prismaClient.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "CorrespondentTransaction_approvalCode_key" ON "CorrespondentTransaction"("approvalCode");`
  );
}

export async function seedCorrespondentCatalogIfNeeded(prismaClient: PrismaClient) {
  for (const platformSeed of correspondentSeedCatalog) {
    const platform = await prismaClient.correspondentPlatform.upsert({
      where: { code: platformSeed.code },
      update: {
        name: platformSeed.name,
        isActive: true,
        requiresEvidence: platformSeed.requiresEvidence ?? false,
        supportsOcr: platformSeed.supportsOcr ?? false,
        supportsFileImport: platformSeed.supportsFileImport ?? false,
      },
      create: {
        code: platformSeed.code,
        name: platformSeed.name,
        isActive: true,
        requiresEvidence: platformSeed.requiresEvidence ?? false,
        supportsOcr: platformSeed.supportsOcr ?? false,
        supportsFileImport: platformSeed.supportsFileImport ?? false,
      },
    });

    for (const typeSeed of platformSeed.types) {
      await prismaClient.correspondentTransactionType.upsert({
        where: {
          platformId_code: {
            platformId: platform.id,
            code: typeSeed.code,
          },
        },
        update: {
          name: typeSeed.name,
          direction: typeSeed.direction,
          isActive: true,
          requiresCustomerDocument: typeSeed.requiresCustomerDocument ?? false,
          requiresExternalReference: typeSeed.requiresExternalReference ?? false,
          allowsCommissionOverride: true,
          sortOrder: typeSeed.sortOrder ?? 0,
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
          sortOrder: typeSeed.sortOrder ?? 0,
        },
      });
    }

    const rulesCount = await prismaClient.correspondentCommissionRule.count({
      where: { platformId: platform.id },
    });

    if (rulesCount === 0) {
      await prismaClient.correspondentCommissionRule.create({
        data: {
          platformId: platform.id,
          mode: CommissionMode.NONE,
          value: 0,
          isActive: true,
        },
      });
    }
  }
}

async function getActiveCashSessionForUser(prisma: PrismaClient, userId: string) {
  return prisma.cashSession.findFirst({
    where: { userId, status: "OPEN" },
    include: { register: true },
    orderBy: { openedAt: "desc" },
  });
}

async function resolveCommissionAmount(
  prisma: PrismaClient,
  platformId: string,
  typeId: string,
  amount: number,
  performedAt: Date
) {
  const rules = await prisma.correspondentCommissionRule.findMany({
    where: {
      platformId,
      isActive: true,
      OR: [{ typeId }, { typeId: null }],
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: performedAt } }] },
        { OR: [{ validTo: null }, { validTo: { gte: performedAt } }] },
        { OR: [{ minAmount: null }, { minAmount: { lte: amount } }] },
        { OR: [{ maxAmount: null }, { maxAmount: { gte: amount } }] },
      ],
    },
  });

  const bestRule =
    rules.sort((a, b) => {
      if (a.typeId === typeId && b.typeId !== typeId) return -1;
      if (a.typeId !== typeId && b.typeId === typeId) return 1;
      return (b.validFrom?.getTime() ?? 0) - (a.validFrom?.getTime() ?? 0);
    })[0] ?? null;

  if (!bestRule) return 0;
  if (bestRule.mode === CommissionMode.FIXED) return money(bestRule.value);
  if (bestRule.mode === CommissionMode.PERCENTAGE) return money((amount * bestRule.value) / 100);
  return 0;
}

function summarizeCorrespondentTransactions(
  transactions: Array<{
    amount: number;
    commissionAmount: number;
    status: CorrespondentTransactionStatus;
    dailyClosureId: string | null;
    evidences: Array<{ id: string }>;
    type: { direction: CorrespondentDirection };
  }>
) {
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

      if (transaction.type.direction === CorrespondentDirection.IN) acc.totalIn += transaction.amount;
      if (transaction.type.direction === CorrespondentDirection.OUT) acc.totalOut += transaction.amount;
      if (transaction.type.direction === CorrespondentDirection.NEUTRAL) acc.neutralCount += 1;

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
      neutralCount: 0,
    }
  );
}

async function saveCorrespondentEvidence(params: {
  app: App;
  platformCode: string;
  evidence: {
    fileName: string;
    mimeType?: string;
    dataBase64: string;
    ocrRawText?: string;
  };
}) {
  const normalizedDate = new Date();
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
  const base64Data = params.evidence.dataBase64.includes(",")
    ? params.evidence.dataBase64.split(",").pop() ?? ""
    : params.evidence.dataBase64;
  const fileBuffer = Buffer.from(base64Data, "base64");

  await writeFile(targetPath, fileBuffer);

  return {
    fileName: params.evidence.fileName,
    filePath: targetPath,
    mimeType: params.evidence.mimeType ?? null,
    fileSize: fileBuffer.byteLength,
    fileHash: createHash("sha256").update(fileBuffer).digest("hex"),
    ocrRawText: params.evidence.ocrRawText ?? null,
  };
}

async function logCorrespondentAction(params: {
  prisma: PrismaClient;
  currentSessionUser: CurrentSessionUser;
  transactionId?: string | null;
  action: string;
  beforeJson?: unknown;
  afterJson?: unknown;
  context?: string;
}) {
  await params.prisma.correspondentAuditLog.create({
    data: {
      transactionId: params.transactionId ?? null,
      userId: params.currentSessionUser?.id ?? null,
      action: params.action,
      context: params.context ?? null,
      beforeJson: params.beforeJson === undefined ? null : serializeJson(params.beforeJson),
      afterJson: params.afterJson === undefined ? null : serializeJson(params.afterJson),
    },
  });

  await params.prisma.auditLog.create({
    data: {
      userId: params.currentSessionUser?.id ?? null,
      module: "correspondent",
      action: params.action,
      entity: params.transactionId ? "CorrespondentTransaction" : "CorrespondentDailyClosure",
      entityId: params.transactionId ?? null,
      beforeJson: params.beforeJson === undefined ? null : serializeJson(params.beforeJson),
      afterJson: params.afterJson === undefined ? null : serializeJson(params.afterJson),
    },
  });
}

async function getCorrespondentTransactionsForDay(
  prisma: PrismaClient,
  businessDate: Date,
  platformId?: string
) {
  return prisma.correspondentTransaction.findMany({
    where: {
      platformId,
      performedAt: {
        gte: startOfDay(businessDate),
        lt: endOfDay(businessDate),
      },
    },
    include: {
      platform: true,
      type: true,
      evidences: { select: { id: true } },
      registeredBy: { select: { id: true, username: true, name: true } },
      dailyClosure: { select: { id: true, businessDate: true, status: true } },
    },
    orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
  });
}

async function getCorrespondentTransactionDetail(prisma: PrismaClient, transactionId: string) {
  return prisma.correspondentTransaction.findUnique({
    where: { id: transactionId },
    include: {
      platform: true,
      type: true,
      registeredBy: { select: { id: true, username: true, name: true } },
      auditLogs: {
        include: {
          user: {
            select: { id: true, username: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      dailyClosure: {
        select: {
          id: true,
          businessDate: true,
        },
      },
    },
  });
}

export function registerCorrespondentIpcHandlers({
  app,
  ipcMain,
  prisma,
  getCurrentSessionUser,
}: RegisterCorrespondentHandlersArgs) {
  ipcMain.handle("correspondent:catalog", async () => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) {
      return { success: false, message: "Debes iniciar sesion", platforms: [] };
    }

    const [platforms, auditMaps] = await Promise.all([
      prisma.correspondentPlatform.findMany({
        where: { isActive: true },
        include: {
          transactionTypes: {
            where: { isActive: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          },
          commissionRules: {
            where: { isActive: true },
            orderBy: [{ validFrom: "desc" }],
          },
        },
        orderBy: [{ createdAt: "asc" }, { name: "asc" }],
      }),
      buildCorrespondentCatalogAuditMaps(prisma),
    ]);

    return {
      success: true,
      platforms: platforms.map((platform) => ({
        id: platform.id,
        code: platform.code,
        name: platform.name,
        requiresEvidence: platform.requiresEvidence,
        supportsOcr: platform.supportsOcr,
        supportsFileImport: platform.supportsFileImport,
        createdAt: platform.createdAt.toISOString(),
        updatedAt: platform.updatedAt.toISOString(),
        createdBy: auditMaps.platformCreatedBy.get(platform.id)?.user ?? null,
        updatedBy:
          auditMaps.platformUpdatedBy.get(platform.id)?.user ??
          auditMaps.platformCreatedBy.get(platform.id)?.user ??
          null,
        types: platform.transactionTypes.map((type) => ({
          id: type.id,
          code: type.code,
          name: type.name,
          direction: type.direction,
          requiresCustomerDocument: type.requiresCustomerDocument,
          requiresExternalReference: type.requiresExternalReference,
          createdAt: type.createdAt.toISOString(),
          updatedAt: type.updatedAt.toISOString(),
          createdBy: auditMaps.typeCreatedBy.get(type.id)?.user ?? null,
          updatedBy:
            auditMaps.typeUpdatedBy.get(type.id)?.user ??
            auditMaps.typeCreatedBy.get(type.id)?.user ??
            null,
        })),
        commissionRules: platform.commissionRules.map((rule) => ({
          id: rule.id,
          typeId: rule.typeId,
          mode: rule.mode,
          value: rule.value,
          minAmount: rule.minAmount,
          maxAmount: rule.maxAmount,
        })),
      })),
    };
  });

  ipcMain.handle("correspondent:dashboard", async () => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) {
      return { success: false, message: "Debes iniciar sesion" };
    }

    const businessDate = startOfDay(new Date());
    const transactions = await getCorrespondentTransactionsForDay(prisma, businessDate);
    const summary = summarizeCorrespondentTransactions(transactions);

    const perPlatformMap = transactions.reduce<
      Record<
        string,
        {
          platformId: string;
          platform: string;
          totalIn: number;
          totalOut: number;
          totalCommission: number;
          count: number;
          pendingClosureCount: number;
        }
      >
    >((acc, transaction) => {
      const current = acc[transaction.platformId] ?? {
        platformId: transaction.platformId,
        platform: transaction.platform.name,
        totalIn: 0,
        totalOut: 0,
        totalCommission: 0,
        count: 0,
        pendingClosureCount: 0,
      };

      if (transaction.status !== CorrespondentTransactionStatus.VOIDED) {
        current.count += 1;
        current.totalCommission += transaction.commissionAmount;
        current.pendingClosureCount += transaction.dailyClosureId ? 0 : 1;
        if (transaction.type.direction === CorrespondentDirection.IN) current.totalIn += transaction.amount;
        if (transaction.type.direction === CorrespondentDirection.OUT) current.totalOut += transaction.amount;
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
        voidedCount: summary.voidedCount,
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
        hasEvidence: transaction.evidences.length > 0,
      })),
    };
  });

  ipcMain.handle("correspondent:transactions:list", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) {
      return { success: false, message: "Debes iniciar sesion", transactions: [] };
    }

    const parsed = listCorrespondentTransactionsSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, message: "Filtros invalidos", transactions: [] };
    }

    const filters = parsed.data;
    const search = filters.search?.trim();

    const transactions = await prisma.correspondentTransaction.findMany({
      where: {
        platformId: filters.platformId,
        registeredByUserId: filters.userId,
        status: filters.status,
        performedAt:
          filters.dateFrom || filters.dateTo
            ? {
                ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
                ...(filters.dateTo ? { lt: endOfDay(new Date(filters.dateTo)) } : {}),
              }
            : undefined,
        OR: search
          ? [
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
                      { name: { contains: search } },
                    ],
                  },
                },
              },
            ]
          : undefined,
      },
      include: {
        platform: true,
        type: true,
        registeredBy: { select: { id: true, username: true, name: true } },
        evidences: { select: { id: true, fileName: true } },
        dailyClosure: { select: { id: true, status: true } },
      },
      orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
      take: 150,
    });

    return {
      success: true,
      transactions: transactions.map((transaction) => ({
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
        closureId: transaction.dailyClosure?.id ?? null,
        closureStatus: transaction.dailyClosure?.status ?? null,
      })),
    };
  });

  ipcMain.handle("correspondent:transaction:detail", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) {
      return { success: false, message: "Debes iniciar sesion" };
    }

    const parsed = getCorrespondentTransactionDetailSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, message: "Transaccion invalida" };
    }

    const transaction = await getCorrespondentTransactionDetail(prisma, parsed.data.transactionId);

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
          context: entry.context,
        })),
      },
    };
  });

  ipcMain.handle("correspondent:transaction:create", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) {
      return { success: false, message: "Debes iniciar sesion para registrar movimientos" };
    }

    const parsed = createCorrespondentTransactionSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, message: "Datos invalidos para el corresponsal" };
    }

    const data = parsed.data;
    const performedAt = new Date(data.performedAt);

    const [platform, type, activeCashSession] = await Promise.all([
      prisma.correspondentPlatform.findUnique({ where: { id: data.platformId } }),
      prisma.correspondentTransactionType.findUnique({ where: { id: data.typeId } }),
      getActiveCashSessionForUser(prisma, currentSessionUser.id),
    ]);

    if (!platform || !platform.isActive) {
      return { success: false, message: "La plataforma seleccionada no esta disponible" };
    }

    if (!type || !type.isActive || type.platformId !== platform.id) {
      return { success: false, message: "El tipo de transaccion no corresponde a la plataforma" };
    }

    const duplicate = await prisma.correspondentTransaction.findFirst({
      where: {
        platformId: platform.id,
        typeId: type.id,
        amount: data.amount,
        externalReference: data.externalReference?.trim() || null,
        performedAt: {
          gte: new Date(performedAt.getTime() - 10 * 60 * 1000),
          lte: new Date(performedAt.getTime() + 10 * 60 * 1000),
        },
        status: CorrespondentTransactionStatus.REGISTERED,
      },
    });

    if (duplicate) {
      return { success: false, message: "Parece un duplicado reciente. Verifica antes de registrar." };
    }

    const computedCommission =
      data.commissionAmount ?? (await resolveCommissionAmount(prisma, platform.id, type.id, data.amount, performedAt));
    const netAmount =
      type.direction === CorrespondentDirection.OUT ? data.amount - computedCommission : data.amount + computedCommission;
    const evidencePayload = data.evidence
      ? await saveCorrespondentEvidence({ app, platformCode: platform.code, evidence: data.evidence })
      : null;

    try {
      const existingApprovalCodes = (
        await prisma.correspondentTransaction.findMany({
          select: { approvalCode: true },
        })
      ).map((transaction) => transaction.approvalCode);
      const approvalCode = resolveLooseCode({
        desiredCode: data.approvalCode,
        existingCodes: existingApprovalCodes,
        generatedPrefix: "APR",
        digits: 6,
        maxLength: 40,
      });

      const transaction = await prisma.correspondentTransaction.create({
        data: {
          approvalCode,
          platformId: platform.id,
          typeId: type.id,
          cashSessionId: activeCashSession?.id ?? null,
          cashRegisterId: activeCashSession?.registerId ?? null,
          registeredByUserId: currentSessionUser.id,
          status: CorrespondentTransactionStatus.REGISTERED,
          source: data.source as CorrespondentTransactionSource,
          ocrStatus: data.evidence?.ocrRawText
            ? CorrespondentOcrStatus.PROCESSED
            : platform.supportsOcr
              ? CorrespondentOcrStatus.NEEDS_REVIEW
              : CorrespondentOcrStatus.NOT_REQUESTED,
          reconciliationStatus: CorrespondentReconciliationStatus.PENDING,
          externalReference: data.externalReference?.trim() || null,
          customerName: data.customerName?.trim() || null,
          customerDocument: data.customerDocument?.trim() || null,
          targetAccount: data.targetAccount?.trim() || null,
          targetPhone: data.targetPhone?.trim() || null,
          amount: data.amount,
          commissionAmount: computedCommission,
          netAmount,
          performedAt,
          note: data.note?.trim() || null,
          rawExtractedText: data.rawExtractedText?.trim() || data.evidence?.ocrRawText || null,
          evidences: evidencePayload
            ? {
                create: {
                  ...evidencePayload,
                  capturedByUserId: currentSessionUser.id,
                },
              }
            : undefined,
        },
        include: {
          platform: true,
          type: true,
          evidences: { select: { id: true } },
        },
      });

      await logCorrespondentAction({
        prisma,
        currentSessionUser,
        transactionId: transaction.id,
        action: "create_transaction",
        afterJson: {
          approvalCode: transaction.approvalCode,
          platform: transaction.platform.name,
          type: transaction.type.name,
          amount: transaction.amount,
          commissionAmount: transaction.commissionAmount,
          hasEvidence: transaction.evidences.length > 0,
        },
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
          hasEvidence: transaction.evidences.length > 0,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo registrar la transaccion";
      return { success: false, message };
    }
  });

  ipcMain.handle("correspondent:transaction:update", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) {
      return { success: false, message: "Debes iniciar sesion para editar movimientos" };
    }

    const parsed = updateCorrespondentTransactionSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, message: "Datos invalidos para actualizar la transaccion" };
    }

    const existingTransaction = await prisma.correspondentTransaction.findUnique({
      where: { id: parsed.data.transactionId },
      include: {
        platform: true,
        type: true,
      },
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

    const nextType = await prisma.correspondentTransactionType.findUnique({
      where: { id: parsed.data.typeId },
    });

    if (!nextType || !nextType.isActive || nextType.platformId !== existingTransaction.platformId) {
      return { success: false, message: "El nuevo tipo no pertenece al mismo corresponsal" };
    }

    const nextPerformedAt = new Date(parsed.data.performedAt);
    const nextCommissionAmount = await resolveCommissionAmount(
      prisma,
      existingTransaction.platformId,
      nextType.id,
      parsed.data.amount,
      nextPerformedAt
    );
    const nextNetAmount =
      nextType.direction === CorrespondentDirection.OUT
        ? parsed.data.amount - nextCommissionAmount
        : parsed.data.amount + nextCommissionAmount;

    try {
      const existingApprovalCodes = (
        await prisma.correspondentTransaction.findMany({
          where: { NOT: { id: existingTransaction.id } },
          select: { approvalCode: true },
        })
      ).map((transaction) => transaction.approvalCode);
      const approvalCode = resolveLooseCode({
        desiredCode: parsed.data.approvalCode ?? existingTransaction.approvalCode,
        existingCodes: existingApprovalCodes,
        generatedPrefix: "APR",
        digits: 6,
        maxLength: 40,
      });

      const updatedTransaction = await prisma.correspondentTransaction.update({
        where: { id: existingTransaction.id },
        data: {
          approvalCode,
          typeId: nextType.id,
          amount: parsed.data.amount,
          commissionAmount: nextCommissionAmount,
          netAmount: nextNetAmount,
          performedAt: nextPerformedAt,
          reviewedByUserId: currentSessionUser.id,
        },
        include: {
          platform: true,
          type: true,
          evidences: { select: { id: true } },
        },
      });

      await logCorrespondentAction({
        prisma,
        currentSessionUser,
        transactionId: updatedTransaction.id,
        action: "update_transaction",
        beforeJson: {
          approvalCode: existingTransaction.approvalCode,
          type: existingTransaction.type.name,
          amount: existingTransaction.amount,
          performedAt: existingTransaction.performedAt.toISOString(),
          commissionAmount: existingTransaction.commissionAmount,
        },
        afterJson: {
          approvalCode: updatedTransaction.approvalCode,
          type: updatedTransaction.type.name,
          amount: updatedTransaction.amount,
          performedAt: updatedTransaction.performedAt.toISOString(),
          commissionAmount: updatedTransaction.commissionAmount,
        },
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
          hasEvidence: updatedTransaction.evidences.length > 0,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar la transaccion";
      return { success: false, message };
    }
  });

  ipcMain.handle("correspondent:platform:create", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser || currentSessionUser.role !== Role.ADMIN) {
      return { success: false, message: "Solo el administrador puede crear corresponsales" };
    }

    const parsed = createCorrespondentPlatformSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, message: "Datos invalidos para el corresponsal" };
    }

    const platformName = parsed.data.name.trim();
    const duplicate = await prisma.correspondentPlatform.findFirst({
      where: { name: { equals: platformName } },
      select: { id: true },
    });

    if (duplicate) {
      return { success: false, message: "Ya existe un corresponsal con ese nombre" };
    }

    try {
      const created = await prisma.correspondentPlatform.create({
        data: {
          code: await buildUniquePlatformCode(prisma, platformName),
          name: platformName,
          isActive: true,
          requiresEvidence: parsed.data.requiresEvidence,
          supportsOcr: parsed.data.supportsOcr,
          supportsFileImport: parsed.data.supportsFileImport,
        },
      });

      await prisma.correspondentCommissionRule.create({
        data: {
          platformId: created.id,
          mode: CommissionMode.NONE,
          value: 0,
          isActive: true,
        },
      });

      await logCorrespondentAction({
        prisma,
        currentSessionUser,
        action: "create_platform",
        context: `platform:${created.id}`,
        afterJson: {
          platform: created.name,
          code: created.code,
        },
      });

      return { success: true, platformId: created.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear el corresponsal";
      return { success: false, message };
    }
  });

  ipcMain.handle("correspondent:platform:update", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser || currentSessionUser.role !== Role.ADMIN) {
      return { success: false, message: "Solo el administrador puede editar corresponsales" };
    }

    const parsed = updateCorrespondentPlatformSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, message: "Datos invalidos para actualizar el corresponsal" };
    }

    const existingPlatform = await prisma.correspondentPlatform.findUnique({
      where: { id: parsed.data.platformId },
    });

    if (!existingPlatform) {
      return { success: false, message: "El corresponsal ya no existe" };
    }

    const duplicate = await prisma.correspondentPlatform.findFirst({
      where: {
        name: { equals: parsed.data.name.trim() },
        NOT: { id: existingPlatform.id },
      },
      select: { id: true },
    });

    if (duplicate) {
      return { success: false, message: "Ya existe otro corresponsal con ese nombre" };
    }

    try {
      const updated = await prisma.correspondentPlatform.update({
        where: { id: existingPlatform.id },
        data: {
          name: parsed.data.name.trim(),
          requiresEvidence: parsed.data.requiresEvidence,
          supportsOcr: parsed.data.supportsOcr,
          supportsFileImport: parsed.data.supportsFileImport,
        },
      });

      await logCorrespondentAction({
        prisma,
        currentSessionUser,
        action: "update_platform",
        context: `platform:${updated.id}`,
        beforeJson: {
          name: existingPlatform.name,
          requiresEvidence: existingPlatform.requiresEvidence,
          supportsOcr: existingPlatform.supportsOcr,
          supportsFileImport: existingPlatform.supportsFileImport,
        },
        afterJson: {
          name: updated.name,
          requiresEvidence: updated.requiresEvidence,
          supportsOcr: updated.supportsOcr,
          supportsFileImport: updated.supportsFileImport,
        },
      });

      return { success: true, platformId: updated.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar el corresponsal";
      return { success: false, message };
    }
  });

  ipcMain.handle("correspondent:platform:delete", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser || currentSessionUser.role !== Role.ADMIN) {
      return { success: false, message: "Solo el administrador puede eliminar corresponsales" };
    }

    const parsed = deleteCorrespondentPlatformSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, message: "Corresponsal invalido" };
    }

    const existingPlatform = await prisma.correspondentPlatform.findUnique({
      where: { id: parsed.data.platformId },
      include: {
        transactionTypes: {
          select: { id: true },
        },
      },
    });

    if (!existingPlatform) {
      return { success: false, message: "El corresponsal ya no existe" };
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.correspondentPlatform.update({
          where: { id: existingPlatform.id },
          data: { isActive: false },
        });

        if (existingPlatform.transactionTypes.length > 0) {
          await tx.correspondentTransactionType.updateMany({
            where: { platformId: existingPlatform.id },
            data: { isActive: false },
          });
        }
      });

      await logCorrespondentAction({
        prisma,
        currentSessionUser,
        action: "delete_platform",
        context: `platform:${existingPlatform.id}`,
        beforeJson: {
          name: existingPlatform.name,
        },
      });

      return { success: true, platformId: existingPlatform.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo eliminar el corresponsal";
      return { success: false, message };
    }
  });

  ipcMain.handle("correspondent:type:create", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser || currentSessionUser.role !== Role.ADMIN) {
      return { success: false, message: "Solo el administrador puede crear tipos" };
    }

    const parsed = createCorrespondentTransactionTypeSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, message: "Datos invalidos para el tipo" };
    }

    const platform = await prisma.correspondentPlatform.findUnique({
      where: { id: parsed.data.platformId },
      include: {
        transactionTypes: {
          select: { sortOrder: true },
          orderBy: { sortOrder: "desc" },
          take: 1,
        },
      },
    });

    if (!platform || !platform.isActive) {
      return { success: false, message: "El corresponsal ya no existe" };
    }

    const typeName = parsed.data.name.trim();
    const duplicate = await prisma.correspondentTransactionType.findFirst({
      where: {
        platformId: platform.id,
        name: { equals: typeName },
      },
      select: { id: true },
    });

    if (duplicate) {
      return { success: false, message: "Ese corresponsal ya tiene un tipo con ese nombre" };
    }

    try {
      const created = await prisma.correspondentTransactionType.create({
        data: {
          platformId: platform.id,
          code: await buildUniqueTypeCode(prisma, platform.id, typeName),
          name: typeName,
          direction: parsed.data.direction,
          isActive: true,
          sortOrder: (platform.transactionTypes[0]?.sortOrder ?? 0) + 10,
        },
      });

      await logCorrespondentAction({
        prisma,
        currentSessionUser,
        action: "create_transaction_type",
        context: `platform:${platform.id};type:${created.id}`,
        afterJson: {
          platform: platform.name,
          type: created.name,
          direction: created.direction,
        },
      });

      return { success: true, typeId: created.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear el tipo";
      return { success: false, message };
    }
  });

  ipcMain.handle("correspondent:type:update", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser || currentSessionUser.role !== Role.ADMIN) {
      return { success: false, message: "Solo el administrador puede editar tipos" };
    }

    const parsed = updateCorrespondentTransactionTypeSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, message: "Datos invalidos para actualizar el tipo" };
    }

    const existingType = await prisma.correspondentTransactionType.findUnique({
      where: { id: parsed.data.typeId },
    });

    if (!existingType) {
      return { success: false, message: "El tipo ya no existe" };
    }

    const duplicate = await prisma.correspondentTransactionType.findFirst({
      where: {
        platformId: existingType.platformId,
        name: { equals: parsed.data.name.trim() },
        NOT: { id: existingType.id },
      },
      select: { id: true },
    });

    if (duplicate) {
      return { success: false, message: "Ya existe otro tipo con ese nombre en el corresponsal" };
    }

    try {
      const updated = await prisma.correspondentTransactionType.update({
        where: { id: existingType.id },
        data: {
          name: parsed.data.name.trim(),
          direction: parsed.data.direction,
        },
      });

      await logCorrespondentAction({
        prisma,
        currentSessionUser,
        action: "update_transaction_type",
        context: `platform:${existingType.platformId};type:${updated.id}`,
        beforeJson: {
          name: existingType.name,
          direction: existingType.direction,
        },
        afterJson: {
          name: updated.name,
          direction: updated.direction,
        },
      });

      return { success: true, typeId: updated.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar el tipo";
      return { success: false, message };
    }
  });

  ipcMain.handle("correspondent:type:delete", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser || currentSessionUser.role !== Role.ADMIN) {
      return { success: false, message: "Solo el administrador puede eliminar tipos" };
    }

    const parsed = deleteCorrespondentTransactionTypeSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, message: "Tipo invalido" };
    }

    const existingType = await prisma.correspondentTransactionType.findUnique({
      where: { id: parsed.data.typeId },
    });

    if (!existingType) {
      return { success: false, message: "El tipo ya no existe" };
    }

    try {
      await prisma.correspondentTransactionType.update({
        where: { id: existingType.id },
        data: { isActive: false },
      });

      await logCorrespondentAction({
        prisma,
        currentSessionUser,
        action: "delete_transaction_type",
        context: `platform:${existingType.platformId};type:${existingType.id}`,
        beforeJson: {
          name: existingType.name,
          direction: existingType.direction,
        },
      });

      return { success: true, typeId: existingType.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo eliminar el tipo";
      return { success: false, message };
    }
  });

  ipcMain.handle("correspondent:closures:list", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) {
      return { success: false, message: "Debes iniciar sesion", closures: [] };
    }

    const parsed = listCorrespondentClosuresSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, message: "Fecha de cierre invalida", closures: [] };
    }

    const businessDate = normalizeBusinessDate(parsed.data.businessDate);
    const [platforms, closures, transactions] = await Promise.all([
      prisma.correspondentPlatform.findMany({
        where: { isActive: true },
        orderBy: [{ createdAt: "asc" }, { name: "asc" }],
      }),
      prisma.correspondentDailyClosure.findMany({
        where: { businessDate },
        include: {
          platform: true,
          closedBy: { select: { username: true, name: true } },
        },
        orderBy: { closedAt: "desc" },
      }),
      getCorrespondentTransactionsForDay(prisma, businessDate),
    ]);

    const closureByPlatform = new Map(closures.map((closure) => [closure.platformId, closure]));
    const transactionsByPlatform = transactions.reduce<Record<string, typeof transactions>>((acc, transaction) => {
      acc[transaction.platformId] = [...(acc[transaction.platformId] ?? []), transaction];
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
        transactionsCount: totals.transactionsCount,
      },
      closures: platforms.map((platform) => {
        const platformTransactions = transactionsByPlatform[platform.id] ?? [];
        const summary = summarizeCorrespondentTransactions(platformTransactions);
        const closure = closureByPlatform.get(platform.id) ?? null;
        const breakdownMap = platformTransactions.reduce<
          Record<
            string,
            {
              typeId: string;
              type: string;
              direction: CorrespondentDirection;
              total: number;
              count: number;
            }
          >
        >((acc, transaction) => {
          if (transaction.status === CorrespondentTransactionStatus.VOIDED) {
            return acc;
          }

          const current = acc[transaction.typeId] ?? {
            typeId: transaction.typeId,
            type: transaction.type.name,
            direction: transaction.type.direction,
            total: 0,
            count: 0,
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
          closure: closure
            ? {
                id: closure.id,
                expectedBalance: closure.expectedBalance,
                reportedBalance: closure.reportedBalance,
                differenceAmount: closure.differenceAmount,
                status: closure.status,
                closedAt: closure.closedAt.toISOString(),
                closedBy: closure.closedBy.name ?? closure.closedBy.username,
                note: closure.note,
              }
            : null,
        };
      }),
    };
  });

  ipcMain.handle("correspondent:closure:create", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) {
      return { success: false, message: "Debes iniciar sesion para cerrar" };
    }

    const parsed = createCorrespondentClosureSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, message: "Datos invalidos para el cierre" };
    }

    const data = parsed.data;
    const businessDate = normalizeBusinessDate(data.businessDate);

    const existing = await prisma.correspondentDailyClosure.findFirst({
      where: {
        platformId: data.platformId,
        businessDate,
      },
    });

    if (existing) {
      return { success: false, message: "La plataforma ya fue cerrada para esa fecha" };
    }

    const [platform, transactions, activeCashSession] = await Promise.all([
      prisma.correspondentPlatform.findUnique({ where: { id: data.platformId } }),
      getCorrespondentTransactionsForDay(prisma, businessDate, data.platformId),
      getActiveCashSessionForUser(prisma, currentSessionUser.id),
    ]);

    if (!platform) {
      return { success: false, message: "Plataforma no encontrada" };
    }

    const openTransactions = transactions.filter(
      (transaction) =>
        transaction.status === CorrespondentTransactionStatus.REGISTERED && !transaction.dailyClosureId
    );
    const summary = summarizeCorrespondentTransactions(openTransactions);
    const expectedBalance = data.openingBalance + summary.totalIn - summary.totalOut + summary.totalCommission;
    const differenceAmount = data.reportedBalance - expectedBalance;

    try {
      const closure = await prisma.$transaction(async (tx) => {
        const createdClosure = await tx.correspondentDailyClosure.create({
          data: {
            platformId: platform.id,
            cashSessionId: activeCashSession?.id ?? null,
            businessDate,
            totalIn: summary.totalIn,
            totalOut: summary.totalOut,
            totalCommission: summary.totalCommission,
            transactionsCount: summary.transactionsCount,
            expectedBalance,
            reportedBalance: data.reportedBalance,
            differenceAmount,
            status: differenceAmount === 0 ? CorrespondentClosureStatus.CLOSED : CorrespondentClosureStatus.WITH_DIFFERENCE,
            note: data.note?.trim() || null,
            closedByUserId: currentSessionUser.id,
          },
        });

        if (openTransactions.length > 0) {
          await tx.correspondentTransaction.updateMany({
            where: {
              id: { in: openTransactions.map((transaction) => transaction.id) },
            },
            data: {
              dailyClosureId: createdClosure.id,
            },
          });
        }

        return createdClosure;
      });

      await logCorrespondentAction({
        prisma,
        currentSessionUser,
        action: "create_closure",
        context: `platform:${platform.id};closure:${closure.id}`,
        afterJson: {
          platform: platform.name,
          businessDate: businessDate.toISOString(),
          expectedBalance,
          reportedBalance: data.reportedBalance,
          differenceAmount,
        },
      });

      return {
        success: true,
        closure: {
          id: closure.id,
          expectedBalance,
          reportedBalance: closure.reportedBalance,
          differenceAmount: closure.differenceAmount,
          status: closure.status,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo cerrar la plataforma";
      return { success: false, message };
    }
  });
}
