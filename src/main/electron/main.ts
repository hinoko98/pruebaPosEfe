import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent, Menu } from "electron";
import bcrypt from "bcryptjs";
import "dotenv/config";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CashMovementType,
  InventoryMovementType,
  PaymentMethod as PrismaPaymentMethod,
  PrismaClient,
  Role,
} from "@prisma/client";

import { createUserInputSchema, loginInputSchema } from "./ipc/schemas/auth.schema";
import { createSaleSchema } from "./ipc/schemas/sales.schema";
import {
  ensureCorrespondentSchemaIfNeeded,
  registerCorrespondentIpcHandlers,
  seedCorrespondentCatalogIfNeeded,
} from "./modules/correspondent";
import { registerBackofficeIpcHandlers } from "./modules/backoffice";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, "..");

export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null = null;
let prisma: PrismaClient;
let appConnectedAt = new Date();
let currentSessionUser: {
  id: string;
  username: string;
  role: Role;
  name?: string;
} | null = null;

type SeedConfig = {
  enabled: boolean;
  username: string;
  name: string;
  password: string;
  bcryptRounds: number;
};

type DashboardRange = "day" | "week" | "month";

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "mascot.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
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

function getSeedConfig(): SeedConfig {
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

export async function seedAdminIfNeeded(prismaClient: PrismaClient) {
  const cfg = getSeedConfig();
  if (!cfg.enabled) return;

  const adminExists = await prismaClient.user.findFirst({ where: { role: Role.ADMIN } });
  if (adminExists) return;

  const passwordHash = await bcrypt.hash(cfg.password, cfg.bcryptRounds);

  await prismaClient.user.create({
    data: {
      username: cfg.username,
      name: cfg.name,
      role: Role.ADMIN,
      passwordHash,
      isActive: true,
    },
  });
}

async function seedCoreConfigIfNeeded(prismaClient: PrismaClient) {
  await prismaClient.businessSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      businessName: "Mi Miscelanea",
      currencyCode: "COP",
      defaultTaxRate: 0.19,
      invoicePrefix: "FV",
      lowStockThreshold: 5,
    },
  });

  await prismaClient.cashRegister.upsert({
    where: { name: "Caja principal" },
    update: {},
    create: {
      name: "Caja principal",
      branchName: "Tienda principal",
      isActive: true,
    },
  });
}

async function logLoginEvent(params: {
  userId?: string | null;
  username: string;
  success: boolean;
  reason?: string;
}) {
  try {
    await prisma.loginEvent.create({
      data: {
        userId: params.userId ?? null,
        username: params.username,
        success: params.success,
        reason: params.reason,
        occurredAt: new Date(),
        appVersion: app.getVersion(),
        osPlatform: os.platform(),
        osRelease: os.release(),
        deviceName: os.hostname(),
      },
    });
  } catch (error) {
    console.error("Error registrando login:", error);
  }
}

function money(value: number) {
  return Math.round(value);
}

function startOfRange(range: DashboardRange) {
  const now = new Date();

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

function buildInvoiceNumber(prefix: string, sequence: number) {
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
    getCurrentSessionUser: () => currentSessionUser,
  });
}

