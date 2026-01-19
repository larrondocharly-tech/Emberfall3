import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      // API data (races/classes/spells/monsters)
      "/data": {
        target: "http://localhost:2567",
        changeOrigin: true,
      },

      // Colyseus HTTP (matchmake) + WebSocket
      "/colyseus": {
        target: "http://localhost:2567",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
