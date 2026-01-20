import { createServer } from "http";
import express from "express";
import cors from "cors";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { VTTRoom } from "./rooms/VTTRoom";

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true
  })
);

const server = createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server, path: "/colyseus" })
});

gameServer.define("vtt", VTTRoom);
(gameServer as { attach?: (options: { server: typeof server; express: typeof app; path: string }) => void })
  .attach?.({ server, express: app, path: "/colyseus" });

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/", (_req, res) => {
  res.send("Emberfall VTT server running");
});

server.listen(2567, () => {
  console.log("Colyseus server listening on http://localhost:2567");
});
