// --- IMPORTACIONES ---
// Importamos los módulos necesarios de Electron para controlar la app, ventanas y comunicación
import { app, BrowserWindow, Menu, ipcMain, IpcMainInvokeEvent } from "electron";
// Herramientas de Node.js para manejar rutas de archivos y módulos
import { fileURLToPath } from "node:url";
import path from "node:path";

// Librerías externas para la base de datos (SQLite) y encriptación (Bcrypt)
import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';

// --- CONFIGURACIÓN DE RUTAS ---
// Convertimos la URL del módulo actual en una ruta de carpeta compatible con el sistema operativo
// Esto es necesario en aplicaciones modernas (ESM) para saber dónde estamos parados
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Definimos la raíz de la aplicación subiendo un nivel desde la carpeta actual
process.env.APP_ROOT = path.join(__dirname, "..");

// Variables de entorno para diferenciar si estamos en desarrollo (Vite) o producción
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron"); // Ruta de archivos de Electron compilados
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");        // Ruta de archivos de React compilados

// Definimos dónde buscar recursos públicos (como iconos) dependiendo del entorno
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

// --- VARIABLES GLOBALES ---
let win: BrowserWindow | null;          // Referencia a la ventana para que no la cierre el recolector de basura
let db: sqlite3.Database | null = null;  // Referencia a la base de datos

// --- FUNCIÓN DE CREACIÓN DE VENTANA ---
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "mascot.png"), // Icono de la aplicación
    webPreferences: {
      // El script 'preload' actúa como puente seguro entre Node.js y el navegador (React)
      preload: path.join(__dirname, "preload.mjs"),
    },
    show: false, // Se mantiene oculta inicialmente para evitar que se vea el proceso de carga
  });

  // Eliminamos la barra de menú estándar (Archivo, Editar, etc.)
  Menu.setApplicationMenu(null);

  // Maximiza la ventana para que ocupe toda la pantalla
  win.maximize();

  // Muestra la ventana una vez que ya está maximizada
  win.show();

  // EVENTO: Cuando la página termina de cargar, envía un mensaje de prueba al proceso de React
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });
  
  // Si estamos en desarrollo, carga la URL del servidor de Vite; si no, carga el index.html local
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

// --- GESTIÓN DEL CICLO DE VIDA ---
// En macOS, la app se recrea si haces clic en el icono y no hay ventanas abiertas
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Cuando Electron termina de inicializarse, configuramos la DB y creamos la ventana
app.whenReady().then(() => {
  // Definimos la ruta donde se guardará el archivo .db en la carpeta de datos del usuario
  const dbPath = path.join(app.getPath('userData'), 'app.db');
  
  // Abrimos o creamos el archivo de base de datos
  db = new sqlite3.Database(dbPath, (err: Error | null) => {
    if (err) {
      console.error('Error conectando DB:', err.message);
      return;
    }
    console.log('DB conectada');
  });

  // Si la conexión fue exitosa, creamos la tabla de usuarios si no existe
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

// --- MANEJADORES IPC (Comunicación React -> Node) ---

// Manejador para el proceso de Login
ipcMain.handle('login', async (_event: IpcMainInvokeEvent, { username, password }: { username: string; password: string }) => {
  if (!db) return { success: false, message: 'DB no inicializada' };

  return new Promise((resolve) => {
    // Buscamos al usuario por su nombre de usuario
    db!.get('SELECT * FROM users WHERE username = ?', [username], async (err: Error | null, row: any) => {
      if (err) return resolve({ success: false, message: 'Error en DB' });
      if (!row) return resolve({ success: false, message: 'Usuario no encontrado' });

      // Comparamos la contraseña recibida con el hash guardado en la DB
      const match = await bcrypt.compare(password, row.password_hash);
      resolve(match 
        ? { success: true, user: { username: row.username, role: row.role } } 
        : { success: false, message: 'Contraseña incorrecta' }
      );
    });
  });
});

// Manejador para crear nuevos usuarios (Requiere que el solicitante sea admin)
ipcMain.handle('create-user', async (_event: IpcMainInvokeEvent, { newUsername, newPassword, adminUsername }: { newUsername: string; newPassword: string; adminUsername: string }) => {
  if (!db) return { success: false, message: 'DB no inicializada' };

  return new Promise((resolve) => {
    // Primero verificamos el rol de quien intenta crear el usuario
    db!.get('SELECT role FROM users WHERE username = ?', [adminUsername], async (err: Error | null, row: any) => {
      if (err || !row || row.role !== 'admin') return resolve({ success: false, message: 'Solo admins pueden crear usuarios' });

      // Generamos un "salt" y encriptamos la contraseña antes de guardarla
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(newPassword, salt);

      // Insertamos el nuevo usuario en la base de datos
      db!.run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [newUsername, hash, 'user'], (err: Error | null) => {
        if (err) return resolve({ success: false, message: 'Error al crear (duplicado?)' });
        resolve({ success: true });
      });
    });
  });
});

// Cierre de la aplicación cuando todas las ventanas se cierran (excepto en Mac)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

// Antes de que la app se apague por completo, cerramos la conexión a la base de datos
app.on('quit', () => {
  if (db) db.close((err: Error | null) => { if (err) console.error('Error cerrando DB:', err); });
});