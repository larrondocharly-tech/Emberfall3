import Phaser from "phaser";
import type { Room } from "colyseus.js";
import type { ClassData, MonsterData, RaceData, SpellData } from "@emberfall3/shared";
import { dataApi } from "./lib/dataApi";
import { FEATURE_MULTIPLAYER } from "./config/features";
import { createLocalAdapter } from "./adapters/localAdapter";
import { createNetworkAdapter } from "./adapters/networkAdapter";
import type { GameAdapter } from "./adapters/types";
import type { PlayerProfile, Session } from "./game/state";
import { initialState } from "./game/state";
import { applyAction } from "./game/reducer";
import { findSessionById } from "./game/engine";

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

function dispatch(action: Parameters<typeof applyAction>[1]) {
  gameState = applyAction(gameState, action);
}

function getPlayerProfile(): PlayerProfile {
  return {
    name: playerNameInput.value.trim() || "Aventurier",
    raceId: raceSelect.value || "human",
    classId: classSelect.value || "fighter"
  };
}

function setSoloView(session: Session | null) {
  if (session) {
    soloSessionId.textContent = `Session: ${session.id}`;
    soloSessionCode.textContent = `Code de room: ${session.code || "----"}`;
    soloPlayerName.textContent = `Pseudo: ${session.player.name}`;
    const raceLabel = races.find((race) => race.id === session.player.raceId)?.name ?? session.player.raceId;
    const classLabel =
      classes.find((entry) => entry.id === session.player.classId)?.name ?? session.player.classId;
    soloPlayerClass.textContent = `Race/Classe: ${raceLabel} · ${classLabel}`;
    soloRoom.style.display = "flex";
    gameView.style.display = "none";
    lobby.style.display = "none";
    hud.style.display = "none";
    chat.style.display = "none";
    combatPanel.style.display = "none";
  } else {
    soloRoom.style.display = "none";
    gameView.style.display = "none";
    lobby.style.display = "flex";
    hud.style.display = "flex";
    chat.style.display = "flex";
    combatPanel.style.display = "none";
  }
}

function navigateToRoom(session: Session) {
  window.history.pushState({}, "", `/room/${session.id}`);
  setSoloView(session);
}

function navigateToLobby() {
  window.history.pushState({}, "", "/");
  setSoloView(null);
}

function renderGameGrid() {
  gamePosition.textContent = `Position: (${tokenPosition.x}, ${tokenPosition.y})`;
  gameGrid.innerHTML = "";
  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      const cell = document.createElement("div");
      cell.style.width = "24px";
      cell.style.height = "24px";
      cell.style.background = "#1e293b";
      cell.style.border = "1px solid #334155";
      cell.style.transition = "border-color 120ms ease, box-shadow 120ms ease";
      cell.style.display = "flex";
      cell.style.alignItems = "center";
      cell.style.justifyContent = "center";
      cell.style.cursor = "pointer";
      if (x === tokenPosition.x && y === tokenPosition.y) {
        const token = document.createElement("div");
        token.style.width = "12px";
        token.style.height = "12px";
        token.style.borderRadius = "999px";
        token.style.background = "#38bdf8";
        token.style.transition = "transform 120ms ease";
        cell.appendChild(token);
      }
      cell.addEventListener("mouseenter", () => {
        cell.style.borderColor = "#94a3b8";
        cell.style.boxShadow = "0 0 0 2px rgba(148, 163, 184, 0.4)";
      });
      cell.addEventListener("mouseleave", () => {
        cell.style.borderColor = "#334155";
        cell.style.boxShadow = "";
      });
      cell.addEventListener("click", () => {
        tokenPosition = {
          x: Math.max(0, Math.min(gridSize - 1, x)),
          y: Math.max(0, Math.min(gridSize - 1, y))
        };
        renderGameGrid();
      });
      gameGrid.appendChild(cell);
    }
  }
}

