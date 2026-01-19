import { createServer } from "http";
import express from "express";
import cors from "cors";
import { Server, Room, Client } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
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

class PlayerState extends Schema {
  @type("string") id = "";
  @type("string") name = "";
  @type("string") raceId = "human";
  @type("string") classId = "fighter";
  @type("number") dex = 10;
  @type("number") hp = 10;
  @type("number") maxHp = 10;
  @type("boolean") isGM = false;
  @type("string") mode: PlayerMode = "exploration";
  @type("string") tokenId = "";
}

class TokenState extends Schema {
  @type("string") id = "";
  @type("string") name = "";
  @type("string") ownerId = "";
  @type("string") type = "player";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") targetX = -1;
  @type("number") targetY = -1;
  @type("number") dex = 10;
  @type("number") hp = 10;
  @type("number") maxHp = 10;
  @type("number") movePoints = 4;
  @type("number") maxMovePoints = 4;
  @type("number") gridX = 0;
  @type("number") gridY = 0;
}

class ObstacleState extends Schema {
  @type("string") id = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") width = 0;
  @type("number") height = 0;
}

class CombatState extends Schema {
  @type("boolean") active = false;
  @type("number") turnIndex = 0;
  @type(["string"]) turnOrder = new ArraySchema<string>();
  @type("string") activeTokenId = "";
  @type("number") gridSize = 8;
  @type("number") gridCellSize = 64;
  @type("number") originX = 120;
  @type("number") originY = 80;
}

class GameState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: TokenState }) tokens = new MapSchema<TokenState>();
  @type([ObstacleState]) obstacles = new ArraySchema<ObstacleState>();
  @type(CombatState) combat = new CombatState();
}

const SPEED = 180;

class VTTRoom extends Room<GameState> {
  private races: RaceData[] = [];
  private classes: ClassData[] = [];
  private spells: SpellData[] = [];
  private monsters: MonsterData[] = [];
  private gmId = "";

  onCreate() {
    this.setState(new GameState());
    this.loadData();
    this.seedObstacles();

    this.setSimulationInterval((deltaTime) => this.update(deltaTime));

    this.onMessage("move", (client, payload: { x: number; y: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.mode !== "exploration") {
        return;
      }
      const token = this.state.tokens.get(player.tokenId);
      if (!token) {
        return;
      }
      token.targetX = payload.x;
      token.targetY = payload.y;
    });

    this.onMessage(
      "combat_move",
      (client, payload: { gridX: number; gridY: number }) => {
        const player = this.state.players.get(client.sessionId);
        if (!player || !this.state.combat.active || player.mode !== "combat") {
          return;
        }
        if (this.state.combat.activeTokenId !== player.tokenId) {
          return;
        }
        const token = this.state.tokens.get(player.tokenId);
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
      const player = this.state.players.get(client.sessionId);
      if (!player || !this.state.combat.active || player.mode !== "combat") {
        return;
      }
      if (this.state.combat.activeTokenId !== player.tokenId) {
        return;
      }
      this.state.combat.turnIndex =
        (this.state.combat.turnIndex + 1) % this.state.combat.turnOrder.length;
      const nextTokenId = this.state.combat.turnOrder[this.state.combat.turnIndex];
      const nextToken = this.state.tokens.get(nextTokenId);
      if (nextToken) {
        nextToken.movePoints = nextToken.maxMovePoints;
      }
      this.state.combat.activeTokenId = nextTokenId;
    });

    this.onMessage("spawn_monster", (client, payload: { monsterId: string }) => {
      const player = this.state.players.get(client.sessionId);
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
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.isGM) {
        return;
      }
      this.startCombat();
    });

    this.onMessage("chat", (client, payload: { text: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) {
        return;
      }
      const message = `[${player.name}] ${payload.text.slice(0, 200)}`;
      this.broadcast("chat", { message });
    });

