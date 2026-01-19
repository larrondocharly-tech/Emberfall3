import Phaser from "phaser";
import { Client, Room } from "colyseus.js";
import type { ClassData, MonsterData, RaceData, SpellData } from "@emberfall3/shared";
import { WS_BASE } from "./config";

const SERVER_URL = WS_BASE;
const WORLD_WIDTH = 1024;
const WORLD_HEIGHT = 768;
const TILE_SIZE = 64;

type PlayerSchema = {
  id: string;
  name: string;
  raceId: string;
  classId: string;
  dex: number;
  hp: number;
  maxHp: number;
  isGM: boolean;
  mode: string;
  tokenId: string;
};

type TokenSchema = {
  id: string;
  name: string;
  ownerId: string;
  type: string;
  x: number;
  y: number;
  gridX: number;
  gridY: number;
  movePoints: number;
  maxMovePoints: number;
  hp: number;
  maxHp: number;
};

type ObstacleSchema = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type CombatStateSchema = {
  active: boolean;
  turnIndex: number;
  turnOrder: string[];
  activeTokenId: string;
  gridSize: number;
  gridCellSize: number;
  originX: number;
  originY: number;
};

type GameStateSchema = {
  players: Record<string, PlayerSchema>;
  tokens: Record<string, TokenSchema>;
  obstacles: ObstacleSchema[];
  combat: CombatStateSchema;
};

const lobby = document.getElementById("lobby") as HTMLDivElement;
const createRoomBtn = document.getElementById("createRoom") as HTMLButtonElement;
const joinRoomBtn = document.getElementById("joinRoom") as HTMLButtonElement;
const playerNameInput = document.getElementById("playerName") as HTMLInputElement;
const roomCodeInput = document.getElementById("roomCode") as HTMLInputElement;
const roomInfo = document.getElementById("roomInfo") as HTMLDivElement;
const statusText = document.getElementById("status") as HTMLDivElement;
const gmPanel = document.getElementById("gmPanel") as HTMLDivElement;

const monsterSelect = document.getElementById("monsterSelect") as HTMLSelectElement;
const spawnMonsterBtn = document.getElementById("spawnMonster") as HTMLButtonElement;
const startCombatBtn = document.getElementById("startCombat") as HTMLButtonElement;

const toggleGridBtn = document.getElementById("toggleGrid") as HTMLButtonElement;
const spellSelect = document.getElementById("spellSelect") as HTMLSelectElement;
const castSpellBtn = document.getElementById("castSpell") as HTMLButtonElement;

const rollD20Btn = document.getElementById("rollD20") as HTMLButtonElement;
const rollAttackBtn = document.getElementById("rollAttack") as HTMLButtonElement;
const rollSkillBtn = document.getElementById("rollSkill") as HTMLButtonElement;

const combatPanel = document.getElementById("combatPanel") as HTMLDivElement;
const combatTurn = document.getElementById("combatTurn") as HTMLDivElement;
const turnOrder = document.getElementById("turnOrder") as HTMLDivElement;
const endTurnBtn = document.getElementById("endTurn") as HTMLButtonElement;

const chatLog = document.getElementById("chatLog") as HTMLDivElement;
const chatInput = document.getElementById("chatInput") as HTMLInputElement;

const raceSelect = document.getElementById("raceSelect") as HTMLSelectElement;
const classSelect = document.getElementById("classSelect") as HTMLSelectElement;

const client = new Client(SERVER_URL);

let room: Room<GameStateSchema> | null = null;
let sessionId: string | null = null;

let gridVisible = true;
let races: RaceData[] = [];
let classes: ClassData[] = [];
let spells: SpellData[] = [];
let monsters: MonsterData[] = [];

let lastPointer = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };

class GameScene extends Phaser.Scene {
  private tokenSprites = new Map<string, Phaser.GameObjects.Arc>();
  private nameLabels = new Map<string, Phaser.GameObjects.Text>();

  private gridGraphics?: Phaser.GameObjects.Graphics;
  private combatGridGraphics?: Phaser.GameObjects.Graphics;
  private obstacleGraphics?: Phaser.GameObjects.Graphics;

  private dragging = false;
  private dragStart = { x: 0, y: 0 };

  constructor() {
    super("GameScene");
  }

