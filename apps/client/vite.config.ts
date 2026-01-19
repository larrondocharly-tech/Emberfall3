import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      "/matchmake": { target: "http://localhost:2567", changeOrigin: true },
      "/data": { target: "http://localhost:2567", changeOrigin: true },
      "/health": { target: "http://localhost:2567", changeOrigin: true },
    },
  },
});
