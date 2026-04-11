import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent, Menu } from "electron";
import bcrypt from "bcryptjs";
import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
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

import {
  changeOwnPasswordInputSchema,
  createUserInputSchema,
  loginInputSchema,
  updateOwnProfileInputSchema,
  updateUserInputSchema,
} from "./ipc/schemas/auth.schema";
import {
  createRoleProfileInputSchema,
  deleteRoleProfileInputSchema,
  updateRoleProfileInputSchema,
} from "./ipc/schemas/roles.schema";
import { createSaleSchema } from "./ipc/schemas/sales.schema";
import {
  ensureCorrespondentSchemaIfNeeded,
  registerCorrespondentIpcHandlers,
  seedCorrespondentCatalogIfNeeded,
} from "./modules/correspondent";
import { ensureBackofficeSchemaIfNeeded, registerBackofficeIpcHandlers } from "./modules/pos";
import {
  ROLE_DEFINITIONS,
  flattenRolePermissionCatalog,
  getPermissionCatalogItem,
  type AppRoleKey,
} from "../../renderer/features/user/roles.catalog";
import {
  APP_PERMISSION_KEYS,
  hasPermissionKey,
  normalizeStoredPermissionKeys,
} from "../../renderer/features/user/app-permissions";
import { resolveManagedCode } from "../../shared/internalCodes";
import { parseProductPricingConfig, resolveProductPricingQuote } from "../../shared/productPricing";

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
  roleProfileId?: string | null;
  roleProfileName?: string | null;
  permissions?: string[];
} | null = null;

type SeedConfig = {
  enabled: boolean;
  username: string;
  name: string;
  password: string;
  bcryptRounds: number;
};

type DashboardRange = "day" | "week" | "month";

type SqliteTableLookupRow = {
  name: string;
};

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
  const enabledEnv = process.env.SEED_ADMIN_ENABLED?.toLowerCase();
  const enabled = enabledEnv === undefined ? true : enabledEnv === "true";
  const username = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const name = process.env.SEED_ADMIN_NAME ?? "Administrador";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin123";
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

  const usersCount = await prismaClient.user.count();
  if (usersCount > 0) return;

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

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function buildUserDisplayName(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}

function normalizeUsernamePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function buildUsernameBase(firstName: string, lastName: string, documentNumber: string) {
  const firstPart = normalizeUsernamePart(firstName).slice(0, 3).padEnd(3, "x");
  const lastPart = normalizeUsernamePart(lastName).slice(0, 3).padEnd(3, "x");
  const documentDigits = documentNumber.replace(/\D/g, "");
  const documentPart = documentDigits.slice(-3).padStart(3, "0");

  return `${firstPart}${lastPart}${documentPart}`;
}

async function generateUniqueUsername(params: {
  prismaClient: PrismaClient;
  firstName: string;
  lastName: string;
  documentNumber: string;
  excludeUserId?: string;
}) {
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
        ...(params.excludeUserId ? { NOT: { id: params.excludeUserId } } : {}),
      },
      select: { id: true },
      })
    );

    counter += 1;
  }

  return candidate;
}

function parseBirthDate(value?: string | null) {
  if (!value) return null;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  return new Date(Date.UTC(year, month - 1, day));
}

function mapRoleKeyToPrismaRole(roleKey: AppRoleKey) {
  return roleKey === "ADMIN" ? Role.ADMIN : Role.EMPLOYEE;
}

function roleProfileSystemKey(roleKey: AppRoleKey) {
  return `SYSTEM_${roleKey}`;
}

function hasCurrentSessionPermission(permissionKey?: string) {
  if (!permissionKey) return true;
  return hasPermissionKey(currentSessionUser?.permissions, permissionKey);
}

async function loadPermissionKeysForRoleProfile(prismaClient: PrismaClient, roleProfileId?: string | null) {
  if (!roleProfileId) return [];

  const records = await prismaClient.rolePermission.findMany({
    where: {
      roleProfileId,
      allowed: true,
    },
    select: { permissionKey: true },
    orderBy: { permissionKey: "asc" },
  });

  return normalizeStoredPermissionKeys(records.map((record) => record.permissionKey));
}

