import { app, BrowserWindow, Menu, ipcMain, IpcMainInvokeEvent } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
//import { dirname } from 'node:path';

import sqlite3 from 'sqlite3';
//import bcrypt from 'bcryptjs'

import path from "node:path";

//const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));


//const __filename = fileURLToPath(import.meta.url);
//const __dirname  = dirname(__filename);
// 
process.env.APP_ROOT = path.join(__dirname, "..");

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;
let db: sqlite3.Database | null = null;  // Tipo explícito, inicia en null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "mascot.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
    },
    show: false,
  });

  Menu.setApplicationMenu(null);

  // Maximiza la ventana inmediatamente
  win.maximize();

  // Ahora sí muestra la ventana (ya maximizada)
  win.show();

  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });
  
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  const dbPath = path.join(app.getPath('userData'), 'app.db');
  db = new sqlite3.Database(dbPath, (err: Error | null) => {
    if (err) {
      console.error('Error conectando DB:', err.message);
      return;
    }
    console.log('DB conectada');
  });

  if (db) {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user'
      )
    `, (err: Error | null) => {
      if (err) console.error('Error creando tabla:', err.message);
    });
  }
  createWindow();
});

// IPC handlers con tipos
ipcMain.handle('login', async (_event: IpcMainInvokeEvent, { username, password }: { username: string; password: string }) => {
  if (!db) return { success: false, message: 'DB no inicializada' };

  return new Promise((resolve) => {
    db!.get('SELECT * FROM users WHERE username = ?', [username], async (err: Error | null, row: any) => {
      if (err) return resolve({ success: false, message: 'Error en DB' });
      if (!row) return resolve({ success: false, message: 'Usuario no encontrado' });

      const match = await bcrypt.compare(password, row.password_hash);
      resolve(match ? { success: true, user: { username: row.username, role: row.role } } : { success: false, message: 'Contraseña incorrecta' });
    });
  });
});

ipcMain.handle('create-user', async (_event: IpcMainInvokeEvent, { newUsername, newPassword, adminUsername }: { newUsername: string; newPassword: string; adminUsername: string }) => {
  if (!db) return { success: false, message: 'DB no inicializada' };

  return new Promise((resolve) => {
    db!.get('SELECT role FROM users WHERE username = ?', [adminUsername], async (err: Error | null, row: any) => {
      if (err || !row || row.role !== 'admin') return resolve({ success: false, message: 'Solo admins pueden crear usuarios' });

      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(newPassword, salt);

      db!.run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [newUsername, hash, 'user'], (err: Error | null) => {
        if (err) return resolve({ success: false, message: 'Error al crear (duplicado?)' });
        resolve({ success: true });
      });
    });
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on('quit', () => {
  if (db) db.close((err: Error | null) => { if (err) console.error('Error cerrando DB:', err); });
});