  create() {
    // IMPORTANT : bloque le menu contextuel pour que le clic droit marche bien dans Phaser
    this.input.mouse?.disableContextMenu();

    this.createTilemap();

    this.gridGraphics = this.add.graphics();
    this.combatGridGraphics = this.add.graphics();
    this.obstacleGraphics = this.add.graphics();

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      lastPointer = { x: pointer.worldX, y: pointer.worldY };

      if (this.dragging) {
        const dx = pointer.x - this.dragStart.x;
        const dy = pointer.y - this.dragStart.y;
        this.cameras.main.scrollX -= dx / this.cameras.main.zoom;
        this.cameras.main.scrollY -= dy / this.cameras.main.zoom;
        this.dragStart = { x: pointer.x, y: pointer.y };
      }
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      // 0 = gauche, 1 = milieu, 2 = droit
      // console.log("POINTER DOWN button =", pointer.button);

      if (pointer.middleButtonDown()) {
        this.dragging = true;
        this.dragStart = { x: pointer.x, y: pointer.y };
        return;
      }

      if (!room) return;

      const state = room.state as GameStateSchema;
      const combat = state.combat as CombatStateSchema;

      if (pointer.rightButtonDown()) {
        if (combat?.active) {
          const gridX = Math.floor((pointer.worldX - combat.originX) / combat.gridCellSize);
          const gridY = Math.floor((pointer.worldY - combat.originY) / combat.gridCellSize);
          room.send("combat_move", { gridX, gridY });
        } else {
          room.send("move", { x: pointer.worldX, y: pointer.worldY });
        }
      }
    });

    this.input.on("pointerup", () => {
      this.dragging = false;
    });

    this.input.on("wheel", (_pointer, _gameObjects, _deltaX, deltaY) => {
      const zoom = Phaser.Math.Clamp(this.cameras.main.zoom - deltaY * 0.001, 0.6, 1.6);
      this.cameras.main.setZoom(zoom);
    });

    endTurnBtn.addEventListener("click", () => {
      room?.send("end_turn", {});
    });
  }

  update() {
    if (!room || !room.state) return;

    const state = room.state as GameStateSchema;
    const obstacles = Array.isArray(state.obstacles) ? state.obstacles : [];
    const tokens = state.tokens ?? {};

    this.renderObstacles(obstacles);
    this.renderTokens(tokens);
    this.renderGrid();
    this.renderCombatGrid(state.combat as CombatStateSchema);
  }

  private createTilemap() {
    const colors = [0x0f172a, 0x1e293b];

    for (let y = 0; y < WORLD_HEIGHT; y += TILE_SIZE) {
      for (let x = 0; x < WORLD_WIDTH; x += TILE_SIZE) {
        const index = (x / TILE_SIZE + y / TILE_SIZE) % 2;
        this.add
          .rectangle(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, colors[index])
          .setOrigin(0.5)
          .setDepth(-20);
      }
    }
  }

  private renderGrid() {
    if (!this.gridGraphics) return;

    this.gridGraphics.clear();
    if (!gridVisible) return;

    this.gridGraphics.lineStyle(1, 0x334155, 0.6);
    for (let x = 0; x <= WORLD_WIDTH; x += TILE_SIZE) this.gridGraphics.lineBetween(x, 0, x, WORLD_HEIGHT);
    for (let y = 0; y <= WORLD_HEIGHT; y += TILE_SIZE) this.gridGraphics.lineBetween(0, y, WORLD_WIDTH, y);
  }

  private renderCombatGrid(combat: CombatStateSchema) {
    if (!this.combatGridGraphics) return;

    this.combatGridGraphics.clear();

    if (!combat?.active) {
      combatPanel.style.display = "none";
      return;
    }

    combatPanel.style.display = "flex";

    const current = combat.activeTokenId ?? "";
    const currentLabel = current === getOwnTokenId() ? "Vous" : resolveTokenName(current);
    combatTurn.textContent = `Tour: ${currentLabel}`;

    const order = (combat.turnOrder ?? [])
      .map((id, index) => `${index + 1}. ${resolveTokenName(id)}`)
      .join("<br />");
    turnOrder.innerHTML = order;

    this.combatGridGraphics.lineStyle(1, 0x64748b, 0.9);

    for (let x = 0; x <= combat.gridSize; x += 1) {
      const startX = combat.originX + x * combat.gridCellSize;
      this.combatGridGraphics.lineBetween(startX, combat.originY, startX, combat.originY + combat.gridSize * combat.gridCellSize);
    }
    for (let y = 0; y <= combat.gridSize; y += 1) {
      const startY = combat.originY + y * combat.gridCellSize;
      this.combatGridGraphics.lineBetween(combat.originX, startY, combat.originX + combat.gridSize * combat.gridCellSize, startY);
    }
  }

  private renderTokens(tokens: Record<string, TokenSchema>) {
    for (const [id, token] of Object.entries(tokens)) {
      let sprite = this.tokenSprites.get(id);
      let label = this.nameLabels.get(id);

      const color =
        token.type === "monster" ? 0xef4444 : id === getOwnTokenId() ? 0x38bdf8 : 0x22c55e;

      if (!sprite) {
        sprite = this.add.circle(token.x, token.y, 18, color).setDepth(10);
        label = this.add.text(token.x, token.y - 26, token.name, {
          color: "#f8fafc",
          fontSize: "12px",
        }).setDepth(11);

        this.tokenSprites.set(id, sprite);
        this.nameLabels.set(id, label);
      }

      sprite.setPosition(token.x, token.y);
      sprite.setFillStyle(color, 1);

      label.setText(token.name);
      label.setPosition(token.x - label.width / 2, token.y - 32);
    }

    for (const id of Array.from(this.tokenSprites.keys())) {
      if (!tokens[id]) {
        this.tokenSprites.get(id)?.destroy();
        this.nameLabels.get(id)?.destroy();
        this.tokenSprites.delete(id);
        this.nameLabels.delete(id);
      }
    }
  }

  private renderObstacles(obstacles: ObstacleSchema[]) {
    if (!this.obstacleGraphics) return;

    this.obstacleGraphics.clear();
    this.obstacleGraphics.fillStyle(0x334155, 1);

    for (const ob of obstacles) {
      this.obstacleGraphics.fillRect(ob.x, ob.y, ob.width, ob.height);
    }
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  backgroundColor: "#0f172a",
  scene: [GameScene],
});