async function resolveRoleProfileForUser(prismaClient: PrismaClient, userId: string) {
  const user = await prismaClient.user.findUnique({
    where: { id: userId },
    include: {
      roleProfile: {
        include: {
          permissions: {
            where: { allowed: true },
            orderBy: { permissionKey: "asc" },
          },
        },
      },
    },
  });

  if (!user) return null;

  const permissions = normalizeStoredPermissionKeys(
    user.roleProfile?.permissions.map((permission) => permission.permissionKey) ??
    (
      await prismaClient.roleProfile.findUnique({
        where: { key: roleProfileSystemKey(user.role as AppRoleKey) },
        include: {
          permissions: {
            where: { allowed: true },
            orderBy: { permissionKey: "asc" },
          },
        },
      })
    )?.permissions.map((permission) => permission.permissionKey) ??
    []
  );

  return {
    roleProfileId: user.roleProfile?.id ?? null,
    roleProfileName: user.roleProfile?.name ?? null,
    permissions,
  };
}

function escapeSqlString(value: string) {
  return value.replace(/'/g, "''");
}

async function sqliteTableExists(prismaClient: PrismaClient, tableName: string) {
  const rows = await prismaClient.$queryRawUnsafe<SqliteTableLookupRow[]>(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name = '${escapeSqlString(tableName)}'
    LIMIT 1;
  `);

  return rows.length > 0;
}

function splitSqlStatements(sql: string) {
  const statements: string[] = [];
  const sanitizedSql = sql.replace(/^\s*--.*$/gm, "");
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < sanitizedSql.length; index += 1) {
    const character = sanitizedSql[index];
    const previous = sanitizedSql[index - 1];

    if (character === "'" && !inDoubleQuote && previous !== "\\") {
      inSingleQuote = !inSingleQuote;
    } else if (character === '"' && !inSingleQuote && previous !== "\\") {
      inDoubleQuote = !inDoubleQuote;
    }

    if (character === ";" && !inSingleQuote && !inDoubleQuote) {
      const statement = current.trim();
      if (statement) {
        statements.push(statement);
      }
      current = "";
      continue;
    }

    current += character;
  }

  const trailingStatement = current.trim();
  if (trailingStatement) {
    statements.push(trailingStatement);
  }

  return statements;
}

function getPrismaMigrationsDir() {
  return path.join(process.env.APP_ROOT, "prisma", "migrations");
}

function extractErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "meta" in error) {
    const meta = (error as { meta?: { message?: unknown } }).meta;
    if (typeof meta?.message === "string") {
      return meta.message;
    }
  }

  return String(error);
}

function shouldIgnoreBootstrapMigrationError(statement: string, error: unknown) {
  const trimmedStatement = statement.trim();
  const isApprovalCodeColumnStatement =
    trimmedStatement === `ALTER TABLE "CorrespondentTransaction" ADD COLUMN "approvalCode" TEXT`;
  const isApprovalCodeIndexStatement =
    trimmedStatement ===
    `CREATE UNIQUE INDEX "CorrespondentTransaction_approvalCode_key" ON "CorrespondentTransaction"("approvalCode")`;

  if (!isApprovalCodeColumnStatement && !isApprovalCodeIndexStatement) {
    return false;
  }

  const message = extractErrorMessage(error);
  return (
    message.includes("duplicate column name: approvalCode") ||
    message.includes(`index CorrespondentTransaction_approvalCode_key already exists`) ||
    message.includes(`index "CorrespondentTransaction_approvalCode_key" already exists`)
  );
}

async function ensurePrismaMigrationsTable(prismaClient: PrismaClient) {
  await prismaClient.$executeRawUnsafe(`
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
  `);

  await prismaClient.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "_prisma_migrations_migration_name_key"
    ON "_prisma_migrations"("migration_name");
  `);
}

async function ensureBaseSchemaIfNeeded(prismaClient: PrismaClient) {
  const userTableExists = await sqliteTableExists(prismaClient, "User");
  if (userTableExists) {
    return;
  }

  const migrationsDir = getPrismaMigrationsDir();
  const migrationEntries = await readdir(migrationsDir, { withFileTypes: true });
  const migrationDirectories = migrationEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (migrationDirectories.length === 0) {
    throw new Error(`No se encontraron migraciones Prisma en ${migrationsDir}.`);
  }

  await ensurePrismaMigrationsTable(prismaClient);

  const appliedMigrations = await prismaClient.$queryRawUnsafe<Array<{ migration_name: string }>>(`
    SELECT "migration_name"
    FROM "_prisma_migrations";
  `);
  const appliedMigrationNames = new Set(
    appliedMigrations.map((migration) => migration.migration_name)
  );

  for (const migrationName of migrationDirectories) {
    if (appliedMigrationNames.has(migrationName)) {
      continue;
    }

    const migrationPath = path.join(migrationsDir, migrationName, "migration.sql");
    const migrationSql = await readFile(migrationPath, "utf8");

    if (
      migrationSql.includes(`"Correspondent`) &&
      !(await sqliteTableExists(prismaClient, "CorrespondentTransaction"))
    ) {
      await ensureCorrespondentSchemaIfNeeded(prismaClient);
    }

    const statements = splitSqlStatements(migrationSql);

    for (const statement of statements) {
      try {
        await prismaClient.$executeRawUnsafe(statement);
      } catch (error) {
        if (shouldIgnoreBootstrapMigrationError(statement, error)) {
          continue;
        }

        throw error;
      }
    }

    const checksum = createHash("sha256").update(migrationSql).digest("hex");
    await prismaClient.$executeRawUnsafe(`
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
        '${randomUUID()}',
        '${checksum}',
        CURRENT_TIMESTAMP,
        '${escapeSqlString(migrationName)}',
        '',
        NULL,
        CURRENT_TIMESTAMP,
        ${statements.length}
      );
    `);
  }
}

async function ensureUserSchemaIfNeeded(prismaClient: PrismaClient) {
  const columns = await prismaClient.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("User");`);
  const existingColumns = new Set(columns.map((column) => column.name));
  const statements: string[] = [];

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
      internalCode: true,
    },
    orderBy: [{ createdAt: "asc" }, { username: "asc" }],
  });

  const assignedCodes: string[] = [];

  for (const user of users) {
    const internalCode = resolveManagedCode({
      desiredCode: user.internalCode,
      existingCodes: assignedCodes,
      prefix: "USR",
      digits: 4,
      maxLength: 30,
    });

    if (internalCode !== user.internalCode) {
      await prismaClient.user.update({
        where: { id: user.id },
        data: { internalCode },
      });
    }

    assignedCodes.push(internalCode);
  }

  await prismaClient.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "User_internalCode_key" ON "User"("internalCode");`
  );
}

