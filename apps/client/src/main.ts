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
import { defaultTool, toolLabels } from "./game/tools";
import type { Tool } from "./game/tools";
import { createTopBar } from "./ui/vtt/TopBar";
import { createLeftToolbar } from "./ui/vtt/LeftToolbar";
import type { SidebarTab } from "./ui/vtt/RightSidebar";
import { createRightSidebar } from "./ui/vtt/RightSidebar";
import { createCanvasView } from "./ui/vtt/CanvasView";
import { createBottomControls } from "./ui/vtt/BottomControls";

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

function updateCanvasTransform() {
  if (!canvasWorld) {
    return;
  }
  canvasWorld.style.transform = `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`;
}

function clampZoom(value: number) {
  return Math.min(2, Math.max(0.6, value));
}

function setActiveTool(tool: Tool) {
  activeTool = tool;
  if (tool !== "measure") {
    isMeasuring = false;
    measureStart = null;
    measureEnd = null;
  }
  if (tool !== "draw") {
    isDrawing = false;
    drawStart = null;
    drawEnd = null;
  }
  if (topBarTool) {
    topBarTool.textContent = `Tool: ${toolLabels[tool]}`;
  }
  const toolbar = document.querySelector(".vtt-left-toolbar");
  if (toolbar) {
    toolbar.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("active", button.getAttribute("data-tool") === tool);
    });
  }
  renderGameGrid();
}

function getGridMetrics() {
  const cellSize = 48;
  return { cellSize, step: cellSize };
}

function getGridCoordinates(event: PointerEvent) {
  if (!canvasViewport) {
    return null;
  }
  const rect = canvasViewport.getBoundingClientRect();
  const { step } = getGridMetrics();
  const localX = (event.clientX - rect.left - panOffset.x) / zoomLevel;
  const localY = (event.clientY - rect.top - panOffset.y) / zoomLevel;
  const gridX = Math.floor(localX / step);
  const gridY = Math.floor(localY / step);
  if (Number.isNaN(gridX) || Number.isNaN(gridY)) {
    return null;
  }
  return {
    x: Math.max(0, Math.min(gridSize - 1, gridX)),
    y: Math.max(0, Math.min(gridSize - 1, gridY))
  };
}

function getWorldCoordinates(event: PointerEvent) {
  if (!canvasViewport) {
    return null;
  }
  const rect = canvasViewport.getBoundingClientRect();
  const localX = (event.clientX - rect.left - panOffset.x) / zoomLevel;
  const localY = (event.clientY - rect.top - panOffset.y) / zoomLevel;
  if (!Number.isFinite(localX) || !Number.isFinite(localY)) {
    return null;
  }
  return { x: localX, y: localY };
}

function createPing(x: number, y: number) {
  if (!canvasOverlay) {
    return;
  }
  const ping = document.createElement("div");
  ping.className = "vtt-ping";
  ping.style.left = `${x}px`;
  ping.style.top = `${y}px`;
  canvasOverlay.appendChild(ping);
  window.setTimeout(() => {
    ping.remove();
  }, 1000);
}

