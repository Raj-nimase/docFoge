import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Local dev: /api/* → Render backend (no env vars needed)
      '/api': {
        target: 'https://docfoge.onrender.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