function setGameView(session: Session) {
  const raceLabel = races.find((race) => race.id === session.player.raceId)?.name ?? session.player.raceId;
  const classLabel =
    classes.find((entry) => entry.id === session.player.classId)?.name ?? session.player.classId;
  gameTitle.textContent = `Jeu — Room ${session.id}`;
  gamePlayer.textContent = `Pseudo: ${session.player.name} • Race: ${raceLabel} • Classe: ${classLabel}`;
  gameView.style.display = "flex";
  soloRoom.style.display = "none";
  lobby.style.display = "none";
  hud.style.display = "none";
  chat.style.display = "none";
  combatPanel.style.display = "none";
  renderGameGrid();
}

function navigateToGame(session: Session) {
  window.history.pushState({}, "", `/game/${session.id}`);
  setGameView(session);
}

function syncRouteFromLocation() {
  const path = window.location.pathname;
  const gameId = path.startsWith("/game/") ? path.slice("/game/".length) : null;
  if (gameId) {
    const existingSession = findSessionById(gameId);
    if (!existingSession) {
      roomInfo.textContent = "Room introuvable (solo local).";
      navigateToLobby();
      return;
    }
    activeSession = existingSession;
    dispatch({ type: "SESSION_JOINED", session: existingSession });
    setGameView(existingSession);
    return;
  }
  const roomId = path.startsWith("/room/") ? path.slice("/room/".length) : null;
  if (!roomId) {
    setSoloView(null);
    return;
  }
  const existingSession = findSessionById(roomId);
  if (!existingSession) {
    roomInfo.textContent = "Room introuvable (solo local).";
    navigateToLobby();
    return;
  }
  activeSession = existingSession;
  dispatch({ type: "SESSION_JOINED", session: existingSession });
  setSoloView(existingSession);
}

const lobby = document.getElementById("lobby") as HTMLDivElement;
const createRoomBtn = document.getElementById("createRoom") as HTMLButtonElement;
const joinRoomBtn = document.getElementById("joinRoom") as HTMLButtonElement;
const playerNameInput = document.getElementById("playerName") as HTMLInputElement;
const roomCodeInput = document.getElementById("roomCode") as HTMLInputElement;
const roomInfo = document.getElementById("roomInfo") as HTMLDivElement;
const soloRoom = document.getElementById("soloRoom") as HTMLDivElement;
const soloSessionId = document.getElementById("soloSessionId") as HTMLDivElement;
const soloSessionCode = document.getElementById("soloSessionCode") as HTMLDivElement;
const soloPlayerName = document.getElementById("soloPlayerName") as HTMLDivElement;
const soloPlayerClass = document.getElementById("soloPlayerClass") as HTMLDivElement;
const enterGameBtn = document.getElementById("enterGame") as HTMLButtonElement;
const gameView = document.getElementById("gameView") as HTMLDivElement;
const gameTitle = document.getElementById("gameTitle") as HTMLDivElement;
const gamePlayer = document.getElementById("gamePlayer") as HTMLDivElement;
const gamePosition = document.getElementById("gamePosition") as HTMLDivElement;
const gameGrid = document.getElementById("gameGrid") as HTMLDivElement;
const backToLobbyBtn = document.getElementById("backToLobby") as HTMLButtonElement;
const copyRoomCodeBtn = document.getElementById("copyRoomCode") as HTMLButtonElement;
const leaveRoomBtn = document.getElementById("leaveRoom") as HTMLButtonElement;
const statusText = document.getElementById("status") as HTMLDivElement;
const gmPanel = document.getElementById("gmPanel") as HTMLDivElement;
const hud = document.getElementById("hud") as HTMLDivElement;
const chat = document.getElementById("chat") as HTMLDivElement;
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

