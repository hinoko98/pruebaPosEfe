import { defineConfig } from "vite";
import path from "node:path";
import electron from "vite-plugin-electron/simple";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: "src/main/electron/main.ts",
        // --- AQUÍ VA LA CONFIGURACIÓN ---
        vite: {
          build: {
            rollupOptions: {
              external: [
                // Node built-ins
                "node:url",
                "node:path",
                "node:os",
                "node:fs",
                "node:crypto",
                // Dependencias pesadas que NO deben empaquetarse
                "electron",
                "bcryptjs",
                "@prisma/client",
                ".prisma/client",
                ".prisma/client/default",
                "prisma",
                "dotenv",
                "dotenv/config",
                "zod",
              ],
            },
          },
        },
      },
      preload: {
        input: path.join(__dirname, "src/main/electron/preload.ts"),
      },
      renderer: process.env.NODE_ENV === "test" ? undefined : {},
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/renderer/"),
      "~": path.resolve(__dirname, "src"),
    },
  },
});