async function ensureNotificationsSchemaIfNeeded(prismaClient: PrismaClient) {
  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "NotificationRead" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "readKey" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "NotificationRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await prismaClient.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "NotificationRead_userId_readKey_key"
    ON "NotificationRead"("userId", "readKey");
  `);
  await prismaClient.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "NotificationRead_userId_idx"
    ON "NotificationRead"("userId");
  `);
}

async function ensureProductSchemaIfNeeded(prismaClient: PrismaClient) {
  const columns = await prismaClient.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("Product");`);
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

async function ensureRoleSchemaIfNeeded(prismaClient: PrismaClient) {
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

  const userColumns = await prismaClient.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("User");`);
  const existingUserColumns = new Set(userColumns.map((column) => column.name));

  if (!existingUserColumns.has("roleProfileId")) {
    await prismaClient.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "roleProfileId" TEXT;`);
  }

  await prismaClient.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "User_roleProfileId_idx"
    ON "User"("roleProfileId");
  `);
}

async function seedRoleProfilesIfNeeded(prismaClient: PrismaClient) {
  for (const definition of ROLE_DEFINITIONS) {
    const permissionCatalog = flattenRolePermissionCatalog(definition);
    const existingProfile = await prismaClient.roleProfile.findUnique({
      where: { key: roleProfileSystemKey(definition.key) },
      select: { id: true },
    });

    const roleProfile = existingProfile
      ? await prismaClient.roleProfile.update({
          where: { id: existingProfile.id },
          data: {
            name: definition.name,
            description: definition.description,
            baseRole: mapRoleKeyToPrismaRole(definition.key),
            isSystem: true,
          },
        })
      : await prismaClient.roleProfile.create({
          data: {
            key: roleProfileSystemKey(definition.key),
            name: definition.name,
            description: definition.description,
            baseRole: mapRoleKeyToPrismaRole(definition.key),
            isSystem: true,
            isActive: true,
          },
        });

    const existingPermissions = await prismaClient.rolePermission.findMany({
      where: {
        roleProfileId: roleProfile.id,
        allowed: true,
      },
      select: {
        permissionKey: true,
      },
    });
    const existingPermissionKeys = new Set(existingPermissions.map((permission) => permission.permissionKey));
    const missingPermissions = permissionCatalog.filter(
      (permission) => !existingPermissionKeys.has(permission.key)
    );

    if (missingPermissions.length > 0) {
      await prismaClient.rolePermission.createMany({
        data: missingPermissions.map((permission) => ({
          roleProfileId: roleProfile.id,
          permissionKey: permission.key,
          allowed: true,
        })),
      });
    }
  }

  const systemProfiles = await prismaClient.roleProfile.findMany({
    where: { key: { in: ROLE_DEFINITIONS.map((definition) => roleProfileSystemKey(definition.key)) } },
    select: { id: true, baseRole: true },
  });

  for (const profile of systemProfiles) {
    await prismaClient.user.updateMany({
      where: {
        role: profile.baseRole,
        roleProfileId: null,
      },
      data: {
        roleProfileId: profile.id,
      },
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
    getCurrentSessionUser: () => currentSessionUser,
  });
}

app.whenReady()
  .then(async () => {
    const dbPath = path.join(app.getPath("userData"), "app.db").replace(/\\/g, "/");
    process.env.DATABASE_URL = `file:${dbPath}`;

    prisma = new PrismaClient();
    appConnectedAt = new Date();
    await ensureBaseSchemaIfNeeded(prisma);
    await ensureUserSchemaIfNeeded(prisma);
    await ensureNotificationsSchemaIfNeeded(prisma);
    await ensureRoleSchemaIfNeeded(prisma);
    await ensureBackofficeSchemaIfNeeded(prisma);
    await seedAdminIfNeeded(prisma);
    await seedRoleProfilesIfNeeded(prisma);
    await ensureProductSchemaIfNeeded(prisma);

    registerBackofficeIpcHandlers({
      ipcMain,
      prisma,
      getCurrentSessionUser: () => currentSessionUser,
      getConnectedAt: () => appConnectedAt,
    });

    await bootstrapAppData();
    createWindow();
  })
  .catch((error) => {
    console.error("No se pudo inicializar la aplicacion POS.", error);
    app.quit();
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

  const roleProfile = await resolveRoleProfileForUser(prisma, user.id);

  currentSessionUser = {
    id: user.id,
    username: user.username,
    name: user.name ?? undefined,
    role: user.role,
    roleProfileId: roleProfile?.roleProfileId ?? null,
    roleProfileName: roleProfile?.roleProfileName ?? null,
    permissions: roleProfile?.permissions ?? [],
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
    roleProfileId,
    isActive,
  } = parsed.data;
  const passwordHash = await bcrypt.hash(newPassword, 10);
  const fullName = buildUserDisplayName(firstName, lastName);

  try {
    const duplicateDocument = await prisma.user.findFirst({
      where: { documentNumber },
      select: { id: true },
    });

    if (duplicateDocument) {
      return { success: false, message: "La cedula ya esta registrada para otro usuario" };
    }

    const selectedRoleProfile = roleProfileId
      ? await prisma.roleProfile.findUnique({
          where: { id: roleProfileId },
          select: { id: true, baseRole: true, isActive: true },
        })
      : await prisma.roleProfile.findUnique({
          where: { key: roleProfileSystemKey("EMPLOYEE") },
          select: { id: true, baseRole: true, isActive: true },
        });

    if (!selectedRoleProfile || !selectedRoleProfile.isActive) {
      return { success: false, message: "El perfil de rol seleccionado no esta disponible" };
    }

    const username = await generateUniqueUsername({
      prismaClient: prisma,
      firstName,
      lastName,
      documentNumber,
    });
    const existingInternalCodes = (
      await prisma.user.findMany({
        select: { internalCode: true },
      })
    ).map((user) => user.internalCode);
    const internalCode = resolveManagedCode({
      desiredCode: desiredInternalCode,
      existingCodes: existingInternalCodes,
      prefix: "USR",
      digits: 4,
      maxLength: 30,
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
        isActive: isActive ?? true,
      },
    });

    return { success: true, username };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear el usuario";
    return { success: false, message };
  }
});