function renderGameGrid() {
  if (!gamePosition || !canvasWorld) {
    return;
  }
  gamePosition.textContent = `Position: (${tokenPosition.x}, ${tokenPosition.y})`;
  if (!canvasGridLayer || !canvasOverlay) {
    return;
  }
  canvasGridLayer.innerHTML = "";
  if (canvasTokenLayer) {
    canvasTokenLayer.innerHTML = "";
  }
  canvasOverlay.innerHTML = "";
  const { step } = getGridMetrics();
  const worldSize = gridSize * step;
  canvasWorld.style.width = `${worldSize}px`;
  canvasWorld.style.height = `${worldSize}px`;

  canvasGridLayer.style.display = gridVisible ? "block" : "none";
  canvasGridLayer.style.backgroundImage =
    "linear-gradient(to right, rgba(148, 163, 184, 0.9) 1px, transparent 1px)," +
    "linear-gradient(to bottom, rgba(148, 163, 184, 0.9) 1px, transparent 1px)";
  canvasGridLayer.style.backgroundSize = `${step}px ${step}px`;
  canvasGridLayer.style.backgroundPosition = "0 0";

  if (canvasTokenLayer) {
    const token = document.createElement("div");
    token.className = "vtt-token";
    const tokenSize = step * 0.7;
    token.style.width = `${tokenSize}px`;
    token.style.height = `${tokenSize}px`;
    token.style.left = `${tokenPosition.x * step + step / 2}px`;
    token.style.top = `${tokenPosition.y * step + step / 2}px`;
    canvasTokenLayer.appendChild(token);
  }

  drawZones.forEach((zone) => {
    const rect = document.createElement("div");
    rect.style.position = "absolute";
    rect.style.left = `${zone.x * step}px`;
    rect.style.top = `${zone.y * step}px`;
    rect.style.width = `${zone.width * step - 4}px`;
    rect.style.height = `${zone.height * step - 4}px`;
    rect.style.background = "rgba(56, 189, 248, 0.15)";
    rect.style.border = "1px solid rgba(56, 189, 248, 0.6)";
    rect.style.borderRadius = "4px";
    canvasOverlay.appendChild(rect);
  });

  if (isDrawing && drawStart && drawEnd) {
    const rect = document.createElement("div");
    const minX = Math.min(drawStart.x, drawEnd.x);
    const minY = Math.min(drawStart.y, drawEnd.y);
    const width = Math.abs(drawEnd.x - drawStart.x) + 1;
    const height = Math.abs(drawEnd.y - drawStart.y) + 1;
    rect.style.position = "absolute";
    rect.style.left = `${minX * step}px`;
    rect.style.top = `${minY * step}px`;
    rect.style.width = `${width * step - 4}px`;
    rect.style.height = `${height * step - 4}px`;
    rect.style.background = "rgba(148, 163, 184, 0.2)";
    rect.style.border = "1px dashed rgba(148, 163, 184, 0.8)";
    rect.style.borderRadius = "4px";
    canvasOverlay.appendChild(rect);
  }

  if (measureStart && measureEnd) {
    const line = document.createElement("div");
    const startX = measureStart.x * step + step / 2;
    const startY = measureStart.y * step + step / 2;
    const endX = measureEnd.x * step + step / 2;
    const endY = measureEnd.y * step + step / 2;
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    line.style.position = "absolute";
    line.style.left = `${startX}px`;
    line.style.top = `${startY}px`;
    line.style.width = `${length}px`;
    line.style.height = "2px";
    line.style.background = "rgba(248, 113, 113, 0.9)";
    line.style.transformOrigin = "0 0";
    line.style.transform = `rotate(${angle}rad)`;
    canvasOverlay.appendChild(line);

    const label = document.createElement("div");
    const gridDistance = Math.max(
      Math.abs(measureEnd.x - measureStart.x),
      Math.abs(measureEnd.y - measureStart.y)
    );
    label.textContent = `${gridDistance} cases`;
    label.style.position = "absolute";
    label.style.left = `${(startX + endX) / 2}px`;
    label.style.top = `${(startY + endY) / 2}px`;
    label.style.transform = "translate(-50%, -50%)";
    label.style.background = "rgba(15, 23, 42, 0.8)";
    label.style.padding = "2px 6px";
    label.style.borderRadius = "6px";
    label.style.fontSize = "12px";
    label.style.color = "#f8fafc";
    canvasOverlay.appendChild(label);
  }
}

