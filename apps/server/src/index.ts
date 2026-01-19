import express from "express";
import cors from "cors";
import http from "http";

import { Server, Room, Client } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";

const PORT = Number(process.env.PORT ?? 2567);

// =======================
// Types (minimal)
// =======================
type PlayerState = {
  id: string;
  name: string;
  raceId: string;
  classId: string;
  x: number;
  y: number;
};

type GameState = {
  obstacles: { x: number; y: number }[];
  players: Record<string, PlayerState>;
  turn: number;
};

// =======================
// ROOM VTT
// =======================
class VttRoom extends Room<GameState> {
  onCreate(options: any) {
    console.log("🟢 VttRoom created", options);

    // ✅ IMPORTANT: définir un state (sinon côté client room.state peut être null)
    this.setState({
      obstacles: [],
      players: {},
      turn: 0,
    });

    // Messages utiles (si tu en as déjà côté client)
    this.onMessage("move", (client, payload: { x: number; y: number }) => {
      const p = this.state.players[client.sessionId];
      if (!p) return;

      p.x = Number(payload?.x ?? p.x);
      p.y = Number(payload?.y ?? p.y);
    });

    this.onMessage("end_turn", () => {
      this.state.turn = (this.state.turn ?? 0) + 1;
    });

    this.onMessage("combat_move", (_client, payload: { x: number; y: number }) => {
      // placeholder : à toi d'implémenter la logique combat plus tard
      void payload;
    });
  }

  onJoin(client: Client, options: any) {
    console.log("👤 Player joined:", client.sessionId, options);

    const name = String(options?.name ?? "Player");
    const raceId = String(options?.raceId ?? "human");
    const classId = String(options?.classId ?? "fighter");

    this.state.players[client.sessionId] = {
      id: client.sessionId,
      name,
      raceId,
      classId,
      x: 2,
      y: 2,
    };
  }

  onLeave(client: Client) {
    console.log("🚪 Player left:", client.sessionId);
    delete this.state.players[client.sessionId];
  }

  onDispose() {
    console.log("🧹 VttRoom disposed");
  }
}

// =======================
// EXPRESS + CORS
// =======================
const app = express();
app.use(express.json());

app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept"],
  })
);
app.options("*", cors());

app.get("/health", (_req, res) => res.json({ ok: true }));

// endpoints data MINIMUM (évite 404)
app.get("/data/races", (_req, res) => res.json([{ id: "human", name: "Human" }]));
app.get("/data/classes", (_req, res) => res.json([{ id: "fighter", name: "Fighter" }]));
app.get("/data/spells", (_req, res) => res.json([]));
app.get("/data/monsters", (_req, res) => res.json([]));

// =======================
// HTTP + COLYSEUS
// =======================
const server = http.createServer(app);
const transport = new WebSocketTransport({ server });
const gameServer = new Server({ transport });

// Define rooms
gameServer.define("vtt", VttRoom);

// Attach matchmake routes if available (compat)
(gameServer as any).attach?.({ server, express: app });

server.listen(PORT, () => {
  console.log(`🔥 API http://localhost:${PORT}`);
  console.log(`✅ Health http://localhost:${PORT}/health`);
  console.log(`🧩 Matchmake http://localhost:${PORT}/matchmake/*`);
  console.log(`🔌 WS ws://localhost:${PORT}`);
});