ipcMain.handle("users:update", async (_event: IpcMainInvokeEvent, payload) => {
  const parsed = updateUserInputSchema.safeParse(payload);
  if (!parsed.success) return { success: false, message: "Datos invalidos" };

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
    roleProfileId,
    isActive,
  } = parsed.data;
  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, isActive: true, roleProfileId: true, internalCode: true },
  });

  if (!existingUser) {
    return { success: false, message: "El usuario ya no existe" };
  }

  const duplicateDocument = await prisma.user.findFirst({
    where: {
      documentNumber,
      NOT: { id },
    },
    select: { id: true },
  });

  if (duplicateDocument) {
    return { success: false, message: "La cedula ya esta registrada para otro usuario" };
  }

  const selectedRoleProfile = roleProfileId
    ? await prisma.roleProfile.findUnique({
        where: { id: roleProfileId },
        select: { id: true, baseRole: true, isActive: true, name: true },
      })
    : await prisma.roleProfile.findUnique({
        where: { key: roleProfileSystemKey((existingUser.role as AppRoleKey) ?? "EMPLOYEE") },
        select: { id: true, baseRole: true, isActive: true, name: true },
      });

  if (!selectedRoleProfile || !selectedRoleProfile.isActive) {
    return { success: false, message: "El perfil de rol seleccionado no esta disponible" };
  }

  if (
    existingUser.role === Role.ADMIN &&
    (selectedRoleProfile.baseRole !== Role.ADMIN || !isActive)
  ) {
    const remainingAdmins = await prisma.user.count({
      where: {
        role: Role.ADMIN,
        isActive: true,
        NOT: { id },
      },
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
    excludeUserId: id,
  });
  const fullName = buildUserDisplayName(firstName, lastName);

  try {
    const existingInternalCodes = (
      await prisma.user.findMany({
        where: { NOT: { id } },
        select: { internalCode: true },
      })
    ).map((user) => user.internalCode);
    const internalCode = resolveManagedCode({
      desiredCode: desiredInternalCode,
      existingCodes: existingInternalCodes,
      prefix: "USR",
      digits: 4,
      maxLength: 30,
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
        ...(newPassword?.trim()
          ? {
              passwordHash: await bcrypt.hash(newPassword, 10),
            }
          : {}),
      },
    });

    if (currentSessionUser.id === id) {
      currentSessionUser = {
        ...currentSessionUser,
        username,
        name: fullName,
        role: selectedRoleProfile.baseRole,
        roleProfileId: selectedRoleProfile.id,
        roleProfileName: selectedRoleProfile.name,
        permissions: await loadPermissionKeysForRoleProfile(prisma, selectedRoleProfile.id),
      };
    }

    return { success: true, username };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar el usuario";
    return { success: false, message };
  }
});

