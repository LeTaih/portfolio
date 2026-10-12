import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        mentions: resolve(import.meta.dirname, 'mentions-legales.html'),
      },
    },
  },
})
