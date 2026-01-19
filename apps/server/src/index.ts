import { createServer } from "http";
import express from "express";
import cors from "cors";
import { Server, Room, Client } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import type {
  ClassData,
  MapObstacle,
  MonsterData,
  PlayerMode,
  RaceData,
  SpellData,
  Vector2
} from "@emberfall3/shared";

type PlayerState = {
  id: string;
  name: string;
  raceId: string;
  classId: string;
  dex: number;
  hp: number;
  maxHp: number;
  isGM: boolean;
  mode: PlayerMode;
  tokenId: string;
};

type TokenState = {
  id: string;
  name: string;
  ownerId: string;
  type: "player" | "monster";
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  dex: number;
  hp: number;
  maxHp: number;
  movePoints: number;
  maxMovePoints: number;
  gridX: number;
  gridY: number;
};

type ObstacleState = MapObstacle;

type CombatState = {
  active: boolean;
  turnIndex: number;
  turnOrder: string[];
  activeTokenId: string;
  gridSize: number;
  gridCellSize: number;
  originX: number;
  originY: number;
};

type GameState = {
  obstacles: ObstacleState[];
  players: Record<string, PlayerState>;
  tokens: Record<string, TokenState>;
  combat: CombatState;
  turn: number;
};

const SPEED = 180;

type DataStore = {
  races: RaceData[];
  classes: ClassData[];
  spells: SpellData[];
  monsters: MonsterData[];
};

const DATA_BASE_URL = new URL("../data/", import.meta.url);