ipcMain.handle("auth:get-profile", async () => {
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
      role: true,
    },
  });

  if (!profile) {
    return { success: false, message: "Tu usuario ya no existe" };
  }

  return {
    success: true,
    profile: {
      ...profile,
      birthDate: profile.birthDate?.toISOString().slice(0, 10) ?? null,
    },
  };
});

ipcMain.handle("auth:update-profile", async (_event: IpcMainInvokeEvent, payload) => {
  const parsed = updateOwnProfileInputSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, message: "Datos invalidos" };
  }

  if (!currentSessionUser) {
    return { success: false, message: "Debes iniciar sesion" };
  }

  const { firstName, lastName, email, phone, birthDate } = parsed.data;
  const fullName = buildUserDisplayName(firstName, lastName);

  const updated = await prisma.user.update({
    where: { id: currentSessionUser.id },
    data: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      name: fullName,
      email: normalizeOptionalText(email),
      phone: normalizeOptionalText(phone),
      birthDate: parseBirthDate(birthDate),
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
      role: true,
    },
  });

  currentSessionUser = {
    ...currentSessionUser,
    name: fullName,
  };

  return {
    success: true,
    user: currentSessionUser,
    profile: {
      ...updated,
      birthDate: updated.birthDate?.toISOString().slice(0, 10) ?? null,
    },
  };
});

ipcMain.handle("auth:change-password", async (_event: IpcMainInvokeEvent, payload) => {
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
    select: { id: true, passwordHash: true },
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
      passwordHash: await bcrypt.hash(newPassword, 10),
    },
  });

  return { success: true };
});