const adapter: GameAdapter = FEATURE_MULTIPLAYER ? createNetworkAdapter() : createLocalAdapter();
let gameState = initialState;
let room: Room<GameStateSchema> | null = null;
let sessionId: string | null = null;
let gridVisible = true;
let races: RaceData[] = [];
let classes: ClassData[] = [];
let spells: SpellData[] = [];
let monsters: MonsterData[] = [];
let lastPointer = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
let activeSession: Session | null = null;
const gridSize = 12;
let tokenPosition = { x: 6, y: 6 };

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
      if (pointer.middleButtonDown()) {
        this.dragging = true;
        this.dragStart = { x: pointer.x, y: pointer.y };
        return;
      }
      if (!room) {
        return;
      }
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
    if (!room || !room.state) {
      return;
    }
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
        const index = ((x / TILE_SIZE) + (y / TILE_SIZE)) % 2;
        this.add.rectangle(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, colors[index]).setOrigin(0.5);
      }
    }
  }

  private renderGrid() {
    if (!this.gridGraphics) {
      return;
    }
    this.gridGraphics.clear();
    if (!gridVisible) {
      return;
    }
    this.gridGraphics.lineStyle(1, 0x334155, 0.6);
    for (let x = 0; x <= WORLD_WIDTH; x += TILE_SIZE) {
      this.gridGraphics.lineBetween(x, 0, x, WORLD_HEIGHT);
    }
    for (let y = 0; y <= WORLD_HEIGHT; y += TILE_SIZE) {
      this.gridGraphics.lineBetween(0, y, WORLD_WIDTH, y);
    }
  }

  private renderCombatGrid(combat: CombatStateSchema) {
    if (!this.combatGridGraphics) {
      return;
    }
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

  private renderTokens(tokens: Record<string, TokenSchema>) {
    Object.entries(tokens).forEach(([id, token]) => {
      let sprite = this.tokenSprites.get(id);
      let label = this.nameLabels.get(id);
      const color = token.type === "monster" ? 0xef4444 : id === getOwnTokenId() ? 0x38bdf8 : 0x22c55e;
      if (!sprite) {
        sprite = this.add.circle(token.x, token.y, 18, color);
        label = this.add.text(token.x, token.y - 26, token.name, {
          color: "#f8fafc",
          fontSize: "12px"
        });
        this.tokenSprites.set(id, sprite);
        this.nameLabels.set(id, label);
      }
      sprite.setPosition(token.x, token.y);
      sprite.setFillStyle(color, 1);
      label?.setPosition(token.x - (label?.width ?? 0) / 2, token.y - 32);
    });

    Array.from(this.tokenSprites.keys()).forEach((id) => {
      if (!tokens[id]) {
        this.tokenSprites.get(id)?.destroy();
        this.nameLabels.get(id)?.destroy();
        this.tokenSprites.delete(id);
        this.nameLabels.delete(id);
      }
    });
  }

  private renderObstacles(obstacles: ObstacleSchema[]) {
    if (!this.obstacleGraphics) {
      return;
    }
    this.obstacleGraphics.clear();
    this.obstacleGraphics.fillStyle(0x334155, 1);
    obstacles.forEach((obstacle) => {
      this.obstacleGraphics.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    });
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

function setStatus(text: string) {
  statusText.textContent = text;
}

function getOwnPlayer() {
  if (!room || !room.state || !sessionId) {
    return null;
  }
  return room.state.players[sessionId];
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
  activeRoom.onMessage("chat", (payload: { message: string }) => {
    appendChat(payload.message);
  });

  activeRoom.onMessage("roll_result", (payload: { message: string }) => {
    appendChat(payload.message);
  });

  activeRoom.onMessage("spell_vfx", (payload: { spellId: string; from: { x: number; y: number }; to: { x: number; y: number } }) => {
    const scene = game.scene.getScene("GameScene") as GameScene;
    playSpellVfx(scene, payload.spellId, payload.from, payload.to);
  });

  activeRoom.onStateChange(() => {
    const state = activeRoom.state as GameStateSchema;
    const player = sessionId ? state.players[sessionId] : null;
    if (player?.isGM) {
      gmPanel.style.display = "block";
    } else {
      gmPanel.style.display = "none";
    }
    if (state.combat?.active) {
      setStatus(`Combat actif - Room ${activeRoom.id}`);
    } else {
      setStatus(`Exploration - Room ${activeRoom.id}`);
    }
  });
}

function playSpellVfx(scene: Phaser.Scene, spellId: string, from: { x: number; y: number }, to: { x: number; y: number }) {
  const spell = spells.find((entry) => entry.id === spellId);
  const color = spell?.color ?? "#f97316";
  const tint = Phaser.Display.Color.HexStringToColor(color).color;

  if (spell?.type === "aura") {
    const aura = scene.add.circle(to.x, to.y, 20, tint, 0.6);
    scene.tweens.add({
      targets: aura,
      scale: 2,
      alpha: 0,
      duration: 600,
      ease: "Sine.easeOut",
      onComplete: () => aura.destroy()
    });
    return;
  }

  if (spell?.type === "impact") {
    const impact = scene.add.circle(to.x, to.y, 14, tint, 0.8);
    scene.tweens.add({
      targets: impact,
      scale: 3,
      alpha: 0,
      duration: 500,
      ease: "Sine.easeOut",
      onComplete: () => impact.destroy()
    });
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
      scene.tweens.add({
        targets: burst,
        scale: 2.5,
        alpha: 0,
        duration: 450,
        onComplete: () => burst.destroy()
      });
    }
  });
}

