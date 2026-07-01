import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // Local dev: /api/* → Render backend (no env vars needed)
      "/api": {
        target: "http://localhost:3001", //https://docfoge.onrender.com
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