ipcMain.handle("notifications:get-read", async () => {
  if (!currentSessionUser) {
    return { success: false, message: "Debes iniciar sesion", readKeys: [] };
  }

  const reads = await prisma.notificationRead.findMany({
    where: { userId: currentSessionUser.id },
    select: { readKey: true },
    orderBy: { createdAt: "desc" },
  });

  return {
    success: true,
    readKeys: reads.map((entry) => entry.readKey),
  };
});

ipcMain.handle("notifications:mark-read", async (_event: IpcMainInvokeEvent, payload) => {
  if (!currentSessionUser) {
    return { success: false, message: "Debes iniciar sesion" };
  }

  const readKeys = Array.isArray(payload?.readKeys)
    ? payload.readKeys.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
    : [];

  if (readKeys.length === 0) {
    return { success: true };
  }

  await Promise.all(
    readKeys.map((readKey: string) =>
      prisma.notificationRead.upsert({
        where: {
          userId_readKey: {
            userId: currentSessionUser!.id,
            readKey,
          },
        },
        update: {},
        create: {
          userId: currentSessionUser!.id,
          readKey,
        },
      })
    )
  );

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
        select: { permissionKey: true },
      },
      _count: {
        select: { users: true },
      },
    },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
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
      permissionKeys: normalizeStoredPermissionKeys(
        roleProfile.permissions.map((permission) => permission.permissionKey)
      ),
      usersCount: roleProfile._count.users,
      createdAt: roleProfile.createdAt.toISOString(),
      updatedAt: roleProfile.updatedAt.toISOString(),
    })),
  };
});

ipcMain.handle("roles:create", async (_event: IpcMainInvokeEvent, payload) => {
  const parsed = createRoleProfileInputSchema.safeParse(payload);
  if (!parsed.success) return { success: false, message: "Datos invalidos para el rol" };
  const normalizedPermissionKeys = normalizeStoredPermissionKeys(parsed.data.permissionKeys);

  if (!currentSessionUser || currentSessionUser.role !== Role.ADMIN) {
    return { success: false, message: "Solo admins pueden crear roles" };
  }
  if (!hasCurrentSessionPermission(APP_PERMISSION_KEYS.rolesManage)) {
    return { success: false, message: "Tu rol no puede crear roles" };
  }

  if (normalizedPermissionKeys.length > 0) {
    const invalidPermission = normalizedPermissionKeys.find(
      (permissionKey) => !getPermissionCatalogItem(parsed.data.baseRole as AppRoleKey, permissionKey)
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
          create: normalizedPermissionKeys.map((permissionKey) => ({
            permissionKey,
            allowed: true,
          })),
        },
      },
      select: { id: true },
    });

    return { success: true, roleId: created.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear el rol";
    return { success: false, message };
  }
});

ipcMain.handle("roles:update", async (_event: IpcMainInvokeEvent, payload) => {
  const parsed = updateRoleProfileInputSchema.safeParse(payload);
  if (!parsed.success) return { success: false, message: "Datos invalidos para el rol" };
  const normalizedPermissionKeys = normalizeStoredPermissionKeys(parsed.data.permissionKeys);

  if (!currentSessionUser || currentSessionUser.role !== Role.ADMIN) {
    return { success: false, message: "Solo admins pueden editar roles" };
  }
  if (!hasCurrentSessionPermission(APP_PERMISSION_KEYS.rolesManage)) {
    return { success: false, message: "Tu rol no puede editar roles" };
  }

  const existing = await prisma.roleProfile.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, baseRole: true, isSystem: true, name: true },
  });

  if (!existing) {
    return { success: false, message: "El rol ya no existe" };
  }

  const invalidPermission = normalizedPermissionKeys.find(
    (permissionKey) => !getPermissionCatalogItem(existing.baseRole as AppRoleKey, permissionKey)
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
          isActive: parsed.data.isActive ?? true,
        },
      });

      await tx.rolePermission.deleteMany({ where: { roleProfileId: parsed.data.id } });
      await tx.rolePermission.createMany({
        data: normalizedPermissionKeys.map((permissionKey) => ({
          roleProfileId: parsed.data.id,
          permissionKey,
          allowed: true,
        })),
      });
    });

    if (currentSessionUser.roleProfileId === parsed.data.id) {
      currentSessionUser = {
        ...currentSessionUser,
        roleProfileName: parsed.data.name.trim(),
        permissions: normalizedPermissionKeys,
      };
    }

    return { success: true, roleId: parsed.data.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar el rol";
    return { success: false, message };
  }
});

