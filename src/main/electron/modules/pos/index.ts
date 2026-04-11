import type { IpcMain } from "electron";
import { BrowserWindow } from "electron";
import { z } from "zod";

import {
  CashMovementType,
  CashSessionStatus,
  CorrespondentDirection,
  CreditStatus,
  InventoryMovementType,
  PaymentMethod,
  PrismaClient,
  PurchaseStatus,
  Role,
  SaleStatus,
} from "@prisma/client";

import {
  accountingRangeSchema,
  createAccountingCreditNoteSchema,
  createAccountingCreditSchema,
  createAccountingExpenseSchema,
  createAccountingPaymentSchema,
} from "../../ipc/schemas/accounting.schema";
import { createProductSchema, updateProductSchema } from "../../ipc/schemas/product.schema";
import { APP_PERMISSION_KEYS, hasPermissionKey } from "../../../../renderer/features/user/app-permissions";
import { resolveManagedCode } from "../../../../shared/internalCodes";

type CurrentSessionUser = {
  id: string;
  username: string;
  role: Role;
  name?: string;
  permissions?: string[];
} | null;

type RegisterBackofficeHandlersArgs = {
  ipcMain: IpcMain;
  prisma: PrismaClient;
  getCurrentSessionUser: () => CurrentSessionUser;
  getConnectedAt: () => Date;
};

const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
});

const createSubcategorySchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
});

const deleteByIdSchema = z.object({
  id: z.string().uuid(),
});

const documentTypeSchema = z.enum([
  "Cédula",
  "NIT",
  "Cédula de extranjería",
  "Pasaporte",
  "Tarjeta de identidad",
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
  isActive: z.boolean().optional().default(true),
});

const updateCustomerSchema = createCustomerSchema.extend({
  id: z.string().uuid(),
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
  isActive: z.boolean().optional().default(true),
});

const updateSupplierSchema = createSupplierSchema.extend({
  id: z.string().uuid(),
});

const createPurchaseSchema = z.object({
  supplierId: z.string().uuid(),
  purchasedAt: z.string().datetime().optional(),
  note: z.string().trim().max(300).optional().nullable(),
  markAsPaid: z.boolean().optional().default(false),
  paymentMedium: z.enum(["CASH", "TRANSFER", "CORRESPONDENT"]).optional().default("CASH"),
  paymentPlatformId: z.string().uuid().optional().nullable(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        qty: z.number().int().positive(),
        cost: z.number().positive(),
        taxRate: z.number().min(0).max(1).optional().default(0.19),
      })
    )
    .min(1),
});

const cashPlatformAmountSchema = z.object({
  platformId: z.string().uuid(),
  amount: z.number().min(0),
});

const openCashSessionSchema = z.object({
  openingCashAmount: z.number().min(0),
  openingTransferAmount: z.number().min(0).optional().default(0),
  note: z.string().trim().max(300).optional().nullable(),
  cashBreakdown: z.record(z.string(), z.number()).optional().default({}),
  correspondentBalances: z.array(cashPlatformAmountSchema).optional().default([]),
});

const closeCashSessionSchema = z.object({
  sessionId: z.string().uuid(),
  countedCashAmount: z.number().min(0),
  countedTransferAmount: z.number().min(0).optional().default(0),
  note: z.string().trim().max(300).optional().nullable(),
  cashBreakdown: z.record(z.string(), z.number()).optional().default({}),
  correspondentBalances: z.array(cashPlatformAmountSchema).optional().default([]),
});

const themeModeSchema = z.enum(["LIGHT", "DARK"]);
const receiptPrintTemplateSchema = z.enum(["NORMAL", "THERMAL_80", "THERMAL_50"]);

const businessIdentitySettingsSchema = z.object({
  businessName: z.string().trim().max(120).optional().nullable(),
  taxId: z.string().trim().max(40).optional().nullable(),
  address: z.string().trim().max(180).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
});

const systemThemeSettingsSchema = z.object({
  themeMode: themeModeSchema,
});

const billingSettingsSchema = z.object({
  invoicePrefix: z.string().trim().max(10).optional().nullable(),
  defaultReceiptTemplate: receiptPrintTemplateSchema.optional().default("NORMAL"),
  receiptFooter: z.string().trim().max(400).optional().nullable(),
});

const inventorySettingsSchema = z.object({
  defaultTaxRate: z.number().min(0).max(1).optional(),
  allowNegativeStock: z.boolean().optional(),
});

const salesListFilterSchema = z
  .object({
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    cashierId: z.string().uuid().optional(),
    status: z.nativeEnum(SaleStatus).optional(),
    search: z.string().trim().max(80).optional(),
  })
  .optional()
  .default({});

const saleByIdSchema = z.object({
  saleId: z.string().uuid(),
});

const salePrintSchema = saleByIdSchema.extend({
  template: receiptPrintTemplateSchema.optional().default("NORMAL"),
});

function money(value: number) {
  return Math.round(value);
}

const BUSINESS_CITY_SEPARATOR = "|||CITY|||";

function mergeBusinessAddress(address?: string | null, city?: string | null) {
  const normalizedAddress = address?.trim() || "";
  const normalizedCity = city?.trim() || "";
  if (!normalizedCity) return normalizedAddress || null;
  return `${normalizedAddress}${BUSINESS_CITY_SEPARATOR}${normalizedCity}`;
}

function splitBusinessAddress(rawAddress?: string | null) {
  if (!rawAddress) return { address: "", city: "" };
  const parts = rawAddress.split(BUSINESS_CITY_SEPARATOR);
  return {
    address: parts[0]?.trim() || "",
    city: parts[1]?.trim() || "",
  };
}

function calculateSalePrice(cost: number, marginPercent = 0, hasTax = false, taxRate = 0) {
  const basePrice = Number(cost || 0) * (1 + Number(marginPercent || 0) / 100);
  const total = hasTax ? basePrice * (1 + Number(taxRate || 0)) : basePrice;
  return money(total);
}

function paymentMethodLabel(value: PaymentMethod) {
  if (value === PaymentMethod.CARD) return "Transferencia";
  if (value === PaymentMethod.TRANSFER) return "Transferencia";
  return "Efectivo";
}

function paymentSummaryLabel(
  payments: Array<{ method: PaymentMethod; amount: number }> | undefined,
  fallback: PaymentMethod
) {
  if (!payments || payments.length <= 1) return paymentMethodLabel(fallback);
  return payments.map((payment) => `${paymentMethodLabel(payment.method)} $${payment.amount.toLocaleString("es-CO")}`).join(" + ");
}

