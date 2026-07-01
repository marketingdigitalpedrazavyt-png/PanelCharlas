import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En dev (npm run dev) proxea /api al backend local.
// En producción, nginx sirve el build y proxea /api al contenedor backend.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true },
    },
  },
});