ipcMain.handle("roles:delete", async (_event: IpcMainInvokeEvent, payload) => {
  const parsed = deleteRoleProfileInputSchema.safeParse(payload);
  if (!parsed.success) return { success: false, message: "Datos invalidos para el rol" };

  if (!currentSessionUser || currentSessionUser.role !== Role.ADMIN) {
    return { success: false, message: "Solo admins pueden eliminar roles" };
  }
  if (!hasCurrentSessionPermission(APP_PERMISSION_KEYS.rolesManage)) {
    return { success: false, message: "Tu rol no puede eliminar roles" };
  }

  const existing = await prisma.roleProfile.findUnique({
    where: { id: parsed.data.id },
    include: {
      _count: {
        select: {
          users: true,
        },
      },
    },
  });

  if (!existing) return { success: false, message: "El rol ya no existe" };
  if (existing.isSystem) {
    return { success: false, message: "Los roles del sistema no se pueden eliminar" };
  }
  if (existing._count.users > 0) {
    return { success: false, message: "Reasigna los usuarios del rol antes de eliminarlo" };
  }

  await prisma.roleProfile.delete({
    where: { id: parsed.data.id },
  });

  return { success: true, roleId: parsed.data.id };
});

ipcMain.handle("auth:logout", async () => {
  currentSessionUser = null;
  return { success: true };
});

