import Phaser from "phaser";
import { Client as ColyseusClient, Room } from "colyseus.js";
import { Client } from "colyseus.js";
import type { ClassData, MonsterData, RaceData, SpellData } from "@emberfall3/shared";

/**
 * ✅ BLOQUER LE MENU CLIC DROIT TOUT DE SUITE (AVANT TOUT)
 * Sinon le navigateur prend la priorité et Phaser reçoit parfois rien.
 */
window.addEventListener(
  "contextmenu",
  (e) => {
    e.preventDefault();
  },
  { passive: false }
);

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
  players: Map<string, PlayerSchema>;
  tokens: Map<string, TokenSchema>;
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

let room: any = null;
let sessionId = "";
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
    /**
     * ✅ ULTRA IMPORTANT
     * Désactive le menu contextuel côté Phaser Input.
     * Sans ça, pointer.rightButtonDown() peut ne jamais être pris.
     */
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
      // ✅ DEBUG: tu dois voir ça en console quand tu cliques droit
      // 0 = gauche, 1 = milieu, 2 = droit
      console.log("POINTER DOWN button =", pointer.button);

      if (pointer.middleButtonDown()) {
        this.dragging = true;
        this.dragStart = { x: pointer.x, y: pointer.y };
        return;
      }

      if (!room) return;

      const state = room.state as GameStateSchema;
      const combat = state.combat as CombatStateSchema;

      if (pointer.rightButtonDown()) {
        if (combat.active) {
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
  // ✅ Guard: pas de room / pas de state => on ne fait rien
  if (!room) return;

  const state: any = room.state;
  if (!state) return; // ✅ évite "state is null"

  // ⚠️ Enlève le spam
  // console.log("step");  // ❌ supprime

  // Exemple : si tu as des renderers
  // (garde tes fonctions existantes)
  try {
    // si ton code attend state.obstacles
    const obstacles = Array.isArray(state.obstacles) ? state.obstacles : [];
    this.renderObstacles?.(obstacles);

    // si ton code attend state.players
    const players = state.players ?? {};
    this.renderPlayers?.(players);

    // ... ton reste de logique update (caméra, drag, etc.)
  } catch (e) {
    // optionnel : évite de crasher la boucle
    console.error("update error:", e);
  }
}


  private createTilemap() {
    const colors = [0x0f172a, 0x1e293b];
    for (let y = 0; y < WORLD_HEIGHT; y += TILE_SIZE) {
      for (let x = 0; x < WORLD_WIDTH; x += TILE_SIZE) {
        const index = (x / TILE_SIZE + y / TILE_SIZE) % 2;
        this.add
          .rectangle(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, colors[index])
          .setOrigin(0.5);
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
    if (!combat.active) {
      combatPanel.style.display = "none";
      return;
    }
    combatPanel.style.display = "flex";

    const current = combat.activeTokenId;
    const currentLabel = current === getOwnTokenId() ? "Vous" : current;
    combatTurn.textContent = `Tour: ${currentLabel}`;

    const order = combat.turnOrder
      .map((id) => resolveTokenName(id))
      .map((name, index) => `${index + 1}. ${name}`)
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

  private renderTokens(tokens: Map<string, TokenSchema>) {
    tokens.forEach((token, id) => {
      let sprite = this.tokenSprites.get(id);
      let label = this.nameLabels.get(id);

      const color = token.type === "monster" ? 0xef4444 : id === getOwnTokenId() ? 0x38bdf8 : 0x22c55e;

      if (!sprite) {
        sprite = this.add.circle(token.x, token.y, 18, color);
        label = this.add.text(token.x, token.y - 26, token.name, { color: "#f8fafc", fontSize: "12px" });
        this.tokenSprites.set(id, sprite);
        this.nameLabels.set(id, label);
      }
      sprite.setPosition(token.x, token.y);
      sprite.setFillStyle(color, 1);
      label?.setPosition(token.x - (label?.width ?? 0) / 2, token.y - 32);
    });

    Array.from(this.tokenSprites.keys()).forEach((id) => {
      if (!tokens.has(id)) {
        this.tokenSprites.get(id)?.destroy();
        this.nameLabels.get(id)?.destroy();
        this.tokenSprites.delete(id);
        this.nameLabels.delete(id);
      }
    });
  }

  private renderObstacles(obstacles: ObstacleSchema[]) {
    if (!this.obstacleGraphics) return;
    this.obstacleGraphics.clear();
    this.obstacleGraphics.fillStyle(0x334155, 1);
    obstacles.forEach((obstacle) => this.obstacleGraphics!.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height));
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  backgroundColor: "#0f172a",
  scene: [GameScene]
});

// ✅ On garde ça aussi (ceinture + bretelles)
game.canvas.oncontextmenu = (e) => e.preventDefault();

const client = new ColyseusClient(SERVER_URL);

function setStatus(text: string) {
  statusText.textContent = text;
}

function getOwnPlayer() {
  return room?.state.players.get(sessionId);
}

function getOwnTokenId() {
  return getOwnPlayer()?.tokenId ?? "";
}

function resolveTokenName(id: string) {
  const token = room?.state.tokens.get(id);
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

  activeRoom.onMessage("spell_vfx", (payload: { spellId: string; from: { x: number; y: number }; to: { x: number; y: number } }) => {
    const scene = game.scene.getScene("GameScene") as GameScene;
    playSpellVfx(scene, payload.spellId, payload.from, payload.to);
  });

  activeRoom.onStateChange(() => {
    const state = activeRoom.state as GameStateSchema;
    const player = state.players.get(sessionId);

    gmPanel.style.display = player?.isGM ? "block" : "none";

    if (state.combat?.active) setStatus(`Combat actif - Room ${activeRoom.id}`);
    else setStatus(`Exploration - Room ${activeRoom.id}`);
  });
}

function playSpellVfx(scene: Phaser.Scene, spellId: string, from: { x: number; y: number }, to: { x: number; y: number }) {
  const spell = spells.find((entry) => entry.id === spellId);
  const color = spell?.color ?? "#f97316";
  const tint = Phaser.Display.Color.HexStringToColor(color).color;

  if (spell?.type === "aura") {
    const aura = scene.add.circle(to.x, to.y, 20, tint, 0.6);
    scene.tweens.add({ targets: aura, scale: 2, alpha: 0, duration: 600, ease: "Sine.easeOut", onComplete: () => aura.destroy() });
    return;
  }

  if (spell?.type === "impact") {
    const impact = scene.add.circle(to.x, to.y, 14, tint, 0.8);
    scene.tweens.add({ targets: impact, scale: 3, alpha: 0, duration: 500, ease: "Sine.easeOut", onComplete: () => impact.destroy() });
    return;
  }

  const projectile = scene.add.circle(from.x, from.y, 8, tint, 1);
  scene.tweens.add({
    targets: projectile,
    x: to.x,
    y: to.y,
    duration: 400,
    ease: "Quad.easeInOut",
    onComplete: () => {
      projectile.destroy();
      const burst = scene.add.circle(to.x, to.y, 12, tint, 0.9);
      scene.tweens.add({ targets: burst, scale: 2.5, alpha: 0, duration: 450, onComplete: () => burst.destroy() });
    }
  });
}

async function loadData() {
  const [racesData, classesData, spellsData, monstersData] = await Promise.all([
    fetch("/data/races").then((res) => res.json()),
    fetch("/data/classes").then((res) => res.json()),
    fetch("/data/spells").then((res) => res.json()),
    fetch("/data/monsters").then((res) => res.json())
  ]);

  races = racesData as RaceData[];
  classes = classesData as ClassData[];
  spells = spellsData as SpellData[];
  monsters = monstersData as MonsterData[];

  raceSelect.innerHTML = races.map((race) => `<option value="${race.id}">${race.name}</option>`).join("");
  classSelect.innerHTML = classes.map((cls) => `<option value="${cls.id}">${cls.name}</option>`).join("");
  spellSelect.innerHTML = spells.map((spell) => `<option value="${spell.id}">${spell.name}</option>`).join("");
  monsterSelect.innerHTML = monsters.map((monster) => `<option value="${monster.id}">${monster.name}</option>`).join("");
}

async function createRoom() {
  const name = playerNameInput.value.trim() || "MJ";
  const raceId = raceSelect.value || "human";
  const classId = classSelect.value || "fighter";
async function createRoom() {
  const name = playerNameInput.value.trim() || "MJ";
  const raceId = raceSelect.value || "human";
  const classId = classSelect.value || "fighter";

  room = await client.joinOrCreate("vtt", {
    name,
    raceId,
    classId,
  });

  enterRoom(room);
  roomInfo.textContent = `Code de room : ${room.id}`;
}

  roomInfo.textContent = `Code de room: ${newRoom.id}`;
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
async function joinRoom() {
  const name = playerNameInput.value.trim() || "Aventurier";
  const raceId = raceSelect.value || "human";
  const classId = classSelect.value || "fighter";
  const code = roomCodeInput.value.trim();

  if (!code) {
    roomInfo.textContent = "Entrez un code.";
    return;
  }

  room = await client.joinById(code, {
    name,
    raceId,
    classId,
  });

  enterRoom(room);
}

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
    roomInfo.textContent = `Erreur: ${error.message}`;
  });
});

joinRoomBtn.addEventListener("click", () => {
  joinRoom().catch((error) => {
    roomInfo.textContent = `Erreur: ${error.message}`;
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