function buildInvoiceHtml(sale: {
  invoiceNumber: string;
  customer: string;
  paymentSummary: string;
  total: number;
  subtotal: number;
  tax: number;
  createdAt: Date;
  businessName?: string | null;
  taxId?: string | null;
  address?: string | null;
  city?: string | null;
  receiptFooter?: string | null;
  cashier: { username: string; name: string | null };
  items: Array<{ name: string; qty: number; price: number; lineTotal: number }>;
}) {
  const cashierName = buildCashierDisplayName(sale.cashier);
  const legalNotes = buildInvoiceLegalNotes(sale.receiptFooter);
  const rows = sale.items
    .map(
      (item) => `
        <tr>
          <td>${item.name}</td>
          <td style="text-align:center">${item.qty}</td>
          <td style="text-align:right">$${item.price.toLocaleString("es-CO")}</td>
          <td style="text-align:right">$${item.lineTotal.toLocaleString("es-CO")}</td>
        </tr>
      `
    )
    .join("");
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
          .legal-notes { margin-top: 20px; padding-top: 12px; border-top: 1px solid #e5e7eb; display: grid; gap: 6px; }
          .legal-notes p { font-size: 11px; color: #4b5563; line-height: 1.5; }
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
            <div>Cajero: ${cashierName}</div>
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
        <div class="legal-notes">${legalNotes.map((note) => `<p>${note}</p>`).join("")}</div>
      </body>
    </html>
  `;
}

type ReceiptPrintTemplate = z.infer<typeof receiptPrintTemplateSchema>;

type InvoicePrintPayload = {
  invoiceNumber: string;
  customer: string;
  paymentSummary: string;
  total: number;
  subtotal: number;
  tax: number;
  createdAt: Date;
  businessName?: string | null;
  taxId?: string | null;
  address?: string | null;
  city?: string | null;
  receiptFooter?: string | null;
  cashier: { username: string; name: string | null };
  items: Array<{ name: string; qty: number; price: number; lineTotal: number }>;
};

function buildInvoiceHtmlForTemplate(sale: InvoicePrintPayload, template: ReceiptPrintTemplate) {
  if (template === "NORMAL") {
    return buildInvoiceHtml(sale);
  }

  const paperWidth = template === "THERMAL_50" ? 50 : 80;
  const businessAddress = [sale.address, sale.city].filter(Boolean).join(" - ");
  const cashierName = buildCashierDisplayName(sale.cashier);
  const legalNotes = buildInvoiceLegalNotes(sale.receiptFooter);
  const rows = sale.items
    .map(
      (item) => `
        <div class="item">
          <div class="item-name">${item.name}</div>
          <div class="item-meta">
            <span>${item.qty} x $${item.price.toLocaleString("es-CO")}</span>
            <strong>$${item.lineTotal.toLocaleString("es-CO")}</strong>
          </div>
        </div>
      `
    )
    .join("");

  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${sale.invoiceNumber}</title>
        <style>
          @page { size: ${paperWidth}mm auto; margin: 4mm; }
          body {
            font-family: "Segoe UI", Arial, sans-serif;
            color: #111827;
            margin: 0;
            width: ${paperWidth - 8}mm;
            font-size: ${template === "THERMAL_50" ? 10 : 11}px;
            line-height: 1.35;
          }
          h1, p { margin: 0; }
          .receipt { display: flex; flex-direction: column; gap: 10px; }
          .header { text-align: center; border-bottom: 1px dashed #9ca3af; padding-bottom: 8px; }
          .header h1 { font-size: ${template === "THERMAL_50" ? 14 : 16}px; margin-bottom: 4px; }
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
            <h1>${sale.businessName || "Factura de venta"}</h1>
            ${sale.taxId ? `<p class="muted">NIT: ${sale.taxId}</p>` : ""}
            ${businessAddress ? `<p class="muted">${businessAddress}</p>` : ""}
          </div>

          <div class="meta">
            <div><strong>Factura:</strong> ${sale.invoiceNumber}</div>
            <div><strong>Fecha:</strong> ${sale.createdAt.toLocaleString("es-CO")}</div>
            <div><strong>Cliente:</strong> ${sale.customer}</div>
            <div><strong>Cajero:</strong> ${cashierName}</div>
            <div><strong>Pago:</strong> ${sale.paymentSummary}</div>
          </div>

          <div>
            <div class="section-title">Detalle</div>
            <div class="items">${rows}</div>
          </div>

          <div class="totals">
            <div class="total-row"><span>Subtotal</span><strong>$${sale.subtotal.toLocaleString("es-CO")}</strong></div>
            <div class="total-row"><span>IVA</span><strong>$${sale.tax.toLocaleString("es-CO")}</strong></div>
            <div class="total-row total"><span>Total</span><strong>$${sale.total.toLocaleString("es-CO")}</strong></div>
          </div>
          <div class="footer">${legalNotes.map((note) => `<p class="muted">${note}</p>`).join("")}</div>
        </div>
      </body>
    </html>
  `;
}

async function ensureAdminSession(getCurrentSessionUser: () => CurrentSessionUser) {
  const currentSessionUser = getCurrentSessionUser();
  if (!currentSessionUser || currentSessionUser.role !== Role.ADMIN) {
    throw new Error("Solo admins pueden ejecutar esta accion");
  }
  return currentSessionUser;
}

function hasSessionPermission(currentSessionUser: CurrentSessionUser, permissionKey?: string) {
  if (!permissionKey) return true;
  return hasPermissionKey(currentSessionUser?.permissions, permissionKey);
}

function actorLabel(currentSessionUser: CurrentSessionUser) {
  return currentSessionUser?.name?.trim() || currentSessionUser?.username || "Sistema";
}

function buildCashierDisplayName(cashier: { username: string; name: string | null }) {
  const candidate = cashier.name?.trim() || cashier.username;
  const [firstName] = candidate.split(/\s+/).filter(Boolean);
  return firstName || candidate;
}

function buildInvoiceLegalNotes(receiptFooter?: string | null) {
  const notes = [
    "Esta factura de venta podra constituirse como titulo valor conforme a la legislacion comercial aplicable y cuando se cumplan los requisitos legales.",
    "En ventas a credito, la mora en el pago causara intereses a la tasa maxima legal vigente.",
  ];

  if (receiptFooter?.trim()) {
    notes.push(receiptFooter.trim());
  }

  return notes;
}

function buildFullName(firstName: string, lastName?: string | null) {
  return [firstName.trim(), lastName?.trim() || ""].filter(Boolean).join(" ");
}

function buildDocumentValue(documentType?: string | null, documentNumber?: string | null) {
  const normalizedNumber = documentNumber?.trim();
  if (!normalizedNumber) return null;
  return `${documentType || "Cédula"}: ${normalizedNumber}`;
}

async function getAuditUserMap(
  prisma: PrismaClient,
  entity: string,
  entityIds: string[],
  action: string,
  newestFirst = false
) {
  if (entityIds.length === 0) {
    return new Map<string, string>();
  }

  const logs = await prisma.auditLog.findMany({
    where: {
      entity,
      action,
      entityId: { in: entityIds },
    },
    include: {
      user: {
        select: {
          name: true,
          username: true,
        },
      },
    },
    orderBy: { createdAt: newestFirst ? "desc" : "asc" },
  });

  const result = new Map<string, string>();
  for (const log of logs) {
    if (!log.entityId || result.has(log.entityId)) continue;
    result.set(log.entityId, log.user?.name?.trim() || log.user?.username || "Sistema");
  }
  return result;
}

function parseSessionMeta(note?: string | null) {
  if (!note) return {};
  try {
    return JSON.parse(note) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function stringifySessionMeta(meta: Record<string, unknown>) {
  return JSON.stringify(meta);
}

type TreasuryMedium = "CASH" | "TRANSFER" | "CORRESPONDENT";

type TreasuryMovementMeta = {
  label?: string;
  medium?: TreasuryMedium;
  platformId?: string | null;
  platformName?: string | null;
  sourceType?: "SALE" | "ACCOUNTING_PAYMENT" | "PURCHASE" | "EXPENSE" | "MANUAL";
  userNote?: string | null;
};

function toAmountMap(items?: Array<{ platformId: string; amount: number }> | null) {
  return new Map((items ?? []).map((item) => [item.platformId, Number(item.amount || 0)]));
}

function normalizeTreasuryMedium(value?: string | null): TreasuryMedium {
  if (value === "TRANSFER" || value === "CORRESPONDENT") return value;
  return "CASH";
}

function parseTreasuryMovementMeta(note?: string | null): TreasuryMovementMeta | null {
  if (!note) return null;
  try {
    const parsed = JSON.parse(note) as TreasuryMovementMeta;
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.medium && !parsed.label && !parsed.sourceType) return null;
    return {
      ...parsed,
      medium: normalizeTreasuryMedium(parsed.medium),
    };
  } catch {
    return null;
  }
}

function buildTreasuryMovementNote(meta: TreasuryMovementMeta) {
  return JSON.stringify(meta);
}

function resolveMovementLabel(note?: string | null, fallback = "Movimiento de caja") {
  const meta = parseTreasuryMovementMeta(note);
  return meta?.label || meta?.userNote || note || fallback;
}

function resolveMovementMedium(note?: string | null) {
  return parseTreasuryMovementMeta(note)?.medium ?? "CASH";
}

function resolveMovementPlatformId(note?: string | null) {
  return parseTreasuryMovementMeta(note)?.platformId ?? null;
}

function resolveMovementPlatformName(note?: string | null) {
  return parseTreasuryMovementMeta(note)?.platformName ?? null;
}

function buildDateRangeFilter(dateFrom?: string, dateTo?: string) {
  return dateFrom || dateTo
    ? {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      }
    : undefined;
}

function getSessionSection(meta: Record<string, unknown>, key: "opening" | "closing") {
  const raw = meta[key];
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function getSectionTransferAmount(section: Record<string, unknown>) {
  return Number(section.transferAmount ?? 0);
}

function buildSalePaymentTotals(
  sales: Array<{
    total: number;
    paymentMethod: PaymentMethod;
    payments?: Array<{ method: PaymentMethod; amount: number }>;
  }>
) {
  return sales.reduce(
    (acc, sale) => {
      if (sale.payments && sale.payments.length > 0) {
        for (const payment of sale.payments) {
          if (payment.method === PaymentMethod.CASH) acc.cash += payment.amount;
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

function buildCorrespondentMovementMap(
  movements: Array<{ type: CashMovementType; amount: number; note: string | null }>
) {
  const map = new Map<string, { manualIncome: number; manualExpense: number; platformName: string | null }>();

  for (const move of movements) {
    const medium = resolveMovementMedium(move.note);
    if (medium !== "CORRESPONDENT") continue;
    const platformId = resolveMovementPlatformId(move.note);
    if (!platformId) continue;
    const current = map.get(platformId) ?? { manualIncome: 0, manualExpense: 0, platformName: resolveMovementPlatformName(move.note) };
    if (move.type === CashMovementType.INCOME_IN) current.manualIncome += move.amount;
    if (move.type === CashMovementType.EXPENSE_OUT || move.type === CashMovementType.WITHDRAWAL_OUT) {
      current.manualExpense += move.amount;
    }
    if (!current.platformName) current.platformName = resolveMovementPlatformName(move.note);
    map.set(platformId, current);
  }

  return map;
}

function buildSessionTreasurySnapshot(params: {
  session: {
    openingAmount: number;
    countedAmount?: number | null;
    note?: string | null;
    sales: Array<{
      id: string;
      invoiceNumber: string;
      customer: string;
      total: number;
      paymentMethod: PaymentMethod;
      createdAt: Date;
      payments?: Array<{ method: PaymentMethod; amount: number }>;
    }>;
    movements: Array<{ id: string; type: CashMovementType; amount: number; note: string | null; createdAt: Date }>;
    correspondentTransactions: Array<{
      id: string;
      amount: number;
      commissionAmount: number;
      performedAt: Date;
      platform: { id: string; name: string };
      type: { name: string; direction: CorrespondentDirection };
    }>;
  };
  platforms: Array<{ id: string; name: string }>;
}) {
  const sessionMeta = parseSessionMeta(params.session.note);
  const opening = getSessionSection(sessionMeta, "opening");
  const closing = getSessionSection(sessionMeta, "closing");
  const openingCorrespondent = toAmountMap(
    (opening.correspondentBalances as Array<{ platformId: string; amount: number }> | undefined) ?? []
  );
  const closingCorrespondent = toAmountMap(
    (closing.correspondentBalances as Array<{ platformId: string; amount: number }> | undefined) ?? []
  );
  const openingTransferAmount = getSectionTransferAmount(opening);
  const countedTransferAmount = closing.transferAmount === undefined ? null : getSectionTransferAmount(closing);

  const saleTotals = buildSalePaymentTotals(params.session.sales);
  const cashManualIncome = params.session.movements
    .filter((move) => move.type === CashMovementType.INCOME_IN && resolveMovementMedium(move.note) === "CASH")
    .reduce((sum, move) => sum + move.amount, 0);
  const transferManualIncome = params.session.movements
    .filter((move) => move.type === CashMovementType.INCOME_IN && resolveMovementMedium(move.note) === "TRANSFER")
    .reduce((sum, move) => sum + move.amount, 0);
  const cashManualExpense = params.session.movements
    .filter(
      (move) =>
        (move.type === CashMovementType.EXPENSE_OUT || move.type === CashMovementType.WITHDRAWAL_OUT) &&
        resolveMovementMedium(move.note) === "CASH"
    )
    .reduce((sum, move) => sum + move.amount, 0);
  const transferManualExpense = params.session.movements
    .filter(
      (move) =>
        (move.type === CashMovementType.EXPENSE_OUT || move.type === CashMovementType.WITHDRAWAL_OUT) &&
        resolveMovementMedium(move.note) === "TRANSFER"
    )
    .reduce((sum, move) => sum + move.amount, 0);
  const correspondentManualMap = buildCorrespondentMovementMap(params.session.movements);

  const expectedCash = params.session.openingAmount + saleTotals.cash + cashManualIncome - cashManualExpense;
  const expectedTransferAmount =
    openingTransferAmount + saleTotals.transfer + transferManualIncome - transferManualExpense;

  const correspondentByPlatform = params.platforms.map((platform) => {
    const platformTransactions = params.session.correspondentTransactions.filter(
      (transaction) => transaction.platform.id === platform.id
    );
    const totalIn = platformTransactions
      .filter((transaction) => transaction.type.direction === CorrespondentDirection.IN)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const totalOut = platformTransactions
      .filter((transaction) => transaction.type.direction === CorrespondentDirection.OUT)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const totalCommission = platformTransactions.reduce((sum, transaction) => sum + transaction.commissionAmount, 0);
    const manualAdjustments = correspondentManualMap.get(platform.id) ?? {
      manualIncome: 0,
      manualExpense: 0,
      platformName: platform.name,
    };
    const openingAmount = openingCorrespondent.get(platform.id) ?? 0;
    const expectedAmount =
      openingAmount +
      totalIn -
      totalOut +
      totalCommission +
      manualAdjustments.manualIncome -
      manualAdjustments.manualExpense;
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
      differenceAmount: countedAmount === null ? null : countedAmount - expectedAmount,
    };
  });

  const openingCorrespondentTotal = correspondentByPlatform.reduce((sum, item) => sum + item.openingAmount, 0);
  const correspondentExpectedTotal = correspondentByPlatform.reduce((sum, item) => sum + item.expectedAmount, 0);
  const countedCorrespondentTotal = correspondentByPlatform.reduce(
    (sum, item) => sum + (item.countedAmount ?? item.expectedAmount),
    0
  );
  const countedCashAmount =
    closing.cashBreakdown && typeof closing.cashBreakdown === "object"
      ? null
      : params.session.countedAmount ?? null;
  const expectedAvailableTotal = expectedCash + expectedTransferAmount + correspondentExpectedTotal;
  const countedAvailableTotal =
    (params.session.countedAmount ?? expectedCash) +
    (countedTransferAmount ?? expectedTransferAmount) +
    countedCorrespondentTotal;

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
    countedCashAmount,
  };
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function deriveCreditStatus(balance: number, total: number, dueDate?: Date | null) {
  if (total <= 0) return CreditStatus.CANCELLED;
  if (balance <= 0) return CreditStatus.PAID;
  if (dueDate && dueDate.getTime() < startOfToday().getTime()) return CreditStatus.OVERDUE;
  if (balance < total) return CreditStatus.PARTIAL;
  return CreditStatus.PENDING;
}

function mapSaleStatusFromReturns(total: number, returnedTotal: number) {
  if (returnedTotal >= total) return SaleStatus.RETURNED;
  if (returnedTotal > 0) return SaleStatus.PARTIALLY_RETURNED;
  return SaleStatus.COMPLETED;
}

export async function ensureBackofficeSchemaIfNeeded(prismaClient: PrismaClient) {
  const businessSettingsColumns = await prismaClient.$queryRawUnsafe<Array<{ name: string }>>(
    `PRAGMA table_info("BusinessSettings");`
  );
  const businessSettingsColumnSet = new Set(businessSettingsColumns.map((column) => column.name));

  if (!businessSettingsColumnSet.has("themeMode")) {
    await prismaClient.$executeRawUnsafe(
      `ALTER TABLE "BusinessSettings" ADD COLUMN "themeMode" TEXT NOT NULL DEFAULT 'LIGHT';`
    );
  }

  if (!businessSettingsColumnSet.has("defaultReceiptTemplate")) {
    await prismaClient.$executeRawUnsafe(
      `ALTER TABLE "BusinessSettings" ADD COLUMN "defaultReceiptTemplate" TEXT NOT NULL DEFAULT 'NORMAL';`
    );
  }

  const customerColumns = await prismaClient.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("Customer");`);
  const supplierColumns = await prismaClient.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("Supplier");`);
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
      internalCode: true,
    },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
  });
  const assignedCustomerCodes: string[] = [];

  for (const customer of customers) {
    const internalCode = resolveManagedCode({
      desiredCode: customer.internalCode,
      existingCodes: assignedCustomerCodes,
      prefix: "CLI",
      digits: 4,
      maxLength: 30,
    });

    if (internalCode !== customer.internalCode) {
      await prismaClient.customer.update({
        where: { id: customer.id },
        data: { internalCode },
      });
    }

    assignedCustomerCodes.push(internalCode);
  }

  const suppliers = await prismaClient.supplier.findMany({
    select: {
      id: true,
      internalCode: true,
    },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
  });
  const assignedSupplierCodes: string[] = [];

  for (const supplier of suppliers) {
    const internalCode = resolveManagedCode({
      desiredCode: supplier.internalCode,
      existingCodes: assignedSupplierCodes,
      prefix: "PRV",
      digits: 4,
      maxLength: 30,
    });

    if (internalCode !== supplier.internalCode) {
      await prismaClient.supplier.update({
        where: { id: supplier.id },
        data: { internalCode },
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

function getSkuPrefix(name: string, categoryName?: string | null) {
  const source = (categoryName || name || "PRD")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

  return (source.slice(0, 3) || "PRD").padEnd(3, "X");
}

async function generateSku(prisma: PrismaClient, name: string, categoryName?: string | null) {
  const prefix = getSkuPrefix(name, categoryName);
  const count = await prisma.product.count({
    where: { sku: { startsWith: prefix } },
  });
  return `${prefix}-${String(count + 1).padStart(3, "0")}`;
}

async function generatePurchaseNumber(prisma: PrismaClient) {
  const count = await prisma.purchase.count();
  return `CP-${String(count + 1).padStart(6, "0")}`;
}

async function logAudit(
  prisma: PrismaClient,
  currentSessionUser: CurrentSessionUser,
  module: string,
  action: string,
  entity: string,
  entityId?: string,
  beforeJson?: unknown,
  afterJson?: unknown
) {
  await prisma.auditLog.create({
    data: {
      userId: currentSessionUser?.id ?? null,
      module,
      action,
      entity,
      entityId: entityId ?? null,
      beforeJson: beforeJson === undefined ? null : JSON.stringify(beforeJson),
      afterJson: afterJson === undefined ? null : JSON.stringify(afterJson),
    },
  });
}

export function registerBackofficeIpcHandlers({
  ipcMain,
  prisma,
  getCurrentSessionUser,
  getConnectedAt,
}: RegisterBackofficeHandlersArgs) {
  ipcMain.handle("app:status", async () => ({
    success: true,
    connectedAt: getConnectedAt().toISOString(),
    now: new Date().toISOString(),
  }));

  ipcMain.handle("settings:get", async () => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion" };

    const settings = await prisma.businessSettings.findUnique({
      where: { id: "default" },
    });
    const addressParts = splitBusinessAddress(settings?.address);

    return {
      success: true,
      settings: {
        businessName: settings?.businessName || "",
        taxId: settings?.taxId || "",
        address: addressParts.address,
        city: addressParts.city,
        themeMode: settings?.themeMode === "DARK" ? "DARK" : "LIGHT",
        invoicePrefix: settings?.invoicePrefix || "FV",
        defaultTaxRate: settings?.defaultTaxRate ?? 0.19,
        allowNegativeStock: settings?.allowNegativeStock ?? false,
        defaultReceiptTemplate:
          settings?.defaultReceiptTemplate === "THERMAL_80" || settings?.defaultReceiptTemplate === "THERMAL_50"
            ? settings.defaultReceiptTemplate
            : "NORMAL",
        receiptFooter: settings?.receiptFooter || "",
      },
    };
  });

  ipcMain.handle("settings:update-theme", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser, APP_PERMISSION_KEYS.settingsTheme)) {
      return { success: false, message: "Tu rol no puede cambiar el tema del sistema" };
    }

    const parsed = systemThemeSettingsSchema.safeParse(payload);
    if (!parsed.success) return { success: false, message: "Configuracion de tema invalida" };

    await prisma.businessSettings.upsert({
      where: { id: "default" },
      update: {
        themeMode: parsed.data.themeMode,
      },
      create: {
        id: "default",
        themeMode: parsed.data.themeMode,
      },
    });

    await logAudit(prisma, currentSessionUser, "settings", "update_theme", "BusinessSettings", "default", undefined, parsed.data);
    return { success: true };
  });

  ipcMain.handle("settings:update-business", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser, APP_PERMISSION_KEYS.settingsBusiness)) {
      return { success: false, message: "Tu rol no puede editar los datos del negocio" };
    }

    const parsed = businessIdentitySettingsSchema.safeParse(payload);
    if (!parsed.success) return { success: false, message: "Datos del negocio invalidos" };

    const data = parsed.data;
    await prisma.businessSettings.upsert({
      where: { id: "default" },
      update: {
        businessName: data.businessName || null,
        taxId: data.taxId || null,
        address: mergeBusinessAddress(data.address, data.city),
      },
      create: {
        id: "default",
        businessName: data.businessName || null,
        taxId: data.taxId || null,
        address: mergeBusinessAddress(data.address, data.city),
      },
    });

    await logAudit(prisma, currentSessionUser, "settings", "update_business", "BusinessSettings", "default", undefined, data);
    return { success: true };
  });

  ipcMain.handle("settings:update-billing", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser, APP_PERMISSION_KEYS.settingsBilling)) {
      return { success: false, message: "Tu rol no puede editar factura e impresion" };
    }

    const parsed = billingSettingsSchema.safeParse(payload);
    if (!parsed.success) return { success: false, message: "Configuracion de factura invalida" };

    const data = parsed.data;
    await prisma.businessSettings.upsert({
      where: { id: "default" },
      update: {
        invoicePrefix: data.invoicePrefix || "FV",
        defaultReceiptTemplate: data.defaultReceiptTemplate,
        receiptFooter: data.receiptFooter || null,
      },
      create: {
        id: "default",
        invoicePrefix: data.invoicePrefix || "FV",
        defaultReceiptTemplate: data.defaultReceiptTemplate,
        receiptFooter: data.receiptFooter || null,
      },
    });

    await logAudit(prisma, currentSessionUser, "settings", "update_billing", "BusinessSettings", "default", undefined, data);
    return { success: true };
  });

  ipcMain.handle("settings:update-inventory", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser, APP_PERMISSION_KEYS.settingsInventory)) {
      return { success: false, message: "Tu rol no puede editar inventario y operacion" };
    }

    const parsed = inventorySettingsSchema.safeParse(payload);
    if (!parsed.success) return { success: false, message: "Configuracion operativa invalida" };

    const data = parsed.data;
    await prisma.businessSettings.upsert({
      where: { id: "default" },
      update: {
        defaultTaxRate: data.defaultTaxRate ?? 0.19,
        allowNegativeStock: data.allowNegativeStock ?? false,
      },
      create: {
        id: "default",
        defaultTaxRate: data.defaultTaxRate ?? 0.19,
        allowNegativeStock: data.allowNegativeStock ?? false,
      },
    });

    await logAudit(prisma, currentSessionUser, "settings", "update_inventory", "BusinessSettings", "default", undefined, data);
    return { success: true };
  });

  ipcMain.handle("cash:summary", async () => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion" };

    const [activeSession, previousClosedSession, recentSessions, platforms] = await Promise.all([
      prisma.cashSession.findFirst({
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
                  amount: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
          movements: {
            orderBy: { createdAt: "desc" },
          },
          correspondentTransactions: {
            where: { status: "REGISTERED" },
            include: {
              platform: { select: { id: true, name: true } },
              type: { select: { name: true, direction: true } },
            },
            orderBy: { performedAt: "desc" },
          },
        },
        orderBy: { openedAt: "desc" },
      }),
      prisma.cashSession.findFirst({
        where: { status: CashSessionStatus.CLOSED },
        include: {
          register: true,
          user: { select: { username: true, name: true } },
        },
        orderBy: { closedAt: "desc" },
      }),
      prisma.cashSession.findMany({
        include: {
          register: true,
          user: { select: { username: true, name: true } },
        },
        orderBy: { openedAt: "desc" },
        take: 20,
      }),
      prisma.correspondentPlatform.findMany({
        orderBy: { name: "asc" },
      }),
    ]);

    const previousReference = previousClosedSession
      ? (() => {
          const previousMeta = parseSessionMeta(previousClosedSession.note);
          const previousClosing = getSessionSection(previousMeta, "closing");
          const previousCorrespondentMap = toAmountMap(
            (previousClosing.correspondentBalances as Array<{ platformId: string; amount: number }> | undefined) ?? []
          );
          const closingRows = platforms
            .map((platform) => ({
              platformId: platform.id,
              platform: platform.name,
              countedAmount: previousCorrespondentMap.get(platform.id) ?? 0,
            }))
            .filter((item) => item.countedAmount > 0);
          const countedTransferAmount = getSectionTransferAmount(previousClosing);
          return {
            sessionId: previousClosedSession.id,
            registerName: previousClosedSession.register.name,
            user: previousClosedSession.user.name ?? previousClosedSession.user.username,
            closedAt: previousClosedSession.closedAt?.toISOString() ?? null,
            countedCashAmount: previousClosedSession.countedAmount ?? 0,
            countedTransferAmount,
            countedAvailableAmount:
              (previousClosedSession.countedAmount ?? 0) +
              countedTransferAmount +
              closingRows.reduce((sum, item) => sum + item.countedAmount, 0),
            closingBreakdown:
              previousClosing.cashBreakdown && typeof previousClosing.cashBreakdown === "object"
                ? (previousClosing.cashBreakdown as Record<string, number>)
                : {},
            correspondent: closingRows,
          };
        })()
      : null;

    if (!activeSession) {
      return {
        success: true,
        activeSession: null,
        previousReference,
        recentSessions: recentSessions.map((session) => ({
          id: session.id,
          registerName: session.register.name,
          user: session.user.name ?? session.user.username,
          status: session.status,
          openedAt: session.openedAt.toISOString(),
          closedAt: session.closedAt?.toISOString() ?? null,
          openingAmount: session.openingAmount,
          openingAvailableAmount:
            session.openingAmount +
            getSectionTransferAmount(getSessionSection(parseSessionMeta(session.note), "opening")) +
            ((getSessionSection(parseSessionMeta(session.note), "opening").correspondentBalances as
              | Array<{ platformId: string; amount: number }>
              | undefined) ?? []
            ).reduce((sum, item) => sum + Number(item.amount || 0), 0),
          countedAmount: session.countedAmount,
          countedAvailableAmount:
            (session.countedAmount ?? 0) +
            getSectionTransferAmount(getSessionSection(parseSessionMeta(session.note), "closing")) +
            ((getSessionSection(parseSessionMeta(session.note), "closing").correspondentBalances as
              | Array<{ platformId: string; amount: number }>
              | undefined) ?? []
            ).reduce((sum, item) => sum + Number(item.amount || 0), 0),
          differenceAmount: session.differenceAmount,
        })),
      };
    }
    const treasury = buildSessionTreasurySnapshot({
      session: activeSession,
      platforms,
    });
    const openingAvailableAmount =
      activeSession.openingAmount + treasury.openingTransferAmount + treasury.openingCorrespondentTotal;
    const countedCashAmount = activeSession.countedAmount ?? treasury.expectedCash;
    const countedTransferAmount = treasury.countedTransferAmount ?? treasury.expectedTransferAmount;
    const openingComparison = previousReference
      ? {
          cashDifferenceAmount: activeSession.openingAmount - previousReference.countedCashAmount,
          transferDifferenceAmount: treasury.openingTransferAmount - previousReference.countedTransferAmount,
          correspondentDifferenceTotal: treasury.correspondentByPlatform.reduce((sum, item) => {
            const previousAmount =
              previousReference.correspondent.find((previous) => previous.platformId === item.platformId)?.countedAmount ?? 0;
            return sum + (item.openingAmount - previousAmount);
          }, 0),
          differenceAmount: openingAvailableAmount - previousReference.countedAvailableAmount,
        }
      : null;

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
        countedAvailableAmount:
          countedCashAmount +
          countedTransferAmount +
          treasury.correspondentByPlatform.reduce(
            (sum, item) => sum + (item.countedAmount ?? item.expectedAmount),
            0
          ),
        cashDifferenceAmount: countedCashAmount - treasury.expectedCash,
        transferDifferenceAmount: countedTransferAmount - treasury.expectedTransferAmount,
        availableDifferenceAmount:
          countedCashAmount +
          countedTransferAmount +
          treasury.correspondentByPlatform.reduce(
            (sum, item) => sum + (item.countedAmount ?? item.expectedAmount),
            0
          ) -
          treasury.expectedAvailableTotal,
        salesCash: treasury.salesCash,
        salesCard: 0,
        salesTransfer: treasury.salesTransfer,
        manualIncome: treasury.cashManualIncome,
        manualExpense: treasury.cashManualExpense,
        manualTransferIncome: treasury.transferManualIncome,
        manualTransferExpense: treasury.transferManualExpense,
        openingBreakdown:
          treasury.opening.cashBreakdown && typeof treasury.opening.cashBreakdown === "object"
            ? (treasury.opening.cashBreakdown as Record<string, number>)
            : {},
        closingBreakdown:
          treasury.closing.cashBreakdown && typeof treasury.closing.cashBreakdown === "object"
            ? (treasury.closing.cashBreakdown as Record<string, number>)
            : {},
        correspondent: treasury.correspondentByPlatform,
        openingComparison,
        recentActivity: [
          ...activeSession.sales.flatMap((sale) =>
            (sale.payments && sale.payments.length > 0
              ? sale.payments
              : [
                  {
                    method: sale.paymentMethod,
                    amount: sale.total,
                  },
                ]
            ).map((payment, index) => ({
              id: `${sale.id}-${payment.method}-${index}`,
              createdAt: sale.createdAt.toISOString(),
              type: "Venta",
              medium:
                payment.method === PaymentMethod.CASH ? "Efectivo" : payment.method === PaymentMethod.CARD ? "Transferencia" : "Transferencia",
              detail: `${sale.invoiceNumber} - ${sale.customer}`,
              amount: payment.amount,
              signedAmount: payment.amount,
            }))
          ),
          ...activeSession.correspondentTransactions.map((transaction) => ({
            id: transaction.id,
            createdAt: transaction.performedAt.toISOString(),
            type: "Corresponsal",
            medium: transaction.platform.name,
            detail: `${transaction.type.name}${transaction.commissionAmount > 0 ? ` + comision ${transaction.commissionAmount.toLocaleString("es-CO")}` : ""}`,
            amount: transaction.amount,
            signedAmount:
              transaction.type.direction === CorrespondentDirection.OUT ? -transaction.amount : transaction.amount,
          })),
          ...activeSession.movements.map((move) => ({
            id: move.id,
            createdAt: move.createdAt.toISOString(),
            type: move.type,
            medium:
              resolveMovementMedium(move.note) === "TRANSFER"
                ? "Transferencias"
                : resolveMovementMedium(move.note) === "CORRESPONDENT"
                  ? resolveMovementPlatformName(move.note) || "Corresponsal"
                  : "Efectivo",
            detail: resolveMovementLabel(move.note),
            amount: move.amount,
            signedAmount:
              move.type === CashMovementType.EXPENSE_OUT || move.type === CashMovementType.WITHDRAWAL_OUT
                ? -move.amount
                : move.amount,
          })),
        ]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 30),
      },
      previousReference,
      recentSessions: recentSessions.map((session) => ({
        id: session.id,
        registerName: session.register.name,
        user: session.user.name ?? session.user.username,
        status: session.status,
        openedAt: session.openedAt.toISOString(),
        closedAt: session.closedAt?.toISOString() ?? null,
        openingAmount: session.openingAmount,
        openingAvailableAmount:
          session.openingAmount +
          getSectionTransferAmount(getSessionSection(parseSessionMeta(session.note), "opening")) +
          ((getSessionSection(parseSessionMeta(session.note), "opening").correspondentBalances as
            | Array<{ platformId: string; amount: number }>
            | undefined) ?? []
          ).reduce((sum, item) => sum + Number(item.amount || 0), 0),
        countedAmount: session.countedAmount,
        countedAvailableAmount:
          (session.countedAmount ?? 0) +
          getSectionTransferAmount(getSessionSection(parseSessionMeta(session.note), "closing")) +
          ((getSessionSection(parseSessionMeta(session.note), "closing").correspondentBalances as
            | Array<{ platformId: string; amount: number }>
            | undefined) ?? []
          ).reduce((sum, item) => sum + Number(item.amount || 0), 0),
        differenceAmount: session.differenceAmount,
      })),
    };
  });

  ipcMain.handle("cash:open", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser, APP_PERMISSION_KEYS.cashOpen)) {
      return { success: false, message: "Tu rol no puede abrir caja" };
    }
    const parsed = openCashSessionSchema.safeParse(payload);
    if (!parsed.success) return { success: false, message: "Datos invalidos para apertura de caja" };

    const existing = await prisma.cashSession.findFirst({
      where: { status: CashSessionStatus.OPEN },
    });
    if (existing) return { success: false, message: "Ya existe una caja abierta" };

    const register = await prisma.cashRegister.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });
    if (!register) return { success: false, message: "No hay caja activa configurada" };

    const openingAvailableAmount =
      parsed.data.openingCashAmount +
      parsed.data.openingTransferAmount +
      parsed.data.correspondentBalances.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const meta = stringifySessionMeta({
      opening: {
        cashBreakdown: parsed.data.cashBreakdown,
        transferAmount: parsed.data.openingTransferAmount,
        correspondentBalances: parsed.data.correspondentBalances,
        note: parsed.data.note || null,
      },
    });

    const session = await prisma.cashSession.create({
      data: {
        registerId: register.id,
        userId: currentSessionUser.id,
        status: CashSessionStatus.OPEN,
        openingAmount: parsed.data.openingCashAmount,
        expectedAmount: openingAvailableAmount,
        note: meta,
      },
    });

    await prisma.cashMovement.create({
      data: {
        sessionId: session.id,
        type: CashMovementType.OPENING,
        amount: parsed.data.openingCashAmount,
        note: parsed.data.note || "Apertura de caja",
      },
    });

    return { success: true, sessionId: session.id };
  });

  ipcMain.handle("cash:close", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser, APP_PERMISSION_KEYS.cashClose)) {
      return { success: false, message: "Tu rol no puede cerrar caja" };
    }
    const parsed = closeCashSessionSchema.safeParse(payload);
    if (!parsed.success) return { success: false, message: "Datos invalidos para cierre de caja" };

    const session = await prisma.cashSession.findUnique({
      where: { id: parsed.data.sessionId },
      include: {
        sales: {
          include: {
            payments: {
              select: {
                method: true,
                amount: true,
              },
            },
          },
        },
        movements: true,
        correspondentTransactions: {
          where: { status: "REGISTERED" },
          include: {
            platform: { select: { id: true, name: true } },
            type: { select: { name: true, direction: true } },
          },
        },
      },
    });

    if (!session || session.status !== CashSessionStatus.OPEN) {
      return { success: false, message: "La caja seleccionada no está abierta" };
    }

    const platforms = await prisma.correspondentPlatform.findMany({
      orderBy: { name: "asc" },
    });
    const treasury = buildSessionTreasurySnapshot({
      session,
      platforms,
    });
    const expectedCash = treasury.expectedCash;
    const cashDifferenceAmount = parsed.data.countedCashAmount - expectedCash;
    const countedCorrespondentTotal = treasury.correspondentByPlatform.reduce((sum, item) => {
      const counted = parsed.data.correspondentBalances.find((entry) => entry.platformId === item.platformId)?.amount;
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
        note: parsed.data.note || null,
      },
    });

    await prisma.$transaction(async (tx) => {
      await tx.cashSession.update({
        where: { id: session.id },
        data: {
          status: CashSessionStatus.CLOSED,
          countedAmount: parsed.data.countedCashAmount,
          expectedAmount: expectedAvailableAmount,
          differenceAmount,
          note: updatedMeta,
          closedAt: new Date(),
        },
      });

      await tx.cashMovement.create({
        data: {
          sessionId: session.id,
          type: CashMovementType.CLOSING,
          amount: parsed.data.countedCashAmount,
          note: parsed.data.note || "Cierre de caja",
        },
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
              sourceType: "MANUAL",
            }),
          },
        });
      }
    });

    return { success: true };
  });

  ipcMain.handle("users:list", async () => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion", users: [] };

    const users = await prisma.user.findMany({
      orderBy: [{ role: "asc" }, { username: "asc" }],
      include: {
        roleProfile: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            sales: true,
            cashSessions: true,
          },
        },
      },
    });

    return {
      success: true,
      users: users.map((user) => ({
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
        birthDate: user.birthDate?.toISOString().slice(0, 10) ?? null,
        role: user.role,
        roleProfileId: user.roleProfile?.id ?? null,
        roleProfileName: user.roleProfile?.name ?? null,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
        salesCount: user._count.sales,
        sessionsCount: user._count.cashSessions,
      })),
    };
  });

  ipcMain.handle("products:categories:list", async () => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) {
      return { success: false, message: "Debes iniciar sesion", categories: [] };
    }

    const categories = await prisma.productCategory.findMany({
      orderBy: { name: "asc" },
      include: {
        subcategories: {
          where: { isActive: true },
          orderBy: { name: "asc" },
        },
      },
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
          isActive: subcategory.isActive,
        })),
      })),
    };
  });

  ipcMain.handle("products:list-admin", async () => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) {
      return { success: false, message: "Debes iniciar sesion", products: [] };
    }

    const products = await prisma.product.findMany({
      include: {
        category: true,
        subcategory: true,
      },
      orderBy: { name: "asc" },
    });
    const productIds = products.map((product) => product.id);
    const createdByMap = await getAuditUserMap(prisma, "Product", productIds, "create");
    const updatedByMap = await getAuditUserMap(prisma, "Product", productIds, "update", true);

    return {
      success: true,
      products: products.map((product) => ({
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
        categoryName: product.category?.name ?? null,
        subcategoryName: product.subcategory?.name ?? null,
        isActive: product.isActive,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
        createdBy: createdByMap.get(product.id) ?? null,
        updatedBy: updatedByMap.get(product.id) ?? createdByMap.get(product.id) ?? null,
      })),
    };
  });

  ipcMain.handle("products:create", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser, APP_PERMISSION_KEYS.productsCreate)) {
      return { success: false, message: "Tu rol no puede crear productos" };
    }
    const parsed = createProductSchema.safeParse(payload);
    if (!parsed.success) return { success: false, message: "Datos invalidos para el producto" };

    const data = parsed.data;
    const category = data.categoryId
      ? await prisma.productCategory.findUnique({ where: { id: data.categoryId } })
      : null;
    const sku = data.sku?.trim() || (await generateSku(prisma, data.name, category?.name));

    try {
      const product = await prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            name: data.name,
            sku,
            barcode: data.barcode || null,
            unitMeasure: data.unitMeasure ?? "UNIDAD",
            price: money(data.price),
            cost: money(data.cost ?? 0),
            marginPercent: data.marginPercent ?? 0,
            hasTax: data.hasTax ?? false,
            taxRate: data.hasTax ? data.taxRate ?? 0 : 0,
            stock: data.stock ?? 0,
            categoryId: data.categoryId ?? null,
            subcategoryId: data.subcategoryId ?? null,
            isActive: data.isActive ?? true,
          },
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
              note: `Stock inicial registrado por ${actorLabel(currentSessionUser)}`,
            },
          });
        }

        return created;
      });

      await logAudit(prisma, currentSessionUser, "products", "create", "Product", product.id, undefined, {
        name: product.name,
        sku: product.sku,
      });

      return { success: true, productId: product.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear el producto";
      return { success: false, message };
    }
  });

  ipcMain.handle("products:update", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser, APP_PERMISSION_KEYS.productsEdit)) {
      return { success: false, message: "Tu rol no puede editar productos" };
    }
    const parsed = updateProductSchema.safeParse(payload);
    if (!parsed.success) return { success: false, message: "Datos invalidos para actualizar el producto" };

    const current = await prisma.product.findUnique({ where: { id: parsed.data.id } });
    if (!current) return { success: false, message: "Producto no encontrado" };

    try {
      await prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { id: parsed.data.id },
          data: {
            name: parsed.data.name ?? current.name,
            sku: parsed.data.sku ?? current.sku,
            barcode: parsed.data.barcode === undefined ? current.barcode : parsed.data.barcode,
            unitMeasure: parsed.data.unitMeasure ?? current.unitMeasure,
            price: parsed.data.price === undefined ? current.price : money(parsed.data.price),
            cost: parsed.data.cost === undefined ? current.cost : money(parsed.data.cost),
            marginPercent: parsed.data.marginPercent ?? current.marginPercent,
            hasTax: parsed.data.hasTax ?? current.hasTax,
            taxRate: parsed.data.hasTax === false ? 0 : parsed.data.taxRate ?? current.taxRate,
            stock: parsed.data.stock ?? current.stock,
            categoryId:
              parsed.data.categoryId === undefined ? current.categoryId : parsed.data.categoryId,
            subcategoryId:
              parsed.data.subcategoryId === undefined ? current.subcategoryId : parsed.data.subcategoryId,
            isActive: parsed.data.isActive ?? current.isActive,
          },
        });

        if (parsed.data.stock !== undefined && parsed.data.stock !== current.stock) {
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
              note: `Ajuste manual por ${actorLabel(currentSessionUser)}`,
            },
          });
        }
      });

      await logAudit(prisma, currentSessionUser, "products", "update", "Product", current.id, current, parsed.data);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar el producto";
      return { success: false, message };
    }
  });

  ipcMain.handle("products:delete", async (_event, payload) => {
    const currentSessionUser = await ensureAdminSession(getCurrentSessionUser);
    if (!hasSessionPermission(currentSessionUser, APP_PERMISSION_KEYS.productsDelete)) {
      return { success: false, message: "Tu rol no puede archivar productos" };
    }
    const parsed = deleteByIdSchema.safeParse(payload);
    if (!parsed.success) return { success: false, message: "Producto invalido" };

    const current = await prisma.product.findUnique({ where: { id: parsed.data.id } });
    if (!current) return { success: false, message: "Producto no encontrado" };

    await prisma.product.update({
      where: { id: parsed.data.id },
      data: { isActive: false },
    });

    await logAudit(prisma, currentSessionUser, "products", "archive", "Product", current.id, current, {
      isActive: false,
    });

    return { success: true };
  });

  ipcMain.handle("products:category:create", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser, APP_PERMISSION_KEYS.productsEdit)) {
      return { success: false, message: "Tu rol no puede administrar categorias" };
    }
    const parsed = createCategorySchema.safeParse(payload);
    if (!parsed.success) return { success: false, message: "Categoria invalida" };

    try {
      await prisma.productCategory.create({
        data: { name: parsed.data.name, isActive: true },
      });
      return { success: true };
    } catch {
      return { success: false, message: "La categoria ya existe" };
    }
  });

  ipcMain.handle("products:category:delete", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser, APP_PERMISSION_KEYS.productsEdit)) {
      return { success: false, message: "Tu rol no puede administrar categorias" };
    }
    const parsed = deleteByIdSchema.safeParse(payload);
    if (!parsed.success) return { success: false, message: "Categoria invalida" };

    await prisma.productCategory.delete({
      where: { id: parsed.data.id },
    });
    return { success: true };
  });

  ipcMain.handle("products:subcategory:create", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser, APP_PERMISSION_KEYS.productsEdit)) {
      return { success: false, message: "Tu rol no puede administrar subcategorias" };
    }
    const parsed = createSubcategorySchema.safeParse(payload);
    if (!parsed.success) return { success: false, message: "Subcategoria invalida" };

    try {
      await prisma.productSubcategory.create({
        data: {
          categoryId: parsed.data.categoryId,
          name: parsed.data.name,
          isActive: true,
        },
      });
      return { success: true };
    } catch {
      return { success: false, message: "La subcategoria ya existe en esa categoria" };
    }
  });

  ipcMain.handle("products:subcategory:delete", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser, APP_PERMISSION_KEYS.productsEdit)) {
      return { success: false, message: "Tu rol no puede administrar subcategorias" };
    }
    const parsed = deleteByIdSchema.safeParse(payload);
    if (!parsed.success) return { success: false, message: "Subcategoria invalida" };

    await prisma.productSubcategory.delete({
      where: { id: parsed.data.id },
    });
    return { success: true };
  });

  ipcMain.handle("customers:list", async () => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion", customers: [] };

    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { sales: true, credits: true },
        },
      },
    });
    const customerIds = customers.map((customer) => customer.id);
    const createdByMap = await getAuditUserMap(prisma, "Customer", customerIds, "create");

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
        createdBy: createdByMap.get(customer.id) ?? null,
      })),
    };
  });

  ipcMain.handle("customers:sales-history", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion", sales: [] };
    if (!hasSessionPermission(currentSessionUser, APP_PERMISSION_KEYS.salesHistory)) {
      return { success: false, message: "Tu rol no puede ver facturas del POS", sales: [] };
    }

    const parsed = deleteByIdSchema.safeParse(payload);
    if (!parsed.success) return { success: false, message: "Cliente invalido", sales: [] };

    const sales = await prisma.sale.findMany({
      where: { customerId: parsed.data.id },
      include: {
        cashier: {
          select: { username: true, name: true },
        },
        items: {
          select: { qty: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return {
      success: true,
      sales: sales.map((sale) => ({
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        total: sale.total,
        status: sale.status,
        paymentMethod: sale.paymentMethod,
        createdAt: sale.createdAt.toISOString(),
        cashier: buildCashierDisplayName(sale.cashier),
        itemsCount: sale.items.reduce((sum, item) => sum + item.qty, 0),
      })),
    };
  });

  ipcMain.handle("customers:create", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser, APP_PERMISSION_KEYS.customersCreate)) {
      return { success: false, message: "Tu rol no puede crear clientes" };
    }

    const parsed = createCustomerSchema.safeParse(payload);
    if (!parsed.success) return { success: false, message: "Datos invalidos para el cliente" };

    try {
      const existingInternalCodes = (
        await prisma.customer.findMany({
          select: { internalCode: true },
        })
      ).map((customer) => customer.internalCode);
      const internalCode = resolveManagedCode({
        desiredCode: null,
        existingCodes: existingInternalCodes,
        prefix: "CLI",
        digits: 4,
        maxLength: 30,
      });

      const customer = await prisma.customer.create({
        data: {
          internalCode,
          name: buildFullName(parsed.data.firstName, parsed.data.lastName),
          document: buildDocumentValue(parsed.data.documentType, parsed.data.documentNumber),
          phone: parsed.data.phone || null,
          email: parsed.data.email || null,
          address: parsed.data.address || null,
          creditLimit: 0,
          notes: null,
          isActive: true,
        },
      });

      await logAudit(prisma, currentSessionUser, "customers", "create", "Customer", customer.id, undefined, {
        name: customer.name,
        document: customer.document,
      });

      return { success: true, customerId: customer.id };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo crear el cliente. Verifica documento o correo duplicado.";
      return { success: false, message };
    }
  });

  ipcMain.handle("customers:update", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser, APP_PERMISSION_KEYS.customersEdit)) {
      return { success: false, message: "Tu rol no puede editar clientes" };
    }
    const parsed = updateCustomerSchema.safeParse(payload);
    if (!parsed.success) return { success: false, message: "Datos invalidos para actualizar el cliente" };

    const current = await prisma.customer.findUnique({ where: { id: parsed.data.id } });
    if (!current) return { success: false, message: "Cliente no encontrado" };

    try {
      const existingInternalCodes = (
        await prisma.customer.findMany({
          where: { NOT: { id: current.id } },
          select: { internalCode: true },
        })
      ).map((customer) => customer.internalCode);
      const internalCode = resolveManagedCode({
        desiredCode: current.internalCode,
        existingCodes: existingInternalCodes,
        prefix: "CLI",
        digits: 4,
        maxLength: 30,
      });

      const nextData = {
        internalCode,
        name: buildFullName(parsed.data.firstName, parsed.data.lastName),
        document: buildDocumentValue(parsed.data.documentType, parsed.data.documentNumber),
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        address: parsed.data.address || null,
        isActive: parsed.data.isActive ?? current.isActive,
      };

      await prisma.customer.update({
        where: { id: current.id },
        data: {
          ...nextData,
          creditLimit: 0,
          notes: null,
        },
      });

      await logAudit(prisma, currentSessionUser, "customers", "update", "Customer", current.id, current, nextData);
      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el cliente. Verifica documento o correo duplicado.";
      return { success: false, message };
    }
  });

  ipcMain.handle("suppliers:list", async () => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion", suppliers: [] };

    const suppliers = await prisma.supplier.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { purchases: true },
        },
      },
    });
    const supplierIds = suppliers.map((supplier) => supplier.id);
    const createdByMap = await getAuditUserMap(prisma, "Supplier", supplierIds, "create");

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
        createdBy: createdByMap.get(supplier.id) ?? null,
      })),
    };
  });

  ipcMain.handle("suppliers:create", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser, APP_PERMISSION_KEYS.suppliersCreate)) {
      return { success: false, message: "Tu rol no puede crear proveedores" };
    }
    const parsed = createSupplierSchema.safeParse(payload);
    if (!parsed.success) return { success: false, message: "Datos invalidos para el proveedor" };

    try {
      const existingInternalCodes = (
        await prisma.supplier.findMany({
          select: { internalCode: true },
        })
      ).map((supplier) => supplier.internalCode);
      const internalCode = resolveManagedCode({
        desiredCode: null,
        existingCodes: existingInternalCodes,
        prefix: "PRV",
        digits: 4,
        maxLength: 30,
      });

      const supplier = await prisma.supplier.create({
        data: {
          internalCode,
          name: parsed.data.name,
          taxId: buildDocumentValue(parsed.data.documentType, parsed.data.documentNumber),
          phone: parsed.data.phone || null,
          email: parsed.data.email || null,
          address: parsed.data.address || null,
          contactName: parsed.data.contactName || null,
          isActive: true,
        },
      });

      await logAudit(prisma, currentSessionUser, "suppliers", "create", "Supplier", supplier.id, undefined, {
        name: supplier.name,
        taxId: supplier.taxId,
      });

      return { success: true, supplierId: supplier.id };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo crear el proveedor. Verifica documento o correo duplicado.";
      return { success: false, message };
    }
  });

  ipcMain.handle("suppliers:update", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser, APP_PERMISSION_KEYS.suppliersEdit)) {
      return { success: false, message: "Tu rol no puede editar proveedores" };
    }
    const parsed = updateSupplierSchema.safeParse(payload);
    if (!parsed.success) return { success: false, message: "Datos invalidos para actualizar el proveedor" };

    const current = await prisma.supplier.findUnique({ where: { id: parsed.data.id } });
    if (!current) return { success: false, message: "Proveedor no encontrado" };

    try {
      const existingInternalCodes = (
        await prisma.supplier.findMany({
          where: { NOT: { id: current.id } },
          select: { internalCode: true },
        })
      ).map((supplier) => supplier.internalCode);
      const internalCode = resolveManagedCode({
        desiredCode: current.internalCode,
        existingCodes: existingInternalCodes,
        prefix: "PRV",
        digits: 4,
        maxLength: 30,
      });

      const nextData = {
        internalCode,
        name: parsed.data.name,
        taxId: buildDocumentValue(parsed.data.documentType, parsed.data.documentNumber),
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        address: parsed.data.address || null,
        contactName: parsed.data.contactName || null,
        isActive: parsed.data.isActive ?? current.isActive,
      };

      await prisma.supplier.update({
        where: { id: current.id },
        data: nextData,
      });

      await logAudit(prisma, currentSessionUser, "suppliers", "update", "Supplier", current.id, current, nextData);
      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el proveedor. Verifica documento o correo duplicado.";
      return { success: false, message };
    }
  });

  ipcMain.handle("purchases:list", async () => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion", purchases: [] };

    const purchases = await prisma.purchase.findMany({
      include: {
        supplier: {
          select: { name: true },
        },
        items: {
          select: { qty: true },
        },
      },
      orderBy: { purchasedAt: "desc" },
      take: 200,
    });
    const purchaseIds = purchases.map((purchase) => purchase.id);
    const createdByMap = await getAuditUserMap(prisma, "Purchase", purchaseIds, "create");

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
        createdBy: createdByMap.get(purchase.id) ?? null,
      })),
    };
  });

  ipcMain.handle("purchases:get-detail", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser, APP_PERMISSION_KEYS.purchasesDetails)) {
      return { success: false, message: "Tu rol no puede ver el detalle de compras" };
    }

    const parsed = deleteByIdSchema.safeParse(payload);
    if (!parsed.success) return { success: false, message: "Compra invalida" };

    const purchase = await prisma.purchase.findUnique({
      where: { id: parsed.data.id },
      include: {
        supplier: true,
        items: {
          include: {
            product: {
              select: { name: true, sku: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!purchase) return { success: false, message: "Compra no encontrada" };

    const createdByMap = await getAuditUserMap(prisma, "Purchase", [purchase.id], "create");

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
          total: item.subtotal + money(item.subtotal * item.taxRate),
        })),
      },
    };
  });

  ipcMain.handle("purchases:create", async (_event, payload) => {
    const currentSessionUser = await ensureAdminSession(getCurrentSessionUser);
    if (!hasSessionPermission(currentSessionUser, APP_PERMISSION_KEYS.purchasesCreate)) {
      return { success: false, message: "Tu rol no puede registrar compras" };
    }
    const parsed = createPurchaseSchema.safeParse(payload);
    if (!parsed.success) return { success: false, message: "Datos invalidos para la compra" };

    const supplier = await prisma.supplier.findUnique({ where: { id: parsed.data.supplierId } });
    if (!supplier) return { success: false, message: "Proveedor no encontrado" };

    const productIds = parsed.data.items.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
      },
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

      const subtotal = money(item.cost * item.qty);
      const tax = money(subtotal * (item.taxRate ?? 0));

      return {
        product,
        qty: item.qty,
        cost: money(item.cost),
        taxRate: item.taxRate ?? 0,
        subtotal,
        tax,
        total: subtotal + tax,
      };
    });

    const subtotal = normalizedItems.reduce((sum, item) => sum + item.subtotal, 0);
    const tax = normalizedItems.reduce((sum, item) => sum + item.tax, 0);
    const total = subtotal + tax;
    const purchasedAt = parsed.data.purchasedAt ? new Date(parsed.data.purchasedAt) : new Date();
    const status = parsed.data.markAsPaid ? PurchaseStatus.PAID : PurchaseStatus.RECEIVED;
    const balance = parsed.data.markAsPaid ? 0 : total;
    const paymentMedium = normalizeTreasuryMedium(parsed.data.paymentMedium);
    const paymentPlatform =
      paymentMedium === "CORRESPONDENT" && parsed.data.paymentPlatformId
        ? await prisma.correspondentPlatform.findUnique({
            where: { id: parsed.data.paymentPlatformId },
            select: { id: true, name: true },
          })
        : null;

    if (paymentMedium === "CORRESPONDENT" && !paymentPlatform) {
      return { success: false, message: "Selecciona un corresponsal valido para pagar la compra" };
    }

    const activeSession = parsed.data.markAsPaid
      ? await prisma.cashSession.findFirst({
          where: { status: CashSessionStatus.OPEN },
          orderBy: { openedAt: "desc" },
        })
      : null;

    if (parsed.data.markAsPaid && !activeSession) {
      return { success: false, message: "Abre el control diario antes de registrar compras pagadas" };
    }

    try {
      const purchase = await prisma.$transaction(async (tx) => {
        const number = await generatePurchaseNumber(tx as PrismaClient);
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
                subtotal: item.subtotal,
              })),
            },
          },
        });

        for (const item of normalizedItems) {
          const nextStock = item.product.stock + item.qty;
          const weightedCost =
            nextStock <= 0
              ? item.cost
              : money(((item.product.stock * item.product.cost) + item.subtotal) / nextStock);
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
              price: nextPrice,
            },
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
              note: `${createdPurchase.number} - ${supplier.name} - registrado por ${actorLabel(currentSessionUser)}`,
            },
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
                platformId: paymentPlatform?.id ?? null,
                platformName: paymentPlatform?.name ?? null,
                sourceType: "PURCHASE",
                userNote: parsed.data.note || null,
              }),
            },
          });
        }

        return createdPurchase;
      });

      await logAudit(prisma, currentSessionUser, "purchases", "create", "Purchase", purchase.id, undefined, {
        number: purchase.number,
        supplier: supplier.name,
        total: purchase.total,
        markAsPaid: parsed.data.markAsPaid,
        paymentMedium,
        paymentPlatform: paymentPlatform?.name ?? null,
      });

      return { success: true, purchaseId: purchase.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo registrar la compra";
      return { success: false, message };
    }
  });

  ipcMain.handle("inventory:list", async () => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion", moves: [] };

    const moves = await prisma.inventoryMovement.findMany({
      include: {
        product: {
          select: { id: true, name: true, sku: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
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
        createdAt: move.createdAt.toISOString(),
      })),
    };
  });

  ipcMain.handle("sales:list", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion", sales: [] };

    const parsed = salesListFilterSchema.safeParse(payload);
    if (!parsed.success) return { success: false, message: "Filtros invalidos", sales: [] };

    const filters = parsed.data;
    const query = filters.search?.trim();

    const sales = await prisma.sale.findMany({
      where: {
        createdAt:
          filters.dateFrom || filters.dateTo
            ? {
                ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
                ...(filters.dateTo ? { lt: new Date(filters.dateTo) } : {}),
              }
            : undefined,
        cashierId: filters.cashierId,
        status: filters.status,
        OR: query
          ? [
              { invoiceNumber: { contains: query } },
              { customer: { contains: query } },
            ]
          : undefined,
      },
      include: {
        cashier: {
          select: { username: true, name: true },
        },
        items: {
          select: { qty: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
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
        cashier: buildCashierDisplayName(sale.cashier),
        itemsCount: sale.items.reduce((sum, item) => sum + item.qty, 0),
      })),
    };
  });

  ipcMain.handle("sales:get-detail", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion" };

    const parsed = salePrintSchema.safeParse(payload);
    if (!parsed.success) return { success: false, message: "Venta invalida" };

    const sale = await prisma.sale.findUnique({
      where: { id: parsed.data.saleId },
      include: {
        cashier: {
          select: { username: true, name: true },
        },
        items: {
          orderBy: { createdAt: "asc" },
        },
        payments: true,
      },
    });

    if (!sale) return { success: false, message: "Venta no encontrada" };

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
        cashier: buildCashierDisplayName(sale.cashier),
        items: sale.items.map((item) => ({
          id: item.id,
          name: item.name,
          qty: item.qty,
          price: item.price,
          taxRate: item.taxRate,
          lineSubtotal: item.lineSubtotal,
          lineTax: item.lineTax,
          lineTotal: item.lineTotal,
        })),
        payments: sale.payments.map((payment) => ({
          id: payment.id,
          method: payment.method,
          amount: payment.amount,
          reference: payment.reference,
        })),
      },
    };
  });

  ipcMain.handle("sales:print-invoice", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser, APP_PERMISSION_KEYS.salesPrint)) {
      return { success: false, message: "Tu rol no puede imprimir facturas" };
    }

    const parsed = salePrintSchema.safeParse(payload);
    if (!parsed.success) return { success: false, message: "Venta invalida" };

    const [sale, settings] = await Promise.all([
      prisma.sale.findUnique({
        where: { id: parsed.data.saleId },
        include: {
          cashier: { select: { username: true, name: true } },
          items: { orderBy: { createdAt: "asc" } },
          payments: true,
        },
      }),
      prisma.businessSettings.findUnique({
        where: { id: "default" },
      }),
    ]);

    if (!sale) return { success: false, message: "Venta no encontrada" };
    const addressParts = splitBusinessAddress(settings?.address);

    const html = buildInvoiceHtmlForTemplate({
      businessName: settings?.businessName,
      taxId: settings?.taxId,
      address: addressParts.address,
      city: addressParts.city,
      receiptFooter: settings?.receiptFooter,
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
        lineTotal: item.lineTotal,
      })),
    }, parsed.data.template);

    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: false,
      },
    });

    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    return await new Promise<{ success: boolean; message?: string }>((resolve) => {
      printWindow.webContents.print(
        {
          silent: false,
          printBackground: true,
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

  ipcMain.handle("accounting:summary", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser, APP_PERMISSION_KEYS.reportsView)) {
      return { success: false, message: "Tu rol no puede consultar contabilidad" };
    }

    const parsed = accountingRangeSchema.safeParse(payload);
    if (!parsed.success) return { success: false, message: "Filtros invalidos" };

    const createdAt = buildDateRangeFilter(parsed.data.dateFrom, parsed.data.dateTo);

    const [customers, sales, credits, payments, creditNotes, expenses] = await Promise.all([
      prisma.customer.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          internalCode: true,
          name: true,
          document: true,
          phone: true,
        },
      }),
      prisma.sale.findMany({
        where: {
          ...(createdAt ? { createdAt } : {}),
          status: { not: SaleStatus.CANCELLED },
        },
        include: {
          customerRef: {
            select: {
              id: true,
              name: true,
            },
          },
          credits: {
            orderBy: { createdAt: "desc" },
          },
          returns: true,
          payments: {
            orderBy: { createdAt: "asc" },
            select: {
              method: true,
              amount: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 150,
      }),
      prisma.customerCredit.findMany({
        where: createdAt ? { createdAt } : undefined,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
            },
          },
          sale: {
            select: {
              id: true,
              invoiceNumber: true,
            },
          },
          payments: {
            select: {
              amount: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 150,
      }),
      prisma.customerPayment.findMany({
        where: createdAt ? { createdAt } : undefined,
        include: {
          customer: {
            select: {
              name: true,
            },
          },
          credit: {
            select: {
              id: true,
              sale: {
                select: {
                  id: true,
                  invoiceNumber: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 150,
      }),
      prisma.saleReturn.findMany({
        where: createdAt ? { createdAt } : undefined,
        include: {
          sale: {
            select: {
              id: true,
              invoiceNumber: true,
              customer: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 150,
      }),
      prisma.cashMovement.findMany({
        where: {
          ...(createdAt ? { createdAt } : {}),
          type: { in: [CashMovementType.EXPENSE_OUT, CashMovementType.WITHDRAWAL_OUT] },
        },
        include: {
          session: {
            include: {
              register: {
                select: { name: true },
              },
              user: {
                select: { username: true, name: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 150,
      }),
    ]);

    const mappedCredits = credits.map((credit) => {
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
        dueDate: credit.dueDate?.toISOString() ?? null,
        createdAt: credit.createdAt.toISOString(),
      };
    });

    const mappedSales = sales.map((sale) => {
      const returnedTotal = sale.returns.reduce((sum, entry) => sum + entry.total, 0);
      const credit = sale.credits[0] ?? null;
      const paidAtSale = sale.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const netSaleTotal = Math.max(sale.total - returnedTotal, 0);
      const pendingAmount = credit ? credit.balance : Math.max(netSaleTotal - paidAtSale, 0);
      const collectionStatus =
        returnedTotal >= sale.total
          ? "RETURNED"
          : pendingAmount <= 0
            ? "PAID"
            : paidAtSale > 0
              ? "PARTIAL"
              : "PENDING";
      const paymentSummary = sale.payments.length
        ? sale.payments
            .map((payment) => `${paymentMethodLabel(payment.method)} $${payment.amount.toLocaleString("es-CO")}`)
            .join(" + ")
        : credit
          ? "Pendiente por cartera"
          : paymentMethodLabel(sale.paymentMethod);

      return {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        customer: sale.customer,
        customerId: sale.customerRef?.id ?? null,
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
        credit: credit
          ? {
              id: credit.id,
              total: credit.total,
              balance: credit.balance,
              status: deriveCreditStatus(credit.balance, credit.total, credit.dueDate),
              dueDate: credit.dueDate?.toISOString() ?? null,
            }
          : null,
      };
    });

    const paymentSummaryMap = new Map<PaymentMethod, { salesAmount: number; collectionsAmount: number }>();
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
        category: "SALE" as const,
        title: `Venta ${sale.invoiceNumber}`,
        detail: `${sale.customer} | cobrado al momento $${sale.paidAtSale.toLocaleString("es-CO")} | pendiente $${sale.pendingAmount.toLocaleString("es-CO")}`,
        medium: sale.paymentSummary,
        amount: sale.total,
        direction: "IN" as const,
        reference: sale.invoiceNumber,
        operationalImpact: sale.paidAtSale,
      })),
      ...payments.map((payment) => ({
        id: `collection-${payment.id}`,
        createdAt: payment.createdAt.toISOString(),
        category: "COLLECTION" as const,
        title: `Abono cartera ${payment.credit?.sale.invoiceNumber ?? ""}`.trim(),
        detail: `${payment.customer.name} | ${payment.note || "Sin detalle"}`,
        medium: paymentMethodLabel(payment.method),
        amount: payment.amount,
        direction: "IN" as const,
        reference: payment.credit?.sale.invoiceNumber ?? null,
        operationalImpact: payment.amount,
      })),
      ...creditNotes.map((note) => ({
        id: `credit-note-${note.id}`,
        createdAt: note.createdAt.toISOString(),
        category: "CREDIT_NOTE" as const,
        title: `Nota credito ${note.sale.invoiceNumber}`,
        detail: `${note.sale.customer} | ${note.reason || "Ajuste sobre venta"}`,
        medium: "Ajuste comercial",
        amount: note.total,
        direction: "OUT" as const,
        reference: note.sale.invoiceNumber,
        operationalImpact: -note.total,
      })),
      ...expenses.map((expense) => ({
        id: `expense-${expense.id}`,
        createdAt: expense.createdAt.toISOString(),
        category: "EXPENSE" as const,
        title: expense.type === CashMovementType.WITHDRAWAL_OUT ? "Retiro operativo" : "Gasto operativo",
        detail: resolveMovementLabel(expense.note),
        medium:
          parseTreasuryMovementMeta(expense.note)?.medium === "CORRESPONDENT"
            ? parseTreasuryMovementMeta(expense.note)?.platformName || "Corresponsal"
            : parseTreasuryMovementMeta(expense.note)?.medium === "TRANSFER"
              ? "Transferencias"
              : "Efectivo",
        amount: expense.amount,
        direction: "OUT" as const,
        reference: null,
        operationalImpact: -expense.amount,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 250);

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
        averageTicket: mappedSales.length > 0 ? money(mappedSales.reduce((sum, sale) => sum + sale.total, 0) / mappedSales.length) : 0,
        netOperationalBalance:
          collectedSalesTotal +
          collectionsTotal -
          creditNotes.reduce((sum, note) => sum + note.total, 0) -
          expenses.reduce((sum, expense) => sum + expense.amount, 0),
      },
      customers: customers.map((customer) => ({
        id: customer.id,
        internalCode: customer.internalCode,
        name: customer.name,
        document: customer.document,
        phone: customer.phone,
      })),
      paymentSummary: [...paymentSummaryMap.entries()].map(([method, totals]) => ({
        method,
        label: paymentMethodLabel(method),
        salesAmount: totals.salesAmount,
        collectionsAmount: totals.collectionsAmount,
        totalAmount: totals.salesAmount + totals.collectionsAmount,
      })),
      movementHistory,
      sales: mappedSales,
      credits: mappedCredits,
      payments: payments.map((payment) => ({
        id: payment.id,
        creditId: payment.creditId,
        saleId: payment.credit?.sale.id ?? null,
        invoiceNumber: payment.credit?.sale.invoiceNumber ?? null,
        customerName: payment.customer.name,
        method: payment.method,
        amount: payment.amount,
        note: payment.note,
        createdAt: payment.createdAt.toISOString(),
      })),
      creditNotes: creditNotes.map((note) => ({
        id: note.id,
        saleId: note.saleId,
        invoiceNumber: note.sale.invoiceNumber,
        customerName: note.sale.customer,
        total: note.total,
        reason: note.reason,
        createdAt: note.createdAt.toISOString(),
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
          sourceMedium: meta?.medium ?? "CASH",
          sourcePlatform: meta?.platformName ?? null,
          createdAt: expense.createdAt.toISOString(),
        };
      }),
    };
  });

  ipcMain.handle("accounting:credit:create", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser, APP_PERMISSION_KEYS.reportsView)) {
      return { success: false, message: "Tu rol no puede registrar cartera" };
    }

    const parsed = createAccountingCreditSchema.safeParse(payload);
    if (!parsed.success) return { success: false, message: "Datos invalidos para la cartera" };

    const sale = await prisma.sale.findUnique({
      where: { id: parsed.data.saleId },
      include: {
        credits: true,
        returns: true,
      },
    });
    if (!sale) return { success: false, message: "La venta ya no existe" };
    if (sale.credits.length > 0) return { success: false, message: "La venta ya tiene una cuenta por cobrar asociada" };

    const customer = await prisma.customer.findUnique({
      where: { id: parsed.data.customerId },
      select: { id: true, name: true, isActive: true },
    });
    if (!customer || !customer.isActive) {
      return { success: false, message: "Selecciona un cliente activo para crear la cuenta por cobrar" };
    }

    const returnedTotal = sale.returns.reduce((sum, entry) => sum + entry.total, 0);
    const availableTotal = Math.max(sale.total - returnedTotal, 0);
    const total = parsed.data.total ?? availableTotal;
    if (availableTotal <= 0) return { success: false, message: "La venta no tiene saldo disponible para cartera" };
    if (total > availableTotal) return { success: false, message: "El valor supera el saldo disponible de la venta" };

    try {
      const result = await prisma.$transaction(async (tx) => {
        const credit = await tx.customerCredit.create({
          data: {
            customerId: customer.id,
            saleId: sale.id,
            total,
            balance: total,
            dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
            status: deriveCreditStatus(total, total, parsed.data.dueDate ? new Date(parsed.data.dueDate) : null),
          },
        });

        await tx.sale.update({
          where: { id: sale.id },
          data: {
            customerId: customer.id,
            customer: customer.name,
            status: SaleStatus.CREDIT,
          },
        });

        return credit;
      });

      await logAudit(prisma, currentSessionUser, "accounting", "create", "CustomerCredit", result.id, undefined, {
        saleId: sale.id,
        customerId: customer.id,
        total,
      });

      return { success: true, creditId: result.id, message: "Cuenta por cobrar creada correctamente." };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "No se pudo crear la cuenta por cobrar" };
    }
  });

  ipcMain.handle("accounting:payment:create", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser, APP_PERMISSION_KEYS.reportsView)) {
      return { success: false, message: "Tu rol no puede registrar pagos" };
    }

    const parsed = createAccountingPaymentSchema.safeParse(payload);
    if (!parsed.success) return { success: false, message: "Datos invalidos para el abono" };

    const credit = await prisma.customerCredit.findUnique({
      where: { id: parsed.data.creditId },
      include: {
        sale: {
          include: {
            returns: true,
          },
        },
      },
    });
    if (!credit) return { success: false, message: "La cuenta por cobrar ya no existe" };
    if (credit.balance <= 0) return { success: false, message: "La cuenta por cobrar ya se encuentra saldada" };
    if (parsed.data.amount > credit.balance) return { success: false, message: "El abono supera el saldo pendiente" };

    const cashSession = await prisma.cashSession.findFirst({
      where: { status: CashSessionStatus.OPEN },
      orderBy: { openedAt: "desc" },
    });

    if (!cashSession) {
      return { success: false, message: "Abre el control diario antes de registrar abonos" };
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const payment = await tx.customerPayment.create({
          data: {
            customerId: credit.customerId,
            creditId: credit.id,
            method: parsed.data.method,
            amount: parsed.data.amount,
            note: parsed.data.note || null,
          },
        });

        const paidAmount = credit.total - credit.balance + parsed.data.amount;
        const nextBalance = Math.max(credit.total - paidAmount, 0);
        const nextStatus = deriveCreditStatus(nextBalance, credit.total, credit.dueDate);

        await tx.customerCredit.update({
          where: { id: credit.id },
          data: {
            balance: nextBalance,
            status: nextStatus,
          },
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
              userNote: parsed.data.note || null,
            }),
          },
        });

        if (nextBalance <= 0) {
          const returnedTotal = credit.sale.returns.reduce((sum, entry) => sum + entry.total, 0);
          await tx.sale.update({
            where: { id: credit.saleId },
            data: {
              status: mapSaleStatusFromReturns(credit.sale.total, returnedTotal),
            },
          });
        }

        return payment;
      });

      await logAudit(prisma, currentSessionUser, "accounting", "create", "CustomerPayment", result.id, undefined, {
        creditId: credit.id,
        amount: parsed.data.amount,
        method: parsed.data.method,
      });

      return { success: true, paymentId: result.id, message: "Abono registrado correctamente." };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "No se pudo registrar el abono" };
    }
  });

  ipcMain.handle("accounting:credit-note:create", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser, APP_PERMISSION_KEYS.reportsView)) {
      return { success: false, message: "Tu rol no puede registrar notas credito" };
    }

    const parsed = createAccountingCreditNoteSchema.safeParse(payload);
    if (!parsed.success) return { success: false, message: "Datos invalidos para la nota credito" };

    const sale = await prisma.sale.findUnique({
      where: { id: parsed.data.saleId },
      include: {
        returns: true,
        credits: true,
      },
    });
    if (!sale) return { success: false, message: "La venta ya no existe" };

    const returnedTotal = sale.returns.reduce((sum, entry) => sum + entry.total, 0);
    const availableAmount = Math.max(sale.total - returnedTotal, 0);
    if (availableAmount <= 0) return { success: false, message: "La venta no tiene saldo disponible para nota credito" };
    if (parsed.data.amount > availableAmount) return { success: false, message: "La nota credito supera el saldo disponible de la venta" };

    try {
      const result = await prisma.$transaction(async (tx) => {
        const creditNote = await tx.saleReturn.create({
          data: {
            saleId: sale.id,
            total: parsed.data.amount,
            reason: parsed.data.reason || null,
          },
        });

        const nextReturnedTotal = returnedTotal + parsed.data.amount;
        await tx.sale.update({
          where: { id: sale.id },
          data: {
            status: mapSaleStatusFromReturns(sale.total, nextReturnedTotal),
          },
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
              status: deriveCreditStatus(nextBalance, nextTotal, credit.dueDate),
            },
          });
        }

        return creditNote;
      });

      await logAudit(prisma, currentSessionUser, "accounting", "create", "SaleReturn", result.id, undefined, {
        saleId: sale.id,
        total: parsed.data.amount,
      });

      return { success: true, creditNoteId: result.id, message: "Nota credito registrada correctamente." };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "No se pudo registrar la nota credito" };
    }
  });

  ipcMain.handle("accounting:expense:create", async (_event, payload) => {
    const currentSessionUser = getCurrentSessionUser();
    if (!currentSessionUser) return { success: false, message: "Debes iniciar sesion" };
    if (!hasSessionPermission(currentSessionUser, APP_PERMISSION_KEYS.reportsView)) {
      return { success: false, message: "Tu rol no puede registrar gastos" };
    }

    const parsed = createAccountingExpenseSchema.safeParse(payload);
    if (!parsed.success) return { success: false, message: "Datos invalidos para el gasto" };

    const activeSession = await prisma.cashSession.findFirst({
      where: { status: CashSessionStatus.OPEN },
      orderBy: { openedAt: "desc" },
    });
    if (!activeSession) return { success: false, message: "Abre caja general antes de registrar gastos o retiros" };

    const sourceMedium = normalizeTreasuryMedium(parsed.data.sourceMedium);
    const sourcePlatform =
      sourceMedium === "CORRESPONDENT" && parsed.data.sourcePlatformId
        ? await prisma.correspondentPlatform.findUnique({
            where: { id: parsed.data.sourcePlatformId },
            select: { id: true, name: true },
          })
        : null;

    if (sourceMedium === "CORRESPONDENT" && !sourcePlatform) {
      return { success: false, message: "Selecciona un corresponsal valido para registrar el egreso" };
    }

    try {
      const expense = await prisma.cashMovement.create({
        data: {
          sessionId: activeSession.id,
          type: parsed.data.type as CashMovementType,
          amount: parsed.data.amount,
          note: buildTreasuryMovementNote({
            label: parsed.data.note,
            medium: sourceMedium,
            platformId: sourcePlatform?.id ?? null,
            platformName: sourcePlatform?.name ?? null,
            sourceType: "EXPENSE",
            userNote: parsed.data.note,
          }),
        },
      });

      await logAudit(prisma, currentSessionUser, "accounting", "create", "CashMovement", expense.id, undefined, {
        type: parsed.data.type,
        amount: parsed.data.amount,
        note: parsed.data.note,
        sourceMedium,
        sourcePlatform: sourcePlatform?.name ?? null,
      });

      return { success: true, expenseId: expense.id, message: "Gasto registrado correctamente." };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "No se pudo registrar el gasto" };
    }
  });
}