function setStatus(text: string) {
  statusText.textContent = text;
}

function getOwnPlayer() {
  if (!room || !room.state || !sessionId) return null;
  return room.state.players?.[sessionId] ?? null;
}

function getOwnTokenId() {
  return getOwnPlayer()?.tokenId ?? "";
}

function resolveTokenName(id: string) {
  const token = room?.state.tokens?.[id];
  return token?.name ?? id;
}

function appendChat(message: string) {
  const line = document.createElement("div");
  line.textContent = message;
  chatLog.appendChild(line);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function attachRoomListeners(activeRoom: Room<GameStateSchema>) {
  activeRoom.onMessage("chat", (payload: { message: string }) => appendChat(payload.message));
  activeRoom.onMessage("roll_result", (payload: { message: string }) => appendChat(payload.message));

  activeRoom.onStateChange(() => {
    const state = activeRoom.state as GameStateSchema;
    const player = sessionId ? state.players?.[sessionId] : null;

    gmPanel.style.display = player?.isGM ? "block" : "none";
    setStatus(state.combat?.active ? `Combat actif - Room ${activeRoom.id}` : `Exploration - Room ${activeRoom.id}`);
  });
}

async function loadData() {
  const [racesData, classesData, spellsData, monstersData] = await Promise.all([
    fetch("/data/races").then((res) => res.json()),
    fetch("/data/classes").then((res) => res.json()),
    fetch("/data/spells").then((res) => res.json()),
    fetch("/data/monsters").then((res) => res.json()),
  ]);

  races = racesData as RaceData[];
  classes = classesData as ClassData[];
  spells = spellsData as SpellData[];
  monsters = monstersData as MonsterData[];

  raceSelect.innerHTML = races.map((r) => `<option value="${r.id}">${r.name}</option>`).join("");
  classSelect.innerHTML = classes.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
  spellSelect.innerHTML = spells.map((s) => `<option value="${s.id}">${s.name}</option>`).join("");
  monsterSelect.innerHTML = monsters.map((m) => `<option value="${m.id}">${m.name}</option>`).join("");
}

async function createRoom() {
  const name = playerNameInput.value.trim() || "MJ";
  const raceId = raceSelect.value || "human";
  const classId = classSelect.value || "fighter";

  room = await client.joinOrCreate<GameStateSchema>("vtt", { name, raceId, classId });
  enterRoom(room);
  roomInfo.textContent = `Code de room : ${room.id}`;
}

async function joinRoom() {
  const name = playerNameInput.value.trim() || "Aventurier";
  const raceId = raceSelect.value || "human";
  const classId = classSelect.value || "fighter";
  const code = roomCodeInput.value.trim();

  if (!code) {
    roomInfo.textContent = "Entrez un code.";
    return;
  }

  room = await client.joinById<GameStateSchema>(code, { name, raceId, classId });
  enterRoom(room);
}

function enterRoom(activeRoom: Room<GameStateSchema>) {
  room = activeRoom;
  sessionId = activeRoom.sessionId;

  lobby.style.display = "none";
  setStatus(`Connecté à la room ${activeRoom.id}`);
  attachRoomListeners(activeRoom);
}

createRoomBtn.addEventListener("click", () => {
  createRoom().catch((error) => {
    roomInfo.textContent = `Erreur: ${error?.message ?? String(error)}`;
  });
});

joinRoomBtn.addEventListener("click", () => {
  joinRoom().catch((error) => {
    roomInfo.textContent = `Erreur: ${error?.message ?? String(error)}`;
  });
});

spawnMonsterBtn.addEventListener("click", () => {
  if (!room) return;
  const monsterId = monsterSelect.value;
  room.send("spawn_monster", { monsterId });
});

startCombatBtn.addEventListener("click", () => {
  room?.send("start_combat", {});
});

toggleGridBtn.addEventListener("click", () => {
  gridVisible = !gridVisible;
});

castSpellBtn.addEventListener("click", () => {
  if (!room) return;
  const spellId = spellSelect.value;
  room.send("cast_spell", { spellId, target: lastPointer });
});

rollD20Btn.addEventListener("click", () => room?.send("roll", { kind: "d20" }));
rollAttackBtn.addEventListener("click", () => room?.send("roll", { kind: "attack" }));
rollSkillBtn.addEventListener("click", () => room?.send("roll", { kind: "skill" }));

chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && room) {
    const text = chatInput.value.trim();
    if (text.length > 0) {
      room.send("chat", { text });
      chatInput.value = "";
    }
  }
});

setStatus("En attente de connexion...");

loadData().catch(() => {
  roomInfo.textContent = "Impossible de charger les données. Lancez le serveur.";
});

void game;
