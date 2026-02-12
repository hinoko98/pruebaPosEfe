import { app, BrowserWindow, ipcMain, Menu } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sqlite3 from "sqlite3";
import bcrypt from "bcryptjs";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
let db = null;
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "mascot.png"),
    // Icono de la aplicación
    webPreferences: {
      // El script 'preload' actúa como puente seguro entre Node.js y el navegador (React)
      preload: path.join(__dirname$1, "preload.mjs")
    },
    show: false
    // Se mantiene oculta inicialmente para evitar que se vea el proceso de carga
  });
  Menu.setApplicationMenu(null);
  win.maximize();
  win.show();
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(() => {
  const dbPath = path.join(app.getPath("userData"), "app.db");
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error("Error conectando DB:", err.message);
      return;
    }
    console.log("DB conectada");
  });
  if (db) {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user'
      )
    `, (err) => {
      if (err) console.error("Error creando tabla:", err.message);
    });
  }
  createWindow();
});
ipcMain.handle("login", async (_event, { username, password }) => {
  if (!db) return { success: false, message: "DB no inicializada" };
  return new Promise((resolve) => {
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, row) => {
      if (err) return resolve({ success: false, message: "Error en DB" });
      if (!row) return resolve({ success: false, message: "Usuario no encontrado" });
      const match = await bcrypt.compare(password, row.password_hash);
      resolve(
        match ? { success: true, user: { username: row.username, role: row.role } } : { success: false, message: "Contraseña incorrecta" }
      );
    });
  });
});
ipcMain.handle("create-user", async (_event, { newUsername, newPassword, adminUsername }) => {
  if (!db) return { success: false, message: "DB no inicializada" };
  return new Promise((resolve) => {
    db.get("SELECT role FROM users WHERE username = ?", [adminUsername], async (err, row) => {
      if (err || !row || row.role !== "admin") return resolve({ success: false, message: "Solo admins pueden crear usuarios" });
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(newPassword, salt);
      db.run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", [newUsername, hash, "user"], (err2) => {
        if (err2) return resolve({ success: false, message: "Error al crear (duplicado?)" });
        resolve({ success: true });
      });
    });
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("quit", () => {
  if (db) db.close((err) => {
    if (err) console.error("Error cerrando DB:", err);
  });
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