app.whenReady().then(async () => {
  const dbPath = path.join(app.getPath("userData"), "app.db").replace(/\\/g, "/");
  process.env.DATABASE_URL = `file:${dbPath}`;

  prisma = new PrismaClient();
  appConnectedAt = new Date();

  registerBackofficeIpcHandlers({
    ipcMain,
    prisma,
    getCurrentSessionUser: () => currentSessionUser,
    getConnectedAt: () => appConnectedAt,
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

ipcMain.handle("auth:login", async (_event: IpcMainInvokeEvent, payload) => {
  const parsed = loginInputSchema.safeParse(payload);

  if (!parsed.success) {
    await logLoginEvent({
      username: String(payload?.username ?? ""),
      success: false,
      reason: "invalid_payload",
    });
    return { success: false, message: "Datos invalidos" };
  }

  const { username, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { username },
  });

  if (!user || !user.isActive) {
    await logLoginEvent({
      username,
      success: false,
      reason: "user_not_found_or_inactive",
    });
    return { success: false, message: "Usuario o contrasena incorrectos" };
  }

  const match = await bcrypt.compare(password, user.passwordHash);

  if (!match) {
    await logLoginEvent({
      userId: user.id,
      username,
      success: false,
      reason: "wrong_password",
    });
    return { success: false, message: "Usuario o contrasena incorrectos" };
  }

  await logLoginEvent({
    userId: user.id,
    username,
    success: true,
  });

  currentSessionUser = {
    id: user.id,
    username: user.username,
    name: user.name ?? undefined,
    role: user.role,
  };

  return {
    success: true,
    user: currentSessionUser,
  };
});

ipcMain.handle("auth:createUser", async (_event: IpcMainInvokeEvent, payload) => {
  const parsed = createUserInputSchema.safeParse(payload);
  if (!parsed.success) return { success: false, message: "Datos invalidos" };

  if (!currentSessionUser || currentSessionUser.role !== Role.ADMIN) {
    return { success: false, message: "Solo admins pueden crear usuarios" };
  }

  const { newUsername, newPassword, name, role } = parsed.data;
  const passwordHash = await bcrypt.hash(newPassword, 10);

  try {
    await prisma.user.create({
      data: {
        username: newUsername,
        name: name?.trim() || null,
        passwordHash,
        role: role ?? Role.EMPLOYEE,
      },
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
      subcategory: true,
    },
    orderBy: { name: "asc" },
  });

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    price: product.price,
    cost: product.cost,
    taxRate: product.taxRate,
    stock: product.stock,
    category: product.category?.name ?? null,
    subcategory: product.subcategory?.name ?? null,
  }));
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
      isActive: true,
    },
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
      lineProfit,
    };
  });

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineSubtotal, 0);
  const tax = normalizedItems.reduce((sum, item) => sum + item.lineTax, 0);
  const total = subtotal + tax;
  const costTotal = normalizedItems.reduce((sum, item) => sum + item.product.cost * item.qty, 0);
  const profit = normalizedItems.reduce((sum, item) => sum + item.lineProfit, 0);
  const amountPaid = parsed.data.amountPaid ?? total;
  const changeAmount = parsed.data.paymentMethod === "CASH" ? Math.max(0, amountPaid - total) : 0;

  if (parsed.data.clientTotal !== undefined && Math.abs(parsed.data.clientTotal - total) > 1) {
    return { success: false, message: "El total enviado no coincide con el calculo del sistema" };
  }

  if (parsed.data.paymentMethod === "CASH" && amountPaid < total) {
    return { success: false, message: "El efectivo recibido no alcanza para cubrir la venta" };
  }

  try {
    const sale = await prisma.$transaction(async (tx) => {
      const nextSequence = (await tx.sale.count()) + 1;
      const businessSettings = await tx.businessSettings.findUnique({
        where: { id: "default" },
        select: { invoicePrefix: true },
      });
      const invoiceNumber = buildInvoiceNumber(businessSettings?.invoicePrefix || "FV", nextSequence);
      const activeCashSession = await tx.cashSession.findFirst({
        where: {
          userId: currentSessionUser!.id,
          status: "OPEN",
        },
        orderBy: { openedAt: "desc" },
      });

      const createdSale = await tx.sale.create({
        data: {
          invoiceNumber,
          customer: parsed.data.customer,
          paymentMethod: parsed.data.paymentMethod as PrismaPaymentMethod,
          subtotal,
          tax,
          total,
          costTotal,
          profit,
          cashierId: currentSessionUser!.id,
          cashSessionId: activeCashSession?.id ?? null,
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
              lineProfit: item.lineProfit,
            })),
          },
          payments: {
            create: {
              method: parsed.data.paymentMethod as PrismaPaymentMethod,
              amount: amountPaid,
            },
          },
        },
      });

      if (activeCashSession && parsed.data.paymentMethod === "CASH") {
        await tx.cashMovement.create({
          data: {
            sessionId: activeCashSession.id,
            type: CashMovementType.SALE_IN,
            amount: total,
            note: createdSale.invoiceNumber,
          },
        });
      }

      for (const item of normalizedItems) {
        await tx.product.update({
          where: { id: item.product.id },
          data: {
            stock: { decrement: item.qty },
          },
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
            note: createdSale.invoiceNumber,
          },
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
      changeAmount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar la venta";
    return { success: false, message };
  }
});

ipcMain.handle("dashboard:stats", async (_event, range: DashboardRange = "day") => {
  const normalizedRange: DashboardRange = ["day", "week", "month"].includes(range) ? range : "day";
  const startDate = startOfRange(normalizedRange);

  const sales = await prisma.sale.findMany({
    where: { createdAt: { gte: startDate } },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  const revenue = sales.reduce((sum, sale) => sum + sale.total, 0);
  const profit = sales.reduce((sum, sale) => sum + sale.profit, 0);
  const tax = sales.reduce((sum, sale) => sum + sale.tax, 0);
  const averageTicket = sales.length > 0 ? money(revenue / sales.length) : 0;

  const paymentSummary = sales.reduce<Record<string, number>>((acc, sale) => {
    acc[sale.paymentMethod] = (acc[sale.paymentMethod] ?? 0) + sale.total;
    return acc;
  }, {});

  const topProductsMap = sales.flatMap((sale) => sale.items).reduce<Record<string, { name: string; qty: number; total: number }>>((acc, item) => {
    const current = acc[item.name] ?? { name: item.name, qty: 0, total: 0 };
    current.qty += item.qty;
    current.total += item.lineTotal;
    acc[item.name] = current;
    return acc;
  }, {});

  const topProducts = Object.values(topProductsMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const lowStock = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: [{ stock: "asc" }, { name: "asc" }],
    take: 5,
    select: {
      id: true,
      name: true,
      stock: true,
      sku: true,
    },
  });

  return {
    range: normalizedRange,
    totals: {
      salesCount: sales.length,
      revenue,
      profit,
      tax,
      averageTicket,
    },
    paymentSummary: [
      { label: "Efectivo", value: paymentSummary.CASH ?? 0 },
      { label: "Tarjeta", value: paymentSummary.CARD ?? 0 },
      { label: "Transferencia", value: paymentSummary.TRANSFER ?? 0 },
    ],
    topProducts,
    recentSales: sales.slice(0, 6).map((sale) => ({
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      customer: sale.customer,
      total: sale.total,
      createdAt: sale.createdAt.toISOString(),
      itemsCount: sale.items.length,
    })),
    lowStock,
  };
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("quit", async () => {
  await prisma?.$disconnect();
});