function readJsonFile<T>(url: URL): T {
  const filePath = fileURLToPath(url);
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

function loadDataFiles(): DataStore {
  return {
    races: readJsonFile<RaceData[]>(new URL("races.json", DATA_BASE_URL)),
    classes: readJsonFile<ClassData[]>(new URL("classes.json", DATA_BASE_URL)),
    spells: readJsonFile<SpellData[]>(new URL("spells.json", DATA_BASE_URL)),
    monsters: readJsonFile<MonsterData[]>(new URL("monsters.json", DATA_BASE_URL))
  };
}

let dataStore: DataStore = {
  races: [],
  classes: [],
  spells: [],
  monsters: []
};

try {
  dataStore = loadDataFiles();
} catch (error) {
  console.error("Failed to load data files:", error);
}

class VttRoom extends Room<GameState> {
  private races: RaceData[] = [];
  private classes: ClassData[] = [];
  private spells: SpellData[] = [];
  private monsters: MonsterData[] = [];
  private gmId = "";

  onCreate() {
    this.setState({
      obstacles: [],
      players: {},
      tokens: {},
      combat: {
        active: false,
        turnIndex: 0,
        turnOrder: [],
        activeTokenId: "",
        gridSize: 8,
        gridCellSize: 64,
        originX: 120,
        originY: 80
      },
      turn: 0
    });

    console.log("VttRoom created");

    try {
      this.loadData();
    } catch (error) {
      console.error("Failed to load data:", error);
      this.races = [];
      this.classes = [];
      this.spells = [];
      this.monsters = [];
    }
    this.seedObstacles();

    this.setSimulationInterval((deltaTime) => this.update(deltaTime));

    this.onMessage("move", (client, payload: { x: number; y: number }) => {
      const player = this.state.players[client.sessionId];
      if (!player || player.mode !== "exploration") {
        return;
      }
      const token = this.state.tokens[player.tokenId];
      if (!token) {
        return;
      }
      token.targetX = payload.x;
      token.targetY = payload.y;
    });

    this.onMessage(
      "combat_move",
      (client, payload: { gridX: number; gridY: number }) => {
        const player = this.state.players[client.sessionId];
        if (!player || !this.state.combat.active || player.mode !== "combat") {
          return;
        }
        if (this.state.combat.activeTokenId !== player.tokenId) {
          return;
        }
        const token = this.state.tokens[player.tokenId];
        if (!token) {
          return;
        }
        const distance =
          Math.abs(payload.gridX - token.gridX) +
          Math.abs(payload.gridY - token.gridY);
        if (distance > token.movePoints) {
          return;
        }
        if (
          payload.gridX < 0 ||
          payload.gridY < 0 ||
          payload.gridX >= this.state.combat.gridSize ||
          payload.gridY >= this.state.combat.gridSize
        ) {
          return;
        }
        token.gridX = payload.gridX;
        token.gridY = payload.gridY;
        token.movePoints -= distance;
        token.x =
          this.state.combat.originX +
          payload.gridX * this.state.combat.gridCellSize +
          this.state.combat.gridCellSize / 2;
        token.y =
          this.state.combat.originY +
          payload.gridY * this.state.combat.gridCellSize +
          this.state.combat.gridCellSize / 2;
      }
    );

    this.onMessage("end_turn", (client) => {
      const player = this.state.players[client.sessionId];
      if (!player || !this.state.combat.active || player.mode !== "combat") {
        return;
      }
      if (this.state.combat.activeTokenId !== player.tokenId) {
        return;
      }
      this.state.combat.turnIndex =
        (this.state.combat.turnIndex + 1) % this.state.combat.turnOrder.length;
      const nextTokenId = this.state.combat.turnOrder[this.state.combat.turnIndex];
      const nextToken = this.state.tokens[nextTokenId];
      if (nextToken) {
        nextToken.movePoints = nextToken.maxMovePoints;
      }
      this.state.combat.activeTokenId = nextTokenId;
    });

    this.onMessage("spawn_monster", (client, payload: { monsterId: string }) => {
      const player = this.state.players[client.sessionId];
      if (!player || !player.isGM) {
        return;
      }
      const monster = this.monsters.find((entry) => entry.id === payload.monsterId);
      if (!monster) {
        return;
      }
      this.spawnMonsterToken(monster);
    });

    this.onMessage("start_combat", (client) => {
      const player = this.state.players[client.sessionId];
      if (!player || !player.isGM) {
        return;
      }
      this.startCombat();
    });

    this.onMessage("chat", (client, payload: { text: string }) => {
      const player = this.state.players[client.sessionId];
      if (!player) {
        return;
      }
      const message = `[${player.name}] ${payload.text.slice(0, 200)}`;
      this.broadcast("chat", { message });
    });

    this.onMessage("roll", (client, payload: { kind: "d20" | "attack" | "skill" }) => {
      const player = this.state.players[client.sessionId];
      if (!player) {
        return;
      }
      const roll = Math.floor(Math.random() * 20) + 1;
      const bonus = payload.kind === "attack" ? 2 : payload.kind === "skill" ? 1 : 0;
      const total = roll + bonus;
      const label = payload.kind === "d20" ? "d20" : payload.kind === "attack" ? "Attack" : "Skill";
      this.broadcast("roll_result", {
        message: `${player.name} lance ${label}: ${roll} + ${bonus} = ${total}`
      });
    });

    this.onMessage(
      "cast_spell",
      (client, payload: { spellId: string; target: Vector2 }) => {
        const player = this.state.players[client.sessionId];
        if (!player) {
          return;
        }
        const spell = this.spells.find((entry) => entry.id === payload.spellId);
        if (!spell) {
          return;
        }
        const token = this.state.tokens[player.tokenId];
        if (!token) {
          return;
        }
        this.broadcast("spell_vfx", {
          spellId: spell.id,
          from: { x: token.x, y: token.y },
          to: payload.target
        });
      }
    );
  }

  onJoin(client: Client, options: { name?: string; raceId?: string; classId?: string }) {
    const isGM = Object.keys(this.state.players).length === 0;
    const player: PlayerState = {
      id: client.sessionId,
      name: options.name ?? `Heros-${client.sessionId.slice(0, 4)}`,
      raceId: options.raceId ?? "human",
      classId: options.classId ?? "fighter",
      dex: 10,
      hp: 10,
      maxHp: 10,
      isGM,
      mode: "exploration",
      tokenId: ""
    };
    const stats = this.resolveStats(player.raceId, player.classId);
    player.dex = stats.dex;
    player.hp = stats.hp;
    player.maxHp = stats.hp;
    this.state.players[client.sessionId] = player;

    if (isGM) {
      this.gmId = player.id;
    }

    const tokenId = `token_${client.sessionId}`;
    const token: TokenState = {
      id: tokenId,
      name: player.name,
      ownerId: player.id,
      type: "player",
      x: 200 + Math.random() * 200,
      y: 200 + Math.random() * 200,
      targetX: -1,
      targetY: -1,
      dex: stats.dex,
      hp: stats.hp,
      maxHp: stats.hp,
      movePoints: stats.movePoints,
      maxMovePoints: stats.movePoints,
      gridX: 0,
      gridY: 0
    };
    this.state.tokens[tokenId] = token;
    player.tokenId = tokenId;

    console.log("Player joined", player.name);
  }

  onLeave(client: Client) {
    const player = this.state.players[client.sessionId];
    if (player) {
      delete this.state.tokens[player.tokenId];
      delete this.state.players[client.sessionId];
    }
  }

  private update(deltaTime: number) {
    const deltaSeconds = deltaTime / 1000;
    Object.values(this.state.tokens).forEach((token) => {
      const owner = this.state.players[token.ownerId];
      if (!owner || owner.mode !== "exploration" || token.targetX < 0 || token.targetY < 0) {
        return;
      }
      const dx = token.targetX - token.x;
      const dy = token.targetY - token.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 4) {
        token.x = token.targetX;
        token.y = token.targetY;
        token.targetX = -1;
        token.targetY = -1;
        return;
      }
      const step = SPEED * deltaSeconds;
      const nextX = token.x + (dx / distance) * Math.min(step, distance);
      const nextY = token.y + (dy / distance) * Math.min(step, distance);
      if (!this.isBlocked(nextX, nextY)) {
        token.x = nextX;
        token.y = nextY;
      } else {
        token.targetX = -1;
        token.targetY = -1;
      }
    });
  }

  private loadData() {
    this.races = dataStore.races;
    this.classes = dataStore.classes;
    this.spells = dataStore.spells;
    this.monsters = dataStore.monsters;
  }

  private seedObstacles() {
    const obstacles: MapObstacle[] = [
      { id: "crate", x: 360, y: 180, width: 80, height: 80 },
      { id: "pillar", x: 620, y: 340, width: 60, height: 120 }
    ];
    this.state.obstacles = obstacles;
  }

  private resolveStats(raceId: string, classId: string) {
    const race = this.races.find((entry) => entry.id === raceId) ?? this.races[0];
    const classData =
      this.classes.find((entry) => entry.id === classId) ?? this.classes[0];
    return {
      dex: classData.baseDex + race.dexBonus,
      hp: classData.baseHp + race.hpBonus,
      movePoints: classData.movePoints
    };
  }

  private spawnMonsterToken(monster: MonsterData) {
    const tokenId = `monster_${monster.id}_${Date.now()}`;
    const token: TokenState = {
      id: tokenId,
      name: monster.name,
      ownerId: this.gmId,
      type: "monster",
      x: 540 + Math.random() * 120,
      y: 260 + Math.random() * 120,
      targetX: -1,
      targetY: -1,
      dex: monster.dex,
      hp: monster.hp,
      maxHp: monster.hp,
      movePoints: monster.movePoints,
      maxMovePoints: monster.movePoints,
      gridX: 0,
      gridY: 0
    };
    this.state.tokens[tokenId] = token;
  }

  private startCombat() {
    if (this.state.combat.active) {
      return;
    }
    const participants = Object.values(this.state.tokens);
    if (participants.length === 0) {
      return;
    }
    this.state.combat.active = true;
    this.state.combat.turnIndex = 0;
    this.state.combat.turnOrder = [];

    const initiatives = participants.map((token) => ({
      id: token.id,
      roll: Math.floor(Math.random() * 20) + 1 + token.dex
    }));
    initiatives.sort((a, b) => b.roll - a.roll);
    this.state.combat.turnOrder = initiatives.map((entry) => entry.id);

    participants.forEach((token, index) => {
      const owner = this.state.players[token.ownerId];
      if (owner) {
        owner.mode = "combat";
      }
      token.movePoints = token.maxMovePoints;
      token.gridX = index % this.state.combat.gridSize;
      token.gridY = Math.floor(index / this.state.combat.gridSize);
      token.x =
        this.state.combat.originX +
        token.gridX * this.state.combat.gridCellSize +
        this.state.combat.gridCellSize / 2;
      token.y =
        this.state.combat.originY +
        token.gridY * this.state.combat.gridCellSize +
        this.state.combat.gridCellSize / 2;
    });
    this.state.combat.activeTokenId = this.state.combat.turnOrder[0] ?? "";
  }

  private isBlocked(x: number, y: number) {
    return this.state.obstacles.some((obstacle) => {
      return (
        x >= obstacle.x &&
        x <= obstacle.x + obstacle.width &&
        y >= obstacle.y &&
        y <= obstacle.y + obstacle.height
      );
    });
  }
}

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true
  })
);

app.use("/colyseus", (req, _res, next) => {
  console.log(`[matchmake] ${req.method} ${req.originalUrl}`);
  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/data/races", (_req, res) => {
  console.log("[data] races");
  res.json(dataStore.races);
});

app.get("/data/classes", (_req, res) => {
  console.log("[data] classes");
  res.json(dataStore.classes);
});

app.get("/data/spells", (_req, res) => {
  console.log("[data] spells");
  res.json(dataStore.spells);
});

app.get("/data/monsters", (_req, res) => {
  console.log("[data] monsters");
  res.json(dataStore.monsters);
});

app.get("/", (_req, res) => {
  res.send("Emberfall VTT server running");
});

app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Express error:", req.method, req.originalUrl, err);
  res.status(500).json({ error: "Internal server error" });
});

const server = createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server, path: "/colyseus" })
});

gameServer.define("vtt", VttRoom);
(gameServer as any).attach?.({ server, express: app, path: "/colyseus" });

server.listen(2567, () => {
  console.log("Server listening on http://localhost:2567");
});
