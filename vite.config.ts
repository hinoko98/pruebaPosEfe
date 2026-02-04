import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: 'src/main/electron/main.ts',
        // --- AQUÍ VA LA CONFIGURACIÓN ---
        vite: {
          build: {
            rollupOptions: {
              external: ['bcryptjs', 'sqlite3'], 
            },
          },
        },
      },
      preload: {
        input: path.join(__dirname, 'src/main/electron/preload.ts'),
      },
      renderer: process.env.NODE_ENV === 'test'
        ? undefined
        : {},
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer/'),
      '~': path.resolve(__dirname, 'src')
    }
  }
})