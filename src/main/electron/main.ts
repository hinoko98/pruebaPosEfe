// ================= IMPORTACIONES =================
import { app, BrowserWindow, Menu, ipcMain, IpcMainInvokeEvent } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";
import "dotenv/config";


import { loginInputSchema, createUserInputSchema } from "./ipc/schemas/auth.schema";

// ================= CONFIG RUTAS =================
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, "..");

export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

// ================= VARIABLES =================
let win: BrowserWindow | null = null;
let prisma: PrismaClient;

// ================= CREAR VENTANA =================
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

// ================= SEED ADMIN =================

type SeedConfig = {
  enabled: boolean;
  username: string;
  name: string;
  password: string;
  bcryptRounds: number;
};

function getSeedConfig(): SeedConfig {
  const enabled = (process.env.SEED_ADMIN_ENABLED ?? "true").toLowerCase() === "true";

  const username = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const name = process.env.SEED_ADMIN_NAME ?? "Administrador";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin123";

  const bcryptRounds = Number(process.env.BCRYPT_ROUNDS ?? "10");

  if (enabled && password.trim().length < 8) {
    throw new Error(
      "SEED_ADMIN_PASSWORD es obligatorio y debe tener mínimo 8 caracteres (cuando SEED_ADMIN_ENABLED=true)."
    );
  }

  if (!Number.isFinite(bcryptRounds) || bcryptRounds < 8 || bcryptRounds > 15) {
    throw new Error("BCRYPT_ROUNDS inválido. Usa un valor entre 8 y 15.");
  }

  return { enabled, username, name, password, bcryptRounds };
}

export async function seedAdminIfNeeded(prisma: PrismaClient) {
  const cfg = getSeedConfig();
  if (!cfg.enabled) return;

  // Mejor que count(): valida que exista un ADMIN
  const adminExists = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
  if (adminExists) return;

  const passwordHash = await bcrypt.hash(cfg.password, cfg.bcryptRounds);

  await prisma.user.create({
    data: {
      username: cfg.username,
      name: cfg.name,
      role: Role.ADMIN,
      passwordHash,
      isActive: true,
    },
  });

  console.log(`Admin inicial creado: ${cfg.username} (password desde .env)`);
}

// ================= LOG LOGIN =================
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

// ================= INICIO APP =================
app.whenReady().then(async () => {
  process.env.DATABASE_URL = `file:${path.join(app.getPath("userData"), "app.db")}`;

  prisma = new PrismaClient();

  await seedAdminIfNeeded(prisma);

  createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ================= IPC HANDLERS =================

// LOGIN
ipcMain.handle("auth:login", async (_event: IpcMainInvokeEvent, payload) => {
  const parsed = loginInputSchema.safeParse(payload);

  if (!parsed.success) {
    await logLoginEvent({
      username: String(payload?.username ?? ""),
      success: false,
      reason: "invalid_payload",
    });
    return { success: false, message: "Datos inválidos" };
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
    return { success: false, message: "Usuario o contraseña incorrectos" };
  }

  const match = await bcrypt.compare(password, user.passwordHash);

  if (!match) {
    await logLoginEvent({
      userId: user.id,
      username,
      success: false,
      reason: "wrong_password",
    });
    return { success: false, message: "Usuario o contraseña incorrectos" };
  }

  await logLoginEvent({
    userId: user.id,
    username,
    success: true,
  });

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.name ?? undefined,
      role: user.role,
    },
  };
});

// CREATE USER (solo admin)
ipcMain.handle("auth:createUser", async (_event: IpcMainInvokeEvent, payload) => {
  const parsed = createUserInputSchema.safeParse(payload);
  if (!parsed.success) return { success: false, message: "Datos inválidos" };

  const { newUsername, newPassword, adminUsername } = parsed.data;

  const admin = await prisma.user.findUnique({
    where: { username: adminUsername },
  });

  if (!admin || admin.role !== Role.ADMIN) {
    return { success: false, message: "Solo admins pueden crear usuarios" };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  try {
    await prisma.user.create({
      data: {
        username: newUsername,
        passwordHash,
        role: Role.EMPLOYEE,
      },
    });
    return { success: true };
  } catch {
    return { success: false, message: "Usuario duplicado" };
  }
});

// ================= CIERRE =================
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("quit", async () => {
  await prisma?.$disconnect();
});
