import { BrowserWindow as Ge, app as se, ipcMain as X, Menu as sa } from "electron";
import ue from "bcryptjs";
import "dotenv/config";
import { createHash as wt, randomUUID as ra } from "node:crypto";
import { mkdir as na, writeFile as oa, readdir as ia, readFile as ca } from "node:fs/promises";
import _e from "node:os";
import G from "node:path";
import { fileURLToPath as da } from "node:url";
import { CorrespondentDirection as F, CommissionMode as Pe, CorrespondentTransactionStatus as ie, CorrespondentReconciliationStatus as ua, CorrespondentOcrStatus as Me, Role as q, CorrespondentClosureStatus as it, SaleStatus as fe, CashSessionStatus as Z, PaymentMethod as z, CashMovementType as k, InventoryMovementType as Ne, PurchaseStatus as ct, CreditStatus as Te, PrismaClient as la } from "@prisma/client";
import { z as n } from "zod";
const Ke = n.enum(["ADMIN", "EMPLOYEE"]), ma = n.object({
  username: n.string().trim().min(1).max(50),
  password: n.string().min(1).max(200)
});
n.object({
  success: n.boolean(),
  message: n.string().optional(),
  user: n.object({
    id: n.string(),
    username: n.string(),
    role: Ke,
    name: n.string().optional(),
    roleProfileId: n.string().nullable().optional(),
    roleProfileName: n.string().nullable().optional(),
    permissions: n.array(n.string()).optional()
  }).optional()
});
const He = n.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(), Ye = n.string().trim().regex(/^\d{10}$/).optional().nullable(), Rt = n.object({
  internalCode: n.string().trim().max(30).optional().nullable(),
  firstName: n.string().trim().min(2).max(80),
  lastName: n.string().trim().min(2).max(80),
  documentNumber: n.string().trim().regex(/^\d{6,20}$/),
  email: n.string().trim().email().max(120).optional().nullable(),
  phone: Ye,
  address: n.string().trim().max(180).optional().nullable(),
  birthDate: He,
  roleProfileId: n.string().uuid().optional().nullable(),
  isActive: n.boolean().optional().default(!0)
}), pa = Rt.extend({
  newPassword: n.string().min(6).max(200)
}), fa = Rt.extend({
  id: n.string().uuid(),
  newPassword: n.string().min(6).max(200).optional().or(n.literal(""))
}), ga = n.object({
  id: n.string(),
  username: n.string(),
  name: n.string().optional().nullable(),
  firstName: n.string().optional().nullable(),
  lastName: n.string().optional().nullable(),
  email: n.string().trim().email().max(120).optional().nullable(),
  phone: Ye,
  birthDate: He,
  role: Ke
});
n.object({
  success: n.boolean(),
  message: n.string().optional(),
  profile: ga.optional()
});
const Ea = n.object({
  firstName: n.string().trim().min(2).max(80),
  lastName: n.string().trim().min(2).max(80),
  email: n.string().trim().email().max(120).optional().nullable(),
  phone: Ye,
  birthDate: He
}), Ta = n.object({
  currentPassword: n.string().min(1).max(200),
  newPassword: n.string().min(6).max(200),
  confirmPassword: n.string().min(6).max(200)
}), Aa = n.object({
  name: n.string().trim().min(3, "Minimo 3 caracteres").max(80, "Maximo 80 caracteres"),
  description: n.string().trim().max(240).optional().nullable(),
  baseRole: Ke.default("EMPLOYEE"),
  permissionKeys: n.array(n.string().trim().min(1)).min(1, "Debes seleccionar al menos un permiso"),
  isActive: n.boolean().optional().default(!0)
}), ya = n.object({
  id: n.string().uuid("ID de rol invalido"),
  name: n.string().trim().min(3, "Minimo 3 caracteres").max(80, "Maximo 80 caracteres"),
  description: n.string().trim().max(240).optional().nullable(),
  permissionKeys: n.array(n.string().trim().min(1)).min(1, "Debes seleccionar al menos un permiso"),
  isActive: n.boolean().optional().default(!0)
}), Ia = n.object({
  id: n.string().uuid("ID de rol invalido")
}), Je = n.enum(["CASH", "CARD", "TRANSFER"]), Na = n.object({
  sheetTypeId: n.string().trim().min(1, "Debes seleccionar el tipo de hoja"),
  specialRuleId: n.string().trim().min(1, "La tarifa especial seleccionada no es valida").optional().nullable(),
  manualUnitPrice: n.number().positive("El precio manual debe ser mayor a 0").optional().nullable()
}), ha = n.object({
  method: Je,
  amount: n.number().min(0, "El monto del pago no puede ser negativo")
}), Ca = n.object({
  productId: n.string().uuid("productId invalido"),
  qty: n.number().int("La cantidad debe ser entera").positive("La cantidad debe ser mayor a 0"),
  pricingContext: Na.optional()
}), ba = n.object({
  customer: n.string().trim().max(120).optional().default("Consumidor final"),
  customerId: n.string().uuid("customerId invalido").optional().nullable(),
  paymentMethod: Je.optional().default("CASH"),
  amountPaid: n.number().min(0).optional(),
  payments: n.array(ha).min(1, "Debes registrar al menos un pago").optional(),
  items: n.array(Ca).min(1, "La venta debe tener al menos un item"),
  clientTotal: n.number().min(0).optional(),
  allowDebt: n.boolean().optional().default(!1)
});
n.discriminatedUnion("success", [
  n.object({
    success: n.literal(!0),
    saleId: n.string().uuid(),
    invoiceNumber: n.string(),
    total: n.number(),
    amountPaid: n.number(),
    changeAmount: n.number()
  }),
  n.object({
    success: n.literal(!1),
    message: n.string()
  })
]);
const va = n.enum(["REGISTERED", "VOIDED"]), Sa = n.enum(["MANUAL", "IMAGE", "FILE_IMPORT", "API"]), Ot = n.enum(["IN", "OUT"]), wa = n.object({
  fileName: n.string().trim().min(1).max(180),
  mimeType: n.string().trim().max(120).optional(),
  dataBase64: n.string().min(1),
  ocrRawText: n.string().trim().max(1e4).optional()
}), Ra = n.object({
  platformId: n.string().uuid("platformId invalido"),
  typeId: n.string().uuid("typeId invalido"),
  approvalCode: n.string().trim().min(4, "Ingresa el numero de aprobacion o ID interno").max(40).optional().nullable(),
  amount: n.number().int("El valor debe ser entero").positive("El valor debe ser mayor a 0"),
  commissionAmount: n.number().int("La comision debe ser entera").min(0).optional(),
  externalReference: n.string().trim().max(120).optional().nullable(),
  customerName: n.string().trim().max(120).optional().nullable(),
  customerDocument: n.string().trim().max(40).optional().nullable(),
  targetAccount: n.string().trim().max(60).optional().nullable(),
  targetPhone: n.string().trim().max(30).optional().nullable(),
  performedAt: n.string().datetime("Fecha de operacion invalida"),
  note: n.string().trim().max(300).optional().nullable(),
  rawExtractedText: n.string().trim().max(1e4).optional().nullable(),
  source: Sa.optional().default("MANUAL"),
  evidence: wa.optional()
}), Oa = n.object({
  transactionId: n.string().uuid("transactionId invalido"),
  typeId: n.string().uuid("typeId invalido"),
  approvalCode: n.string().trim().min(4, "Ingresa el numero de aprobacion o ID interno").max(40).optional().nullable(),
  amount: n.number().int("El valor debe ser entero").positive("El valor debe ser mayor a 0"),
  performedAt: n.string().datetime("Fecha de operacion invalida")
}), Da = n.object({
  transactionId: n.string().uuid("transactionId invalido")
}), Pa = n.object({
  dateFrom: n.string().datetime().optional(),
  dateTo: n.string().datetime().optional(),
  platformId: n.string().uuid().optional(),
  userId: n.string().uuid().optional(),
  status: va.optional(),
  search: n.string().trim().max(80).optional()
}).optional().default({}), xa = n.object({
  businessDate: n.string().datetime().optional(),
  dateFrom: n.string().datetime().optional(),
  dateTo: n.string().datetime().optional()
}).refine(
  (e) => !e.dateFrom || !e.dateTo || new Date(e.dateFrom).getTime() <= new Date(e.dateTo).getTime(),
  {
    message: "El rango de fechas es invalido",
    path: ["dateTo"]
  }
).optional().default({}), La = n.object({
  platformId: n.string().uuid("platformId invalido"),
  businessDate: n.string().datetime("Fecha de cierre invalida"),
  openingBalance: n.number().int("El saldo base debe ser entero").optional().default(0),
  reportedBalance: n.number().int("El valor reportado debe ser entero"),
  note: n.string().trim().max(300).optional().nullable()
}), Ua = n.object({
  name: n.string().trim().min(2, "El nombre es obligatorio").max(80, "Nombre demasiado largo"),
  requiresEvidence: n.boolean().optional().default(!1),
  supportsOcr: n.boolean().optional().default(!1),
  supportsFileImport: n.boolean().optional().default(!1)
}), _a = n.object({
  platformId: n.string().uuid("platformId invalido"),
  name: n.string().trim().min(2, "El nombre es obligatorio").max(80, "Nombre demasiado largo"),
  direction: Ot.default("IN")
}), Ma = n.object({
  platformId: n.string().uuid("platformId invalido"),
  name: n.string().trim().min(2, "El nombre es obligatorio").max(80, "Nombre demasiado largo"),
  requiresEvidence: n.boolean().optional().default(!1),
  supportsOcr: n.boolean().optional().default(!1),
  supportsFileImport: n.boolean().optional().default(!1)
}), Ba = n.object({
  typeId: n.string().uuid("typeId invalido"),
  name: n.string().trim().min(2, "El nombre es obligatorio").max(80, "Nombre demasiado largo"),
  direction: Ot.default("IN")
}), Fa = n.object({
  platformId: n.string().uuid("platformId invalido")
}), ka = n.object({
  typeId: n.string().uuid("typeId invalido")
}), $a = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
function qa(e) {
  return e.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function oe(e) {
  return qa(e).toUpperCase().replace(/[_\s]+/g, "-").replace(/[^A-Z0-9-]/g, "").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}
function Xa(e, a) {
  const r = oe(a), u = oe(e);
  if (!u)
    return `${r}-`;
  if (u === r)
    return `${r}-`;
  if (u.startsWith(`${r}-`))
    return u;
  const m = u.startsWith(r) ? u.slice(r.length).replace(/^-+/, "") : u;
  return `${r}-${m}`;
}
function Qe(e, a = 4, r = 40) {
  return e.length >= a && e.length <= r && $a.test(e);
}
function Dt(e, a, r = 4) {
  const u = oe(a), m = new RegExp(`^${u}-(\\d+)$`);
  let c = 0;
  for (const o of e) {
    const t = oe(o || "").match(m);
    t && (c = Math.max(c, Number(t[1] || 0)));
  }
  return `${u}-${String(c + 1).padStart(r, "0")}`;
}
function te(e) {
  var u;
  const a = (u = e.desiredCode) != null && u.trim() ? Xa(e.desiredCode, e.prefix) : Dt(e.existingCodes, e.prefix, e.digits);
  if (!Qe(a, e.minLength, e.maxLength))
    throw new Error("El codigo debe usar solo letras, numeros y guiones.");
  if (new Set(
    e.existingCodes.map((m) => oe(m || "")).filter(Boolean)
  ).has(a))
    throw new Error(`El codigo ${a} ya existe.`);
  return a;
}
function qe(e) {
  var u;
  const a = (u = e.desiredCode) != null && u.trim() ? oe(e.desiredCode) : Dt(e.existingCodes, e.generatedPrefix, e.digits);
  if (!Qe(a, e.minLength, e.maxLength))
    throw new Error("El codigo debe usar solo letras, numeros y guiones.");
  if (new Set(
    e.existingCodes.map((m) => oe(m || "")).filter(Boolean)
  ).has(a))
    throw new Error(`El codigo ${a} ya existe.`);
  return a;
}
const Ae = [
  { code: "RETIRO", name: "Retiro", direction: F.OUT, requiresCustomerDocument: !0, requiresExternalReference: !0, sortOrder: 10 },
  { code: "DEPOSITO", name: "Deposito", direction: F.IN, requiresCustomerDocument: !0, requiresExternalReference: !0, sortOrder: 20 },
  { code: "CONSIGNACION", name: "Consignacion", direction: F.IN, requiresCustomerDocument: !0, requiresExternalReference: !0, sortOrder: 30 },
  { code: "RECAUDO", name: "Recaudo", direction: F.IN, requiresExternalReference: !0, sortOrder: 40 },
  { code: "PAGO", name: "Pago", direction: F.IN, requiresExternalReference: !0, sortOrder: 50 },
  { code: "RECARGA", name: "Recarga", direction: F.IN, sortOrder: 60 },
  { code: "CONSULTA", name: "Consulta", direction: F.NEUTRAL, sortOrder: 70 },
  { code: "GIRO_ENVIO", name: "Giro envio", direction: F.IN, requiresCustomerDocument: !0, requiresExternalReference: !0, sortOrder: 80 },
  { code: "GIRO_PAGO", name: "Giro pago", direction: F.OUT, requiresCustomerDocument: !0, requiresExternalReference: !0, sortOrder: 90 }
], ja = [
  {
    code: "PUNTORED",
    name: "Puntored",
    requiresEvidence: !0,
    supportsOcr: !0,
    supportsFileImport: !0,
    types: Ae
  },
  {
    code: "PTM",
    name: "PTM",
    requiresEvidence: !0,
    supportsOcr: !0,
    supportsFileImport: !0,
    types: Ae
  },
  {
    code: "CBOGOTA",
    name: "Corresponsal Bogota",
    requiresEvidence: !0,
    supportsOcr: !0,
    types: Ae
  },
  {
    code: "BANCOLOMBIA",
    name: "Corresponsal Bancolombia",
    requiresEvidence: !0,
    supportsOcr: !0,
    types: [
      ...Ae,
      { code: "NEQUI_RETIRO", name: "Nequi retiro", direction: F.OUT, requiresExternalReference: !0, sortOrder: 95 },
      { code: "NEQUI_DEPOSITO", name: "Nequi deposito", direction: F.IN, requiresExternalReference: !0, sortOrder: 96 }
    ]
  },
  {
    code: "COOPENESSA",
    name: "Coopenessa",
    requiresEvidence: !0,
    supportsOcr: !1,
    types: Ae
  }
];
function dt(e) {
  return Math.round(e);
}
function ae(e = /* @__PURE__ */ new Date()) {
  return new Date(e.getFullYear(), e.getMonth(), e.getDate());
}
function xe(e = /* @__PURE__ */ new Date()) {
  const a = ae(e);
  return a.setDate(a.getDate() + 1), a;
}
function ve(e) {
  return ae(e ? new Date(e) : /* @__PURE__ */ new Date());
}
function Va(e) {
  return e.replace(/[^a-zA-Z0-9._-]/g, "_");
}
function Se(e) {
  return JSON.stringify(e ?? null);
}
function Pt(e) {
  return e.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toUpperCase();
}
async function za(e, a) {
  const r = Pt(a) || "CORRESPONSAL";
  let u = r, m = 2;
  for (; await e.correspondentPlatform.findUnique({ where: { code: u }, select: { id: !0 } }); )
    u = `${r}_${m}`, m += 1;
  return u;
}
async function Ga(e, a, r) {
  const u = Pt(r) || "TIPO";
  let m = u, c = 2;
  for (; await e.correspondentTransactionType.findUnique({
    where: { platformId_code: { platformId: a, code: m } },
    select: { id: !0 }
  }); )
    m = `${u}_${c}`, c += 1;
  return m;
}
function ut(e, a) {
  if (!e)
    return null;
  const r = e.match(new RegExp(`${a}:([^;]+)`));
  return (r == null ? void 0 : r[1]) ?? null;
}
async function Ka(e) {
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
  }), r = /* @__PURE__ */ new Map(), u = /* @__PURE__ */ new Map(), m = /* @__PURE__ */ new Map(), c = /* @__PURE__ */ new Map();
  for (const o of a) {
    const s = {
      user: o.user ? o.user.name ?? o.user.username : null,
      at: o.createdAt.toISOString()
    }, t = ut(o.context, "platform"), i = ut(o.context, "type");
    o.action === "create_platform" && t && !r.has(t) && r.set(t, s), o.action === "update_platform" && t && u.set(t, s), o.action === "create_transaction_type" && i && !m.has(i) && m.set(i, s), o.action === "update_transaction_type" && i && c.set(i, s);
  }
  return {
    platformCreatedBy: r,
    platformUpdatedBy: u,
    typeCreatedBy: m,
    typeUpdatedBy: c
  };
}
async function xt(e) {
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
  }), c = [], o = /* @__PURE__ */ new Set();
  for (const s of m) {
    const t = oe(s.approvalCode || ""), d = !!t && Qe(t, 4, 40) && !o.has(t) ? t : qe({
      existingCodes: c,
      generatedPrefix: "APR",
      digits: 6,
      maxLength: 40
    });
    d !== s.approvalCode && await e.correspondentTransaction.update({
      where: { id: s.id },
      data: { approvalCode: d }
    }), c.push(d), o.add(d);
  }
  await e.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "CorrespondentTransaction_approvalCode_key" ON "CorrespondentTransaction"("approvalCode");'
  );
}
async function Ha(e) {
  for (const a of ja) {
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
        mode: Pe.NONE,
        value: 0,
        isActive: !0
      }
    });
  }
}
async function lt(e, a) {
  return e.cashSession.findFirst({
    where: { userId: a, status: "OPEN" },
    include: { register: !0 },
    orderBy: { openedAt: "desc" }
  });
}
async function mt(e, a, r, u, m) {
  const o = (await e.correspondentCommissionRule.findMany({
    where: {
      platformId: a,
      isActive: !0,
      OR: [{ typeId: r }, { typeId: null }],
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: m } }] },
        { OR: [{ validTo: null }, { validTo: { gte: m } }] },
        { OR: [{ minAmount: null }, { minAmount: { lte: u } }] },
        { OR: [{ maxAmount: null }, { maxAmount: { gte: u } }] }
      ]
    }
  })).sort((s, t) => {
    var i, d;
    return s.typeId === r && t.typeId !== r ? -1 : s.typeId !== r && t.typeId === r ? 1 : (((i = t.validFrom) == null ? void 0 : i.getTime()) ?? 0) - (((d = s.validFrom) == null ? void 0 : d.getTime()) ?? 0);
  })[0] ?? null;
  return o ? o.mode === Pe.FIXED ? dt(o.value) : o.mode === Pe.PERCENTAGE ? dt(u * o.value / 100) : 0 : 0;
}
function we(e) {
  return e.reduce(
    (a, r) => r.status === ie.VOIDED ? (a.voidedCount += 1, a) : (a.transactionsCount += 1, a.totalCommission += r.commissionAmount, a.withEvidenceCount += r.evidences.length > 0 ? 1 : 0, a.pendingClosureCount += r.dailyClosureId ? 0 : 1, r.type.direction === F.IN && (a.totalIn += r.amount), r.type.direction === F.OUT && (a.totalOut += r.amount), r.type.direction === F.NEUTRAL && (a.neutralCount += 1), a),
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
async function Ya(e) {
  const a = /* @__PURE__ */ new Date(), r = G.join(
    e.app.getPath("userData"),
    "correspondent-evidence",
    String(a.getFullYear()),
    String(a.getMonth() + 1).padStart(2, "0"),
    String(a.getDate()).padStart(2, "0"),
    e.platformCode.toLowerCase()
  );
  await na(r, { recursive: !0 });
  const u = Va(e.evidence.fileName), m = G.join(r, `${Date.now()}-${u}`), c = e.evidence.dataBase64.includes(",") ? e.evidence.dataBase64.split(",").pop() ?? "" : e.evidence.dataBase64, o = Buffer.from(c, "base64");
  return await oa(m, o), {
    fileName: e.evidence.fileName,
    filePath: m,
    mimeType: e.evidence.mimeType ?? null,
    fileSize: o.byteLength,
    fileHash: wt("sha256").update(o).digest("hex"),
    ocrRawText: e.evidence.ocrRawText ?? null
  };
}
async function ee(e) {
  var a, r;
  await e.prisma.correspondentAuditLog.create({
    data: {
      transactionId: e.transactionId ?? null,
      userId: ((a = e.currentSessionUser) == null ? void 0 : a.id) ?? null,
      action: e.action,
      context: e.context ?? null,
      beforeJson: e.beforeJson === void 0 ? null : Se(e.beforeJson),
      afterJson: e.afterJson === void 0 ? null : Se(e.afterJson)
    }
  }), await e.prisma.auditLog.create({
    data: {
      userId: ((r = e.currentSessionUser) == null ? void 0 : r.id) ?? null,
      module: "correspondent",
      action: e.action,
      entity: e.transactionId ? "CorrespondentTransaction" : "CorrespondentDailyClosure",
      entityId: e.transactionId ?? null,
      beforeJson: e.beforeJson === void 0 ? null : Se(e.beforeJson),
      afterJson: e.afterJson === void 0 ? null : Se(e.afterJson)
    }
  });
}
async function Be(e, a, r) {
  return e.correspondentTransaction.findMany({
    where: {
      platformId: r,
      performedAt: {
        gte: ae(a),
        lt: xe(a)
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
async function Ja(e, a, r, u) {
  return e.correspondentTransaction.findMany({
    where: {
      platformId: u,
      performedAt: {
        gte: ae(a),
        lt: xe(r)
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
async function Qa(e, a) {
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
function Wa({
  app: e,
  ipcMain: a,
  prisma: r,
  getCurrentSessionUser: u
}) {
  a.handle("correspondent:catalog", async () => {
    if (!u())
      return { success: !1, message: "Debes iniciar sesion", platforms: [] };
    const [c, o] = await Promise.all([
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
      Ka(r)
    ]);
    return {
      success: !0,
      platforms: c.map((s) => {
        var t, i, d;
        return {
          id: s.id,
          code: s.code,
          name: s.name,
          requiresEvidence: s.requiresEvidence,
          supportsOcr: s.supportsOcr,
          supportsFileImport: s.supportsFileImport,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
          createdBy: ((t = o.platformCreatedBy.get(s.id)) == null ? void 0 : t.user) ?? null,
          updatedBy: ((i = o.platformUpdatedBy.get(s.id)) == null ? void 0 : i.user) ?? ((d = o.platformCreatedBy.get(s.id)) == null ? void 0 : d.user) ?? null,
          types: s.transactionTypes.map((f) => {
            var p, T, I;
            return {
              id: f.id,
              code: f.code,
              name: f.name,
              direction: f.direction,
              requiresCustomerDocument: f.requiresCustomerDocument,
              requiresExternalReference: f.requiresExternalReference,
              createdAt: f.createdAt.toISOString(),
              updatedAt: f.updatedAt.toISOString(),
              createdBy: ((p = o.typeCreatedBy.get(f.id)) == null ? void 0 : p.user) ?? null,
              updatedBy: ((T = o.typeUpdatedBy.get(f.id)) == null ? void 0 : T.user) ?? ((I = o.typeCreatedBy.get(f.id)) == null ? void 0 : I.user) ?? null
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
    if (!u())
      return { success: !1, message: "Debes iniciar sesion" };
    const c = ae(/* @__PURE__ */ new Date()), o = await Be(r, c), s = we(o), t = o.reduce((i, d) => {
      const f = i[d.platformId] ?? {
        platformId: d.platformId,
        platform: d.platform.name,
        totalIn: 0,
        totalOut: 0,
        totalCommission: 0,
        count: 0,
        pendingClosureCount: 0
      };
      return d.status !== ie.VOIDED && (f.count += 1, f.totalCommission += d.commissionAmount, f.pendingClosureCount += d.dailyClosureId ? 0 : 1, d.type.direction === F.IN && (f.totalIn += d.amount), d.type.direction === F.OUT && (f.totalOut += d.amount)), i[d.platformId] = f, i;
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
      perPlatform: Object.values(t).sort((i, d) => i.platform.localeCompare(d.platform, "es")),
      recentTransactions: o.slice(0, 10).map((i) => ({
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
    if (!u())
      return { success: !1, message: "Debes iniciar sesion", transactions: [] };
    const s = Pa.safeParse(c);
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
            ...t.dateTo ? { lt: xe(new Date(t.dateTo)) } : {}
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
      })).map((p) => {
        var T, I;
        return {
          id: p.id,
          approvalCode: p.approvalCode,
          platformId: p.platformId,
          platform: p.platform.name,
          typeId: p.typeId,
          type: p.type.name,
          direction: p.type.direction,
          amount: p.amount,
          commissionAmount: p.commissionAmount,
          netAmount: p.netAmount,
          externalReference: p.externalReference,
          customerName: p.customerName,
          customerDocument: p.customerDocument,
          targetAccount: p.targetAccount,
          targetPhone: p.targetPhone,
          performedAt: p.performedAt.toISOString(),
          status: p.status,
          source: p.source,
          registeredBy: p.registeredBy.name ?? p.registeredBy.username,
          note: p.note,
          hasEvidence: p.evidences.length > 0,
          evidenceCount: p.evidences.length,
          closureId: ((T = p.dailyClosure) == null ? void 0 : T.id) ?? null,
          closureStatus: ((I = p.dailyClosure) == null ? void 0 : I.status) ?? null
        };
      })
    };
  }), a.handle("correspondent:transaction:detail", async (m, c) => {
    if (!u())
      return { success: !1, message: "Debes iniciar sesion" };
    const s = Da.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Transaccion invalida" };
    const t = await Qa(r, s.data.transactionId);
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
    var N, C, b, D, x, v, l, A, S, L;
    const o = u();
    if (!o)
      return { success: !1, message: "Debes iniciar sesion para registrar movimientos" };
    const s = Ra.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para el corresponsal" };
    const t = s.data, i = new Date(t.performedAt), [d, f, p] = await Promise.all([
      r.correspondentPlatform.findUnique({ where: { id: t.platformId } }),
      r.correspondentTransactionType.findUnique({ where: { id: t.typeId } }),
      lt(r, o.id)
    ]);
    if (!d || !d.isActive)
      return { success: !1, message: "La plataforma seleccionada no esta disponible" };
    if (!f || !f.isActive || f.platformId !== d.id)
      return { success: !1, message: "El tipo de transaccion no corresponde a la plataforma" };
    if (await r.correspondentTransaction.findFirst({
      where: {
        platformId: d.id,
        typeId: f.id,
        amount: t.amount,
        externalReference: ((N = t.externalReference) == null ? void 0 : N.trim()) || null,
        performedAt: {
          gte: new Date(i.getTime() - 10 * 60 * 1e3),
          lte: new Date(i.getTime() + 10 * 60 * 1e3)
        },
        status: ie.REGISTERED
      }
    }))
      return { success: !1, message: "Parece un duplicado reciente. Verifica antes de registrar." };
    const I = t.commissionAmount ?? await mt(r, d.id, f.id, t.amount, i), g = f.direction === F.OUT ? t.amount - I : t.amount + I, y = t.evidence ? await Ya({ app: e, platformCode: d.code, evidence: t.evidence }) : null;
    try {
      const h = (await r.correspondentTransaction.findMany({
        select: { approvalCode: !0 }
      })).map((V) => V.approvalCode), O = qe({
        desiredCode: t.approvalCode,
        existingCodes: h,
        generatedPrefix: "APR",
        digits: 6,
        maxLength: 40
      }), _ = await r.correspondentTransaction.create({
        data: {
          approvalCode: O,
          platformId: d.id,
          typeId: f.id,
          cashSessionId: (p == null ? void 0 : p.id) ?? null,
          cashRegisterId: (p == null ? void 0 : p.registerId) ?? null,
          registeredByUserId: o.id,
          status: ie.REGISTERED,
          source: t.source,
          ocrStatus: (C = t.evidence) != null && C.ocrRawText ? Me.PROCESSED : d.supportsOcr ? Me.NEEDS_REVIEW : Me.NOT_REQUESTED,
          reconciliationStatus: ua.PENDING,
          externalReference: ((b = t.externalReference) == null ? void 0 : b.trim()) || null,
          customerName: ((D = t.customerName) == null ? void 0 : D.trim()) || null,
          customerDocument: ((x = t.customerDocument) == null ? void 0 : x.trim()) || null,
          targetAccount: ((v = t.targetAccount) == null ? void 0 : v.trim()) || null,
          targetPhone: ((l = t.targetPhone) == null ? void 0 : l.trim()) || null,
          amount: t.amount,
          commissionAmount: I,
          netAmount: g,
          performedAt: i,
          note: ((A = t.note) == null ? void 0 : A.trim()) || null,
          rawExtractedText: ((S = t.rawExtractedText) == null ? void 0 : S.trim()) || ((L = t.evidence) == null ? void 0 : L.ocrRawText) || null,
          evidences: y ? {
            create: {
              ...y,
              capturedByUserId: o.id
            }
          } : void 0
        },
        include: {
          platform: !0,
          type: !0,
          evidences: { select: { id: !0 } }
        }
      });
      return await ee({
        prisma: r,
        currentSessionUser: o,
        transactionId: _.id,
        action: "create_transaction",
        afterJson: {
          approvalCode: _.approvalCode,
          platform: _.platform.name,
          type: _.type.name,
          amount: _.amount,
          commissionAmount: _.commissionAmount,
          hasEvidence: _.evidences.length > 0
        }
      }), {
        success: !0,
        transaction: {
          id: _.id,
          approvalCode: _.approvalCode,
          platform: _.platform.name,
          type: _.type.name,
          amount: _.amount,
          commissionAmount: _.commissionAmount,
          netAmount: _.netAmount,
          hasEvidence: _.evidences.length > 0
        }
      };
    } catch (h) {
      return { success: !1, message: h instanceof Error ? h.message : "No se pudo registrar la transaccion" };
    }
  }), a.handle("correspondent:transaction:update", async (m, c) => {
    const o = u();
    if (!o)
      return { success: !1, message: "Debes iniciar sesion para editar movimientos" };
    const s = Oa.safeParse(c);
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
    if (t.status === ie.VOIDED)
      return { success: !1, message: "No puedes editar una transaccion anulada" };
    const i = await r.correspondentTransactionType.findUnique({
      where: { id: s.data.typeId }
    });
    if (!i || !i.isActive || i.platformId !== t.platformId)
      return { success: !1, message: "El nuevo tipo no pertenece al mismo corresponsal" };
    const d = new Date(s.data.performedAt), f = await mt(
      r,
      t.platformId,
      i.id,
      s.data.amount,
      d
    ), p = i.direction === F.OUT ? s.data.amount - f : s.data.amount + f;
    try {
      const T = (await r.correspondentTransaction.findMany({
        where: { NOT: { id: t.id } },
        select: { approvalCode: !0 }
      })).map((y) => y.approvalCode), I = qe({
        desiredCode: s.data.approvalCode ?? t.approvalCode,
        existingCodes: T,
        generatedPrefix: "APR",
        digits: 6,
        maxLength: 40
      }), g = await r.correspondentTransaction.update({
        where: { id: t.id },
        data: {
          approvalCode: I,
          typeId: i.id,
          amount: s.data.amount,
          commissionAmount: f,
          netAmount: p,
          performedAt: d,
          reviewedByUserId: o.id
        },
        include: {
          platform: !0,
          type: !0,
          evidences: { select: { id: !0 } }
        }
      });
      return await ee({
        prisma: r,
        currentSessionUser: o,
        transactionId: g.id,
        action: "update_transaction",
        beforeJson: {
          approvalCode: t.approvalCode,
          type: t.type.name,
          amount: t.amount,
          performedAt: t.performedAt.toISOString(),
          commissionAmount: t.commissionAmount
        },
        afterJson: {
          approvalCode: g.approvalCode,
          type: g.type.name,
          amount: g.amount,
          performedAt: g.performedAt.toISOString(),
          commissionAmount: g.commissionAmount
        }
      }), {
        success: !0,
        transaction: {
          id: g.id,
          approvalCode: g.approvalCode,
          platform: g.platform.name,
          type: g.type.name,
          amount: g.amount,
          commissionAmount: g.commissionAmount,
          netAmount: g.netAmount,
          hasEvidence: g.evidences.length > 0
        }
      };
    } catch (T) {
      return { success: !1, message: T instanceof Error ? T.message : "No se pudo actualizar la transaccion" };
    }
  }), a.handle("correspondent:platform:create", async (m, c) => {
    const o = u();
    if (!o || o.role !== q.ADMIN)
      return { success: !1, message: "Solo el administrador puede crear corresponsales" };
    const s = Ua.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para el corresponsal" };
    const t = s.data.name.trim();
    if (await r.correspondentPlatform.findFirst({
      where: { name: { equals: t } },
      select: { id: !0 }
    }))
      return { success: !1, message: "Ya existe un corresponsal con ese nombre" };
    try {
      const d = await r.correspondentPlatform.create({
        data: {
          code: await za(r, t),
          name: t,
          isActive: !0,
          requiresEvidence: s.data.requiresEvidence,
          supportsOcr: s.data.supportsOcr,
          supportsFileImport: s.data.supportsFileImport
        }
      });
      return await r.correspondentCommissionRule.create({
        data: {
          platformId: d.id,
          mode: Pe.NONE,
          value: 0,
          isActive: !0
        }
      }), await ee({
        prisma: r,
        currentSessionUser: o,
        action: "create_platform",
        context: `platform:${d.id}`,
        afterJson: {
          platform: d.name,
          code: d.code
        }
      }), { success: !0, platformId: d.id };
    } catch (d) {
      return { success: !1, message: d instanceof Error ? d.message : "No se pudo crear el corresponsal" };
    }
  }), a.handle("correspondent:platform:update", async (m, c) => {
    const o = u();
    if (!o || o.role !== q.ADMIN)
      return { success: !1, message: "Solo el administrador puede editar corresponsales" };
    const s = Ma.safeParse(c);
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
      const d = await r.correspondentPlatform.update({
        where: { id: t.id },
        data: {
          name: s.data.name.trim(),
          requiresEvidence: s.data.requiresEvidence,
          supportsOcr: s.data.supportsOcr,
          supportsFileImport: s.data.supportsFileImport
        }
      });
      return await ee({
        prisma: r,
        currentSessionUser: o,
        action: "update_platform",
        context: `platform:${d.id}`,
        beforeJson: {
          name: t.name,
          requiresEvidence: t.requiresEvidence,
          supportsOcr: t.supportsOcr,
          supportsFileImport: t.supportsFileImport
        },
        afterJson: {
          name: d.name,
          requiresEvidence: d.requiresEvidence,
          supportsOcr: d.supportsOcr,
          supportsFileImport: d.supportsFileImport
        }
      }), { success: !0, platformId: d.id };
    } catch (d) {
      return { success: !1, message: d instanceof Error ? d.message : "No se pudo actualizar el corresponsal" };
    }
  }), a.handle("correspondent:platform:delete", async (m, c) => {
    const o = u();
    if (!o || o.role !== q.ADMIN)
      return { success: !1, message: "Solo el administrador puede eliminar corresponsales" };
    const s = Fa.safeParse(c);
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
      }), await ee({
        prisma: r,
        currentSessionUser: o,
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
    const o = u();
    if (!o || o.role !== q.ADMIN)
      return { success: !1, message: "Solo el administrador puede crear tipos" };
    const s = _a.safeParse(c);
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
      const p = await r.correspondentTransactionType.create({
        data: {
          platformId: t.id,
          code: await Ga(r, t.id, i),
          name: i,
          direction: s.data.direction,
          isActive: !0,
          sortOrder: (((f = t.transactionTypes[0]) == null ? void 0 : f.sortOrder) ?? 0) + 10
        }
      });
      return await ee({
        prisma: r,
        currentSessionUser: o,
        action: "create_transaction_type",
        context: `platform:${t.id};type:${p.id}`,
        afterJson: {
          platform: t.name,
          type: p.name,
          direction: p.direction
        }
      }), { success: !0, typeId: p.id };
    } catch (p) {
      return { success: !1, message: p instanceof Error ? p.message : "No se pudo crear el tipo" };
    }
  }), a.handle("correspondent:type:update", async (m, c) => {
    const o = u();
    if (!o || o.role !== q.ADMIN)
      return { success: !1, message: "Solo el administrador puede editar tipos" };
    const s = Ba.safeParse(c);
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
      const d = await r.correspondentTransactionType.update({
        where: { id: t.id },
        data: {
          name: s.data.name.trim(),
          direction: s.data.direction
        }
      });
      return await ee({
        prisma: r,
        currentSessionUser: o,
        action: "update_transaction_type",
        context: `platform:${t.platformId};type:${d.id}`,
        beforeJson: {
          name: t.name,
          direction: t.direction
        },
        afterJson: {
          name: d.name,
          direction: d.direction
        }
      }), { success: !0, typeId: d.id };
    } catch (d) {
      return { success: !1, message: d instanceof Error ? d.message : "No se pudo actualizar el tipo" };
    }
  }), a.handle("correspondent:type:delete", async (m, c) => {
    const o = u();
    if (!o || o.role !== q.ADMIN)
      return { success: !1, message: "Solo el administrador puede eliminar tipos" };
    const s = ka.safeParse(c);
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
      }), await ee({
        prisma: r,
        currentSessionUser: o,
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
    if (!u())
      return { success: !1, message: "Debes iniciar sesion", closures: [] };
    const s = xa.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Fecha de cierre invalida", closures: [] };
    const t = !!(s.data.dateFrom || s.data.dateTo), i = ve(s.data.dateFrom ?? s.data.businessDate), d = ve(s.data.dateTo ?? s.data.dateFrom ?? s.data.businessDate), f = ve(s.data.businessDate ?? s.data.dateFrom), [p, T, I] = await Promise.all([
      r.correspondentPlatform.findMany({
        where: { isActive: !0 },
        orderBy: [{ createdAt: "asc" }, { name: "asc" }]
      }),
      r.correspondentDailyClosure.findMany({
        where: t ? {
          businessDate: {
            gte: ae(i),
            lt: xe(d)
          }
        } : { businessDate: f },
        include: {
          platform: !0,
          closedBy: { select: { username: !0, name: !0 } }
        },
        orderBy: { closedAt: "desc" }
      }),
      t ? Ja(r, i, d) : Be(r, f)
    ]), g = new Map(
      T.map((b) => [b.platformId, b])
    ), y = T.reduce((b, D) => (b[D.platformId] = (b[D.platformId] ?? 0) + 1, b), {}), N = I.reduce((b, D) => (b[D.platformId] = [...b[D.platformId] ?? [], D], b), {}), C = we(I);
    return {
      success: !0,
      mode: t ? "range" : "day",
      businessDate: f.toISOString(),
      dateFrom: ae(i).toISOString(),
      dateTo: ae(d).toISOString(),
      totals: {
        totalIn: C.totalIn,
        totalOut: C.totalOut,
        netTotal: C.totalIn - C.totalOut,
        transactionsCount: C.transactionsCount
      },
      closures: p.map((b) => {
        const D = N[b.id] ?? [], x = we(D), v = g.get(b.id) ?? null, l = D.reduce((A, S) => {
          if (S.status === ie.VOIDED)
            return A;
          const L = A[S.typeId] ?? {
            typeId: S.typeId,
            type: S.type.name,
            direction: S.type.direction,
            total: 0,
            count: 0
          };
          return L.total += S.amount, L.count += 1, A[S.typeId] = L, A;
        }, {});
        return {
          platformId: b.id,
          platform: b.name,
          totalIn: x.totalIn,
          totalOut: x.totalOut,
          totalCommission: x.totalCommission,
          expectedBalance: x.totalIn - x.totalOut + x.totalCommission,
          transactionsCount: x.transactionsCount,
          pendingTransactions: x.pendingClosureCount,
          closuresCount: y[b.id] ?? 0,
          breakdown: Object.values(l).sort((A, S) => A.type.localeCompare(S.type, "es")),
          closure: !t && v ? {
            id: v.id,
            expectedBalance: v.expectedBalance,
            reportedBalance: v.reportedBalance,
            differenceAmount: v.differenceAmount,
            status: v.status,
            closedAt: v.closedAt.toISOString(),
            closedBy: v.closedBy.name ?? v.closedBy.username,
            note: v.note
          } : null
        };
      })
    };
  }), a.handle("correspondent:closure:create", async (m, c) => {
    const o = u();
    if (!o)
      return { success: !1, message: "Debes iniciar sesion para cerrar" };
    const s = La.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para el cierre" };
    const t = s.data, i = ve(t.businessDate);
    if (await r.correspondentDailyClosure.findFirst({
      where: {
        platformId: t.platformId,
        businessDate: i
      }
    }))
      return { success: !1, message: "La plataforma ya fue cerrada para esa fecha" };
    const [f, p, T] = await Promise.all([
      r.correspondentPlatform.findUnique({ where: { id: t.platformId } }),
      Be(r, i, t.platformId),
      lt(r, o.id)
    ]);
    if (!f)
      return { success: !1, message: "Plataforma no encontrada" };
    const I = p.filter(
      (C) => C.status === ie.REGISTERED && !C.dailyClosureId
    ), g = we(I), y = t.openingBalance + g.totalIn - g.totalOut + g.totalCommission, N = t.reportedBalance - y;
    try {
      const C = await r.$transaction(async (b) => {
        var x;
        const D = await b.correspondentDailyClosure.create({
          data: {
            platformId: f.id,
            cashSessionId: (T == null ? void 0 : T.id) ?? null,
            businessDate: i,
            totalIn: g.totalIn,
            totalOut: g.totalOut,
            totalCommission: g.totalCommission,
            transactionsCount: g.transactionsCount,
            expectedBalance: y,
            reportedBalance: t.reportedBalance,
            differenceAmount: N,
            status: N === 0 ? it.CLOSED : it.WITH_DIFFERENCE,
            note: ((x = t.note) == null ? void 0 : x.trim()) || null,
            closedByUserId: o.id
          }
        });
        return I.length > 0 && await b.correspondentTransaction.updateMany({
          where: {
            id: { in: I.map((v) => v.id) }
          },
          data: {
            dailyClosureId: D.id
          }
        }), D;
      });
      return await ee({
        prisma: r,
        currentSessionUser: o,
        action: "create_closure",
        context: `platform:${f.id};closure:${C.id}`,
        afterJson: {
          platform: f.name,
          businessDate: i.toISOString(),
          expectedBalance: y,
          reportedBalance: t.reportedBalance,
          differenceAmount: N
        }
      }), {
        success: !0,
        closure: {
          id: C.id,
          expectedBalance: y,
          reportedBalance: C.reportedBalance,
          differenceAmount: C.differenceAmount,
          status: C.status
        }
      };
    } catch (C) {
      return { success: !1, message: C instanceof Error ? C.message : "No se pudo cerrar la plataforma" };
    }
  });
}
const Za = n.enum(["CASH", "TRANSFER", "CORRESPONDENT"]), es = n.object({
  dateFrom: n.string().datetime().optional(),
  dateTo: n.string().datetime().optional()
}).optional().default({}), ts = n.object({
  saleId: n.string().uuid("saleId invalido"),
  customerId: n.string().uuid("customerId invalido"),
  total: n.number().int("El valor debe ser entero").positive("El valor debe ser mayor a 0").optional(),
  dueDate: n.string().datetime("Fecha de vencimiento invalida").optional().nullable()
}), as = n.object({
  creditId: n.string().uuid("creditId invalido"),
  amount: n.number().int("El valor debe ser entero").positive("El valor debe ser mayor a 0"),
  method: Je.optional().default("CASH"),
  note: n.string().trim().max(250).optional().nullable()
}), ss = n.object({
  saleId: n.string().uuid("saleId invalido"),
  amount: n.number().int("El valor debe ser entero").positive("El valor debe ser mayor a 0"),
  reason: n.string().trim().max(250).optional().nullable()
}), rs = n.object({
  amount: n.number().int("El valor debe ser entero").positive("El valor debe ser mayor a 0"),
  note: n.string().trim().min(2, "La descripcion es obligatoria").max(250),
  type: n.enum(["EXPENSE_OUT", "WITHDRAWAL_OUT"]).optional().default("EXPENSE_OUT"),
  sourceMedium: Za.optional().default("CASH"),
  sourcePlatformId: n.string().uuid("Plataforma invalida").optional().nullable()
}), Lt = n.enum([
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
]), ns = [0, 0.05, 0.19], os = n.object({
  minQty: n.number().int().min(1, "La cantidad minima debe ser mayor a 0"),
  unitPrice: n.number().min(0, "El precio unitario no puede ser negativo")
}), is = n.object({
  id: n.string().trim().min(1).max(80),
  label: n.string().trim().min(1).max(80),
  unitPrice: n.number().min(0, "El precio unitario no puede ser negativo")
}), cs = n.object({
  id: n.string().trim().min(1).max(80),
  name: n.string().trim().min(1).max(60),
  basePrice: n.number().positive("El precio base por hoja debe ser mayor a 0"),
  minimumPrice: n.number().min(0).nullable().optional(),
  quantityScales: n.array(os).optional().default([]),
  specialPriceRules: n.array(is).optional().default([])
}), Ut = n.object({
  enabled: n.boolean().optional().default(!1),
  minimumPrice: n.number().min(0, "El precio minimo no puede ser negativo").optional().default(0),
  sheetTypes: n.array(cs).optional().default([])
}).superRefine((e, a) => {
  if (!e.enabled)
    return;
  e.sheetTypes.length === 0 && a.addIssue({
    code: n.ZodIssueCode.custom,
    message: "Debes configurar al menos un tipo de hoja",
    path: ["sheetTypes"]
  });
  const r = /* @__PURE__ */ new Set();
  for (const [u, m] of e.sheetTypes.entries()) {
    r.has(m.id) && a.addIssue({
      code: n.ZodIssueCode.custom,
      message: "Cada tipo de hoja debe tener un identificador unico",
      path: ["sheetTypes", u, "id"]
    }), r.add(m.id);
    const c = m.minimumPrice ?? e.minimumPrice;
    for (const s of m.quantityScales)
      if (s.unitPrice < c) {
        a.addIssue({
          code: n.ZodIssueCode.custom,
          message: "La escala no puede quedar por debajo del precio minimo permitido",
          path: ["sheetTypes", u, "quantityScales"]
        });
        break;
      }
    const o = /* @__PURE__ */ new Set();
    for (const [s, t] of m.specialPriceRules.entries())
      t.unitPrice < c && a.addIssue({
        code: n.ZodIssueCode.custom,
        message: "La tarifa especial no puede quedar por debajo del precio minimo permitido",
        path: ["sheetTypes", u, "specialPriceRules", s, "unitPrice"]
      }), o.has(t.id) && a.addIssue({
        code: n.ZodIssueCode.custom,
        message: "Cada tarifa especial debe tener un identificador unico dentro del tipo de hoja",
        path: ["sheetTypes", u, "specialPriceRules", s, "id"]
      }), o.add(t.id);
  }
});
function _t(e, a) {
  e !== void 0 && (ns.includes(e) || a.addIssue({
    code: n.ZodIssueCode.custom,
    message: "El IVA permitido es: no aplica, 0%, 5% o 19%",
    path: ["taxRate"]
  }));
}
const ds = n.object({
  name: n.string({ message: "El nombre es obligatorio" }).trim().min(2, "Minimo 2 caracteres").max(120, "Maximo 120 caracteres"),
  barcode: n.string().trim().min(1).max(50).optional().nullable(),
  sku: n.string().trim().min(1).max(50).optional().nullable(),
  unitMeasure: Lt.optional().default("UNIDAD"),
  price: n.number({ message: "El precio es obligatorio" }).positive("El precio debe ser mayor a 0"),
  cost: n.number().min(0, "El costo no puede ser negativo").optional().default(0),
  marginPercent: n.number().min(0, "La ganancia no puede ser negativa").optional().default(0),
  hasTax: n.boolean().optional().default(!1),
  taxRate: n.number().min(0).max(1).optional().default(0),
  stock: n.number().int("El stock debe ser un numero entero").min(0, "El stock no puede ser negativo").optional().default(0),
  categoryId: n.string().uuid().optional().nullable(),
  subcategoryId: n.string().uuid().optional().nullable(),
  isActive: n.boolean().optional().default(!0),
  pricingConfig: Ut.optional().nullable()
}).superRefine((e, a) => {
  _t(e.taxRate, a);
}), us = n.object({
  id: n.string().uuid("ID de producto invalido"),
  name: n.string().trim().min(2, "Minimo 2 caracteres").max(120).optional(),
  barcode: n.string().trim().min(1).max(50).optional().nullable(),
  sku: n.string().trim().min(1).max(50).optional().nullable(),
  unitMeasure: Lt.optional(),
  price: n.number().positive("El precio debe ser mayor a 0").optional(),
  cost: n.number().min(0).optional(),
  marginPercent: n.number().min(0).optional(),
  hasTax: n.boolean().optional(),
  taxRate: n.number().min(0).max(1).optional(),
  stock: n.number().int().min(0).optional(),
  categoryId: n.string().uuid().optional().nullable(),
  subcategoryId: n.string().uuid().optional().nullable(),
  isActive: n.boolean().optional(),
  pricingConfig: Ut.optional().nullable()
}).superRefine((e, a) => {
  _t(e.taxRate, a);
});
n.object({
  productId: n.string().uuid("ID de producto invalido"),
  delta: n.number().int("El ajuste debe ser un numero entero").refine((e) => e !== 0, "El ajuste no puede ser 0"),
  reason: n.string().trim().max(200).optional()
});
n.object({
  barcode: n.string().trim().min(1, "Barcode no puede estar vacio")
});
const Mt = {
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
}, ls = [
  Mt,
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
], ms = [
  Mt,
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
], Le = [
  {
    key: "ADMIN",
    name: "Administrador",
    description: "Acceso completo a todas las secciones del sistema, puede agregar o eliminar usuarios y administrar la configuracion general.",
    sections: ls
  },
  {
    key: "EMPLOYEE",
    name: "Empleado",
    description: "Acceso operativo para ventas y caja, con permisos limitados sobre configuracion, usuarios y reportes sensibles.",
    sections: ms
  }
];
function ps(e) {
  return Le.find((a) => a.key === e) ?? Le[0];
}
function Fe(e) {
  return e.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function w(e, a, r) {
  return [Fe(e), Fe(a), Fe(r)].filter(Boolean).join(".");
}
function Bt(e) {
  return e.sections.flatMap(
    (a) => a.groups.flatMap(
      (r) => r.permissions.map((u) => ({
        key: w(a.title, r.title, u),
        label: u,
        sectionTitle: a.title,
        groupTitle: r.title
      }))
    )
  );
}
function Ft(e, a) {
  return Bt(ps(e)).find((r) => r.key === a) ?? null;
}
const fs = {
  posAccess: w("Acceso a interfaces", "Operacion comercial", "Acceder a Facturar"),
  salesAccess: w("Acceso a interfaces", "Operacion comercial", "Acceder a Historial ventas"),
  customersAccess: w("Acceso a interfaces", "Operacion comercial", "Acceder a Clientes"),
  purchasesAccess: w("Acceso a interfaces", "Operacion comercial", "Acceder a Compras"),
  suppliersAccess: w("Acceso a interfaces", "Operacion comercial", "Acceder a Proveedores"),
  cashAccess: w("Acceso a interfaces", "Caja y corresponsal", "Acceder a Caja general"),
  correspondentAccess: w("Acceso a interfaces", "Caja y corresponsal", "Acceder a Corresponsal transacciones"),
  correspondentHistoryAccess: w("Acceso a interfaces", "Caja y corresponsal", "Acceder a Corresponsal historial"),
  correspondentClosuresAccess: w("Acceso a interfaces", "Caja y corresponsal", "Acceder a Corresponsal resumen diario"),
  correspondentSettingsAccess: w("Acceso a interfaces", "Caja y corresponsal", "Acceder a Corresponsal configuracion"),
  productsAccess: w("Acceso a interfaces", "Inventario", "Acceder a Productos"),
  stockMovesAccess: w("Acceso a interfaces", "Inventario", "Acceder a Movimientos de inventario"),
  accountingAccess: w("Acceso a interfaces", "Control financiero", "Acceder a Centro contable"),
  reportsAccess: w("Acceso a interfaces", "Control financiero", "Acceder a Reportes"),
  usersAccess: w("Acceso a interfaces", "Gestion y sistema", "Acceder a Usuarios"),
  rolesAccess: w("Acceso a interfaces", "Gestion y sistema", "Acceder a Roles y permisos"),
  settingsAccess: w("Acceso a interfaces", "Gestion y sistema", "Acceder a Configuracion")
}, gs = {
  salesCreate: w("POS", "Operacion POS", "Crear ventas desde POS"),
  salesChangeCustomer: w("POS", "Operacion POS", "Cambiar cliente en la factura"),
  salesManagePayments: w("POS", "Operacion POS", "Gestionar pagos en efectivo, transferencia y combinado"),
  salesHistory: w("POS", "Operacion POS", "Ver historial de ventas"),
  salesPrint: w("POS", "Operacion POS", "Imprimir factura"),
  salesEditItemPrices: w(
    "Contabilidad",
    "Facturas de venta",
    "Editar precios de los items de venta en facturas"
  ),
  cashOpen: w("POS", "Caja y control diario", "Abrir caja"),
  cashClose: w("POS", "Caja y control diario", "Cerrar caja"),
  cashView: w("POS", "Caja y control diario", "Consultar resumen de caja"),
  productsView: w("Contabilidad", "Items, inventario y contactos", "Ver listado de items"),
  productsCreate: w("Contabilidad", "Items, inventario y contactos", "Crear nuevos items de venta"),
  productsEdit: w("Contabilidad", "Items, inventario y contactos", "Editar items"),
  productsDelete: w("Contabilidad", "Items, inventario y contactos", "Eliminar items"),
  stockMovesView: w("Contabilidad", "Items, inventario y contactos", "Ver listado de ajustes de inventario"),
  purchasesView: w("Contabilidad", "Compras y proveedores", "Ver listado de facturas de proveedores"),
  purchasesDetails: w("Contabilidad", "Compras y proveedores", "Ver detalles de facturas de proveedores"),
  purchasesCreate: w("Contabilidad", "Compras y proveedores", "Crear nuevas facturas de proveedores"),
  suppliersView: w("Contabilidad", "Items, inventario y contactos", "Ver listado de proveedores"),
  suppliersCreate: w("Contabilidad", "Items, inventario y contactos", "Agregar nuevos contactos"),
  suppliersEdit: w("Contabilidad", "Items, inventario y contactos", "Editar contactos"),
  usersView: w("Configuraciones generales", "Usuarios y seguridad", "Ver usuarios"),
  usersCreate: w("Configuraciones generales", "Usuarios y seguridad", "Crear usuarios"),
  usersEdit: w("Configuraciones generales", "Usuarios y seguridad", "Editar usuarios"),
  rolesView: w("Configuraciones generales", "Usuarios y seguridad", "Ver roles y permisos"),
  rolesManage: w("Configuraciones generales", "Usuarios y seguridad", "Administrar el rol Administrador"),
  customersView: w("Contabilidad", "Items, inventario y contactos", "Ver listado de clientes"),
  customersCreate: w("Contabilidad", "Items, inventario y contactos", "Agregar nuevos contactos"),
  customersEdit: w("Contabilidad", "Items, inventario y contactos", "Editar contactos"),
  correspondentView: w("POS", "Operacion de tienda", "Gestionar corresponsal"),
  reportsView: w("Contabilidad", "Reportes comerciales y financieros", "Ver reporte de ventas generales"),
  settingsView: w("Configuraciones generales", "Negocio y sistema", "Editar configuracion general del negocio"),
  settingsTheme: w("Configuraciones generales", "Interfaz del sistema", "Cambiar tema del sistema"),
  settingsBusiness: w("Configuraciones generales", "Datos del negocio", "Editar datos del negocio"),
  settingsBilling: w("Configuraciones generales", "Facturacion e impresion", "Configurar factura e impresion"),
  settingsInventory: w("Configuraciones generales", "Inventario y operacion", "Configurar inventario y comportamiento de venta")
}, E = {
  ...fs,
  ...gs
}, kt = {
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
}, $t = {
  [E.settingsTheme]: [E.settingsView],
  [E.settingsBusiness]: [E.settingsView],
  [E.settingsBilling]: [E.settingsView],
  [E.settingsInventory]: [E.settingsView]
}, Es = {
  [E.settingsView]: [
    E.settingsTheme,
    E.settingsBusiness,
    E.settingsBilling,
    E.settingsInventory
  ]
};
[
  ...Object.keys(kt),
  ...Object.keys($t)
];
function Ts(e) {
  return e ? [
    e,
    ...kt[e] ?? [],
    ...$t[e] ?? []
  ] : [];
}
function qt(e, a) {
  if (!a)
    return !0;
  const r = e ?? [];
  return Ts(a).some((u) => r.includes(u));
}
function be(e) {
  const a = /* @__PURE__ */ new Set();
  for (const r of e ?? []) {
    const u = Es[r];
    if (u) {
      for (const m of u)
        a.add(m);
      continue;
    }
    a.add(r);
  }
  return Array.from(a);
}
function re(e) {
  return Math.max(0, Math.round(Number(e || 0)));
}
function As(e) {
  return String(e || "").trim() || "Hoja";
}
function Xt(e) {
  return {
    minQty: Math.max(1, Math.round(Number(e.minQty || 0))),
    unitPrice: re(e.unitPrice)
  };
}
function We(e) {
  return {
    id: String(e.id || "").trim() || crypto.randomUUID(),
    label: String(e.label || "").trim() || "Tarifa especial",
    unitPrice: re(e.unitPrice)
  };
}
function ys(e) {
  return We({
    id: `legacy-${e.customerSegment.toLowerCase()}`,
    label: e.customerSegment === "DOCENTE" ? "Tarifa docente" : "Tarifa especial",
    unitPrice: e.unitPrice
  });
}
function Is(e, a) {
  return [...e.quantityScales].map(Xt).filter((u) => u.minQty <= a && u.unitPrice > 0).sort((u, m) => m.minQty - u.minQty)[0] ?? null;
}
function Ns(e, a) {
  return a ? e.specialPriceRules.map(We).find((r) => r.id === a && r.unitPrice > 0) ?? null : null;
}
function Ee(e) {
  if (!(e != null && e.enabled))
    return null;
  const a = (e.sheetTypes ?? []).map((r) => {
    const u = "customerSegmentRules" in r ? r.customerSegmentRules ?? [] : [];
    return {
      id: String(r.id || "").trim() || crypto.randomUUID(),
      name: As(r.name),
      basePrice: re(r.basePrice),
      minimumPrice: r.minimumPrice === null || r.minimumPrice === void 0 ? null : re(r.minimumPrice),
      quantityScales: (r.quantityScales ?? []).map(Xt).filter((m) => m.unitPrice > 0).sort((m, c) => m.minQty - c.minQty).filter(
        (m, c, o) => o.findIndex((s) => s.minQty === m.minQty) === c
      ),
      specialPriceRules: [...r.specialPriceRules ?? [], ...u.map(ys)].map(We).filter((m) => m.unitPrice > 0).filter(
        (m, c, o) => o.findIndex(
          (s) => s.id === m.id || s.label.toLowerCase() === m.label.toLowerCase()
        ) === c
      )
    };
  }).filter((r) => r.basePrice > 0);
  return a.length === 0 ? null : {
    enabled: !0,
    minimumPrice: re(e.minimumPrice),
    sheetTypes: a
  };
}
function Ue(e) {
  if (!e)
    return null;
  try {
    const a = JSON.parse(e);
    return Ee(a);
  } catch {
    return null;
  }
}
function pt(e) {
  const a = Ee(e);
  return a ? JSON.stringify(a) : null;
}
function ft(e, a) {
  const r = Ee(a);
  if (!r)
    return re(e);
  const m = r.sheetTypes.flatMap((c) => [
    c.basePrice,
    ...c.quantityScales.map((o) => o.unitPrice)
  ]).filter((c) => c > 0);
  return m.length > 0 ? Math.min(...m) : re(e);
}
function hs({
  fallbackPrice: e,
  pricingConfig: a,
  qty: r,
  sheetTypeId: u,
  specialRuleId: m,
  manualUnitPrice: c,
  canOverrideMinimum: o = !1
}) {
  const s = Math.max(1, Math.round(Number(r || 1))), t = re(e), i = Ee(a);
  if (!i)
    return {
      ok: !0,
      quote: {
        unitPrice: t,
        subtotal: t * s,
        minimumPrice: 0,
        sheetTypeId: null,
        sheetTypeName: null,
        specialRuleId: null,
        specialRuleLabel: null,
        source: "FIXED_PRICE",
        sourceLabel: "Precio fijo del producto",
        priceBeforeMinimum: t,
        minimumApplied: !1
      }
    };
  const d = i.sheetTypes.find((N) => N.id === u) ?? (i.sheetTypes.length === 1 ? i.sheetTypes[0] : null);
  if (!d)
    return {
      ok: !1,
      message: "Debes seleccionar el tipo de hoja para este producto.",
      requiresSheetSelection: !0
    };
  const f = d.minimumPrice ?? i.minimumPrice;
  if (c != null) {
    const N = re(c);
    return N < f && !o ? {
      ok: !1,
      message: `El precio manual no puede quedar por debajo del minimo permitido de ${f}.`
    } : {
      ok: !0,
      quote: {
        unitPrice: N,
        subtotal: N * s,
        minimumPrice: f,
        sheetTypeId: d.id,
        sheetTypeName: d.name,
        specialRuleId: null,
        specialRuleLabel: null,
        source: "MANUAL_OVERRIDE",
        sourceLabel: "Ajuste manual autorizado",
        priceBeforeMinimum: N,
        minimumApplied: !1
      }
    };
  }
  const p = Ns(d, m);
  if (m && !p)
    return {
      ok: !1,
      message: "La tarifa especial seleccionada ya no esta disponible para este producto."
    };
  const T = Is(d, s), I = (T == null ? void 0 : T.unitPrice) ?? d.basePrice, g = (p == null ? void 0 : p.unitPrice) ?? I, y = g < f && !o ? f : g;
  return {
    ok: !0,
    quote: {
      unitPrice: y,
      subtotal: y * s,
      minimumPrice: f,
      sheetTypeId: d.id,
      sheetTypeName: d.name,
      specialRuleId: (p == null ? void 0 : p.id) ?? null,
      specialRuleLabel: (p == null ? void 0 : p.label) ?? null,
      source: p ? "SPECIAL_RULE" : T ? "QUANTITY_SCALE" : "FIXED_PRICE",
      sourceLabel: p ? p.label : T ? `Escala desde ${T.minQty} unidades` : "Precio base por hoja",
      priceBeforeMinimum: g,
      minimumApplied: y !== g
    }
  };
}
const Cs = n.object({
  name: n.string().trim().min(2).max(80)
}), bs = n.object({
  categoryId: n.string().uuid(),
  name: n.string().trim().min(2).max(80)
}), ye = n.object({
  id: n.string().uuid()
}), jt = n.enum([
  "Cédula",
  "NIT",
  "Cédula de extranjería",
  "Pasaporte",
  "Tarjeta de identidad"
]), Vt = n.object({
  internalCode: n.string().trim().max(30).optional().nullable(),
  firstName: n.string().trim().min(2).max(80),
  lastName: n.string().trim().max(80).optional().default(""),
  documentType: jt.optional().default("Cédula"),
  documentNumber: n.string().trim().max(40).optional().nullable(),
  segment: n.enum(["GENERAL", "DOCENTE"]).optional().default("GENERAL"),
  phone: n.string().trim().regex(/^\d{10}$/).optional().nullable(),
  email: n.string().trim().email().max(120).optional().nullable(),
  address: n.string().trim().max(180).optional().nullable(),
  isActive: n.boolean().optional().default(!0)
}), vs = Vt.extend({
  id: n.string().uuid()
}), zt = n.object({
  internalCode: n.string().trim().max(30).optional().nullable(),
  name: n.string().trim().min(2).max(120),
  contactName: n.string().trim().max(120).optional().nullable(),
  documentType: jt.optional().default("NIT"),
  documentNumber: n.string().trim().max(40).optional().nullable(),
  phone: n.string().trim().regex(/^\d{10}$/).optional().nullable(),
  email: n.string().trim().email().max(120).optional().nullable(),
  address: n.string().trim().max(180).optional().nullable(),
  isActive: n.boolean().optional().default(!0)
}), Ss = zt.extend({
  id: n.string().uuid()
}), ws = n.object({
  supplierId: n.string().uuid(),
  purchasedAt: n.string().datetime().optional(),
  note: n.string().trim().max(300).optional().nullable(),
  markAsPaid: n.boolean().optional().default(!1),
  paymentMedium: n.enum(["CASH", "TRANSFER", "CORRESPONDENT"]).optional().default("CASH"),
  paymentPlatformId: n.string().uuid().optional().nullable(),
  items: n.array(
    n.object({
      productId: n.string().uuid(),
      qty: n.number().int().positive(),
      cost: n.number().positive(),
      taxRate: n.number().min(0).max(1).optional().default(0.19)
    })
  ).min(1)
}), Gt = n.object({
  platformId: n.string().uuid(),
  amount: n.number().min(0)
}), Rs = n.object({
  openingCashAmount: n.number().min(0),
  openingTransferAmount: n.number().min(0).optional().default(0),
  note: n.string().trim().max(300).optional().nullable(),
  cashBreakdown: n.record(n.string(), n.number()).optional().default({}),
  correspondentBalances: n.array(Gt).optional().default([])
}), Os = n.object({
  sessionId: n.string().uuid(),
  countedCashAmount: n.number().min(0),
  countedTransferAmount: n.number().min(0).optional().default(0),
  note: n.string().trim().max(300).optional().nullable(),
  cashBreakdown: n.record(n.string(), n.number()).optional().default({}),
  correspondentBalances: n.array(Gt).optional().default([])
}), Ds = n.enum(["LIGHT", "DARK"]), Kt = n.enum(["NORMAL", "THERMAL_80", "THERMAL_50"]), Ps = n.object({
  businessName: n.string().trim().max(120).optional().nullable(),
  taxId: n.string().trim().max(40).optional().nullable(),
  address: n.string().trim().max(180).optional().nullable(),
  city: n.string().trim().max(80).optional().nullable()
}), xs = n.object({
  themeMode: Ds
}), Ls = n.object({
  invoicePrefix: n.string().trim().max(10).optional().nullable(),
  defaultReceiptTemplate: Kt.optional().default("NORMAL"),
  receiptFooter: n.string().trim().max(400).optional().nullable()
}), Us = n.object({
  defaultTaxRate: n.number().min(0).max(1).optional(),
  allowNegativeStock: n.boolean().optional()
}), _s = n.object({
  dateFrom: n.string().datetime().optional(),
  dateTo: n.string().datetime().optional(),
  cashierId: n.string().uuid().optional(),
  status: n.nativeEnum(fe).optional(),
  search: n.string().trim().max(80).optional()
}).optional().default({}), Ms = n.object({
  saleId: n.string().uuid()
}), gt = Ms.extend({
  template: Kt.optional().default("NORMAL")
});
function H(e) {
  return Math.round(e);
}
const Ht = "|||CITY|||";
function Et(e, a) {
  const r = (e == null ? void 0 : e.trim()) || "", u = (a == null ? void 0 : a.trim()) || "";
  return u ? `${r}${Ht}${u}` : r || null;
}
function Tt(e) {
  var r, u;
  if (!e)
    return { address: "", city: "" };
  const a = e.split(Ht);
  return {
    address: ((r = a[0]) == null ? void 0 : r.trim()) || "",
    city: ((u = a[1]) == null ? void 0 : u.trim()) || ""
  };
}
function Bs(e, a = 0, r = !1, u = 0) {
  const m = Number(e || 0) * (1 + Number(a || 0) / 100), c = r ? m * (1 + Number(u || 0)) : m;
  return H(c);
}
function pe(e) {
  return e === z.CARD || e === z.TRANSFER ? "Transferencia" : "Efectivo";
}
function Fs(e, a) {
  return !e || e.length <= 1 ? pe(a) : e.map((r) => `${pe(r.method)} $${r.amount.toLocaleString("es-CO")}`).join(" + ");
}
function ks(e) {
  const a = Ce(e.cashier), r = Yt(e.receiptFooter), u = e.items.map(
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
          <tbody>${u}</tbody>
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
function $s(e, a) {
  if (a === "NORMAL")
    return ks(e);
  const r = a === "THERMAL_50" ? 50 : 80, u = [e.address, e.city].filter(Boolean).join(" - "), m = Ce(e.cashier), c = Yt(e.receiptFooter), o = e.items.map(
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
            ${u ? `<p class="muted">${u}</p>` : ""}
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
            <div class="items">${o}</div>
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
async function At(e) {
  const a = e();
  if (!a || a.role !== q.ADMIN)
    throw new Error("Solo admins pueden ejecutar esta accion");
  return a;
}
function B(e, a) {
  return a ? qt(e == null ? void 0 : e.permissions, a) : !0;
}
function ke(e) {
  var a;
  return ((a = e == null ? void 0 : e.name) == null ? void 0 : a.trim()) || (e == null ? void 0 : e.username) || "Sistema";
}
function Ce(e) {
  var u;
  const a = ((u = e.name) == null ? void 0 : u.trim()) || e.username, [r] = a.split(/\s+/).filter(Boolean);
  return r || a;
}
function Yt(e) {
  const a = [
    "Esta factura de venta podra constituirse como titulo valor conforme a la legislacion comercial aplicable y cuando se cumplan los requisitos legales.",
    "En ventas a credito, la mora en el pago causara intereses a la tasa maxima legal vigente."
  ];
  return e != null && e.trim() && a.push(e.trim()), a;
}
function yt(e, a) {
  return [e.trim(), (a == null ? void 0 : a.trim()) || ""].filter(Boolean).join(" ");
}
function Re(e, a) {
  const r = a == null ? void 0 : a.trim();
  return r ? `${e || "Cédula"}: ${r}` : null;
}
async function le(e, a, r, u, m = !1) {
  var s, t, i;
  if (r.length === 0)
    return /* @__PURE__ */ new Map();
  const c = await e.auditLog.findMany({
    where: {
      entity: a,
      action: u,
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
  }), o = /* @__PURE__ */ new Map();
  for (const d of c)
    !d.entityId || o.has(d.entityId) || o.set(d.entityId, ((t = (s = d.user) == null ? void 0 : s.name) == null ? void 0 : t.trim()) || ((i = d.user) == null ? void 0 : i.username) || "Sistema");
  return o;
}
function Y(e) {
  if (!e)
    return {};
  try {
    return JSON.parse(e);
  } catch {
    return {};
  }
}
function It(e) {
  return JSON.stringify(e);
}
function Xe(e) {
  return new Map((e ?? []).map((a) => [a.platformId, Number(a.amount || 0)]));
}
function je(e) {
  return e === "TRANSFER" || e === "CORRESPONDENT" ? e : "CASH";
}
function ne(e) {
  if (!e)
    return null;
  try {
    const a = JSON.parse(e);
    return !a || typeof a != "object" || !a.medium && !a.label && !a.sourceType ? null : {
      ...a,
      medium: je(a.medium)
    };
  } catch {
    return null;
  }
}
function Oe(e) {
  return JSON.stringify(e);
}
function $e(e, a = "Movimiento de caja") {
  const r = ne(e);
  return (r == null ? void 0 : r.label) || (r == null ? void 0 : r.userNote) || e || a;
}
function de(e) {
  var a;
  return ((a = ne(e)) == null ? void 0 : a.medium) ?? "CASH";
}
function qs(e) {
  var a;
  return ((a = ne(e)) == null ? void 0 : a.platformId) ?? null;
}
function Ve(e) {
  var a;
  return ((a = ne(e)) == null ? void 0 : a.platformName) ?? null;
}
function Xs(e, a) {
  return e || a ? {
    ...e ? { gte: new Date(e) } : {},
    ...a ? { lte: new Date(a) } : {}
  } : void 0;
}
function J(e, a) {
  const r = e[a];
  return r && typeof r == "object" ? r : {};
}
function ce(e) {
  return Number(e.transferAmount ?? 0);
}
function js(e) {
  return e.reduce(
    (a, r) => {
      if (r.payments && r.payments.length > 0) {
        for (const u of r.payments)
          u.method === z.CASH && (a.cash += u.amount), (u.method === z.TRANSFER || u.method === z.CARD) && (a.transfer += u.amount);
        return a;
      }
      return r.paymentMethod === z.CASH ? a.cash += r.total : a.transfer += r.total, a;
    },
    { cash: 0, transfer: 0 }
  );
}
function Vs(e) {
  const a = /* @__PURE__ */ new Map();
  for (const r of e) {
    if (de(r.note) !== "CORRESPONDENT")
      continue;
    const m = qs(r.note);
    if (!m)
      continue;
    const c = a.get(m) ?? { manualIncome: 0, manualExpense: 0, platformName: Ve(r.note) };
    r.type === k.INCOME_IN && (c.manualIncome += r.amount), (r.type === k.EXPENSE_OUT || r.type === k.WITHDRAWAL_OUT) && (c.manualExpense += r.amount), c.platformName || (c.platformName = Ve(r.note)), a.set(m, c);
  }
  return a;
}
function Nt(e) {
  const a = Y(e.session.note), r = J(a, "opening"), u = J(a, "closing"), m = Xe(
    r.correspondentBalances ?? []
  ), c = Xe(
    u.correspondentBalances ?? []
  ), o = ce(r), s = u.transferAmount === void 0 ? null : ce(u), t = js(e.session.sales), i = e.session.movements.filter((l) => l.type === k.INCOME_IN && de(l.note) === "CASH").reduce((l, A) => l + A.amount, 0), d = e.session.movements.filter((l) => l.type === k.INCOME_IN && de(l.note) === "TRANSFER").reduce((l, A) => l + A.amount, 0), f = e.session.movements.filter(
    (l) => (l.type === k.EXPENSE_OUT || l.type === k.WITHDRAWAL_OUT) && de(l.note) === "CASH"
  ).reduce((l, A) => l + A.amount, 0), p = e.session.movements.filter(
    (l) => (l.type === k.EXPENSE_OUT || l.type === k.WITHDRAWAL_OUT) && de(l.note) === "TRANSFER"
  ).reduce((l, A) => l + A.amount, 0), T = Vs(e.session.movements), I = e.session.openingAmount + t.cash + i - f, g = o + t.transfer + d - p, y = e.platforms.map((l) => {
    const A = e.session.correspondentTransactions.filter(
      (M) => M.platform.id === l.id
    ), S = A.filter((M) => M.type.direction === F.IN).reduce((M, $) => M + $.amount, 0), L = A.filter((M) => M.type.direction === F.OUT).reduce((M, $) => M + $.amount, 0), h = A.reduce((M, $) => M + $.commissionAmount, 0), O = T.get(l.id) ?? {
      manualIncome: 0,
      manualExpense: 0,
      platformName: l.name
    }, _ = m.get(l.id) ?? 0, V = _ + S - L + h + O.manualIncome - O.manualExpense, K = c.has(l.id) ? c.get(l.id) ?? 0 : null;
    return {
      platformId: l.id,
      platform: l.name,
      openingAmount: _,
      totalIn: S,
      totalOut: L,
      totalCommission: h,
      manualIncome: O.manualIncome,
      manualExpense: O.manualExpense,
      expectedAmount: V,
      countedAmount: K,
      differenceAmount: K === null ? null : K - V
    };
  }), N = y.reduce((l, A) => l + A.openingAmount, 0), C = y.reduce((l, A) => l + A.expectedAmount, 0), b = y.reduce(
    (l, A) => l + (A.countedAmount ?? A.expectedAmount),
    0
  ), D = u.cashBreakdown && typeof u.cashBreakdown == "object" ? null : e.session.countedAmount ?? null, x = I + g + C, v = (e.session.countedAmount ?? I) + (s ?? g) + b;
  return {
    sessionMeta: a,
    opening: r,
    closing: u,
    openingTransferAmount: o,
    countedTransferAmount: s,
    salesCash: t.cash,
    salesTransfer: t.transfer,
    cashManualIncome: i,
    transferManualIncome: d,
    cashManualExpense: f,
    transferManualExpense: p,
    expectedCash: I,
    expectedTransferAmount: g,
    openingCorrespondentTotal: N,
    correspondentExpectedTotal: C,
    countedCorrespondentTotal: b,
    correspondentByPlatform: y,
    expectedAvailableTotal: x,
    countedAvailableTotal: v,
    countedCashAmount: D
  };
}
function zs() {
  const e = /* @__PURE__ */ new Date();
  return e.setHours(0, 0, 0, 0), e;
}
function Ie(e, a, r) {
  return a <= 0 ? Te.CANCELLED : e <= 0 ? Te.PAID : r && r.getTime() < zs().getTime() ? Te.OVERDUE : e < a ? Te.PARTIAL : Te.PENDING;
}
function ht(e, a) {
  return a >= e ? fe.RETURNED : a > 0 ? fe.PARTIALLY_RETURNED : fe.COMPLETED;
}
async function Gs(e) {
  const a = await e.$queryRawUnsafe(
    'PRAGMA table_info("BusinessSettings");'
  ), r = new Set(a.map((f) => f.name));
  r.has("themeMode") || await e.$executeRawUnsafe(
    `ALTER TABLE "BusinessSettings" ADD COLUMN "themeMode" TEXT NOT NULL DEFAULT 'LIGHT';`
  ), r.has("defaultReceiptTemplate") || await e.$executeRawUnsafe(
    `ALTER TABLE "BusinessSettings" ADD COLUMN "defaultReceiptTemplate" TEXT NOT NULL DEFAULT 'NORMAL';`
  );
  const u = await e.$queryRawUnsafe('PRAGMA table_info("Customer");'), m = await e.$queryRawUnsafe('PRAGMA table_info("Supplier");'), c = new Set(u.map((f) => f.name)), o = new Set(m.map((f) => f.name));
  c.has("internalCode") || await e.$executeRawUnsafe('ALTER TABLE "Customer" ADD COLUMN "internalCode" TEXT;'), o.has("internalCode") || await e.$executeRawUnsafe('ALTER TABLE "Supplier" ADD COLUMN "internalCode" TEXT;');
  const s = await e.customer.findMany({
    select: {
      id: !0,
      internalCode: !0
    },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }]
  }), t = [];
  for (const f of s) {
    const p = te({
      desiredCode: f.internalCode,
      existingCodes: t,
      prefix: "CLI",
      digits: 4,
      maxLength: 30
    });
    p !== f.internalCode && await e.customer.update({
      where: { id: f.id },
      data: { internalCode: p }
    }), t.push(p);
  }
  const i = await e.supplier.findMany({
    select: {
      id: !0,
      internalCode: !0
    },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }]
  }), d = [];
  for (const f of i) {
    const p = te({
      desiredCode: f.internalCode,
      existingCodes: d,
      prefix: "PRV",
      digits: 4,
      maxLength: 30
    });
    p !== f.internalCode && await e.supplier.update({
      where: { id: f.id },
      data: { internalCode: p }
    }), d.push(p);
  }
  await e.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "Customer_internalCode_key" ON "Customer"("internalCode");'
  ), await e.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "Supplier_internalCode_key" ON "Supplier"("internalCode");'
  );
}
function Ks(e, a) {
  return ((a || e || "PRD").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 3) || "PRD").padEnd(3, "X");
}
async function Hs(e, a, r) {
  const u = Ks(a, r), m = await e.product.count({
    where: { sku: { startsWith: u } }
  });
  return `${u}-${String(m + 1).padStart(3, "0")}`;
}
async function Ys(e) {
  const a = await e.purchase.count();
  return `CP-${String(a + 1).padStart(6, "0")}`;
}
async function j(e, a, r, u, m, c, o, s) {
  await e.auditLog.create({
    data: {
      userId: (a == null ? void 0 : a.id) ?? null,
      module: r,
      action: u,
      entity: m,
      entityId: c ?? null,
      beforeJson: o === void 0 ? null : JSON.stringify(o),
      afterJson: s === void 0 ? null : JSON.stringify(s)
    }
  });
}
function Js({
  ipcMain: e,
  prisma: a,
  getCurrentSessionUser: r,
  getConnectedAt: u
}) {
  e.handle("app:status", async () => ({
    success: !0,
    connectedAt: u().toISOString(),
    now: (/* @__PURE__ */ new Date()).toISOString()
  })), e.handle("settings:get", async () => {
    if (!r())
      return { success: !1, message: "Debes iniciar sesion" };
    const c = await a.businessSettings.findUnique({
      where: { id: "default" }
    }), o = Tt(c == null ? void 0 : c.address);
    return {
      success: !0,
      settings: {
        businessName: (c == null ? void 0 : c.businessName) || "",
        taxId: (c == null ? void 0 : c.taxId) || "",
        address: o.address,
        city: o.city,
        themeMode: (c == null ? void 0 : c.themeMode) === "DARK" ? "DARK" : "LIGHT",
        invoicePrefix: (c == null ? void 0 : c.invoicePrefix) || "FV",
        defaultTaxRate: (c == null ? void 0 : c.defaultTaxRate) ?? 0.19,
        allowNegativeStock: (c == null ? void 0 : c.allowNegativeStock) ?? !1,
        defaultReceiptTemplate: (c == null ? void 0 : c.defaultReceiptTemplate) === "THERMAL_80" || (c == null ? void 0 : c.defaultReceiptTemplate) === "THERMAL_50" ? c.defaultReceiptTemplate : "NORMAL",
        receiptFooter: (c == null ? void 0 : c.receiptFooter) || ""
      }
    };
  }), e.handle("settings:update-theme", async (m, c) => {
    const o = r();
    if (!o)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!B(o, E.settingsTheme))
      return { success: !1, message: "Tu rol no puede cambiar el tema del sistema" };
    const s = xs.safeParse(c);
    return s.success ? (await a.businessSettings.upsert({
      where: { id: "default" },
      update: {
        themeMode: s.data.themeMode
      },
      create: {
        id: "default",
        themeMode: s.data.themeMode
      }
    }), await j(a, o, "settings", "update_theme", "BusinessSettings", "default", void 0, s.data), { success: !0 }) : { success: !1, message: "Configuracion de tema invalida" };
  }), e.handle("settings:update-business", async (m, c) => {
    const o = r();
    if (!o)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!B(o, E.settingsBusiness))
      return { success: !1, message: "Tu rol no puede editar los datos del negocio" };
    const s = Ps.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos del negocio invalidos" };
    const t = s.data;
    return await a.businessSettings.upsert({
      where: { id: "default" },
      update: {
        businessName: t.businessName || null,
        taxId: t.taxId || null,
        address: Et(t.address, t.city)
      },
      create: {
        id: "default",
        businessName: t.businessName || null,
        taxId: t.taxId || null,
        address: Et(t.address, t.city)
      }
    }), await j(a, o, "settings", "update_business", "BusinessSettings", "default", void 0, t), { success: !0 };
  }), e.handle("settings:update-billing", async (m, c) => {
    const o = r();
    if (!o)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!B(o, E.settingsBilling))
      return { success: !1, message: "Tu rol no puede editar factura e impresion" };
    const s = Ls.safeParse(c);
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
    }), await j(a, o, "settings", "update_billing", "BusinessSettings", "default", void 0, t), { success: !0 };
  }), e.handle("settings:update-inventory", async (m, c) => {
    const o = r();
    if (!o)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!B(o, E.settingsInventory))
      return { success: !1, message: "Tu rol no puede editar inventario y operacion" };
    const s = Us.safeParse(c);
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
    }), await j(a, o, "settings", "update_inventory", "BusinessSettings", "default", void 0, t), { success: !0 };
  }), e.handle("cash:summary", async () => {
    if (!r())
      return { success: !1, message: "Debes iniciar sesion" };
    const [c, o, s, t] = await Promise.all([
      a.cashSession.findFirst({
        where: { status: Z.OPEN },
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
        where: { status: Z.CLOSED },
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
    ]), i = o ? (() => {
      var D;
      const g = Y(o.note), y = J(g, "closing"), N = Xe(
        y.correspondentBalances ?? []
      ), C = t.map((x) => ({
        platformId: x.id,
        platform: x.name,
        countedAmount: N.get(x.id) ?? 0
      })).filter((x) => x.countedAmount > 0), b = ce(y);
      return {
        sessionId: o.id,
        registerName: o.register.name,
        user: o.user.name ?? o.user.username,
        closedAt: ((D = o.closedAt) == null ? void 0 : D.toISOString()) ?? null,
        countedCashAmount: o.countedAmount ?? 0,
        countedTransferAmount: b,
        countedAvailableAmount: (o.countedAmount ?? 0) + b + C.reduce((x, v) => x + v.countedAmount, 0),
        closingBreakdown: y.cashBreakdown && typeof y.cashBreakdown == "object" ? y.cashBreakdown : {},
        correspondent: C
      };
    })() : null;
    if (!c)
      return {
        success: !0,
        activeSession: null,
        previousReference: i,
        recentSessions: s.map((g) => {
          var y;
          return {
            id: g.id,
            registerName: g.register.name,
            user: g.user.name ?? g.user.username,
            status: g.status,
            openedAt: g.openedAt.toISOString(),
            closedAt: ((y = g.closedAt) == null ? void 0 : y.toISOString()) ?? null,
            openingAmount: g.openingAmount,
            openingAvailableAmount: g.openingAmount + ce(J(Y(g.note), "opening")) + (J(Y(g.note), "opening").correspondentBalances ?? []).reduce((N, C) => N + Number(C.amount || 0), 0),
            countedAmount: g.countedAmount,
            countedAvailableAmount: (g.countedAmount ?? 0) + ce(J(Y(g.note), "closing")) + (J(Y(g.note), "closing").correspondentBalances ?? []).reduce((N, C) => N + Number(C.amount || 0), 0),
            differenceAmount: g.differenceAmount
          };
        })
      };
    const d = Nt({
      session: c,
      platforms: t
    }), f = c.openingAmount + d.openingTransferAmount + d.openingCorrespondentTotal, p = c.countedAmount ?? d.expectedCash, T = d.countedTransferAmount ?? d.expectedTransferAmount, I = i ? {
      cashDifferenceAmount: c.openingAmount - i.countedCashAmount,
      transferDifferenceAmount: d.openingTransferAmount - i.countedTransferAmount,
      correspondentDifferenceTotal: d.correspondentByPlatform.reduce((g, y) => {
        var C;
        const N = ((C = i.correspondent.find((b) => b.platformId === y.platformId)) == null ? void 0 : C.countedAmount) ?? 0;
        return g + (y.openingAmount - N);
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
        openingTransferAmount: d.openingTransferAmount,
        openingAvailableAmount: f,
        expectedCash: d.expectedCash,
        expectedTransferAmount: d.expectedTransferAmount,
        expectedAvailableAmount: d.expectedAvailableTotal,
        countedCashAmount: p,
        countedTransferAmount: T,
        countedAvailableAmount: p + T + d.correspondentByPlatform.reduce(
          (g, y) => g + (y.countedAmount ?? y.expectedAmount),
          0
        ),
        cashDifferenceAmount: p - d.expectedCash,
        transferDifferenceAmount: T - d.expectedTransferAmount,
        availableDifferenceAmount: p + T + d.correspondentByPlatform.reduce(
          (g, y) => g + (y.countedAmount ?? y.expectedAmount),
          0
        ) - d.expectedAvailableTotal,
        salesCash: d.salesCash,
        salesCard: 0,
        salesTransfer: d.salesTransfer,
        manualIncome: d.cashManualIncome,
        manualExpense: d.cashManualExpense,
        manualTransferIncome: d.transferManualIncome,
        manualTransferExpense: d.transferManualExpense,
        openingBreakdown: d.opening.cashBreakdown && typeof d.opening.cashBreakdown == "object" ? d.opening.cashBreakdown : {},
        closingBreakdown: d.closing.cashBreakdown && typeof d.closing.cashBreakdown == "object" ? d.closing.cashBreakdown : {},
        correspondent: d.correspondentByPlatform,
        openingComparison: I,
        recentActivity: [
          ...c.sales.flatMap(
            (g) => (g.payments && g.payments.length > 0 ? g.payments : [
              {
                method: g.paymentMethod,
                amount: g.total
              }
            ]).map((y, N) => ({
              id: `${g.id}-${y.method}-${N}`,
              createdAt: g.createdAt.toISOString(),
              type: "Venta",
              medium: y.method === z.CASH ? "Efectivo" : (y.method === z.CARD, "Transferencia"),
              detail: `${g.invoiceNumber} - ${g.customer}`,
              amount: y.amount,
              signedAmount: y.amount
            }))
          ),
          ...c.correspondentTransactions.map((g) => ({
            id: g.id,
            createdAt: g.performedAt.toISOString(),
            type: "Corresponsal",
            medium: g.platform.name,
            detail: `${g.type.name}${g.commissionAmount > 0 ? ` + comision ${g.commissionAmount.toLocaleString("es-CO")}` : ""}`,
            amount: g.amount,
            signedAmount: g.type.direction === F.OUT ? -g.amount : g.amount
          })),
          ...c.movements.map((g) => ({
            id: g.id,
            createdAt: g.createdAt.toISOString(),
            type: g.type,
            medium: de(g.note) === "TRANSFER" ? "Transferencias" : de(g.note) === "CORRESPONDENT" ? Ve(g.note) || "Corresponsal" : "Efectivo",
            detail: $e(g.note),
            amount: g.amount,
            signedAmount: g.type === k.EXPENSE_OUT || g.type === k.WITHDRAWAL_OUT ? -g.amount : g.amount
          }))
        ].sort((g, y) => new Date(y.createdAt).getTime() - new Date(g.createdAt).getTime()).slice(0, 30)
      },
      previousReference: i,
      recentSessions: s.map((g) => {
        var y;
        return {
          id: g.id,
          registerName: g.register.name,
          user: g.user.name ?? g.user.username,
          status: g.status,
          openedAt: g.openedAt.toISOString(),
          closedAt: ((y = g.closedAt) == null ? void 0 : y.toISOString()) ?? null,
          openingAmount: g.openingAmount,
          openingAvailableAmount: g.openingAmount + ce(J(Y(g.note), "opening")) + (J(Y(g.note), "opening").correspondentBalances ?? []).reduce((N, C) => N + Number(C.amount || 0), 0),
          countedAmount: g.countedAmount,
          countedAvailableAmount: (g.countedAmount ?? 0) + ce(J(Y(g.note), "closing")) + (J(Y(g.note), "closing").correspondentBalances ?? []).reduce((N, C) => N + Number(C.amount || 0), 0),
          differenceAmount: g.differenceAmount
        };
      })
    };
  }), e.handle("cash:open", async (m, c) => {
    const o = r();
    if (!o)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!B(o, E.cashOpen))
      return { success: !1, message: "Tu rol no puede abrir caja" };
    const s = Rs.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para apertura de caja" };
    if (await a.cashSession.findFirst({
      where: { status: Z.OPEN }
    }))
      return { success: !1, message: "Ya existe una caja abierta" };
    const i = await a.cashRegister.findFirst({
      where: { isActive: !0 },
      orderBy: { createdAt: "asc" }
    });
    if (!i)
      return { success: !1, message: "No hay caja activa configurada" };
    const d = s.data.openingCashAmount + s.data.openingTransferAmount + s.data.correspondentBalances.reduce((T, I) => T + Number(I.amount || 0), 0), f = It({
      opening: {
        cashBreakdown: s.data.cashBreakdown,
        transferAmount: s.data.openingTransferAmount,
        correspondentBalances: s.data.correspondentBalances,
        note: s.data.note || null
      }
    }), p = await a.cashSession.create({
      data: {
        registerId: i.id,
        userId: o.id,
        status: Z.OPEN,
        openingAmount: s.data.openingCashAmount,
        expectedAmount: d,
        note: f
      }
    });
    return await a.cashMovement.create({
      data: {
        sessionId: p.id,
        type: k.OPENING,
        amount: s.data.openingCashAmount,
        note: s.data.note || "Apertura de caja"
      }
    }), { success: !0, sessionId: p.id };
  }), e.handle("cash:close", async (m, c) => {
    const o = r();
    if (!o)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!B(o, E.cashClose))
      return { success: !1, message: "Tu rol no puede cerrar caja" };
    const s = Os.safeParse(c);
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
    if (!t || t.status !== Z.OPEN)
      return { success: !1, message: "La caja seleccionada no está abierta" };
    const i = await a.correspondentPlatform.findMany({
      orderBy: { name: "asc" }
    }), d = Nt({
      session: t,
      platforms: i
    }), f = d.expectedCash, p = s.data.countedCashAmount - f, T = d.correspondentByPlatform.reduce((b, D) => {
      var v;
      const x = (v = s.data.correspondentBalances.find((l) => l.platformId === D.platformId)) == null ? void 0 : v.amount;
      return b + Number(x ?? D.expectedAmount);
    }, 0), I = f + d.expectedTransferAmount + d.correspondentExpectedTotal, y = s.data.countedCashAmount + s.data.countedTransferAmount + T - I, N = Y(t.note), C = It({
      ...N,
      closing: {
        cashBreakdown: s.data.cashBreakdown,
        transferAmount: s.data.countedTransferAmount,
        correspondentBalances: s.data.correspondentBalances,
        note: s.data.note || null
      }
    });
    return await a.$transaction(async (b) => {
      await b.cashSession.update({
        where: { id: t.id },
        data: {
          status: Z.CLOSED,
          countedAmount: s.data.countedCashAmount,
          expectedAmount: I,
          differenceAmount: y,
          note: C,
          closedAt: /* @__PURE__ */ new Date()
        }
      }), await b.cashMovement.create({
        data: {
          sessionId: t.id,
          type: k.CLOSING,
          amount: s.data.countedCashAmount,
          note: s.data.note || "Cierre de caja"
        }
      }), y !== 0 && await b.cashMovement.create({
        data: {
          sessionId: t.id,
          type: k.DIFFERENCE,
          amount: y,
          note: Oe({
            label: `Diferencia general de cierre (${p >= 0 ? "POS" : "negativa"} en efectivo: ${p.toLocaleString("es-CO")})`,
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
    })).map((o) => {
      var s, t, i;
      return {
        id: o.id,
        internalCode: o.internalCode,
        name: o.name,
        firstName: o.firstName ?? o.name,
        lastName: o.lastName,
        username: o.username,
        documentNumber: o.documentNumber,
        email: o.email,
        phone: o.phone,
        address: o.address,
        birthDate: ((s = o.birthDate) == null ? void 0 : s.toISOString().slice(0, 10)) ?? null,
        role: o.role,
        roleProfileId: ((t = o.roleProfile) == null ? void 0 : t.id) ?? null,
        roleProfileName: ((i = o.roleProfile) == null ? void 0 : i.name) ?? null,
        isActive: o.isActive,
        createdAt: o.createdAt.toISOString(),
        salesCount: o._count.sales,
        sessionsCount: o._count.cashSessions
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
    })).map((o) => ({
      id: o.id,
      name: o.name,
      isActive: o.isActive,
      subcategories: o.subcategories.map((s) => ({
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
    }), o = c.map((i) => i.id), s = await le(a, "Product", o, "create"), t = await le(a, "Product", o, "update", !0);
    return {
      success: !0,
      products: c.map((i) => {
        var d, f;
        return {
          id: i.id,
          name: i.name,
          sku: i.sku,
          barcode: i.barcode,
          unitMeasure: i.unitMeasure,
          price: i.price,
          pricingConfig: Ue(i.pricingConfigJson),
          cost: i.cost,
          marginPercent: i.marginPercent,
          hasTax: i.hasTax,
          taxRate: i.taxRate,
          stock: i.stock,
          categoryId: i.categoryId,
          subcategoryId: i.subcategoryId,
          categoryName: ((d = i.category) == null ? void 0 : d.name) ?? null,
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
    var I;
    const o = r();
    if (!o)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!B(o, E.productsCreate))
      return { success: !1, message: "Tu rol no puede crear productos" };
    const s = ds.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para el producto" };
    const t = s.data, i = t.categoryId ? await a.productCategory.findUnique({ where: { id: t.categoryId } }) : null, d = ((I = t.sku) == null ? void 0 : I.trim()) || await Hs(a, t.name, i == null ? void 0 : i.name), f = Ee(t.pricingConfig), p = pt(f), T = p ? ft(t.price, f) : H(t.price);
    try {
      const g = await a.$transaction(async (y) => {
        const N = await y.product.create({
          data: {
            name: t.name,
            sku: d,
            barcode: t.barcode || null,
            unitMeasure: t.unitMeasure ?? "UNIDAD",
            price: T,
            pricingConfigJson: p,
            cost: H(t.cost ?? 0),
            marginPercent: t.marginPercent ?? 0,
            hasTax: t.hasTax ?? !1,
            taxRate: t.hasTax ? t.taxRate ?? 0 : 0,
            stock: t.stock ?? 0,
            categoryId: t.categoryId ?? null,
            subcategoryId: t.subcategoryId ?? null,
            isActive: t.isActive ?? !0
          }
        });
        return (t.stock ?? 0) > 0 && await y.inventoryMovement.create({
          data: {
            productId: N.id,
            type: Ne.MANUAL_IN,
            qty: t.stock ?? 0,
            stockBefore: 0,
            stockAfter: t.stock ?? 0,
            referenceType: "PRODUCT_CREATE",
            referenceId: N.id,
            note: `Stock inicial registrado por ${ke(o)}`
          }
        }), N;
      });
      return await j(a, o, "products", "create", "Product", g.id, void 0, {
        name: g.name,
        sku: g.sku
      }), { success: !0, productId: g.id };
    } catch (g) {
      return { success: !1, message: g instanceof Error ? g.message : "No se pudo crear el producto" };
    }
  }), e.handle("products:update", async (m, c) => {
    const o = r();
    if (!o)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!B(o, E.productsEdit))
      return { success: !1, message: "Tu rol no puede editar productos" };
    const s = us.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para actualizar el producto" };
    const t = await a.product.findUnique({ where: { id: s.data.id } });
    if (!t)
      return { success: !1, message: "Producto no encontrado" };
    const i = s.data.pricingConfig === void 0 ? Ue(t.pricingConfigJson) : Ee(s.data.pricingConfig), d = i && i.enabled ? ft(s.data.price ?? t.price, i) : H(s.data.price === void 0 ? t.price : s.data.price);
    try {
      return await a.$transaction(async (f) => {
        if (await f.product.update({
          where: { id: s.data.id },
          data: {
            name: s.data.name ?? t.name,
            sku: s.data.sku ?? t.sku,
            barcode: s.data.barcode === void 0 ? t.barcode : s.data.barcode,
            unitMeasure: s.data.unitMeasure ?? t.unitMeasure,
            price: d,
            pricingConfigJson: s.data.pricingConfig === void 0 ? t.pricingConfigJson : pt(i),
            cost: s.data.cost === void 0 ? t.cost : H(s.data.cost),
            marginPercent: s.data.marginPercent ?? t.marginPercent,
            hasTax: s.data.hasTax ?? t.hasTax,
            taxRate: s.data.hasTax === !1 ? 0 : s.data.taxRate ?? t.taxRate,
            stock: s.data.stock ?? t.stock,
            categoryId: s.data.categoryId === void 0 ? t.categoryId : s.data.categoryId,
            subcategoryId: s.data.subcategoryId === void 0 ? t.subcategoryId : s.data.subcategoryId,
            isActive: s.data.isActive ?? t.isActive
          }
        }), s.data.stock !== void 0 && s.data.stock !== t.stock) {
          const p = s.data.stock - t.stock;
          await f.inventoryMovement.create({
            data: {
              productId: t.id,
              type: p > 0 ? Ne.ADJUSTMENT_IN : Ne.ADJUSTMENT_OUT,
              qty: Math.abs(p),
              stockBefore: t.stock,
              stockAfter: s.data.stock,
              referenceType: "PRODUCT_EDIT",
              referenceId: t.id,
              note: `Ajuste manual por ${ke(o)}`
            }
          });
        }
      }), await j(a, o, "products", "update", "Product", t.id, t, s.data), { success: !0 };
    } catch (f) {
      return { success: !1, message: f instanceof Error ? f.message : "No se pudo actualizar el producto" };
    }
  }), e.handle("products:delete", async (m, c) => {
    const o = await At(r);
    if (!B(o, E.productsDelete))
      return { success: !1, message: "Tu rol no puede archivar productos" };
    const s = ye.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Producto invalido" };
    const t = await a.product.findUnique({ where: { id: s.data.id } });
    return t ? (await a.product.update({
      where: { id: s.data.id },
      data: { isActive: !1 }
    }), await j(a, o, "products", "archive", "Product", t.id, t, {
      isActive: !1
    }), { success: !0 }) : { success: !1, message: "Producto no encontrado" };
  }), e.handle("products:category:create", async (m, c) => {
    const o = r();
    if (!o)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!B(o, E.productsEdit))
      return { success: !1, message: "Tu rol no puede administrar categorias" };
    const s = Cs.safeParse(c);
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
    const o = r();
    if (!o)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!B(o, E.productsEdit))
      return { success: !1, message: "Tu rol no puede administrar categorias" };
    const s = ye.safeParse(c);
    return s.success ? (await a.productCategory.delete({
      where: { id: s.data.id }
    }), { success: !0 }) : { success: !1, message: "Categoria invalida" };
  }), e.handle("products:subcategory:create", async (m, c) => {
    const o = r();
    if (!o)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!B(o, E.productsEdit))
      return { success: !1, message: "Tu rol no puede administrar subcategorias" };
    const s = bs.safeParse(c);
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
    const o = r();
    if (!o)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!B(o, E.productsEdit))
      return { success: !1, message: "Tu rol no puede administrar subcategorias" };
    const s = ye.safeParse(c);
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
    }), o = c.map((t) => t.id), s = await le(a, "Customer", o, "create");
    return {
      success: !0,
      customers: c.map((t) => ({
        id: t.id,
        internalCode: t.internalCode,
        name: t.name,
        document: t.document,
        segment: t.segment,
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
    const o = r();
    if (!o)
      return { success: !1, message: "Debes iniciar sesion", sales: [] };
    if (!B(o, E.salesHistory))
      return { success: !1, message: "Tu rol no puede ver facturas del POS", sales: [] };
    const s = ye.safeParse(c);
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
        cashier: Ce(i.cashier),
        itemsCount: i.items.reduce((d, f) => d + f.qty, 0)
      }))
    } : { success: !1, message: "Cliente invalido", sales: [] };
  }), e.handle("customers:create", async (m, c) => {
    const o = r();
    if (!o)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!B(o, E.customersCreate))
      return { success: !1, message: "Tu rol no puede crear clientes" };
    const s = Vt.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para el cliente" };
    try {
      const t = (await a.customer.findMany({
        select: { internalCode: !0 }
      })).map((f) => f.internalCode), i = te({
        desiredCode: null,
        existingCodes: t,
        prefix: "CLI",
        digits: 4,
        maxLength: 30
      }), d = await a.customer.create({
        data: {
          internalCode: i,
          name: yt(s.data.firstName, s.data.lastName),
          document: Re(s.data.documentType, s.data.documentNumber),
          segment: s.data.segment,
          phone: s.data.phone || null,
          email: s.data.email || null,
          address: s.data.address || null,
          creditLimit: 0,
          notes: null,
          isActive: !0
        }
      });
      return await j(a, o, "customers", "create", "Customer", d.id, void 0, {
        name: d.name,
        document: d.document
      }), { success: !0, customerId: d.id };
    } catch (t) {
      return { success: !1, message: t instanceof Error ? t.message : "No se pudo crear el cliente. Verifica documento o correo duplicado." };
    }
  }), e.handle("customers:update", async (m, c) => {
    const o = r();
    if (!o)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!B(o, E.customersEdit))
      return { success: !1, message: "Tu rol no puede editar clientes" };
    const s = vs.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para actualizar el cliente" };
    const t = await a.customer.findUnique({ where: { id: s.data.id } });
    if (!t)
      return { success: !1, message: "Cliente no encontrado" };
    try {
      const i = (await a.customer.findMany({
        where: { NOT: { id: t.id } },
        select: { internalCode: !0 }
      })).map((p) => p.internalCode), f = {
        internalCode: te({
          desiredCode: t.internalCode,
          existingCodes: i,
          prefix: "CLI",
          digits: 4,
          maxLength: 30
        }),
        name: yt(s.data.firstName, s.data.lastName),
        document: Re(s.data.documentType, s.data.documentNumber),
        segment: s.data.segment ?? t.segment,
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
      }), await j(a, o, "customers", "update", "Customer", t.id, t, f), { success: !0 };
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
    }), o = c.map((t) => t.id), s = await le(a, "Supplier", o, "create");
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
    const o = r();
    if (!o)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!B(o, E.suppliersCreate))
      return { success: !1, message: "Tu rol no puede crear proveedores" };
    const s = zt.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para el proveedor" };
    try {
      const t = (await a.supplier.findMany({
        select: { internalCode: !0 }
      })).map((f) => f.internalCode), i = te({
        desiredCode: null,
        existingCodes: t,
        prefix: "PRV",
        digits: 4,
        maxLength: 30
      }), d = await a.supplier.create({
        data: {
          internalCode: i,
          name: s.data.name,
          taxId: Re(s.data.documentType, s.data.documentNumber),
          phone: s.data.phone || null,
          email: s.data.email || null,
          address: s.data.address || null,
          contactName: s.data.contactName || null,
          isActive: !0
        }
      });
      return await j(a, o, "suppliers", "create", "Supplier", d.id, void 0, {
        name: d.name,
        taxId: d.taxId
      }), { success: !0, supplierId: d.id };
    } catch (t) {
      return { success: !1, message: t instanceof Error ? t.message : "No se pudo crear el proveedor. Verifica documento o correo duplicado." };
    }
  }), e.handle("suppliers:update", async (m, c) => {
    const o = r();
    if (!o)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!B(o, E.suppliersEdit))
      return { success: !1, message: "Tu rol no puede editar proveedores" };
    const s = Ss.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para actualizar el proveedor" };
    const t = await a.supplier.findUnique({ where: { id: s.data.id } });
    if (!t)
      return { success: !1, message: "Proveedor no encontrado" };
    try {
      const i = (await a.supplier.findMany({
        where: { NOT: { id: t.id } },
        select: { internalCode: !0 }
      })).map((p) => p.internalCode), f = {
        internalCode: te({
          desiredCode: t.internalCode,
          existingCodes: i,
          prefix: "PRV",
          digits: 4,
          maxLength: 30
        }),
        name: s.data.name,
        taxId: Re(s.data.documentType, s.data.documentNumber),
        phone: s.data.phone || null,
        email: s.data.email || null,
        address: s.data.address || null,
        contactName: s.data.contactName || null,
        isActive: s.data.isActive ?? t.isActive
      };
      return await a.supplier.update({
        where: { id: t.id },
        data: f
      }), await j(a, o, "suppliers", "update", "Supplier", t.id, t, f), { success: !0 };
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
    }), o = c.map((t) => t.id), s = await le(a, "Purchase", o, "create");
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
        itemsCount: t.items.reduce((i, d) => i + d.qty, 0),
        createdBy: s.get(t.id) ?? null
      }))
    };
  }), e.handle("purchases:get-detail", async (m, c) => {
    const o = r();
    if (!o)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!B(o, E.purchasesDetails))
      return { success: !1, message: "Tu rol no puede ver el detalle de compras" };
    const s = ye.safeParse(c);
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
    const i = await le(a, "Purchase", [t.id], "create");
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
        items: t.items.map((d) => ({
          id: d.id,
          productName: d.product.name,
          productSku: d.product.sku,
          qty: d.qty,
          cost: d.cost,
          taxRate: d.taxRate,
          subtotal: d.subtotal,
          total: d.subtotal + H(d.subtotal * d.taxRate)
        }))
      }
    };
  }), e.handle("purchases:create", async (m, c) => {
    const o = await At(r);
    if (!B(o, E.purchasesCreate))
      return { success: !1, message: "Tu rol no puede registrar compras" };
    const s = ws.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para la compra" };
    const t = await a.supplier.findUnique({ where: { id: s.data.supplierId } });
    if (!t)
      return { success: !1, message: "Proveedor no encontrado" };
    const i = s.data.items.map((v) => v.productId), d = await a.product.findMany({
      where: {
        id: { in: i },
        isActive: !0
      }
    });
    if (d.length !== i.length)
      return { success: !1, message: "Uno o más productos no están disponibles" };
    const f = new Map(d.map((v) => [v.id, v])), p = s.data.items.map((v) => {
      const l = f.get(v.productId);
      if (!l)
        throw new Error("Producto no encontrado");
      const A = H(v.cost * v.qty), S = H(A * (v.taxRate ?? 0));
      return {
        product: l,
        qty: v.qty,
        cost: H(v.cost),
        taxRate: v.taxRate ?? 0,
        subtotal: A,
        tax: S,
        total: A + S
      };
    }), T = p.reduce((v, l) => v + l.subtotal, 0), I = p.reduce((v, l) => v + l.tax, 0), g = T + I, y = s.data.purchasedAt ? new Date(s.data.purchasedAt) : /* @__PURE__ */ new Date(), N = s.data.markAsPaid ? ct.PAID : ct.RECEIVED, C = s.data.markAsPaid ? 0 : g, b = je(s.data.paymentMedium), D = b === "CORRESPONDENT" && s.data.paymentPlatformId ? await a.correspondentPlatform.findUnique({
      where: { id: s.data.paymentPlatformId },
      select: { id: !0, name: !0 }
    }) : null;
    if (b === "CORRESPONDENT" && !D)
      return { success: !1, message: "Selecciona un corresponsal valido para pagar la compra" };
    const x = s.data.markAsPaid ? await a.cashSession.findFirst({
      where: { status: Z.OPEN },
      orderBy: { openedAt: "desc" }
    }) : null;
    if (s.data.markAsPaid && !x)
      return { success: !1, message: "Abre el control diario antes de registrar compras pagadas" };
    try {
      const v = await a.$transaction(async (l) => {
        const A = await Ys(l), S = await l.purchase.create({
          data: {
            supplierId: s.data.supplierId,
            number: A,
            status: N,
            subtotal: T,
            tax: I,
            total: g,
            balance: C,
            note: s.data.note || null,
            purchasedAt: y,
            items: {
              create: p.map((L) => ({
                productId: L.product.id,
                qty: L.qty,
                cost: L.cost,
                taxRate: L.taxRate,
                subtotal: L.subtotal
              }))
            }
          }
        });
        for (const L of p) {
          const h = L.product.stock + L.qty, O = h <= 0 ? L.cost : H((L.product.stock * L.product.cost + L.subtotal) / h), _ = Bs(
            O,
            L.product.marginPercent,
            L.product.hasTax,
            L.product.taxRate
          );
          await l.product.update({
            where: { id: L.product.id },
            data: {
              stock: h,
              cost: O,
              price: _
            }
          }), await l.inventoryMovement.create({
            data: {
              productId: L.product.id,
              type: Ne.PURCHASE_IN,
              qty: L.qty,
              stockBefore: L.product.stock,
              stockAfter: h,
              referenceType: "PURCHASE",
              referenceId: S.id,
              note: `${S.number} - ${t.name} - registrado por ${ke(o)}`
            }
          });
        }
        return s.data.markAsPaid && x && await l.cashMovement.create({
          data: {
            sessionId: x.id,
            type: k.EXPENSE_OUT,
            amount: g,
            note: Oe({
              label: `Compra pagada ${S.number} - ${t.name}`,
              medium: b,
              platformId: (D == null ? void 0 : D.id) ?? null,
              platformName: (D == null ? void 0 : D.name) ?? null,
              sourceType: "PURCHASE",
              userNote: s.data.note || null
            })
          }
        }), S;
      });
      return await j(a, o, "purchases", "create", "Purchase", v.id, void 0, {
        number: v.number,
        supplier: t.name,
        total: v.total,
        markAsPaid: s.data.markAsPaid,
        paymentMedium: b,
        paymentPlatform: (D == null ? void 0 : D.name) ?? null
      }), { success: !0, purchaseId: v.id };
    } catch (v) {
      return { success: !1, message: v instanceof Error ? v.message : "No se pudo registrar la compra" };
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
    })).map((o) => ({
      id: o.id,
      productId: o.productId,
      productName: o.product.name,
      productSku: o.product.sku,
      type: o.type,
      qty: o.qty,
      stockBefore: o.stockBefore,
      stockAfter: o.stockAfter,
      referenceType: o.referenceType,
      referenceId: o.referenceId,
      note: o.note,
      createdAt: o.createdAt.toISOString()
    }))
  } : { success: !1, message: "Debes iniciar sesion", moves: [] }), e.handle("sales:list", async (m, c) => {
    var f;
    if (!r())
      return { success: !1, message: "Debes iniciar sesion", sales: [] };
    const s = _s.safeParse(c);
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
      })).map((p) => ({
        id: p.id,
        invoiceNumber: p.invoiceNumber,
        customer: p.customer,
        paymentMethod: p.paymentMethod,
        subtotal: p.subtotal,
        tax: p.tax,
        total: p.total,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        cashier: Ce(p.cashier),
        itemsCount: p.items.reduce((T, I) => T + I.qty, 0)
      }))
    };
  }), e.handle("sales:get-detail", async (m, c) => {
    if (!r())
      return { success: !1, message: "Debes iniciar sesion" };
    const s = gt.safeParse(c);
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
        cashier: Ce(t.cashier),
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
    const o = r();
    if (!o)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!B(o, E.salesPrint))
      return { success: !1, message: "Tu rol no puede imprimir facturas" };
    const s = gt.safeParse(c);
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
    const d = Tt(i == null ? void 0 : i.address), f = $s({
      businessName: i == null ? void 0 : i.businessName,
      taxId: i == null ? void 0 : i.taxId,
      address: d.address,
      city: d.city,
      receiptFooter: i == null ? void 0 : i.receiptFooter,
      invoiceNumber: t.invoiceNumber,
      customer: t.customer,
      paymentSummary: Fs(t.payments, t.paymentMethod),
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
    }, s.data.template), p = new Ge({
      show: !1,
      webPreferences: {
        sandbox: !1
      }
    });
    return await p.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(f)}`), await new Promise((T) => {
      p.webContents.print(
        {
          silent: !1,
          printBackground: !0
        },
        (I, g) => {
          if (p.close(), !I) {
            T({ success: !1, message: g || "No se pudo imprimir" });
            return;
          }
          T({ success: !0 });
        }
      );
    });
  }), e.handle("accounting:summary", async (m, c) => {
    const o = r();
    if (!o)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!B(o, E.reportsView))
      return { success: !1, message: "Tu rol no puede consultar contabilidad" };
    const s = es.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Filtros invalidos" };
    const t = Xs(s.data.dateFrom, s.data.dateTo), [i, d, f, p, T, I] = await Promise.all([
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
          status: { not: fe.CANCELLED }
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
          type: { in: [k.EXPENSE_OUT, k.WITHDRAWAL_OUT] }
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
    ]), g = f.map((l) => {
      var S;
      const A = Ie(l.balance, l.total, l.dueDate);
      return {
        id: l.id,
        saleId: l.saleId,
        invoiceNumber: l.sale.invoiceNumber,
        customerId: l.customerId,
        customerName: l.customer.name,
        total: l.total,
        balance: l.balance,
        paidAmount: l.payments.reduce((L, h) => L + h.amount, 0),
        status: A,
        dueDate: ((S = l.dueDate) == null ? void 0 : S.toISOString()) ?? null,
        createdAt: l.createdAt.toISOString()
      };
    }), y = d.map((l) => {
      var K, M;
      const A = l.returns.reduce(($, U) => $ + U.total, 0), S = l.credits[0] ?? null, L = l.payments.reduce(($, U) => $ + U.amount, 0), h = Math.max(l.total - A, 0), O = S ? S.balance : Math.max(h - L, 0), _ = A >= l.total ? "RETURNED" : O <= 0 ? "PAID" : L > 0 ? "PARTIAL" : "PENDING", V = l.payments.length ? l.payments.map(($) => `${pe($.method)} $${$.amount.toLocaleString("es-CO")}`).join(" + ") : S ? "Pendiente por cartera" : pe(l.paymentMethod);
      return {
        id: l.id,
        invoiceNumber: l.invoiceNumber,
        customer: l.customer,
        customerId: ((K = l.customerRef) == null ? void 0 : K.id) ?? null,
        total: l.total,
        paidAtSale: L,
        pendingAmount: O,
        returnedTotal: A,
        grossProfit: l.profit,
        paymentSummary: V,
        collectionStatus: _,
        status: l.status,
        createdAt: l.createdAt.toISOString(),
        availableCreditTotal: Math.max(l.total - A, 0),
        availableCreditNoteTotal: Math.max(l.total - A, 0),
        credit: S ? {
          id: S.id,
          total: S.total,
          balance: S.balance,
          status: Ie(S.balance, S.total, S.dueDate),
          dueDate: ((M = S.dueDate) == null ? void 0 : M.toISOString()) ?? null
        } : null
      };
    }), N = /* @__PURE__ */ new Map();
    for (const l of [z.CASH, z.CARD, z.TRANSFER])
      N.set(l, { salesAmount: 0, collectionsAmount: 0 });
    for (const l of d) {
      if (l.payments.length === 0) {
        const A = N.get(l.paymentMethod) ?? { salesAmount: 0, collectionsAmount: 0 };
        A.salesAmount += l.total, N.set(l.paymentMethod, A);
        continue;
      }
      for (const A of l.payments) {
        const S = N.get(A.method) ?? { salesAmount: 0, collectionsAmount: 0 };
        S.salesAmount += A.amount, N.set(A.method, S);
      }
    }
    for (const l of p) {
      const A = N.get(l.method) ?? { salesAmount: 0, collectionsAmount: 0 };
      A.collectionsAmount += l.amount, N.set(l.method, A);
    }
    const C = y.reduce((l, A) => l + A.paidAtSale, 0), b = p.reduce((l, A) => l + A.amount, 0), D = y.reduce((l, A) => l + A.pendingAmount, 0), x = y.reduce((l, A) => l + A.grossProfit, 0), v = [
      ...y.map((l) => ({
        id: `sale-${l.id}`,
        createdAt: l.createdAt,
        category: "SALE",
        title: `Venta ${l.invoiceNumber}`,
        detail: `${l.customer} | cobrado al momento $${l.paidAtSale.toLocaleString("es-CO")} | pendiente $${l.pendingAmount.toLocaleString("es-CO")}`,
        medium: l.paymentSummary,
        amount: l.total,
        direction: "IN",
        reference: l.invoiceNumber,
        operationalImpact: l.paidAtSale
      })),
      ...p.map((l) => {
        var A, S;
        return {
          id: `collection-${l.id}`,
          createdAt: l.createdAt.toISOString(),
          category: "COLLECTION",
          title: `Abono cartera ${((A = l.credit) == null ? void 0 : A.sale.invoiceNumber) ?? ""}`.trim(),
          detail: `${l.customer.name} | ${l.note || "Sin detalle"}`,
          medium: pe(l.method),
          amount: l.amount,
          direction: "IN",
          reference: ((S = l.credit) == null ? void 0 : S.sale.invoiceNumber) ?? null,
          operationalImpact: l.amount
        };
      }),
      ...T.map((l) => ({
        id: `credit-note-${l.id}`,
        createdAt: l.createdAt.toISOString(),
        category: "CREDIT_NOTE",
        title: `Nota credito ${l.sale.invoiceNumber}`,
        detail: `${l.sale.customer} | ${l.reason || "Ajuste sobre venta"}`,
        medium: "Ajuste comercial",
        amount: l.total,
        direction: "OUT",
        reference: l.sale.invoiceNumber,
        operationalImpact: -l.total
      })),
      ...I.map((l) => {
        var A, S, L;
        return {
          id: `expense-${l.id}`,
          createdAt: l.createdAt.toISOString(),
          category: "EXPENSE",
          title: l.type === k.WITHDRAWAL_OUT ? "Retiro operativo" : "Gasto operativo",
          detail: $e(l.note),
          medium: ((A = ne(l.note)) == null ? void 0 : A.medium) === "CORRESPONDENT" ? ((S = ne(l.note)) == null ? void 0 : S.platformName) || "Corresponsal" : ((L = ne(l.note)) == null ? void 0 : L.medium) === "TRANSFER" ? "Transferencias" : "Efectivo",
          amount: l.amount,
          direction: "OUT",
          reference: null,
          operationalImpact: -l.amount
        };
      })
    ].sort((l, A) => new Date(A.createdAt).getTime() - new Date(l.createdAt).getTime()).slice(0, 250);
    return {
      success: !0,
      summary: {
        salesCount: y.length,
        salesTotal: y.reduce((l, A) => l + A.total, 0),
        collectedSalesTotal: C,
        pendingSalesBalance: D,
        pendingCreditsCount: g.filter((l) => l.balance > 0).length,
        pendingCreditsBalance: g.reduce((l, A) => l + A.balance, 0),
        paymentsTotal: b,
        collectionsTotal: b,
        operationalIncomeTotal: C + b,
        creditNotesTotal: T.reduce((l, A) => l + A.total, 0),
        expensesTotal: I.reduce((l, A) => l + A.amount, 0),
        grossProfitTotal: x,
        averageTicket: y.length > 0 ? H(y.reduce((l, A) => l + A.total, 0) / y.length) : 0,
        netOperationalBalance: C + b - T.reduce((l, A) => l + A.total, 0) - I.reduce((l, A) => l + A.amount, 0)
      },
      customers: i.map((l) => ({
        id: l.id,
        internalCode: l.internalCode,
        name: l.name,
        document: l.document,
        phone: l.phone
      })),
      paymentSummary: [...N.entries()].map(([l, A]) => ({
        method: l,
        label: pe(l),
        salesAmount: A.salesAmount,
        collectionsAmount: A.collectionsAmount,
        totalAmount: A.salesAmount + A.collectionsAmount
      })),
      movementHistory: v,
      sales: y,
      credits: g,
      payments: p.map((l) => {
        var A, S;
        return {
          id: l.id,
          creditId: l.creditId,
          saleId: ((A = l.credit) == null ? void 0 : A.sale.id) ?? null,
          invoiceNumber: ((S = l.credit) == null ? void 0 : S.sale.invoiceNumber) ?? null,
          customerName: l.customer.name,
          method: l.method,
          amount: l.amount,
          note: l.note,
          createdAt: l.createdAt.toISOString()
        };
      }),
      creditNotes: T.map((l) => ({
        id: l.id,
        saleId: l.saleId,
        invoiceNumber: l.sale.invoiceNumber,
        customerName: l.sale.customer,
        total: l.total,
        reason: l.reason,
        createdAt: l.createdAt.toISOString()
      })),
      expenses: I.map((l) => {
        const A = ne(l.note);
        return {
          id: l.id,
          sessionId: l.sessionId,
          registerName: l.session.register.name,
          userName: l.session.user.name ?? l.session.user.username,
          type: l.type,
          amount: l.amount,
          note: $e(l.note),
          sourceMedium: (A == null ? void 0 : A.medium) ?? "CASH",
          sourcePlatform: (A == null ? void 0 : A.platformName) ?? null,
          createdAt: l.createdAt.toISOString()
        };
      })
    };
  }), e.handle("accounting:credit:create", async (m, c) => {
    const o = r();
    if (!o)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!B(o, E.reportsView))
      return { success: !1, message: "Tu rol no puede registrar cartera" };
    const s = ts.safeParse(c);
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
    const d = t.returns.reduce((T, I) => T + I.total, 0), f = Math.max(t.total - d, 0), p = s.data.total ?? f;
    if (f <= 0)
      return { success: !1, message: "La venta no tiene saldo disponible para cartera" };
    if (p > f)
      return { success: !1, message: "El valor supera el saldo disponible de la venta" };
    try {
      const T = await a.$transaction(async (I) => {
        const g = await I.customerCredit.create({
          data: {
            customerId: i.id,
            saleId: t.id,
            total: p,
            balance: p,
            dueDate: s.data.dueDate ? new Date(s.data.dueDate) : null,
            status: Ie(p, p, s.data.dueDate ? new Date(s.data.dueDate) : null)
          }
        });
        return await I.sale.update({
          where: { id: t.id },
          data: {
            customerId: i.id,
            customer: i.name,
            status: fe.CREDIT
          }
        }), g;
      });
      return await j(a, o, "accounting", "create", "CustomerCredit", T.id, void 0, {
        saleId: t.id,
        customerId: i.id,
        total: p
      }), { success: !0, creditId: T.id, message: "Cuenta por cobrar creada correctamente." };
    } catch (T) {
      return { success: !1, message: T instanceof Error ? T.message : "No se pudo crear la cuenta por cobrar" };
    }
  }), e.handle("accounting:payment:create", async (m, c) => {
    const o = r();
    if (!o)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!B(o, E.reportsView))
      return { success: !1, message: "Tu rol no puede registrar pagos" };
    const s = as.safeParse(c);
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
      where: { status: Z.OPEN },
      orderBy: { openedAt: "desc" }
    });
    if (!i)
      return { success: !1, message: "Abre el control diario antes de registrar abonos" };
    try {
      const d = await a.$transaction(async (f) => {
        const p = await f.customerPayment.create({
          data: {
            customerId: t.customerId,
            creditId: t.id,
            method: s.data.method,
            amount: s.data.amount,
            note: s.data.note || null
          }
        }), T = t.total - t.balance + s.data.amount, I = Math.max(t.total - T, 0), g = Ie(I, t.total, t.dueDate);
        if (await f.customerCredit.update({
          where: { id: t.id },
          data: {
            balance: I,
            status: g
          }
        }), await f.cashMovement.create({
          data: {
            sessionId: i.id,
            type: k.INCOME_IN,
            amount: s.data.amount,
            note: Oe({
              label: `Abono cartera ${t.sale.invoiceNumber}`,
              medium: s.data.method === z.CASH ? "CASH" : "TRANSFER",
              sourceType: "ACCOUNTING_PAYMENT",
              userNote: s.data.note || null
            })
          }
        }), I <= 0) {
          const y = t.sale.returns.reduce((N, C) => N + C.total, 0);
          await f.sale.update({
            where: { id: t.saleId },
            data: {
              status: ht(t.sale.total, y)
            }
          });
        }
        return p;
      });
      return await j(a, o, "accounting", "create", "CustomerPayment", d.id, void 0, {
        creditId: t.id,
        amount: s.data.amount,
        method: s.data.method
      }), { success: !0, paymentId: d.id, message: "Abono registrado correctamente." };
    } catch (d) {
      return { success: !1, message: d instanceof Error ? d.message : "No se pudo registrar el abono" };
    }
  }), e.handle("accounting:credit-note:create", async (m, c) => {
    const o = r();
    if (!o)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!B(o, E.reportsView))
      return { success: !1, message: "Tu rol no puede registrar notas credito" };
    const s = ss.safeParse(c);
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
    const i = t.returns.reduce((f, p) => f + p.total, 0), d = Math.max(t.total - i, 0);
    if (d <= 0)
      return { success: !1, message: "La venta no tiene saldo disponible para nota credito" };
    if (s.data.amount > d)
      return { success: !1, message: "La nota credito supera el saldo disponible de la venta" };
    try {
      const f = await a.$transaction(async (p) => {
        const T = await p.saleReturn.create({
          data: {
            saleId: t.id,
            total: s.data.amount,
            reason: s.data.reason || null
          }
        }), I = i + s.data.amount;
        await p.sale.update({
          where: { id: t.id },
          data: {
            status: ht(t.total, I)
          }
        });
        const g = t.credits[0];
        if (g) {
          const y = Math.max(g.total - g.balance, 0), N = Math.max(g.total - s.data.amount, 0), C = Math.max(N - y, 0);
          await p.customerCredit.update({
            where: { id: g.id },
            data: {
              total: N,
              balance: C,
              status: Ie(C, N, g.dueDate)
            }
          });
        }
        return T;
      });
      return await j(a, o, "accounting", "create", "SaleReturn", f.id, void 0, {
        saleId: t.id,
        total: s.data.amount
      }), { success: !0, creditNoteId: f.id, message: "Nota credito registrada correctamente." };
    } catch (f) {
      return { success: !1, message: f instanceof Error ? f.message : "No se pudo registrar la nota credito" };
    }
  }), e.handle("accounting:expense:create", async (m, c) => {
    const o = r();
    if (!o)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!B(o, E.reportsView))
      return { success: !1, message: "Tu rol no puede registrar gastos" };
    const s = rs.safeParse(c);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para el gasto" };
    const t = await a.cashSession.findFirst({
      where: { status: Z.OPEN },
      orderBy: { openedAt: "desc" }
    });
    if (!t)
      return { success: !1, message: "Abre caja general antes de registrar gastos o retiros" };
    const i = je(s.data.sourceMedium), d = i === "CORRESPONDENT" && s.data.sourcePlatformId ? await a.correspondentPlatform.findUnique({
      where: { id: s.data.sourcePlatformId },
      select: { id: !0, name: !0 }
    }) : null;
    if (i === "CORRESPONDENT" && !d)
      return { success: !1, message: "Selecciona un corresponsal valido para registrar el egreso" };
    try {
      const f = await a.cashMovement.create({
        data: {
          sessionId: t.id,
          type: s.data.type,
          amount: s.data.amount,
          note: Oe({
            label: s.data.note,
            medium: i,
            platformId: (d == null ? void 0 : d.id) ?? null,
            platformName: (d == null ? void 0 : d.name) ?? null,
            sourceType: "EXPENSE",
            userNote: s.data.note
          })
        }
      });
      return await j(a, o, "accounting", "create", "CashMovement", f.id, void 0, {
        type: s.data.type,
        amount: s.data.amount,
        note: s.data.note,
        sourceMedium: i,
        sourcePlatform: (d == null ? void 0 : d.name) ?? null
      }), { success: !0, expenseId: f.id, message: "Gasto registrado correctamente." };
    } catch (f) {
      return { success: !1, message: f instanceof Error ? f.message : "No se pudo registrar el gasto" };
    }
  });
}
const Jt = G.dirname(da(import.meta.url));
process.env.APP_ROOT = G.join(Jt, "..");
const ze = process.env.VITE_DEV_SERVER_URL, wr = G.join(process.env.APP_ROOT, "dist-electron"), Qt = G.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = ze ? G.join(process.env.APP_ROOT, "public") : Qt;
let me = null, R, Ct = /* @__PURE__ */ new Date(), P = null;
function Wt() {
  me = new Ge({
    icon: G.join(process.env.VITE_PUBLIC, "mascot.png"),
    webPreferences: {
      preload: G.join(Jt, "preload.mjs"),
      contextIsolation: !0,
      nodeIntegration: !1
    },
    show: !1
  }), sa.setApplicationMenu(null), me.maximize(), me.show(), ze ? me.loadURL(ze) : me.loadFile(G.join(Qt, "index.html"));
}
function Qs() {
  var o;
  const e = (o = process.env.SEED_ADMIN_ENABLED) == null ? void 0 : o.toLowerCase(), a = e === void 0 ? !0 : e === "true", r = process.env.SEED_ADMIN_USERNAME ?? "admin", u = process.env.SEED_ADMIN_NAME ?? "Administrador", m = process.env.SEED_ADMIN_PASSWORD ?? "admin123", c = Number(process.env.BCRYPT_ROUNDS ?? "10");
  if (a && m.trim().length < 8)
    throw new Error("SEED_ADMIN_PASSWORD es obligatorio y debe tener minimo 8 caracteres.");
  if (!Number.isFinite(c) || c < 8 || c > 15)
    throw new Error("BCRYPT_ROUNDS invalido. Usa un valor entre 8 y 15.");
  return { enabled: a, username: r, name: u, password: m, bcryptRounds: c };
}
async function Ws(e) {
  const a = Qs();
  if (!a.enabled || await e.user.count() > 0)
    return;
  const u = await ue.hash(a.password, a.bcryptRounds);
  await e.user.create({
    data: {
      username: a.username,
      name: a.name,
      role: q.ADMIN,
      passwordHash: u,
      isActive: !0
    }
  });
}
async function Zs(e) {
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
async function De(e) {
  try {
    await R.loginEvent.create({
      data: {
        userId: e.userId ?? null,
        username: e.username,
        success: e.success,
        reason: e.reason,
        occurredAt: /* @__PURE__ */ new Date(),
        appVersion: se.getVersion(),
        osPlatform: _e.platform(),
        osRelease: _e.release(),
        deviceName: _e.hostname()
      }
    });
  } catch (a) {
    console.error("Error registrando login:", a);
  }
}
function he(e) {
  return Math.round(e);
}
function er(e) {
  const a = /* @__PURE__ */ new Date();
  if (e === "day")
    return new Date(a.getFullYear(), a.getMonth(), a.getDate());
  if (e === "week") {
    const r = new Date(a), u = r.getDay(), m = u === 0 ? 6 : u - 1;
    return r.setDate(r.getDate() - m), r.setHours(0, 0, 0, 0), r;
  }
  return new Date(a.getFullYear(), a.getMonth(), 1);
}
function tr(e, a) {
  return `${e}-${String(a).padStart(6, "0")}`;
}
function W(e) {
  const a = e == null ? void 0 : e.trim();
  return a || null;
}
function Ze(e, a) {
  return [e.trim(), a.trim()].filter(Boolean).join(" ");
}
function bt(e) {
  return e.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}
function ar(e, a, r) {
  const u = bt(e).slice(0, 3).padEnd(3, "x"), m = bt(a).slice(0, 3).padEnd(3, "x"), o = r.replace(/\D/g, "").slice(-3).padStart(3, "0");
  return `${u}${m}${o}`;
}
async function Zt(e) {
  const a = ar(e.firstName, e.lastName, e.documentNumber);
  let r = 0, u = a, m = !0;
  for (; m; ) {
    const c = r === 0 ? "" : String(r + 1).padStart(2, "0");
    u = `${a}${c}`, m = !!await e.prismaClient.user.findFirst({
      where: {
        username: u,
        ...e.excludeUserId ? { NOT: { id: e.excludeUserId } } : {}
      },
      select: { id: !0 }
    }), r += 1;
  }
  return u;
}
function et(e) {
  if (!e)
    return null;
  const [a, r, u] = e.split("-").map(Number);
  return !a || !r || !u ? null : new Date(Date.UTC(a, r - 1, u));
}
function vt(e) {
  return e === "ADMIN" ? q.ADMIN : q.EMPLOYEE;
}
function ge(e) {
  return `SYSTEM_${e}`;
}
function Q(e) {
  return e ? qt(P == null ? void 0 : P.permissions, e) : !0;
}
async function sr(e, a) {
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
  return be(r.map((u) => u.permissionKey));
}
async function rr(e, a) {
  var m, c, o, s;
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
  const u = be(
    ((m = r.roleProfile) == null ? void 0 : m.permissions.map((t) => t.permissionKey)) ?? ((c = await e.roleProfile.findUnique({
      where: { key: ge(r.role) },
      include: {
        permissions: {
          where: { allowed: !0 },
          orderBy: { permissionKey: "asc" }
        }
      }
    })) == null ? void 0 : c.permissions.map((t) => t.permissionKey)) ?? []
  );
  return {
    roleProfileId: ((o = r.roleProfile) == null ? void 0 : o.id) ?? null,
    roleProfileName: ((s = r.roleProfile) == null ? void 0 : s.name) ?? null,
    permissions: u
  };
}
function ea(e) {
  return e.replace(/'/g, "''");
}
async function St(e, a) {
  return (await e.$queryRawUnsafe(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name = '${ea(a)}'
    LIMIT 1;
  `)).length > 0;
}
function nr(e) {
  const a = [], r = e.replace(/^\s*--.*$/gm, "");
  let u = "", m = !1, c = !1;
  for (let s = 0; s < r.length; s += 1) {
    const t = r[s], i = r[s - 1];
    if (t === "'" && !c && i !== "\\" ? m = !m : t === '"' && !m && i !== "\\" && (c = !c), t === ";" && !m && !c) {
      const d = u.trim();
      d && a.push(d), u = "";
      continue;
    }
    u += t;
  }
  const o = u.trim();
  return o && a.push(o), a;
}
function or() {
  return G.join(process.env.APP_ROOT, "prisma", "migrations");
}
function ir(e) {
  if (e instanceof Error)
    return e.message;
  if (typeof e == "object" && e !== null && "meta" in e) {
    const a = e.meta;
    if (typeof (a == null ? void 0 : a.message) == "string")
      return a.message;
  }
  return String(e);
}
function cr(e, a) {
  const r = e.trim();
  if (!(r === 'ALTER TABLE "CorrespondentTransaction" ADD COLUMN "approvalCode" TEXT') && !(r === 'CREATE UNIQUE INDEX "CorrespondentTransaction_approvalCode_key" ON "CorrespondentTransaction"("approvalCode")'))
    return !1;
  const c = ir(a);
  return c.includes("duplicate column name: approvalCode") || c.includes("index CorrespondentTransaction_approvalCode_key already exists") || c.includes('index "CorrespondentTransaction_approvalCode_key" already exists');
}
async function dr(e) {
  await e.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "checksum" TEXT NOT NULL,
      "finished_at" DATETIME,
      "migration_name" TEXT NOT NULL,
      "logs" TEXT,
      "rolled_back_at" DATETIME,
      "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    );
  `), await e.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "_prisma_migrations_migration_name_key"
    ON "_prisma_migrations"("migration_name");
  `);
}
async function ur(e) {
  if (await St(e, "User"))
    return;
  const r = or(), m = (await ia(r, { withFileTypes: !0 })).filter((s) => s.isDirectory()).map((s) => s.name).sort((s, t) => s.localeCompare(t));
  if (m.length === 0)
    throw new Error(`No se encontraron migraciones Prisma en ${r}.`);
  await dr(e);
  const c = await e.$queryRawUnsafe(`
    SELECT "migration_name"
    FROM "_prisma_migrations";
  `), o = new Set(
    c.map((s) => s.migration_name)
  );
  for (const s of m) {
    if (o.has(s))
      continue;
    const t = G.join(r, s, "migration.sql"), i = await ca(t, "utf8");
    i.includes('"Correspondent') && !await St(e, "CorrespondentTransaction") && await xt(e);
    const d = nr(i);
    for (const p of d)
      try {
        await e.$executeRawUnsafe(p);
      } catch (T) {
        if (cr(p, T))
          continue;
        throw T;
      }
    const f = wt("sha256").update(i).digest("hex");
    await e.$executeRawUnsafe(`
      INSERT INTO "_prisma_migrations" (
        "id",
        "checksum",
        "finished_at",
        "migration_name",
        "logs",
        "rolled_back_at",
        "started_at",
        "applied_steps_count"
      ) VALUES (
        '${ra()}',
        '${f}',
        CURRENT_TIMESTAMP,
        '${ea(s)}',
        '',
        NULL,
        CURRENT_TIMESTAMP,
        ${d.length}
      );
    `);
  }
}
async function lr(e) {
  const a = await e.$queryRawUnsafe('PRAGMA table_info("User");'), r = new Set(a.map((o) => o.name)), u = [];
  r.has("firstName") || u.push('ALTER TABLE "User" ADD COLUMN "firstName" TEXT;'), r.has("lastName") || u.push('ALTER TABLE "User" ADD COLUMN "lastName" TEXT;'), r.has("documentNumber") || u.push('ALTER TABLE "User" ADD COLUMN "documentNumber" TEXT;'), r.has("email") || u.push('ALTER TABLE "User" ADD COLUMN "email" TEXT;'), r.has("phone") || u.push('ALTER TABLE "User" ADD COLUMN "phone" TEXT;'), r.has("address") || u.push('ALTER TABLE "User" ADD COLUMN "address" TEXT;'), r.has("birthDate") || u.push('ALTER TABLE "User" ADD COLUMN "birthDate" DATETIME;'), r.has("internalCode") || u.push('ALTER TABLE "User" ADD COLUMN "internalCode" TEXT;');
  for (const o of u)
    await e.$executeRawUnsafe(o);
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
  for (const o of m) {
    const s = te({
      desiredCode: o.internalCode,
      existingCodes: c,
      prefix: "USR",
      digits: 4,
      maxLength: 30
    });
    s !== o.internalCode && await e.user.update({
      where: { id: o.id },
      data: { internalCode: s }
    }), c.push(s);
  }
  await e.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "User_internalCode_key" ON "User"("internalCode");'
  );
}
async function mr(e) {
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
async function pr(e) {
  const a = await e.$queryRawUnsafe('PRAGMA table_info("Product");');
  new Set(a.map((u) => u.name)).has("unitMeasure") || await e.$executeRawUnsafe(
    `ALTER TABLE "Product" ADD COLUMN "unitMeasure" TEXT NOT NULL DEFAULT 'UNIDAD';`
  ), await e.$executeRawUnsafe(`
    UPDATE "Product"
    SET "unitMeasure" = 'UNIDAD'
    WHERE "unitMeasure" IS NULL OR TRIM("unitMeasure") = '';
  `);
}
async function fr(e) {
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
  new Set(a.map((u) => u.name)).has("roleProfileId") || await e.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "roleProfileId" TEXT;'), await e.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "User_roleProfileId_idx"
    ON "User"("roleProfileId");
  `);
}
async function gr(e) {
  for (const r of Le) {
    const u = Bt(r), m = await e.roleProfile.findUnique({
      where: { key: ge(r.key) },
      select: { id: !0 }
    }), c = m ? await e.roleProfile.update({
      where: { id: m.id },
      data: {
        name: r.name,
        description: r.description,
        baseRole: vt(r.key),
        isSystem: !0
      }
    }) : await e.roleProfile.create({
      data: {
        key: ge(r.key),
        name: r.name,
        description: r.description,
        baseRole: vt(r.key),
        isSystem: !0,
        isActive: !0
      }
    }), o = await e.rolePermission.findMany({
      where: {
        roleProfileId: c.id,
        allowed: !0
      },
      select: {
        permissionKey: !0
      }
    }), s = new Set(o.map((i) => i.permissionKey)), t = u.filter(
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
    where: { key: { in: Le.map((r) => ge(r.key)) } },
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
async function Er() {
  await xt(R), await Zs(R), await Ha(R), Wa({
    app: se,
    ipcMain: X,
    prisma: R,
    getCurrentSessionUser: () => P
  });
}
se.whenReady().then(async () => {
  const e = G.join(se.getPath("userData"), "app.db").replace(/\\/g, "/");
  process.env.DATABASE_URL = `file:${e}`, R = new la(), Ct = /* @__PURE__ */ new Date(), await ur(R), await lr(R), await mr(R), await fr(R), await Gs(R), await Ws(R), await gr(R), await pr(R), Js({
    ipcMain: X,
    prisma: R,
    getCurrentSessionUser: () => P,
    getConnectedAt: () => Ct
  }), await Er(), Wt();
}).catch((e) => {
  console.error("No se pudo inicializar la aplicacion POS.", e), se.quit();
});
se.on("activate", () => {
  Ge.getAllWindows().length === 0 && Wt();
});
X.handle("auth:login", async (e, a) => {
  const r = ma.safeParse(a);
  if (!r.success)
    return await De({
      username: String((a == null ? void 0 : a.username) ?? ""),
      success: !1,
      reason: "invalid_payload"
    }), { success: !1, message: "Datos invalidos" };
  const { username: u, password: m } = r.data, c = await R.user.findUnique({
    where: { username: u }
  });
  if (!c || !c.isActive)
    return await De({
      username: u,
      success: !1,
      reason: "user_not_found_or_inactive"
    }), { success: !1, message: "Usuario o contrasena incorrectos" };
  if (!await ue.compare(m, c.passwordHash))
    return await De({
      userId: c.id,
      username: u,
      success: !1,
      reason: "wrong_password"
    }), { success: !1, message: "Usuario o contrasena incorrectos" };
  await De({
    userId: c.id,
    username: u,
    success: !0
  });
  const s = await rr(R, c.id);
  return P = {
    id: c.id,
    username: c.username,
    name: c.name ?? void 0,
    role: c.role,
    roleProfileId: (s == null ? void 0 : s.roleProfileId) ?? null,
    roleProfileName: (s == null ? void 0 : s.roleProfileName) ?? null,
    permissions: (s == null ? void 0 : s.permissions) ?? []
  }, {
    success: !0,
    user: P
  };
});
X.handle("auth:createUser", async (e, a) => {
  const r = pa.safeParse(a);
  if (!r.success)
    return { success: !1, message: "Datos invalidos" };
  if (!P || P.role !== q.ADMIN)
    return { success: !1, message: "Solo admins pueden crear usuarios" };
  if (!Q(E.usersCreate))
    return { success: !1, message: "Tu rol no puede crear usuarios" };
  const {
    internalCode: u,
    firstName: m,
    lastName: c,
    documentNumber: o,
    email: s,
    phone: t,
    address: i,
    birthDate: d,
    newPassword: f,
    roleProfileId: p,
    isActive: T
  } = r.data, I = await ue.hash(f, 10), g = Ze(m, c);
  try {
    if (await R.user.findFirst({
      where: { documentNumber: o },
      select: { id: !0 }
    }))
      return { success: !1, message: "La cedula ya esta registrada para otro usuario" };
    const N = p ? await R.roleProfile.findUnique({
      where: { id: p },
      select: { id: !0, baseRole: !0, isActive: !0 }
    }) : await R.roleProfile.findUnique({
      where: { key: ge("EMPLOYEE") },
      select: { id: !0, baseRole: !0, isActive: !0 }
    });
    if (!N || !N.isActive)
      return { success: !1, message: "El perfil de rol seleccionado no esta disponible" };
    const C = await Zt({
      prismaClient: R,
      firstName: m,
      lastName: c,
      documentNumber: o
    }), b = (await R.user.findMany({
      select: { internalCode: !0 }
    })).map((x) => x.internalCode), D = te({
      desiredCode: u,
      existingCodes: b,
      prefix: "USR",
      digits: 4,
      maxLength: 30
    });
    return await R.user.create({
      data: {
        internalCode: D,
        username: C,
        firstName: m.trim(),
        lastName: c.trim(),
        name: g,
        documentNumber: o,
        email: W(s),
        phone: W(t),
        address: W(i),
        birthDate: et(d),
        passwordHash: I,
        role: N.baseRole,
        roleProfileId: N.id,
        isActive: T ?? !0
      }
    }), { success: !0, username: C };
  } catch (y) {
    return { success: !1, message: y instanceof Error ? y.message : "No se pudo crear el usuario" };
  }
});
X.handle("users:update", async (e, a) => {
  const r = fa.safeParse(a);
  if (!r.success)
    return { success: !1, message: "Datos invalidos" };
  if (!P || P.role !== q.ADMIN)
    return { success: !1, message: "Solo admins pueden editar usuarios" };
  if (!Q(E.usersEdit))
    return { success: !1, message: "Tu rol no puede editar usuarios" };
  const {
    id: u,
    internalCode: m,
    firstName: c,
    lastName: o,
    documentNumber: s,
    email: t,
    phone: i,
    address: d,
    birthDate: f,
    newPassword: p,
    roleProfileId: T,
    isActive: I
  } = r.data, g = await R.user.findUnique({
    where: { id: u },
    select: { id: !0, role: !0, isActive: !0, roleProfileId: !0, internalCode: !0 }
  });
  if (!g)
    return { success: !1, message: "El usuario ya no existe" };
  if (await R.user.findFirst({
    where: {
      documentNumber: s,
      NOT: { id: u }
    },
    select: { id: !0 }
  }))
    return { success: !1, message: "La cedula ya esta registrada para otro usuario" };
  const N = T ? await R.roleProfile.findUnique({
    where: { id: T },
    select: { id: !0, baseRole: !0, isActive: !0, name: !0 }
  }) : await R.roleProfile.findUnique({
    where: { key: ge(g.role ?? "EMPLOYEE") },
    select: { id: !0, baseRole: !0, isActive: !0, name: !0 }
  });
  if (!N || !N.isActive)
    return { success: !1, message: "El perfil de rol seleccionado no esta disponible" };
  if (g.role === q.ADMIN && (N.baseRole !== q.ADMIN || !I) && await R.user.count({
    where: {
      role: q.ADMIN,
      isActive: !0,
      NOT: { id: u }
    }
  }) === 0)
    return { success: !1, message: "Debe existir al menos un administrador activo" };
  const C = await Zt({
    prismaClient: R,
    firstName: c,
    lastName: o,
    documentNumber: s,
    excludeUserId: u
  }), b = Ze(c, o);
  try {
    const D = (await R.user.findMany({
      where: { NOT: { id: u } },
      select: { internalCode: !0 }
    })).map((v) => v.internalCode), x = te({
      desiredCode: m,
      existingCodes: D,
      prefix: "USR",
      digits: 4,
      maxLength: 30
    });
    return await R.user.update({
      where: { id: u },
      data: {
        internalCode: x,
        username: C,
        firstName: c.trim(),
        lastName: o.trim(),
        name: b,
        documentNumber: s,
        email: W(t),
        phone: W(i),
        address: W(d),
        birthDate: et(f),
        role: N.baseRole,
        roleProfileId: N.id,
        isActive: I,
        ...p != null && p.trim() ? {
          passwordHash: await ue.hash(p, 10)
        } : {}
      }
    }), P.id === u && (P = {
      ...P,
      username: C,
      name: b,
      role: N.baseRole,
      roleProfileId: N.id,
      roleProfileName: N.name,
      permissions: await sr(R, N.id)
    }), { success: !0, username: C };
  } catch (D) {
    return { success: !1, message: D instanceof Error ? D.message : "No se pudo actualizar el usuario" };
  }
});
X.handle("auth:get-profile", async () => {
  var a;
  if (!P)
    return { success: !1, message: "Debes iniciar sesion" };
  const e = await R.user.findUnique({
    where: { id: P.id },
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
  var d;
  const r = Ea.safeParse(a);
  if (!r.success)
    return { success: !1, message: "Datos invalidos" };
  if (!P)
    return { success: !1, message: "Debes iniciar sesion" };
  const { firstName: u, lastName: m, email: c, phone: o, birthDate: s } = r.data, t = Ze(u, m), i = await R.user.update({
    where: { id: P.id },
    data: {
      firstName: u.trim(),
      lastName: m.trim(),
      name: t,
      email: W(c),
      phone: W(o),
      birthDate: et(s)
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
  return P = {
    ...P,
    name: t
  }, {
    success: !0,
    user: P,
    profile: {
      ...i,
      birthDate: ((d = i.birthDate) == null ? void 0 : d.toISOString().slice(0, 10)) ?? null
    }
  };
});
X.handle("auth:change-password", async (e, a) => {
  const r = Ta.safeParse(a);
  if (!r.success)
    return { success: !1, message: "Datos invalidos" };
  if (!P)
    return { success: !1, message: "Debes iniciar sesion" };
  const { currentPassword: u, newPassword: m, confirmPassword: c } = r.data;
  if (m !== c)
    return { success: !1, message: "La confirmacion no coincide con la nueva contrasena" };
  const o = await R.user.findUnique({
    where: { id: P.id },
    select: { id: !0, passwordHash: !0 }
  });
  return o ? await ue.compare(u, o.passwordHash) ? await ue.compare(m, o.passwordHash) ? { success: !1, message: "La nueva contrasena debe ser diferente a la anterior" } : (await R.user.update({
    where: { id: o.id },
    data: {
      passwordHash: await ue.hash(m, 10)
    }
  }), { success: !0 }) : { success: !1, message: "La contrasena actual es incorrecta" } : { success: !1, message: "Tu usuario ya no existe" };
});
X.handle("notifications:get-read", async () => P ? {
  success: !0,
  readKeys: (await R.notificationRead.findMany({
    where: { userId: P.id },
    select: { readKey: !0 },
    orderBy: { createdAt: "desc" }
  })).map((a) => a.readKey)
} : { success: !1, message: "Debes iniciar sesion", readKeys: [] });
X.handle("notifications:mark-read", async (e, a) => {
  if (!P)
    return { success: !1, message: "Debes iniciar sesion" };
  const r = Array.isArray(a == null ? void 0 : a.readKeys) ? a.readKeys.filter((u) => typeof u == "string" && u.trim().length > 0) : [];
  return r.length === 0 ? { success: !0 } : (await Promise.all(
    r.map(
      (u) => R.notificationRead.upsert({
        where: {
          userId_readKey: {
            userId: P.id,
            readKey: u
          }
        },
        update: {},
        create: {
          userId: P.id,
          readKey: u
        }
      })
    )
  ), { success: !0 });
});
X.handle("roles:list", async () => !P || P.role !== q.ADMIN ? { success: !1, message: "Solo admins pueden ver roles", roles: [] } : Q(E.rolesView) ? {
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
    permissionKeys: be(
      a.permissions.map((r) => r.permissionKey)
    ),
    usersCount: a._count.users,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString()
  }))
} : { success: !1, message: "Tu rol no puede ver roles", roles: [] });
X.handle("roles:create", async (e, a) => {
  const r = Aa.safeParse(a);
  if (!r.success)
    return { success: !1, message: "Datos invalidos para el rol" };
  const u = be(r.data.permissionKeys);
  if (!P || P.role !== q.ADMIN)
    return { success: !1, message: "Solo admins pueden crear roles" };
  if (!Q(E.rolesManage))
    return { success: !1, message: "Tu rol no puede crear roles" };
  if (u.length > 0 && u.find(
    (c) => !Ft(r.data.baseRole, c)
  ))
    return { success: !1, message: "Uno o mas permisos no pertenecen al rol base seleccionado" };
  try {
    return { success: !0, roleId: (await R.roleProfile.create({
      data: {
        name: r.data.name.trim(),
        description: W(r.data.description),
        baseRole: r.data.baseRole,
        isSystem: !1,
        isActive: r.data.isActive ?? !0,
        permissions: {
          create: u.map((c) => ({
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
  const r = ya.safeParse(a);
  if (!r.success)
    return { success: !1, message: "Datos invalidos para el rol" };
  const u = be(r.data.permissionKeys);
  if (!P || P.role !== q.ADMIN)
    return { success: !1, message: "Solo admins pueden editar roles" };
  if (!Q(E.rolesManage))
    return { success: !1, message: "Tu rol no puede editar roles" };
  const m = await R.roleProfile.findUnique({
    where: { id: r.data.id },
    select: { id: !0, baseRole: !0, isSystem: !0, name: !0 }
  });
  if (!m)
    return { success: !1, message: "El rol ya no existe" };
  if (u.find(
    (o) => !Ft(m.baseRole, o)
  ))
    return { success: !1, message: "Uno o mas permisos no pertenecen al rol base seleccionado" };
  try {
    return await R.$transaction(async (o) => {
      await o.roleProfile.update({
        where: { id: r.data.id },
        data: {
          name: r.data.name.trim(),
          description: W(r.data.description),
          isActive: r.data.isActive ?? !0
        }
      }), await o.rolePermission.deleteMany({ where: { roleProfileId: r.data.id } }), await o.rolePermission.createMany({
        data: u.map((s) => ({
          roleProfileId: r.data.id,
          permissionKey: s,
          allowed: !0
        }))
      });
    }), P.roleProfileId === r.data.id && (P = {
      ...P,
      roleProfileName: r.data.name.trim(),
      permissions: u
    }), { success: !0, roleId: r.data.id };
  } catch (o) {
    return { success: !1, message: o instanceof Error ? o.message : "No se pudo actualizar el rol" };
  }
});
X.handle("roles:delete", async (e, a) => {
  const r = Ia.safeParse(a);
  if (!r.success)
    return { success: !1, message: "Datos invalidos para el rol" };
  if (!P || P.role !== q.ADMIN)
    return { success: !1, message: "Solo admins pueden eliminar roles" };
  if (!Q(E.rolesManage))
    return { success: !1, message: "Tu rol no puede eliminar roles" };
  const u = await R.roleProfile.findUnique({
    where: { id: r.data.id },
    include: {
      _count: {
        select: {
          users: !0
        }
      }
    }
  });
  return u ? u.isSystem ? { success: !1, message: "Los roles del sistema no se pueden eliminar" } : u._count.users > 0 ? { success: !1, message: "Reasigna los usuarios del rol antes de eliminarlo" } : (await R.roleProfile.delete({
    where: { id: r.data.id }
  }), { success: !0, roleId: r.data.id }) : { success: !1, message: "El rol ya no existe" };
});
X.handle("auth:logout", async () => (P = null, { success: !0 }));
X.handle("products:list", async () => (await R.product.findMany({
  where: {
    isActive: !0,
    OR: [
      { stock: { gt: 0 } },
      { pricingConfigJson: { not: null } }
    ]
  },
  include: {
    category: !0,
    subcategory: !0
  },
  orderBy: { name: "asc" }
})).map((a) => {
  var r, u;
  return {
    id: a.id,
    name: a.name,
    sku: a.sku,
    barcode: a.barcode,
    price: a.price,
    pricingConfig: Ue(a.pricingConfigJson),
    cost: a.cost,
    taxRate: a.taxRate,
    stock: a.stock,
    category: ((r = a.category) == null ? void 0 : r.name) ?? null,
    subcategory: ((u = a.subcategory) == null ? void 0 : u.name) ?? null
  };
}));
X.handle("sales:create", async (e, a) => {
  var A, S, L;
  if (!P)
    return { success: !1, message: "Debes iniciar sesion para vender" };
  if (!Q(E.salesCreate))
    return { success: !1, message: "Tu rol no puede registrar ventas" };
  if (!Q(E.salesManagePayments))
    return { success: !1, message: "Tu rol no puede gestionar pagos" };
  const r = ba.safeParse(a);
  if (!r.success)
    return { success: !1, message: "Datos invalidos para la venta" };
  let u = null;
  if (r.data.customerId && (u = await R.customer.findFirst({
    where: {
      id: r.data.customerId,
      isActive: !0
    },
    select: {
      id: !0,
      name: !0,
      segment: !0
    }
  }), !u))
    return { success: !1, message: "El cliente seleccionado ya no esta disponible" };
  const m = (u == null ? void 0 : u.name) ?? ((A = r.data.customer) == null ? void 0 : A.trim()) ?? "Consumidor final";
  if (m !== "Consumidor final" && !Q(E.salesChangeCustomer))
    return { success: !1, message: "Tu rol no puede cambiar el cliente en la factura" };
  const c = r.data.items.map((h) => h.productId), o = await R.product.findMany({
    where: {
      id: { in: c },
      isActive: !0
    }
  });
  if (o.length !== c.length)
    return { success: !1, message: "Uno o mas productos ya no estan disponibles" };
  const s = new Map(o.map((h) => [h.id, h])), t = Q(E.salesEditItemPrices), i = r.data.items.map((h) => {
    var at, st, rt, nt, ot;
    const O = s.get(h.productId);
    if (!O)
      throw new Error("Producto no encontrado");
    const _ = Ue(O.pricingConfigJson), V = !!(_ != null && _.enabled);
    if (!V && O.stock < h.qty)
      throw new Error(`Stock insuficiente para ${O.name}`);
    if (((at = h.pricingContext) == null ? void 0 : at.manualUnitPrice) !== void 0 && ((st = h.pricingContext) == null ? void 0 : st.manualUnitPrice) !== null && !t)
      throw new Error("Tu rol no puede aplicar precios manuales en productos con reglas escalonadas");
    const K = hs({
      fallbackPrice: O.price,
      pricingConfig: _,
      qty: h.qty,
      sheetTypeId: (rt = h.pricingContext) == null ? void 0 : rt.sheetTypeId,
      specialRuleId: ((nt = h.pricingContext) == null ? void 0 : nt.specialRuleId) ?? null,
      manualUnitPrice: ((ot = h.pricingContext) == null ? void 0 : ot.manualUnitPrice) ?? null,
      canOverrideMinimum: t
    });
    if (!K.ok)
      throw new Error(K.message);
    const { quote: M } = K, $ = M.sheetTypeName ? `${O.name} - ${M.sheetTypeName}` : O.name, U = he(M.unitPrice * h.qty), tt = he(U * O.taxRate), ta = U + tt, aa = he((M.unitPrice - O.cost) * h.qty);
    return {
      product: O,
      quote: M,
      lineName: $,
      qty: h.qty,
      lineSubtotal: U,
      lineTax: tt,
      lineTotal: ta,
      lineProfit: aa,
      skipStockControl: V
    };
  }), d = i.reduce((h, O) => h + O.lineSubtotal, 0), f = i.reduce((h, O) => h + O.lineTax, 0), p = d + f, T = i.reduce((h, O) => h + O.product.cost * O.qty, 0), I = i.reduce((h, O) => h + O.lineProfit, 0), y = (r.data.payments && r.data.payments.length > 0 ? r.data.payments : [
    {
      method: r.data.paymentMethod,
      amount: r.data.amountPaid ?? p
    }
  ]).map((h) => ({
    method: h.method,
    amount: he(h.amount)
  })).filter((h) => h.amount > 0);
  if (y.length === 0 && !r.data.allowDebt)
    return { success: !1, message: "Debes registrar al menos un pago para completar la venta" };
  const N = y.reduce((h, O) => h + O.amount, 0), C = Math.max(0, N - p), b = y.filter((h) => h.method === "CASH").reduce((h, O) => h + O.amount, 0);
  if (C > b)
    return { success: !1, message: "Las vueltas solo pueden salir de un pago en efectivo" };
  let D = p;
  const x = /* @__PURE__ */ new Map();
  for (const h of y) {
    if (D <= 0)
      break;
    const O = Math.min(h.amount, D);
    O <= 0 || (x.set(
      h.method,
      (x.get(h.method) ?? 0) + O
    ), D -= O);
  }
  const v = ((S = [...x.entries()].sort((h, O) => O[1] - h[1])[0]) == null ? void 0 : S[0]) ?? ((L = y[0]) == null ? void 0 : L.method) ?? r.data.paymentMethod, l = x.get(z.CASH) ?? 0;
  if (r.data.clientTotal !== void 0 && Math.abs(r.data.clientTotal - p) > 1)
    return { success: !1, message: "El total enviado no coincide con el calculo del sistema" };
  if (N < p && !r.data.allowDebt)
    return { success: !1, message: "El pago recibido no alcanza para cubrir la venta" };
  try {
    const h = await R.$transaction(async (O) => {
      const _ = await O.sale.count() + 1, V = await O.businessSettings.findUnique({
        where: { id: "default" },
        select: { invoicePrefix: !0 }
      }), K = tr((V == null ? void 0 : V.invoicePrefix) || "FV", _), M = await O.cashSession.findFirst({
        where: {
          userId: P.id,
          status: "OPEN"
        },
        orderBy: { openedAt: "desc" }
      }), $ = await O.sale.create({
        data: {
          invoiceNumber: K,
          customer: m,
          customerId: (u == null ? void 0 : u.id) ?? null,
          paymentMethod: v,
          subtotal: d,
          tax: f,
          total: p,
          costTotal: T,
          profit: I,
          cashierId: P.id,
          cashSessionId: (M == null ? void 0 : M.id) ?? null,
          items: {
            create: i.map((U) => ({
              productId: U.product.id,
              sku: U.product.sku,
              barcode: U.product.barcode,
              name: U.lineName,
              price: U.quote.unitPrice,
              cost: U.product.cost,
              qty: U.qty,
              taxRate: U.product.taxRate,
              lineSubtotal: U.lineSubtotal,
              lineTax: U.lineTax,
              lineTotal: U.lineTotal,
              lineProfit: U.lineProfit,
              pricingContextJson: JSON.stringify({
                sheetTypeId: U.quote.sheetTypeId,
                sheetTypeName: U.quote.sheetTypeName,
                specialRuleId: U.quote.specialRuleId,
                specialRuleLabel: U.quote.specialRuleLabel,
                source: U.quote.source,
                sourceLabel: U.quote.sourceLabel,
                minimumPrice: U.quote.minimumPrice,
                minimumApplied: U.quote.minimumApplied
              })
            }))
          },
          payments: {
            create: y.map((U) => ({
              method: U.method,
              amount: U.amount
            }))
          }
        }
      });
      M && l > 0 && await O.cashMovement.create({
        data: {
          sessionId: M.id,
          type: k.SALE_IN,
          amount: l,
          note: $.invoiceNumber
        }
      });
      for (const U of i)
        U.skipStockControl || (await O.product.update({
          where: { id: U.product.id },
          data: {
            stock: { decrement: U.qty }
          }
        }), await O.inventoryMovement.create({
          data: {
            productId: U.product.id,
            type: Ne.SALE_OUT,
            qty: U.qty,
            stockBefore: U.product.stock,
            stockAfter: U.product.stock - U.qty,
            referenceType: "SALE",
            referenceId: $.id,
            note: $.invoiceNumber
          }
        }));
      return $;
    });
    return {
      success: !0,
      saleId: h.id,
      invoiceNumber: h.invoiceNumber,
      total: p,
      amountPaid: N,
      changeAmount: C
    };
  } catch (h) {
    return { success: !1, message: h instanceof Error ? h.message : "No se pudo registrar la venta" };
  }
});
X.handle("dashboard:stats", async (e, a = "day") => {
  const r = ["day", "week", "month"].includes(a) ? a : "day", u = er(r), m = await R.sale.findMany({
    where: { createdAt: { gte: u } },
    include: { items: !0 },
    orderBy: { createdAt: "desc" }
  }), c = m.reduce((T, I) => T + I.total, 0), o = m.reduce((T, I) => T + I.profit, 0), s = m.reduce((T, I) => T + I.tax, 0), t = m.length > 0 ? he(c / m.length) : 0, i = m.reduce((T, I) => (T[I.paymentMethod] = (T[I.paymentMethod] ?? 0) + I.total, T), {}), d = m.flatMap((T) => T.items).reduce((T, I) => {
    const g = T[I.name] ?? { name: I.name, qty: 0, total: 0 };
    return g.qty += I.qty, g.total += I.lineTotal, T[I.name] = g, T;
  }, {}), f = Object.values(d).sort((T, I) => I.qty - T.qty).slice(0, 5), p = await R.product.findMany({
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
      profit: o,
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
    lowStock: p
  };
});
se.on("window-all-closed", () => {
  process.platform !== "darwin" && (se.quit(), me = null);
});
se.on("quit", async () => {
  await (R == null ? void 0 : R.$disconnect());
});
export {
  wr as MAIN_DIST,
  Qt as RENDERER_DIST,
  ze as VITE_DEV_SERVER_URL,
  Ws as seedAdminIfNeeded
};