    this.onMessage("roll", (client, payload: { kind: "d20" | "attack" | "skill" }) => {
      const player = this.state.players.get(client.sessionId);
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
        const player = this.state.players.get(client.sessionId);
        if (!player) {
          return;
        }
        const spell = this.spells.find((entry) => entry.id === payload.spellId);
        if (!spell) {
          return;
        }
        const token = this.state.tokens.get(player.tokenId);
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
    const isGM = this.state.players.size === 0;
    const player = new PlayerState();
    player.id = client.sessionId;
    player.name = options.name ?? `Heros-${client.sessionId.slice(0, 4)}`;
    player.raceId = options.raceId ?? "human";
    player.classId = options.classId ?? "fighter";
    player.isGM = isGM;
    const stats = this.resolveStats(player.raceId, player.classId);
    player.dex = stats.dex;
    player.hp = stats.hp;
    player.maxHp = stats.hp;
    this.state.players.set(client.sessionId, player);

    if (isGM) {
      this.gmId = player.id;
    }

    const token = new TokenState();
    token.id = `token_${client.sessionId}`;
    token.name = player.name;
    token.ownerId = player.id;
    token.type = "player";
    token.x = 200 + Math.random() * 200;
    token.y = 200 + Math.random() * 200;
    token.dex = stats.dex;
    token.hp = stats.hp;
    token.maxHp = stats.hp;
    token.maxMovePoints = stats.movePoints;
    token.movePoints = stats.movePoints;
    this.state.tokens.set(token.id, token);
    player.tokenId = token.id;
  }

  onLeave(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      this.state.tokens.delete(player.tokenId);
    }
    this.state.players.delete(client.sessionId);
  }

  private update(deltaTime: number) {
    const deltaSeconds = deltaTime / 1000;
    for (const token of this.state.tokens.values()) {
      const owner = this.state.players.get(token.ownerId);
      if (!owner || owner.mode !== "exploration" || token.targetX < 0 || token.targetY < 0) {
        continue;
      }
      const dx = token.targetX - token.x;
      const dy = token.targetY - token.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 4) {
        token.x = token.targetX;
        token.y = token.targetY;
        token.targetX = -1;
        token.targetY = -1;
        continue;
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
    }
  }

  private loadData() {
    const baseUrl = new URL("../data/", import.meta.url);
    this.races = this.readJson<RaceData[]>(new URL("races.json", baseUrl));
    this.classes = this.readJson<ClassData[]>(new URL("classes.json", baseUrl));
    this.spells = this.readJson<SpellData[]>(new URL("spells.json", baseUrl));
    this.monsters = this.readJson<MonsterData[]>(new URL("monsters.json", baseUrl));
  }

  private readJson<T>(url: URL): T {
    const filePath = fileURLToPath(url);
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  }

  private seedObstacles() {
    const obstacles: MapObstacle[] = [
      { id: "crate", x: 360, y: 180, width: 80, height: 80 },
      { id: "pillar", x: 620, y: 340, width: 60, height: 120 }
    ];
    obstacles.forEach((entry) => {
      const obstacle = new ObstacleState();
      obstacle.id = entry.id;
      obstacle.x = entry.x;
      obstacle.y = entry.y;
      obstacle.width = entry.width;
      obstacle.height = entry.height;
      this.state.obstacles.push(obstacle);
    });
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
    const token = new TokenState();
    token.id = `monster_${monster.id}_${Date.now()}`;
    token.name = monster.name;
    token.ownerId = this.gmId;
    token.type = "monster";
    token.x = 540 + Math.random() * 120;
    token.y = 260 + Math.random() * 120;
    token.dex = monster.dex;
    token.hp = monster.hp;
    token.maxHp = monster.hp;
    token.maxMovePoints = monster.movePoints;
    token.movePoints = monster.movePoints;
    this.state.tokens.set(token.id, token);
  }

  private startCombat() {
    if (this.state.combat.active) {
      return;
    }
    const participants = Array.from(this.state.tokens.values());
    if (participants.length === 0) {
      return;
    }
    this.state.combat.active = true;
    this.state.combat.turnIndex = 0;
    this.state.combat.turnOrder.clear();

    const initiatives = participants.map((token) => ({
      id: token.id,
      roll: Math.floor(Math.random() * 20) + 1 + token.dex
    }));
    initiatives.sort((a, b) => b.roll - a.roll);
    initiatives.forEach((entry) => this.state.combat.turnOrder.push(entry.id));

    participants.forEach((token, index) => {
      const owner = this.state.players.get(token.ownerId);
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
app.use(cors());
app.get("/data/:type", (req, res) => {
  const allowed = new Set(["races", "classes", "spells", "monsters", "quests"]);
  const type = req.params.type;
  if (!allowed.has(type)) {
    res.status(404).send("Not found");
    return;
  }
  const fileUrl = new URL(`../data/${type}.json`, import.meta.url);
  const raw = readFileSync(fileURLToPath(fileUrl), "utf-8");
  res.type("json").send(raw);
});
app.get("/", (_req, res) => {
  res.send("Emberfall VTT server running");
});

const server = createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server })
});

gameServer.define("vtt", VTTRoom);

gameServer.listen(2567);

console.log("Server listening on ws://localhost:2567");
