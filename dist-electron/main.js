import { BrowserWindow as qe, app as te, ipcMain as X, Menu as Bt } from "electron";
import ce from "bcryptjs";
import "dotenv/config";
import Pe from "node:os";
import H from "node:path";
import { fileURLToPath as Ft } from "node:url";
import { CorrespondentDirection as _, CommissionMode as Oe, CorrespondentTransactionStatus as ne, CorrespondentReconciliationStatus as $t, CorrespondentOcrStatus as Le, Role as F, CorrespondentClosureStatus as We, SaleStatus as me, CashSessionStatus as W, PaymentMethod as j, CashMovementType as B, InventoryMovementType as Te, PurchaseStatus as Qe, CreditStatus as fe, PrismaClient as kt } from "@prisma/client";
import { z as o } from "zod";
import { mkdir as Xt, writeFile as Vt } from "node:fs/promises";
import { createHash as qt } from "node:crypto";
const je = o.enum(["ADMIN", "EMPLOYEE"]), jt = o.object({
  username: o.string().trim().min(1).max(50),
  password: o.string().min(1).max(200)
});
o.object({
  success: o.boolean(),
  message: o.string().optional(),
  user: o.object({
    id: o.string(),
    username: o.string(),
    role: je,
    name: o.string().optional(),
    roleProfileId: o.string().nullable().optional(),
    roleProfileName: o.string().nullable().optional(),
    permissions: o.array(o.string()).optional()
  }).optional()
});
const ze = o.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(), Ge = o.string().trim().regex(/^\d{10}$/).optional().nullable(), ft = o.object({
  internalCode: o.string().trim().max(30).optional().nullable(),
  firstName: o.string().trim().min(2).max(80),
  lastName: o.string().trim().min(2).max(80),
  documentNumber: o.string().trim().regex(/^\d{6,20}$/),
  email: o.string().trim().email().max(120).optional().nullable(),
  phone: Ge,
  address: o.string().trim().max(180).optional().nullable(),
  birthDate: ze,
  roleProfileId: o.string().uuid().optional().nullable(),
  isActive: o.boolean().optional().default(!0)
}), zt = ft.extend({
  newPassword: o.string().min(6).max(200)
}), Gt = ft.extend({
  id: o.string().uuid(),
  newPassword: o.string().min(6).max(200).optional().or(o.literal(""))
}), Kt = o.object({
  id: o.string(),
  username: o.string(),
  name: o.string().optional().nullable(),
  firstName: o.string().optional().nullable(),
  lastName: o.string().optional().nullable(),
  email: o.string().trim().email().max(120).optional().nullable(),
  phone: Ge,
  birthDate: ze,
  role: je
});
o.object({
  success: o.boolean(),
  message: o.string().optional(),
  profile: Kt.optional()
});
const Ht = o.object({
  firstName: o.string().trim().min(2).max(80),
  lastName: o.string().trim().min(2).max(80),
  email: o.string().trim().email().max(120).optional().nullable(),
  phone: Ge,
  birthDate: ze
}), Yt = o.object({
  currentPassword: o.string().min(1).max(200),
  newPassword: o.string().min(6).max(200),
  confirmPassword: o.string().min(6).max(200)
}), Jt = o.object({
  name: o.string().trim().min(3, "Minimo 3 caracteres").max(80, "Maximo 80 caracteres"),
  description: o.string().trim().max(240).optional().nullable(),
  baseRole: je.default("EMPLOYEE"),
  permissionKeys: o.array(o.string().trim().min(1)).min(1, "Debes seleccionar al menos un permiso"),
  isActive: o.boolean().optional().default(!0)
}), Wt = o.object({
  id: o.string().uuid("ID de rol invalido"),
  name: o.string().trim().min(3, "Minimo 3 caracteres").max(80, "Maximo 80 caracteres"),
  description: o.string().trim().max(240).optional().nullable(),
  permissionKeys: o.array(o.string().trim().min(1)).min(1, "Debes seleccionar al menos un permiso"),
  isActive: o.boolean().optional().default(!0)
}), Qt = o.object({
  id: o.string().uuid("ID de rol invalido")
}), Ke = o.enum(["CASH", "CARD", "TRANSFER"]), Zt = o.object({
  method: Ke,
  amount: o.number().min(0, "El monto del pago no puede ser negativo")
}), ea = o.object({
  productId: o.string().uuid("productId invalido"),
  qty: o.number().int("La cantidad debe ser entera").positive("La cantidad debe ser mayor a 0")
}), ta = o.object({
  customer: o.string().trim().max(120).optional().default("Consumidor final"),
  customerId: o.string().uuid("customerId invalido").optional().nullable(),
  paymentMethod: Ke.optional().default("CASH"),
  amountPaid: o.number().min(0).optional(),
  payments: o.array(Zt).min(1, "Debes registrar al menos un pago").optional(),
  items: o.array(ea).min(1, "La venta debe tener al menos un item"),
  clientTotal: o.number().min(0).optional(),
  allowDebt: o.boolean().optional().default(!1)
});
o.discriminatedUnion("success", [
  o.object({
    success: o.literal(!0),
    saleId: o.string().uuid(),
    invoiceNumber: o.string(),
    total: o.number(),
    amountPaid: o.number(),
    changeAmount: o.number()
  }),
  o.object({
    success: o.literal(!1),
    message: o.string()
  })
]);
const aa = o.enum(["REGISTERED", "VOIDED"]), sa = o.enum(["MANUAL", "IMAGE", "FILE_IMPORT", "API"]), gt = o.enum(["IN", "OUT"]), ra = o.object({
  fileName: o.string().trim().min(1).max(180),
  mimeType: o.string().trim().max(120).optional(),
  dataBase64: o.string().min(1),
  ocrRawText: o.string().trim().max(1e4).optional()
}), na = o.object({
  platformId: o.string().uuid("platformId invalido"),
  typeId: o.string().uuid("typeId invalido"),
  approvalCode: o.string().trim().min(4, "Ingresa el numero de aprobacion o ID interno").max(40).optional().nullable(),
  amount: o.number().int("El valor debe ser entero").positive("El valor debe ser mayor a 0"),
  commissionAmount: o.number().int("La comision debe ser entera").min(0).optional(),
  externalReference: o.string().trim().max(120).optional().nullable(),
  customerName: o.string().trim().max(120).optional().nullable(),
  customerDocument: o.string().trim().max(40).optional().nullable(),
  targetAccount: o.string().trim().max(60).optional().nullable(),
  targetPhone: o.string().trim().max(30).optional().nullable(),
  performedAt: o.string().datetime("Fecha de operacion invalida"),
  note: o.string().trim().max(300).optional().nullable(),
  rawExtractedText: o.string().trim().max(1e4).optional().nullable(),
  source: sa.optional().default("MANUAL"),
  evidence: ra.optional()
}), oa = o.object({
  transactionId: o.string().uuid("transactionId invalido"),
  typeId: o.string().uuid("typeId invalido"),
  approvalCode: o.string().trim().min(4, "Ingresa el numero de aprobacion o ID interno").max(40).optional().nullable(),
  amount: o.number().int("El valor debe ser entero").positive("El valor debe ser mayor a 0"),
  performedAt: o.string().datetime("Fecha de operacion invalida")
}), ia = o.object({
  transactionId: o.string().uuid("transactionId invalido")
}), ca = o.object({
  dateFrom: o.string().datetime().optional(),
  dateTo: o.string().datetime().optional(),
  platformId: o.string().uuid().optional(),
  userId: o.string().uuid().optional(),
  status: aa.optional(),
  search: o.string().trim().max(80).optional()
}).optional().default({}), da = o.object({
  businessDate: o.string().datetime().optional(),
  dateFrom: o.string().datetime().optional(),
  dateTo: o.string().datetime().optional()
}).refine(
  (e) => !e.dateFrom || !e.dateTo || new Date(e.dateFrom).getTime() <= new Date(e.dateTo).getTime(),
  {
    message: "El rango de fechas es invalido",
    path: ["dateTo"]
  }
).optional().default({}), ua = o.object({
  platformId: o.string().uuid("platformId invalido"),
  businessDate: o.string().datetime("Fecha de cierre invalida"),
  openingBalance: o.number().int("El saldo base debe ser entero").optional().default(0),
  reportedBalance: o.number().int("El valor reportado debe ser entero"),
  note: o.string().trim().max(300).optional().nullable()
}), la = o.object({
  name: o.string().trim().min(2, "El nombre es obligatorio").max(80, "Nombre demasiado largo"),
  requiresEvidence: o.boolean().optional().default(!1),
  supportsOcr: o.boolean().optional().default(!1),
  supportsFileImport: o.boolean().optional().default(!1)
}), ma = o.object({
  platformId: o.string().uuid("platformId invalido"),
  name: o.string().trim().min(2, "El nombre es obligatorio").max(80, "Nombre demasiado largo"),
  direction: gt.default("IN")
}), pa = o.object({
  platformId: o.string().uuid("platformId invalido"),
  name: o.string().trim().min(2, "El nombre es obligatorio").max(80, "Nombre demasiado largo"),
  requiresEvidence: o.boolean().optional().default(!1),
  supportsOcr: o.boolean().optional().default(!1),
  supportsFileImport: o.boolean().optional().default(!1)
}), fa = o.object({
  typeId: o.string().uuid("typeId invalido"),
  name: o.string().trim().min(2, "El nombre es obligatorio").max(80, "Nombre demasiado largo"),
  direction: gt.default("IN")
}), ga = o.object({
  platformId: o.string().uuid("platformId invalido")
}), Ea = o.object({
  typeId: o.string().uuid("typeId invalido")
}), Aa = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
function Ta(e) {
  return e.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function re(e) {
  return Ta(e).toUpperCase().replace(/[_\s]+/g, "-").replace(/[^A-Z0-9-]/g, "").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}
function Ia(e, a) {
  const r = re(a), l = re(e);
  if (!l)
    return `${r}-`;
  if (l === r)
    return `${r}-`;
  if (l.startsWith(`${r}-`))
    return l;
  const m = l.startsWith(r) ? l.slice(r.length).replace(/^-+/, "") : l;
  return `${r}-${m}`;
}
function He(e, a = 4, r = 40) {
  return e.length >= a && e.length <= r && Aa.test(e);
}
function Et(e, a, r = 4) {
  const l = re(a), m = new RegExp(`^${l}-(\\d+)$`);
  let c = 0;
  for (const n of e) {
    const t = re(n || "").match(m);
    t && (c = Math.max(c, Number(t[1] || 0)));
  }
  return `${l}-${String(c + 1).padStart(r, "0")}`;
}
function Z(e) {
  var l;
  const a = (l = e.desiredCode) != null && l.trim() ? Ia(e.desiredCode, e.prefix) : Et(e.existingCodes, e.prefix, e.digits);
  if (!He(a, e.minLength, e.maxLength))
    throw new Error("El codigo debe usar solo letras, numeros y guiones.");
  if (new Set(
    e.existingCodes.map((m) => re(m || "")).filter(Boolean)
  ).has(a))
    throw new Error(`El codigo ${a} ya existe.`);
  return a;
}
function Fe(e) {
  var l;
  const a = (l = e.desiredCode) != null && l.trim() ? re(e.desiredCode) : Et(e.existingCodes, e.generatedPrefix, e.digits);
  if (!He(a, e.minLength, e.maxLength))
    throw new Error("El codigo debe usar solo letras, numeros y guiones.");
  if (new Set(
    e.existingCodes.map((m) => re(m || "")).filter(Boolean)
  ).has(a))
    throw new Error(`El codigo ${a} ya existe.`);
  return a;
}
const ge = [
  { code: "RETIRO", name: "Retiro", direction: _.OUT, requiresCustomerDocument: !0, requiresExternalReference: !0, sortOrder: 10 },
  { code: "DEPOSITO", name: "Deposito", direction: _.IN, requiresCustomerDocument: !0, requiresExternalReference: !0, sortOrder: 20 },
  { code: "CONSIGNACION", name: "Consignacion", direction: _.IN, requiresCustomerDocument: !0, requiresExternalReference: !0, sortOrder: 30 },
  { code: "RECAUDO", name: "Recaudo", direction: _.IN, requiresExternalReference: !0, sortOrder: 40 },
  { code: "PAGO", name: "Pago", direction: _.IN, requiresExternalReference: !0, sortOrder: 50 },
  { code: "RECARGA", name: "Recarga", direction: _.IN, sortOrder: 60 },
  { code: "CONSULTA", name: "Consulta", direction: _.NEUTRAL, sortOrder: 70 },
  { code: "GIRO_ENVIO", name: "Giro envio", direction: _.IN, requiresCustomerDocument: !0, requiresExternalReference: !0, sortOrder: 80 },
  { code: "GIRO_PAGO", name: "Giro pago", direction: _.OUT, requiresCustomerDocument: !0, requiresExternalReference: !0, sortOrder: 90 }
], ya = [
  {
    code: "PUNTORED",
    name: "Puntored",
    requiresEvidence: !0,
    supportsOcr: !0,
    supportsFileImport: !0,
    types: ge
  },
  {
    code: "PTM",
    name: "PTM",
    requiresEvidence: !0,
    supportsOcr: !0,
    supportsFileImport: !0,
    types: ge
  },
  {
    code: "CBOGOTA",
    name: "Corresponsal Bogota",
    requiresEvidence: !0,
    supportsOcr: !0,
    types: ge
  },
  {
    code: "BANCOLOMBIA",
    name: "Corresponsal Bancolombia",
    requiresEvidence: !0,
    supportsOcr: !0,
    types: [
      ...ge,
      { code: "NEQUI_RETIRO", name: "Nequi retiro", direction: _.OUT, requiresExternalReference: !0, sortOrder: 95 },
      { code: "NEQUI_DEPOSITO", name: "Nequi deposito", direction: _.IN, requiresExternalReference: !0, sortOrder: 96 }
    ]
  },
  {
    code: "COOPENESSA",
    name: "Coopenessa",
    requiresEvidence: !0,
    supportsOcr: !1,
    types: ge
  }
];
function Ze(e) {
  return Math.round(e);
}
function ee(e = /* @__PURE__ */ new Date()) {
  return new Date(e.getFullYear(), e.getMonth(), e.getDate());
}
function Re(e = /* @__PURE__ */ new Date()) {
  const a = ee(e);
  return a.setDate(a.getDate() + 1), a;
}
function Ce(e) {
  return ee(e ? new Date(e) : /* @__PURE__ */ new Date());
}
function Na(e) {
  return e.replace(/[^a-zA-Z0-9._-]/g, "_");
}
function he(e) {
  return JSON.stringify(e ?? null);
}
function At(e) {
  return e.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toUpperCase();
}
async function Ca(e, a) {
  const r = At(a) || "CORRESPONSAL";
  let l = r, m = 2;
  for (; await e.correspondentPlatform.findUnique({ where: { code: l }, select: { id: !0 } }); )
    l = `${r}_${m}`, m += 1;
  return l;
}
async function ha(e, a, r) {
  const l = At(r) || "TIPO";
  let m = l, c = 2;
  for (; await e.correspondentTransactionType.findUnique({
    where: { platformId_code: { platformId: a, code: m } },
    select: { id: !0 }
  }); )
    m = `${l}_${c}`, c += 1;
  return m;
}
function et(e, a) {
  if (!e)
    return null;
  const r = e.match(new RegExp(`${a}:([^;]+)`));
  return (r == null ? void 0 : r[1]) ?? null;
}
async function va(e) {
  const a = await e.correspondentAuditLog.findMany({
    where: {
      action: {
        in: ["create_platform", "update_platform", "create_transaction_type", "update_transaction_type"]
      }
    },
    include: {
      user: {
        select: {
          username: !0,
          name: !0
        }
      }
    },
    orderBy: { createdAt: "asc" }
  }), r = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Map(), m = /* @__PURE__ */ new Map(), c = /* @__PURE__ */ new Map();
  for (const n of a) {
    const s = {
      user: n.user ? n.user.name ?? n.user.username : null,
      at: n.createdAt.toISOString()
    }, t = et(n.context, "platform"), i = et(n.context, "type");
    n.action === "create_platform" && t && !r.has(t) && r.set(t, s), n.action === "update_platform" && t && l.set(t, s), n.action === "create_transaction_type" && i && !m.has(i) && m.set(i, s), n.action === "update_transaction_type" && i && c.set(i, s);
  }
  return {
    platformCreatedBy: r,
    platformUpdatedBy: l,
    typeCreatedBy: m,
    typeUpdatedBy: c
  };
}
async function ba(e) {
  const a = [
    "PRAGMA foreign_keys = ON;",
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
    'CREATE UNIQUE INDEX IF NOT EXISTS "CorrespondentPlatform_code_key" ON "CorrespondentPlatform"("code");',
    'CREATE UNIQUE INDEX IF NOT EXISTS "CorrespondentPlatform_name_key" ON "CorrespondentPlatform"("name");',
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
    'CREATE UNIQUE INDEX IF NOT EXISTS "CorrespondentTransactionType_platformId_code_key" ON "CorrespondentTransactionType"("platformId", "code");',
    'CREATE INDEX IF NOT EXISTS "CorrespondentTransactionType_platformId_idx" ON "CorrespondentTransactionType"("platformId");',
    'CREATE INDEX IF NOT EXISTS "CorrespondentTransactionType_isActive_idx" ON "CorrespondentTransactionType"("isActive");',
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
    'CREATE INDEX IF NOT EXISTS "CorrespondentCommissionRule_platformId_idx" ON "CorrespondentCommissionRule"("platformId");',
    'CREATE INDEX IF NOT EXISTS "CorrespondentCommissionRule_typeId_idx" ON "CorrespondentCommissionRule"("typeId");',
    'CREATE INDEX IF NOT EXISTS "CorrespondentCommissionRule_isActive_idx" ON "CorrespondentCommissionRule"("isActive");',
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
    'CREATE UNIQUE INDEX IF NOT EXISTS "CorrespondentDailyClosure_platformId_businessDate_key" ON "CorrespondentDailyClosure"("platformId", "businessDate");',
    'CREATE INDEX IF NOT EXISTS "CorrespondentDailyClosure_platformId_idx" ON "CorrespondentDailyClosure"("platformId");',
    'CREATE INDEX IF NOT EXISTS "CorrespondentDailyClosure_cashSessionId_idx" ON "CorrespondentDailyClosure"("cashSessionId");',
    'CREATE INDEX IF NOT EXISTS "CorrespondentDailyClosure_businessDate_idx" ON "CorrespondentDailyClosure"("businessDate");',
    'CREATE INDEX IF NOT EXISTS "CorrespondentDailyClosure_closedByUserId_idx" ON "CorrespondentDailyClosure"("closedByUserId");',
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
    'CREATE INDEX IF NOT EXISTS "CorrespondentTransaction_platformId_idx" ON "CorrespondentTransaction"("platformId");',
    'CREATE INDEX IF NOT EXISTS "CorrespondentTransaction_typeId_idx" ON "CorrespondentTransaction"("typeId");',
    'CREATE INDEX IF NOT EXISTS "CorrespondentTransaction_cashSessionId_idx" ON "CorrespondentTransaction"("cashSessionId");',
    'CREATE INDEX IF NOT EXISTS "CorrespondentTransaction_cashRegisterId_idx" ON "CorrespondentTransaction"("cashRegisterId");',
    'CREATE INDEX IF NOT EXISTS "CorrespondentTransaction_registeredByUserId_idx" ON "CorrespondentTransaction"("registeredByUserId");',
    'CREATE INDEX IF NOT EXISTS "CorrespondentTransaction_reviewedByUserId_idx" ON "CorrespondentTransaction"("reviewedByUserId");',
    'CREATE INDEX IF NOT EXISTS "CorrespondentTransaction_dailyClosureId_idx" ON "CorrespondentTransaction"("dailyClosureId");',
    'CREATE INDEX IF NOT EXISTS "CorrespondentTransaction_performedAt_idx" ON "CorrespondentTransaction"("performedAt");',
    'CREATE INDEX IF NOT EXISTS "CorrespondentTransaction_status_idx" ON "CorrespondentTransaction"("status");',
    'CREATE INDEX IF NOT EXISTS "CorrespondentTransaction_reconciliationStatus_idx" ON "CorrespondentTransaction"("reconciliationStatus");',
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
    'CREATE INDEX IF NOT EXISTS "CorrespondentEvidence_transactionId_idx" ON "CorrespondentEvidence"("transactionId");',
    'CREATE INDEX IF NOT EXISTS "CorrespondentEvidence_capturedByUserId_idx" ON "CorrespondentEvidence"("capturedByUserId");',
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
    'CREATE INDEX IF NOT EXISTS "CorrespondentAuditLog_transactionId_idx" ON "CorrespondentAuditLog"("transactionId");',
    'CREATE INDEX IF NOT EXISTS "CorrespondentAuditLog_userId_idx" ON "CorrespondentAuditLog"("userId");',
    'CREATE INDEX IF NOT EXISTS "CorrespondentAuditLog_createdAt_idx" ON "CorrespondentAuditLog"("createdAt");'
  ];
  for (const s of a)
    await e.$executeRawUnsafe(s);
  const r = await e.$queryRawUnsafe(
    'PRAGMA table_info("CorrespondentTransaction");'
  );
  new Set(r.map((s) => s.name)).has("approvalCode") || await e.$executeRawUnsafe('ALTER TABLE "CorrespondentTransaction" ADD COLUMN "approvalCode" TEXT;');
  const m = await e.correspondentTransaction.findMany({
    select: {
      id: !0,
      approvalCode: !0
    },
    orderBy: [{ createdAt: "asc" }, { performedAt: "asc" }]
  }), c = [], n = /* @__PURE__ */ new Set();
  for (const s of m) {
    const t = re(s.approvalCode || ""), u = !!t && He(t, 4, 40) && !n.has(t) ? t : Fe({
      existingCodes: c,
      generatedPrefix: "APR",
      digits: 6,
      maxLength: 40
    });
    u !== s.approvalCode && await e.correspondentTransaction.update({
      where: { id: s.id },
      data: { approvalCode: u }
    }), c.push(u), n.add(u);
  }
  await e.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "CorrespondentTransaction_approvalCode_key" ON "CorrespondentTransaction"("approvalCode");'
  );
}
async function Sa(e) {
  for (const a of ya) {
    const r = await e.correspondentPlatform.upsert({
      where: { code: a.code },
      update: {
        name: a.name,
        isActive: !0,
        requiresEvidence: a.requiresEvidence ?? !1,
        supportsOcr: a.supportsOcr ?? !1,
        supportsFileImport: a.supportsFileImport ?? !1
      },
      create: {
        code: a.code,
        name: a.name,
        isActive: !0,
        requiresEvidence: a.requiresEvidence ?? !1,
        supportsOcr: a.supportsOcr ?? !1,
        supportsFileImport: a.supportsFileImport ?? !1
      }
    });
    for (const m of a.types)
      await e.correspondentTransactionType.upsert({
        where: {
          platformId_code: {
            platformId: r.id,
            code: m.code
          }
        },
        update: {
          name: m.name,
          direction: m.direction,
          isActive: !0,
          requiresCustomerDocument: m.requiresCustomerDocument ?? !1,
          requiresExternalReference: m.requiresExternalReference ?? !1,
          allowsCommissionOverride: !0,
          sortOrder: m.sortOrder ?? 0
        },
        create: {
          platformId: r.id,
          code: m.code,
          name: m.name,
          direction: m.direction,
          isActive: !0,
          requiresCustomerDocument: m.requiresCustomerDocument ?? !1,
          requiresExternalReference: m.requiresExternalReference ?? !1,
          allowsCommissionOverride: !0,
          sortOrder: m.sortOrder ?? 0
        }
      });
    await e.correspondentCommissionRule.count({
      where: { platformId: r.id }
    }) === 0 && await e.correspondentCommissionRule.create({
      data: {
        platformId: r.id,
        mode: Oe.NONE,
        value: 0,
        isActive: !0
      }
    });
  }
}
async function tt(e, a) {
  return e.cashSession.findFirst({
    where: { userId: a, status: "OPEN" },
    include: { register: !0 },
    orderBy: { openedAt: "desc" }
  });
}
async function at(e, a, r, l, m) {
  const n = (await e.correspondentCommissionRule.findMany({
    where: {
      platformId: a,
      isActive: !0,
      OR: [{ typeId: r }, { typeId: null }],
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: m } }] },
        { OR: [{ validTo: null }, { validTo: { gte: m } }] },
        { OR: [{ minAmount: null }, { minAmount: { lte: l } }] },
        { OR: [{ maxAmount: null }, { maxAmount: { gte: l } }] }
      ]
    }
  })).sort((s, t) => {
    var i, u;
    return s.typeId === r && t.typeId !== r ? -1 : s.typeId !== r && t.typeId === r ? 1 : (((i = t.validFrom) == null ? void 0 : i.getTime()) ?? 0) - (((u = s.validFrom) == null ? void 0 : u.getTime()) ?? 0);
  })[0] ?? null;
  return n ? n.mode === Oe.FIXED ? Ze(n.value) : n.mode === Oe.PERCENTAGE ? Ze(l * n.value / 100) : 0 : 0;
}
function ve(e) {
  return e.reduce(
    (a, r) => r.status === ne.VOIDED ? (a.voidedCount += 1, a) : (a.transactionsCount += 1, a.totalCommission += r.commissionAmount, a.withEvidenceCount += r.evidences.length > 0 ? 1 : 0, a.pendingClosureCount += r.dailyClosureId ? 0 : 1, r.type.direction === _.IN && (a.totalIn += r.amount), r.type.direction === _.OUT && (a.totalOut += r.amount), r.type.direction === _.NEUTRAL && (a.neutralCount += 1), a),
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
async function wa(e) {
  const a = /* @__PURE__ */ new Date(), r = H.join(
    e.app.getPath("userData"),
    "correspondent-evidence",
    String(a.getFullYear()),
    String(a.getMonth() + 1).padStart(2, "0"),
    String(a.getDate()).padStart(2, "0"),
    e.platformCode.toLowerCase()
  );
  await Xt(r, { recursive: !0 });
  const l = Na(e.evidence.fileName), m = H.join(r, `${Date.now()}-${l}`), c = e.evidence.dataBase64.includes(",") ? e.evidence.dataBase64.split(",").pop() ?? "" : e.evidence.dataBase64, n = Buffer.from(c, "base64");
  return await Vt(m, n), {
    fileName: e.evidence.fileName,
    filePath: m,
    mimeType: e.evidence.mimeType ?? null,
    fileSize: n.byteLength,
    fileHash: qt("sha256").update(n).digest("hex"),
    ocrRawText: e.evidence.ocrRawText ?? null
  };
}
async function Q(e) {
  var a, r;
  await e.prisma.correspondentAuditLog.create({
    data: {
      transactionId: e.transactionId ?? null,
      userId: ((a = e.currentSessionUser) == null ? void 0 : a.id) ?? null,
      action: e.action,
      context: e.context ?? null,
      beforeJson: e.beforeJson === void 0 ? null : he(e.beforeJson),
      afterJson: e.afterJson === void 0 ? null : he(e.afterJson)
    }
  }), await e.prisma.auditLog.create({
    data: {
      userId: ((r = e.currentSessionUser) == null ? void 0 : r.id) ?? null,
      module: "correspondent",
      action: e.action,
      entity: e.transactionId ? "CorrespondentTransaction" : "CorrespondentDailyClosure",
      entityId: e.transactionId ?? null,
      beforeJson: e.beforeJson === void 0 ? null : he(e.beforeJson),
      afterJson: e.afterJson === void 0 ? null : he(e.afterJson)
    }
  });
}
async function Ue(e, a, r) {
  return e.correspondentTransaction.findMany({
    where: {
      platformId: r,
      performedAt: {
        gte: ee(a),
        lt: Re(a)
      }
    },
    include: {
      platform: !0,
      type: !0,
      evidences: { select: { id: !0 } },
      registeredBy: { select: { id: !0, username: !0, name: !0 } },
      dailyClosure: { select: { id: !0, businessDate: !0, status: !0 } }
    },
    orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }]
  });
}
async function Oa(e, a, r, l) {
  return e.correspondentTransaction.findMany({
    where: {
      platformId: l,
      performedAt: {
        gte: ee(a),
        lt: Re(r)
      }
    },
    include: {
      platform: !0,
      type: !0,
      evidences: { select: { id: !0 } },
      registeredBy: { select: { id: !0, username: !0, name: !0 } },
      dailyClosure: { select: { id: !0, businessDate: !0, status: !0 } }
    },
    orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }]
  });
}
async function Ra(e, a) {
  return e.correspondentTransaction.findUnique({
    where: { id: a },
    include: {
      platform: !0,
      type: !0,
      registeredBy: { select: { id: !0, username: !0, name: !0 } },
      auditLogs: {
        include: {
          user: {
            select: { id: !0, username: !0, name: !0 }
          }
        },
        orderBy: { createdAt: "desc" }
      },
      dailyClosure: {
        select: {
          id: !0,
          businessDate: !0
        }
      }
    }
  });
}
function Da({
  app: e,
  ipcMain: a,
  prisma: r,
  getCurrentSessionUser: l
}) {
  a.handle("correspondent:catalog", async () => {
    if (!l())
      return { success: !1, message: "Debes iniciar sesion", platforms: [] };
    const [c, n] = await Promise.all([
      r.correspondentPlatform.findMany({
        where: { isActive: !0 },
        include: {
          transactionTypes: {
            where: { isActive: !0 },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
          },
          commissionRules: {
            where: { isActive: !0 },
            orderBy: [{ validFrom: "desc" }]
          }
        },
        orderBy: [{ createdAt: "asc" }, { name: "asc" }]
      }),
      va(r)
    ]);
    return {
      success: !0,
      platforms: c.map((s) => {
        var t, i, u;
        return {
          id: s.id,
          code: s.code,
          name: s.name,
          requiresEvidence: s.requiresEvidence,
          supportsOcr: s.supportsOcr,
          supportsFileImport: s.supportsFileImport,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
          createdBy: ((t = n.platformCreatedBy.get(s.id)) == null ? void 0 : t.user) ?? null,
          updatedBy: ((i = n.platformUpdatedBy.get(s.id)) == null ? void 0 : i.user) ?? ((u = n.platformCreatedBy.get(s.id)) == null ? void 0 : u.user) ?? null,
          types: s.transactionTypes.map((f) => {
            var g, T, I;
            return {
              id: f.id,
              code: f.code,
              name: f.name,
              direction: f.direction,
              requiresCustomerDocument: f.requiresCustomerDocument,
              requiresExternalReference: f.requiresExternalReference,
              createdAt: f.createdAt.toISOString(),
              updatedAt: f.updatedAt.toISOString(),
              createdBy: ((g = n.typeCreatedBy.get(f.id)) == null ? void 0 : g.user) ?? null,
              updatedBy: ((T = n.typeUpdatedBy.get(f.id)) == null ? void 0 : T.user) ?? ((I = n.typeCreatedBy.get(f.id)) == null ? void 0 : I.user) ?? null
            };
          }),
          commissionRules: s.commissionRules.map((f) => ({
            id: f.id,
            typeId: f.typeId,
            mode: f.mode,
            value: f.value,
            minAmount: f.minAmount,
            maxAmount: f.maxAmount
          }))
        };
      })
    };
  }), a.handle("correspondent:dashboard", async () => {
    if (!l())
      return { success: !1, message: "Debes iniciar sesion" };
    const c = ee(/* @__PURE__ */ new Date()), n = await Ue(r, c), s = ve(n), t = n.reduce((i, u) => {
      const f = i[u.platformId] ?? {
        platformId: u.platformId,
        platform: u.platform.name,
        totalIn: 0,
        totalOut: 0,
        totalCommission: 0,
        count: 0,
        pendingClosureCount: 0
      };
      return u.status !== ne.VOIDED && (f.count += 1, f.totalCommission += u.commissionAmount, f.pendingClosureCount += u.dailyClosureId ? 0 : 1, u.type.direction === _.IN && (f.totalIn += u.amount), u.type.direction === _.OUT && (f.totalOut += u.amount)), i[u.platformId] = f, i;
    }, {});
    return {
      success: !0,
      totals: {
        totalIn: s.totalIn,
        totalOut: s.totalOut,
        totalCommission: s.totalCommission,
        expectedBalance: s.totalIn - s.totalOut + s.totalCommission,
        transactionsCount: s.transactionsCount,
        withEvidenceCount: s.withEvidenceCount,
        pendingClosureCount: s.pendingClosureCount,
        voidedCount: s.voidedCount
      },
      perPlatform: Object.values(t).sort((i, u) => i.platform.localeCompare(u.platform, "es")),
      recentTransactions: n.slice(0, 10).map((i) => ({
        id: i.id,
        approvalCode: i.approvalCode,
        platform: i.platform.name,
        type: i.type.name,
        amount: i.amount,
        commissionAmount: i.commissionAmount,
        externalReference: i.externalReference,
        customerName: i.customerName,
        performedAt: i.performedAt.toISOString(),
        status: i.status,
        registeredBy: i.registeredBy.name ?? i.registeredBy.username,
        hasEvidence: i.evidences.length > 0
      }))
    };
  }), a.handle("correspondent:transactions:list", async (m, c) => {
    var f;
    if (!l())
      return { success: !1, message: "Debes iniciar sesion", transactions: [] };
    const s = ca.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Filtros invalidos", transactions: [] };
    const t = s.data, i = (f = t.search) == null ? void 0 : f.trim();
    return {
      success: !0,
      transactions: (await r.correspondentTransaction.findMany({
        where: {
          platformId: t.platformId,
          registeredByUserId: t.userId,
          status: t.status,
          performedAt: t.dateFrom || t.dateTo ? {
            ...t.dateFrom ? { gte: new Date(t.dateFrom) } : {},
            ...t.dateTo ? { lt: Re(new Date(t.dateTo)) } : {}
          } : void 0,
          OR: i ? [
            { approvalCode: { contains: i } },
            { externalReference: { contains: i } },
            { customerName: { contains: i } },
            { customerDocument: { contains: i } },
            { targetAccount: { contains: i } },
            { targetPhone: { contains: i } },
            { note: { contains: i } },
            { platform: { is: { name: { contains: i } } } },
            { type: { is: { name: { contains: i } } } },
            {
              registeredBy: {
                is: {
                  OR: [
                    { username: { contains: i } },
                    { name: { contains: i } }
                  ]
                }
              }
            }
          ] : void 0
        },
        include: {
          platform: !0,
          type: !0,
          registeredBy: { select: { id: !0, username: !0, name: !0 } },
          evidences: { select: { id: !0, fileName: !0 } },
          dailyClosure: { select: { id: !0, status: !0 } }
        },
        orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
        take: 150
      })).map((g) => {
        var T, I;
        return {
          id: g.id,
          approvalCode: g.approvalCode,
          platformId: g.platformId,
          platform: g.platform.name,
          typeId: g.typeId,
          type: g.type.name,
          direction: g.type.direction,
          amount: g.amount,
          commissionAmount: g.commissionAmount,
          netAmount: g.netAmount,
          externalReference: g.externalReference,
          customerName: g.customerName,
          customerDocument: g.customerDocument,
          targetAccount: g.targetAccount,
          targetPhone: g.targetPhone,
          performedAt: g.performedAt.toISOString(),
          status: g.status,
          source: g.source,
          registeredBy: g.registeredBy.name ?? g.registeredBy.username,
          note: g.note,
          hasEvidence: g.evidences.length > 0,
          evidenceCount: g.evidences.length,
          closureId: ((T = g.dailyClosure) == null ? void 0 : T.id) ?? null,
          closureStatus: ((I = g.dailyClosure) == null ? void 0 : I.status) ?? null
        };
      })
    };
  }), a.handle("correspondent:transaction:detail", async (m, c) => {
    if (!l())
      return { success: !1, message: "Debes iniciar sesion" };
    const s = ia.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Transaccion invalida" };
    const t = await Ra(r, s.data.transactionId);
    return t ? {
      success: !0,
      transaction: {
        id: t.id,
        approvalCode: t.approvalCode,
        platformId: t.platformId,
        platform: t.platform.name,
        typeId: t.typeId,
        type: t.type.name,
        amount: t.amount,
        commissionAmount: t.commissionAmount,
        netAmount: t.netAmount,
        performedAt: t.performedAt.toISOString(),
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        registeredBy: t.registeredBy.name ?? t.registeredBy.username,
        note: t.note,
        status: t.status,
        auditTrail: t.auditLogs.map((i) => ({
          id: i.id,
          action: i.action,
          createdAt: i.createdAt.toISOString(),
          user: i.user ? i.user.name ?? i.user.username : null,
          beforeJson: i.beforeJson,
          afterJson: i.afterJson,
          context: i.context
        }))
      }
    } : { success: !1, message: "La transaccion ya no existe" };
  }), a.handle("correspondent:transaction:create", async (m, c) => {
    var C, h, v, D, P, b, d, A, S, y;
    const n = l();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion para registrar movimientos" };
    const s = na.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para el corresponsal" };
    const t = s.data, i = new Date(t.performedAt), [u, f, g] = await Promise.all([
      r.correspondentPlatform.findUnique({ where: { id: t.platformId } }),
      r.correspondentTransactionType.findUnique({ where: { id: t.typeId } }),
      tt(r, n.id)
    ]);
    if (!u || !u.isActive)
      return { success: !1, message: "La plataforma seleccionada no esta disponible" };
    if (!f || !f.isActive || f.platformId !== u.id)
      return { success: !1, message: "El tipo de transaccion no corresponde a la plataforma" };
    if (await r.correspondentTransaction.findFirst({
      where: {
        platformId: u.id,
        typeId: f.id,
        amount: t.amount,
        externalReference: ((C = t.externalReference) == null ? void 0 : C.trim()) || null,
        performedAt: {
          gte: new Date(i.getTime() - 10 * 60 * 1e3),
          lte: new Date(i.getTime() + 10 * 60 * 1e3)
        },
        status: ne.REGISTERED
      }
    }))
      return { success: !1, message: "Parece un duplicado reciente. Verifica antes de registrar." };
    const I = t.commissionAmount ?? await at(r, u.id, f.id, t.amount, i), p = f.direction === _.OUT ? t.amount - I : t.amount + I, N = t.evidence ? await wa({ app: e, platformCode: u.code, evidence: t.evidence }) : null;
    try {
      const w = (await r.correspondentTransaction.findMany({
        select: { approvalCode: !0 }
      })).map((Y) => Y.approvalCode), $ = Fe({
        desiredCode: t.approvalCode,
        existingCodes: w,
        generatedPrefix: "APR",
        digits: 6,
        maxLength: 40
      }), U = await r.correspondentTransaction.create({
        data: {
          approvalCode: $,
          platformId: u.id,
          typeId: f.id,
          cashSessionId: (g == null ? void 0 : g.id) ?? null,
          cashRegisterId: (g == null ? void 0 : g.registerId) ?? null,
          registeredByUserId: n.id,
          status: ne.REGISTERED,
          source: t.source,
          ocrStatus: (h = t.evidence) != null && h.ocrRawText ? Le.PROCESSED : u.supportsOcr ? Le.NEEDS_REVIEW : Le.NOT_REQUESTED,
          reconciliationStatus: $t.PENDING,
          externalReference: ((v = t.externalReference) == null ? void 0 : v.trim()) || null,
          customerName: ((D = t.customerName) == null ? void 0 : D.trim()) || null,
          customerDocument: ((P = t.customerDocument) == null ? void 0 : P.trim()) || null,
          targetAccount: ((b = t.targetAccount) == null ? void 0 : b.trim()) || null,
          targetPhone: ((d = t.targetPhone) == null ? void 0 : d.trim()) || null,
          amount: t.amount,
          commissionAmount: I,
          netAmount: p,
          performedAt: i,
          note: ((A = t.note) == null ? void 0 : A.trim()) || null,
          rawExtractedText: ((S = t.rawExtractedText) == null ? void 0 : S.trim()) || ((y = t.evidence) == null ? void 0 : y.ocrRawText) || null,
          evidences: N ? {
            create: {
              ...N,
              capturedByUserId: n.id
            }
          } : void 0
        },
        include: {
          platform: !0,
          type: !0,
          evidences: { select: { id: !0 } }
        }
      });
      return await Q({
        prisma: r,
        currentSessionUser: n,
        transactionId: U.id,
        action: "create_transaction",
        afterJson: {
          approvalCode: U.approvalCode,
          platform: U.platform.name,
          type: U.type.name,
          amount: U.amount,
          commissionAmount: U.commissionAmount,
          hasEvidence: U.evidences.length > 0
        }
      }), {
        success: !0,
        transaction: {
          id: U.id,
          approvalCode: U.approvalCode,
          platform: U.platform.name,
          type: U.type.name,
          amount: U.amount,
          commissionAmount: U.commissionAmount,
          netAmount: U.netAmount,
          hasEvidence: U.evidences.length > 0
        }
      };
    } catch (w) {
      return { success: !1, message: w instanceof Error ? w.message : "No se pudo registrar la transaccion" };
    }
  }), a.handle("correspondent:transaction:update", async (m, c) => {
    const n = l();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion para editar movimientos" };
    const s = oa.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para actualizar la transaccion" };
    const t = await r.correspondentTransaction.findUnique({
      where: { id: s.data.transactionId },
      include: {
        platform: !0,
        type: !0
      }
    });
    if (!t)
      return { success: !1, message: "La transaccion ya no existe" };
    if (t.dailyClosureId)
      return { success: !1, message: "No puedes editar una transaccion que ya hace parte de un cuadre" };
    if (t.status === ne.VOIDED)
      return { success: !1, message: "No puedes editar una transaccion anulada" };
    const i = await r.correspondentTransactionType.findUnique({
      where: { id: s.data.typeId }
    });
    if (!i || !i.isActive || i.platformId !== t.platformId)
      return { success: !1, message: "El nuevo tipo no pertenece al mismo corresponsal" };
    const u = new Date(s.data.performedAt), f = await at(
      r,
      t.platformId,
      i.id,
      s.data.amount,
      u
    ), g = i.direction === _.OUT ? s.data.amount - f : s.data.amount + f;
    try {
      const T = (await r.correspondentTransaction.findMany({
        where: { NOT: { id: t.id } },
        select: { approvalCode: !0 }
      })).map((N) => N.approvalCode), I = Fe({
        desiredCode: s.data.approvalCode ?? t.approvalCode,
        existingCodes: T,
        generatedPrefix: "APR",
        digits: 6,
        maxLength: 40
      }), p = await r.correspondentTransaction.update({
        where: { id: t.id },
        data: {
          approvalCode: I,
          typeId: i.id,
          amount: s.data.amount,
          commissionAmount: f,
          netAmount: g,
          performedAt: u,
          reviewedByUserId: n.id
        },
        include: {
          platform: !0,
          type: !0,
          evidences: { select: { id: !0 } }
        }
      });
      return await Q({
        prisma: r,
        currentSessionUser: n,
        transactionId: p.id,
        action: "update_transaction",
        beforeJson: {
          approvalCode: t.approvalCode,
          type: t.type.name,
          amount: t.amount,
          performedAt: t.performedAt.toISOString(),
          commissionAmount: t.commissionAmount
        },
        afterJson: {
          approvalCode: p.approvalCode,
          type: p.type.name,
          amount: p.amount,
          performedAt: p.performedAt.toISOString(),
          commissionAmount: p.commissionAmount
        }
      }), {
        success: !0,
        transaction: {
          id: p.id,
          approvalCode: p.approvalCode,
          platform: p.platform.name,
          type: p.type.name,
          amount: p.amount,
          commissionAmount: p.commissionAmount,
          netAmount: p.netAmount,
          hasEvidence: p.evidences.length > 0
        }
      };
    } catch (T) {
      return { success: !1, message: T instanceof Error ? T.message : "No se pudo actualizar la transaccion" };
    }
  }), a.handle("correspondent:platform:create", async (m, c) => {
    const n = l();
    if (!n || n.role !== F.ADMIN)
      return { success: !1, message: "Solo el administrador puede crear corresponsales" };
    const s = la.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para el corresponsal" };
    const t = s.data.name.trim();
    if (await r.correspondentPlatform.findFirst({
      where: { name: { equals: t } },
      select: { id: !0 }
    }))
      return { success: !1, message: "Ya existe un corresponsal con ese nombre" };
    try {
      const u = await r.correspondentPlatform.create({
        data: {
          code: await Ca(r, t),
          name: t,
          isActive: !0,
          requiresEvidence: s.data.requiresEvidence,
          supportsOcr: s.data.supportsOcr,
          supportsFileImport: s.data.supportsFileImport
        }
      });
      return await r.correspondentCommissionRule.create({
        data: {
          platformId: u.id,
          mode: Oe.NONE,
          value: 0,
          isActive: !0
        }
      }), await Q({
        prisma: r,
        currentSessionUser: n,
        action: "create_platform",
        context: `platform:${u.id}`,
        afterJson: {
          platform: u.name,
          code: u.code
        }
      }), { success: !0, platformId: u.id };
    } catch (u) {
      return { success: !1, message: u instanceof Error ? u.message : "No se pudo crear el corresponsal" };
    }
  }), a.handle("correspondent:platform:update", async (m, c) => {
    const n = l();
    if (!n || n.role !== F.ADMIN)
      return { success: !1, message: "Solo el administrador puede editar corresponsales" };
    const s = pa.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para actualizar el corresponsal" };
    const t = await r.correspondentPlatform.findUnique({
      where: { id: s.data.platformId }
    });
    if (!t)
      return { success: !1, message: "El corresponsal ya no existe" };
    if (await r.correspondentPlatform.findFirst({
      where: {
        name: { equals: s.data.name.trim() },
        NOT: { id: t.id }
      },
      select: { id: !0 }
    }))
      return { success: !1, message: "Ya existe otro corresponsal con ese nombre" };
    try {
      const u = await r.correspondentPlatform.update({
        where: { id: t.id },
        data: {
          name: s.data.name.trim(),
          requiresEvidence: s.data.requiresEvidence,
          supportsOcr: s.data.supportsOcr,
          supportsFileImport: s.data.supportsFileImport
        }
      });
      return await Q({
        prisma: r,
        currentSessionUser: n,
        action: "update_platform",
        context: `platform:${u.id}`,
        beforeJson: {
          name: t.name,
          requiresEvidence: t.requiresEvidence,
          supportsOcr: t.supportsOcr,
          supportsFileImport: t.supportsFileImport
        },
        afterJson: {
          name: u.name,
          requiresEvidence: u.requiresEvidence,
          supportsOcr: u.supportsOcr,
          supportsFileImport: u.supportsFileImport
        }
      }), { success: !0, platformId: u.id };
    } catch (u) {
      return { success: !1, message: u instanceof Error ? u.message : "No se pudo actualizar el corresponsal" };
    }
  }), a.handle("correspondent:platform:delete", async (m, c) => {
    const n = l();
    if (!n || n.role !== F.ADMIN)
      return { success: !1, message: "Solo el administrador puede eliminar corresponsales" };
    const s = ga.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Corresponsal invalido" };
    const t = await r.correspondentPlatform.findUnique({
      where: { id: s.data.platformId },
      include: {
        transactionTypes: {
          select: { id: !0 }
        }
      }
    });
    if (!t)
      return { success: !1, message: "El corresponsal ya no existe" };
    try {
      return await r.$transaction(async (i) => {
        await i.correspondentPlatform.update({
          where: { id: t.id },
          data: { isActive: !1 }
        }), t.transactionTypes.length > 0 && await i.correspondentTransactionType.updateMany({
          where: { platformId: t.id },
          data: { isActive: !1 }
        });
      }), await Q({
        prisma: r,
        currentSessionUser: n,
        action: "delete_platform",
        context: `platform:${t.id}`,
        beforeJson: {
          name: t.name
        }
      }), { success: !0, platformId: t.id };
    } catch (i) {
      return { success: !1, message: i instanceof Error ? i.message : "No se pudo eliminar el corresponsal" };
    }
  }), a.handle("correspondent:type:create", async (m, c) => {
    var f;
    const n = l();
    if (!n || n.role !== F.ADMIN)
      return { success: !1, message: "Solo el administrador puede crear tipos" };
    const s = ma.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para el tipo" };
    const t = await r.correspondentPlatform.findUnique({
      where: { id: s.data.platformId },
      include: {
        transactionTypes: {
          select: { sortOrder: !0 },
          orderBy: { sortOrder: "desc" },
          take: 1
        }
      }
    });
    if (!t || !t.isActive)
      return { success: !1, message: "El corresponsal ya no existe" };
    const i = s.data.name.trim();
    if (await r.correspondentTransactionType.findFirst({
      where: {
        platformId: t.id,
        name: { equals: i }
      },
      select: { id: !0 }
    }))
      return { success: !1, message: "Ese corresponsal ya tiene un tipo con ese nombre" };
    try {
      const g = await r.correspondentTransactionType.create({
        data: {
          platformId: t.id,
          code: await ha(r, t.id, i),
          name: i,
          direction: s.data.direction,
          isActive: !0,
          sortOrder: (((f = t.transactionTypes[0]) == null ? void 0 : f.sortOrder) ?? 0) + 10
        }
      });
      return await Q({
        prisma: r,
        currentSessionUser: n,
        action: "create_transaction_type",
        context: `platform:${t.id};type:${g.id}`,
        afterJson: {
          platform: t.name,
          type: g.name,
          direction: g.direction
        }
      }), { success: !0, typeId: g.id };
    } catch (g) {
      return { success: !1, message: g instanceof Error ? g.message : "No se pudo crear el tipo" };
    }
  }), a.handle("correspondent:type:update", async (m, c) => {
    const n = l();
    if (!n || n.role !== F.ADMIN)
      return { success: !1, message: "Solo el administrador puede editar tipos" };
    const s = fa.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para actualizar el tipo" };
    const t = await r.correspondentTransactionType.findUnique({
      where: { id: s.data.typeId }
    });
    if (!t)
      return { success: !1, message: "El tipo ya no existe" };
    if (await r.correspondentTransactionType.findFirst({
      where: {
        platformId: t.platformId,
        name: { equals: s.data.name.trim() },
        NOT: { id: t.id }
      },
      select: { id: !0 }
    }))
      return { success: !1, message: "Ya existe otro tipo con ese nombre en el corresponsal" };
    try {
      const u = await r.correspondentTransactionType.update({
        where: { id: t.id },
        data: {
          name: s.data.name.trim(),
          direction: s.data.direction
        }
      });
      return await Q({
        prisma: r,
        currentSessionUser: n,
        action: "update_transaction_type",
        context: `platform:${t.platformId};type:${u.id}`,
        beforeJson: {
          name: t.name,
          direction: t.direction
        },
        afterJson: {
          name: u.name,
          direction: u.direction
        }
      }), { success: !0, typeId: u.id };
    } catch (u) {
      return { success: !1, message: u instanceof Error ? u.message : "No se pudo actualizar el tipo" };
    }
  }), a.handle("correspondent:type:delete", async (m, c) => {
    const n = l();
    if (!n || n.role !== F.ADMIN)
      return { success: !1, message: "Solo el administrador puede eliminar tipos" };
    const s = Ea.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Tipo invalido" };
    const t = await r.correspondentTransactionType.findUnique({
      where: { id: s.data.typeId }
    });
    if (!t)
      return { success: !1, message: "El tipo ya no existe" };
    try {
      return await r.correspondentTransactionType.update({
        where: { id: t.id },
        data: { isActive: !1 }
      }), await Q({
        prisma: r,
        currentSessionUser: n,
        action: "delete_transaction_type",
        context: `platform:${t.platformId};type:${t.id}`,
        beforeJson: {
          name: t.name,
          direction: t.direction
        }
      }), { success: !0, typeId: t.id };
    } catch (i) {
      return { success: !1, message: i instanceof Error ? i.message : "No se pudo eliminar el tipo" };
    }
  }), a.handle("correspondent:closures:list", async (m, c) => {
    if (!l())
      return { success: !1, message: "Debes iniciar sesion", closures: [] };
    const s = da.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Fecha de cierre invalida", closures: [] };
    const t = !!(s.data.dateFrom || s.data.dateTo), i = Ce(s.data.dateFrom ?? s.data.businessDate), u = Ce(s.data.dateTo ?? s.data.dateFrom ?? s.data.businessDate), f = Ce(s.data.businessDate ?? s.data.dateFrom), [g, T, I] = await Promise.all([
      r.correspondentPlatform.findMany({
        where: { isActive: !0 },
        orderBy: [{ createdAt: "asc" }, { name: "asc" }]
      }),
      r.correspondentDailyClosure.findMany({
        where: t ? {
          businessDate: {
            gte: ee(i),
            lt: Re(u)
          }
        } : { businessDate: f },
        include: {
          platform: !0,
          closedBy: { select: { username: !0, name: !0 } }
        },
        orderBy: { closedAt: "desc" }
      }),
      t ? Oa(r, i, u) : Ue(r, f)
    ]), p = new Map(
      T.map((v) => [v.platformId, v])
    ), N = T.reduce((v, D) => (v[D.platformId] = (v[D.platformId] ?? 0) + 1, v), {}), C = I.reduce((v, D) => (v[D.platformId] = [...v[D.platformId] ?? [], D], v), {}), h = ve(I);
    return {
      success: !0,
      mode: t ? "range" : "day",
      businessDate: f.toISOString(),
      dateFrom: ee(i).toISOString(),
      dateTo: ee(u).toISOString(),
      totals: {
        totalIn: h.totalIn,
        totalOut: h.totalOut,
        netTotal: h.totalIn - h.totalOut,
        transactionsCount: h.transactionsCount
      },
      closures: g.map((v) => {
        const D = C[v.id] ?? [], P = ve(D), b = p.get(v.id) ?? null, d = D.reduce((A, S) => {
          if (S.status === ne.VOIDED)
            return A;
          const y = A[S.typeId] ?? {
            typeId: S.typeId,
            type: S.type.name,
            direction: S.type.direction,
            total: 0,
            count: 0
          };
          return y.total += S.amount, y.count += 1, A[S.typeId] = y, A;
        }, {});
        return {
          platformId: v.id,
          platform: v.name,
          totalIn: P.totalIn,
          totalOut: P.totalOut,
          totalCommission: P.totalCommission,
          expectedBalance: P.totalIn - P.totalOut + P.totalCommission,
          transactionsCount: P.transactionsCount,
          pendingTransactions: P.pendingClosureCount,
          closuresCount: N[v.id] ?? 0,
          breakdown: Object.values(d).sort((A, S) => A.type.localeCompare(S.type, "es")),
          closure: !t && b ? {
            id: b.id,
            expectedBalance: b.expectedBalance,
            reportedBalance: b.reportedBalance,
            differenceAmount: b.differenceAmount,
            status: b.status,
            closedAt: b.closedAt.toISOString(),
            closedBy: b.closedBy.name ?? b.closedBy.username,
            note: b.note
          } : null
        };
      })
    };
  }), a.handle("correspondent:closure:create", async (m, c) => {
    const n = l();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion para cerrar" };
    const s = ua.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para el cierre" };
    const t = s.data, i = Ce(t.businessDate);
    if (await r.correspondentDailyClosure.findFirst({
      where: {
        platformId: t.platformId,
        businessDate: i
      }
    }))
      return { success: !1, message: "La plataforma ya fue cerrada para esa fecha" };
    const [f, g, T] = await Promise.all([
      r.correspondentPlatform.findUnique({ where: { id: t.platformId } }),
      Ue(r, i, t.platformId),
      tt(r, n.id)
    ]);
    if (!f)
      return { success: !1, message: "Plataforma no encontrada" };
    const I = g.filter(
      (h) => h.status === ne.REGISTERED && !h.dailyClosureId
    ), p = ve(I), N = t.openingBalance + p.totalIn - p.totalOut + p.totalCommission, C = t.reportedBalance - N;
    try {
      const h = await r.$transaction(async (v) => {
        var P;
        const D = await v.correspondentDailyClosure.create({
          data: {
            platformId: f.id,
            cashSessionId: (T == null ? void 0 : T.id) ?? null,
            businessDate: i,
            totalIn: p.totalIn,
            totalOut: p.totalOut,
            totalCommission: p.totalCommission,
            transactionsCount: p.transactionsCount,
            expectedBalance: N,
            reportedBalance: t.reportedBalance,
            differenceAmount: C,
            status: C === 0 ? We.CLOSED : We.WITH_DIFFERENCE,
            note: ((P = t.note) == null ? void 0 : P.trim()) || null,
            closedByUserId: n.id
          }
        });
        return I.length > 0 && await v.correspondentTransaction.updateMany({
          where: {
            id: { in: I.map((b) => b.id) }
          },
          data: {
            dailyClosureId: D.id
          }
        }), D;
      });
      return await Q({
        prisma: r,
        currentSessionUser: n,
        action: "create_closure",
        context: `platform:${f.id};closure:${h.id}`,
        afterJson: {
          platform: f.name,
          businessDate: i.toISOString(),
          expectedBalance: N,
          reportedBalance: t.reportedBalance,
          differenceAmount: C
        }
      }), {
        success: !0,
        closure: {
          id: h.id,
          expectedBalance: N,
          reportedBalance: h.reportedBalance,
          differenceAmount: h.differenceAmount,
          status: h.status
        }
      };
    } catch (h) {
      return { success: !1, message: h instanceof Error ? h.message : "No se pudo cerrar la plataforma" };
    }
  });
}
const xa = o.enum(["CASH", "TRANSFER", "CORRESPONDENT"]), Pa = o.object({
  dateFrom: o.string().datetime().optional(),
  dateTo: o.string().datetime().optional()
}).optional().default({}), La = o.object({
  saleId: o.string().uuid("saleId invalido"),
  customerId: o.string().uuid("customerId invalido"),
  total: o.number().int("El valor debe ser entero").positive("El valor debe ser mayor a 0").optional(),
  dueDate: o.string().datetime("Fecha de vencimiento invalida").optional().nullable()
}), Ua = o.object({
  creditId: o.string().uuid("creditId invalido"),
  amount: o.number().int("El valor debe ser entero").positive("El valor debe ser mayor a 0"),
  method: Ke.optional().default("CASH"),
  note: o.string().trim().max(250).optional().nullable()
}), Ma = o.object({
  saleId: o.string().uuid("saleId invalido"),
  amount: o.number().int("El valor debe ser entero").positive("El valor debe ser mayor a 0"),
  reason: o.string().trim().max(250).optional().nullable()
}), _a = o.object({
  amount: o.number().int("El valor debe ser entero").positive("El valor debe ser mayor a 0"),
  note: o.string().trim().min(2, "La descripcion es obligatoria").max(250),
  type: o.enum(["EXPENSE_OUT", "WITHDRAWAL_OUT"]).optional().default("EXPENSE_OUT"),
  sourceMedium: xa.optional().default("CASH"),
  sourcePlatformId: o.string().uuid("Plataforma invalida").optional().nullable()
}), Tt = o.enum([
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
]), Ba = [0, 0.05, 0.19];
function It(e, a) {
  e !== void 0 && (Ba.includes(e) || a.addIssue({
    code: o.ZodIssueCode.custom,
    message: "El IVA permitido es: no aplica, 0%, 5% o 19%",
    path: ["taxRate"]
  }));
}
const Fa = o.object({
  name: o.string({ message: "El nombre es obligatorio" }).trim().min(2, "Minimo 2 caracteres").max(120, "Maximo 120 caracteres"),
  barcode: o.string().trim().min(1).max(50).optional().nullable(),
  sku: o.string().trim().min(1).max(50).optional().nullable(),
  unitMeasure: Tt.optional().default("UNIDAD"),
  price: o.number({ message: "El precio es obligatorio" }).positive("El precio debe ser mayor a 0"),
  cost: o.number().min(0, "El costo no puede ser negativo").optional().default(0),
  marginPercent: o.number().min(0, "La ganancia no puede ser negativa").optional().default(0),
  hasTax: o.boolean().optional().default(!1),
  taxRate: o.number().min(0).max(1).optional().default(0),
  stock: o.number().int("El stock debe ser un numero entero").min(0, "El stock no puede ser negativo").optional().default(0),
  categoryId: o.string().uuid().optional().nullable(),
  subcategoryId: o.string().uuid().optional().nullable(),
  isActive: o.boolean().optional().default(!0)
}).superRefine((e, a) => {
  It(e.taxRate, a);
}), $a = o.object({
  id: o.string().uuid("ID de producto invalido"),
  name: o.string().trim().min(2, "Minimo 2 caracteres").max(120).optional(),
  barcode: o.string().trim().min(1).max(50).optional().nullable(),
  sku: o.string().trim().min(1).max(50).optional().nullable(),
  unitMeasure: Tt.optional(),
  price: o.number().positive("El precio debe ser mayor a 0").optional(),
  cost: o.number().min(0).optional(),
  marginPercent: o.number().min(0).optional(),
  hasTax: o.boolean().optional(),
  taxRate: o.number().min(0).max(1).optional(),
  stock: o.number().int().min(0).optional(),
  categoryId: o.string().uuid().optional().nullable(),
  subcategoryId: o.string().uuid().optional().nullable(),
  isActive: o.boolean().optional()
}).superRefine((e, a) => {
  It(e.taxRate, a);
});
o.object({
  productId: o.string().uuid("ID de producto invalido"),
  delta: o.number().int("El ajuste debe ser un numero entero").refine((e) => e !== 0, "El ajuste no puede ser 0"),
  reason: o.string().trim().max(200).optional()
});
o.object({
  barcode: o.string().trim().min(1, "Barcode no puede estar vacio")
});
const yt = {
  title: "Acceso a interfaces",
  groups: [
    {
      title: "Operacion comercial",
      permissions: [
        "Acceder a Facturar",
        "Acceder a Historial ventas",
        "Acceder a Clientes",
        "Acceder a Compras",
        "Acceder a Proveedores"
      ]
    },
    {
      title: "Caja y corresponsal",
      permissions: [
        "Acceder a Caja general",
        "Acceder a Corresponsal transacciones",
        "Acceder a Corresponsal historial",
        "Acceder a Corresponsal resumen diario",
        "Acceder a Corresponsal configuracion"
      ]
    },
    {
      title: "Inventario",
      permissions: [
        "Acceder a Productos",
        "Acceder a Movimientos de inventario"
      ]
    },
    {
      title: "Control financiero",
      permissions: [
        "Acceder a Centro contable",
        "Acceder a Reportes"
      ]
    },
    {
      title: "Gestion y sistema",
      permissions: [
        "Acceder a Usuarios",
        "Acceder a Roles y permisos",
        "Acceder a Configuracion"
      ]
    }
  ]
}, ka = [
  yt,
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
        title: "Interfaz del sistema",
        permissions: [
          "Cambiar tema del sistema"
        ]
      },
      {
        title: "Datos del negocio",
        permissions: [
          "Editar datos del negocio"
        ]
      },
      {
        title: "Facturacion e impresion",
        permissions: [
          "Configurar factura e impresion",
          "Editar informacion fiscal",
          "Configurar numeraciones",
          "Configurar impuestos"
        ]
      },
      {
        title: "Inventario y operacion",
        permissions: [
          "Configurar inventario y comportamiento de venta",
          "Configurar listas de precios",
          "Configurar almacenes",
          "Sincronizar informacion"
        ]
      }
    ]
  }
], Xa = [
  yt,
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
        title: "Interfaz del sistema",
        permissions: [
          "Cambiar tema del sistema"
        ]
      },
      {
        title: "Datos del negocio",
        permissions: [
          "Editar datos del negocio"
        ]
      },
      {
        title: "Facturacion e impresion",
        permissions: [
          "Configurar factura e impresion"
        ]
      },
      {
        title: "Inventario y operacion",
        permissions: [
          "Configurar inventario y comportamiento de venta"
        ]
      },
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
], De = [
  {
    key: "ADMIN",
    name: "Administrador",
    description: "Acceso completo a todas las secciones del sistema, puede agregar o eliminar usuarios y administrar la configuracion general.",
    sections: ka
  },
  {
    key: "EMPLOYEE",
    name: "Empleado",
    description: "Acceso operativo para ventas y caja, con permisos limitados sobre configuracion, usuarios y reportes sensibles.",
    sections: Xa
  }
];
function Va(e) {
  return De.find((a) => a.key === e) ?? De[0];
}
function Me(e) {
  return e.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function O(e, a, r) {
  return [Me(e), Me(a), Me(r)].filter(Boolean).join(".");
}
function Nt(e) {
  return e.sections.flatMap(
    (a) => a.groups.flatMap(
      (r) => r.permissions.map((l) => ({
        key: O(a.title, r.title, l),
        label: l,
        sectionTitle: a.title,
        groupTitle: r.title
      }))
    )
  );
}
function Ct(e, a) {
  return Nt(Va(e)).find((r) => r.key === a) ?? null;
}
const qa = {
  posAccess: O("Acceso a interfaces", "Operacion comercial", "Acceder a Facturar"),
  salesAccess: O("Acceso a interfaces", "Operacion comercial", "Acceder a Historial ventas"),
  customersAccess: O("Acceso a interfaces", "Operacion comercial", "Acceder a Clientes"),
  purchasesAccess: O("Acceso a interfaces", "Operacion comercial", "Acceder a Compras"),
  suppliersAccess: O("Acceso a interfaces", "Operacion comercial", "Acceder a Proveedores"),
  cashAccess: O("Acceso a interfaces", "Caja y corresponsal", "Acceder a Caja general"),
  correspondentAccess: O("Acceso a interfaces", "Caja y corresponsal", "Acceder a Corresponsal transacciones"),
  correspondentHistoryAccess: O("Acceso a interfaces", "Caja y corresponsal", "Acceder a Corresponsal historial"),
  correspondentClosuresAccess: O("Acceso a interfaces", "Caja y corresponsal", "Acceder a Corresponsal resumen diario"),
  correspondentSettingsAccess: O("Acceso a interfaces", "Caja y corresponsal", "Acceder a Corresponsal configuracion"),
  productsAccess: O("Acceso a interfaces", "Inventario", "Acceder a Productos"),
  stockMovesAccess: O("Acceso a interfaces", "Inventario", "Acceder a Movimientos de inventario"),
  accountingAccess: O("Acceso a interfaces", "Control financiero", "Acceder a Centro contable"),
  reportsAccess: O("Acceso a interfaces", "Control financiero", "Acceder a Reportes"),
  usersAccess: O("Acceso a interfaces", "Gestion y sistema", "Acceder a Usuarios"),
  rolesAccess: O("Acceso a interfaces", "Gestion y sistema", "Acceder a Roles y permisos"),
  settingsAccess: O("Acceso a interfaces", "Gestion y sistema", "Acceder a Configuracion")
}, ja = {
  salesCreate: O("POS", "Operacion POS", "Crear ventas desde POS"),
  salesChangeCustomer: O("POS", "Operacion POS", "Cambiar cliente en la factura"),
  salesManagePayments: O("POS", "Operacion POS", "Gestionar pagos en efectivo, transferencia y combinado"),
  salesHistory: O("POS", "Operacion POS", "Ver historial de ventas"),
  salesPrint: O("POS", "Operacion POS", "Imprimir factura"),
  cashOpen: O("POS", "Caja y control diario", "Abrir caja"),
  cashClose: O("POS", "Caja y control diario", "Cerrar caja"),
  cashView: O("POS", "Caja y control diario", "Consultar resumen de caja"),
  productsView: O("Contabilidad", "Items, inventario y contactos", "Ver listado de items"),
  productsCreate: O("Contabilidad", "Items, inventario y contactos", "Crear nuevos items de venta"),
  productsEdit: O("Contabilidad", "Items, inventario y contactos", "Editar items"),
  productsDelete: O("Contabilidad", "Items, inventario y contactos", "Eliminar items"),
  stockMovesView: O("Contabilidad", "Items, inventario y contactos", "Ver listado de ajustes de inventario"),
  purchasesView: O("Contabilidad", "Compras y proveedores", "Ver listado de facturas de proveedores"),
  purchasesDetails: O("Contabilidad", "Compras y proveedores", "Ver detalles de facturas de proveedores"),
  purchasesCreate: O("Contabilidad", "Compras y proveedores", "Crear nuevas facturas de proveedores"),
  suppliersView: O("Contabilidad", "Items, inventario y contactos", "Ver listado de proveedores"),
  suppliersCreate: O("Contabilidad", "Items, inventario y contactos", "Agregar nuevos contactos"),
  suppliersEdit: O("Contabilidad", "Items, inventario y contactos", "Editar contactos"),
  usersView: O("Configuraciones generales", "Usuarios y seguridad", "Ver usuarios"),
  usersCreate: O("Configuraciones generales", "Usuarios y seguridad", "Crear usuarios"),
  usersEdit: O("Configuraciones generales", "Usuarios y seguridad", "Editar usuarios"),
  rolesView: O("Configuraciones generales", "Usuarios y seguridad", "Ver roles y permisos"),
  rolesManage: O("Configuraciones generales", "Usuarios y seguridad", "Administrar el rol Administrador"),
  customersView: O("Contabilidad", "Items, inventario y contactos", "Ver listado de clientes"),
  customersCreate: O("Contabilidad", "Items, inventario y contactos", "Agregar nuevos contactos"),
  customersEdit: O("Contabilidad", "Items, inventario y contactos", "Editar contactos"),
  correspondentView: O("POS", "Operacion de tienda", "Gestionar corresponsal"),
  reportsView: O("Contabilidad", "Reportes comerciales y financieros", "Ver reporte de ventas generales"),
  settingsView: O("Configuraciones generales", "Negocio y sistema", "Editar configuracion general del negocio"),
  settingsTheme: O("Configuraciones generales", "Interfaz del sistema", "Cambiar tema del sistema"),
  settingsBusiness: O("Configuraciones generales", "Datos del negocio", "Editar datos del negocio"),
  settingsBilling: O("Configuraciones generales", "Facturacion e impresion", "Configurar factura e impresion"),
  settingsInventory: O("Configuraciones generales", "Inventario y operacion", "Configurar inventario y comportamiento de venta")
}, E = {
  ...qa,
  ...ja
}, ht = {
  [E.posAccess]: [
    E.salesCreate,
    E.salesChangeCustomer,
    E.salesManagePayments,
    E.salesHistory,
    E.salesPrint
  ],
  [E.salesAccess]: [
    E.salesHistory,
    E.salesPrint
  ],
  [E.customersAccess]: [
    E.customersView,
    E.customersCreate,
    E.customersEdit
  ],
  [E.purchasesAccess]: [
    E.purchasesView,
    E.purchasesDetails,
    E.purchasesCreate
  ],
  [E.suppliersAccess]: [
    E.suppliersView,
    E.suppliersCreate,
    E.suppliersEdit
  ],
  [E.cashAccess]: [
    E.cashView,
    E.cashOpen,
    E.cashClose
  ],
  [E.correspondentAccess]: [E.correspondentView],
  [E.correspondentHistoryAccess]: [E.correspondentView],
  [E.correspondentClosuresAccess]: [E.correspondentView, E.cashView],
  [E.correspondentSettingsAccess]: [E.correspondentView],
  [E.productsAccess]: [
    E.productsView,
    E.productsCreate,
    E.productsEdit,
    E.productsDelete
  ],
  [E.stockMovesAccess]: [
    E.stockMovesView,
    E.productsEdit
  ],
  [E.accountingAccess]: [E.reportsView],
  [E.reportsAccess]: [E.reportsView],
  [E.usersAccess]: [
    E.usersView,
    E.usersCreate,
    E.usersEdit
  ],
  [E.rolesAccess]: [
    E.rolesView,
    E.rolesManage
  ],
  [E.settingsAccess]: [
    E.settingsView,
    E.settingsTheme,
    E.settingsBusiness,
    E.settingsBilling,
    E.settingsInventory
  ]
}, vt = {
  [E.settingsTheme]: [E.settingsView],
  [E.settingsBusiness]: [E.settingsView],
  [E.settingsBilling]: [E.settingsView],
  [E.settingsInventory]: [E.settingsView]
}, za = {
  [E.settingsView]: [
    E.settingsTheme,
    E.settingsBusiness,
    E.settingsBilling,
    E.settingsInventory
  ]
};
[
  ...Object.keys(ht),
  ...Object.keys(vt)
];
function Ga(e) {
  return e ? [
    e,
    ...ht[e] ?? [],
    ...vt[e] ?? []
  ] : [];
}
function bt(e, a) {
  if (!a)
    return !0;
  const r = e ?? [];
  return Ga(a).some((l) => r.includes(l));
}
function Ne(e) {
  const a = /* @__PURE__ */ new Set();
  for (const r of e ?? []) {
    const l = za[r];
    if (l) {
      for (const m of l)
        a.add(m);
      continue;
    }
    a.add(r);
  }
  return Array.from(a);
}
const Ka = o.object({
  name: o.string().trim().min(2).max(80)
}), Ha = o.object({
  categoryId: o.string().uuid(),
  name: o.string().trim().min(2).max(80)
}), Ee = o.object({
  id: o.string().uuid()
}), St = o.enum([
  "Cédula",
  "NIT",
  "Cédula de extranjería",
  "Pasaporte",
  "Tarjeta de identidad"
]), wt = o.object({
  internalCode: o.string().trim().max(30).optional().nullable(),
  firstName: o.string().trim().min(2).max(80),
  lastName: o.string().trim().max(80).optional().default(""),
  documentType: St.optional().default("Cédula"),
  documentNumber: o.string().trim().max(40).optional().nullable(),
  phone: o.string().trim().regex(/^\d{10}$/).optional().nullable(),
  email: o.string().trim().email().max(120).optional().nullable(),
  address: o.string().trim().max(180).optional().nullable(),
  isActive: o.boolean().optional().default(!0)
}), Ya = wt.extend({
  id: o.string().uuid()
}), Ot = o.object({
  internalCode: o.string().trim().max(30).optional().nullable(),
  name: o.string().trim().min(2).max(120),
  contactName: o.string().trim().max(120).optional().nullable(),
  documentType: St.optional().default("NIT"),
  documentNumber: o.string().trim().max(40).optional().nullable(),
  phone: o.string().trim().regex(/^\d{10}$/).optional().nullable(),
  email: o.string().trim().email().max(120).optional().nullable(),
  address: o.string().trim().max(180).optional().nullable(),
  isActive: o.boolean().optional().default(!0)
}), Ja = Ot.extend({
  id: o.string().uuid()
}), Wa = o.object({
  supplierId: o.string().uuid(),
  purchasedAt: o.string().datetime().optional(),
  note: o.string().trim().max(300).optional().nullable(),
  markAsPaid: o.boolean().optional().default(!1),
  paymentMedium: o.enum(["CASH", "TRANSFER", "CORRESPONDENT"]).optional().default("CASH"),
  paymentPlatformId: o.string().uuid().optional().nullable(),
  items: o.array(
    o.object({
      productId: o.string().uuid(),
      qty: o.number().int().positive(),
      cost: o.number().positive(),
      taxRate: o.number().min(0).max(1).optional().default(0.19)
    })
  ).min(1)
}), Rt = o.object({
  platformId: o.string().uuid(),
  amount: o.number().min(0)
}), Qa = o.object({
  openingCashAmount: o.number().min(0),
  openingTransferAmount: o.number().min(0).optional().default(0),
  note: o.string().trim().max(300).optional().nullable(),
  cashBreakdown: o.record(o.string(), o.number()).optional().default({}),
  correspondentBalances: o.array(Rt).optional().default([])
}), Za = o.object({
  sessionId: o.string().uuid(),
  countedCashAmount: o.number().min(0),
  countedTransferAmount: o.number().min(0).optional().default(0),
  note: o.string().trim().max(300).optional().nullable(),
  cashBreakdown: o.record(o.string(), o.number()).optional().default({}),
  correspondentBalances: o.array(Rt).optional().default([])
}), es = o.enum(["LIGHT", "DARK"]), Dt = o.enum(["NORMAL", "THERMAL_80", "THERMAL_50"]), ts = o.object({
  businessName: o.string().trim().max(120).optional().nullable(),
  taxId: o.string().trim().max(40).optional().nullable(),
  address: o.string().trim().max(180).optional().nullable(),
  city: o.string().trim().max(80).optional().nullable()
}), as = o.object({
  themeMode: es
}), ss = o.object({
  invoicePrefix: o.string().trim().max(10).optional().nullable(),
  defaultReceiptTemplate: Dt.optional().default("NORMAL"),
  receiptFooter: o.string().trim().max(400).optional().nullable()
}), rs = o.object({
  defaultTaxRate: o.number().min(0).max(1).optional(),
  allowNegativeStock: o.boolean().optional()
}), ns = o.object({
  dateFrom: o.string().datetime().optional(),
  dateTo: o.string().datetime().optional(),
  cashierId: o.string().uuid().optional(),
  status: o.nativeEnum(me).optional(),
  search: o.string().trim().max(80).optional()
}).optional().default({}), os = o.object({
  saleId: o.string().uuid()
}), st = os.extend({
  template: Dt.optional().default("NORMAL")
});
function z(e) {
  return Math.round(e);
}
const xt = "|||CITY|||";
function rt(e, a) {
  const r = (e == null ? void 0 : e.trim()) || "", l = (a == null ? void 0 : a.trim()) || "";
  return l ? `${r}${xt}${l}` : r || null;
}
function nt(e) {
  var r, l;
  if (!e)
    return { address: "", city: "" };
  const a = e.split(xt);
  return {
    address: ((r = a[0]) == null ? void 0 : r.trim()) || "",
    city: ((l = a[1]) == null ? void 0 : l.trim()) || ""
  };
}
function is(e, a = 0, r = !1, l = 0) {
  const m = Number(e || 0) * (1 + Number(a || 0) / 100), c = r ? m * (1 + Number(l || 0)) : m;
  return z(c);
}
function le(e) {
  return e === j.CARD || e === j.TRANSFER ? "Transferencia" : "Efectivo";
}
function cs(e, a) {
  return !e || e.length <= 1 ? le(a) : e.map((r) => `${le(r.method)} $${r.amount.toLocaleString("es-CO")}`).join(" + ");
}
function ds(e) {
  const a = ye(e.cashier), r = Pt(e.receiptFooter), l = e.items.map(
    (c) => `
        <tr>
          <td>${c.name}</td>
          <td style="text-align:center">${c.qty}</td>
          <td style="text-align:right">$${c.price.toLocaleString("es-CO")}</td>
          <td style="text-align:right">$${c.lineTotal.toLocaleString("es-CO")}</td>
        </tr>
      `
  ).join(""), m = [e.address, e.city].filter(Boolean).join(" - ");
  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${e.invoiceNumber}</title>
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
          .legal-notes { margin-top: 20px; padding-top: 12px; border-top: 1px solid #e5e7eb; display: grid; gap: 6px; }
          .legal-notes p { font-size: 11px; color: #4b5563; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${e.businessName || "Factura de venta"}</h1>
          <div class="meta">
            ${e.taxId ? `<div>NIT: ${e.taxId}</div>` : ""}
            ${m ? `<div>Dirección: ${m}</div>` : ""}
            <div>Factura: ${e.invoiceNumber}</div>
            <div>Fecha: ${e.createdAt.toLocaleString("es-CO")}</div>
            <div>Cliente: ${e.customer}</div>
            <div>Cajero: ${a}</div>
            <div>Pago: ${e.paymentSummary}</div>
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
          <tbody>${l}</tbody>
        </table>

        <div class="totals">
          <div class="totals-row"><span>Subtotal</span><strong>$${e.subtotal.toLocaleString("es-CO")}</strong></div>
          <div class="totals-row"><span>IVA</span><strong>$${e.tax.toLocaleString("es-CO")}</strong></div>
          <div class="totals-row total"><span>Total</span><strong>$${e.total.toLocaleString("es-CO")}</strong></div>
        </div>
        <div class="legal-notes">${r.map((c) => `<p>${c}</p>`).join("")}</div>
      </body>
    </html>
  `;
}
function us(e, a) {
  if (a === "NORMAL")
    return ds(e);
  const r = a === "THERMAL_50" ? 50 : 80, l = [e.address, e.city].filter(Boolean).join(" - "), m = ye(e.cashier), c = Pt(e.receiptFooter), n = e.items.map(
    (s) => `
        <div class="item">
          <div class="item-name">${s.name}</div>
          <div class="item-meta">
            <span>${s.qty} x $${s.price.toLocaleString("es-CO")}</span>
            <strong>$${s.lineTotal.toLocaleString("es-CO")}</strong>
          </div>
        </div>
      `
  ).join("");
  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${e.invoiceNumber}</title>
        <style>
          @page { size: ${r}mm auto; margin: 4mm; }
          body {
            font-family: "Segoe UI", Arial, sans-serif;
            color: #111827;
            margin: 0;
            width: ${r - 8}mm;
            font-size: ${a === "THERMAL_50" ? 10 : 11}px;
            line-height: 1.35;
          }
          h1, p { margin: 0; }
          .receipt { display: flex; flex-direction: column; gap: 10px; }
          .header { text-align: center; border-bottom: 1px dashed #9ca3af; padding-bottom: 8px; }
          .header h1 { font-size: ${a === "THERMAL_50" ? 14 : 16}px; margin-bottom: 4px; }
          .muted { color: #4b5563; }
          .meta { display: grid; gap: 2px; }
          .section-title {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: #6b7280;
          }
          .items { display: grid; gap: 8px; }
          .item { border-bottom: 1px dashed #d1d5db; padding-bottom: 6px; }
          .item-name { font-weight: 700; margin-bottom: 3px; }
          .item-meta { display: flex; justify-content: space-between; gap: 8px; }
          .totals { border-top: 1px dashed #9ca3af; padding-top: 8px; display: grid; gap: 4px; }
          .total-row { display: flex; justify-content: space-between; }
          .total-row.total { font-size: 13px; font-weight: 800; }
          .footer { text-align: center; border-top: 1px dashed #d1d5db; padding-top: 8px; display: grid; gap: 6px; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <h1>${e.businessName || "Factura de venta"}</h1>
            ${e.taxId ? `<p class="muted">NIT: ${e.taxId}</p>` : ""}
            ${l ? `<p class="muted">${l}</p>` : ""}
          </div>

          <div class="meta">
            <div><strong>Factura:</strong> ${e.invoiceNumber}</div>
            <div><strong>Fecha:</strong> ${e.createdAt.toLocaleString("es-CO")}</div>
            <div><strong>Cliente:</strong> ${e.customer}</div>
            <div><strong>Cajero:</strong> ${m}</div>
            <div><strong>Pago:</strong> ${e.paymentSummary}</div>
          </div>

          <div>
            <div class="section-title">Detalle</div>
            <div class="items">${n}</div>
          </div>

          <div class="totals">
            <div class="total-row"><span>Subtotal</span><strong>$${e.subtotal.toLocaleString("es-CO")}</strong></div>
            <div class="total-row"><span>IVA</span><strong>$${e.tax.toLocaleString("es-CO")}</strong></div>
            <div class="total-row total"><span>Total</span><strong>$${e.total.toLocaleString("es-CO")}</strong></div>
          </div>
          <div class="footer">${c.map((s) => `<p class="muted">${s}</p>`).join("")}</div>
        </div>
      </body>
    </html>
  `;
}
async function ot(e) {
  const a = e();
  if (!a || a.role !== F.ADMIN)
    throw new Error("Solo admins pueden ejecutar esta accion");
  return a;
}
function M(e, a) {
  return a ? bt(e == null ? void 0 : e.permissions, a) : !0;
}
function _e(e) {
  var a;
  return ((a = e == null ? void 0 : e.name) == null ? void 0 : a.trim()) || (e == null ? void 0 : e.username) || "Sistema";
}
function ye(e) {
  var l;
  const a = ((l = e.name) == null ? void 0 : l.trim()) || e.username, [r] = a.split(/\s+/).filter(Boolean);
  return r || a;
}
function Pt(e) {
  const a = [
    "Esta factura de venta podra constituirse como titulo valor conforme a la legislacion comercial aplicable y cuando se cumplan los requisitos legales.",
    "En ventas a credito, la mora en el pago causara intereses a la tasa maxima legal vigente."
  ];
  return e != null && e.trim() && a.push(e.trim()), a;
}
function it(e, a) {
  return [e.trim(), (a == null ? void 0 : a.trim()) || ""].filter(Boolean).join(" ");
}
function be(e, a) {
  const r = a == null ? void 0 : a.trim();
  return r ? `${e || "Cédula"}: ${r}` : null;
}
async function de(e, a, r, l, m = !1) {
  var s, t, i;
  if (r.length === 0)
    return /* @__PURE__ */ new Map();
  const c = await e.auditLog.findMany({
    where: {
      entity: a,
      action: l,
      entityId: { in: r }
    },
    include: {
      user: {
        select: {
          name: !0,
          username: !0
        }
      }
    },
    orderBy: { createdAt: m ? "desc" : "asc" }
  }), n = /* @__PURE__ */ new Map();
  for (const u of c)
    !u.entityId || n.has(u.entityId) || n.set(u.entityId, ((t = (s = u.user) == null ? void 0 : s.name) == null ? void 0 : t.trim()) || ((i = u.user) == null ? void 0 : i.username) || "Sistema");
  return n;
}
function G(e) {
  if (!e)
    return {};
  try {
    return JSON.parse(e);
  } catch {
    return {};
  }
}
function ct(e) {
  return JSON.stringify(e);
}
function $e(e) {
  return new Map((e ?? []).map((a) => [a.platformId, Number(a.amount || 0)]));
}
function ke(e) {
  return e === "TRANSFER" || e === "CORRESPONDENT" ? e : "CASH";
}
function se(e) {
  if (!e)
    return null;
  try {
    const a = JSON.parse(e);
    return !a || typeof a != "object" || !a.medium && !a.label && !a.sourceType ? null : {
      ...a,
      medium: ke(a.medium)
    };
  } catch {
    return null;
  }
}
function Se(e) {
  return JSON.stringify(e);
}
function Be(e, a = "Movimiento de caja") {
  const r = se(e);
  return (r == null ? void 0 : r.label) || (r == null ? void 0 : r.userNote) || e || a;
}
function ie(e) {
  var a;
  return ((a = se(e)) == null ? void 0 : a.medium) ?? "CASH";
}
function ls(e) {
  var a;
  return ((a = se(e)) == null ? void 0 : a.platformId) ?? null;
}
function Xe(e) {
  var a;
  return ((a = se(e)) == null ? void 0 : a.platformName) ?? null;
}
function ms(e, a) {
  return e || a ? {
    ...e ? { gte: new Date(e) } : {},
    ...a ? { lte: new Date(a) } : {}
  } : void 0;
}
function K(e, a) {
  const r = e[a];
  return r && typeof r == "object" ? r : {};
}
function oe(e) {
  return Number(e.transferAmount ?? 0);
}
function ps(e) {
  return e.reduce(
    (a, r) => {
      if (r.payments && r.payments.length > 0) {
        for (const l of r.payments)
          l.method === j.CASH && (a.cash += l.amount), (l.method === j.TRANSFER || l.method === j.CARD) && (a.transfer += l.amount);
        return a;
      }
      return r.paymentMethod === j.CASH ? a.cash += r.total : a.transfer += r.total, a;
    },
    { cash: 0, transfer: 0 }
  );
}
function fs(e) {
  const a = /* @__PURE__ */ new Map();
  for (const r of e) {
    if (ie(r.note) !== "CORRESPONDENT")
      continue;
    const m = ls(r.note);
    if (!m)
      continue;
    const c = a.get(m) ?? { manualIncome: 0, manualExpense: 0, platformName: Xe(r.note) };
    r.type === B.INCOME_IN && (c.manualIncome += r.amount), (r.type === B.EXPENSE_OUT || r.type === B.WITHDRAWAL_OUT) && (c.manualExpense += r.amount), c.platformName || (c.platformName = Xe(r.note)), a.set(m, c);
  }
  return a;
}
function dt(e) {
  const a = G(e.session.note), r = K(a, "opening"), l = K(a, "closing"), m = $e(
    r.correspondentBalances ?? []
  ), c = $e(
    l.correspondentBalances ?? []
  ), n = oe(r), s = l.transferAmount === void 0 ? null : oe(l), t = ps(e.session.sales), i = e.session.movements.filter((d) => d.type === B.INCOME_IN && ie(d.note) === "CASH").reduce((d, A) => d + A.amount, 0), u = e.session.movements.filter((d) => d.type === B.INCOME_IN && ie(d.note) === "TRANSFER").reduce((d, A) => d + A.amount, 0), f = e.session.movements.filter(
    (d) => (d.type === B.EXPENSE_OUT || d.type === B.WITHDRAWAL_OUT) && ie(d.note) === "CASH"
  ).reduce((d, A) => d + A.amount, 0), g = e.session.movements.filter(
    (d) => (d.type === B.EXPENSE_OUT || d.type === B.WITHDRAWAL_OUT) && ie(d.note) === "TRANSFER"
  ).reduce((d, A) => d + A.amount, 0), T = fs(e.session.movements), I = e.session.openingAmount + t.cash + i - f, p = n + t.transfer + u - g, N = e.platforms.map((d) => {
    const A = e.session.correspondentTransactions.filter(
      (k) => k.platform.id === d.id
    ), S = A.filter((k) => k.type.direction === _.IN).reduce((k, L) => k + L.amount, 0), y = A.filter((k) => k.type.direction === _.OUT).reduce((k, L) => k + L.amount, 0), w = A.reduce((k, L) => k + L.commissionAmount, 0), $ = T.get(d.id) ?? {
      manualIncome: 0,
      manualExpense: 0,
      platformName: d.name
    }, U = m.get(d.id) ?? 0, Y = U + S - y + w + $.manualIncome - $.manualExpense, q = c.has(d.id) ? c.get(d.id) ?? 0 : null;
    return {
      platformId: d.id,
      platform: d.name,
      openingAmount: U,
      totalIn: S,
      totalOut: y,
      totalCommission: w,
      manualIncome: $.manualIncome,
      manualExpense: $.manualExpense,
      expectedAmount: Y,
      countedAmount: q,
      differenceAmount: q === null ? null : q - Y
    };
  }), C = N.reduce((d, A) => d + A.openingAmount, 0), h = N.reduce((d, A) => d + A.expectedAmount, 0), v = N.reduce(
    (d, A) => d + (A.countedAmount ?? A.expectedAmount),
    0
  ), D = l.cashBreakdown && typeof l.cashBreakdown == "object" ? null : e.session.countedAmount ?? null, P = I + p + h, b = (e.session.countedAmount ?? I) + (s ?? p) + v;
  return {
    sessionMeta: a,
    opening: r,
    closing: l,
    openingTransferAmount: n,
    countedTransferAmount: s,
    salesCash: t.cash,
    salesTransfer: t.transfer,
    cashManualIncome: i,
    transferManualIncome: u,
    cashManualExpense: f,
    transferManualExpense: g,
    expectedCash: I,
    expectedTransferAmount: p,
    openingCorrespondentTotal: C,
    correspondentExpectedTotal: h,
    countedCorrespondentTotal: v,
    correspondentByPlatform: N,
    expectedAvailableTotal: P,
    countedAvailableTotal: b,
    countedCashAmount: D
  };
}
function gs() {
  const e = /* @__PURE__ */ new Date();
  return e.setHours(0, 0, 0, 0), e;
}
function Ae(e, a, r) {
  return a <= 0 ? fe.CANCELLED : e <= 0 ? fe.PAID : r && r.getTime() < gs().getTime() ? fe.OVERDUE : e < a ? fe.PARTIAL : fe.PENDING;
}
function ut(e, a) {
  return a >= e ? me.RETURNED : a > 0 ? me.PARTIALLY_RETURNED : me.COMPLETED;
}
async function Es(e) {
  const a = await e.$queryRawUnsafe(
    'PRAGMA table_info("BusinessSettings");'
  ), r = new Set(a.map((f) => f.name));
  r.has("themeMode") || await e.$executeRawUnsafe(
    `ALTER TABLE "BusinessSettings" ADD COLUMN "themeMode" TEXT NOT NULL DEFAULT 'LIGHT';`
  ), r.has("defaultReceiptTemplate") || await e.$executeRawUnsafe(
    `ALTER TABLE "BusinessSettings" ADD COLUMN "defaultReceiptTemplate" TEXT NOT NULL DEFAULT 'NORMAL';`
  );
  const l = await e.$queryRawUnsafe('PRAGMA table_info("Customer");'), m = await e.$queryRawUnsafe('PRAGMA table_info("Supplier");'), c = new Set(l.map((f) => f.name)), n = new Set(m.map((f) => f.name));
  c.has("internalCode") || await e.$executeRawUnsafe('ALTER TABLE "Customer" ADD COLUMN "internalCode" TEXT;'), n.has("internalCode") || await e.$executeRawUnsafe('ALTER TABLE "Supplier" ADD COLUMN "internalCode" TEXT;');
  const s = await e.customer.findMany({
    select: {
      id: !0,
      internalCode: !0
    },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }]
  }), t = [];
  for (const f of s) {
    const g = Z({
      desiredCode: f.internalCode,
      existingCodes: t,
      prefix: "CLI",
      digits: 4,
      maxLength: 30
    });
    g !== f.internalCode && await e.customer.update({
      where: { id: f.id },
      data: { internalCode: g }
    }), t.push(g);
  }
  const i = await e.supplier.findMany({
    select: {
      id: !0,
      internalCode: !0
    },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }]
  }), u = [];
  for (const f of i) {
    const g = Z({
      desiredCode: f.internalCode,
      existingCodes: u,
      prefix: "PRV",
      digits: 4,
      maxLength: 30
    });
    g !== f.internalCode && await e.supplier.update({
      where: { id: f.id },
      data: { internalCode: g }
    }), u.push(g);
  }
  await e.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "Customer_internalCode_key" ON "Customer"("internalCode");'
  ), await e.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "Supplier_internalCode_key" ON "Supplier"("internalCode");'
  );
}
function As(e, a) {
  return ((a || e || "PRD").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 3) || "PRD").padEnd(3, "X");
}
async function Ts(e, a, r) {
  const l = As(a, r), m = await e.product.count({
    where: { sku: { startsWith: l } }
  });
  return `${l}-${String(m + 1).padStart(3, "0")}`;
}
async function Is(e) {
  const a = await e.purchase.count();
  return `CP-${String(a + 1).padStart(6, "0")}`;
}
async function V(e, a, r, l, m, c, n, s) {
  await e.auditLog.create({
    data: {
      userId: (a == null ? void 0 : a.id) ?? null,
      module: r,
      action: l,
      entity: m,
      entityId: c ?? null,
      beforeJson: n === void 0 ? null : JSON.stringify(n),
      afterJson: s === void 0 ? null : JSON.stringify(s)
    }
  });
}
function ys({
  ipcMain: e,
  prisma: a,
  getCurrentSessionUser: r,
  getConnectedAt: l
}) {
  e.handle("app:status", async () => ({
    success: !0,
    connectedAt: l().toISOString(),
    now: (/* @__PURE__ */ new Date()).toISOString()
  })), e.handle("settings:get", async () => {
    if (!r())
      return { success: !1, message: "Debes iniciar sesion" };
    const c = await a.businessSettings.findUnique({
      where: { id: "default" }
    }), n = nt(c == null ? void 0 : c.address);
    return {
      success: !0,
      settings: {
        businessName: (c == null ? void 0 : c.businessName) || "",
        taxId: (c == null ? void 0 : c.taxId) || "",
        address: n.address,
        city: n.city,
        themeMode: (c == null ? void 0 : c.themeMode) === "DARK" ? "DARK" : "LIGHT",
        invoicePrefix: (c == null ? void 0 : c.invoicePrefix) || "FV",
        defaultTaxRate: (c == null ? void 0 : c.defaultTaxRate) ?? 0.19,
        allowNegativeStock: (c == null ? void 0 : c.allowNegativeStock) ?? !1,
        defaultReceiptTemplate: (c == null ? void 0 : c.defaultReceiptTemplate) === "THERMAL_80" || (c == null ? void 0 : c.defaultReceiptTemplate) === "THERMAL_50" ? c.defaultReceiptTemplate : "NORMAL",
        receiptFooter: (c == null ? void 0 : c.receiptFooter) || ""
      }
    };
  }), e.handle("settings:update-theme", async (m, c) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.settingsTheme))
      return { success: !1, message: "Tu rol no puede cambiar el tema del sistema" };
    const s = as.safeParse(c);
    return s.success ? (await a.businessSettings.upsert({
      where: { id: "default" },
      update: {
        themeMode: s.data.themeMode
      },
      create: {
        id: "default",
        themeMode: s.data.themeMode
      }
    }), await V(a, n, "settings", "update_theme", "BusinessSettings", "default", void 0, s.data), { success: !0 }) : { success: !1, message: "Configuracion de tema invalida" };
  }), e.handle("settings:update-business", async (m, c) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.settingsBusiness))
      return { success: !1, message: "Tu rol no puede editar los datos del negocio" };
    const s = ts.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos del negocio invalidos" };
    const t = s.data;
    return await a.businessSettings.upsert({
      where: { id: "default" },
      update: {
        businessName: t.businessName || null,
        taxId: t.taxId || null,
        address: rt(t.address, t.city)
      },
      create: {
        id: "default",
        businessName: t.businessName || null,
        taxId: t.taxId || null,
        address: rt(t.address, t.city)
      }
    }), await V(a, n, "settings", "update_business", "BusinessSettings", "default", void 0, t), { success: !0 };
  }), e.handle("settings:update-billing", async (m, c) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.settingsBilling))
      return { success: !1, message: "Tu rol no puede editar factura e impresion" };
    const s = ss.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Configuracion de factura invalida" };
    const t = s.data;
    return await a.businessSettings.upsert({
      where: { id: "default" },
      update: {
        invoicePrefix: t.invoicePrefix || "FV",
        defaultReceiptTemplate: t.defaultReceiptTemplate,
        receiptFooter: t.receiptFooter || null
      },
      create: {
        id: "default",
        invoicePrefix: t.invoicePrefix || "FV",
        defaultReceiptTemplate: t.defaultReceiptTemplate,
        receiptFooter: t.receiptFooter || null
      }
    }), await V(a, n, "settings", "update_billing", "BusinessSettings", "default", void 0, t), { success: !0 };
  }), e.handle("settings:update-inventory", async (m, c) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.settingsInventory))
      return { success: !1, message: "Tu rol no puede editar inventario y operacion" };
    const s = rs.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Configuracion operativa invalida" };
    const t = s.data;
    return await a.businessSettings.upsert({
      where: { id: "default" },
      update: {
        defaultTaxRate: t.defaultTaxRate ?? 0.19,
        allowNegativeStock: t.allowNegativeStock ?? !1
      },
      create: {
        id: "default",
        defaultTaxRate: t.defaultTaxRate ?? 0.19,
        allowNegativeStock: t.allowNegativeStock ?? !1
      }
    }), await V(a, n, "settings", "update_inventory", "BusinessSettings", "default", void 0, t), { success: !0 };
  }), e.handle("cash:summary", async () => {
    if (!r())
      return { success: !1, message: "Debes iniciar sesion" };
    const [c, n, s, t] = await Promise.all([
      a.cashSession.findFirst({
        where: { status: W.OPEN },
        include: {
          register: !0,
          user: { select: { username: !0, name: !0 } },
          sales: {
            select: {
              id: !0,
              invoiceNumber: !0,
              customer: !0,
              total: !0,
              paymentMethod: !0,
              createdAt: !0,
              payments: {
                select: {
                  method: !0,
                  amount: !0
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
              platform: { select: { id: !0, name: !0 } },
              type: { select: { name: !0, direction: !0 } }
            },
            orderBy: { performedAt: "desc" }
          }
        },
        orderBy: { openedAt: "desc" }
      }),
      a.cashSession.findFirst({
        where: { status: W.CLOSED },
        include: {
          register: !0,
          user: { select: { username: !0, name: !0 } }
        },
        orderBy: { closedAt: "desc" }
      }),
      a.cashSession.findMany({
        include: {
          register: !0,
          user: { select: { username: !0, name: !0 } }
        },
        orderBy: { openedAt: "desc" },
        take: 20
      }),
      a.correspondentPlatform.findMany({
        orderBy: { name: "asc" }
      })
    ]), i = n ? (() => {
      var D;
      const p = G(n.note), N = K(p, "closing"), C = $e(
        N.correspondentBalances ?? []
      ), h = t.map((P) => ({
        platformId: P.id,
        platform: P.name,
        countedAmount: C.get(P.id) ?? 0
      })).filter((P) => P.countedAmount > 0), v = oe(N);
      return {
        sessionId: n.id,
        registerName: n.register.name,
        user: n.user.name ?? n.user.username,
        closedAt: ((D = n.closedAt) == null ? void 0 : D.toISOString()) ?? null,
        countedCashAmount: n.countedAmount ?? 0,
        countedTransferAmount: v,
        countedAvailableAmount: (n.countedAmount ?? 0) + v + h.reduce((P, b) => P + b.countedAmount, 0),
        closingBreakdown: N.cashBreakdown && typeof N.cashBreakdown == "object" ? N.cashBreakdown : {},
        correspondent: h
      };
    })() : null;
    if (!c)
      return {
        success: !0,
        activeSession: null,
        previousReference: i,
        recentSessions: s.map((p) => {
          var N;
          return {
            id: p.id,
            registerName: p.register.name,
            user: p.user.name ?? p.user.username,
            status: p.status,
            openedAt: p.openedAt.toISOString(),
            closedAt: ((N = p.closedAt) == null ? void 0 : N.toISOString()) ?? null,
            openingAmount: p.openingAmount,
            openingAvailableAmount: p.openingAmount + oe(K(G(p.note), "opening")) + (K(G(p.note), "opening").correspondentBalances ?? []).reduce((C, h) => C + Number(h.amount || 0), 0),
            countedAmount: p.countedAmount,
            countedAvailableAmount: (p.countedAmount ?? 0) + oe(K(G(p.note), "closing")) + (K(G(p.note), "closing").correspondentBalances ?? []).reduce((C, h) => C + Number(h.amount || 0), 0),
            differenceAmount: p.differenceAmount
          };
        })
      };
    const u = dt({
      session: c,
      platforms: t
    }), f = c.openingAmount + u.openingTransferAmount + u.openingCorrespondentTotal, g = c.countedAmount ?? u.expectedCash, T = u.countedTransferAmount ?? u.expectedTransferAmount, I = i ? {
      cashDifferenceAmount: c.openingAmount - i.countedCashAmount,
      transferDifferenceAmount: u.openingTransferAmount - i.countedTransferAmount,
      correspondentDifferenceTotal: u.correspondentByPlatform.reduce((p, N) => {
        var h;
        const C = ((h = i.correspondent.find((v) => v.platformId === N.platformId)) == null ? void 0 : h.countedAmount) ?? 0;
        return p + (N.openingAmount - C);
      }, 0),
      differenceAmount: f - i.countedAvailableAmount
    } : null;
    return {
      success: !0,
      activeSession: {
        id: c.id,
        registerName: c.register.name,
        user: c.user.name ?? c.user.username,
        openedAt: c.openedAt.toISOString(),
        openingAmount: c.openingAmount,
        openingTransferAmount: u.openingTransferAmount,
        openingAvailableAmount: f,
        expectedCash: u.expectedCash,
        expectedTransferAmount: u.expectedTransferAmount,
        expectedAvailableAmount: u.expectedAvailableTotal,
        countedCashAmount: g,
        countedTransferAmount: T,
        countedAvailableAmount: g + T + u.correspondentByPlatform.reduce(
          (p, N) => p + (N.countedAmount ?? N.expectedAmount),
          0
        ),
        cashDifferenceAmount: g - u.expectedCash,
        transferDifferenceAmount: T - u.expectedTransferAmount,
        availableDifferenceAmount: g + T + u.correspondentByPlatform.reduce(
          (p, N) => p + (N.countedAmount ?? N.expectedAmount),
          0
        ) - u.expectedAvailableTotal,
        salesCash: u.salesCash,
        salesCard: 0,
        salesTransfer: u.salesTransfer,
        manualIncome: u.cashManualIncome,
        manualExpense: u.cashManualExpense,
        manualTransferIncome: u.transferManualIncome,
        manualTransferExpense: u.transferManualExpense,
        openingBreakdown: u.opening.cashBreakdown && typeof u.opening.cashBreakdown == "object" ? u.opening.cashBreakdown : {},
        closingBreakdown: u.closing.cashBreakdown && typeof u.closing.cashBreakdown == "object" ? u.closing.cashBreakdown : {},
        correspondent: u.correspondentByPlatform,
        openingComparison: I,
        recentActivity: [
          ...c.sales.flatMap(
            (p) => (p.payments && p.payments.length > 0 ? p.payments : [
              {
                method: p.paymentMethod,
                amount: p.total
              }
            ]).map((N, C) => ({
              id: `${p.id}-${N.method}-${C}`,
              createdAt: p.createdAt.toISOString(),
              type: "Venta",
              medium: N.method === j.CASH ? "Efectivo" : (N.method === j.CARD, "Transferencia"),
              detail: `${p.invoiceNumber} - ${p.customer}`,
              amount: N.amount,
              signedAmount: N.amount
            }))
          ),
          ...c.correspondentTransactions.map((p) => ({
            id: p.id,
            createdAt: p.performedAt.toISOString(),
            type: "Corresponsal",
            medium: p.platform.name,
            detail: `${p.type.name}${p.commissionAmount > 0 ? ` + comision ${p.commissionAmount.toLocaleString("es-CO")}` : ""}`,
            amount: p.amount,
            signedAmount: p.type.direction === _.OUT ? -p.amount : p.amount
          })),
          ...c.movements.map((p) => ({
            id: p.id,
            createdAt: p.createdAt.toISOString(),
            type: p.type,
            medium: ie(p.note) === "TRANSFER" ? "Transferencias" : ie(p.note) === "CORRESPONDENT" ? Xe(p.note) || "Corresponsal" : "Efectivo",
            detail: Be(p.note),
            amount: p.amount,
            signedAmount: p.type === B.EXPENSE_OUT || p.type === B.WITHDRAWAL_OUT ? -p.amount : p.amount
          }))
        ].sort((p, N) => new Date(N.createdAt).getTime() - new Date(p.createdAt).getTime()).slice(0, 30)
      },
      previousReference: i,
      recentSessions: s.map((p) => {
        var N;
        return {
          id: p.id,
          registerName: p.register.name,
          user: p.user.name ?? p.user.username,
          status: p.status,
          openedAt: p.openedAt.toISOString(),
          closedAt: ((N = p.closedAt) == null ? void 0 : N.toISOString()) ?? null,
          openingAmount: p.openingAmount,
          openingAvailableAmount: p.openingAmount + oe(K(G(p.note), "opening")) + (K(G(p.note), "opening").correspondentBalances ?? []).reduce((C, h) => C + Number(h.amount || 0), 0),
          countedAmount: p.countedAmount,
          countedAvailableAmount: (p.countedAmount ?? 0) + oe(K(G(p.note), "closing")) + (K(G(p.note), "closing").correspondentBalances ?? []).reduce((C, h) => C + Number(h.amount || 0), 0),
          differenceAmount: p.differenceAmount
        };
      })
    };
  }), e.handle("cash:open", async (m, c) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.cashOpen))
      return { success: !1, message: "Tu rol no puede abrir caja" };
    const s = Qa.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para apertura de caja" };
    if (await a.cashSession.findFirst({
      where: { status: W.OPEN }
    }))
      return { success: !1, message: "Ya existe una caja abierta" };
    const i = await a.cashRegister.findFirst({
      where: { isActive: !0 },
      orderBy: { createdAt: "asc" }
    });
    if (!i)
      return { success: !1, message: "No hay caja activa configurada" };
    const u = s.data.openingCashAmount + s.data.openingTransferAmount + s.data.correspondentBalances.reduce((T, I) => T + Number(I.amount || 0), 0), f = ct({
      opening: {
        cashBreakdown: s.data.cashBreakdown,
        transferAmount: s.data.openingTransferAmount,
        correspondentBalances: s.data.correspondentBalances,
        note: s.data.note || null
      }
    }), g = await a.cashSession.create({
      data: {
        registerId: i.id,
        userId: n.id,
        status: W.OPEN,
        openingAmount: s.data.openingCashAmount,
        expectedAmount: u,
        note: f
      }
    });
    return await a.cashMovement.create({
      data: {
        sessionId: g.id,
        type: B.OPENING,
        amount: s.data.openingCashAmount,
        note: s.data.note || "Apertura de caja"
      }
    }), { success: !0, sessionId: g.id };
  }), e.handle("cash:close", async (m, c) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.cashClose))
      return { success: !1, message: "Tu rol no puede cerrar caja" };
    const s = Za.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para cierre de caja" };
    const t = await a.cashSession.findUnique({
      where: { id: s.data.sessionId },
      include: {
        sales: {
          include: {
            payments: {
              select: {
                method: !0,
                amount: !0
              }
            }
          }
        },
        movements: !0,
        correspondentTransactions: {
          where: { status: "REGISTERED" },
          include: {
            platform: { select: { id: !0, name: !0 } },
            type: { select: { name: !0, direction: !0 } }
          }
        }
      }
    });
    if (!t || t.status !== W.OPEN)
      return { success: !1, message: "La caja seleccionada no está abierta" };
    const i = await a.correspondentPlatform.findMany({
      orderBy: { name: "asc" }
    }), u = dt({
      session: t,
      platforms: i
    }), f = u.expectedCash, g = s.data.countedCashAmount - f, T = u.correspondentByPlatform.reduce((v, D) => {
      var b;
      const P = (b = s.data.correspondentBalances.find((d) => d.platformId === D.platformId)) == null ? void 0 : b.amount;
      return v + Number(P ?? D.expectedAmount);
    }, 0), I = f + u.expectedTransferAmount + u.correspondentExpectedTotal, N = s.data.countedCashAmount + s.data.countedTransferAmount + T - I, C = G(t.note), h = ct({
      ...C,
      closing: {
        cashBreakdown: s.data.cashBreakdown,
        transferAmount: s.data.countedTransferAmount,
        correspondentBalances: s.data.correspondentBalances,
        note: s.data.note || null
      }
    });
    return await a.$transaction(async (v) => {
      await v.cashSession.update({
        where: { id: t.id },
        data: {
          status: W.CLOSED,
          countedAmount: s.data.countedCashAmount,
          expectedAmount: I,
          differenceAmount: N,
          note: h,
          closedAt: /* @__PURE__ */ new Date()
        }
      }), await v.cashMovement.create({
        data: {
          sessionId: t.id,
          type: B.CLOSING,
          amount: s.data.countedCashAmount,
          note: s.data.note || "Cierre de caja"
        }
      }), N !== 0 && await v.cashMovement.create({
        data: {
          sessionId: t.id,
          type: B.DIFFERENCE,
          amount: N,
          note: Se({
            label: `Diferencia general de cierre (${g >= 0 ? "POS" : "negativa"} en efectivo: ${g.toLocaleString("es-CO")})`,
            medium: "CASH",
            sourceType: "MANUAL"
          })
        }
      });
    }), { success: !0 };
  }), e.handle("users:list", async () => r() ? {
    success: !0,
    users: (await a.user.findMany({
      orderBy: [{ role: "asc" }, { username: "asc" }],
      include: {
        roleProfile: {
          select: {
            id: !0,
            name: !0
          }
        },
        _count: {
          select: {
            sales: !0,
            cashSessions: !0
          }
        }
      }
    })).map((n) => {
      var s, t, i;
      return {
        id: n.id,
        internalCode: n.internalCode,
        name: n.name,
        firstName: n.firstName ?? n.name,
        lastName: n.lastName,
        username: n.username,
        documentNumber: n.documentNumber,
        email: n.email,
        phone: n.phone,
        address: n.address,
        birthDate: ((s = n.birthDate) == null ? void 0 : s.toISOString().slice(0, 10)) ?? null,
        role: n.role,
        roleProfileId: ((t = n.roleProfile) == null ? void 0 : t.id) ?? null,
        roleProfileName: ((i = n.roleProfile) == null ? void 0 : i.name) ?? null,
        isActive: n.isActive,
        createdAt: n.createdAt.toISOString(),
        salesCount: n._count.sales,
        sessionsCount: n._count.cashSessions
      };
    })
  } : { success: !1, message: "Debes iniciar sesion", users: [] }), e.handle("products:categories:list", async () => r() ? {
    success: !0,
    categories: (await a.productCategory.findMany({
      orderBy: { name: "asc" },
      include: {
        subcategories: {
          where: { isActive: !0 },
          orderBy: { name: "asc" }
        }
      }
    })).map((n) => ({
      id: n.id,
      name: n.name,
      isActive: n.isActive,
      subcategories: n.subcategories.map((s) => ({
        id: s.id,
        name: s.name,
        isActive: s.isActive
      }))
    }))
  } : { success: !1, message: "Debes iniciar sesion", categories: [] }), e.handle("products:list-admin", async () => {
    if (!r())
      return { success: !1, message: "Debes iniciar sesion", products: [] };
    const c = await a.product.findMany({
      include: {
        category: !0,
        subcategory: !0
      },
      orderBy: { name: "asc" }
    }), n = c.map((i) => i.id), s = await de(a, "Product", n, "create"), t = await de(a, "Product", n, "update", !0);
    return {
      success: !0,
      products: c.map((i) => {
        var u, f;
        return {
          id: i.id,
          name: i.name,
          sku: i.sku,
          barcode: i.barcode,
          unitMeasure: i.unitMeasure,
          price: i.price,
          cost: i.cost,
          marginPercent: i.marginPercent,
          hasTax: i.hasTax,
          taxRate: i.taxRate,
          stock: i.stock,
          categoryId: i.categoryId,
          subcategoryId: i.subcategoryId,
          categoryName: ((u = i.category) == null ? void 0 : u.name) ?? null,
          subcategoryName: ((f = i.subcategory) == null ? void 0 : f.name) ?? null,
          isActive: i.isActive,
          createdAt: i.createdAt.toISOString(),
          updatedAt: i.updatedAt.toISOString(),
          createdBy: s.get(i.id) ?? null,
          updatedBy: t.get(i.id) ?? s.get(i.id) ?? null
        };
      })
    };
  }), e.handle("products:create", async (m, c) => {
    var f;
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.productsCreate))
      return { success: !1, message: "Tu rol no puede crear productos" };
    const s = Fa.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para el producto" };
    const t = s.data, i = t.categoryId ? await a.productCategory.findUnique({ where: { id: t.categoryId } }) : null, u = ((f = t.sku) == null ? void 0 : f.trim()) || await Ts(a, t.name, i == null ? void 0 : i.name);
    try {
      const g = await a.$transaction(async (T) => {
        const I = await T.product.create({
          data: {
            name: t.name,
            sku: u,
            barcode: t.barcode || null,
            unitMeasure: t.unitMeasure ?? "UNIDAD",
            price: z(t.price),
            cost: z(t.cost ?? 0),
            marginPercent: t.marginPercent ?? 0,
            hasTax: t.hasTax ?? !1,
            taxRate: t.hasTax ? t.taxRate ?? 0 : 0,
            stock: t.stock ?? 0,
            categoryId: t.categoryId ?? null,
            subcategoryId: t.subcategoryId ?? null,
            isActive: t.isActive ?? !0
          }
        });
        return (t.stock ?? 0) > 0 && await T.inventoryMovement.create({
          data: {
            productId: I.id,
            type: Te.MANUAL_IN,
            qty: t.stock ?? 0,
            stockBefore: 0,
            stockAfter: t.stock ?? 0,
            referenceType: "PRODUCT_CREATE",
            referenceId: I.id,
            note: `Stock inicial registrado por ${_e(n)}`
          }
        }), I;
      });
      return await V(a, n, "products", "create", "Product", g.id, void 0, {
        name: g.name,
        sku: g.sku
      }), { success: !0, productId: g.id };
    } catch (g) {
      return { success: !1, message: g instanceof Error ? g.message : "No se pudo crear el producto" };
    }
  }), e.handle("products:update", async (m, c) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.productsEdit))
      return { success: !1, message: "Tu rol no puede editar productos" };
    const s = $a.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para actualizar el producto" };
    const t = await a.product.findUnique({ where: { id: s.data.id } });
    if (!t)
      return { success: !1, message: "Producto no encontrado" };
    try {
      return await a.$transaction(async (i) => {
        if (await i.product.update({
          where: { id: s.data.id },
          data: {
            name: s.data.name ?? t.name,
            sku: s.data.sku ?? t.sku,
            barcode: s.data.barcode === void 0 ? t.barcode : s.data.barcode,
            unitMeasure: s.data.unitMeasure ?? t.unitMeasure,
            price: s.data.price === void 0 ? t.price : z(s.data.price),
            cost: s.data.cost === void 0 ? t.cost : z(s.data.cost),
            marginPercent: s.data.marginPercent ?? t.marginPercent,
            hasTax: s.data.hasTax ?? t.hasTax,
            taxRate: s.data.hasTax === !1 ? 0 : s.data.taxRate ?? t.taxRate,
            stock: s.data.stock ?? t.stock,
            categoryId: s.data.categoryId === void 0 ? t.categoryId : s.data.categoryId,
            subcategoryId: s.data.subcategoryId === void 0 ? t.subcategoryId : s.data.subcategoryId,
            isActive: s.data.isActive ?? t.isActive
          }
        }), s.data.stock !== void 0 && s.data.stock !== t.stock) {
          const u = s.data.stock - t.stock;
          await i.inventoryMovement.create({
            data: {
              productId: t.id,
              type: u > 0 ? Te.ADJUSTMENT_IN : Te.ADJUSTMENT_OUT,
              qty: Math.abs(u),
              stockBefore: t.stock,
              stockAfter: s.data.stock,
              referenceType: "PRODUCT_EDIT",
              referenceId: t.id,
              note: `Ajuste manual por ${_e(n)}`
            }
          });
        }
      }), await V(a, n, "products", "update", "Product", t.id, t, s.data), { success: !0 };
    } catch (i) {
      return { success: !1, message: i instanceof Error ? i.message : "No se pudo actualizar el producto" };
    }
  }), e.handle("products:delete", async (m, c) => {
    const n = await ot(r);
    if (!M(n, E.productsDelete))
      return { success: !1, message: "Tu rol no puede archivar productos" };
    const s = Ee.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Producto invalido" };
    const t = await a.product.findUnique({ where: { id: s.data.id } });
    return t ? (await a.product.update({
      where: { id: s.data.id },
      data: { isActive: !1 }
    }), await V(a, n, "products", "archive", "Product", t.id, t, {
      isActive: !1
    }), { success: !0 }) : { success: !1, message: "Producto no encontrado" };
  }), e.handle("products:category:create", async (m, c) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.productsEdit))
      return { success: !1, message: "Tu rol no puede administrar categorias" };
    const s = Ka.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Categoria invalida" };
    try {
      return await a.productCategory.create({
        data: { name: s.data.name, isActive: !0 }
      }), { success: !0 };
    } catch {
      return { success: !1, message: "La categoria ya existe" };
    }
  }), e.handle("products:category:delete", async (m, c) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.productsEdit))
      return { success: !1, message: "Tu rol no puede administrar categorias" };
    const s = Ee.safeParse(c);
    return s.success ? (await a.productCategory.delete({
      where: { id: s.data.id }
    }), { success: !0 }) : { success: !1, message: "Categoria invalida" };
  }), e.handle("products:subcategory:create", async (m, c) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.productsEdit))
      return { success: !1, message: "Tu rol no puede administrar subcategorias" };
    const s = Ha.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Subcategoria invalida" };
    try {
      return await a.productSubcategory.create({
        data: {
          categoryId: s.data.categoryId,
          name: s.data.name,
          isActive: !0
        }
      }), { success: !0 };
    } catch {
      return { success: !1, message: "La subcategoria ya existe en esa categoria" };
    }
  }), e.handle("products:subcategory:delete", async (m, c) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.productsEdit))
      return { success: !1, message: "Tu rol no puede administrar subcategorias" };
    const s = Ee.safeParse(c);
    return s.success ? (await a.productSubcategory.delete({
      where: { id: s.data.id }
    }), { success: !0 }) : { success: !1, message: "Subcategoria invalida" };
  }), e.handle("customers:list", async () => {
    if (!r())
      return { success: !1, message: "Debes iniciar sesion", customers: [] };
    const c = await a.customer.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { sales: !0, credits: !0 }
        }
      }
    }), n = c.map((t) => t.id), s = await de(a, "Customer", n, "create");
    return {
      success: !0,
      customers: c.map((t) => ({
        id: t.id,
        internalCode: t.internalCode,
        name: t.name,
        document: t.document,
        phone: t.phone,
        email: t.email,
        address: t.address,
        isActive: t.isActive,
        salesCount: t._count.sales,
        creditsCount: t._count.credits,
        createdAt: t.createdAt.toISOString(),
        createdBy: s.get(t.id) ?? null
      }))
    };
  }), e.handle("customers:sales-history", async (m, c) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion", sales: [] };
    if (!M(n, E.salesHistory))
      return { success: !1, message: "Tu rol no puede ver facturas del POS", sales: [] };
    const s = Ee.safeParse(c);
    return s.success ? {
      success: !0,
      sales: (await a.sale.findMany({
        where: { customerId: s.data.id },
        include: {
          cashier: {
            select: { username: !0, name: !0 }
          },
          items: {
            select: { qty: !0 }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 50
      })).map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        total: i.total,
        status: i.status,
        paymentMethod: i.paymentMethod,
        createdAt: i.createdAt.toISOString(),
        cashier: ye(i.cashier),
        itemsCount: i.items.reduce((u, f) => u + f.qty, 0)
      }))
    } : { success: !1, message: "Cliente invalido", sales: [] };
  }), e.handle("customers:create", async (m, c) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.customersCreate))
      return { success: !1, message: "Tu rol no puede crear clientes" };
    const s = wt.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para el cliente" };
    try {
      const t = (await a.customer.findMany({
        select: { internalCode: !0 }
      })).map((f) => f.internalCode), i = Z({
        desiredCode: null,
        existingCodes: t,
        prefix: "CLI",
        digits: 4,
        maxLength: 30
      }), u = await a.customer.create({
        data: {
          internalCode: i,
          name: it(s.data.firstName, s.data.lastName),
          document: be(s.data.documentType, s.data.documentNumber),
          phone: s.data.phone || null,
          email: s.data.email || null,
          address: s.data.address || null,
          creditLimit: 0,
          notes: null,
          isActive: !0
        }
      });
      return await V(a, n, "customers", "create", "Customer", u.id, void 0, {
        name: u.name,
        document: u.document
      }), { success: !0, customerId: u.id };
    } catch (t) {
      return { success: !1, message: t instanceof Error ? t.message : "No se pudo crear el cliente. Verifica documento o correo duplicado." };
    }
  }), e.handle("customers:update", async (m, c) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.customersEdit))
      return { success: !1, message: "Tu rol no puede editar clientes" };
    const s = Ya.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para actualizar el cliente" };
    const t = await a.customer.findUnique({ where: { id: s.data.id } });
    if (!t)
      return { success: !1, message: "Cliente no encontrado" };
    try {
      const i = (await a.customer.findMany({
        where: { NOT: { id: t.id } },
        select: { internalCode: !0 }
      })).map((g) => g.internalCode), f = {
        internalCode: Z({
          desiredCode: t.internalCode,
          existingCodes: i,
          prefix: "CLI",
          digits: 4,
          maxLength: 30
        }),
        name: it(s.data.firstName, s.data.lastName),
        document: be(s.data.documentType, s.data.documentNumber),
        phone: s.data.phone || null,
        email: s.data.email || null,
        address: s.data.address || null,
        isActive: s.data.isActive ?? t.isActive
      };
      return await a.customer.update({
        where: { id: t.id },
        data: {
          ...f,
          creditLimit: 0,
          notes: null
        }
      }), await V(a, n, "customers", "update", "Customer", t.id, t, f), { success: !0 };
    } catch (i) {
      return { success: !1, message: i instanceof Error ? i.message : "No se pudo actualizar el cliente. Verifica documento o correo duplicado." };
    }
  }), e.handle("suppliers:list", async () => {
    if (!r())
      return { success: !1, message: "Debes iniciar sesion", suppliers: [] };
    const c = await a.supplier.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { purchases: !0 }
        }
      }
    }), n = c.map((t) => t.id), s = await de(a, "Supplier", n, "create");
    return {
      success: !0,
      suppliers: c.map((t) => ({
        id: t.id,
        internalCode: t.internalCode,
        name: t.name,
        document: t.taxId,
        phone: t.phone,
        email: t.email,
        address: t.address,
        contactName: t.contactName,
        isActive: t.isActive,
        purchasesCount: t._count.purchases,
        createdAt: t.createdAt.toISOString(),
        createdBy: s.get(t.id) ?? null
      }))
    };
  }), e.handle("suppliers:create", async (m, c) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.suppliersCreate))
      return { success: !1, message: "Tu rol no puede crear proveedores" };
    const s = Ot.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para el proveedor" };
    try {
      const t = (await a.supplier.findMany({
        select: { internalCode: !0 }
      })).map((f) => f.internalCode), i = Z({
        desiredCode: null,
        existingCodes: t,
        prefix: "PRV",
        digits: 4,
        maxLength: 30
      }), u = await a.supplier.create({
        data: {
          internalCode: i,
          name: s.data.name,
          taxId: be(s.data.documentType, s.data.documentNumber),
          phone: s.data.phone || null,
          email: s.data.email || null,
          address: s.data.address || null,
          contactName: s.data.contactName || null,
          isActive: !0
        }
      });
      return await V(a, n, "suppliers", "create", "Supplier", u.id, void 0, {
        name: u.name,
        taxId: u.taxId
      }), { success: !0, supplierId: u.id };
    } catch (t) {
      return { success: !1, message: t instanceof Error ? t.message : "No se pudo crear el proveedor. Verifica documento o correo duplicado." };
    }
  }), e.handle("suppliers:update", async (m, c) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.suppliersEdit))
      return { success: !1, message: "Tu rol no puede editar proveedores" };
    const s = Ja.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para actualizar el proveedor" };
    const t = await a.supplier.findUnique({ where: { id: s.data.id } });
    if (!t)
      return { success: !1, message: "Proveedor no encontrado" };
    try {
      const i = (await a.supplier.findMany({
        where: { NOT: { id: t.id } },
        select: { internalCode: !0 }
      })).map((g) => g.internalCode), f = {
        internalCode: Z({
          desiredCode: t.internalCode,
          existingCodes: i,
          prefix: "PRV",
          digits: 4,
          maxLength: 30
        }),
        name: s.data.name,
        taxId: be(s.data.documentType, s.data.documentNumber),
        phone: s.data.phone || null,
        email: s.data.email || null,
        address: s.data.address || null,
        contactName: s.data.contactName || null,
        isActive: s.data.isActive ?? t.isActive
      };
      return await a.supplier.update({
        where: { id: t.id },
        data: f
      }), await V(a, n, "suppliers", "update", "Supplier", t.id, t, f), { success: !0 };
    } catch (i) {
      return { success: !1, message: i instanceof Error ? i.message : "No se pudo actualizar el proveedor. Verifica documento o correo duplicado." };
    }
  }), e.handle("purchases:list", async () => {
    if (!r())
      return { success: !1, message: "Debes iniciar sesion", purchases: [] };
    const c = await a.purchase.findMany({
      include: {
        supplier: {
          select: { name: !0 }
        },
        items: {
          select: { qty: !0 }
        }
      },
      orderBy: { purchasedAt: "desc" },
      take: 200
    }), n = c.map((t) => t.id), s = await de(a, "Purchase", n, "create");
    return {
      success: !0,
      purchases: c.map((t) => ({
        id: t.id,
        number: t.number,
        supplierId: t.supplierId,
        supplier: t.supplier.name,
        status: t.status,
        subtotal: t.subtotal,
        tax: t.tax,
        total: t.total,
        balance: t.balance,
        note: t.note,
        purchasedAt: t.purchasedAt.toISOString(),
        itemsCount: t.items.reduce((i, u) => i + u.qty, 0),
        createdBy: s.get(t.id) ?? null
      }))
    };
  }), e.handle("purchases:get-detail", async (m, c) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.purchasesDetails))
      return { success: !1, message: "Tu rol no puede ver el detalle de compras" };
    const s = Ee.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Compra invalida" };
    const t = await a.purchase.findUnique({
      where: { id: s.data.id },
      include: {
        supplier: !0,
        items: {
          include: {
            product: {
              select: { name: !0, sku: !0 }
            }
          },
          orderBy: { createdAt: "asc" }
        }
      }
    });
    if (!t)
      return { success: !1, message: "Compra no encontrada" };
    const i = await de(a, "Purchase", [t.id], "create");
    return {
      success: !0,
      purchase: {
        id: t.id,
        number: t.number,
        supplier: t.supplier.name,
        status: t.status,
        subtotal: t.subtotal,
        tax: t.tax,
        total: t.total,
        balance: t.balance,
        note: t.note,
        purchasedAt: t.purchasedAt.toISOString(),
        createdBy: i.get(t.id) ?? null,
        items: t.items.map((u) => ({
          id: u.id,
          productName: u.product.name,
          productSku: u.product.sku,
          qty: u.qty,
          cost: u.cost,
          taxRate: u.taxRate,
          subtotal: u.subtotal,
          total: u.subtotal + z(u.subtotal * u.taxRate)
        }))
      }
    };
  }), e.handle("purchases:create", async (m, c) => {
    const n = await ot(r);
    if (!M(n, E.purchasesCreate))
      return { success: !1, message: "Tu rol no puede registrar compras" };
    const s = Wa.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para la compra" };
    const t = await a.supplier.findUnique({ where: { id: s.data.supplierId } });
    if (!t)
      return { success: !1, message: "Proveedor no encontrado" };
    const i = s.data.items.map((b) => b.productId), u = await a.product.findMany({
      where: {
        id: { in: i },
        isActive: !0
      }
    });
    if (u.length !== i.length)
      return { success: !1, message: "Uno o más productos no están disponibles" };
    const f = new Map(u.map((b) => [b.id, b])), g = s.data.items.map((b) => {
      const d = f.get(b.productId);
      if (!d)
        throw new Error("Producto no encontrado");
      const A = z(b.cost * b.qty), S = z(A * (b.taxRate ?? 0));
      return {
        product: d,
        qty: b.qty,
        cost: z(b.cost),
        taxRate: b.taxRate ?? 0,
        subtotal: A,
        tax: S,
        total: A + S
      };
    }), T = g.reduce((b, d) => b + d.subtotal, 0), I = g.reduce((b, d) => b + d.tax, 0), p = T + I, N = s.data.purchasedAt ? new Date(s.data.purchasedAt) : /* @__PURE__ */ new Date(), C = s.data.markAsPaid ? Qe.PAID : Qe.RECEIVED, h = s.data.markAsPaid ? 0 : p, v = ke(s.data.paymentMedium), D = v === "CORRESPONDENT" && s.data.paymentPlatformId ? await a.correspondentPlatform.findUnique({
      where: { id: s.data.paymentPlatformId },
      select: { id: !0, name: !0 }
    }) : null;
    if (v === "CORRESPONDENT" && !D)
      return { success: !1, message: "Selecciona un corresponsal valido para pagar la compra" };
    const P = s.data.markAsPaid ? await a.cashSession.findFirst({
      where: { status: W.OPEN },
      orderBy: { openedAt: "desc" }
    }) : null;
    if (s.data.markAsPaid && !P)
      return { success: !1, message: "Abre el control diario antes de registrar compras pagadas" };
    try {
      const b = await a.$transaction(async (d) => {
        const A = await Is(d), S = await d.purchase.create({
          data: {
            supplierId: s.data.supplierId,
            number: A,
            status: C,
            subtotal: T,
            tax: I,
            total: p,
            balance: h,
            note: s.data.note || null,
            purchasedAt: N,
            items: {
              create: g.map((y) => ({
                productId: y.product.id,
                qty: y.qty,
                cost: y.cost,
                taxRate: y.taxRate,
                subtotal: y.subtotal
              }))
            }
          }
        });
        for (const y of g) {
          const w = y.product.stock + y.qty, $ = w <= 0 ? y.cost : z((y.product.stock * y.product.cost + y.subtotal) / w), U = is(
            $,
            y.product.marginPercent,
            y.product.hasTax,
            y.product.taxRate
          );
          await d.product.update({
            where: { id: y.product.id },
            data: {
              stock: w,
              cost: $,
              price: U
            }
          }), await d.inventoryMovement.create({
            data: {
              productId: y.product.id,
              type: Te.PURCHASE_IN,
              qty: y.qty,
              stockBefore: y.product.stock,
              stockAfter: w,
              referenceType: "PURCHASE",
              referenceId: S.id,
              note: `${S.number} - ${t.name} - registrado por ${_e(n)}`
            }
          });
        }
        return s.data.markAsPaid && P && await d.cashMovement.create({
          data: {
            sessionId: P.id,
            type: B.EXPENSE_OUT,
            amount: p,
            note: Se({
              label: `Compra pagada ${S.number} - ${t.name}`,
              medium: v,
              platformId: (D == null ? void 0 : D.id) ?? null,
              platformName: (D == null ? void 0 : D.name) ?? null,
              sourceType: "PURCHASE",
              userNote: s.data.note || null
            })
          }
        }), S;
      });
      return await V(a, n, "purchases", "create", "Purchase", b.id, void 0, {
        number: b.number,
        supplier: t.name,
        total: b.total,
        markAsPaid: s.data.markAsPaid,
        paymentMedium: v,
        paymentPlatform: (D == null ? void 0 : D.name) ?? null
      }), { success: !0, purchaseId: b.id };
    } catch (b) {
      return { success: !1, message: b instanceof Error ? b.message : "No se pudo registrar la compra" };
    }
  }), e.handle("inventory:list", async () => r() ? {
    success: !0,
    moves: (await a.inventoryMovement.findMany({
      include: {
        product: {
          select: { id: !0, name: !0, sku: !0 }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 200
    })).map((n) => ({
      id: n.id,
      productId: n.productId,
      productName: n.product.name,
      productSku: n.product.sku,
      type: n.type,
      qty: n.qty,
      stockBefore: n.stockBefore,
      stockAfter: n.stockAfter,
      referenceType: n.referenceType,
      referenceId: n.referenceId,
      note: n.note,
      createdAt: n.createdAt.toISOString()
    }))
  } : { success: !1, message: "Debes iniciar sesion", moves: [] }), e.handle("sales:list", async (m, c) => {
    var f;
    if (!r())
      return { success: !1, message: "Debes iniciar sesion", sales: [] };
    const s = ns.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Filtros invalidos", sales: [] };
    const t = s.data, i = (f = t.search) == null ? void 0 : f.trim();
    return {
      success: !0,
      sales: (await a.sale.findMany({
        where: {
          createdAt: t.dateFrom || t.dateTo ? {
            ...t.dateFrom ? { gte: new Date(t.dateFrom) } : {},
            ...t.dateTo ? { lt: new Date(t.dateTo) } : {}
          } : void 0,
          cashierId: t.cashierId,
          status: t.status,
          OR: i ? [
            { invoiceNumber: { contains: i } },
            { customer: { contains: i } }
          ] : void 0
        },
        include: {
          cashier: {
            select: { username: !0, name: !0 }
          },
          items: {
            select: { qty: !0 }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 200
      })).map((g) => ({
        id: g.id,
        invoiceNumber: g.invoiceNumber,
        customer: g.customer,
        paymentMethod: g.paymentMethod,
        subtotal: g.subtotal,
        tax: g.tax,
        total: g.total,
        status: g.status,
        createdAt: g.createdAt.toISOString(),
        cashier: ye(g.cashier),
        itemsCount: g.items.reduce((T, I) => T + I.qty, 0)
      }))
    };
  }), e.handle("sales:get-detail", async (m, c) => {
    if (!r())
      return { success: !1, message: "Debes iniciar sesion" };
    const s = st.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Venta invalida" };
    const t = await a.sale.findUnique({
      where: { id: s.data.saleId },
      include: {
        cashier: {
          select: { username: !0, name: !0 }
        },
        items: {
          orderBy: { createdAt: "asc" }
        },
        payments: !0
      }
    });
    return t ? {
      success: !0,
      sale: {
        id: t.id,
        invoiceNumber: t.invoiceNumber,
        customer: t.customer,
        paymentMethod: t.paymentMethod,
        subtotal: t.subtotal,
        tax: t.tax,
        total: t.total,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
        cashier: ye(t.cashier),
        items: t.items.map((i) => ({
          id: i.id,
          name: i.name,
          qty: i.qty,
          price: i.price,
          taxRate: i.taxRate,
          lineSubtotal: i.lineSubtotal,
          lineTax: i.lineTax,
          lineTotal: i.lineTotal
        })),
        payments: t.payments.map((i) => ({
          id: i.id,
          method: i.method,
          amount: i.amount,
          reference: i.reference
        }))
      }
    } : { success: !1, message: "Venta no encontrada" };
  }), e.handle("sales:print-invoice", async (m, c) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.salesPrint))
      return { success: !1, message: "Tu rol no puede imprimir facturas" };
    const s = st.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Venta invalida" };
    const [t, i] = await Promise.all([
      a.sale.findUnique({
        where: { id: s.data.saleId },
        include: {
          cashier: { select: { username: !0, name: !0 } },
          items: { orderBy: { createdAt: "asc" } },
          payments: !0
        }
      }),
      a.businessSettings.findUnique({
        where: { id: "default" }
      })
    ]);
    if (!t)
      return { success: !1, message: "Venta no encontrada" };
    const u = nt(i == null ? void 0 : i.address), f = us({
      businessName: i == null ? void 0 : i.businessName,
      taxId: i == null ? void 0 : i.taxId,
      address: u.address,
      city: u.city,
      receiptFooter: i == null ? void 0 : i.receiptFooter,
      invoiceNumber: t.invoiceNumber,
      customer: t.customer,
      paymentSummary: cs(t.payments, t.paymentMethod),
      total: t.total,
      subtotal: t.subtotal,
      tax: t.tax,
      createdAt: t.createdAt,
      cashier: t.cashier,
      items: t.items.map((T) => ({
        name: T.name,
        qty: T.qty,
        price: T.price,
        lineTotal: T.lineTotal
      }))
    }, s.data.template), g = new qe({
      show: !1,
      webPreferences: {
        sandbox: !1
      }
    });
    return await g.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(f)}`), await new Promise((T) => {
      g.webContents.print(
        {
          silent: !1,
          printBackground: !0
        },
        (I, p) => {
          if (g.close(), !I) {
            T({ success: !1, message: p || "No se pudo imprimir" });
            return;
          }
          T({ success: !0 });
        }
      );
    });
  }), e.handle("accounting:summary", async (m, c) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.reportsView))
      return { success: !1, message: "Tu rol no puede consultar contabilidad" };
    const s = Pa.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Filtros invalidos" };
    const t = ms(s.data.dateFrom, s.data.dateTo), [i, u, f, g, T, I] = await Promise.all([
      a.customer.findMany({
        where: { isActive: !0 },
        orderBy: { name: "asc" },
        select: {
          id: !0,
          internalCode: !0,
          name: !0,
          document: !0,
          phone: !0
        }
      }),
      a.sale.findMany({
        where: {
          ...t ? { createdAt: t } : {},
          status: { not: me.CANCELLED }
        },
        include: {
          customerRef: {
            select: {
              id: !0,
              name: !0
            }
          },
          credits: {
            orderBy: { createdAt: "desc" }
          },
          returns: !0,
          payments: {
            orderBy: { createdAt: "asc" },
            select: {
              method: !0,
              amount: !0
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 150
      }),
      a.customerCredit.findMany({
        where: t ? { createdAt: t } : void 0,
        include: {
          customer: {
            select: {
              id: !0,
              name: !0
            }
          },
          sale: {
            select: {
              id: !0,
              invoiceNumber: !0
            }
          },
          payments: {
            select: {
              amount: !0
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 150
      }),
      a.customerPayment.findMany({
        where: t ? { createdAt: t } : void 0,
        include: {
          customer: {
            select: {
              name: !0
            }
          },
          credit: {
            select: {
              id: !0,
              sale: {
                select: {
                  id: !0,
                  invoiceNumber: !0
                }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 150
      }),
      a.saleReturn.findMany({
        where: t ? { createdAt: t } : void 0,
        include: {
          sale: {
            select: {
              id: !0,
              invoiceNumber: !0,
              customer: !0
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 150
      }),
      a.cashMovement.findMany({
        where: {
          ...t ? { createdAt: t } : {},
          type: { in: [B.EXPENSE_OUT, B.WITHDRAWAL_OUT] }
        },
        include: {
          session: {
            include: {
              register: {
                select: { name: !0 }
              },
              user: {
                select: { username: !0, name: !0 }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 150
      })
    ]), p = f.map((d) => {
      var S;
      const A = Ae(d.balance, d.total, d.dueDate);
      return {
        id: d.id,
        saleId: d.saleId,
        invoiceNumber: d.sale.invoiceNumber,
        customerId: d.customerId,
        customerName: d.customer.name,
        total: d.total,
        balance: d.balance,
        paidAmount: d.payments.reduce((y, w) => y + w.amount, 0),
        status: A,
        dueDate: ((S = d.dueDate) == null ? void 0 : S.toISOString()) ?? null,
        createdAt: d.createdAt.toISOString()
      };
    }), N = u.map((d) => {
      var q, k;
      const A = d.returns.reduce((L, xe) => L + xe.total, 0), S = d.credits[0] ?? null, y = d.payments.reduce((L, xe) => L + xe.amount, 0), w = Math.max(d.total - A, 0), $ = S ? S.balance : Math.max(w - y, 0), U = A >= d.total ? "RETURNED" : $ <= 0 ? "PAID" : y > 0 ? "PARTIAL" : "PENDING", Y = d.payments.length ? d.payments.map((L) => `${le(L.method)} $${L.amount.toLocaleString("es-CO")}`).join(" + ") : S ? "Pendiente por cartera" : le(d.paymentMethod);
      return {
        id: d.id,
        invoiceNumber: d.invoiceNumber,
        customer: d.customer,
        customerId: ((q = d.customerRef) == null ? void 0 : q.id) ?? null,
        total: d.total,
        paidAtSale: y,
        pendingAmount: $,
        returnedTotal: A,
        grossProfit: d.profit,
        paymentSummary: Y,
        collectionStatus: U,
        status: d.status,
        createdAt: d.createdAt.toISOString(),
        availableCreditTotal: Math.max(d.total - A, 0),
        availableCreditNoteTotal: Math.max(d.total - A, 0),
        credit: S ? {
          id: S.id,
          total: S.total,
          balance: S.balance,
          status: Ae(S.balance, S.total, S.dueDate),
          dueDate: ((k = S.dueDate) == null ? void 0 : k.toISOString()) ?? null
        } : null
      };
    }), C = /* @__PURE__ */ new Map();
    for (const d of [j.CASH, j.CARD, j.TRANSFER])
      C.set(d, { salesAmount: 0, collectionsAmount: 0 });
    for (const d of u) {
      if (d.payments.length === 0) {
        const A = C.get(d.paymentMethod) ?? { salesAmount: 0, collectionsAmount: 0 };
        A.salesAmount += d.total, C.set(d.paymentMethod, A);
        continue;
      }
      for (const A of d.payments) {
        const S = C.get(A.method) ?? { salesAmount: 0, collectionsAmount: 0 };
        S.salesAmount += A.amount, C.set(A.method, S);
      }
    }
    for (const d of g) {
      const A = C.get(d.method) ?? { salesAmount: 0, collectionsAmount: 0 };
      A.collectionsAmount += d.amount, C.set(d.method, A);
    }
    const h = N.reduce((d, A) => d + A.paidAtSale, 0), v = g.reduce((d, A) => d + A.amount, 0), D = N.reduce((d, A) => d + A.pendingAmount, 0), P = N.reduce((d, A) => d + A.grossProfit, 0), b = [
      ...N.map((d) => ({
        id: `sale-${d.id}`,
        createdAt: d.createdAt,
        category: "SALE",
        title: `Venta ${d.invoiceNumber}`,
        detail: `${d.customer} | cobrado al momento $${d.paidAtSale.toLocaleString("es-CO")} | pendiente $${d.pendingAmount.toLocaleString("es-CO")}`,
        medium: d.paymentSummary,
        amount: d.total,
        direction: "IN",
        reference: d.invoiceNumber,
        operationalImpact: d.paidAtSale
      })),
      ...g.map((d) => {
        var A, S;
        return {
          id: `collection-${d.id}`,
          createdAt: d.createdAt.toISOString(),
          category: "COLLECTION",
          title: `Abono cartera ${((A = d.credit) == null ? void 0 : A.sale.invoiceNumber) ?? ""}`.trim(),
          detail: `${d.customer.name} | ${d.note || "Sin detalle"}`,
          medium: le(d.method),
          amount: d.amount,
          direction: "IN",
          reference: ((S = d.credit) == null ? void 0 : S.sale.invoiceNumber) ?? null,
          operationalImpact: d.amount
        };
      }),
      ...T.map((d) => ({
        id: `credit-note-${d.id}`,
        createdAt: d.createdAt.toISOString(),
        category: "CREDIT_NOTE",
        title: `Nota credito ${d.sale.invoiceNumber}`,
        detail: `${d.sale.customer} | ${d.reason || "Ajuste sobre venta"}`,
        medium: "Ajuste comercial",
        amount: d.total,
        direction: "OUT",
        reference: d.sale.invoiceNumber,
        operationalImpact: -d.total
      })),
      ...I.map((d) => {
        var A, S, y;
        return {
          id: `expense-${d.id}`,
          createdAt: d.createdAt.toISOString(),
          category: "EXPENSE",
          title: d.type === B.WITHDRAWAL_OUT ? "Retiro operativo" : "Gasto operativo",
          detail: Be(d.note),
          medium: ((A = se(d.note)) == null ? void 0 : A.medium) === "CORRESPONDENT" ? ((S = se(d.note)) == null ? void 0 : S.platformName) || "Corresponsal" : ((y = se(d.note)) == null ? void 0 : y.medium) === "TRANSFER" ? "Transferencias" : "Efectivo",
          amount: d.amount,
          direction: "OUT",
          reference: null,
          operationalImpact: -d.amount
        };
      })
    ].sort((d, A) => new Date(A.createdAt).getTime() - new Date(d.createdAt).getTime()).slice(0, 250);
    return {
      success: !0,
      summary: {
        salesCount: N.length,
        salesTotal: N.reduce((d, A) => d + A.total, 0),
        collectedSalesTotal: h,
        pendingSalesBalance: D,
        pendingCreditsCount: p.filter((d) => d.balance > 0).length,
        pendingCreditsBalance: p.reduce((d, A) => d + A.balance, 0),
        paymentsTotal: v,
        collectionsTotal: v,
        operationalIncomeTotal: h + v,
        creditNotesTotal: T.reduce((d, A) => d + A.total, 0),
        expensesTotal: I.reduce((d, A) => d + A.amount, 0),
        grossProfitTotal: P,
        averageTicket: N.length > 0 ? z(N.reduce((d, A) => d + A.total, 0) / N.length) : 0,
        netOperationalBalance: h + v - T.reduce((d, A) => d + A.total, 0) - I.reduce((d, A) => d + A.amount, 0)
      },
      customers: i.map((d) => ({
        id: d.id,
        internalCode: d.internalCode,
        name: d.name,
        document: d.document,
        phone: d.phone
      })),
      paymentSummary: [...C.entries()].map(([d, A]) => ({
        method: d,
        label: le(d),
        salesAmount: A.salesAmount,
        collectionsAmount: A.collectionsAmount,
        totalAmount: A.salesAmount + A.collectionsAmount
      })),
      movementHistory: b,
      sales: N,
      credits: p,
      payments: g.map((d) => {
        var A, S;
        return {
          id: d.id,
          creditId: d.creditId,
          saleId: ((A = d.credit) == null ? void 0 : A.sale.id) ?? null,
          invoiceNumber: ((S = d.credit) == null ? void 0 : S.sale.invoiceNumber) ?? null,
          customerName: d.customer.name,
          method: d.method,
          amount: d.amount,
          note: d.note,
          createdAt: d.createdAt.toISOString()
        };
      }),
      creditNotes: T.map((d) => ({
        id: d.id,
        saleId: d.saleId,
        invoiceNumber: d.sale.invoiceNumber,
        customerName: d.sale.customer,
        total: d.total,
        reason: d.reason,
        createdAt: d.createdAt.toISOString()
      })),
      expenses: I.map((d) => {
        const A = se(d.note);
        return {
          id: d.id,
          sessionId: d.sessionId,
          registerName: d.session.register.name,
          userName: d.session.user.name ?? d.session.user.username,
          type: d.type,
          amount: d.amount,
          note: Be(d.note),
          sourceMedium: (A == null ? void 0 : A.medium) ?? "CASH",
          sourcePlatform: (A == null ? void 0 : A.platformName) ?? null,
          createdAt: d.createdAt.toISOString()
        };
      })
    };
  }), e.handle("accounting:credit:create", async (m, c) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.reportsView))
      return { success: !1, message: "Tu rol no puede registrar cartera" };
    const s = La.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para la cartera" };
    const t = await a.sale.findUnique({
      where: { id: s.data.saleId },
      include: {
        credits: !0,
        returns: !0
      }
    });
    if (!t)
      return { success: !1, message: "La venta ya no existe" };
    if (t.credits.length > 0)
      return { success: !1, message: "La venta ya tiene una cuenta por cobrar asociada" };
    const i = await a.customer.findUnique({
      where: { id: s.data.customerId },
      select: { id: !0, name: !0, isActive: !0 }
    });
    if (!i || !i.isActive)
      return { success: !1, message: "Selecciona un cliente activo para crear la cuenta por cobrar" };
    const u = t.returns.reduce((T, I) => T + I.total, 0), f = Math.max(t.total - u, 0), g = s.data.total ?? f;
    if (f <= 0)
      return { success: !1, message: "La venta no tiene saldo disponible para cartera" };
    if (g > f)
      return { success: !1, message: "El valor supera el saldo disponible de la venta" };
    try {
      const T = await a.$transaction(async (I) => {
        const p = await I.customerCredit.create({
          data: {
            customerId: i.id,
            saleId: t.id,
            total: g,
            balance: g,
            dueDate: s.data.dueDate ? new Date(s.data.dueDate) : null,
            status: Ae(g, g, s.data.dueDate ? new Date(s.data.dueDate) : null)
          }
        });
        return await I.sale.update({
          where: { id: t.id },
          data: {
            customerId: i.id,
            customer: i.name,
            status: me.CREDIT
          }
        }), p;
      });
      return await V(a, n, "accounting", "create", "CustomerCredit", T.id, void 0, {
        saleId: t.id,
        customerId: i.id,
        total: g
      }), { success: !0, creditId: T.id, message: "Cuenta por cobrar creada correctamente." };
    } catch (T) {
      return { success: !1, message: T instanceof Error ? T.message : "No se pudo crear la cuenta por cobrar" };
    }
  }), e.handle("accounting:payment:create", async (m, c) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.reportsView))
      return { success: !1, message: "Tu rol no puede registrar pagos" };
    const s = Ua.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para el abono" };
    const t = await a.customerCredit.findUnique({
      where: { id: s.data.creditId },
      include: {
        sale: {
          include: {
            returns: !0
          }
        }
      }
    });
    if (!t)
      return { success: !1, message: "La cuenta por cobrar ya no existe" };
    if (t.balance <= 0)
      return { success: !1, message: "La cuenta por cobrar ya se encuentra saldada" };
    if (s.data.amount > t.balance)
      return { success: !1, message: "El abono supera el saldo pendiente" };
    const i = await a.cashSession.findFirst({
      where: { status: W.OPEN },
      orderBy: { openedAt: "desc" }
    });
    if (!i)
      return { success: !1, message: "Abre el control diario antes de registrar abonos" };
    try {
      const u = await a.$transaction(async (f) => {
        const g = await f.customerPayment.create({
          data: {
            customerId: t.customerId,
            creditId: t.id,
            method: s.data.method,
            amount: s.data.amount,
            note: s.data.note || null
          }
        }), T = t.total - t.balance + s.data.amount, I = Math.max(t.total - T, 0), p = Ae(I, t.total, t.dueDate);
        if (await f.customerCredit.update({
          where: { id: t.id },
          data: {
            balance: I,
            status: p
          }
        }), await f.cashMovement.create({
          data: {
            sessionId: i.id,
            type: B.INCOME_IN,
            amount: s.data.amount,
            note: Se({
              label: `Abono cartera ${t.sale.invoiceNumber}`,
              medium: s.data.method === j.CASH ? "CASH" : "TRANSFER",
              sourceType: "ACCOUNTING_PAYMENT",
              userNote: s.data.note || null
            })
          }
        }), I <= 0) {
          const N = t.sale.returns.reduce((C, h) => C + h.total, 0);
          await f.sale.update({
            where: { id: t.saleId },
            data: {
              status: ut(t.sale.total, N)
            }
          });
        }
        return g;
      });
      return await V(a, n, "accounting", "create", "CustomerPayment", u.id, void 0, {
        creditId: t.id,
        amount: s.data.amount,
        method: s.data.method
      }), { success: !0, paymentId: u.id, message: "Abono registrado correctamente." };
    } catch (u) {
      return { success: !1, message: u instanceof Error ? u.message : "No se pudo registrar el abono" };
    }
  }), e.handle("accounting:credit-note:create", async (m, c) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.reportsView))
      return { success: !1, message: "Tu rol no puede registrar notas credito" };
    const s = Ma.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para la nota credito" };
    const t = await a.sale.findUnique({
      where: { id: s.data.saleId },
      include: {
        returns: !0,
        credits: !0
      }
    });
    if (!t)
      return { success: !1, message: "La venta ya no existe" };
    const i = t.returns.reduce((f, g) => f + g.total, 0), u = Math.max(t.total - i, 0);
    if (u <= 0)
      return { success: !1, message: "La venta no tiene saldo disponible para nota credito" };
    if (s.data.amount > u)
      return { success: !1, message: "La nota credito supera el saldo disponible de la venta" };
    try {
      const f = await a.$transaction(async (g) => {
        const T = await g.saleReturn.create({
          data: {
            saleId: t.id,
            total: s.data.amount,
            reason: s.data.reason || null
          }
        }), I = i + s.data.amount;
        await g.sale.update({
          where: { id: t.id },
          data: {
            status: ut(t.total, I)
          }
        });
        const p = t.credits[0];
        if (p) {
          const N = Math.max(p.total - p.balance, 0), C = Math.max(p.total - s.data.amount, 0), h = Math.max(C - N, 0);
          await g.customerCredit.update({
            where: { id: p.id },
            data: {
              total: C,
              balance: h,
              status: Ae(h, C, p.dueDate)
            }
          });
        }
        return T;
      });
      return await V(a, n, "accounting", "create", "SaleReturn", f.id, void 0, {
        saleId: t.id,
        total: s.data.amount
      }), { success: !0, creditNoteId: f.id, message: "Nota credito registrada correctamente." };
    } catch (f) {
      return { success: !1, message: f instanceof Error ? f.message : "No se pudo registrar la nota credito" };
    }
  }), e.handle("accounting:expense:create", async (m, c) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.reportsView))
      return { success: !1, message: "Tu rol no puede registrar gastos" };
    const s = _a.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para el gasto" };
    const t = await a.cashSession.findFirst({
      where: { status: W.OPEN },
      orderBy: { openedAt: "desc" }
    });
    if (!t)
      return { success: !1, message: "Abre caja general antes de registrar gastos o retiros" };
    const i = ke(s.data.sourceMedium), u = i === "CORRESPONDENT" && s.data.sourcePlatformId ? await a.correspondentPlatform.findUnique({
      where: { id: s.data.sourcePlatformId },
      select: { id: !0, name: !0 }
    }) : null;
    if (i === "CORRESPONDENT" && !u)
      return { success: !1, message: "Selecciona un corresponsal valido para registrar el egreso" };
    try {
      const f = await a.cashMovement.create({
        data: {
          sessionId: t.id,
          type: s.data.type,
          amount: s.data.amount,
          note: Se({
            label: s.data.note,
            medium: i,
            platformId: (u == null ? void 0 : u.id) ?? null,
            platformName: (u == null ? void 0 : u.name) ?? null,
            sourceType: "EXPENSE",
            userNote: s.data.note
          })
        }
      });
      return await V(a, n, "accounting", "create", "CashMovement", f.id, void 0, {
        type: s.data.type,
        amount: s.data.amount,
        note: s.data.note,
        sourceMedium: i,
        sourcePlatform: (u == null ? void 0 : u.name) ?? null
      }), { success: !0, expenseId: f.id, message: "Gasto registrado correctamente." };
    } catch (f) {
      return { success: !1, message: f instanceof Error ? f.message : "No se pudo registrar el gasto" };
    }
  });
}
const Lt = H.dirname(Ft(import.meta.url));
process.env.APP_ROOT = H.join(Lt, "..");
const Ve = process.env.VITE_DEV_SERVER_URL, zs = H.join(process.env.APP_ROOT, "dist-electron"), Ut = H.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = Ve ? H.join(process.env.APP_ROOT, "public") : Ut;
let ue = null, R, lt = /* @__PURE__ */ new Date(), x = null;
function Mt() {
  ue = new qe({
    icon: H.join(process.env.VITE_PUBLIC, "mascot.png"),
    webPreferences: {
      preload: H.join(Lt, "preload.mjs"),
      contextIsolation: !0,
      nodeIntegration: !1
    },
    show: !1
  }), Bt.setApplicationMenu(null), ue.maximize(), ue.show(), Ve ? ue.loadURL(Ve) : ue.loadFile(H.join(Ut, "index.html"));
}
function Ns() {
  const e = (process.env.SEED_ADMIN_ENABLED ?? "false").toLowerCase() === "true", a = process.env.SEED_ADMIN_USERNAME ?? "admin", r = process.env.SEED_ADMIN_NAME ?? "Administrador", l = process.env.SEED_ADMIN_PASSWORD ?? "", m = Number(process.env.BCRYPT_ROUNDS ?? "10");
  if (e && l.trim().length < 8)
    throw new Error("SEED_ADMIN_PASSWORD es obligatorio y debe tener minimo 8 caracteres.");
  if (!Number.isFinite(m) || m < 8 || m > 15)
    throw new Error("BCRYPT_ROUNDS invalido. Usa un valor entre 8 y 15.");
  return { enabled: e, username: a, name: r, password: l, bcryptRounds: m };
}
async function Cs(e) {
  const a = Ns();
  if (!a.enabled || await e.user.findFirst({ where: { role: F.ADMIN } }))
    return;
  const l = await ce.hash(a.password, a.bcryptRounds);
  await e.user.create({
    data: {
      username: a.username,
      name: a.name,
      role: F.ADMIN,
      passwordHash: l,
      isActive: !0
    }
  });
}
async function hs(e) {
  await e.businessSettings.upsert({
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
  }), await e.cashRegister.upsert({
    where: { name: "Caja principal" },
    update: {},
    create: {
      name: "Caja principal",
      branchName: "Tienda principal",
      isActive: !0
    }
  });
}
async function we(e) {
  try {
    await R.loginEvent.create({
      data: {
        userId: e.userId ?? null,
        username: e.username,
        success: e.success,
        reason: e.reason,
        occurredAt: /* @__PURE__ */ new Date(),
        appVersion: te.getVersion(),
        osPlatform: Pe.platform(),
        osRelease: Pe.release(),
        deviceName: Pe.hostname()
      }
    });
  } catch (a) {
    console.error("Error registrando login:", a);
  }
}
function Ie(e) {
  return Math.round(e);
}
function vs(e) {
  const a = /* @__PURE__ */ new Date();
  if (e === "day")
    return new Date(a.getFullYear(), a.getMonth(), a.getDate());
  if (e === "week") {
    const r = new Date(a), l = r.getDay(), m = l === 0 ? 6 : l - 1;
    return r.setDate(r.getDate() - m), r.setHours(0, 0, 0, 0), r;
  }
  return new Date(a.getFullYear(), a.getMonth(), 1);
}
function bs(e, a) {
  return `${e}-${String(a).padStart(6, "0")}`;
}
function J(e) {
  const a = e == null ? void 0 : e.trim();
  return a || null;
}
function Ye(e, a) {
  return [e.trim(), a.trim()].filter(Boolean).join(" ");
}
function mt(e) {
  return e.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}
function Ss(e, a, r) {
  const l = mt(e).slice(0, 3).padEnd(3, "x"), m = mt(a).slice(0, 3).padEnd(3, "x"), n = r.replace(/\D/g, "").slice(-3).padStart(3, "0");
  return `${l}${m}${n}`;
}
async function _t(e) {
  const a = Ss(e.firstName, e.lastName, e.documentNumber);
  let r = 0, l = a, m = !0;
  for (; m; ) {
    const c = r === 0 ? "" : String(r + 1).padStart(2, "0");
    l = `${a}${c}`, m = !!await e.prismaClient.user.findFirst({
      where: {
        username: l,
        ...e.excludeUserId ? { NOT: { id: e.excludeUserId } } : {}
      },
      select: { id: !0 }
    }), r += 1;
  }
  return l;
}
function Je(e) {
  if (!e)
    return null;
  const [a, r, l] = e.split("-").map(Number);
  return !a || !r || !l ? null : new Date(Date.UTC(a, r - 1, l));
}
function pt(e) {
  return e === "ADMIN" ? F.ADMIN : F.EMPLOYEE;
}
function pe(e) {
  return `SYSTEM_${e}`;
}
function ae(e) {
  return e ? bt(x == null ? void 0 : x.permissions, e) : !0;
}
async function ws(e, a) {
  if (!a)
    return [];
  const r = await e.rolePermission.findMany({
    where: {
      roleProfileId: a,
      allowed: !0
    },
    select: { permissionKey: !0 },
    orderBy: { permissionKey: "asc" }
  });
  return Ne(r.map((l) => l.permissionKey));
}
async function Os(e, a) {
  var m, c, n, s;
  const r = await e.user.findUnique({
    where: { id: a },
    include: {
      roleProfile: {
        include: {
          permissions: {
            where: { allowed: !0 },
            orderBy: { permissionKey: "asc" }
          }
        }
      }
    }
  });
  if (!r)
    return null;
  const l = Ne(
    ((m = r.roleProfile) == null ? void 0 : m.permissions.map((t) => t.permissionKey)) ?? ((c = await e.roleProfile.findUnique({
      where: { key: pe(r.role) },
      include: {
        permissions: {
          where: { allowed: !0 },
          orderBy: { permissionKey: "asc" }
        }
      }
    })) == null ? void 0 : c.permissions.map((t) => t.permissionKey)) ?? []
  );
  return {
    roleProfileId: ((n = r.roleProfile) == null ? void 0 : n.id) ?? null,
    roleProfileName: ((s = r.roleProfile) == null ? void 0 : s.name) ?? null,
    permissions: l
  };
}
async function Rs(e) {
  const a = await e.$queryRawUnsafe('PRAGMA table_info("User");'), r = new Set(a.map((n) => n.name)), l = [];
  r.has("firstName") || l.push('ALTER TABLE "User" ADD COLUMN "firstName" TEXT;'), r.has("lastName") || l.push('ALTER TABLE "User" ADD COLUMN "lastName" TEXT;'), r.has("documentNumber") || l.push('ALTER TABLE "User" ADD COLUMN "documentNumber" TEXT;'), r.has("email") || l.push('ALTER TABLE "User" ADD COLUMN "email" TEXT;'), r.has("phone") || l.push('ALTER TABLE "User" ADD COLUMN "phone" TEXT;'), r.has("address") || l.push('ALTER TABLE "User" ADD COLUMN "address" TEXT;'), r.has("birthDate") || l.push('ALTER TABLE "User" ADD COLUMN "birthDate" DATETIME;'), r.has("internalCode") || l.push('ALTER TABLE "User" ADD COLUMN "internalCode" TEXT;');
  for (const n of l)
    await e.$executeRawUnsafe(n);
  await e.$executeRawUnsafe(`
    UPDATE "User"
    SET "firstName" = "name"
    WHERE "name" IS NOT NULL
      AND ("firstName" IS NULL OR TRIM("firstName") = '');
  `), await e.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "User_documentNumber_key" ON "User"("documentNumber");'
  );
  const m = await e.user.findMany({
    select: {
      id: !0,
      internalCode: !0
    },
    orderBy: [{ createdAt: "asc" }, { username: "asc" }]
  }), c = [];
  for (const n of m) {
    const s = Z({
      desiredCode: n.internalCode,
      existingCodes: c,
      prefix: "USR",
      digits: 4,
      maxLength: 30
    });
    s !== n.internalCode && await e.user.update({
      where: { id: n.id },
      data: { internalCode: s }
    }), c.push(s);
  }
  await e.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "User_internalCode_key" ON "User"("internalCode");'
  );
}
async function Ds(e) {
  await e.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "NotificationRead" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "readKey" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "NotificationRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `), await e.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "NotificationRead_userId_readKey_key"
    ON "NotificationRead"("userId", "readKey");
  `), await e.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "NotificationRead_userId_idx"
    ON "NotificationRead"("userId");
  `);
}
async function xs(e) {
  const a = await e.$queryRawUnsafe('PRAGMA table_info("Product");');
  new Set(a.map((l) => l.name)).has("unitMeasure") || await e.$executeRawUnsafe(
    `ALTER TABLE "Product" ADD COLUMN "unitMeasure" TEXT NOT NULL DEFAULT 'UNIDAD';`
  ), await e.$executeRawUnsafe(`
    UPDATE "Product"
    SET "unitMeasure" = 'UNIDAD'
    WHERE "unitMeasure" IS NULL OR TRIM("unitMeasure") = '';
  `);
}
async function Ps(e) {
  await e.$executeRawUnsafe(`
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
  `), await e.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "RoleProfile_key_key" ON "RoleProfile"("key");
  `), await e.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "RoleProfile_name_key" ON "RoleProfile"("name");
  `), await e.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RolePermission" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "roleProfileId" TEXT NOT NULL,
      "permissionKey" TEXT NOT NULL,
      "allowed" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "RolePermission_roleProfileId_fkey" FOREIGN KEY ("roleProfileId") REFERENCES "RoleProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `), await e.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "RolePermission_roleProfileId_permissionKey_key"
    ON "RolePermission"("roleProfileId", "permissionKey");
  `), await e.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "RolePermission_roleProfileId_idx"
    ON "RolePermission"("roleProfileId");
  `);
  const a = await e.$queryRawUnsafe('PRAGMA table_info("User");');
  new Set(a.map((l) => l.name)).has("roleProfileId") || await e.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "roleProfileId" TEXT;'), await e.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "User_roleProfileId_idx"
    ON "User"("roleProfileId");
  `);
}
async function Ls(e) {
  for (const r of De) {
    const l = Nt(r), m = await e.roleProfile.findUnique({
      where: { key: pe(r.key) },
      select: { id: !0 }
    }), c = m ? await e.roleProfile.update({
      where: { id: m.id },
      data: {
        name: r.name,
        description: r.description,
        baseRole: pt(r.key),
        isSystem: !0
      }
    }) : await e.roleProfile.create({
      data: {
        key: pe(r.key),
        name: r.name,
        description: r.description,
        baseRole: pt(r.key),
        isSystem: !0,
        isActive: !0
      }
    }), n = await e.rolePermission.findMany({
      where: {
        roleProfileId: c.id,
        allowed: !0
      },
      select: {
        permissionKey: !0
      }
    }), s = new Set(n.map((i) => i.permissionKey)), t = l.filter(
      (i) => !s.has(i.key)
    );
    t.length > 0 && await e.rolePermission.createMany({
      data: t.map((i) => ({
        roleProfileId: c.id,
        permissionKey: i.key,
        allowed: !0
      }))
    });
  }
  const a = await e.roleProfile.findMany({
    where: { key: { in: De.map((r) => pe(r.key)) } },
    select: { id: !0, baseRole: !0 }
  });
  for (const r of a)
    await e.user.updateMany({
      where: {
        role: r.baseRole,
        roleProfileId: null
      },
      data: {
        roleProfileId: r.id
      }
    });
}
async function Us() {
  await ba(R), await hs(R), await Sa(R), Da({
    app: te,
    ipcMain: X,
    prisma: R,
    getCurrentSessionUser: () => x
  });
}
te.whenReady().then(async () => {
  const e = H.join(te.getPath("userData"), "app.db").replace(/\\/g, "/");
  process.env.DATABASE_URL = `file:${e}`, R = new kt(), lt = /* @__PURE__ */ new Date(), await Rs(R), await Ds(R), await Ps(R), await Es(R), await Cs(R), await Ls(R), await xs(R), ys({
    ipcMain: X,
    prisma: R,
    getCurrentSessionUser: () => x,
    getConnectedAt: () => lt
  }), await Us(), Mt();
}).catch((e) => {
  console.error("No se pudo inicializar la aplicacion POS.", e), te.quit();
});
te.on("activate", () => {
  qe.getAllWindows().length === 0 && Mt();
});
X.handle("auth:login", async (e, a) => {
  const r = jt.safeParse(a);
  if (!r.success)
    return await we({
      username: String((a == null ? void 0 : a.username) ?? ""),
      success: !1,
      reason: "invalid_payload"
    }), { success: !1, message: "Datos invalidos" };
  const { username: l, password: m } = r.data, c = await R.user.findUnique({
    where: { username: l }
  });
  if (!c || !c.isActive)
    return await we({
      username: l,
      success: !1,
      reason: "user_not_found_or_inactive"
    }), { success: !1, message: "Usuario o contrasena incorrectos" };
  if (!await ce.compare(m, c.passwordHash))
    return await we({
      userId: c.id,
      username: l,
      success: !1,
      reason: "wrong_password"
    }), { success: !1, message: "Usuario o contrasena incorrectos" };
  await we({
    userId: c.id,
    username: l,
    success: !0
  });
  const s = await Os(R, c.id);
  return x = {
    id: c.id,
    username: c.username,
    name: c.name ?? void 0,
    role: c.role,
    roleProfileId: (s == null ? void 0 : s.roleProfileId) ?? null,
    roleProfileName: (s == null ? void 0 : s.roleProfileName) ?? null,
    permissions: (s == null ? void 0 : s.permissions) ?? []
  }, {
    success: !0,
    user: x
  };
});
X.handle("auth:createUser", async (e, a) => {
  const r = zt.safeParse(a);
  if (!r.success)
    return { success: !1, message: "Datos invalidos" };
  if (!x || x.role !== F.ADMIN)
    return { success: !1, message: "Solo admins pueden crear usuarios" };
  if (!ae(E.usersCreate))
    return { success: !1, message: "Tu rol no puede crear usuarios" };
  const {
    internalCode: l,
    firstName: m,
    lastName: c,
    documentNumber: n,
    email: s,
    phone: t,
    address: i,
    birthDate: u,
    newPassword: f,
    roleProfileId: g,
    isActive: T
  } = r.data, I = await ce.hash(f, 10), p = Ye(m, c);
  try {
    if (await R.user.findFirst({
      where: { documentNumber: n },
      select: { id: !0 }
    }))
      return { success: !1, message: "La cedula ya esta registrada para otro usuario" };
    const C = g ? await R.roleProfile.findUnique({
      where: { id: g },
      select: { id: !0, baseRole: !0, isActive: !0 }
    }) : await R.roleProfile.findUnique({
      where: { key: pe("EMPLOYEE") },
      select: { id: !0, baseRole: !0, isActive: !0 }
    });
    if (!C || !C.isActive)
      return { success: !1, message: "El perfil de rol seleccionado no esta disponible" };
    const h = await _t({
      prismaClient: R,
      firstName: m,
      lastName: c,
      documentNumber: n
    }), v = (await R.user.findMany({
      select: { internalCode: !0 }
    })).map((P) => P.internalCode), D = Z({
      desiredCode: l,
      existingCodes: v,
      prefix: "USR",
      digits: 4,
      maxLength: 30
    });
    return await R.user.create({
      data: {
        internalCode: D,
        username: h,
        firstName: m.trim(),
        lastName: c.trim(),
        name: p,
        documentNumber: n,
        email: J(s),
        phone: J(t),
        address: J(i),
        birthDate: Je(u),
        passwordHash: I,
        role: C.baseRole,
        roleProfileId: C.id,
        isActive: T ?? !0
      }
    }), { success: !0, username: h };
  } catch (N) {
    return { success: !1, message: N instanceof Error ? N.message : "No se pudo crear el usuario" };
  }
});
X.handle("users:update", async (e, a) => {
  const r = Gt.safeParse(a);
  if (!r.success)
    return { success: !1, message: "Datos invalidos" };
  if (!x || x.role !== F.ADMIN)
    return { success: !1, message: "Solo admins pueden editar usuarios" };
  if (!ae(E.usersEdit))
    return { success: !1, message: "Tu rol no puede editar usuarios" };
  const {
    id: l,
    internalCode: m,
    firstName: c,
    lastName: n,
    documentNumber: s,
    email: t,
    phone: i,
    address: u,
    birthDate: f,
    newPassword: g,
    roleProfileId: T,
    isActive: I
  } = r.data, p = await R.user.findUnique({
    where: { id: l },
    select: { id: !0, role: !0, isActive: !0, roleProfileId: !0, internalCode: !0 }
  });
  if (!p)
    return { success: !1, message: "El usuario ya no existe" };
  if (await R.user.findFirst({
    where: {
      documentNumber: s,
      NOT: { id: l }
    },
    select: { id: !0 }
  }))
    return { success: !1, message: "La cedula ya esta registrada para otro usuario" };
  const C = T ? await R.roleProfile.findUnique({
    where: { id: T },
    select: { id: !0, baseRole: !0, isActive: !0, name: !0 }
  }) : await R.roleProfile.findUnique({
    where: { key: pe(p.role ?? "EMPLOYEE") },
    select: { id: !0, baseRole: !0, isActive: !0, name: !0 }
  });
  if (!C || !C.isActive)
    return { success: !1, message: "El perfil de rol seleccionado no esta disponible" };
  if (p.role === F.ADMIN && (C.baseRole !== F.ADMIN || !I) && await R.user.count({
    where: {
      role: F.ADMIN,
      isActive: !0,
      NOT: { id: l }
    }
  }) === 0)
    return { success: !1, message: "Debe existir al menos un administrador activo" };
  const h = await _t({
    prismaClient: R,
    firstName: c,
    lastName: n,
    documentNumber: s,
    excludeUserId: l
  }), v = Ye(c, n);
  try {
    const D = (await R.user.findMany({
      where: { NOT: { id: l } },
      select: { internalCode: !0 }
    })).map((b) => b.internalCode), P = Z({
      desiredCode: m,
      existingCodes: D,
      prefix: "USR",
      digits: 4,
      maxLength: 30
    });
    return await R.user.update({
      where: { id: l },
      data: {
        internalCode: P,
        username: h,
        firstName: c.trim(),
        lastName: n.trim(),
        name: v,
        documentNumber: s,
        email: J(t),
        phone: J(i),
        address: J(u),
        birthDate: Je(f),
        role: C.baseRole,
        roleProfileId: C.id,
        isActive: I,
        ...g != null && g.trim() ? {
          passwordHash: await ce.hash(g, 10)
        } : {}
      }
    }), x.id === l && (x = {
      ...x,
      username: h,
      name: v,
      role: C.baseRole,
      roleProfileId: C.id,
      roleProfileName: C.name,
      permissions: await ws(R, C.id)
    }), { success: !0, username: h };
  } catch (D) {
    return { success: !1, message: D instanceof Error ? D.message : "No se pudo actualizar el usuario" };
  }
});
X.handle("auth:get-profile", async () => {
  var a;
  if (!x)
    return { success: !1, message: "Debes iniciar sesion" };
  const e = await R.user.findUnique({
    where: { id: x.id },
    select: {
      id: !0,
      username: !0,
      name: !0,
      firstName: !0,
      lastName: !0,
      email: !0,
      phone: !0,
      birthDate: !0,
      role: !0
    }
  });
  return e ? {
    success: !0,
    profile: {
      ...e,
      birthDate: ((a = e.birthDate) == null ? void 0 : a.toISOString().slice(0, 10)) ?? null
    }
  } : { success: !1, message: "Tu usuario ya no existe" };
});
X.handle("auth:update-profile", async (e, a) => {
  var u;
  const r = Ht.safeParse(a);
  if (!r.success)
    return { success: !1, message: "Datos invalidos" };
  if (!x)
    return { success: !1, message: "Debes iniciar sesion" };
  const { firstName: l, lastName: m, email: c, phone: n, birthDate: s } = r.data, t = Ye(l, m), i = await R.user.update({
    where: { id: x.id },
    data: {
      firstName: l.trim(),
      lastName: m.trim(),
      name: t,
      email: J(c),
      phone: J(n),
      birthDate: Je(s)
    },
    select: {
      id: !0,
      username: !0,
      name: !0,
      firstName: !0,
      lastName: !0,
      email: !0,
      phone: !0,
      birthDate: !0,
      role: !0
    }
  });
  return x = {
    ...x,
    name: t
  }, {
    success: !0,
    user: x,
    profile: {
      ...i,
      birthDate: ((u = i.birthDate) == null ? void 0 : u.toISOString().slice(0, 10)) ?? null
    }
  };
});
X.handle("auth:change-password", async (e, a) => {
  const r = Yt.safeParse(a);
  if (!r.success)
    return { success: !1, message: "Datos invalidos" };
  if (!x)
    return { success: !1, message: "Debes iniciar sesion" };
  const { currentPassword: l, newPassword: m, confirmPassword: c } = r.data;
  if (m !== c)
    return { success: !1, message: "La confirmacion no coincide con la nueva contrasena" };
  const n = await R.user.findUnique({
    where: { id: x.id },
    select: { id: !0, passwordHash: !0 }
  });
  return n ? await ce.compare(l, n.passwordHash) ? await ce.compare(m, n.passwordHash) ? { success: !1, message: "La nueva contrasena debe ser diferente a la anterior" } : (await R.user.update({
    where: { id: n.id },
    data: {
      passwordHash: await ce.hash(m, 10)
    }
  }), { success: !0 }) : { success: !1, message: "La contrasena actual es incorrecta" } : { success: !1, message: "Tu usuario ya no existe" };
});
X.handle("notifications:get-read", async () => x ? {
  success: !0,
  readKeys: (await R.notificationRead.findMany({
    where: { userId: x.id },
    select: { readKey: !0 },
    orderBy: { createdAt: "desc" }
  })).map((a) => a.readKey)
} : { success: !1, message: "Debes iniciar sesion", readKeys: [] });
X.handle("notifications:mark-read", async (e, a) => {
  if (!x)
    return { success: !1, message: "Debes iniciar sesion" };
  const r = Array.isArray(a == null ? void 0 : a.readKeys) ? a.readKeys.filter((l) => typeof l == "string" && l.trim().length > 0) : [];
  return r.length === 0 ? { success: !0 } : (await Promise.all(
    r.map(
      (l) => R.notificationRead.upsert({
        where: {
          userId_readKey: {
            userId: x.id,
            readKey: l
          }
        },
        update: {},
        create: {
          userId: x.id,
          readKey: l
        }
      })
    )
  ), { success: !0 });
});
X.handle("roles:list", async () => !x || x.role !== F.ADMIN ? { success: !1, message: "Solo admins pueden ver roles", roles: [] } : ae(E.rolesView) ? {
  success: !0,
  roles: (await R.roleProfile.findMany({
    include: {
      permissions: {
        where: { allowed: !0 },
        orderBy: { permissionKey: "asc" },
        select: { permissionKey: !0 }
      },
      _count: {
        select: { users: !0 }
      }
    },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }]
  })).map((a) => ({
    id: a.id,
    key: a.key,
    name: a.name,
    description: a.description,
    baseRole: a.baseRole,
    isSystem: a.isSystem,
    isActive: a.isActive,
    permissionKeys: Ne(
      a.permissions.map((r) => r.permissionKey)
    ),
    usersCount: a._count.users,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString()
  }))
} : { success: !1, message: "Tu rol no puede ver roles", roles: [] });
X.handle("roles:create", async (e, a) => {
  const r = Jt.safeParse(a);
  if (!r.success)
    return { success: !1, message: "Datos invalidos para el rol" };
  const l = Ne(r.data.permissionKeys);
  if (!x || x.role !== F.ADMIN)
    return { success: !1, message: "Solo admins pueden crear roles" };
  if (!ae(E.rolesManage))
    return { success: !1, message: "Tu rol no puede crear roles" };
  if (l.length > 0 && l.find(
    (c) => !Ct(r.data.baseRole, c)
  ))
    return { success: !1, message: "Uno o mas permisos no pertenecen al rol base seleccionado" };
  try {
    return { success: !0, roleId: (await R.roleProfile.create({
      data: {
        name: r.data.name.trim(),
        description: J(r.data.description),
        baseRole: r.data.baseRole,
        isSystem: !1,
        isActive: r.data.isActive ?? !0,
        permissions: {
          create: l.map((c) => ({
            permissionKey: c,
            allowed: !0
          }))
        }
      },
      select: { id: !0 }
    })).id };
  } catch (m) {
    return { success: !1, message: m instanceof Error ? m.message : "No se pudo crear el rol" };
  }
});
X.handle("roles:update", async (e, a) => {
  const r = Wt.safeParse(a);
  if (!r.success)
    return { success: !1, message: "Datos invalidos para el rol" };
  const l = Ne(r.data.permissionKeys);
  if (!x || x.role !== F.ADMIN)
    return { success: !1, message: "Solo admins pueden editar roles" };
  if (!ae(E.rolesManage))
    return { success: !1, message: "Tu rol no puede editar roles" };
  const m = await R.roleProfile.findUnique({
    where: { id: r.data.id },
    select: { id: !0, baseRole: !0, isSystem: !0, name: !0 }
  });
  if (!m)
    return { success: !1, message: "El rol ya no existe" };
  if (l.find(
    (n) => !Ct(m.baseRole, n)
  ))
    return { success: !1, message: "Uno o mas permisos no pertenecen al rol base seleccionado" };
  try {
    return await R.$transaction(async (n) => {
      await n.roleProfile.update({
        where: { id: r.data.id },
        data: {
          name: r.data.name.trim(),
          description: J(r.data.description),
          isActive: r.data.isActive ?? !0
        }
      }), await n.rolePermission.deleteMany({ where: { roleProfileId: r.data.id } }), await n.rolePermission.createMany({
        data: l.map((s) => ({
          roleProfileId: r.data.id,
          permissionKey: s,
          allowed: !0
        }))
      });
    }), x.roleProfileId === r.data.id && (x = {
      ...x,
      roleProfileName: r.data.name.trim(),
      permissions: l
    }), { success: !0, roleId: r.data.id };
  } catch (n) {
    return { success: !1, message: n instanceof Error ? n.message : "No se pudo actualizar el rol" };
  }
});
X.handle("roles:delete", async (e, a) => {
  const r = Qt.safeParse(a);
  if (!r.success)
    return { success: !1, message: "Datos invalidos para el rol" };
  if (!x || x.role !== F.ADMIN)
    return { success: !1, message: "Solo admins pueden eliminar roles" };
  if (!ae(E.rolesManage))
    return { success: !1, message: "Tu rol no puede eliminar roles" };
  const l = await R.roleProfile.findUnique({
    where: { id: r.data.id },
    include: {
      _count: {
        select: {
          users: !0
        }
      }
    }
  });
  return l ? l.isSystem ? { success: !1, message: "Los roles del sistema no se pueden eliminar" } : l._count.users > 0 ? { success: !1, message: "Reasigna los usuarios del rol antes de eliminarlo" } : (await R.roleProfile.delete({
    where: { id: r.data.id }
  }), { success: !0, roleId: r.data.id }) : { success: !1, message: "El rol ya no existe" };
});
X.handle("auth:logout", async () => (x = null, { success: !0 }));
X.handle("products:list", async () => (await R.product.findMany({
  where: { isActive: !0, stock: { gt: 0 } },
  include: {
    category: !0,
    subcategory: !0
  },
  orderBy: { name: "asc" }
})).map((a) => {
  var r, l;
  return {
    id: a.id,
    name: a.name,
    sku: a.sku,
    barcode: a.barcode,
    price: a.price,
    cost: a.cost,
    taxRate: a.taxRate,
    stock: a.stock,
    category: ((r = a.category) == null ? void 0 : r.name) ?? null,
    subcategory: ((l = a.subcategory) == null ? void 0 : l.name) ?? null
  };
}));
X.handle("sales:create", async (e, a) => {
  var d, A, S;
  if (!x)
    return { success: !1, message: "Debes iniciar sesion para vender" };
  if (!ae(E.salesCreate))
    return { success: !1, message: "Tu rol no puede registrar ventas" };
  if (!ae(E.salesManagePayments))
    return { success: !1, message: "Tu rol no puede gestionar pagos" };
  const r = ta.safeParse(a);
  if (!r.success)
    return { success: !1, message: "Datos invalidos para la venta" };
  let l = null;
  if (r.data.customerId && (l = await R.customer.findFirst({
    where: {
      id: r.data.customerId,
      isActive: !0
    },
    select: {
      id: !0,
      name: !0
    }
  }), !l))
    return { success: !1, message: "El cliente seleccionado ya no esta disponible" };
  const m = (l == null ? void 0 : l.name) ?? ((d = r.data.customer) == null ? void 0 : d.trim()) ?? "Consumidor final";
  if (m !== "Consumidor final" && !ae(E.salesChangeCustomer))
    return { success: !1, message: "Tu rol no puede cambiar el cliente en la factura" };
  const c = r.data.items.map((y) => y.productId), n = await R.product.findMany({
    where: {
      id: { in: c },
      isActive: !0
    }
  });
  if (n.length !== c.length)
    return { success: !1, message: "Uno o mas productos ya no estan disponibles" };
  const s = new Map(n.map((y) => [y.id, y])), t = r.data.items.map((y) => {
    const w = s.get(y.productId);
    if (!w)
      throw new Error("Producto no encontrado");
    if (w.stock < y.qty)
      throw new Error(`Stock insuficiente para ${w.name}`);
    const $ = Ie(w.price * y.qty), U = Ie($ * w.taxRate), Y = $ + U, q = Ie((w.price - w.cost) * y.qty);
    return {
      product: w,
      qty: y.qty,
      lineSubtotal: $,
      lineTax: U,
      lineTotal: Y,
      lineProfit: q
    };
  }), i = t.reduce((y, w) => y + w.lineSubtotal, 0), u = t.reduce((y, w) => y + w.lineTax, 0), f = i + u, g = t.reduce((y, w) => y + w.product.cost * w.qty, 0), T = t.reduce((y, w) => y + w.lineProfit, 0), p = (r.data.payments && r.data.payments.length > 0 ? r.data.payments : [
    {
      method: r.data.paymentMethod,
      amount: r.data.amountPaid ?? f
    }
  ]).map((y) => ({
    method: y.method,
    amount: Ie(y.amount)
  })).filter((y) => y.amount > 0);
  if (p.length === 0 && !r.data.allowDebt)
    return { success: !1, message: "Debes registrar al menos un pago para completar la venta" };
  const N = p.reduce((y, w) => y + w.amount, 0), C = Math.max(0, N - f), h = p.filter((y) => y.method === "CASH").reduce((y, w) => y + w.amount, 0);
  if (C > h)
    return { success: !1, message: "Las vueltas solo pueden salir de un pago en efectivo" };
  let v = f;
  const D = /* @__PURE__ */ new Map();
  for (const y of p) {
    if (v <= 0)
      break;
    const w = Math.min(y.amount, v);
    w <= 0 || (D.set(
      y.method,
      (D.get(y.method) ?? 0) + w
    ), v -= w);
  }
  const P = ((A = [...D.entries()].sort((y, w) => w[1] - y[1])[0]) == null ? void 0 : A[0]) ?? ((S = p[0]) == null ? void 0 : S.method) ?? r.data.paymentMethod, b = D.get(j.CASH) ?? 0;
  if (r.data.clientTotal !== void 0 && Math.abs(r.data.clientTotal - f) > 1)
    return { success: !1, message: "El total enviado no coincide con el calculo del sistema" };
  if (N < f && !r.data.allowDebt)
    return { success: !1, message: "El pago recibido no alcanza para cubrir la venta" };
  try {
    const y = await R.$transaction(async (w) => {
      const $ = await w.sale.count() + 1, U = await w.businessSettings.findUnique({
        where: { id: "default" },
        select: { invoicePrefix: !0 }
      }), Y = bs((U == null ? void 0 : U.invoicePrefix) || "FV", $), q = await w.cashSession.findFirst({
        where: {
          userId: x.id,
          status: "OPEN"
        },
        orderBy: { openedAt: "desc" }
      }), k = await w.sale.create({
        data: {
          invoiceNumber: Y,
          customer: m,
          customerId: (l == null ? void 0 : l.id) ?? null,
          paymentMethod: P,
          subtotal: i,
          tax: u,
          total: f,
          costTotal: g,
          profit: T,
          cashierId: x.id,
          cashSessionId: (q == null ? void 0 : q.id) ?? null,
          items: {
            create: t.map((L) => ({
              productId: L.product.id,
              sku: L.product.sku,
              barcode: L.product.barcode,
              name: L.product.name,
              price: L.product.price,
              cost: L.product.cost,
              qty: L.qty,
              taxRate: L.product.taxRate,
              lineSubtotal: L.lineSubtotal,
              lineTax: L.lineTax,
              lineTotal: L.lineTotal,
              lineProfit: L.lineProfit
            }))
          },
          payments: {
            create: p.map((L) => ({
              method: L.method,
              amount: L.amount
            }))
          }
        }
      });
      q && b > 0 && await w.cashMovement.create({
        data: {
          sessionId: q.id,
          type: B.SALE_IN,
          amount: b,
          note: k.invoiceNumber
        }
      });
      for (const L of t)
        await w.product.update({
          where: { id: L.product.id },
          data: {
            stock: { decrement: L.qty }
          }
        }), await w.inventoryMovement.create({
          data: {
            productId: L.product.id,
            type: Te.SALE_OUT,
            qty: L.qty,
            stockBefore: L.product.stock,
            stockAfter: L.product.stock - L.qty,
            referenceType: "SALE",
            referenceId: k.id,
            note: k.invoiceNumber
          }
        });
      return k;
    });
    return {
      success: !0,
      saleId: y.id,
      invoiceNumber: y.invoiceNumber,
      total: f,
      amountPaid: N,
      changeAmount: C
    };
  } catch (y) {
    return { success: !1, message: y instanceof Error ? y.message : "No se pudo registrar la venta" };
  }
});
X.handle("dashboard:stats", async (e, a = "day") => {
  const r = ["day", "week", "month"].includes(a) ? a : "day", l = vs(r), m = await R.sale.findMany({
    where: { createdAt: { gte: l } },
    include: { items: !0 },
    orderBy: { createdAt: "desc" }
  }), c = m.reduce((T, I) => T + I.total, 0), n = m.reduce((T, I) => T + I.profit, 0), s = m.reduce((T, I) => T + I.tax, 0), t = m.length > 0 ? Ie(c / m.length) : 0, i = m.reduce((T, I) => (T[I.paymentMethod] = (T[I.paymentMethod] ?? 0) + I.total, T), {}), u = m.flatMap((T) => T.items).reduce((T, I) => {
    const p = T[I.name] ?? { name: I.name, qty: 0, total: 0 };
    return p.qty += I.qty, p.total += I.lineTotal, T[I.name] = p, T;
  }, {}), f = Object.values(u).sort((T, I) => I.qty - T.qty).slice(0, 5), g = await R.product.findMany({
    where: { isActive: !0 },
    orderBy: [{ stock: "asc" }, { name: "asc" }],
    take: 5,
    select: {
      id: !0,
      name: !0,
      stock: !0,
      sku: !0
    }
  });
  return {
    range: r,
    totals: {
      salesCount: m.length,
      revenue: c,
      profit: n,
      tax: s,
      averageTicket: t
    },
    paymentSummary: [
      { label: "Efectivo", value: i.CASH ?? 0 },
      { label: "Transferencia", value: (i.CARD ?? 0) + (i.TRANSFER ?? 0) }
    ],
    topProducts: f,
    recentSales: m.slice(0, 6).map((T) => ({
      id: T.id,
      invoiceNumber: T.invoiceNumber,
      customer: T.customer,
      total: T.total,
      createdAt: T.createdAt.toISOString(),
      itemsCount: T.items.length
    })),
    lowStock: g
  };
});
te.on("window-all-closed", () => {
  process.platform !== "darwin" && (te.quit(), ue = null);
});
te.on("quit", async () => {
  await (R == null ? void 0 : R.$disconnect());
});
export {
  zs as MAIN_DIST,
  Ut as RENDERER_DIST,
  Ve as VITE_DEV_SERVER_URL,
  Cs as seedAdminIfNeeded
};
