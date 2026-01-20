import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      // Proxy Colyseus WebSocket + matchmake requests to the local server (port 2567).
      "/colyseus": {
        target: "http://localhost:2567",
        ws: true,
        changeOrigin: true
      },
      // Optional fallback if a backend exposes /matchmake without the /colyseus prefix.
      "/matchmake": {
        target: "http://localhost:2567",
        changeOrigin: true
      }
    }
  }
});
