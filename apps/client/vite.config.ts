import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      "/data": {
        target: "http://localhost:2567",
        changeOrigin: true
      },
      "/colyseus": {
        target: "http://localhost:2567",
        ws: true,
        changeOrigin: true
      }
    }
  }
});
