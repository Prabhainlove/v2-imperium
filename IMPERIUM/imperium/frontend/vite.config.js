import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: "index.html",
    },
    sourcemap: false,
    minify: true,
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      // In dev mode, proxy all API calls to the FastAPI backend.
      // The frontend uses "" as its API_BASE_URL, so every /api, /health,
      // /agents, /task, /status, /snapshot call is transparently forwarded.
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/health": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/agents": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/task": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/status": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/snapshot": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
});