ipcMain.handle("products:list", async () => {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { stock: { gt: 0 } },
        { pricingConfigJson: { not: null } },
      ],
    },
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
    pricingConfig: parseProductPricingConfig(product.pricingConfigJson),
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
  let selectedCustomer:
    | {
        id: string;
        name: string;
        segment: "GENERAL" | "DOCENTE";
      }
    | null = null;
  if (parsed.data.customerId) {
    selectedCustomer = await prisma.customer.findFirst({
      where: {
        id: parsed.data.customerId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        segment: true,
      },
    });

    if (!selectedCustomer) {
      return { success: false, message: "El cliente seleccionado ya no esta disponible" };
    }
  }

  const saleCustomerName = selectedCustomer?.name ?? parsed.data.customer?.trim() ?? "Consumidor final";
  if (
    saleCustomerName !== "Consumidor final" &&
    !hasCurrentSessionPermission(APP_PERMISSION_KEYS.salesChangeCustomer)
  ) {
    return { success: false, message: "Tu rol no puede cambiar el cliente en la factura" };
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
  const canEditSaleItemPrices = hasCurrentSessionPermission(APP_PERMISSION_KEYS.salesEditItemPrices);
  const normalizedItems = parsed.data.items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new Error("Producto no encontrado");
    }

    const productPricingConfig = parseProductPricingConfig(product.pricingConfigJson);
    const skipStockControl = Boolean(productPricingConfig?.enabled);

    if (!skipStockControl && product.stock < item.qty) {
      throw new Error(`Stock insuficiente para ${product.name}`);
    }

    if (item.pricingContext?.manualUnitPrice !== undefined && item.pricingContext?.manualUnitPrice !== null && !canEditSaleItemPrices) {
      throw new Error("Tu rol no puede aplicar precios manuales en productos con reglas escalonadas");
    }

    const pricingResult = resolveProductPricingQuote({
      fallbackPrice: product.price,
      pricingConfig: productPricingConfig,
      qty: item.qty,
      sheetTypeId: item.pricingContext?.sheetTypeId,
      specialRuleId: item.pricingContext?.specialRuleId ?? null,
      manualUnitPrice: item.pricingContext?.manualUnitPrice ?? null,
      canOverrideMinimum: canEditSaleItemPrices,
    });

    if (!pricingResult.ok) {
      throw new Error(pricingResult.message);
    }

    const { quote } = pricingResult;
    const lineName = quote.sheetTypeName ? `${product.name} - ${quote.sheetTypeName}` : product.name;
    const lineSubtotal = money(quote.unitPrice * item.qty);
    const lineTax = money(lineSubtotal * product.taxRate);
    const lineTotal = lineSubtotal + lineTax;
    const lineProfit = money((quote.unitPrice - product.cost) * item.qty);

    return {
      product,
      quote,
      lineName,
      qty: item.qty,
      lineSubtotal,
      lineTax,
      lineTotal,
      lineProfit,
      skipStockControl,
    };
  });

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineSubtotal, 0);
  const tax = normalizedItems.reduce((sum, item) => sum + item.lineTax, 0);
  const total = subtotal + tax;
  const costTotal = normalizedItems.reduce((sum, item) => sum + item.product.cost * item.qty, 0);
  const profit = normalizedItems.reduce((sum, item) => sum + item.lineProfit, 0);
  const requestedPayments =
    parsed.data.payments && parsed.data.payments.length > 0
      ? parsed.data.payments
      : [
          {
            method: parsed.data.paymentMethod,
            amount: parsed.data.amountPaid ?? total,
          },
        ];

  const normalizedPayments = requestedPayments
    .map((payment) => ({
      method: payment.method,
      amount: money(payment.amount),
    }))
    .filter((payment) => payment.amount > 0);

  if (normalizedPayments.length === 0 && !parsed.data.allowDebt) {
    return { success: false, message: "Debes registrar al menos un pago para completar la venta" };
  }

  const amountPaid = normalizedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const changeAmount = Math.max(0, amountPaid - total);
  const cashReceived = normalizedPayments
    .filter((payment) => payment.method === "CASH")
    .reduce((sum, payment) => sum + payment.amount, 0);

  if (changeAmount > cashReceived) {
    return { success: false, message: "Las vueltas solo pueden salir de un pago en efectivo" };
  }

  let remainingAmount = total;
  const appliedTotals = new Map<PrismaPaymentMethod, number>();
  for (const payment of normalizedPayments) {
    if (remainingAmount <= 0) break;
    const appliedAmount = Math.min(payment.amount, remainingAmount);
    if (appliedAmount <= 0) continue;
    appliedTotals.set(
      payment.method as PrismaPaymentMethod,
      (appliedTotals.get(payment.method as PrismaPaymentMethod) ?? 0) + appliedAmount
    );
    remainingAmount -= appliedAmount;
  }

  const primaryPaymentMethod =
    [...appliedTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
    ((normalizedPayments[0]?.method ?? parsed.data.paymentMethod) as PrismaPaymentMethod);
  const appliedCashAmount = appliedTotals.get(PrismaPaymentMethod.CASH) ?? 0;

  if (parsed.data.clientTotal !== undefined && Math.abs(parsed.data.clientTotal - total) > 1) {
    return { success: false, message: "El total enviado no coincide con el calculo del sistema" };
  }

  if (amountPaid < total && !parsed.data.allowDebt) {
    return { success: false, message: "El pago recibido no alcanza para cubrir la venta" };
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
          customer: saleCustomerName,
          customerId: selectedCustomer?.id ?? null,
          paymentMethod: primaryPaymentMethod,
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
              name: item.lineName,
              price: item.quote.unitPrice,
              cost: item.product.cost,
              qty: item.qty,
              taxRate: item.product.taxRate,
              lineSubtotal: item.lineSubtotal,
              lineTax: item.lineTax,
              lineTotal: item.lineTotal,
              lineProfit: item.lineProfit,
              pricingContextJson: JSON.stringify({
                sheetTypeId: item.quote.sheetTypeId,
                sheetTypeName: item.quote.sheetTypeName,
                specialRuleId: item.quote.specialRuleId,
                specialRuleLabel: item.quote.specialRuleLabel,
                source: item.quote.source,
                sourceLabel: item.quote.sourceLabel,
                minimumPrice: item.quote.minimumPrice,
                minimumApplied: item.quote.minimumApplied,
              }),
            })),
          },
          payments: {
            create: normalizedPayments.map((payment) => ({
              method: payment.method as PrismaPaymentMethod,
              amount: payment.amount,
            })),
          },
        },
      });

      if (activeCashSession && appliedCashAmount > 0) {
        await tx.cashMovement.create({
          data: {
            sessionId: activeCashSession.id,
            type: CashMovementType.SALE_IN,
            amount: appliedCashAmount,
            note: createdSale.invoiceNumber,
          },
        });
      }

      for (const item of normalizedItems) {
        if (item.skipStockControl) {
          continue;
        }

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
      { label: "Transferencia", value: (paymentSummary.CARD ?? 0) + (paymentSummary.TRANSFER ?? 0) },
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