function setGameView(session: Session) {
  const raceLabel = races.find((race) => race.id === session.player.raceId)?.name ?? session.player.raceId;
  const classLabel =
    classes.find((entry) => entry.id === session.player.classId)?.name ?? session.player.classId;
  if (!gameView.hasChildNodes()) {
    const topBar = createTopBar();
    const leftToolbar = createLeftToolbar(activeTool, setActiveTool);
    const canvasView = createCanvasView({ mapUrl: gameState.scene.mapUrl });
    const rightSidebar = createRightSidebar();
    const bottom = createBottomControls();

    const body = document.createElement("div");
    body.className = "vtt-body";

    body.appendChild(leftToolbar);
    body.appendChild(canvasView.root);
    body.appendChild(rightSidebar.root);

    bottom.root.style.position = "absolute";
    bottom.root.style.right = "16px";
    bottom.root.style.bottom = "16px";

    canvasView.root.appendChild(bottom.root);

    gameView.appendChild(topBar.root);
    gameView.appendChild(body);

    gamePosition = canvasView.position;
    canvasWorld = canvasView.world;
    canvasOverlay = canvasView.overlayLayer;
    canvasViewport = canvasView.viewport;
    canvasGridLayer = canvasView.gridLayer;
    canvasTokenLayer = canvasView.tokenLayer;
    rightSidebarRoot = rightSidebar.root;
    topBarRoom = topBar.room;
    topBarStatus = topBar.status;
    topBarTool = topBar.tool;
    toggleSidebarBtn = topBar.toggleSidebar;
    backToLobbyBtn = rightSidebar.backButton;
    tabButtons = rightSidebar.tabs;
    tabContents = rightSidebar.contents;
    bottomControls = bottom;

    toggleSidebarBtn.addEventListener("click", () => {
      if (!rightSidebarRoot) {
        return;
      }
      rightSidebarRoot.classList.toggle("vtt-sidebar-collapsed");
    });

    setActiveTool(activeTool);

    const tabs = tabButtons;
    const contents = tabContents;
    if (tabs && contents) {
      (Object.keys(tabs) as Array<keyof typeof tabs>).forEach((label) => {
        const tab = tabs[label];
        tab.addEventListener("click", () => {
          (Object.keys(tabs) as Array<keyof typeof tabs>).forEach((key) => {
            tabs[key].classList.toggle("active", key === label);
            contents[key].style.display = key === label ? "block" : "none";
          });
        });
      });
    }

    if (bottomControls) {
      bottomControls.zoomIn.addEventListener("click", () => {
        zoomLevel = clampZoom(zoomLevel + 0.1);
        updateCanvasTransform();
      });
      bottomControls.zoomOut.addEventListener("click", () => {
        zoomLevel = clampZoom(zoomLevel - 0.1);
        updateCanvasTransform();
      });
      bottomControls.reset.addEventListener("click", () => {
        zoomLevel = 1;
        panOffset = { x: 0, y: 0 };
        updateCanvasTransform();
      });
      bottomControls.toggleGrid.addEventListener("click", () => {
        gridVisible = !gridVisible;
        renderGameGrid();
      });
    }

    if (backToLobbyBtn) {
      backToLobbyBtn.addEventListener("click", () => {
        activeSession = null;
        dispatch({ type: "SESSION_LEFT" });
        navigateToLobby();
      });
    }

    if (canvasViewport) {
      const handlePointerDown = (event: PointerEvent) => {
        const isPanMode = activeTool === "pan" || isSpacePressed || event.button === 1;
        if (isPanMode) {
          isPanning = true;
          panStart = { x: event.clientX - panOffset.x, y: event.clientY - panOffset.y };
          canvasViewport?.setPointerCapture(event.pointerId);
          return;
        }
        if (activeTool === "token" && event.button === 0) {
          const coords = getGridCoordinates(event);
          if (coords) {
            tokenPosition = {
              x: Math.max(0, Math.min(gridSize - 1, coords.x)),
              y: Math.max(0, Math.min(gridSize - 1, coords.y))
            };
            renderGameGrid();
          }
          return;
        }
        if (activeTool === "measure") {
          const coords = getGridCoordinates(event);
          if (coords) {
            isMeasuring = true;
            measureStart = coords;
            measureEnd = coords;
            renderGameGrid();
            canvasViewport?.setPointerCapture(event.pointerId);
          }
          return;
        }
        if (activeTool === "ping" && event.button === 0) {
          const coords = getWorldCoordinates(event);
          if (coords) {
            createPing(coords.x, coords.y);
          }
          return;
        }
        if (activeTool === "draw") {
          const coords = getGridCoordinates(event);
          if (coords) {
            isDrawing = true;
            drawStart = coords;
            drawEnd = coords;
            renderGameGrid();
            canvasViewport?.setPointerCapture(event.pointerId);
          }
        }
      };
      const handlePointerMove = (event: PointerEvent) => {
        if (isPanning) {
          panOffset = { x: event.clientX - panStart.x, y: event.clientY - panStart.y };
          updateCanvasTransform();
          return;
        }
        if (isMeasuring && activeTool === "measure") {
          const coords = getGridCoordinates(event);
          if (coords) {
            measureEnd = coords;
            renderGameGrid();
          }
          return;
        }
        if (isDrawing && activeTool === "draw") {
          const coords = getGridCoordinates(event);
          if (coords) {
            drawEnd = coords;
            renderGameGrid();
          }
        }
      };
      const handlePointerUp = (event: PointerEvent) => {
        if (isPanning) {
          isPanning = false;
          canvasViewport?.releasePointerCapture(event.pointerId);
          return;
        }
        if (isMeasuring) {
          isMeasuring = false;
          canvasViewport?.releasePointerCapture(event.pointerId);
          return;
        }
        if (isDrawing) {
          isDrawing = false;
          if (drawStart && drawEnd) {
            const minX = Math.min(drawStart.x, drawEnd.x);
            const minY = Math.min(drawStart.y, drawEnd.y);
            const width = Math.abs(drawEnd.x - drawStart.x) + 1;
            const height = Math.abs(drawEnd.y - drawStart.y) + 1;
            drawZones = [...drawZones, { x: minX, y: minY, width, height }];
          }
          drawStart = null;
          drawEnd = null;
          renderGameGrid();
          canvasViewport?.releasePointerCapture(event.pointerId);
        }
      };
      canvasViewport.addEventListener("pointerdown", handlePointerDown);
      canvasViewport.addEventListener("pointermove", handlePointerMove);
      canvasViewport.addEventListener("pointerup", handlePointerUp);
      canvasViewport.addEventListener("pointerleave", handlePointerUp);
    }
  }

  if (topBarRoom) {
    topBarRoom.textContent = `Room ${session.id}`;
  }
  if (topBarStatus) {
    topBarStatus.textContent = `Solo · Scene: ${gameState.scene.name}`;
  }
    if (tabContents) {
      tabContents.Actors.innerHTML = `<strong>${session.player.name}</strong><div>${raceLabel} • ${classLabel}</div>`;
      tabContents.Chat.innerHTML =
        `<div class="vtt-chat-log">Aucun message pour l'instant.</div>` +
        `<input class="vtt-chat-input" placeholder="Message..." />`;
      tabContents.Items.textContent = "À venir";
      tabContents.Journal.textContent = "À venir";
      tabContents.Scenes.textContent = "À venir";
    }

  gameView.style.display = "flex";
  soloRoom.style.display = "none";
  lobby.style.display = "none";
  hud.style.display = "none";
  chat.style.display = "none";
  combatPanel.style.display = "none";
  updateCanvasTransform();
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
let zoomLevel = 1;
let panOffset = { x: 0, y: 0 };
let isPanning = false;
let panStart = { x: 0, y: 0 };
let canvasWorld: HTMLDivElement | null = null;
let canvasViewport: HTMLDivElement | null = null;
let canvasOverlay: HTMLDivElement | null = null;
let canvasGridLayer: HTMLDivElement | null = null;
let canvasTokenLayer: HTMLDivElement | null = null;
let gamePosition: HTMLDivElement | null = null;
let rightSidebarRoot: HTMLDivElement | null = null;
let topBarRoom: HTMLSpanElement | null = null;
let topBarStatus: HTMLSpanElement | null = null;
let topBarTool: HTMLSpanElement | null = null;
let toggleSidebarBtn: HTMLButtonElement | null = null;
let backToLobbyBtn: HTMLButtonElement | null = null;
let tabButtons: Record<SidebarTab, HTMLButtonElement> | null = null;
let tabContents: Record<SidebarTab, HTMLDivElement> | null = null;
let bottomControls:
  | {
      zoomIn: HTMLButtonElement;
      zoomOut: HTMLButtonElement;
      reset: HTMLButtonElement;
      toggleGrid: HTMLButtonElement;
    }
  | null = null;
let activeTool: Tool = defaultTool;
let isSpacePressed = false;
let isMeasuring = false;
let measureStart: { x: number; y: number } | null = null;
let measureEnd: { x: number; y: number } | null = null;
let isDrawing = false;
let drawStart: { x: number; y: number } | null = null;
let drawEnd: { x: number; y: number } | null = null;
let drawZones: Array<{ x: number; y: number; width: number; height: number }> = [];

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

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    isSpacePressed = true;
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "Space") {
    isSpacePressed = false;
  }
});

void game;
