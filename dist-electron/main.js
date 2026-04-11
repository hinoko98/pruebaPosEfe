import { BrowserWindow as Ke, app as re, ipcMain as q, Menu as aa } from "electron";
import ue from "bcryptjs";
import "dotenv/config";
import { createHash as wt, randomUUID as sa } from "node:crypto";
import { mkdir as ra, writeFile as na, readdir as oa, readFile as ia } from "node:fs/promises";
import Me from "node:os";
import G from "node:path";
import { fileURLToPath as ca } from "node:url";
import { CorrespondentDirection as F, CommissionMode as Pe, CorrespondentTransactionStatus as ie, CorrespondentReconciliationStatus as da, CorrespondentOcrStatus as Be, Role as X, CorrespondentClosureStatus as it, SaleStatus as fe, CashSessionStatus as ee, PaymentMethod as z, CashMovementType as k, InventoryMovementType as Ne, PurchaseStatus as ct, CreditStatus as Te, PrismaClient as ua } from "@prisma/client";
import { z as o } from "zod";
const He = o.enum(["ADMIN", "EMPLOYEE"]), la = o.object({
  username: o.string().trim().min(1).max(50),
  password: o.string().min(1).max(200)
});
o.object({
  success: o.boolean(),
  message: o.string().optional(),
  user: o.object({
    id: o.string(),
    username: o.string(),
    role: He,
    name: o.string().optional(),
    roleProfileId: o.string().nullable().optional(),
    roleProfileName: o.string().nullable().optional(),
    permissions: o.array(o.string()).optional()
  }).optional()
});
const Ye = o.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(), Je = o.string().trim().regex(/^\d{10}$/).optional().nullable(), Rt = o.object({
  internalCode: o.string().trim().max(30).optional().nullable(),
  firstName: o.string().trim().min(2).max(80),
  lastName: o.string().trim().min(2).max(80),
  documentNumber: o.string().trim().regex(/^\d{6,20}$/),
  email: o.string().trim().email().max(120).optional().nullable(),
  phone: Je,
  address: o.string().trim().max(180).optional().nullable(),
  birthDate: Ye,
  roleProfileId: o.string().uuid().optional().nullable(),
  isActive: o.boolean().optional().default(!0)
}), ma = Rt.extend({
  newPassword: o.string().min(6).max(200)
}), pa = Rt.extend({
  id: o.string().uuid(),
  newPassword: o.string().min(6).max(200).optional().or(o.literal(""))
}), fa = o.object({
  id: o.string(),
  username: o.string(),
  name: o.string().optional().nullable(),
  firstName: o.string().optional().nullable(),
  lastName: o.string().optional().nullable(),
  email: o.string().trim().email().max(120).optional().nullable(),
  phone: Je,
  birthDate: Ye,
  role: He
});
o.object({
  success: o.boolean(),
  message: o.string().optional(),
  profile: fa.optional()
});
const ga = o.object({
  firstName: o.string().trim().min(2).max(80),
  lastName: o.string().trim().min(2).max(80),
  email: o.string().trim().email().max(120).optional().nullable(),
  phone: Je,
  birthDate: Ye
}), Ea = o.object({
  currentPassword: o.string().min(1).max(200),
  newPassword: o.string().min(6).max(200),
  confirmPassword: o.string().min(6).max(200)
}), Ta = o.object({
  name: o.string().trim().min(3, "Minimo 3 caracteres").max(80, "Maximo 80 caracteres"),
  description: o.string().trim().max(240).optional().nullable(),
  baseRole: He.default("EMPLOYEE"),
  permissionKeys: o.array(o.string().trim().min(1)).min(1, "Debes seleccionar al menos un permiso"),
  isActive: o.boolean().optional().default(!0)
}), Aa = o.object({
  id: o.string().uuid("ID de rol invalido"),
  name: o.string().trim().min(3, "Minimo 3 caracteres").max(80, "Maximo 80 caracteres"),
  description: o.string().trim().max(240).optional().nullable(),
  permissionKeys: o.array(o.string().trim().min(1)).min(1, "Debes seleccionar al menos un permiso"),
  isActive: o.boolean().optional().default(!0)
}), Ia = o.object({
  id: o.string().uuid("ID de rol invalido")
}), Qe = o.enum(["CASH", "CARD", "TRANSFER"]), ya = o.object({
  specialRuleId: o.string().trim().min(1, "La tarifa especial seleccionada no es valida").optional().nullable(),
  manualUnitPrice: o.number().positive("El precio manual debe ser mayor a 0").optional().nullable()
}), Na = o.object({
  method: Qe,
  amount: o.number().min(0, "El monto del pago no puede ser negativo")
}), Ca = o.object({
  productId: o.string().uuid("productId invalido"),
  qty: o.number().int("La cantidad debe ser entera").positive("La cantidad debe ser mayor a 0"),
  pricingContext: ya.optional()
}), ha = o.object({
  customer: o.string().trim().max(120).optional().default("Consumidor final"),
  customerId: o.string().uuid("customerId invalido").optional().nullable(),
  paymentMethod: Qe.optional().default("CASH"),
  amountPaid: o.number().min(0).optional(),
  payments: o.array(Na).min(1, "Debes registrar al menos un pago").optional(),
  items: o.array(Ca).min(1, "La venta debe tener al menos un item"),
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
const ba = o.enum(["REGISTERED", "VOIDED"]), va = o.enum(["MANUAL", "IMAGE", "FILE_IMPORT", "API"]), Ot = o.enum(["IN", "OUT"]), Sa = o.object({
  fileName: o.string().trim().min(1).max(180),
  mimeType: o.string().trim().max(120).optional(),
  dataBase64: o.string().min(1),
  ocrRawText: o.string().trim().max(1e4).optional()
}), wa = o.object({
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
  source: va.optional().default("MANUAL"),
  evidence: Sa.optional()
}), Ra = o.object({
  transactionId: o.string().uuid("transactionId invalido"),
  typeId: o.string().uuid("typeId invalido"),
  approvalCode: o.string().trim().min(4, "Ingresa el numero de aprobacion o ID interno").max(40).optional().nullable(),
  amount: o.number().int("El valor debe ser entero").positive("El valor debe ser mayor a 0"),
  performedAt: o.string().datetime("Fecha de operacion invalida")
}), Oa = o.object({
  transactionId: o.string().uuid("transactionId invalido")
}), Da = o.object({
  dateFrom: o.string().datetime().optional(),
  dateTo: o.string().datetime().optional(),
  platformId: o.string().uuid().optional(),
  userId: o.string().uuid().optional(),
  status: ba.optional(),
  search: o.string().trim().max(80).optional()
}).optional().default({}), Pa = o.object({
  businessDate: o.string().datetime().optional(),
  dateFrom: o.string().datetime().optional(),
  dateTo: o.string().datetime().optional()
}).refine(
  (e) => !e.dateFrom || !e.dateTo || new Date(e.dateFrom).getTime() <= new Date(e.dateTo).getTime(),
  {
    message: "El rango de fechas es invalido",
    path: ["dateTo"]
  }
).optional().default({}), xa = o.object({
  platformId: o.string().uuid("platformId invalido"),
  businessDate: o.string().datetime("Fecha de cierre invalida"),
  openingBalance: o.number().int("El saldo base debe ser entero").optional().default(0),
  reportedBalance: o.number().int("El valor reportado debe ser entero"),
  note: o.string().trim().max(300).optional().nullable()
}), La = o.object({
  name: o.string().trim().min(2, "El nombre es obligatorio").max(80, "Nombre demasiado largo"),
  requiresEvidence: o.boolean().optional().default(!1),
  supportsOcr: o.boolean().optional().default(!1),
  supportsFileImport: o.boolean().optional().default(!1)
}), Ua = o.object({
  platformId: o.string().uuid("platformId invalido"),
  name: o.string().trim().min(2, "El nombre es obligatorio").max(80, "Nombre demasiado largo"),
  direction: Ot.default("IN")
}), _a = o.object({
  platformId: o.string().uuid("platformId invalido"),
  name: o.string().trim().min(2, "El nombre es obligatorio").max(80, "Nombre demasiado largo"),
  requiresEvidence: o.boolean().optional().default(!1),
  supportsOcr: o.boolean().optional().default(!1),
  supportsFileImport: o.boolean().optional().default(!1)
}), Ma = o.object({
  typeId: o.string().uuid("typeId invalido"),
  name: o.string().trim().min(2, "El nombre es obligatorio").max(80, "Nombre demasiado largo"),
  direction: Ot.default("IN")
}), Ba = o.object({
  platformId: o.string().uuid("platformId invalido")
}), Fa = o.object({
  typeId: o.string().uuid("typeId invalido")
}), ka = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
function $a(e) {
  return e.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function oe(e) {
  return $a(e).toUpperCase().replace(/[_\s]+/g, "-").replace(/[^A-Z0-9-]/g, "").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}
function Xa(e, a) {
  const r = oe(a), d = oe(e);
  if (!d)
    return `${r}-`;
  if (d === r)
    return `${r}-`;
  if (d.startsWith(`${r}-`))
    return d;
  const l = d.startsWith(r) ? d.slice(r.length).replace(/^-+/, "") : d;
  return `${r}-${l}`;
}
function We(e, a = 4, r = 40) {
  return e.length >= a && e.length <= r && ka.test(e);
}
function Dt(e, a, r = 4) {
  const d = oe(a), l = new RegExp(`^${d}-(\\d+)$`);
  let i = 0;
  for (const n of e) {
    const t = oe(n || "").match(l);
    t && (i = Math.max(i, Number(t[1] || 0)));
  }
  return `${d}-${String(i + 1).padStart(r, "0")}`;
}
function ae(e) {
  var d;
  const a = (d = e.desiredCode) != null && d.trim() ? Xa(e.desiredCode, e.prefix) : Dt(e.existingCodes, e.prefix, e.digits);
  if (!We(a, e.minLength, e.maxLength))
    throw new Error("El codigo debe usar solo letras, numeros y guiones.");
  if (new Set(
    e.existingCodes.map((l) => oe(l || "")).filter(Boolean)
  ).has(a))
    throw new Error(`El codigo ${a} ya existe.`);
  return a;
}
function qe(e) {
  var d;
  const a = (d = e.desiredCode) != null && d.trim() ? oe(e.desiredCode) : Dt(e.existingCodes, e.generatedPrefix, e.digits);
  if (!We(a, e.minLength, e.maxLength))
    throw new Error("El codigo debe usar solo letras, numeros y guiones.");
  if (new Set(
    e.existingCodes.map((l) => oe(l || "")).filter(Boolean)
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
], qa = [
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
function se(e = /* @__PURE__ */ new Date()) {
  return new Date(e.getFullYear(), e.getMonth(), e.getDate());
}
function xe(e = /* @__PURE__ */ new Date()) {
  const a = se(e);
  return a.setDate(a.getDate() + 1), a;
}
function ve(e) {
  return se(e ? new Date(e) : /* @__PURE__ */ new Date());
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
async function ja(e, a) {
  const r = Pt(a) || "CORRESPONSAL";
  let d = r, l = 2;
  for (; await e.correspondentPlatform.findUnique({ where: { code: d }, select: { id: !0 } }); )
    d = `${r}_${l}`, l += 1;
  return d;
}
async function za(e, a, r) {
  const d = Pt(r) || "TIPO";
  let l = d, i = 2;
  for (; await e.correspondentTransactionType.findUnique({
    where: { platformId_code: { platformId: a, code: l } },
    select: { id: !0 }
  }); )
    l = `${d}_${i}`, i += 1;
  return l;
}
function ut(e, a) {
  if (!e)
    return null;
  const r = e.match(new RegExp(`${a}:([^;]+)`));
  return (r == null ? void 0 : r[1]) ?? null;
}
async function Ga(e) {
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
  }), r = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map();
  for (const n of a) {
    const s = {
      user: n.user ? n.user.name ?? n.user.username : null,
      at: n.createdAt.toISOString()
    }, t = ut(n.context, "platform"), c = ut(n.context, "type");
    n.action === "create_platform" && t && !r.has(t) && r.set(t, s), n.action === "update_platform" && t && d.set(t, s), n.action === "create_transaction_type" && c && !l.has(c) && l.set(c, s), n.action === "update_transaction_type" && c && i.set(c, s);
  }
  return {
    platformCreatedBy: r,
    platformUpdatedBy: d,
    typeCreatedBy: l,
    typeUpdatedBy: i
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
  const l = await e.correspondentTransaction.findMany({
    select: {
      id: !0,
      approvalCode: !0
    },
    orderBy: [{ createdAt: "asc" }, { performedAt: "asc" }]
  }), i = [], n = /* @__PURE__ */ new Set();
  for (const s of l) {
    const t = oe(s.approvalCode || ""), u = !!t && We(t, 4, 40) && !n.has(t) ? t : qe({
      existingCodes: i,
      generatedPrefix: "APR",
      digits: 6,
      maxLength: 40
    });
    u !== s.approvalCode && await e.correspondentTransaction.update({
      where: { id: s.id },
      data: { approvalCode: u }
    }), i.push(u), n.add(u);
  }
  await e.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "CorrespondentTransaction_approvalCode_key" ON "CorrespondentTransaction"("approvalCode");'
  );
}
async function Ka(e) {
  for (const a of qa) {
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
    for (const l of a.types)
      await e.correspondentTransactionType.upsert({
        where: {
          platformId_code: {
            platformId: r.id,
            code: l.code
          }
        },
        update: {
          name: l.name,
          direction: l.direction,
          isActive: !0,
          requiresCustomerDocument: l.requiresCustomerDocument ?? !1,
          requiresExternalReference: l.requiresExternalReference ?? !1,
          allowsCommissionOverride: !0,
          sortOrder: l.sortOrder ?? 0
        },
        create: {
          platformId: r.id,
          code: l.code,
          name: l.name,
          direction: l.direction,
          isActive: !0,
          requiresCustomerDocument: l.requiresCustomerDocument ?? !1,
          requiresExternalReference: l.requiresExternalReference ?? !1,
          allowsCommissionOverride: !0,
          sortOrder: l.sortOrder ?? 0
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
async function mt(e, a, r, d, l) {
  const n = (await e.correspondentCommissionRule.findMany({
    where: {
      platformId: a,
      isActive: !0,
      OR: [{ typeId: r }, { typeId: null }],
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: l } }] },
        { OR: [{ validTo: null }, { validTo: { gte: l } }] },
        { OR: [{ minAmount: null }, { minAmount: { lte: d } }] },
        { OR: [{ maxAmount: null }, { maxAmount: { gte: d } }] }
      ]
    }
  })).sort((s, t) => {
    var c, u;
    return s.typeId === r && t.typeId !== r ? -1 : s.typeId !== r && t.typeId === r ? 1 : (((c = t.validFrom) == null ? void 0 : c.getTime()) ?? 0) - (((u = s.validFrom) == null ? void 0 : u.getTime()) ?? 0);
  })[0] ?? null;
  return n ? n.mode === Pe.FIXED ? dt(n.value) : n.mode === Pe.PERCENTAGE ? dt(d * n.value / 100) : 0 : 0;
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
async function Ha(e) {
  const a = /* @__PURE__ */ new Date(), r = G.join(
    e.app.getPath("userData"),
    "correspondent-evidence",
    String(a.getFullYear()),
    String(a.getMonth() + 1).padStart(2, "0"),
    String(a.getDate()).padStart(2, "0"),
    e.platformCode.toLowerCase()
  );
  await ra(r, { recursive: !0 });
  const d = Va(e.evidence.fileName), l = G.join(r, `${Date.now()}-${d}`), i = e.evidence.dataBase64.includes(",") ? e.evidence.dataBase64.split(",").pop() ?? "" : e.evidence.dataBase64, n = Buffer.from(i, "base64");
  return await na(l, n), {
    fileName: e.evidence.fileName,
    filePath: l,
    mimeType: e.evidence.mimeType ?? null,
    fileSize: n.byteLength,
    fileHash: wt("sha256").update(n).digest("hex"),
    ocrRawText: e.evidence.ocrRawText ?? null
  };
}
async function te(e) {
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
async function Fe(e, a, r) {
  return e.correspondentTransaction.findMany({
    where: {
      platformId: r,
      performedAt: {
        gte: se(a),
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
async function Ya(e, a, r, d) {
  return e.correspondentTransaction.findMany({
    where: {
      platformId: d,
      performedAt: {
        gte: se(a),
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
async function Ja(e, a) {
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
function Qa({
  app: e,
  ipcMain: a,
  prisma: r,
  getCurrentSessionUser: d
}) {
  a.handle("correspondent:catalog", async () => {
    if (!d())
      return { success: !1, message: "Debes iniciar sesion", platforms: [] };
    const [i, n] = await Promise.all([
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
      Ga(r)
    ]);
    return {
      success: !0,
      platforms: i.map((s) => {
        var t, c, u;
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
          updatedBy: ((c = n.platformUpdatedBy.get(s.id)) == null ? void 0 : c.user) ?? ((u = n.platformCreatedBy.get(s.id)) == null ? void 0 : u.user) ?? null,
          types: s.transactionTypes.map((p) => {
            var g, T, I;
            return {
              id: p.id,
              code: p.code,
              name: p.name,
              direction: p.direction,
              requiresCustomerDocument: p.requiresCustomerDocument,
              requiresExternalReference: p.requiresExternalReference,
              createdAt: p.createdAt.toISOString(),
              updatedAt: p.updatedAt.toISOString(),
              createdBy: ((g = n.typeCreatedBy.get(p.id)) == null ? void 0 : g.user) ?? null,
              updatedBy: ((T = n.typeUpdatedBy.get(p.id)) == null ? void 0 : T.user) ?? ((I = n.typeCreatedBy.get(p.id)) == null ? void 0 : I.user) ?? null
            };
          }),
          commissionRules: s.commissionRules.map((p) => ({
            id: p.id,
            typeId: p.typeId,
            mode: p.mode,
            value: p.value,
            minAmount: p.minAmount,
            maxAmount: p.maxAmount
          }))
        };
      })
    };
  }), a.handle("correspondent:dashboard", async () => {
    if (!d())
      return { success: !1, message: "Debes iniciar sesion" };
    const i = se(/* @__PURE__ */ new Date()), n = await Fe(r, i), s = we(n), t = n.reduce((c, u) => {
      const p = c[u.platformId] ?? {
        platformId: u.platformId,
        platform: u.platform.name,
        totalIn: 0,
        totalOut: 0,
        totalCommission: 0,
        count: 0,
        pendingClosureCount: 0
      };
      return u.status !== ie.VOIDED && (p.count += 1, p.totalCommission += u.commissionAmount, p.pendingClosureCount += u.dailyClosureId ? 0 : 1, u.type.direction === F.IN && (p.totalIn += u.amount), u.type.direction === F.OUT && (p.totalOut += u.amount)), c[u.platformId] = p, c;
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
      perPlatform: Object.values(t).sort((c, u) => c.platform.localeCompare(u.platform, "es")),
      recentTransactions: n.slice(0, 10).map((c) => ({
        id: c.id,
        approvalCode: c.approvalCode,
        platform: c.platform.name,
        type: c.type.name,
        amount: c.amount,
        commissionAmount: c.commissionAmount,
        externalReference: c.externalReference,
        customerName: c.customerName,
        performedAt: c.performedAt.toISOString(),
        status: c.status,
        registeredBy: c.registeredBy.name ?? c.registeredBy.username,
        hasEvidence: c.evidences.length > 0
      }))
    };
  }), a.handle("correspondent:transactions:list", async (l, i) => {
    var p;
    if (!d())
      return { success: !1, message: "Debes iniciar sesion", transactions: [] };
    const s = Da.safeParse(i);
    if (!s.success)
      return { success: !1, message: "Filtros invalidos", transactions: [] };
    const t = s.data, c = (p = t.search) == null ? void 0 : p.trim();
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
          OR: c ? [
            { approvalCode: { contains: c } },
            { externalReference: { contains: c } },
            { customerName: { contains: c } },
            { customerDocument: { contains: c } },
            { targetAccount: { contains: c } },
            { targetPhone: { contains: c } },
            { note: { contains: c } },
            { platform: { is: { name: { contains: c } } } },
            { type: { is: { name: { contains: c } } } },
            {
              registeredBy: {
                is: {
                  OR: [
                    { username: { contains: c } },
                    { name: { contains: c } }
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
  }), a.handle("correspondent:transaction:detail", async (l, i) => {
    if (!d())
      return { success: !1, message: "Debes iniciar sesion" };
    const s = Oa.safeParse(i);
    if (!s.success)
      return { success: !1, message: "Transaccion invalida" };
    const t = await Ja(r, s.data.transactionId);
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
        auditTrail: t.auditLogs.map((c) => ({
          id: c.id,
          action: c.action,
          createdAt: c.createdAt.toISOString(),
          user: c.user ? c.user.name ?? c.user.username : null,
          beforeJson: c.beforeJson,
          afterJson: c.afterJson,
          context: c.context
        }))
      }
    } : { success: !1, message: "La transaccion ya no existe" };
  }), a.handle("correspondent:transaction:create", async (l, i) => {
    var N, h, b, D, x, v, m, A, S, L;
    const n = d();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion para registrar movimientos" };
    const s = wa.safeParse(i);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para el corresponsal" };
    const t = s.data, c = new Date(t.performedAt), [u, p, g] = await Promise.all([
      r.correspondentPlatform.findUnique({ where: { id: t.platformId } }),
      r.correspondentTransactionType.findUnique({ where: { id: t.typeId } }),
      lt(r, n.id)
    ]);
    if (!u || !u.isActive)
      return { success: !1, message: "La plataforma seleccionada no esta disponible" };
    if (!p || !p.isActive || p.platformId !== u.id)
      return { success: !1, message: "El tipo de transaccion no corresponde a la plataforma" };
    if (await r.correspondentTransaction.findFirst({
      where: {
        platformId: u.id,
        typeId: p.id,
        amount: t.amount,
        externalReference: ((N = t.externalReference) == null ? void 0 : N.trim()) || null,
        performedAt: {
          gte: new Date(c.getTime() - 10 * 60 * 1e3),
          lte: new Date(c.getTime() + 10 * 60 * 1e3)
        },
        status: ie.REGISTERED
      }
    }))
      return { success: !1, message: "Parece un duplicado reciente. Verifica antes de registrar." };
    const I = t.commissionAmount ?? await mt(r, u.id, p.id, t.amount, c), f = p.direction === F.OUT ? t.amount - I : t.amount + I, y = t.evidence ? await Ha({ app: e, platformCode: u.code, evidence: t.evidence }) : null;
    try {
      const C = (await r.correspondentTransaction.findMany({
        select: { approvalCode: !0 }
      })).map((j) => j.approvalCode), O = qe({
        desiredCode: t.approvalCode,
        existingCodes: C,
        generatedPrefix: "APR",
        digits: 6,
        maxLength: 40
      }), _ = await r.correspondentTransaction.create({
        data: {
          approvalCode: O,
          platformId: u.id,
          typeId: p.id,
          cashSessionId: (g == null ? void 0 : g.id) ?? null,
          cashRegisterId: (g == null ? void 0 : g.registerId) ?? null,
          registeredByUserId: n.id,
          status: ie.REGISTERED,
          source: t.source,
          ocrStatus: (h = t.evidence) != null && h.ocrRawText ? Be.PROCESSED : u.supportsOcr ? Be.NEEDS_REVIEW : Be.NOT_REQUESTED,
          reconciliationStatus: da.PENDING,
          externalReference: ((b = t.externalReference) == null ? void 0 : b.trim()) || null,
          customerName: ((D = t.customerName) == null ? void 0 : D.trim()) || null,
          customerDocument: ((x = t.customerDocument) == null ? void 0 : x.trim()) || null,
          targetAccount: ((v = t.targetAccount) == null ? void 0 : v.trim()) || null,
          targetPhone: ((m = t.targetPhone) == null ? void 0 : m.trim()) || null,
          amount: t.amount,
          commissionAmount: I,
          netAmount: f,
          performedAt: c,
          note: ((A = t.note) == null ? void 0 : A.trim()) || null,
          rawExtractedText: ((S = t.rawExtractedText) == null ? void 0 : S.trim()) || ((L = t.evidence) == null ? void 0 : L.ocrRawText) || null,
          evidences: y ? {
            create: {
              ...y,
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
      return await te({
        prisma: r,
        currentSessionUser: n,
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
    } catch (C) {
      return { success: !1, message: C instanceof Error ? C.message : "No se pudo registrar la transaccion" };
    }
  }), a.handle("correspondent:transaction:update", async (l, i) => {
    const n = d();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion para editar movimientos" };
    const s = Ra.safeParse(i);
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
    const c = await r.correspondentTransactionType.findUnique({
      where: { id: s.data.typeId }
    });
    if (!c || !c.isActive || c.platformId !== t.platformId)
      return { success: !1, message: "El nuevo tipo no pertenece al mismo corresponsal" };
    const u = new Date(s.data.performedAt), p = await mt(
      r,
      t.platformId,
      c.id,
      s.data.amount,
      u
    ), g = c.direction === F.OUT ? s.data.amount - p : s.data.amount + p;
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
      }), f = await r.correspondentTransaction.update({
        where: { id: t.id },
        data: {
          approvalCode: I,
          typeId: c.id,
          amount: s.data.amount,
          commissionAmount: p,
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
      return await te({
        prisma: r,
        currentSessionUser: n,
        transactionId: f.id,
        action: "update_transaction",
        beforeJson: {
          approvalCode: t.approvalCode,
          type: t.type.name,
          amount: t.amount,
          performedAt: t.performedAt.toISOString(),
          commissionAmount: t.commissionAmount
        },
        afterJson: {
          approvalCode: f.approvalCode,
          type: f.type.name,
          amount: f.amount,
          performedAt: f.performedAt.toISOString(),
          commissionAmount: f.commissionAmount
        }
      }), {
        success: !0,
        transaction: {
          id: f.id,
          approvalCode: f.approvalCode,
          platform: f.platform.name,
          type: f.type.name,
          amount: f.amount,
          commissionAmount: f.commissionAmount,
          netAmount: f.netAmount,
          hasEvidence: f.evidences.length > 0
        }
      };
    } catch (T) {
      return { success: !1, message: T instanceof Error ? T.message : "No se pudo actualizar la transaccion" };
    }
  }), a.handle("correspondent:platform:create", async (l, i) => {
    const n = d();
    if (!n || n.role !== X.ADMIN)
      return { success: !1, message: "Solo el administrador puede crear corresponsales" };
    const s = La.safeParse(i);
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
          code: await ja(r, t),
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
          mode: Pe.NONE,
          value: 0,
          isActive: !0
        }
      }), await te({
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
  }), a.handle("correspondent:platform:update", async (l, i) => {
    const n = d();
    if (!n || n.role !== X.ADMIN)
      return { success: !1, message: "Solo el administrador puede editar corresponsales" };
    const s = _a.safeParse(i);
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
      return await te({
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
  }), a.handle("correspondent:platform:delete", async (l, i) => {
    const n = d();
    if (!n || n.role !== X.ADMIN)
      return { success: !1, message: "Solo el administrador puede eliminar corresponsales" };
    const s = Ba.safeParse(i);
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
      return await r.$transaction(async (c) => {
        await c.correspondentPlatform.update({
          where: { id: t.id },
          data: { isActive: !1 }
        }), t.transactionTypes.length > 0 && await c.correspondentTransactionType.updateMany({
          where: { platformId: t.id },
          data: { isActive: !1 }
        });
      }), await te({
        prisma: r,
        currentSessionUser: n,
        action: "delete_platform",
        context: `platform:${t.id}`,
        beforeJson: {
          name: t.name
        }
      }), { success: !0, platformId: t.id };
    } catch (c) {
      return { success: !1, message: c instanceof Error ? c.message : "No se pudo eliminar el corresponsal" };
    }
  }), a.handle("correspondent:type:create", async (l, i) => {
    var p;
    const n = d();
    if (!n || n.role !== X.ADMIN)
      return { success: !1, message: "Solo el administrador puede crear tipos" };
    const s = Ua.safeParse(i);
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
    const c = s.data.name.trim();
    if (await r.correspondentTransactionType.findFirst({
      where: {
        platformId: t.id,
        name: { equals: c }
      },
      select: { id: !0 }
    }))
      return { success: !1, message: "Ese corresponsal ya tiene un tipo con ese nombre" };
    try {
      const g = await r.correspondentTransactionType.create({
        data: {
          platformId: t.id,
          code: await za(r, t.id, c),
          name: c,
          direction: s.data.direction,
          isActive: !0,
          sortOrder: (((p = t.transactionTypes[0]) == null ? void 0 : p.sortOrder) ?? 0) + 10
        }
      });
      return await te({
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
  }), a.handle("correspondent:type:update", async (l, i) => {
    const n = d();
    if (!n || n.role !== X.ADMIN)
      return { success: !1, message: "Solo el administrador puede editar tipos" };
    const s = Ma.safeParse(i);
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
      return await te({
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
  }), a.handle("correspondent:type:delete", async (l, i) => {
    const n = d();
    if (!n || n.role !== X.ADMIN)
      return { success: !1, message: "Solo el administrador puede eliminar tipos" };
    const s = Fa.safeParse(i);
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
      }), await te({
        prisma: r,
        currentSessionUser: n,
        action: "delete_transaction_type",
        context: `platform:${t.platformId};type:${t.id}`,
        beforeJson: {
          name: t.name,
          direction: t.direction
        }
      }), { success: !0, typeId: t.id };
    } catch (c) {
      return { success: !1, message: c instanceof Error ? c.message : "No se pudo eliminar el tipo" };
    }
  }), a.handle("correspondent:closures:list", async (l, i) => {
    if (!d())
      return { success: !1, message: "Debes iniciar sesion", closures: [] };
    const s = Pa.safeParse(i);
    if (!s.success)
      return { success: !1, message: "Fecha de cierre invalida", closures: [] };
    const t = !!(s.data.dateFrom || s.data.dateTo), c = ve(s.data.dateFrom ?? s.data.businessDate), u = ve(s.data.dateTo ?? s.data.dateFrom ?? s.data.businessDate), p = ve(s.data.businessDate ?? s.data.dateFrom), [g, T, I] = await Promise.all([
      r.correspondentPlatform.findMany({
        where: { isActive: !0 },
        orderBy: [{ createdAt: "asc" }, { name: "asc" }]
      }),
      r.correspondentDailyClosure.findMany({
        where: t ? {
          businessDate: {
            gte: se(c),
            lt: xe(u)
          }
        } : { businessDate: p },
        include: {
          platform: !0,
          closedBy: { select: { username: !0, name: !0 } }
        },
        orderBy: { closedAt: "desc" }
      }),
      t ? Ya(r, c, u) : Fe(r, p)
    ]), f = new Map(
      T.map((b) => [b.platformId, b])
    ), y = T.reduce((b, D) => (b[D.platformId] = (b[D.platformId] ?? 0) + 1, b), {}), N = I.reduce((b, D) => (b[D.platformId] = [...b[D.platformId] ?? [], D], b), {}), h = we(I);
    return {
      success: !0,
      mode: t ? "range" : "day",
      businessDate: p.toISOString(),
      dateFrom: se(c).toISOString(),
      dateTo: se(u).toISOString(),
      totals: {
        totalIn: h.totalIn,
        totalOut: h.totalOut,
        netTotal: h.totalIn - h.totalOut,
        transactionsCount: h.transactionsCount
      },
      closures: g.map((b) => {
        const D = N[b.id] ?? [], x = we(D), v = f.get(b.id) ?? null, m = D.reduce((A, S) => {
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
          breakdown: Object.values(m).sort((A, S) => A.type.localeCompare(S.type, "es")),
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
  }), a.handle("correspondent:closure:create", async (l, i) => {
    const n = d();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion para cerrar" };
    const s = xa.safeParse(i);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para el cierre" };
    const t = s.data, c = ve(t.businessDate);
    if (await r.correspondentDailyClosure.findFirst({
      where: {
        platformId: t.platformId,
        businessDate: c
      }
    }))
      return { success: !1, message: "La plataforma ya fue cerrada para esa fecha" };
    const [p, g, T] = await Promise.all([
      r.correspondentPlatform.findUnique({ where: { id: t.platformId } }),
      Fe(r, c, t.platformId),
      lt(r, n.id)
    ]);
    if (!p)
      return { success: !1, message: "Plataforma no encontrada" };
    const I = g.filter(
      (h) => h.status === ie.REGISTERED && !h.dailyClosureId
    ), f = we(I), y = t.openingBalance + f.totalIn - f.totalOut + f.totalCommission, N = t.reportedBalance - y;
    try {
      const h = await r.$transaction(async (b) => {
        var x;
        const D = await b.correspondentDailyClosure.create({
          data: {
            platformId: p.id,
            cashSessionId: (T == null ? void 0 : T.id) ?? null,
            businessDate: c,
            totalIn: f.totalIn,
            totalOut: f.totalOut,
            totalCommission: f.totalCommission,
            transactionsCount: f.transactionsCount,
            expectedBalance: y,
            reportedBalance: t.reportedBalance,
            differenceAmount: N,
            status: N === 0 ? it.CLOSED : it.WITH_DIFFERENCE,
            note: ((x = t.note) == null ? void 0 : x.trim()) || null,
            closedByUserId: n.id
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
      return await te({
        prisma: r,
        currentSessionUser: n,
        action: "create_closure",
        context: `platform:${p.id};closure:${h.id}`,
        afterJson: {
          platform: p.name,
          businessDate: c.toISOString(),
          expectedBalance: y,
          reportedBalance: t.reportedBalance,
          differenceAmount: N
        }
      }), {
        success: !0,
        closure: {
          id: h.id,
          expectedBalance: y,
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
const Wa = o.enum(["CASH", "TRANSFER", "CORRESPONDENT"]), Za = o.object({
  dateFrom: o.string().datetime().optional(),
  dateTo: o.string().datetime().optional()
}).optional().default({}), es = o.object({
  saleId: o.string().uuid("saleId invalido"),
  customerId: o.string().uuid("customerId invalido"),
  total: o.number().int("El valor debe ser entero").positive("El valor debe ser mayor a 0").optional(),
  dueDate: o.string().datetime("Fecha de vencimiento invalida").optional().nullable()
}), ts = o.object({
  creditId: o.string().uuid("creditId invalido"),
  amount: o.number().int("El valor debe ser entero").positive("El valor debe ser mayor a 0"),
  method: Qe.optional().default("CASH"),
  note: o.string().trim().max(250).optional().nullable()
}), as = o.object({
  saleId: o.string().uuid("saleId invalido"),
  amount: o.number().int("El valor debe ser entero").positive("El valor debe ser mayor a 0"),
  reason: o.string().trim().max(250).optional().nullable()
}), ss = o.object({
  amount: o.number().int("El valor debe ser entero").positive("El valor debe ser mayor a 0"),
  note: o.string().trim().min(2, "La descripcion es obligatoria").max(250),
  type: o.enum(["EXPENSE_OUT", "WITHDRAWAL_OUT"]).optional().default("EXPENSE_OUT"),
  sourceMedium: Wa.optional().default("CASH"),
  sourcePlatformId: o.string().uuid("Plataforma invalida").optional().nullable()
}), Lt = o.enum([
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
]), rs = [0, 0.05, 0.19], ns = o.object({
  minQty: o.number().int().min(1, "La cantidad minima debe ser mayor a 0"),
  unitPrice: o.number().min(0, "El precio unitario no puede ser negativo")
}), os = o.object({
  id: o.string().trim().min(1).max(80),
  label: o.string().trim().min(1).max(80),
  unitPrice: o.number().min(0, "El precio unitario no puede ser negativo")
}), Ut = o.object({
  enabled: o.boolean().optional().default(!1),
  basePrice: o.number().positive("El precio base debe ser mayor a 0").optional().default(0),
  minimumPrice: o.number().min(0, "El precio minimo no puede ser negativo").optional().default(0),
  quantityScales: o.array(ns).optional().default([]),
  specialPriceRules: o.array(os).optional().default([])
}).superRefine((e, a) => {
  if (!e.enabled)
    return;
  e.basePrice <= 0 && a.addIssue({
    code: o.ZodIssueCode.custom,
    message: "Debes configurar un precio base valido",
    path: ["basePrice"]
  });
  const r = /* @__PURE__ */ new Set();
  for (const [l, i] of e.quantityScales.entries())
    i.unitPrice < e.minimumPrice && a.addIssue({
      code: o.ZodIssueCode.custom,
      message: "La escala no puede quedar por debajo del precio minimo permitido",
      path: ["quantityScales", l, "unitPrice"]
    }), r.has(i.minQty) && a.addIssue({
      code: o.ZodIssueCode.custom,
      message: "No repitas la misma cantidad minima en las escalas",
      path: ["quantityScales", l, "minQty"]
    }), r.add(i.minQty);
  const d = /* @__PURE__ */ new Set();
  for (const [l, i] of e.specialPriceRules.entries())
    i.unitPrice < e.minimumPrice && a.addIssue({
      code: o.ZodIssueCode.custom,
      message: "La tarifa especial no puede quedar por debajo del precio minimo permitido",
      path: ["specialPriceRules", l, "unitPrice"]
    }), d.has(i.id) && a.addIssue({
      code: o.ZodIssueCode.custom,
      message: "Cada tarifa especial debe tener un identificador unico",
      path: ["specialPriceRules", l, "id"]
    }), d.add(i.id);
});
function _t(e, a) {
  e !== void 0 && (rs.includes(e) || a.addIssue({
    code: o.ZodIssueCode.custom,
    message: "El IVA permitido es: no aplica, 0%, 5% o 19%",
    path: ["taxRate"]
  }));
}
const is = o.object({
  name: o.string({ message: "El nombre es obligatorio" }).trim().min(2, "Minimo 2 caracteres").max(120, "Maximo 120 caracteres"),
  barcode: o.string().trim().min(1).max(50).optional().nullable(),
  sku: o.string().trim().min(1).max(50).optional().nullable(),
  unitMeasure: Lt.optional().default("UNIDAD"),
  price: o.number({ message: "El precio es obligatorio" }).positive("El precio debe ser mayor a 0"),
  cost: o.number().min(0, "El costo no puede ser negativo").optional().default(0),
  marginPercent: o.number().min(0, "La ganancia no puede ser negativa").optional().default(0),
  hasTax: o.boolean().optional().default(!1),
  taxRate: o.number().min(0).max(1).optional().default(0),
  stock: o.number().int("El stock debe ser un numero entero").min(0, "El stock no puede ser negativo").optional().default(0),
  categoryId: o.string().uuid().optional().nullable(),
  subcategoryId: o.string().uuid().optional().nullable(),
  isActive: o.boolean().optional().default(!0),
  pricingConfig: Ut.optional().nullable()
}).superRefine((e, a) => {
  _t(e.taxRate, a);
}), cs = o.object({
  id: o.string().uuid("ID de producto invalido"),
  name: o.string().trim().min(2, "Minimo 2 caracteres").max(120).optional(),
  barcode: o.string().trim().min(1).max(50).optional().nullable(),
  sku: o.string().trim().min(1).max(50).optional().nullable(),
  unitMeasure: Lt.optional(),
  price: o.number().positive("El precio debe ser mayor a 0").optional(),
  cost: o.number().min(0).optional(),
  marginPercent: o.number().min(0).optional(),
  hasTax: o.boolean().optional(),
  taxRate: o.number().min(0).max(1).optional(),
  stock: o.number().int().min(0).optional(),
  categoryId: o.string().uuid().optional().nullable(),
  subcategoryId: o.string().uuid().optional().nullable(),
  isActive: o.boolean().optional(),
  pricingConfig: Ut.optional().nullable()
}).superRefine((e, a) => {
  _t(e.taxRate, a);
});
o.object({
  productId: o.string().uuid("ID de producto invalido"),
  delta: o.number().int("El ajuste debe ser un numero entero").refine((e) => e !== 0, "El ajuste no puede ser 0"),
  reason: o.string().trim().max(200).optional()
});
o.object({
  barcode: o.string().trim().min(1, "Barcode no puede estar vacio")
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
}, ds = [
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
], us = [
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
    sections: ds
  },
  {
    key: "EMPLOYEE",
    name: "Empleado",
    description: "Acceso operativo para ventas y caja, con permisos limitados sobre configuracion, usuarios y reportes sensibles.",
    sections: us
  }
];
function ls(e) {
  return Le.find((a) => a.key === e) ?? Le[0];
}
function ke(e) {
  return e.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function w(e, a, r) {
  return [ke(e), ke(a), ke(r)].filter(Boolean).join(".");
}
function Bt(e) {
  return e.sections.flatMap(
    (a) => a.groups.flatMap(
      (r) => r.permissions.map((d) => ({
        key: w(a.title, r.title, d),
        label: d,
        sectionTitle: a.title,
        groupTitle: r.title
      }))
    )
  );
}
function Ft(e, a) {
  return Bt(ls(e)).find((r) => r.key === a) ?? null;
}
const ms = {
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
}, ps = {
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
  ...ms,
  ...ps
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
}, fs = {
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
function gs(e) {
  return e ? [
    e,
    ...kt[e] ?? [],
    ...$t[e] ?? []
  ] : [];
}
function Xt(e, a) {
  if (!a)
    return !0;
  const r = e ?? [];
  return gs(a).some((d) => r.includes(d));
}
function be(e) {
  const a = /* @__PURE__ */ new Set();
  for (const r of e ?? []) {
    const d = fs[r];
    if (d) {
      for (const l of d)
        a.add(l);
      continue;
    }
    a.add(r);
  }
  return Array.from(a);
}
function Q(e) {
  return Math.max(0, Math.round(Number(e || 0)));
}
function Ze(e) {
  return {
    minQty: Math.max(1, Math.round(Number(e.minQty || 0))),
    unitPrice: Q(e.unitPrice)
  };
}
function _e(e) {
  return {
    id: String(e.id || "").trim() || crypto.randomUUID(),
    label: String(e.label || "").trim() || "Tarifa especial",
    unitPrice: Q(e.unitPrice)
  };
}
function Es(e) {
  return _e({
    id: `legacy-${e.customerSegment.toLowerCase()}`,
    label: "Tarifa especial",
    unitPrice: e.unitPrice
  });
}
function Ts(e) {
  if (!e.enabled)
    return null;
  const r = (e.sheetTypes ?? []).map((d) => ({
    basePrice: Q(d.basePrice),
    minimumPrice: d.minimumPrice === null || d.minimumPrice === void 0 ? null : Q(d.minimumPrice),
    quantityScales: (d.quantityScales ?? []).map(Ze).filter((l) => l.unitPrice > 0).sort((l, i) => l.minQty - i.minQty).filter(
      (l, i, n) => n.findIndex((s) => s.minQty === l.minQty) === i
    ),
    specialPriceRules: [
      ...d.specialPriceRules ?? [],
      ...(d.customerSegmentRules ?? []).map(Es)
    ].map(_e).filter((l) => l.unitPrice > 0).filter(
      (l, i, n) => n.findIndex(
        (s) => s.id === l.id || s.label.toLowerCase() === l.label.toLowerCase()
      ) === i
    )
  })).filter((d) => d.basePrice > 0)[0];
  return r ? {
    enabled: !0,
    basePrice: r.basePrice,
    minimumPrice: r.minimumPrice ?? Q(e.minimumPrice),
    quantityScales: r.quantityScales,
    specialPriceRules: r.specialPriceRules
  } : null;
}
function As(e, a) {
  return [...e.quantityScales].map(Ze).filter((d) => d.minQty <= a && d.unitPrice > 0).sort((d, l) => l.minQty - d.minQty)[0] ?? null;
}
function Is(e, a) {
  return a ? e.specialPriceRules.map(_e).find((r) => r.id === a && r.unitPrice > 0) ?? null : null;
}
function Ee(e) {
  if (!(e != null && e.enabled))
    return null;
  if ("sheetTypes" in e)
    return Ts(e);
  const a = e, r = {
    enabled: !0,
    basePrice: Q(a.basePrice),
    minimumPrice: Q(a.minimumPrice),
    quantityScales: (a.quantityScales ?? []).map(Ze).filter((d) => d.unitPrice > 0).sort((d, l) => d.minQty - l.minQty).filter(
      (d, l, i) => i.findIndex((n) => n.minQty === d.minQty) === l
    ),
    specialPriceRules: (a.specialPriceRules ?? []).map(_e).filter((d) => d.unitPrice > 0).filter(
      (d, l, i) => i.findIndex(
        (n) => n.id === d.id || n.label.toLowerCase() === d.label.toLowerCase()
      ) === l
    )
  };
  return r.basePrice <= 0 ? null : r;
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
    return Q(e);
  const l = [
    r.basePrice,
    ...r.quantityScales.map((i) => i.unitPrice)
  ].filter((i) => i > 0);
  return l.length > 0 ? Math.min(...l) : Q(e);
}
function ys({
  fallbackPrice: e,
  pricingConfig: a,
  qty: r,
  specialRuleId: d,
  manualUnitPrice: l,
  canOverrideMinimum: i = !1
}) {
  const n = Math.max(1, Math.round(Number(r || 1))), s = Q(e), t = Ee(a);
  if (!t)
    return {
      ok: !0,
      quote: {
        unitPrice: s,
        subtotal: s * n,
        minimumPrice: 0,
        specialRuleId: null,
        specialRuleLabel: null,
        source: "FIXED_PRICE",
        sourceLabel: "Precio fijo del producto",
        priceBeforeMinimum: s,
        minimumApplied: !1
      }
    };
  const c = t.minimumPrice;
  if (l != null) {
    const f = Q(l);
    return f < c && !i ? {
      ok: !1,
      message: `El precio manual no puede quedar por debajo del minimo permitido de ${c}.`
    } : {
      ok: !0,
      quote: {
        unitPrice: f,
        subtotal: f * n,
        minimumPrice: c,
        specialRuleId: null,
        specialRuleLabel: null,
        source: "MANUAL_OVERRIDE",
        sourceLabel: "Ajuste manual autorizado",
        priceBeforeMinimum: f,
        minimumApplied: !1
      }
    };
  }
  const u = Is(t, d);
  if (d && !u)
    return {
      ok: !1,
      message: "La tarifa especial seleccionada ya no esta disponible para este producto."
    };
  const p = As(t, n), g = (p == null ? void 0 : p.unitPrice) ?? t.basePrice, T = (u == null ? void 0 : u.unitPrice) ?? g, I = T < c && !i ? c : T;
  return {
    ok: !0,
    quote: {
      unitPrice: I,
      subtotal: I * n,
      minimumPrice: c,
      specialRuleId: (u == null ? void 0 : u.id) ?? null,
      specialRuleLabel: (u == null ? void 0 : u.label) ?? null,
      source: u ? "SPECIAL_RULE" : p ? "QUANTITY_SCALE" : "FIXED_PRICE",
      sourceLabel: u ? u.label : p ? `Escala desde ${p.minQty} unidades` : "Precio base",
      priceBeforeMinimum: T,
      minimumApplied: I !== T
    }
  };
}
const Ns = o.object({
  name: o.string().trim().min(2).max(80)
}), Cs = o.object({
  categoryId: o.string().uuid(),
  name: o.string().trim().min(2).max(80)
}), Ie = o.object({
  id: o.string().uuid()
}), qt = o.enum([
  "Cédula",
  "NIT",
  "Cédula de extranjería",
  "Pasaporte",
  "Tarjeta de identidad"
]), Vt = o.object({
  internalCode: o.string().trim().max(30).optional().nullable(),
  firstName: o.string().trim().min(2).max(80),
  lastName: o.string().trim().max(80).optional().default(""),
  documentType: qt.optional().default("Cédula"),
  documentNumber: o.string().trim().max(40).optional().nullable(),
  phone: o.string().trim().regex(/^\d{10}$/).optional().nullable(),
  email: o.string().trim().email().max(120).optional().nullable(),
  address: o.string().trim().max(180).optional().nullable(),
  isActive: o.boolean().optional().default(!0)
}), hs = Vt.extend({
  id: o.string().uuid()
}), jt = o.object({
  internalCode: o.string().trim().max(30).optional().nullable(),
  name: o.string().trim().min(2).max(120),
  contactName: o.string().trim().max(120).optional().nullable(),
  documentType: qt.optional().default("NIT"),
  documentNumber: o.string().trim().max(40).optional().nullable(),
  phone: o.string().trim().regex(/^\d{10}$/).optional().nullable(),
  email: o.string().trim().email().max(120).optional().nullable(),
  address: o.string().trim().max(180).optional().nullable(),
  isActive: o.boolean().optional().default(!0)
}), bs = jt.extend({
  id: o.string().uuid()
}), vs = o.object({
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
}), zt = o.object({
  platformId: o.string().uuid(),
  amount: o.number().min(0)
}), Ss = o.object({
  openingCashAmount: o.number().min(0),
  openingTransferAmount: o.number().min(0).optional().default(0),
  note: o.string().trim().max(300).optional().nullable(),
  cashBreakdown: o.record(o.string(), o.number()).optional().default({}),
  correspondentBalances: o.array(zt).optional().default([])
}), ws = o.object({
  sessionId: o.string().uuid(),
  countedCashAmount: o.number().min(0),
  countedTransferAmount: o.number().min(0).optional().default(0),
  note: o.string().trim().max(300).optional().nullable(),
  cashBreakdown: o.record(o.string(), o.number()).optional().default({}),
  correspondentBalances: o.array(zt).optional().default([])
}), Rs = o.enum(["LIGHT", "DARK"]), Gt = o.enum(["NORMAL", "THERMAL_80", "THERMAL_50"]), Os = o.object({
  businessName: o.string().trim().max(120).optional().nullable(),
  taxId: o.string().trim().max(40).optional().nullable(),
  address: o.string().trim().max(180).optional().nullable(),
  city: o.string().trim().max(80).optional().nullable()
}), Ds = o.object({
  themeMode: Rs
}), Ps = o.object({
  invoicePrefix: o.string().trim().max(10).optional().nullable(),
  defaultReceiptTemplate: Gt.optional().default("NORMAL"),
  receiptFooter: o.string().trim().max(400).optional().nullable()
}), xs = o.object({
  defaultTaxRate: o.number().min(0).max(1).optional(),
  allowNegativeStock: o.boolean().optional()
}), Ls = o.object({
  dateFrom: o.string().datetime().optional(),
  dateTo: o.string().datetime().optional(),
  cashierId: o.string().uuid().optional(),
  status: o.nativeEnum(fe).optional(),
  search: o.string().trim().max(80).optional()
}).optional().default({}), Us = o.object({
  saleId: o.string().uuid()
}), gt = Us.extend({
  template: Gt.optional().default("NORMAL")
});
function H(e) {
  return Math.round(e);
}
const Kt = "|||CITY|||";
function Et(e, a) {
  const r = (e == null ? void 0 : e.trim()) || "", d = (a == null ? void 0 : a.trim()) || "";
  return d ? `${r}${Kt}${d}` : r || null;
}
function Tt(e) {
  var r, d;
  if (!e)
    return { address: "", city: "" };
  const a = e.split(Kt);
  return {
    address: ((r = a[0]) == null ? void 0 : r.trim()) || "",
    city: ((d = a[1]) == null ? void 0 : d.trim()) || ""
  };
}
function _s(e, a = 0, r = !1, d = 0) {
  const l = Number(e || 0) * (1 + Number(a || 0) / 100), i = r ? l * (1 + Number(d || 0)) : l;
  return H(i);
}
function pe(e) {
  return e === z.CARD || e === z.TRANSFER ? "Transferencia" : "Efectivo";
}
function Ms(e, a) {
  return !e || e.length <= 1 ? pe(a) : e.map((r) => `${pe(r.method)} $${r.amount.toLocaleString("es-CO")}`).join(" + ");
}
function Bs(e) {
  const a = he(e.cashier), r = Ht(e.receiptFooter), d = e.items.map(
    (i) => `
        <tr>
          <td>${i.name}</td>
          <td style="text-align:center">${i.qty}</td>
          <td style="text-align:right">$${i.price.toLocaleString("es-CO")}</td>
          <td style="text-align:right">$${i.lineTotal.toLocaleString("es-CO")}</td>
        </tr>
      `
  ).join(""), l = [e.address, e.city].filter(Boolean).join(" - ");
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
            ${l ? `<div>Dirección: ${l}</div>` : ""}
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
          <tbody>${d}</tbody>
        </table>

        <div class="totals">
          <div class="totals-row"><span>Subtotal</span><strong>$${e.subtotal.toLocaleString("es-CO")}</strong></div>
          <div class="totals-row"><span>IVA</span><strong>$${e.tax.toLocaleString("es-CO")}</strong></div>
          <div class="totals-row total"><span>Total</span><strong>$${e.total.toLocaleString("es-CO")}</strong></div>
        </div>
        <div class="legal-notes">${r.map((i) => `<p>${i}</p>`).join("")}</div>
      </body>
    </html>
  `;
}
function Fs(e, a) {
  if (a === "NORMAL")
    return Bs(e);
  const r = a === "THERMAL_50" ? 50 : 80, d = [e.address, e.city].filter(Boolean).join(" - "), l = he(e.cashier), i = Ht(e.receiptFooter), n = e.items.map(
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
            ${d ? `<p class="muted">${d}</p>` : ""}
          </div>

          <div class="meta">
            <div><strong>Factura:</strong> ${e.invoiceNumber}</div>
            <div><strong>Fecha:</strong> ${e.createdAt.toLocaleString("es-CO")}</div>
            <div><strong>Cliente:</strong> ${e.customer}</div>
            <div><strong>Cajero:</strong> ${l}</div>
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
          <div class="footer">${i.map((s) => `<p class="muted">${s}</p>`).join("")}</div>
        </div>
      </body>
    </html>
  `;
}
async function At(e) {
  const a = e();
  if (!a || a.role !== X.ADMIN)
    throw new Error("Solo admins pueden ejecutar esta accion");
  return a;
}
function M(e, a) {
  return a ? Xt(e == null ? void 0 : e.permissions, a) : !0;
}
function $e(e) {
  var a;
  return ((a = e == null ? void 0 : e.name) == null ? void 0 : a.trim()) || (e == null ? void 0 : e.username) || "Sistema";
}
function he(e) {
  var d;
  const a = ((d = e.name) == null ? void 0 : d.trim()) || e.username, [r] = a.split(/\s+/).filter(Boolean);
  return r || a;
}
function Ht(e) {
  const a = [
    "Esta factura de venta podra constituirse como titulo valor conforme a la legislacion comercial aplicable y cuando se cumplan los requisitos legales.",
    "En ventas a credito, la mora en el pago causara intereses a la tasa maxima legal vigente."
  ];
  return e != null && e.trim() && a.push(e.trim()), a;
}
function It(e, a) {
  return [e.trim(), (a == null ? void 0 : a.trim()) || ""].filter(Boolean).join(" ");
}
function Re(e, a) {
  const r = a == null ? void 0 : a.trim();
  return r ? `${e || "Cédula"}: ${r}` : null;
}
async function le(e, a, r, d, l = !1) {
  var s, t, c;
  if (r.length === 0)
    return /* @__PURE__ */ new Map();
  const i = await e.auditLog.findMany({
    where: {
      entity: a,
      action: d,
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
    orderBy: { createdAt: l ? "desc" : "asc" }
  }), n = /* @__PURE__ */ new Map();
  for (const u of i)
    !u.entityId || n.has(u.entityId) || n.set(u.entityId, ((t = (s = u.user) == null ? void 0 : s.name) == null ? void 0 : t.trim()) || ((c = u.user) == null ? void 0 : c.username) || "Sistema");
  return n;
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
function yt(e) {
  return JSON.stringify(e);
}
function Ve(e) {
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
function Xe(e, a = "Movimiento de caja") {
  const r = ne(e);
  return (r == null ? void 0 : r.label) || (r == null ? void 0 : r.userNote) || e || a;
}
function de(e) {
  var a;
  return ((a = ne(e)) == null ? void 0 : a.medium) ?? "CASH";
}
function ks(e) {
  var a;
  return ((a = ne(e)) == null ? void 0 : a.platformId) ?? null;
}
function ze(e) {
  var a;
  return ((a = ne(e)) == null ? void 0 : a.platformName) ?? null;
}
function $s(e, a) {
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
function Xs(e) {
  return e.reduce(
    (a, r) => {
      if (r.payments && r.payments.length > 0) {
        for (const d of r.payments)
          d.method === z.CASH && (a.cash += d.amount), (d.method === z.TRANSFER || d.method === z.CARD) && (a.transfer += d.amount);
        return a;
      }
      return r.paymentMethod === z.CASH ? a.cash += r.total : a.transfer += r.total, a;
    },
    { cash: 0, transfer: 0 }
  );
}
function qs(e) {
  const a = /* @__PURE__ */ new Map();
  for (const r of e) {
    if (de(r.note) !== "CORRESPONDENT")
      continue;
    const l = ks(r.note);
    if (!l)
      continue;
    const i = a.get(l) ?? { manualIncome: 0, manualExpense: 0, platformName: ze(r.note) };
    r.type === k.INCOME_IN && (i.manualIncome += r.amount), (r.type === k.EXPENSE_OUT || r.type === k.WITHDRAWAL_OUT) && (i.manualExpense += r.amount), i.platformName || (i.platformName = ze(r.note)), a.set(l, i);
  }
  return a;
}
function Nt(e) {
  const a = Y(e.session.note), r = J(a, "opening"), d = J(a, "closing"), l = Ve(
    r.correspondentBalances ?? []
  ), i = Ve(
    d.correspondentBalances ?? []
  ), n = ce(r), s = d.transferAmount === void 0 ? null : ce(d), t = Xs(e.session.sales), c = e.session.movements.filter((m) => m.type === k.INCOME_IN && de(m.note) === "CASH").reduce((m, A) => m + A.amount, 0), u = e.session.movements.filter((m) => m.type === k.INCOME_IN && de(m.note) === "TRANSFER").reduce((m, A) => m + A.amount, 0), p = e.session.movements.filter(
    (m) => (m.type === k.EXPENSE_OUT || m.type === k.WITHDRAWAL_OUT) && de(m.note) === "CASH"
  ).reduce((m, A) => m + A.amount, 0), g = e.session.movements.filter(
    (m) => (m.type === k.EXPENSE_OUT || m.type === k.WITHDRAWAL_OUT) && de(m.note) === "TRANSFER"
  ).reduce((m, A) => m + A.amount, 0), T = qs(e.session.movements), I = e.session.openingAmount + t.cash + c - p, f = n + t.transfer + u - g, y = e.platforms.map((m) => {
    const A = e.session.correspondentTransactions.filter(
      (B) => B.platform.id === m.id
    ), S = A.filter((B) => B.type.direction === F.IN).reduce((B, $) => B + $.amount, 0), L = A.filter((B) => B.type.direction === F.OUT).reduce((B, $) => B + $.amount, 0), C = A.reduce((B, $) => B + $.commissionAmount, 0), O = T.get(m.id) ?? {
      manualIncome: 0,
      manualExpense: 0,
      platformName: m.name
    }, _ = l.get(m.id) ?? 0, j = _ + S - L + C + O.manualIncome - O.manualExpense, K = i.has(m.id) ? i.get(m.id) ?? 0 : null;
    return {
      platformId: m.id,
      platform: m.name,
      openingAmount: _,
      totalIn: S,
      totalOut: L,
      totalCommission: C,
      manualIncome: O.manualIncome,
      manualExpense: O.manualExpense,
      expectedAmount: j,
      countedAmount: K,
      differenceAmount: K === null ? null : K - j
    };
  }), N = y.reduce((m, A) => m + A.openingAmount, 0), h = y.reduce((m, A) => m + A.expectedAmount, 0), b = y.reduce(
    (m, A) => m + (A.countedAmount ?? A.expectedAmount),
    0
  ), D = d.cashBreakdown && typeof d.cashBreakdown == "object" ? null : e.session.countedAmount ?? null, x = I + f + h, v = (e.session.countedAmount ?? I) + (s ?? f) + b;
  return {
    sessionMeta: a,
    opening: r,
    closing: d,
    openingTransferAmount: n,
    countedTransferAmount: s,
    salesCash: t.cash,
    salesTransfer: t.transfer,
    cashManualIncome: c,
    transferManualIncome: u,
    cashManualExpense: p,
    transferManualExpense: g,
    expectedCash: I,
    expectedTransferAmount: f,
    openingCorrespondentTotal: N,
    correspondentExpectedTotal: h,
    countedCorrespondentTotal: b,
    correspondentByPlatform: y,
    expectedAvailableTotal: x,
    countedAvailableTotal: v,
    countedCashAmount: D
  };
}
function Vs() {
  const e = /* @__PURE__ */ new Date();
  return e.setHours(0, 0, 0, 0), e;
}
function ye(e, a, r) {
  return a <= 0 ? Te.CANCELLED : e <= 0 ? Te.PAID : r && r.getTime() < Vs().getTime() ? Te.OVERDUE : e < a ? Te.PARTIAL : Te.PENDING;
}
function Ct(e, a) {
  return a >= e ? fe.RETURNED : a > 0 ? fe.PARTIALLY_RETURNED : fe.COMPLETED;
}
async function js(e) {
  const a = await e.$queryRawUnsafe(
    'PRAGMA table_info("BusinessSettings");'
  ), r = new Set(a.map((p) => p.name));
  r.has("themeMode") || await e.$executeRawUnsafe(
    `ALTER TABLE "BusinessSettings" ADD COLUMN "themeMode" TEXT NOT NULL DEFAULT 'LIGHT';`
  ), r.has("defaultReceiptTemplate") || await e.$executeRawUnsafe(
    `ALTER TABLE "BusinessSettings" ADD COLUMN "defaultReceiptTemplate" TEXT NOT NULL DEFAULT 'NORMAL';`
  );
  const d = await e.$queryRawUnsafe('PRAGMA table_info("Customer");'), l = await e.$queryRawUnsafe('PRAGMA table_info("Supplier");'), i = new Set(d.map((p) => p.name)), n = new Set(l.map((p) => p.name));
  i.has("segment") && (await e.$executeRawUnsafe("PRAGMA foreign_keys=OFF;"), await e.$executeRawUnsafe(`
      CREATE TABLE "new_Customer" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "internalCode" TEXT,
        "name" TEXT NOT NULL,
        "document" TEXT,
        "phone" TEXT,
        "email" TEXT,
        "address" TEXT,
        "creditLimit" INTEGER NOT NULL DEFAULT 0,
        "notes" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL
      );
    `), await e.$executeRawUnsafe(`
      INSERT INTO "new_Customer" (
        "id",
        "internalCode",
        "name",
        "document",
        "phone",
        "email",
        "address",
        "creditLimit",
        "notes",
        "isActive",
        "createdAt",
        "updatedAt"
      )
      SELECT
        "id",
        "internalCode",
        "name",
        "document",
        "phone",
        "email",
        "address",
        "creditLimit",
        "notes",
        "isActive",
        "createdAt",
        "updatedAt"
      FROM "Customer";
    `), await e.$executeRawUnsafe('DROP TABLE "Customer";'), await e.$executeRawUnsafe('ALTER TABLE "new_Customer" RENAME TO "Customer";'), await e.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "Customer_document_key" ON "Customer"("document");'
  ), await e.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Customer_name_idx" ON "Customer"("name");'
  ), await e.$executeRawUnsafe("PRAGMA foreign_keys=ON;"), i.delete("segment"), i.add("internalCode")), i.has("internalCode") || await e.$executeRawUnsafe('ALTER TABLE "Customer" ADD COLUMN "internalCode" TEXT;'), n.has("internalCode") || await e.$executeRawUnsafe('ALTER TABLE "Supplier" ADD COLUMN "internalCode" TEXT;');
  const s = await e.customer.findMany({
    select: {
      id: !0,
      internalCode: !0
    },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }]
  }), t = [];
  for (const p of s) {
    const g = ae({
      desiredCode: p.internalCode,
      existingCodes: t,
      prefix: "CLI",
      digits: 4,
      maxLength: 30
    });
    g !== p.internalCode && await e.customer.update({
      where: { id: p.id },
      data: { internalCode: g }
    }), t.push(g);
  }
  const c = await e.supplier.findMany({
    select: {
      id: !0,
      internalCode: !0
    },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }]
  }), u = [];
  for (const p of c) {
    const g = ae({
      desiredCode: p.internalCode,
      existingCodes: u,
      prefix: "PRV",
      digits: 4,
      maxLength: 30
    });
    g !== p.internalCode && await e.supplier.update({
      where: { id: p.id },
      data: { internalCode: g }
    }), u.push(g);
  }
  await e.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "Customer_internalCode_key" ON "Customer"("internalCode");'
  ), await e.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "Supplier_internalCode_key" ON "Supplier"("internalCode");'
  );
}
function zs(e, a) {
  return ((a || e || "PRD").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 3) || "PRD").padEnd(3, "X");
}
async function Gs(e, a, r) {
  const d = zs(a, r), l = await e.product.count({
    where: { sku: { startsWith: d } }
  });
  return `${d}-${String(l + 1).padStart(3, "0")}`;
}
async function Ks(e) {
  const a = await e.purchase.count();
  return `CP-${String(a + 1).padStart(6, "0")}`;
}
async function V(e, a, r, d, l, i, n, s) {
  await e.auditLog.create({
    data: {
      userId: (a == null ? void 0 : a.id) ?? null,
      module: r,
      action: d,
      entity: l,
      entityId: i ?? null,
      beforeJson: n === void 0 ? null : JSON.stringify(n),
      afterJson: s === void 0 ? null : JSON.stringify(s)
    }
  });
}
function Hs({
  ipcMain: e,
  prisma: a,
  getCurrentSessionUser: r,
  getConnectedAt: d
}) {
  e.handle("app:status", async () => ({
    success: !0,
    connectedAt: d().toISOString(),
    now: (/* @__PURE__ */ new Date()).toISOString()
  })), e.handle("settings:get", async () => {
    if (!r())
      return { success: !1, message: "Debes iniciar sesion" };
    const i = await a.businessSettings.findUnique({
      where: { id: "default" }
    }), n = Tt(i == null ? void 0 : i.address);
    return {
      success: !0,
      settings: {
        businessName: (i == null ? void 0 : i.businessName) || "",
        taxId: (i == null ? void 0 : i.taxId) || "",
        address: n.address,
        city: n.city,
        themeMode: (i == null ? void 0 : i.themeMode) === "DARK" ? "DARK" : "LIGHT",
        invoicePrefix: (i == null ? void 0 : i.invoicePrefix) || "FV",
        defaultTaxRate: (i == null ? void 0 : i.defaultTaxRate) ?? 0.19,
        allowNegativeStock: (i == null ? void 0 : i.allowNegativeStock) ?? !1,
        defaultReceiptTemplate: (i == null ? void 0 : i.defaultReceiptTemplate) === "THERMAL_80" || (i == null ? void 0 : i.defaultReceiptTemplate) === "THERMAL_50" ? i.defaultReceiptTemplate : "NORMAL",
        receiptFooter: (i == null ? void 0 : i.receiptFooter) || ""
      }
    };
  }), e.handle("settings:update-theme", async (l, i) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.settingsTheme))
      return { success: !1, message: "Tu rol no puede cambiar el tema del sistema" };
    const s = Ds.safeParse(i);
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
  }), e.handle("settings:update-business", async (l, i) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.settingsBusiness))
      return { success: !1, message: "Tu rol no puede editar los datos del negocio" };
    const s = Os.safeParse(i);
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
    }), await V(a, n, "settings", "update_business", "BusinessSettings", "default", void 0, t), { success: !0 };
  }), e.handle("settings:update-billing", async (l, i) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.settingsBilling))
      return { success: !1, message: "Tu rol no puede editar factura e impresion" };
    const s = Ps.safeParse(i);
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
  }), e.handle("settings:update-inventory", async (l, i) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.settingsInventory))
      return { success: !1, message: "Tu rol no puede editar inventario y operacion" };
    const s = xs.safeParse(i);
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
    const [i, n, s, t] = await Promise.all([
      a.cashSession.findFirst({
        where: { status: ee.OPEN },
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
        where: { status: ee.CLOSED },
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
    ]), c = n ? (() => {
      var D;
      const f = Y(n.note), y = J(f, "closing"), N = Ve(
        y.correspondentBalances ?? []
      ), h = t.map((x) => ({
        platformId: x.id,
        platform: x.name,
        countedAmount: N.get(x.id) ?? 0
      })).filter((x) => x.countedAmount > 0), b = ce(y);
      return {
        sessionId: n.id,
        registerName: n.register.name,
        user: n.user.name ?? n.user.username,
        closedAt: ((D = n.closedAt) == null ? void 0 : D.toISOString()) ?? null,
        countedCashAmount: n.countedAmount ?? 0,
        countedTransferAmount: b,
        countedAvailableAmount: (n.countedAmount ?? 0) + b + h.reduce((x, v) => x + v.countedAmount, 0),
        closingBreakdown: y.cashBreakdown && typeof y.cashBreakdown == "object" ? y.cashBreakdown : {},
        correspondent: h
      };
    })() : null;
    if (!i)
      return {
        success: !0,
        activeSession: null,
        previousReference: c,
        recentSessions: s.map((f) => {
          var y;
          return {
            id: f.id,
            registerName: f.register.name,
            user: f.user.name ?? f.user.username,
            status: f.status,
            openedAt: f.openedAt.toISOString(),
            closedAt: ((y = f.closedAt) == null ? void 0 : y.toISOString()) ?? null,
            openingAmount: f.openingAmount,
            openingAvailableAmount: f.openingAmount + ce(J(Y(f.note), "opening")) + (J(Y(f.note), "opening").correspondentBalances ?? []).reduce((N, h) => N + Number(h.amount || 0), 0),
            countedAmount: f.countedAmount,
            countedAvailableAmount: (f.countedAmount ?? 0) + ce(J(Y(f.note), "closing")) + (J(Y(f.note), "closing").correspondentBalances ?? []).reduce((N, h) => N + Number(h.amount || 0), 0),
            differenceAmount: f.differenceAmount
          };
        })
      };
    const u = Nt({
      session: i,
      platforms: t
    }), p = i.openingAmount + u.openingTransferAmount + u.openingCorrespondentTotal, g = i.countedAmount ?? u.expectedCash, T = u.countedTransferAmount ?? u.expectedTransferAmount, I = c ? {
      cashDifferenceAmount: i.openingAmount - c.countedCashAmount,
      transferDifferenceAmount: u.openingTransferAmount - c.countedTransferAmount,
      correspondentDifferenceTotal: u.correspondentByPlatform.reduce((f, y) => {
        var h;
        const N = ((h = c.correspondent.find((b) => b.platformId === y.platformId)) == null ? void 0 : h.countedAmount) ?? 0;
        return f + (y.openingAmount - N);
      }, 0),
      differenceAmount: p - c.countedAvailableAmount
    } : null;
    return {
      success: !0,
      activeSession: {
        id: i.id,
        registerName: i.register.name,
        user: i.user.name ?? i.user.username,
        openedAt: i.openedAt.toISOString(),
        openingAmount: i.openingAmount,
        openingTransferAmount: u.openingTransferAmount,
        openingAvailableAmount: p,
        expectedCash: u.expectedCash,
        expectedTransferAmount: u.expectedTransferAmount,
        expectedAvailableAmount: u.expectedAvailableTotal,
        countedCashAmount: g,
        countedTransferAmount: T,
        countedAvailableAmount: g + T + u.correspondentByPlatform.reduce(
          (f, y) => f + (y.countedAmount ?? y.expectedAmount),
          0
        ),
        cashDifferenceAmount: g - u.expectedCash,
        transferDifferenceAmount: T - u.expectedTransferAmount,
        availableDifferenceAmount: g + T + u.correspondentByPlatform.reduce(
          (f, y) => f + (y.countedAmount ?? y.expectedAmount),
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
          ...i.sales.flatMap(
            (f) => (f.payments && f.payments.length > 0 ? f.payments : [
              {
                method: f.paymentMethod,
                amount: f.total
              }
            ]).map((y, N) => ({
              id: `${f.id}-${y.method}-${N}`,
              createdAt: f.createdAt.toISOString(),
              type: "Venta",
              medium: y.method === z.CASH ? "Efectivo" : (y.method === z.CARD, "Transferencia"),
              detail: `${f.invoiceNumber} - ${f.customer}`,
              amount: y.amount,
              signedAmount: y.amount
            }))
          ),
          ...i.correspondentTransactions.map((f) => ({
            id: f.id,
            createdAt: f.performedAt.toISOString(),
            type: "Corresponsal",
            medium: f.platform.name,
            detail: `${f.type.name}${f.commissionAmount > 0 ? ` + comision ${f.commissionAmount.toLocaleString("es-CO")}` : ""}`,
            amount: f.amount,
            signedAmount: f.type.direction === F.OUT ? -f.amount : f.amount
          })),
          ...i.movements.map((f) => ({
            id: f.id,
            createdAt: f.createdAt.toISOString(),
            type: f.type,
            medium: de(f.note) === "TRANSFER" ? "Transferencias" : de(f.note) === "CORRESPONDENT" ? ze(f.note) || "Corresponsal" : "Efectivo",
            detail: Xe(f.note),
            amount: f.amount,
            signedAmount: f.type === k.EXPENSE_OUT || f.type === k.WITHDRAWAL_OUT ? -f.amount : f.amount
          }))
        ].sort((f, y) => new Date(y.createdAt).getTime() - new Date(f.createdAt).getTime()).slice(0, 30)
      },
      previousReference: c,
      recentSessions: s.map((f) => {
        var y;
        return {
          id: f.id,
          registerName: f.register.name,
          user: f.user.name ?? f.user.username,
          status: f.status,
          openedAt: f.openedAt.toISOString(),
          closedAt: ((y = f.closedAt) == null ? void 0 : y.toISOString()) ?? null,
          openingAmount: f.openingAmount,
          openingAvailableAmount: f.openingAmount + ce(J(Y(f.note), "opening")) + (J(Y(f.note), "opening").correspondentBalances ?? []).reduce((N, h) => N + Number(h.amount || 0), 0),
          countedAmount: f.countedAmount,
          countedAvailableAmount: (f.countedAmount ?? 0) + ce(J(Y(f.note), "closing")) + (J(Y(f.note), "closing").correspondentBalances ?? []).reduce((N, h) => N + Number(h.amount || 0), 0),
          differenceAmount: f.differenceAmount
        };
      })
    };
  }), e.handle("cash:open", async (l, i) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.cashOpen))
      return { success: !1, message: "Tu rol no puede abrir caja" };
    const s = Ss.safeParse(i);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para apertura de caja" };
    if (await a.cashSession.findFirst({
      where: { status: ee.OPEN }
    }))
      return { success: !1, message: "Ya existe una caja abierta" };
    const c = await a.cashRegister.findFirst({
      where: { isActive: !0 },
      orderBy: { createdAt: "asc" }
    });
    if (!c)
      return { success: !1, message: "No hay caja activa configurada" };
    const u = s.data.openingCashAmount + s.data.openingTransferAmount + s.data.correspondentBalances.reduce((T, I) => T + Number(I.amount || 0), 0), p = yt({
      opening: {
        cashBreakdown: s.data.cashBreakdown,
        transferAmount: s.data.openingTransferAmount,
        correspondentBalances: s.data.correspondentBalances,
        note: s.data.note || null
      }
    }), g = await a.cashSession.create({
      data: {
        registerId: c.id,
        userId: n.id,
        status: ee.OPEN,
        openingAmount: s.data.openingCashAmount,
        expectedAmount: u,
        note: p
      }
    });
    return await a.cashMovement.create({
      data: {
        sessionId: g.id,
        type: k.OPENING,
        amount: s.data.openingCashAmount,
        note: s.data.note || "Apertura de caja"
      }
    }), { success: !0, sessionId: g.id };
  }), e.handle("cash:close", async (l, i) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.cashClose))
      return { success: !1, message: "Tu rol no puede cerrar caja" };
    const s = ws.safeParse(i);
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
    if (!t || t.status !== ee.OPEN)
      return { success: !1, message: "La caja seleccionada no está abierta" };
    const c = await a.correspondentPlatform.findMany({
      orderBy: { name: "asc" }
    }), u = Nt({
      session: t,
      platforms: c
    }), p = u.expectedCash, g = s.data.countedCashAmount - p, T = u.correspondentByPlatform.reduce((b, D) => {
      var v;
      const x = (v = s.data.correspondentBalances.find((m) => m.platformId === D.platformId)) == null ? void 0 : v.amount;
      return b + Number(x ?? D.expectedAmount);
    }, 0), I = p + u.expectedTransferAmount + u.correspondentExpectedTotal, y = s.data.countedCashAmount + s.data.countedTransferAmount + T - I, N = Y(t.note), h = yt({
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
          status: ee.CLOSED,
          countedAmount: s.data.countedCashAmount,
          expectedAmount: I,
          differenceAmount: y,
          note: h,
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
      var s, t, c;
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
        roleProfileName: ((c = n.roleProfile) == null ? void 0 : c.name) ?? null,
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
    const i = await a.product.findMany({
      include: {
        category: !0,
        subcategory: !0
      },
      orderBy: { name: "asc" }
    }), n = i.map((c) => c.id), s = await le(a, "Product", n, "create"), t = await le(a, "Product", n, "update", !0);
    return {
      success: !0,
      products: i.map((c) => {
        var u, p;
        return {
          id: c.id,
          name: c.name,
          sku: c.sku,
          barcode: c.barcode,
          unitMeasure: c.unitMeasure,
          price: c.price,
          pricingConfig: Ue(c.pricingConfigJson),
          cost: c.cost,
          marginPercent: c.marginPercent,
          hasTax: c.hasTax,
          taxRate: c.taxRate,
          stock: c.stock,
          categoryId: c.categoryId,
          subcategoryId: c.subcategoryId,
          categoryName: ((u = c.category) == null ? void 0 : u.name) ?? null,
          subcategoryName: ((p = c.subcategory) == null ? void 0 : p.name) ?? null,
          isActive: c.isActive,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
          createdBy: s.get(c.id) ?? null,
          updatedBy: t.get(c.id) ?? s.get(c.id) ?? null
        };
      })
    };
  }), e.handle("products:create", async (l, i) => {
    var I;
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.productsCreate))
      return { success: !1, message: "Tu rol no puede crear productos" };
    const s = is.safeParse(i);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para el producto" };
    const t = s.data, c = t.categoryId ? await a.productCategory.findUnique({ where: { id: t.categoryId } }) : null, u = ((I = t.sku) == null ? void 0 : I.trim()) || await Gs(a, t.name, c == null ? void 0 : c.name), p = Ee(t.pricingConfig), g = pt(p), T = g ? ft(t.price, p) : H(t.price);
    try {
      const f = await a.$transaction(async (y) => {
        const N = await y.product.create({
          data: {
            name: t.name,
            sku: u,
            barcode: t.barcode || null,
            unitMeasure: t.unitMeasure ?? "UNIDAD",
            price: T,
            pricingConfigJson: g,
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
            note: `Stock inicial registrado por ${$e(n)}`
          }
        }), N;
      });
      return await V(a, n, "products", "create", "Product", f.id, void 0, {
        name: f.name,
        sku: f.sku
      }), { success: !0, productId: f.id };
    } catch (f) {
      return { success: !1, message: f instanceof Error ? f.message : "No se pudo crear el producto" };
    }
  }), e.handle("products:update", async (l, i) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.productsEdit))
      return { success: !1, message: "Tu rol no puede editar productos" };
    const s = cs.safeParse(i);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para actualizar el producto" };
    const t = await a.product.findUnique({ where: { id: s.data.id } });
    if (!t)
      return { success: !1, message: "Producto no encontrado" };
    const c = s.data.pricingConfig === void 0 ? Ue(t.pricingConfigJson) : Ee(s.data.pricingConfig), u = c && c.enabled ? ft(s.data.price ?? t.price, c) : H(s.data.price === void 0 ? t.price : s.data.price);
    try {
      return await a.$transaction(async (p) => {
        if (await p.product.update({
          where: { id: s.data.id },
          data: {
            name: s.data.name ?? t.name,
            sku: s.data.sku ?? t.sku,
            barcode: s.data.barcode === void 0 ? t.barcode : s.data.barcode,
            unitMeasure: s.data.unitMeasure ?? t.unitMeasure,
            price: u,
            pricingConfigJson: s.data.pricingConfig === void 0 ? t.pricingConfigJson : pt(c),
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
          const g = s.data.stock - t.stock;
          await p.inventoryMovement.create({
            data: {
              productId: t.id,
              type: g > 0 ? Ne.ADJUSTMENT_IN : Ne.ADJUSTMENT_OUT,
              qty: Math.abs(g),
              stockBefore: t.stock,
              stockAfter: s.data.stock,
              referenceType: "PRODUCT_EDIT",
              referenceId: t.id,
              note: `Ajuste manual por ${$e(n)}`
            }
          });
        }
      }), await V(a, n, "products", "update", "Product", t.id, t, s.data), { success: !0 };
    } catch (p) {
      return { success: !1, message: p instanceof Error ? p.message : "No se pudo actualizar el producto" };
    }
  }), e.handle("products:delete", async (l, i) => {
    const n = await At(r);
    if (!M(n, E.productsDelete))
      return { success: !1, message: "Tu rol no puede archivar productos" };
    const s = Ie.safeParse(i);
    if (!s.success)
      return { success: !1, message: "Producto invalido" };
    const t = await a.product.findUnique({ where: { id: s.data.id } });
    return t ? (await a.product.update({
      where: { id: s.data.id },
      data: { isActive: !1 }
    }), await V(a, n, "products", "archive", "Product", t.id, t, {
      isActive: !1
    }), { success: !0 }) : { success: !1, message: "Producto no encontrado" };
  }), e.handle("products:category:create", async (l, i) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.productsEdit))
      return { success: !1, message: "Tu rol no puede administrar categorias" };
    const s = Ns.safeParse(i);
    if (!s.success)
      return { success: !1, message: "Categoria invalida" };
    try {
      return await a.productCategory.create({
        data: { name: s.data.name, isActive: !0 }
      }), { success: !0 };
    } catch {
      return { success: !1, message: "La categoria ya existe" };
    }
  }), e.handle("products:category:delete", async (l, i) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.productsEdit))
      return { success: !1, message: "Tu rol no puede administrar categorias" };
    const s = Ie.safeParse(i);
    return s.success ? (await a.productCategory.delete({
      where: { id: s.data.id }
    }), { success: !0 }) : { success: !1, message: "Categoria invalida" };
  }), e.handle("products:subcategory:create", async (l, i) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.productsEdit))
      return { success: !1, message: "Tu rol no puede administrar subcategorias" };
    const s = Cs.safeParse(i);
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
  }), e.handle("products:subcategory:delete", async (l, i) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.productsEdit))
      return { success: !1, message: "Tu rol no puede administrar subcategorias" };
    const s = Ie.safeParse(i);
    return s.success ? (await a.productSubcategory.delete({
      where: { id: s.data.id }
    }), { success: !0 }) : { success: !1, message: "Subcategoria invalida" };
  }), e.handle("customers:list", async () => {
    if (!r())
      return { success: !1, message: "Debes iniciar sesion", customers: [] };
    const i = await a.customer.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { sales: !0, credits: !0 }
        }
      }
    }), n = i.map((t) => t.id), s = await le(a, "Customer", n, "create");
    return {
      success: !0,
      customers: i.map((t) => ({
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
  }), e.handle("customers:sales-history", async (l, i) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion", sales: [] };
    if (!M(n, E.salesHistory))
      return { success: !1, message: "Tu rol no puede ver facturas del POS", sales: [] };
    const s = Ie.safeParse(i);
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
      })).map((c) => ({
        id: c.id,
        invoiceNumber: c.invoiceNumber,
        total: c.total,
        status: c.status,
        paymentMethod: c.paymentMethod,
        createdAt: c.createdAt.toISOString(),
        cashier: he(c.cashier),
        itemsCount: c.items.reduce((u, p) => u + p.qty, 0)
      }))
    } : { success: !1, message: "Cliente invalido", sales: [] };
  }), e.handle("customers:create", async (l, i) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.customersCreate))
      return { success: !1, message: "Tu rol no puede crear clientes" };
    const s = Vt.safeParse(i);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para el cliente" };
    try {
      const t = (await a.customer.findMany({
        select: { internalCode: !0 }
      })).map((p) => p.internalCode), c = ae({
        desiredCode: null,
        existingCodes: t,
        prefix: "CLI",
        digits: 4,
        maxLength: 30
      }), u = await a.customer.create({
        data: {
          internalCode: c,
          name: It(s.data.firstName, s.data.lastName),
          document: Re(s.data.documentType, s.data.documentNumber),
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
  }), e.handle("customers:update", async (l, i) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.customersEdit))
      return { success: !1, message: "Tu rol no puede editar clientes" };
    const s = hs.safeParse(i);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para actualizar el cliente" };
    const t = await a.customer.findUnique({ where: { id: s.data.id } });
    if (!t)
      return { success: !1, message: "Cliente no encontrado" };
    try {
      const c = (await a.customer.findMany({
        where: { NOT: { id: t.id } },
        select: { internalCode: !0 }
      })).map((g) => g.internalCode), p = {
        internalCode: ae({
          desiredCode: t.internalCode,
          existingCodes: c,
          prefix: "CLI",
          digits: 4,
          maxLength: 30
        }),
        name: It(s.data.firstName, s.data.lastName),
        document: Re(s.data.documentType, s.data.documentNumber),
        phone: s.data.phone || null,
        email: s.data.email || null,
        address: s.data.address || null,
        isActive: s.data.isActive ?? t.isActive
      };
      return await a.customer.update({
        where: { id: t.id },
        data: {
          ...p,
          creditLimit: 0,
          notes: null
        }
      }), await V(a, n, "customers", "update", "Customer", t.id, t, p), { success: !0 };
    } catch (c) {
      return { success: !1, message: c instanceof Error ? c.message : "No se pudo actualizar el cliente. Verifica documento o correo duplicado." };
    }
  }), e.handle("suppliers:list", async () => {
    if (!r())
      return { success: !1, message: "Debes iniciar sesion", suppliers: [] };
    const i = await a.supplier.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { purchases: !0 }
        }
      }
    }), n = i.map((t) => t.id), s = await le(a, "Supplier", n, "create");
    return {
      success: !0,
      suppliers: i.map((t) => ({
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
  }), e.handle("suppliers:create", async (l, i) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.suppliersCreate))
      return { success: !1, message: "Tu rol no puede crear proveedores" };
    const s = jt.safeParse(i);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para el proveedor" };
    try {
      const t = (await a.supplier.findMany({
        select: { internalCode: !0 }
      })).map((p) => p.internalCode), c = ae({
        desiredCode: null,
        existingCodes: t,
        prefix: "PRV",
        digits: 4,
        maxLength: 30
      }), u = await a.supplier.create({
        data: {
          internalCode: c,
          name: s.data.name,
          taxId: Re(s.data.documentType, s.data.documentNumber),
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
  }), e.handle("suppliers:update", async (l, i) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.suppliersEdit))
      return { success: !1, message: "Tu rol no puede editar proveedores" };
    const s = bs.safeParse(i);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para actualizar el proveedor" };
    const t = await a.supplier.findUnique({ where: { id: s.data.id } });
    if (!t)
      return { success: !1, message: "Proveedor no encontrado" };
    try {
      const c = (await a.supplier.findMany({
        where: { NOT: { id: t.id } },
        select: { internalCode: !0 }
      })).map((g) => g.internalCode), p = {
        internalCode: ae({
          desiredCode: t.internalCode,
          existingCodes: c,
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
        data: p
      }), await V(a, n, "suppliers", "update", "Supplier", t.id, t, p), { success: !0 };
    } catch (c) {
      return { success: !1, message: c instanceof Error ? c.message : "No se pudo actualizar el proveedor. Verifica documento o correo duplicado." };
    }
  }), e.handle("purchases:list", async () => {
    if (!r())
      return { success: !1, message: "Debes iniciar sesion", purchases: [] };
    const i = await a.purchase.findMany({
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
    }), n = i.map((t) => t.id), s = await le(a, "Purchase", n, "create");
    return {
      success: !0,
      purchases: i.map((t) => ({
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
        itemsCount: t.items.reduce((c, u) => c + u.qty, 0),
        createdBy: s.get(t.id) ?? null
      }))
    };
  }), e.handle("purchases:get-detail", async (l, i) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.purchasesDetails))
      return { success: !1, message: "Tu rol no puede ver el detalle de compras" };
    const s = Ie.safeParse(i);
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
    const c = await le(a, "Purchase", [t.id], "create");
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
        createdBy: c.get(t.id) ?? null,
        items: t.items.map((u) => ({
          id: u.id,
          productName: u.product.name,
          productSku: u.product.sku,
          qty: u.qty,
          cost: u.cost,
          taxRate: u.taxRate,
          subtotal: u.subtotal,
          total: u.subtotal + H(u.subtotal * u.taxRate)
        }))
      }
    };
  }), e.handle("purchases:create", async (l, i) => {
    const n = await At(r);
    if (!M(n, E.purchasesCreate))
      return { success: !1, message: "Tu rol no puede registrar compras" };
    const s = vs.safeParse(i);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para la compra" };
    const t = await a.supplier.findUnique({ where: { id: s.data.supplierId } });
    if (!t)
      return { success: !1, message: "Proveedor no encontrado" };
    const c = s.data.items.map((v) => v.productId), u = await a.product.findMany({
      where: {
        id: { in: c },
        isActive: !0
      }
    });
    if (u.length !== c.length)
      return { success: !1, message: "Uno o más productos no están disponibles" };
    const p = new Map(u.map((v) => [v.id, v])), g = s.data.items.map((v) => {
      const m = p.get(v.productId);
      if (!m)
        throw new Error("Producto no encontrado");
      const A = H(v.cost * v.qty), S = H(A * (v.taxRate ?? 0));
      return {
        product: m,
        qty: v.qty,
        cost: H(v.cost),
        taxRate: v.taxRate ?? 0,
        subtotal: A,
        tax: S,
        total: A + S
      };
    }), T = g.reduce((v, m) => v + m.subtotal, 0), I = g.reduce((v, m) => v + m.tax, 0), f = T + I, y = s.data.purchasedAt ? new Date(s.data.purchasedAt) : /* @__PURE__ */ new Date(), N = s.data.markAsPaid ? ct.PAID : ct.RECEIVED, h = s.data.markAsPaid ? 0 : f, b = je(s.data.paymentMedium), D = b === "CORRESPONDENT" && s.data.paymentPlatformId ? await a.correspondentPlatform.findUnique({
      where: { id: s.data.paymentPlatformId },
      select: { id: !0, name: !0 }
    }) : null;
    if (b === "CORRESPONDENT" && !D)
      return { success: !1, message: "Selecciona un corresponsal valido para pagar la compra" };
    const x = s.data.markAsPaid ? await a.cashSession.findFirst({
      where: { status: ee.OPEN },
      orderBy: { openedAt: "desc" }
    }) : null;
    if (s.data.markAsPaid && !x)
      return { success: !1, message: "Abre el control diario antes de registrar compras pagadas" };
    try {
      const v = await a.$transaction(async (m) => {
        const A = await Ks(m), S = await m.purchase.create({
          data: {
            supplierId: s.data.supplierId,
            number: A,
            status: N,
            subtotal: T,
            tax: I,
            total: f,
            balance: h,
            note: s.data.note || null,
            purchasedAt: y,
            items: {
              create: g.map((L) => ({
                productId: L.product.id,
                qty: L.qty,
                cost: L.cost,
                taxRate: L.taxRate,
                subtotal: L.subtotal
              }))
            }
          }
        });
        for (const L of g) {
          const C = L.product.stock + L.qty, O = C <= 0 ? L.cost : H((L.product.stock * L.product.cost + L.subtotal) / C), _ = _s(
            O,
            L.product.marginPercent,
            L.product.hasTax,
            L.product.taxRate
          );
          await m.product.update({
            where: { id: L.product.id },
            data: {
              stock: C,
              cost: O,
              price: _
            }
          }), await m.inventoryMovement.create({
            data: {
              productId: L.product.id,
              type: Ne.PURCHASE_IN,
              qty: L.qty,
              stockBefore: L.product.stock,
              stockAfter: C,
              referenceType: "PURCHASE",
              referenceId: S.id,
              note: `${S.number} - ${t.name} - registrado por ${$e(n)}`
            }
          });
        }
        return s.data.markAsPaid && x && await m.cashMovement.create({
          data: {
            sessionId: x.id,
            type: k.EXPENSE_OUT,
            amount: f,
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
      return await V(a, n, "purchases", "create", "Purchase", v.id, void 0, {
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
  } : { success: !1, message: "Debes iniciar sesion", moves: [] }), e.handle("sales:list", async (l, i) => {
    var p;
    if (!r())
      return { success: !1, message: "Debes iniciar sesion", sales: [] };
    const s = Ls.safeParse(i);
    if (!s.success)
      return { success: !1, message: "Filtros invalidos", sales: [] };
    const t = s.data, c = (p = t.search) == null ? void 0 : p.trim();
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
          OR: c ? [
            { invoiceNumber: { contains: c } },
            { customer: { contains: c } }
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
        cashier: he(g.cashier),
        itemsCount: g.items.reduce((T, I) => T + I.qty, 0)
      }))
    };
  }), e.handle("sales:get-detail", async (l, i) => {
    if (!r())
      return { success: !1, message: "Debes iniciar sesion" };
    const s = gt.safeParse(i);
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
        cashier: he(t.cashier),
        items: t.items.map((c) => ({
          id: c.id,
          name: c.name,
          qty: c.qty,
          price: c.price,
          taxRate: c.taxRate,
          lineSubtotal: c.lineSubtotal,
          lineTax: c.lineTax,
          lineTotal: c.lineTotal
        })),
        payments: t.payments.map((c) => ({
          id: c.id,
          method: c.method,
          amount: c.amount,
          reference: c.reference
        }))
      }
    } : { success: !1, message: "Venta no encontrada" };
  }), e.handle("sales:print-invoice", async (l, i) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.salesPrint))
      return { success: !1, message: "Tu rol no puede imprimir facturas" };
    const s = gt.safeParse(i);
    if (!s.success)
      return { success: !1, message: "Venta invalida" };
    const [t, c] = await Promise.all([
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
    const u = Tt(c == null ? void 0 : c.address), p = Fs({
      businessName: c == null ? void 0 : c.businessName,
      taxId: c == null ? void 0 : c.taxId,
      address: u.address,
      city: u.city,
      receiptFooter: c == null ? void 0 : c.receiptFooter,
      invoiceNumber: t.invoiceNumber,
      customer: t.customer,
      paymentSummary: Ms(t.payments, t.paymentMethod),
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
    }, s.data.template), g = new Ke({
      show: !1,
      webPreferences: {
        sandbox: !1
      }
    });
    return await g.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(p)}`), await new Promise((T) => {
      g.webContents.print(
        {
          silent: !1,
          printBackground: !0
        },
        (I, f) => {
          if (g.close(), !I) {
            T({ success: !1, message: f || "No se pudo imprimir" });
            return;
          }
          T({ success: !0 });
        }
      );
    });
  }), e.handle("accounting:summary", async (l, i) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.reportsView))
      return { success: !1, message: "Tu rol no puede consultar contabilidad" };
    const s = Za.safeParse(i);
    if (!s.success)
      return { success: !1, message: "Filtros invalidos" };
    const t = $s(s.data.dateFrom, s.data.dateTo), [c, u, p, g, T, I] = await Promise.all([
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
    ]), f = p.map((m) => {
      var S;
      const A = ye(m.balance, m.total, m.dueDate);
      return {
        id: m.id,
        saleId: m.saleId,
        invoiceNumber: m.sale.invoiceNumber,
        customerId: m.customerId,
        customerName: m.customer.name,
        total: m.total,
        balance: m.balance,
        paidAmount: m.payments.reduce((L, C) => L + C.amount, 0),
        status: A,
        dueDate: ((S = m.dueDate) == null ? void 0 : S.toISOString()) ?? null,
        createdAt: m.createdAt.toISOString()
      };
    }), y = u.map((m) => {
      var K, B;
      const A = m.returns.reduce(($, U) => $ + U.total, 0), S = m.credits[0] ?? null, L = m.payments.reduce(($, U) => $ + U.amount, 0), C = Math.max(m.total - A, 0), O = S ? S.balance : Math.max(C - L, 0), _ = A >= m.total ? "RETURNED" : O <= 0 ? "PAID" : L > 0 ? "PARTIAL" : "PENDING", j = m.payments.length ? m.payments.map(($) => `${pe($.method)} $${$.amount.toLocaleString("es-CO")}`).join(" + ") : S ? "Pendiente por cartera" : pe(m.paymentMethod);
      return {
        id: m.id,
        invoiceNumber: m.invoiceNumber,
        customer: m.customer,
        customerId: ((K = m.customerRef) == null ? void 0 : K.id) ?? null,
        total: m.total,
        paidAtSale: L,
        pendingAmount: O,
        returnedTotal: A,
        grossProfit: m.profit,
        paymentSummary: j,
        collectionStatus: _,
        status: m.status,
        createdAt: m.createdAt.toISOString(),
        availableCreditTotal: Math.max(m.total - A, 0),
        availableCreditNoteTotal: Math.max(m.total - A, 0),
        credit: S ? {
          id: S.id,
          total: S.total,
          balance: S.balance,
          status: ye(S.balance, S.total, S.dueDate),
          dueDate: ((B = S.dueDate) == null ? void 0 : B.toISOString()) ?? null
        } : null
      };
    }), N = /* @__PURE__ */ new Map();
    for (const m of [z.CASH, z.CARD, z.TRANSFER])
      N.set(m, { salesAmount: 0, collectionsAmount: 0 });
    for (const m of u) {
      if (m.payments.length === 0) {
        const A = N.get(m.paymentMethod) ?? { salesAmount: 0, collectionsAmount: 0 };
        A.salesAmount += m.total, N.set(m.paymentMethod, A);
        continue;
      }
      for (const A of m.payments) {
        const S = N.get(A.method) ?? { salesAmount: 0, collectionsAmount: 0 };
        S.salesAmount += A.amount, N.set(A.method, S);
      }
    }
    for (const m of g) {
      const A = N.get(m.method) ?? { salesAmount: 0, collectionsAmount: 0 };
      A.collectionsAmount += m.amount, N.set(m.method, A);
    }
    const h = y.reduce((m, A) => m + A.paidAtSale, 0), b = g.reduce((m, A) => m + A.amount, 0), D = y.reduce((m, A) => m + A.pendingAmount, 0), x = y.reduce((m, A) => m + A.grossProfit, 0), v = [
      ...y.map((m) => ({
        id: `sale-${m.id}`,
        createdAt: m.createdAt,
        category: "SALE",
        title: `Venta ${m.invoiceNumber}`,
        detail: `${m.customer} | cobrado al momento $${m.paidAtSale.toLocaleString("es-CO")} | pendiente $${m.pendingAmount.toLocaleString("es-CO")}`,
        medium: m.paymentSummary,
        amount: m.total,
        direction: "IN",
        reference: m.invoiceNumber,
        operationalImpact: m.paidAtSale
      })),
      ...g.map((m) => {
        var A, S;
        return {
          id: `collection-${m.id}`,
          createdAt: m.createdAt.toISOString(),
          category: "COLLECTION",
          title: `Abono cartera ${((A = m.credit) == null ? void 0 : A.sale.invoiceNumber) ?? ""}`.trim(),
          detail: `${m.customer.name} | ${m.note || "Sin detalle"}`,
          medium: pe(m.method),
          amount: m.amount,
          direction: "IN",
          reference: ((S = m.credit) == null ? void 0 : S.sale.invoiceNumber) ?? null,
          operationalImpact: m.amount
        };
      }),
      ...T.map((m) => ({
        id: `credit-note-${m.id}`,
        createdAt: m.createdAt.toISOString(),
        category: "CREDIT_NOTE",
        title: `Nota credito ${m.sale.invoiceNumber}`,
        detail: `${m.sale.customer} | ${m.reason || "Ajuste sobre venta"}`,
        medium: "Ajuste comercial",
        amount: m.total,
        direction: "OUT",
        reference: m.sale.invoiceNumber,
        operationalImpact: -m.total
      })),
      ...I.map((m) => {
        var A, S, L;
        return {
          id: `expense-${m.id}`,
          createdAt: m.createdAt.toISOString(),
          category: "EXPENSE",
          title: m.type === k.WITHDRAWAL_OUT ? "Retiro operativo" : "Gasto operativo",
          detail: Xe(m.note),
          medium: ((A = ne(m.note)) == null ? void 0 : A.medium) === "CORRESPONDENT" ? ((S = ne(m.note)) == null ? void 0 : S.platformName) || "Corresponsal" : ((L = ne(m.note)) == null ? void 0 : L.medium) === "TRANSFER" ? "Transferencias" : "Efectivo",
          amount: m.amount,
          direction: "OUT",
          reference: null,
          operationalImpact: -m.amount
        };
      })
    ].sort((m, A) => new Date(A.createdAt).getTime() - new Date(m.createdAt).getTime()).slice(0, 250);
    return {
      success: !0,
      summary: {
        salesCount: y.length,
        salesTotal: y.reduce((m, A) => m + A.total, 0),
        collectedSalesTotal: h,
        pendingSalesBalance: D,
        pendingCreditsCount: f.filter((m) => m.balance > 0).length,
        pendingCreditsBalance: f.reduce((m, A) => m + A.balance, 0),
        paymentsTotal: b,
        collectionsTotal: b,
        operationalIncomeTotal: h + b,
        creditNotesTotal: T.reduce((m, A) => m + A.total, 0),
        expensesTotal: I.reduce((m, A) => m + A.amount, 0),
        grossProfitTotal: x,
        averageTicket: y.length > 0 ? H(y.reduce((m, A) => m + A.total, 0) / y.length) : 0,
        netOperationalBalance: h + b - T.reduce((m, A) => m + A.total, 0) - I.reduce((m, A) => m + A.amount, 0)
      },
      customers: c.map((m) => ({
        id: m.id,
        internalCode: m.internalCode,
        name: m.name,
        document: m.document,
        phone: m.phone
      })),
      paymentSummary: [...N.entries()].map(([m, A]) => ({
        method: m,
        label: pe(m),
        salesAmount: A.salesAmount,
        collectionsAmount: A.collectionsAmount,
        totalAmount: A.salesAmount + A.collectionsAmount
      })),
      movementHistory: v,
      sales: y,
      credits: f,
      payments: g.map((m) => {
        var A, S;
        return {
          id: m.id,
          creditId: m.creditId,
          saleId: ((A = m.credit) == null ? void 0 : A.sale.id) ?? null,
          invoiceNumber: ((S = m.credit) == null ? void 0 : S.sale.invoiceNumber) ?? null,
          customerName: m.customer.name,
          method: m.method,
          amount: m.amount,
          note: m.note,
          createdAt: m.createdAt.toISOString()
        };
      }),
      creditNotes: T.map((m) => ({
        id: m.id,
        saleId: m.saleId,
        invoiceNumber: m.sale.invoiceNumber,
        customerName: m.sale.customer,
        total: m.total,
        reason: m.reason,
        createdAt: m.createdAt.toISOString()
      })),
      expenses: I.map((m) => {
        const A = ne(m.note);
        return {
          id: m.id,
          sessionId: m.sessionId,
          registerName: m.session.register.name,
          userName: m.session.user.name ?? m.session.user.username,
          type: m.type,
          amount: m.amount,
          note: Xe(m.note),
          sourceMedium: (A == null ? void 0 : A.medium) ?? "CASH",
          sourcePlatform: (A == null ? void 0 : A.platformName) ?? null,
          createdAt: m.createdAt.toISOString()
        };
      })
    };
  }), e.handle("accounting:credit:create", async (l, i) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.reportsView))
      return { success: !1, message: "Tu rol no puede registrar cartera" };
    const s = es.safeParse(i);
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
    const c = await a.customer.findUnique({
      where: { id: s.data.customerId },
      select: { id: !0, name: !0, isActive: !0 }
    });
    if (!c || !c.isActive)
      return { success: !1, message: "Selecciona un cliente activo para crear la cuenta por cobrar" };
    const u = t.returns.reduce((T, I) => T + I.total, 0), p = Math.max(t.total - u, 0), g = s.data.total ?? p;
    if (p <= 0)
      return { success: !1, message: "La venta no tiene saldo disponible para cartera" };
    if (g > p)
      return { success: !1, message: "El valor supera el saldo disponible de la venta" };
    try {
      const T = await a.$transaction(async (I) => {
        const f = await I.customerCredit.create({
          data: {
            customerId: c.id,
            saleId: t.id,
            total: g,
            balance: g,
            dueDate: s.data.dueDate ? new Date(s.data.dueDate) : null,
            status: ye(g, g, s.data.dueDate ? new Date(s.data.dueDate) : null)
          }
        });
        return await I.sale.update({
          where: { id: t.id },
          data: {
            customerId: c.id,
            customer: c.name,
            status: fe.CREDIT
          }
        }), f;
      });
      return await V(a, n, "accounting", "create", "CustomerCredit", T.id, void 0, {
        saleId: t.id,
        customerId: c.id,
        total: g
      }), { success: !0, creditId: T.id, message: "Cuenta por cobrar creada correctamente." };
    } catch (T) {
      return { success: !1, message: T instanceof Error ? T.message : "No se pudo crear la cuenta por cobrar" };
    }
  }), e.handle("accounting:payment:create", async (l, i) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.reportsView))
      return { success: !1, message: "Tu rol no puede registrar pagos" };
    const s = ts.safeParse(i);
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
    const c = await a.cashSession.findFirst({
      where: { status: ee.OPEN },
      orderBy: { openedAt: "desc" }
    });
    if (!c)
      return { success: !1, message: "Abre el control diario antes de registrar abonos" };
    try {
      const u = await a.$transaction(async (p) => {
        const g = await p.customerPayment.create({
          data: {
            customerId: t.customerId,
            creditId: t.id,
            method: s.data.method,
            amount: s.data.amount,
            note: s.data.note || null
          }
        }), T = t.total - t.balance + s.data.amount, I = Math.max(t.total - T, 0), f = ye(I, t.total, t.dueDate);
        if (await p.customerCredit.update({
          where: { id: t.id },
          data: {
            balance: I,
            status: f
          }
        }), await p.cashMovement.create({
          data: {
            sessionId: c.id,
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
          const y = t.sale.returns.reduce((N, h) => N + h.total, 0);
          await p.sale.update({
            where: { id: t.saleId },
            data: {
              status: Ct(t.sale.total, y)
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
  }), e.handle("accounting:credit-note:create", async (l, i) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.reportsView))
      return { success: !1, message: "Tu rol no puede registrar notas credito" };
    const s = as.safeParse(i);
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
    const c = t.returns.reduce((p, g) => p + g.total, 0), u = Math.max(t.total - c, 0);
    if (u <= 0)
      return { success: !1, message: "La venta no tiene saldo disponible para nota credito" };
    if (s.data.amount > u)
      return { success: !1, message: "La nota credito supera el saldo disponible de la venta" };
    try {
      const p = await a.$transaction(async (g) => {
        const T = await g.saleReturn.create({
          data: {
            saleId: t.id,
            total: s.data.amount,
            reason: s.data.reason || null
          }
        }), I = c + s.data.amount;
        await g.sale.update({
          where: { id: t.id },
          data: {
            status: Ct(t.total, I)
          }
        });
        const f = t.credits[0];
        if (f) {
          const y = Math.max(f.total - f.balance, 0), N = Math.max(f.total - s.data.amount, 0), h = Math.max(N - y, 0);
          await g.customerCredit.update({
            where: { id: f.id },
            data: {
              total: N,
              balance: h,
              status: ye(h, N, f.dueDate)
            }
          });
        }
        return T;
      });
      return await V(a, n, "accounting", "create", "SaleReturn", p.id, void 0, {
        saleId: t.id,
        total: s.data.amount
      }), { success: !0, creditNoteId: p.id, message: "Nota credito registrada correctamente." };
    } catch (p) {
      return { success: !1, message: p instanceof Error ? p.message : "No se pudo registrar la nota credito" };
    }
  }), e.handle("accounting:expense:create", async (l, i) => {
    const n = r();
    if (!n)
      return { success: !1, message: "Debes iniciar sesion" };
    if (!M(n, E.reportsView))
      return { success: !1, message: "Tu rol no puede registrar gastos" };
    const s = ss.safeParse(i);
    if (!s.success)
      return { success: !1, message: "Datos invalidos para el gasto" };
    const t = await a.cashSession.findFirst({
      where: { status: ee.OPEN },
      orderBy: { openedAt: "desc" }
    });
    if (!t)
      return { success: !1, message: "Abre caja general antes de registrar gastos o retiros" };
    const c = je(s.data.sourceMedium), u = c === "CORRESPONDENT" && s.data.sourcePlatformId ? await a.correspondentPlatform.findUnique({
      where: { id: s.data.sourcePlatformId },
      select: { id: !0, name: !0 }
    }) : null;
    if (c === "CORRESPONDENT" && !u)
      return { success: !1, message: "Selecciona un corresponsal valido para registrar el egreso" };
    try {
      const p = await a.cashMovement.create({
        data: {
          sessionId: t.id,
          type: s.data.type,
          amount: s.data.amount,
          note: Oe({
            label: s.data.note,
            medium: c,
            platformId: (u == null ? void 0 : u.id) ?? null,
            platformName: (u == null ? void 0 : u.name) ?? null,
            sourceType: "EXPENSE",
            userNote: s.data.note
          })
        }
      });
      return await V(a, n, "accounting", "create", "CashMovement", p.id, void 0, {
        type: s.data.type,
        amount: s.data.amount,
        note: s.data.note,
        sourceMedium: c,
        sourcePlatform: (u == null ? void 0 : u.name) ?? null
      }), { success: !0, expenseId: p.id, message: "Gasto registrado correctamente." };
    } catch (p) {
      return { success: !1, message: p instanceof Error ? p.message : "No se pudo registrar el gasto" };
    }
  });
}
const Yt = G.dirname(ca(import.meta.url));
process.env.APP_ROOT = G.join(Yt, "..");
const Ge = process.env.VITE_DEV_SERVER_URL, vr = G.join(process.env.APP_ROOT, "dist-electron"), Jt = G.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = Ge ? G.join(process.env.APP_ROOT, "public") : Jt;
let me = null, R, ht = /* @__PURE__ */ new Date(), P = null;
function Qt() {
  me = new Ke({
    icon: G.join(process.env.VITE_PUBLIC, "mascot.png"),
    webPreferences: {
      preload: G.join(Yt, "preload.mjs"),
      contextIsolation: !0,
      nodeIntegration: !1
    },
    show: !1
  }), aa.setApplicationMenu(null), me.maximize(), me.show(), Ge ? me.loadURL(Ge) : me.loadFile(G.join(Jt, "index.html"));
}
function Ys() {
  var n;
  const e = (n = process.env.SEED_ADMIN_ENABLED) == null ? void 0 : n.toLowerCase(), a = e === void 0 ? !0 : e === "true", r = process.env.SEED_ADMIN_USERNAME ?? "admin", d = process.env.SEED_ADMIN_NAME ?? "Administrador", l = process.env.SEED_ADMIN_PASSWORD ?? "admin123", i = Number(process.env.BCRYPT_ROUNDS ?? "10");
  if (a && l.trim().length < 8)
    throw new Error("SEED_ADMIN_PASSWORD es obligatorio y debe tener minimo 8 caracteres.");
  if (!Number.isFinite(i) || i < 8 || i > 15)
    throw new Error("BCRYPT_ROUNDS invalido. Usa un valor entre 8 y 15.");
  return { enabled: a, username: r, name: d, password: l, bcryptRounds: i };
}
async function Js(e) {
  const a = Ys();
  if (!a.enabled || await e.user.count() > 0)
    return;
  const d = await ue.hash(a.password, a.bcryptRounds);
  await e.user.create({
    data: {
      username: a.username,
      name: a.name,
      role: X.ADMIN,
      passwordHash: d,
      isActive: !0
    }
  });
}
async function Qs(e) {
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
        appVersion: re.getVersion(),
        osPlatform: Me.platform(),
        osRelease: Me.release(),
        deviceName: Me.hostname()
      }
    });
  } catch (a) {
    console.error("Error registrando login:", a);
  }
}
function Ce(e) {
  return Math.round(e);
}
function Ws(e) {
  const a = /* @__PURE__ */ new Date();
  if (e === "day")
    return new Date(a.getFullYear(), a.getMonth(), a.getDate());
  if (e === "week") {
    const r = new Date(a), d = r.getDay(), l = d === 0 ? 6 : d - 1;
    return r.setDate(r.getDate() - l), r.setHours(0, 0, 0, 0), r;
  }
  return new Date(a.getFullYear(), a.getMonth(), 1);
}
function Zs(e, a) {
  return `${e}-${String(a).padStart(6, "0")}`;
}
function Z(e) {
  const a = e == null ? void 0 : e.trim();
  return a || null;
}
function et(e, a) {
  return [e.trim(), a.trim()].filter(Boolean).join(" ");
}
function bt(e) {
  return e.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}
function er(e, a, r) {
  const d = bt(e).slice(0, 3).padEnd(3, "x"), l = bt(a).slice(0, 3).padEnd(3, "x"), n = r.replace(/\D/g, "").slice(-3).padStart(3, "0");
  return `${d}${l}${n}`;
}
async function Wt(e) {
  const a = er(e.firstName, e.lastName, e.documentNumber);
  let r = 0, d = a, l = !0;
  for (; l; ) {
    const i = r === 0 ? "" : String(r + 1).padStart(2, "0");
    d = `${a}${i}`, l = !!await e.prismaClient.user.findFirst({
      where: {
        username: d,
        ...e.excludeUserId ? { NOT: { id: e.excludeUserId } } : {}
      },
      select: { id: !0 }
    }), r += 1;
  }
  return d;
}
function tt(e) {
  if (!e)
    return null;
  const [a, r, d] = e.split("-").map(Number);
  return !a || !r || !d ? null : new Date(Date.UTC(a, r - 1, d));
}
function vt(e) {
  return e === "ADMIN" ? X.ADMIN : X.EMPLOYEE;
}
function ge(e) {
  return `SYSTEM_${e}`;
}
function W(e) {
  return e ? Xt(P == null ? void 0 : P.permissions, e) : !0;
}
async function tr(e, a) {
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
  return be(r.map((d) => d.permissionKey));
}
async function ar(e, a) {
  var l, i, n, s;
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
  const d = be(
    ((l = r.roleProfile) == null ? void 0 : l.permissions.map((t) => t.permissionKey)) ?? ((i = await e.roleProfile.findUnique({
      where: { key: ge(r.role) },
      include: {
        permissions: {
          where: { allowed: !0 },
          orderBy: { permissionKey: "asc" }
        }
      }
    })) == null ? void 0 : i.permissions.map((t) => t.permissionKey)) ?? []
  );
  return {
    roleProfileId: ((n = r.roleProfile) == null ? void 0 : n.id) ?? null,
    roleProfileName: ((s = r.roleProfile) == null ? void 0 : s.name) ?? null,
    permissions: d
  };
}
function Zt(e) {
  return e.replace(/'/g, "''");
}
async function St(e, a) {
  return (await e.$queryRawUnsafe(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name = '${Zt(a)}'
    LIMIT 1;
  `)).length > 0;
}
function sr(e) {
  const a = [], r = e.replace(/^\s*--.*$/gm, "");
  let d = "", l = !1, i = !1;
  for (let s = 0; s < r.length; s += 1) {
    const t = r[s], c = r[s - 1];
    if (t === "'" && !i && c !== "\\" ? l = !l : t === '"' && !l && c !== "\\" && (i = !i), t === ";" && !l && !i) {
      const u = d.trim();
      u && a.push(u), d = "";
      continue;
    }
    d += t;
  }
  const n = d.trim();
  return n && a.push(n), a;
}
function rr() {
  return G.join(process.env.APP_ROOT, "prisma", "migrations");
}
function nr(e) {
  if (e instanceof Error)
    return e.message;
  if (typeof e == "object" && e !== null && "meta" in e) {
    const a = e.meta;
    if (typeof (a == null ? void 0 : a.message) == "string")
      return a.message;
  }
  return String(e);
}
function or(e, a) {
  const r = e.trim();
  if (!(r === 'ALTER TABLE "CorrespondentTransaction" ADD COLUMN "approvalCode" TEXT') && !(r === 'CREATE UNIQUE INDEX "CorrespondentTransaction_approvalCode_key" ON "CorrespondentTransaction"("approvalCode")'))
    return !1;
  const i = nr(a);
  return i.includes("duplicate column name: approvalCode") || i.includes("index CorrespondentTransaction_approvalCode_key already exists") || i.includes('index "CorrespondentTransaction_approvalCode_key" already exists');
}
async function ir(e) {
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
async function cr(e) {
  if (await St(e, "User"))
    return;
  const r = rr(), l = (await oa(r, { withFileTypes: !0 })).filter((s) => s.isDirectory()).map((s) => s.name).sort((s, t) => s.localeCompare(t));
  if (l.length === 0)
    throw new Error(`No se encontraron migraciones Prisma en ${r}.`);
  await ir(e);
  const i = await e.$queryRawUnsafe(`
    SELECT "migration_name"
    FROM "_prisma_migrations";
  `), n = new Set(
    i.map((s) => s.migration_name)
  );
  for (const s of l) {
    if (n.has(s))
      continue;
    const t = G.join(r, s, "migration.sql"), c = await ia(t, "utf8");
    c.includes('"Correspondent') && !await St(e, "CorrespondentTransaction") && await xt(e);
    const u = sr(c);
    for (const g of u)
      try {
        await e.$executeRawUnsafe(g);
      } catch (T) {
        if (or(g, T))
          continue;
        throw T;
      }
    const p = wt("sha256").update(c).digest("hex");
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
        '${sa()}',
        '${p}',
        CURRENT_TIMESTAMP,
        '${Zt(s)}',
        '',
        NULL,
        CURRENT_TIMESTAMP,
        ${u.length}
      );
    `);
  }
}
async function dr(e) {
  const a = await e.$queryRawUnsafe('PRAGMA table_info("User");'), r = new Set(a.map((n) => n.name)), d = [];
  r.has("firstName") || d.push('ALTER TABLE "User" ADD COLUMN "firstName" TEXT;'), r.has("lastName") || d.push('ALTER TABLE "User" ADD COLUMN "lastName" TEXT;'), r.has("documentNumber") || d.push('ALTER TABLE "User" ADD COLUMN "documentNumber" TEXT;'), r.has("email") || d.push('ALTER TABLE "User" ADD COLUMN "email" TEXT;'), r.has("phone") || d.push('ALTER TABLE "User" ADD COLUMN "phone" TEXT;'), r.has("address") || d.push('ALTER TABLE "User" ADD COLUMN "address" TEXT;'), r.has("birthDate") || d.push('ALTER TABLE "User" ADD COLUMN "birthDate" DATETIME;'), r.has("internalCode") || d.push('ALTER TABLE "User" ADD COLUMN "internalCode" TEXT;');
  for (const n of d)
    await e.$executeRawUnsafe(n);
  await e.$executeRawUnsafe(`
    UPDATE "User"
    SET "firstName" = "name"
    WHERE "name" IS NOT NULL
      AND ("firstName" IS NULL OR TRIM("firstName") = '');
  `), await e.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "User_documentNumber_key" ON "User"("documentNumber");'
  );
  const l = await e.user.findMany({
    select: {
      id: !0,
      internalCode: !0
    },
    orderBy: [{ createdAt: "asc" }, { username: "asc" }]
  }), i = [];
  for (const n of l) {
    const s = ae({
      desiredCode: n.internalCode,
      existingCodes: i,
      prefix: "USR",
      digits: 4,
      maxLength: 30
    });
    s !== n.internalCode && await e.user.update({
      where: { id: n.id },
      data: { internalCode: s }
    }), i.push(s);
  }
  await e.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "User_internalCode_key" ON "User"("internalCode");'
  );
}
async function ur(e) {
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
async function lr(e) {
  const a = await e.$queryRawUnsafe('PRAGMA table_info("Product");');
  new Set(a.map((d) => d.name)).has("unitMeasure") || await e.$executeRawUnsafe(
    `ALTER TABLE "Product" ADD COLUMN "unitMeasure" TEXT NOT NULL DEFAULT 'UNIDAD';`
  ), await e.$executeRawUnsafe(`
    UPDATE "Product"
    SET "unitMeasure" = 'UNIDAD'
    WHERE "unitMeasure" IS NULL OR TRIM("unitMeasure") = '';
  `);
}
async function mr(e) {
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
  new Set(a.map((d) => d.name)).has("roleProfileId") || await e.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "roleProfileId" TEXT;'), await e.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "User_roleProfileId_idx"
    ON "User"("roleProfileId");
  `);
}
async function pr(e) {
  for (const r of Le) {
    const d = Bt(r), l = await e.roleProfile.findUnique({
      where: { key: ge(r.key) },
      select: { id: !0 }
    }), i = l ? await e.roleProfile.update({
      where: { id: l.id },
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
    }), n = await e.rolePermission.findMany({
      where: {
        roleProfileId: i.id,
        allowed: !0
      },
      select: {
        permissionKey: !0
      }
    }), s = new Set(n.map((c) => c.permissionKey)), t = d.filter(
      (c) => !s.has(c.key)
    );
    t.length > 0 && await e.rolePermission.createMany({
      data: t.map((c) => ({
        roleProfileId: i.id,
        permissionKey: c.key,
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
async function fr() {
  await xt(R), await Qs(R), await Ka(R), Qa({
    app: re,
    ipcMain: q,
    prisma: R,
    getCurrentSessionUser: () => P
  });
}
re.whenReady().then(async () => {
  const e = G.join(re.getPath("userData"), "app.db").replace(/\\/g, "/");
  process.env.DATABASE_URL = `file:${e}`, R = new ua(), ht = /* @__PURE__ */ new Date(), await cr(R), await dr(R), await ur(R), await mr(R), await js(R), await Js(R), await pr(R), await lr(R), Hs({
    ipcMain: q,
    prisma: R,
    getCurrentSessionUser: () => P,
    getConnectedAt: () => ht
  }), await fr(), Qt();
}).catch((e) => {
  console.error("No se pudo inicializar la aplicacion POS.", e), re.quit();
});
re.on("activate", () => {
  Ke.getAllWindows().length === 0 && Qt();
});
q.handle("auth:login", async (e, a) => {
  const r = la.safeParse(a);
  if (!r.success)
    return await De({
      username: String((a == null ? void 0 : a.username) ?? ""),
      success: !1,
      reason: "invalid_payload"
    }), { success: !1, message: "Datos invalidos" };
  const { username: d, password: l } = r.data, i = await R.user.findUnique({
    where: { username: d }
  });
  if (!i || !i.isActive)
    return await De({
      username: d,
      success: !1,
      reason: "user_not_found_or_inactive"
    }), { success: !1, message: "Usuario o contrasena incorrectos" };
  if (!await ue.compare(l, i.passwordHash))
    return await De({
      userId: i.id,
      username: d,
      success: !1,
      reason: "wrong_password"
    }), { success: !1, message: "Usuario o contrasena incorrectos" };
  await De({
    userId: i.id,
    username: d,
    success: !0
  });
  const s = await ar(R, i.id);
  return P = {
    id: i.id,
    username: i.username,
    name: i.name ?? void 0,
    role: i.role,
    roleProfileId: (s == null ? void 0 : s.roleProfileId) ?? null,
    roleProfileName: (s == null ? void 0 : s.roleProfileName) ?? null,
    permissions: (s == null ? void 0 : s.permissions) ?? []
  }, {
    success: !0,
    user: P
  };
});
q.handle("auth:createUser", async (e, a) => {
  const r = ma.safeParse(a);
  if (!r.success)
    return { success: !1, message: "Datos invalidos" };
  if (!P || P.role !== X.ADMIN)
    return { success: !1, message: "Solo admins pueden crear usuarios" };
  if (!W(E.usersCreate))
    return { success: !1, message: "Tu rol no puede crear usuarios" };
  const {
    internalCode: d,
    firstName: l,
    lastName: i,
    documentNumber: n,
    email: s,
    phone: t,
    address: c,
    birthDate: u,
    newPassword: p,
    roleProfileId: g,
    isActive: T
  } = r.data, I = await ue.hash(p, 10), f = et(l, i);
  try {
    if (await R.user.findFirst({
      where: { documentNumber: n },
      select: { id: !0 }
    }))
      return { success: !1, message: "La cedula ya esta registrada para otro usuario" };
    const N = g ? await R.roleProfile.findUnique({
      where: { id: g },
      select: { id: !0, baseRole: !0, isActive: !0 }
    }) : await R.roleProfile.findUnique({
      where: { key: ge("EMPLOYEE") },
      select: { id: !0, baseRole: !0, isActive: !0 }
    });
    if (!N || !N.isActive)
      return { success: !1, message: "El perfil de rol seleccionado no esta disponible" };
    const h = await Wt({
      prismaClient: R,
      firstName: l,
      lastName: i,
      documentNumber: n
    }), b = (await R.user.findMany({
      select: { internalCode: !0 }
    })).map((x) => x.internalCode), D = ae({
      desiredCode: d,
      existingCodes: b,
      prefix: "USR",
      digits: 4,
      maxLength: 30
    });
    return await R.user.create({
      data: {
        internalCode: D,
        username: h,
        firstName: l.trim(),
        lastName: i.trim(),
        name: f,
        documentNumber: n,
        email: Z(s),
        phone: Z(t),
        address: Z(c),
        birthDate: tt(u),
        passwordHash: I,
        role: N.baseRole,
        roleProfileId: N.id,
        isActive: T ?? !0
      }
    }), { success: !0, username: h };
  } catch (y) {
    return { success: !1, message: y instanceof Error ? y.message : "No se pudo crear el usuario" };
  }
});
q.handle("users:update", async (e, a) => {
  const r = pa.safeParse(a);
  if (!r.success)
    return { success: !1, message: "Datos invalidos" };
  if (!P || P.role !== X.ADMIN)
    return { success: !1, message: "Solo admins pueden editar usuarios" };
  if (!W(E.usersEdit))
    return { success: !1, message: "Tu rol no puede editar usuarios" };
  const {
    id: d,
    internalCode: l,
    firstName: i,
    lastName: n,
    documentNumber: s,
    email: t,
    phone: c,
    address: u,
    birthDate: p,
    newPassword: g,
    roleProfileId: T,
    isActive: I
  } = r.data, f = await R.user.findUnique({
    where: { id: d },
    select: { id: !0, role: !0, isActive: !0, roleProfileId: !0, internalCode: !0 }
  });
  if (!f)
    return { success: !1, message: "El usuario ya no existe" };
  if (await R.user.findFirst({
    where: {
      documentNumber: s,
      NOT: { id: d }
    },
    select: { id: !0 }
  }))
    return { success: !1, message: "La cedula ya esta registrada para otro usuario" };
  const N = T ? await R.roleProfile.findUnique({
    where: { id: T },
    select: { id: !0, baseRole: !0, isActive: !0, name: !0 }
  }) : await R.roleProfile.findUnique({
    where: { key: ge(f.role ?? "EMPLOYEE") },
    select: { id: !0, baseRole: !0, isActive: !0, name: !0 }
  });
  if (!N || !N.isActive)
    return { success: !1, message: "El perfil de rol seleccionado no esta disponible" };
  if (f.role === X.ADMIN && (N.baseRole !== X.ADMIN || !I) && await R.user.count({
    where: {
      role: X.ADMIN,
      isActive: !0,
      NOT: { id: d }
    }
  }) === 0)
    return { success: !1, message: "Debe existir al menos un administrador activo" };
  const h = await Wt({
    prismaClient: R,
    firstName: i,
    lastName: n,
    documentNumber: s,
    excludeUserId: d
  }), b = et(i, n);
  try {
    const D = (await R.user.findMany({
      where: { NOT: { id: d } },
      select: { internalCode: !0 }
    })).map((v) => v.internalCode), x = ae({
      desiredCode: l,
      existingCodes: D,
      prefix: "USR",
      digits: 4,
      maxLength: 30
    });
    return await R.user.update({
      where: { id: d },
      data: {
        internalCode: x,
        username: h,
        firstName: i.trim(),
        lastName: n.trim(),
        name: b,
        documentNumber: s,
        email: Z(t),
        phone: Z(c),
        address: Z(u),
        birthDate: tt(p),
        role: N.baseRole,
        roleProfileId: N.id,
        isActive: I,
        ...g != null && g.trim() ? {
          passwordHash: await ue.hash(g, 10)
        } : {}
      }
    }), P.id === d && (P = {
      ...P,
      username: h,
      name: b,
      role: N.baseRole,
      roleProfileId: N.id,
      roleProfileName: N.name,
      permissions: await tr(R, N.id)
    }), { success: !0, username: h };
  } catch (D) {
    return { success: !1, message: D instanceof Error ? D.message : "No se pudo actualizar el usuario" };
  }
});
q.handle("auth:get-profile", async () => {
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
q.handle("auth:update-profile", async (e, a) => {
  var u;
  const r = ga.safeParse(a);
  if (!r.success)
    return { success: !1, message: "Datos invalidos" };
  if (!P)
    return { success: !1, message: "Debes iniciar sesion" };
  const { firstName: d, lastName: l, email: i, phone: n, birthDate: s } = r.data, t = et(d, l), c = await R.user.update({
    where: { id: P.id },
    data: {
      firstName: d.trim(),
      lastName: l.trim(),
      name: t,
      email: Z(i),
      phone: Z(n),
      birthDate: tt(s)
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
      ...c,
      birthDate: ((u = c.birthDate) == null ? void 0 : u.toISOString().slice(0, 10)) ?? null
    }
  };
});
q.handle("auth:change-password", async (e, a) => {
  const r = Ea.safeParse(a);
  if (!r.success)
    return { success: !1, message: "Datos invalidos" };
  if (!P)
    return { success: !1, message: "Debes iniciar sesion" };
  const { currentPassword: d, newPassword: l, confirmPassword: i } = r.data;
  if (l !== i)
    return { success: !1, message: "La confirmacion no coincide con la nueva contrasena" };
  const n = await R.user.findUnique({
    where: { id: P.id },
    select: { id: !0, passwordHash: !0 }
  });
  return n ? await ue.compare(d, n.passwordHash) ? await ue.compare(l, n.passwordHash) ? { success: !1, message: "La nueva contrasena debe ser diferente a la anterior" } : (await R.user.update({
    where: { id: n.id },
    data: {
      passwordHash: await ue.hash(l, 10)
    }
  }), { success: !0 }) : { success: !1, message: "La contrasena actual es incorrecta" } : { success: !1, message: "Tu usuario ya no existe" };
});
q.handle("notifications:get-read", async () => P ? {
  success: !0,
  readKeys: (await R.notificationRead.findMany({
    where: { userId: P.id },
    select: { readKey: !0 },
    orderBy: { createdAt: "desc" }
  })).map((a) => a.readKey)
} : { success: !1, message: "Debes iniciar sesion", readKeys: [] });
q.handle("notifications:mark-read", async (e, a) => {
  if (!P)
    return { success: !1, message: "Debes iniciar sesion" };
  const r = Array.isArray(a == null ? void 0 : a.readKeys) ? a.readKeys.filter((d) => typeof d == "string" && d.trim().length > 0) : [];
  return r.length === 0 ? { success: !0 } : (await Promise.all(
    r.map(
      (d) => R.notificationRead.upsert({
        where: {
          userId_readKey: {
            userId: P.id,
            readKey: d
          }
        },
        update: {},
        create: {
          userId: P.id,
          readKey: d
        }
      })
    )
  ), { success: !0 });
});
q.handle("roles:list", async () => !P || P.role !== X.ADMIN ? { success: !1, message: "Solo admins pueden ver roles", roles: [] } : W(E.rolesView) ? {
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
q.handle("roles:create", async (e, a) => {
  const r = Ta.safeParse(a);
  if (!r.success)
    return { success: !1, message: "Datos invalidos para el rol" };
  const d = be(r.data.permissionKeys);
  if (!P || P.role !== X.ADMIN)
    return { success: !1, message: "Solo admins pueden crear roles" };
  if (!W(E.rolesManage))
    return { success: !1, message: "Tu rol no puede crear roles" };
  if (d.length > 0 && d.find(
    (i) => !Ft(r.data.baseRole, i)
  ))
    return { success: !1, message: "Uno o mas permisos no pertenecen al rol base seleccionado" };
  try {
    return { success: !0, roleId: (await R.roleProfile.create({
      data: {
        name: r.data.name.trim(),
        description: Z(r.data.description),
        baseRole: r.data.baseRole,
        isSystem: !1,
        isActive: r.data.isActive ?? !0,
        permissions: {
          create: d.map((i) => ({
            permissionKey: i,
            allowed: !0
          }))
        }
      },
      select: { id: !0 }
    })).id };
  } catch (l) {
    return { success: !1, message: l instanceof Error ? l.message : "No se pudo crear el rol" };
  }
});
q.handle("roles:update", async (e, a) => {
  const r = Aa.safeParse(a);
  if (!r.success)
    return { success: !1, message: "Datos invalidos para el rol" };
  const d = be(r.data.permissionKeys);
  if (!P || P.role !== X.ADMIN)
    return { success: !1, message: "Solo admins pueden editar roles" };
  if (!W(E.rolesManage))
    return { success: !1, message: "Tu rol no puede editar roles" };
  const l = await R.roleProfile.findUnique({
    where: { id: r.data.id },
    select: { id: !0, baseRole: !0, isSystem: !0, name: !0 }
  });
  if (!l)
    return { success: !1, message: "El rol ya no existe" };
  if (d.find(
    (n) => !Ft(l.baseRole, n)
  ))
    return { success: !1, message: "Uno o mas permisos no pertenecen al rol base seleccionado" };
  try {
    return await R.$transaction(async (n) => {
      await n.roleProfile.update({
        where: { id: r.data.id },
        data: {
          name: r.data.name.trim(),
          description: Z(r.data.description),
          isActive: r.data.isActive ?? !0
        }
      }), await n.rolePermission.deleteMany({ where: { roleProfileId: r.data.id } }), await n.rolePermission.createMany({
        data: d.map((s) => ({
          roleProfileId: r.data.id,
          permissionKey: s,
          allowed: !0
        }))
      });
    }), P.roleProfileId === r.data.id && (P = {
      ...P,
      roleProfileName: r.data.name.trim(),
      permissions: d
    }), { success: !0, roleId: r.data.id };
  } catch (n) {
    return { success: !1, message: n instanceof Error ? n.message : "No se pudo actualizar el rol" };
  }
});
q.handle("roles:delete", async (e, a) => {
  const r = Ia.safeParse(a);
  if (!r.success)
    return { success: !1, message: "Datos invalidos para el rol" };
  if (!P || P.role !== X.ADMIN)
    return { success: !1, message: "Solo admins pueden eliminar roles" };
  if (!W(E.rolesManage))
    return { success: !1, message: "Tu rol no puede eliminar roles" };
  const d = await R.roleProfile.findUnique({
    where: { id: r.data.id },
    include: {
      _count: {
        select: {
          users: !0
        }
      }
    }
  });
  return d ? d.isSystem ? { success: !1, message: "Los roles del sistema no se pueden eliminar" } : d._count.users > 0 ? { success: !1, message: "Reasigna los usuarios del rol antes de eliminarlo" } : (await R.roleProfile.delete({
    where: { id: r.data.id }
  }), { success: !0, roleId: r.data.id }) : { success: !1, message: "El rol ya no existe" };
});
q.handle("auth:logout", async () => (P = null, { success: !0 }));
q.handle("products:list", async () => (await R.product.findMany({
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
  var r, d;
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
    subcategory: ((d = a.subcategory) == null ? void 0 : d.name) ?? null
  };
}));
q.handle("sales:create", async (e, a) => {
  var A, S, L;
  if (!P)
    return { success: !1, message: "Debes iniciar sesion para vender" };
  if (!W(E.salesCreate))
    return { success: !1, message: "Tu rol no puede registrar ventas" };
  if (!W(E.salesManagePayments))
    return { success: !1, message: "Tu rol no puede gestionar pagos" };
  const r = ha.safeParse(a);
  if (!r.success)
    return { success: !1, message: "Datos invalidos para la venta" };
  let d = null;
  if (r.data.customerId && (d = await R.customer.findFirst({
    where: {
      id: r.data.customerId,
      isActive: !0
    },
    select: {
      id: !0,
      name: !0
    }
  }), !d))
    return { success: !1, message: "El cliente seleccionado ya no esta disponible" };
  const l = (d == null ? void 0 : d.name) ?? ((A = r.data.customer) == null ? void 0 : A.trim()) ?? "Consumidor final";
  if (l !== "Consumidor final" && !W(E.salesChangeCustomer))
    return { success: !1, message: "Tu rol no puede cambiar el cliente en la factura" };
  const i = r.data.items.map((C) => C.productId), n = await R.product.findMany({
    where: {
      id: { in: i },
      isActive: !0
    }
  });
  if (n.length !== i.length)
    return { success: !1, message: "Uno o mas productos ya no estan disponibles" };
  const s = new Map(n.map((C) => [C.id, C])), t = W(E.salesEditItemPrices), c = r.data.items.map((C) => {
    var st, rt, nt, ot;
    const O = s.get(C.productId);
    if (!O)
      throw new Error("Producto no encontrado");
    const _ = Ue(O.pricingConfigJson), j = !!(_ != null && _.enabled);
    if (!j && O.stock < C.qty)
      throw new Error(`Stock insuficiente para ${O.name}`);
    if (((st = C.pricingContext) == null ? void 0 : st.manualUnitPrice) !== void 0 && ((rt = C.pricingContext) == null ? void 0 : rt.manualUnitPrice) !== null && !t)
      throw new Error("Tu rol no puede aplicar precios manuales en productos con reglas escalonadas");
    const K = ys({
      fallbackPrice: O.price,
      pricingConfig: _,
      qty: C.qty,
      specialRuleId: ((nt = C.pricingContext) == null ? void 0 : nt.specialRuleId) ?? null,
      manualUnitPrice: ((ot = C.pricingContext) == null ? void 0 : ot.manualUnitPrice) ?? null,
      canOverrideMinimum: t
    });
    if (!K.ok)
      throw new Error(K.message);
    const { quote: B } = K, $ = O.name, U = Ce(B.unitPrice * C.qty), at = Ce(U * O.taxRate), ea = U + at, ta = Ce((B.unitPrice - O.cost) * C.qty);
    return {
      product: O,
      quote: B,
      lineName: $,
      qty: C.qty,
      lineSubtotal: U,
      lineTax: at,
      lineTotal: ea,
      lineProfit: ta,
      skipStockControl: j
    };
  }), u = c.reduce((C, O) => C + O.lineSubtotal, 0), p = c.reduce((C, O) => C + O.lineTax, 0), g = u + p, T = c.reduce((C, O) => C + O.product.cost * O.qty, 0), I = c.reduce((C, O) => C + O.lineProfit, 0), y = (r.data.payments && r.data.payments.length > 0 ? r.data.payments : [
    {
      method: r.data.paymentMethod,
      amount: r.data.amountPaid ?? g
    }
  ]).map((C) => ({
    method: C.method,
    amount: Ce(C.amount)
  })).filter((C) => C.amount > 0);
  if (y.length === 0 && !r.data.allowDebt)
    return { success: !1, message: "Debes registrar al menos un pago para completar la venta" };
  const N = y.reduce((C, O) => C + O.amount, 0), h = Math.max(0, N - g), b = y.filter((C) => C.method === "CASH").reduce((C, O) => C + O.amount, 0);
  if (h > b)
    return { success: !1, message: "Las vueltas solo pueden salir de un pago en efectivo" };
  let D = g;
  const x = /* @__PURE__ */ new Map();
  for (const C of y) {
    if (D <= 0)
      break;
    const O = Math.min(C.amount, D);
    O <= 0 || (x.set(
      C.method,
      (x.get(C.method) ?? 0) + O
    ), D -= O);
  }
  const v = ((S = [...x.entries()].sort((C, O) => O[1] - C[1])[0]) == null ? void 0 : S[0]) ?? ((L = y[0]) == null ? void 0 : L.method) ?? r.data.paymentMethod, m = x.get(z.CASH) ?? 0;
  if (r.data.clientTotal !== void 0 && Math.abs(r.data.clientTotal - g) > 1)
    return { success: !1, message: "El total enviado no coincide con el calculo del sistema" };
  if (N < g && !r.data.allowDebt)
    return { success: !1, message: "El pago recibido no alcanza para cubrir la venta" };
  try {
    const C = await R.$transaction(async (O) => {
      const _ = await O.sale.count() + 1, j = await O.businessSettings.findUnique({
        where: { id: "default" },
        select: { invoicePrefix: !0 }
      }), K = Zs((j == null ? void 0 : j.invoicePrefix) || "FV", _), B = await O.cashSession.findFirst({
        where: {
          userId: P.id,
          status: "OPEN"
        },
        orderBy: { openedAt: "desc" }
      }), $ = await O.sale.create({
        data: {
          invoiceNumber: K,
          customer: l,
          customerId: (d == null ? void 0 : d.id) ?? null,
          paymentMethod: v,
          subtotal: u,
          tax: p,
          total: g,
          costTotal: T,
          profit: I,
          cashierId: P.id,
          cashSessionId: (B == null ? void 0 : B.id) ?? null,
          items: {
            create: c.map((U) => ({
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
      B && m > 0 && await O.cashMovement.create({
        data: {
          sessionId: B.id,
          type: k.SALE_IN,
          amount: m,
          note: $.invoiceNumber
        }
      });
      for (const U of c)
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
      saleId: C.id,
      invoiceNumber: C.invoiceNumber,
      total: g,
      amountPaid: N,
      changeAmount: h
    };
  } catch (C) {
    return { success: !1, message: C instanceof Error ? C.message : "No se pudo registrar la venta" };
  }
});
q.handle("dashboard:stats", async (e, a = "day") => {
  const r = ["day", "week", "month"].includes(a) ? a : "day", d = Ws(r), l = await R.sale.findMany({
    where: { createdAt: { gte: d } },
    include: { items: !0 },
    orderBy: { createdAt: "desc" }
  }), i = l.reduce((T, I) => T + I.total, 0), n = l.reduce((T, I) => T + I.profit, 0), s = l.reduce((T, I) => T + I.tax, 0), t = l.length > 0 ? Ce(i / l.length) : 0, c = l.reduce((T, I) => (T[I.paymentMethod] = (T[I.paymentMethod] ?? 0) + I.total, T), {}), u = l.flatMap((T) => T.items).reduce((T, I) => {
    const f = T[I.name] ?? { name: I.name, qty: 0, total: 0 };
    return f.qty += I.qty, f.total += I.lineTotal, T[I.name] = f, T;
  }, {}), p = Object.values(u).sort((T, I) => I.qty - T.qty).slice(0, 5), g = await R.product.findMany({
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
      salesCount: l.length,
      revenue: i,
      profit: n,
      tax: s,
      averageTicket: t
    },
    paymentSummary: [
      { label: "Efectivo", value: c.CASH ?? 0 },
      { label: "Transferencia", value: (c.CARD ?? 0) + (c.TRANSFER ?? 0) }
    ],
    topProducts: p,
    recentSales: l.slice(0, 6).map((T) => ({
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
re.on("window-all-closed", () => {
  process.platform !== "darwin" && (re.quit(), me = null);
});
re.on("quit", async () => {
  await (R == null ? void 0 : R.$disconnect());
});
export {
  vr as MAIN_DIST,
  Jt as RENDERER_DIST,
  Ge as VITE_DEV_SERVER_URL,
  Js as seedAdminIfNeeded
};