async function loadData() {
  const [racesData, classesData, spellsData, monstersData] = await Promise.all([
    dataApi.races(),
    dataApi.classes(),
    dataApi.spells(),
    dataApi.monsters()
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
  try {
    const player = { ...getPlayerProfile(), name: playerNameInput.value.trim() || "MJ" };
    const result = await adapter.createRoom(player);
    activeSession = result.session;
    dispatch({ type: "SESSION_CREATED", session: result.session });
    roomInfo.textContent = `Code de room : ${result.session.code}`;
    navigateToRoom(result.session);
  } catch (error) {
    console.error("Failed to create room:", error);
    roomInfo.textContent = "Mode solo actif. Multijoueur bientôt disponible.";
  }
}

async function joinRoom() {
  try {
    const player = getPlayerProfile();
    const code = roomCodeInput.value.trim();
    if (!code) {
      roomInfo.textContent = "Entrez un code.";
      return;
    }
    const result = await adapter.joinRoomById(code, player);
    activeSession = result.session;
    dispatch({ type: "SESSION_JOINED", session: result.session });
    roomInfo.textContent = `Code de room : ${result.session.code}`;
    navigateToRoom(result.session);
  } catch (error) {
    if (!(error instanceof Error && error.message === "Room introuvable (solo local).")) {
      console.error("Failed to join room:", error);
    }
    roomInfo.textContent =
      error instanceof Error ? error.message : "Room introuvable (solo local).";
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
  void createRoom();
});

joinRoomBtn.addEventListener("click", () => {
  void joinRoom();
});

enterGameBtn.addEventListener("click", () => {
  if (!activeSession) {
    return;
  }
  navigateToGame(activeSession);
});

leaveRoomBtn.addEventListener("click", () => {
  activeSession = null;
  dispatch({ type: "SESSION_LEFT" });
  navigateToLobby();
});

copyRoomCodeBtn.addEventListener("click", async () => {
  if (!activeSession) {
    return;
  }
  try {
    await navigator.clipboard.writeText(activeSession.code);
    roomInfo.textContent = `Code copié: ${activeSession.code}`;
  } catch (error) {
    console.error("Failed to copy room code:", error);
    roomInfo.textContent = "Impossible de copier le code.";
  }
});

backToLobbyBtn.addEventListener("click", () => {
  activeSession = null;
  dispatch({ type: "SESSION_LEFT" });
  navigateToLobby();
});

spawnMonsterBtn.addEventListener("click", () => {
  if (!room) {
    return;
  }
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
  if (!room) {
    return;
  }
  const spellId = spellSelect.value;
  room.send("cast_spell", { spellId, target: lastPointer });
});

rollD20Btn.addEventListener("click", () => {
  room?.send("roll", { kind: "d20" });
});

rollAttackBtn.addEventListener("click", () => {
  room?.send("roll", { kind: "attack" });
});

rollSkillBtn.addEventListener("click", () => {
  room?.send("roll", { kind: "skill" });
});

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
if (!FEATURE_MULTIPLAYER) {
  roomInfo.textContent = "Mode solo actif. Multijoueur bientôt disponible.";
}

loadData()
  .then(() => {
    syncRouteFromLocation();
  })
  .catch((error) => {
    console.error("Failed to load local data:", error);
    roomInfo.textContent = "Impossible de charger les données locales.";
  });

window.addEventListener("popstate", () => {
  syncRouteFromLocation();
});

void game;
