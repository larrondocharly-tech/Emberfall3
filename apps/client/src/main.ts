import Phaser from "phaser";
import type { Room } from "colyseus.js";
import type {
  ClassData,
  DialogueNode,
  InventoryState,
  MonsterData,
  NpcDef,
  RaceData,
  SpellData
} from "@emberfall3/shared";
import { dataApi } from "./lib/dataApi";
import { FEATURE_MULTIPLAYER } from "./config/features";
import { createLocalAdapter } from "./adapters/localAdapter";
import { createNetworkAdapter } from "./adapters/networkAdapter";
import type { GameAdapter } from "./adapters/types";
import type { GameToken, PlayerProfile, Session, TokenType } from "./game/state";
import { initialState } from "./game/state";
import { applyAction } from "./game/reducer";
import { findSessionById } from "./game/engine";
import { defaultTool, toolLabels } from "./game/tools";
import type { Tool } from "./game/tools";
import type { Scene } from "./game/scenes";
import { scenes } from "./game/scenes";
import { chebyshevDistance, resolveAttack } from "./game/combat";
import { rollD20 } from "./game/dice";
import { getEnemyAction } from "./game/enemyAI";
import { createTopBar } from "./ui/vtt/TopBar";
import { createLeftToolbar } from "./ui/vtt/LeftToolbar";
import type { SidebarTab } from "./ui/vtt/RightSidebar";
import { createRightSidebar } from "./ui/vtt/RightSidebar";
import { createCanvasView } from "./ui/vtt/CanvasView";
import { createBottomControls } from "./ui/vtt/BottomControls";
import { createCombatHUD } from "./ui/vtt/CombatHUD";
import { createModeMachine } from "./vtt/modeMachine";
import { createSurfaceStore } from "./vtt/effects/surfaces";
import { createStatusStore } from "./vtt/effects/statuses";
import { getSpellById, spellbook } from "./vtt/spells/spellbook";
import type { SpellDefinition } from "./vtt/spells/spellbook";
import {
  createSpellTargetingState,
  expandCells,
  getAreaTargets,
  isCellInRange,
  updateSpellTargetingHover as computeSpellTargetingHover,
  type SpellTargetingState
} from "./vtt/spells/spellTargeting";
import { resolveSpell } from "./vtt/spells/spellResolver";
import { renderOverlayCells } from "./vtt/overlays/overlayLayer";
import { TokenSpriteRenderer } from "./vtt/render/tokenSprites";
import {
  getDialogueNode,
  getItemDef,
  getNpcByScene,
  getNpcDef
} from "./vtt/data/narrativeData";
import { defaultInventoryState, loadGameState, saveGameState } from "./vtt/data/saveManager";

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

const scenePlaceholders = new Map<string, string>();

function createScenePlaceholder(scene: Scene) {
  const cached = scenePlaceholders.get(scene.id);
  if (cached) {
    return cached;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 800;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#0f172a";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#1f2937";
    context.fillRect(40, 40, canvas.width - 80, canvas.height - 80);
    context.strokeStyle = "#334155";
    context.lineWidth = 6;
    context.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);
    context.fillStyle = "#f8fafc";
    context.font = "bold 42px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(`${scene.name} (placeholder)`, canvas.width / 2, canvas.height / 2);
  }
  const dataUrl = canvas.toDataURL("image/png");
  scenePlaceholders.set(scene.id, dataUrl);
  return dataUrl;
}

function applySceneMap(scene: Scene) {
  if (!canvasMapLayer) {
    return;
  }
  const placeholderUrl = createScenePlaceholder(scene);
  canvasMapLayer.style.backgroundImage = `url("${placeholderUrl}")`;
  const image = new Image();
  image.onload = () => {
    if (gameState.scene.id !== scene.id) {
      return;
    }
    canvasMapLayer.style.backgroundImage = `url("${scene.mapUrl}")`;
  };
  image.onerror = () => {
    if (gameState.scene.id !== scene.id) {
      return;
    }
    canvasMapLayer.style.backgroundImage = `url("${placeholderUrl}")`;
  };
  image.src = scene.mapUrl;
}

function resetCameraToScene(scene: Scene) {
  zoomLevel = clampZoom(scene.initialZoom);
  panOffset = { x: scene.initialPanX, y: scene.initialPanY };
  updateCanvasTransform();
}

function applyScene(scene: Scene, options: { resetCamera?: boolean; recenterToken?: boolean } = {}) {
  const { resetCamera = true, recenterToken = false } = options;
  gameState = { ...gameState, scene };
  gridSize = scene.gridSize;
  const centerX = Math.floor(scene.gridSize / 2);
  const centerY = Math.floor(scene.gridSize / 2);
  gameState.tokens = gameState.tokens.map((token) => {
    const next = {
      ...token,
      x: Math.max(0, Math.min(scene.gridSize - 1, token.x)),
      y: Math.max(0, Math.min(scene.gridSize - 1, token.y))
    };
    if (recenterToken && token.type === "player") {
      next.x = centerX;
      next.y = centerY;
    }
    return next;
  });
  if (!getTokenById(selectedTokenId)) {
    selectedTokenId = gameState.tokens[0]?.id ?? null;
  }
  isMeasuring = false;
  measureStart = null;
  measureEnd = null;
  isDrawing = false;
  drawStart = null;
  drawEnd = null;
  drawZones = [];
  if (resetCamera) {
    resetCameraToScene(scene);
  }
  applySceneMap(scene);
  ensureNpcTokensForScene(scene.id);
  if (topBarStatus) {
    topBarStatus.textContent = `Solo · Scene: ${scene.name}`;
  }
  renderGameGrid();
}

function selectToken(id: string | null) {
  selectedTokenId = id;
  renderGameGrid();
  if (activeSession) {
    renderActorsPanel(activeSession);
  }
  updateCombatHUD();
}

function updateTokenPosition(id: string, position: { x: number; y: number }) {
  const clamped = {
    x: Math.max(0, Math.min(gridSize - 1, position.x)),
    y: Math.max(0, Math.min(gridSize - 1, position.y))
  };
  gameState = {
    ...gameState,
    tokens: gameState.tokens.map((token) =>
      token.id === id ? { ...token, x: clamped.x, y: clamped.y } : token
    )
  };
}

function addToken(type: TokenType) {
  const center = Math.floor(gridSize / 2);
  const defaults =
    type === "monster"
      ? { hp: 10, maxHp: 10, ac: 12, attackBonus: 4, initBonus: 2, damage: "1d8+2", color: "#f87171" }
      : { hp: 8, maxHp: 8, ac: 12, attackBonus: 3, initBonus: 1, damage: "1d6+1", color: "#22c55e" };
  const token: GameToken = {
    id: `${type}-${tokenIdCounter++}`,
    name: type === "monster" ? "Monstre" : "PNJ",
    x: center,
    y: center,
    size: 1,
    color: defaults.color,
    type,
    hp: defaults.hp,
    maxHp: defaults.maxHp,
    ac: defaults.ac,
    attackBonus: defaults.attackBonus,
    initBonus: defaults.initBonus,
    damage: defaults.damage,
    actionsPerTurn: 1,
    movementPerTurn: 6,
    actionsRemaining: 1,
    movementRemaining: 6
  };
  gameState = { ...gameState, tokens: [...gameState.tokens, token] };
  selectToken(token.id);
}

function getTokenById(id: string | null) {
  if (!id) {
    return null;
  }
  return gameState.tokens.find((token) => token.id === id) ?? null;
}

function ensureNpcTokensForScene(sceneId: string) {
  const npcs = getNpcByScene(sceneId);
  const npcIdsForScene = new Set(npcs.map((npc) => npc.id));
  const filteredTokens = gameState.tokens.filter((token) =>
    token.type === "npc" ? npcIdsForScene.has(token.id) : true
  );
  const existingIds = new Set(filteredTokens.map((token) => token.id));
  const newTokens = npcs
    .filter((npc) => !existingIds.has(npc.id))
    .map((npc) => ({
      id: npc.id,
      name: npc.name,
      x: npc.gridX,
      y: npc.gridY,
      size: 1,
      color: "#22c55e",
      type: "npc" as const,
      hp: 8,
      maxHp: 8,
      ac: 10,
      attackBonus: 1,
      initBonus: 0,
      damage: "1d4",
      actionsPerTurn: 1,
      movementPerTurn: 4,
      actionsRemaining: 1,
      movementRemaining: 4
    }));
  if (newTokens.length || filteredTokens.length !== gameState.tokens.length) {
    gameState = { ...gameState, tokens: [...filteredTokens, ...newTokens] };
  }
}

function getTokenIdFromEvent(event: PointerEvent) {
  const target = event.target as HTMLElement | null;
  if (!target) {
    return null;
  }
  const tokenEl = target.closest<HTMLElement>(".vtt-token");
  return tokenEl?.dataset.tokenId ?? null;
}

function updateCombatToggle() {
  if (!combatToggleBtn) {
    return;
  }
  combatToggleBtn.textContent = combatState.enabled ? "Combat: ON" : "Combat: OFF";
  combatToggleBtn.classList.toggle("active", combatState.enabled);
}

function getDistanceBetweenTokens(attacker: GameToken, target: GameToken) {
  return chebyshevDistance(attacker, target);
}

function getMoveCost(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = Math.abs(from.x - to.x);
  const dy = Math.abs(from.y - to.y);
  if (dx === 0 && dy === 0) {
    return 0;
  }
  if (dx <= 1 && dy <= 1) {
    return 1;
  }
  return Number.POSITIVE_INFINITY;
}

function appendChatMessage(message: string) {
  appendChat(message);
}

function resetTokenTurnResources(token: GameToken) {
  return {
    ...token,
    actionsRemaining: token.actionsPerTurn,
    movementRemaining: token.movementPerTurn
  };
}

function updateTokenState(id: string, updater: (token: GameToken) => GameToken) {
  gameState = {
    ...gameState,
    tokens: gameState.tokens.map((token) => (token.id === id ? updater(token) : token))
  };
}

function canTokenAct(token: GameToken) {
  return token.actionsRemaining > 0;
}

function canTokenMove(token: GameToken, cost: number) {
  return token.movementRemaining >= cost;
}

function spendTokenAction(tokenId: string) {
  updateTokenState(tokenId, (token) => ({
    ...token,
    actionsRemaining: Math.max(0, token.actionsRemaining - 1)
  }));
  updateCombatHUD();
  if (activeSession) {
    renderActorsPanel(activeSession);
  }
}

function spendTokenActions(tokenId: string, cost: number) {
  for (let i = 0; i < cost; i += 1) {
    spendTokenAction(tokenId);
  }
}

function spendTokenMovement(tokenId: string, cost: number) {
  updateTokenState(tokenId, (token) => ({
    ...token,
    movementRemaining: Math.max(0, token.movementRemaining - cost)
  }));
  updateCombatHUD();
  if (activeSession) {
    renderActorsPanel(activeSession);
  }
}

function getActiveCombatTokenId() {
  if (!combatState.started) {
    return null;
  }
  return combatState.initiativeOrder[combatState.activeIndex] ?? null;
}

function getActiveCombatToken() {
  const tokenId = getActiveCombatTokenId();
  return getTokenById(tokenId);
}

function getTurnContext() {
  const activeToken = getActiveCombatToken();
  const isPlayerTurn = activeToken?.type === "player";
  return {
    combatOn: combatState.enabled,
    combatStarted: combatState.started,
    activeToken,
    isPlayerTurn,
    round: combatState.round
  };
}

function getCombatTurnState() {
  const { activeToken, isPlayerTurn } = getTurnContext();
  return { activeToken, isPlayerTurn };
}

function updateCombatInfo() {
  if (!combatInfo) {
    return;
  }
  if (vttEndTurnBtn) {
    vttEndTurnBtn.style.display = combatState.enabled ? "inline-flex" : "none";
  }
  if (!combatState.enabled) {
    combatInfo.textContent = combatEnded ? "Combat terminé" : "Exploration";
    return;
  }
  if (!combatState.started) {
    combatInfo.textContent = "Combat (préparation)";
    if (vttEndTurnBtn) {
      vttEndTurnBtn.disabled = true;
    }
    return;
  }
  const turnContext = getTurnContext();
  const activeName = turnContext.activeToken?.name ?? "—";
  combatInfo.textContent = `Round ${combatState.round} · Tour de ${activeName}`;
  if (vttEndTurnBtn) {
    vttEndTurnBtn.disabled = false;
  }
  updateCombatHUD();
  updateChatVisibility();
}

function renderPips(container: HTMLDivElement, total: number, remaining: number) {
  container.innerHTML = "";
  if (total <= 0) {
    const empty = document.createElement("span");
    empty.className = "vtt-combat-hud-pip empty";
    container.appendChild(empty);
    return;
  }
  for (let index = 0; index < total; index += 1) {
    const pip = document.createElement("span");
    pip.className = "vtt-combat-hud-pip";
    if (index < remaining) {
      pip.classList.add("active");
    }
    container.appendChild(pip);
  }
}

function updateCombatHUD() {
  if (!combatHud) {
    return;
  }
  if (chat) {
    chat.style.display = combatState.enabled ? "flex" : "none";
  }
  if (!combatState.enabled) {
    combatHud.root.style.display = "none";
    hoveredGridCell = null;
    return;
  }
  combatHud.root.style.display = "grid";
  const turnContext = getTurnContext();
  const activeName = turnContext.activeToken?.name ?? "—";
  const activeType =
    turnContext.activeToken?.type === "player"
      ? "Player"
      : turnContext.activeToken?.type === "npc"
        ? "PNJ"
        : turnContext.activeToken?.type === "monster"
          ? "Monstre"
          : "—";
  combatHud.tokenName.textContent = activeName;
  combatHud.tokenType.textContent = activeType;
  combatHud.round.textContent = `Round ${turnContext.round || "—"}`;
  combatHud.hp.textContent = turnContext.activeToken
    ? `PV: ${turnContext.activeToken.hp}/${turnContext.activeToken.maxHp}`
    : "PV: —";

  const canAct = turnContext.activeToken ? canTokenAct(turnContext.activeToken) : false;
  const actionTotal = turnContext.activeToken?.actionsPerTurn ?? 0;
  const actionRemaining = turnContext.activeToken?.actionsRemaining ?? 0;
  const movementTotal = turnContext.activeToken?.movementPerTurn ?? 0;
  const movementRemaining = turnContext.activeToken?.movementRemaining ?? 0;

  renderPips(combatHud.actionPips, actionTotal, actionRemaining);
  renderPips(combatHud.movementPips, movementTotal, movementRemaining);

  combatHud.actionValue.textContent = `Actions: ${actionRemaining}`;
  combatHud.movementValue.textContent = `Déplacement: ${movementRemaining} cases`;

  combatHud.actionNotice.textContent =
    actionTotal > 0 && actionRemaining === 0 ? "Actions épuisées" : "";
  combatHud.movementNotice.textContent =
    movementTotal > 0 && movementRemaining === 0 ? "Déplacement épuisé" : "";
  const currentMode = modeMachine.getMode();
  if (currentMode === "spell_targeting" && spellTargetingState) {
    combatHud.actionNotice.textContent = `Ciblage : ${spellTargetingState.spell.name} (PO ${spellTargetingState.spell.range}) — Échap pour annuler`;
  } else if (currentMode === "attack") {
    combatHud.actionNotice.textContent = "Sélection d'une cible";
  } else if (currentMode === "spell_menu") {
    combatHud.actionNotice.textContent = "Choisissez un sort";
  }

  combatHud.statusBadge.textContent = turnContext.isPlayerTurn ? "À TON TOUR" : "EN ATTENTE";
  combatHud.statusBadge.classList.toggle("active", turnContext.isPlayerTurn);
  combatHud.statusBadge.classList.toggle("waiting", !turnContext.isPlayerTurn);

  combatHud.attackButton.disabled = !turnContext.isPlayerTurn || !canAct || modeMachine.getMode() === "attack";
  combatHud.spellsButton.disabled = !turnContext.isPlayerTurn || !canAct;
  combatHud.itemsButton.disabled = false;
  combatHud.endTurnButton.disabled = false;

  if (!turnContext.isPlayerTurn) {
    hoveredGridCell = null;
  }
}

function updateChatVisibility() {
  if (!tabContents) {
    return;
  }
  if (combatState.enabled) {
    tabContents.Chat.style.display = "block";
  }
}

function requestAttack(attackerId: string) {
  const attacker = getTokenById(attackerId);
  if (!attacker) {
    return;
  }
  const turnContext = getTurnContext();
  if (turnContext.combatOn && turnContext.combatStarted) {
    if (!turnContext.isPlayerTurn || attackerId !== turnContext.activeToken?.id) {
      showActionWarning("Ce n'est pas votre tour.", "not-your-turn");
      return;
    }
    if (!canTokenAct(attacker)) {
      showActionWarning("Action déjà utilisée.", "action-used");
      return;
    }
  }
  setAttackState(attackerId);
  updateAttackRange(attacker, 1);
  modeMachine.setMode("attack");
  appendChatMessage(`${attacker.name} choisit une cible...`);
}

function requestSimpleAction(kind: "spells" | "items") {
  const turnContext = getTurnContext();
  if (kind === "spells") {
    if (!turnContext.combatOn || !turnContext.combatStarted || !turnContext.activeToken) {
      return;
    }
    if (!turnContext.isPlayerTurn) {
      showActionWarning("Ce n'est pas votre tour.", "not-your-turn");
      return;
    }
    if (!canTokenAct(turnContext.activeToken)) {
      showActionWarning("Action déjà utilisée.", "action-used");
      return;
    }
    toggleSpellMenu();
    return;
  }
  openInventoryPanel();
}

function persistSaveState() {
  saveGameState({
    inventory: inventoryState,
    flags: inventoryFlags,
    quests: questFlags
  });
}

function addItemToInventory(itemId: string, quantity = 1) {
  const def = getItemDef(itemId);
  if (!def) {
    return;
  }
  const current = inventoryState.items[itemId] ?? 0;
  const nextQuantity = def.stackable ? current + quantity : Math.max(current, 1);
  inventoryState = {
    ...inventoryState,
    items: {
      ...inventoryState.items,
      [itemId]: nextQuantity
    }
  };
  persistSaveState();
  renderInventory();
}

function renderInventory() {
  if (!inventoryList || !inventoryDetail) {
    return;
  }
  inventoryList.innerHTML = "";
  const itemIds = Object.keys(inventoryState.items);
  if (itemIds.length === 0) {
    const empty = document.createElement("div");
    empty.className = "vtt-inventory-empty";
    empty.textContent = "Inventaire vide.";
    inventoryList.appendChild(empty);
    inventoryDetail.textContent = "Sélectionnez un objet.";
    return;
  }
  itemIds.forEach((itemId) => {
    const def = getItemDef(itemId);
    if (!def) {
      return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "vtt-inventory-item";
    const qty = inventoryState.items[itemId];
    button.innerHTML = `<span>${def.icon ?? "🎒"} ${def.name}</span><span>x${qty}</span>`;
    button.addEventListener("click", () => {
      inventoryDetail.innerHTML = `<strong>${def.name}</strong><p>${def.description}</p>`;
    });
    inventoryList.appendChild(button);
  });
  const first = getItemDef(itemIds[0]);
  if (first) {
    inventoryDetail.innerHTML = `<strong>${first.name}</strong><p>${first.description}</p>`;
  }
}

function openInventoryPanel() {
  if (!inventoryPanel) {
    return;
  }
  inventoryPanel.classList.add("open");
  renderInventory();
}

function closeInventoryPanel() {
  if (!inventoryPanel) {
    return;
  }
  inventoryPanel.classList.remove("open");
}

function appendSystemLog(message: string) {
  if (!systemLog) {
    return;
  }
  const line = document.createElement("div");
  line.textContent = message;
  systemLog.appendChild(line);
  systemLog.scrollTop = systemLog.scrollHeight;
}

function resolveDialogueForNpc(npc: NpcDef) {
  if (npc.id === "npc_innkeeper" && inventoryFlags.npc_innkeeper_gave_key) {
    return getDialogueNode("innkeeper_after");
  }
  return getDialogueNode(npc.dialogueId);
}

function openDialogue(npc: NpcDef) {
  const node = resolveDialogueForNpc(npc);
  if (!dialoguePanel || !node) {
    return;
  }
  activeNpc = npc;
  activeDialogue = node;
  dialoguePanel.classList.add("open");
  renderDialogueNode(node);
}

function closeDialogue() {
  if (!dialoguePanel) {
    return;
  }
  dialoguePanel.classList.remove("open");
  activeDialogue = null;
  activeNpc = null;
  appendSystemLog("Dialogue terminé.");
}

function renderDialogueNode(node: DialogueNode) {
  if (!dialogueSpeaker || !dialogueText || !dialogueChoices) {
    return;
  }
  dialogueSpeaker.textContent = node.speaker;
  dialogueText.textContent = node.text;
  dialogueChoices.innerHTML = "";
  node.choices.forEach((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = choice.text;
    button.addEventListener("click", () => {
      applyDialogueChoice(choice);
    });
    dialogueChoices.appendChild(button);
  });
}

function resolveGiveItemFlag(npcId: string, itemId: string) {
  if (npcId === "npc_innkeeper" && itemId === "key_tavern") {
    return "npc_innkeeper_gave_key";
  }
  return `${npcId}_gave_${itemId}`;
}

function applyDialogueChoice(choice: DialogueNode["choices"][number]) {
  if (!activeDialogue || !activeNpc) {
    return;
  }
  if (choice.giveItem) {
    const flagKey = resolveGiveItemFlag(activeNpc.id, choice.giveItem);
    if (!inventoryFlags[flagKey]) {
      addItemToInventory(choice.giveItem, 1);
      inventoryFlags = { ...inventoryFlags, [flagKey]: true };
      persistSaveState();
      const def = getItemDef(choice.giveItem);
      appendSystemLog(`Vous recevez: ${def?.name ?? choice.giveItem}`);
    } else {
      appendSystemLog("Vous avez déjà reçu cet objet.");
    }
  }
  if (choice.next) {
    const next = getDialogueNode(choice.next);
    if (next) {
      activeDialogue = next;
      renderDialogueNode(next);
      return;
    }
  }
  if (choice.startQuest) {
    questFlags = { ...questFlags, [choice.startQuest]: true };
    persistSaveState();
    appendSystemLog("Nouvelle quête: Veiller sur la Frontière d'Ember.");
  }
  closeDialogue();
}

function openSpellMenu() {
  if (!spellMenuRef) {
    return;
  }
  isSpellMenuOpen = true;
  spellMenuRef.classList.add("open");
}

function closeSpellMenu(options?: { preserveMode?: boolean }) {
  if (!spellMenuRef) {
    return;
  }
  isSpellMenuOpen = false;
  spellMenuRef.classList.remove("open");
  if (!options?.preserveMode && modeMachine.getMode() === "spell_menu") {
    modeMachine.setMode("idle");
  }
}

function toggleSpellMenu() {
  if (isSpellMenuOpen) {
    closeSpellMenu();
    return;
  }
  modeMachine.setMode("spell_menu");
  openSpellMenu();
}

function toggleSpellMenu() {
  if (isSpellMenuOpen) {
    closeSpellMenu();
    return;
  }
  modeMachine.setMode("spell_menu");
  openSpellMenu();
}



function startCombat() {
  if (!combatState.enabled || combatState.started) {
    return;
  }
  combatEnded = false;
  gameState = {
    ...gameState,
    tokens: gameState.tokens.map((token) => resetTokenTurnResources(token))
  };
  const rolls = gameState.tokens.map((token) => ({
    id: token.id,
    name: token.name,
    total: rollD20() + token.initBonus
  }));
  rolls.sort((a, b) => b.total - a.total);
  combatState = {
    ...combatState,
    started: true,
    initiativeOrder: rolls.map((roll) => roll.id),
    activeIndex: 0,
    round: 1
  };
  appendChatMessage("Combat démarré.");
  appendChatMessage(
    `Ordre d'initiative: ${rolls.map((roll) => `${roll.name}(${roll.total})`).join(", ")}.`
  );
  const combatTurnState = getCombatTurnState();
  if (combatTurnState.activeToken) {
    appendChatMessage(`Tour ${combatState.round}: ${combatTurnState.activeToken.name}.`);
  }
  updateCombatInfo();
  if (activeSession) {
    renderActorsPanel(activeSession);
  }
  renderGameGrid();
  triggerEnemyTurnIfNeeded();
}

function resetCombat() {
  modeMachine.setMode("idle");
  combatState = {
    ...combatState,
    enabled: false,
    started: false,
    initiativeOrder: [],
    activeIndex: 0,
    round: 0
  };
  combatEnded = true;
  gameState = {
    ...gameState,
    tokens: gameState.tokens.map((token) => resetTokenTurnResources(token))
  };
  isAITurnRunning = false;
  appendChatMessage("Fin du combat.");
  updateCombatInfo();
  renderGameGrid();
  if (activeSession) {
    renderActorsPanel(activeSession);
  }
  updateCombatHUD();
}

function endTurn() {
  if (!combatState.enabled || !combatState.started) {
    return;
  }
  if (attackState || modeMachine.getMode() !== "idle") {
    modeMachine.setMode("idle");
  }
  const nextIndex = combatState.activeIndex + 1;
  let nextRound = combatState.round;
  let activeIndex = nextIndex;
  if (nextIndex >= combatState.initiativeOrder.length) {
    activeIndex = 0;
    nextRound = combatState.round + 1;
    appendChatMessage(`Round ${nextRound}.`);
  }
  combatState = {
    ...combatState,
    activeIndex,
    round: nextRound
  };
  const nextTokenId = combatState.initiativeOrder[activeIndex];
  if (nextTokenId) {
    updateTokenState(nextTokenId, (token) => resetTokenTurnResources(token));
  }
  tickTurnEffects();
  const combatTurnState = getCombatTurnState();
  if (combatTurnState.activeToken) {
    appendChatMessage(`Tour: ${combatTurnState.activeToken.name}.`);
  }
  updateCombatInfo();
  if (activeSession) {
    renderActorsPanel(activeSession);
  }
  renderGameGrid();
  triggerEnemyTurnIfNeeded();
}

function triggerEnemyTurnIfNeeded() {
  if (!combatState.enabled || !combatState.started) {
    return;
  }
  const combatTurnState = getCombatTurnState();
  if (!combatTurnState.activeToken || combatTurnState.activeToken.type === "player") {
    return;
  }
  if (isAITurnRunning) {
    return;
  }
  isAITurnRunning = true;
  window.setTimeout(() => {
    runEnemyTurn(combatTurnState.activeToken.id);
  }, 300);
}

function runEnemyTurn(tokenId: string) {
  if (!combatState.enabled || !combatState.started) {
    isAITurnRunning = false;
    return;
  }
  const enemy = getTokenById(tokenId);
  if (!enemy || enemy.type === "player") {
    isAITurnRunning = false;
    return;
  }
  if (getActiveCombatTokenId() !== enemy.id) {
    isAITurnRunning = false;
    return;
  }
  const action = getEnemyAction(enemy, gameState.tokens);
  if (!action.targetId) {
    appendChatMessage(`${enemy.name} ne trouve aucune cible.`);
    isAITurnRunning = false;
    endTurn();
    return;
  }
  const target = getTokenById(action.targetId);
  if (!target || target.id === enemy.id) {
    appendChatMessage(`${enemy.name} ne trouve aucune cible.`);
    isAITurnRunning = false;
    endTurn();
    return;
  }
  if (action.nextPosition && enemy.movementRemaining > 0) {
    updateTokenPosition(enemy.id, action.nextPosition);
    spendTokenMovement(enemy.id, 1);
    applySurfaceToToken(enemy.id);
    renderGameGrid();
  }
  const distance = getDistanceBetweenTokens(
    getTokenById(enemy.id) ?? enemy,
    target
  );
  if (distance <= 1 && canTokenAct(enemy)) {
    const result = resolveAttack(enemy, target);
    const rollText = `${result.roll} + ${enemy.attackBonus} = ${result.total}`;
    const outcome = result.hit ? "HIT" : "MISS";
    appendChatMessage(
      `${enemy.name} attaque ${target.name}: d20(${rollText}) vs AC ${target.ac} → ${outcome}`
    );
    if (result.hit) {
      const rolls = result.damageRolls.length ? result.damageRolls.join(", ") : "-";
      const damageText = `${enemy.damage} [${rolls}]`;
      gameState = {
        ...gameState,
        tokens: gameState.tokens.map((token) =>
          token.id === target.id ? { ...token, hp: result.remainingHp } : token
        )
      };
      appendChatMessage(`Dégâts: ${damageText} = ${result.damageTotal}. PV ${target.name}: ${result.remainingHp}/${target.maxHp}`);
      if (activeSession) {
        renderActorsPanel(activeSession);
      }
      renderGameGrid();
    }
    spendTokenAction(enemy.id);
  } else {
    appendChatMessage(`${enemy.name} est trop loin pour attaquer.`);
  }
  isAITurnRunning = false;
  endTurn();
}

function setAttackState(attackerId: string | null) {
  attackState = attackerId ? { attackerId, awaitingTarget: true } : null;
  hoveredTokenId = null;
  if (canvasViewport) {
    if (attackState) {
      canvasViewport.style.cursor = "crosshair";
    } else {
      setActiveTool(activeTool);
    }
  }
  renderGameGrid();
  if (activeSession) {
    renderActorsPanel(activeSession);
  }
  updateCombatHUD();
}

function clearMeasure() {
  if (!isMeasuring && !measureStart && !measureEnd) {
    measureLocked = false;
    return;
  }
  isMeasuring = false;
  measureLocked = false;
  measureStart = null;
  measureEnd = null;
  renderGameGrid();
}

function handleAttackTarget(targetId: string) {
  if (!attackState || modeMachine.getMode() !== "attack") {
    return;
  }
  const turnContext = getTurnContext();
  if (!turnContext.activeToken) {
    return;
  }
  const attacker = getTokenById(attackState.attackerId);
  const target = getTokenById(targetId);
  if (!attacker || !target) {
    modeMachine.setMode("idle");
    return;
  }
  if (attacker.id === target.id) {
    showActionWarning(`${attacker.name} ne peut pas s'attaquer lui-même.`);
    modeMachine.setMode("idle");
    return;
  }
  if (turnContext.combatStarted && attacker.id !== turnContext.activeToken.id) {
    showActionWarning("Ce n'est pas votre tour.", "not-your-turn");
    modeMachine.setMode("idle");
    return;
  }
  if (turnContext.combatStarted && !canTokenAct(attacker)) {
    showActionWarning("Action déjà utilisée.", "action-used");
    modeMachine.setMode("idle");
    return;
  }
  if (!attackRangeCells.has(`${target.x},${target.y}`)) {
    showActionWarning("Hors de portée.", "out-of-range");
    return;
  }
  const result = resolveAttack(attacker, target);
  playMeleeAttackFX(attacker.id, { x: target.x, y: target.y });
  const rollText = `${result.roll} + ${attacker.attackBonus} = ${result.total}`;
  const outcome = result.hit ? "HIT" : "MISS";
  appendChatMessage(
    `${attacker.name} attaque ${target.name}: d20(${rollText}) vs AC ${target.ac} → ${outcome}`
  );
  if (result.hit) {
    const rolls = result.damageRolls.length ? result.damageRolls.join(", ") : "-";
    const damageText = `${attacker.damage} [${rolls}]`;
    gameState = {
      ...gameState,
      tokens: gameState.tokens.map((token) =>
        token.id === target.id ? { ...token, hp: result.remainingHp } : token
      )
    };
    appendChatMessage(
      `Dégâts: ${damageText} = ${result.damageTotal}. PV ${target.name}: ${result.remainingHp}/${target.maxHp}`
    );
    if (activeSession) {
      renderActorsPanel(activeSession);
    }
    scene?.playTokenHit(target.id);
  }
  if (turnContext.combatStarted) {
    spendTokenAction(attacker.id);
  }
  modeMachine.setMode("idle");
  renderGameGrid();
}

function playMeleeAttackFX(attackerId: string, targetCell: { x: number; y: number }) {
  if (!tokenSpriteRenderer) {
    return;
  }
  tokenSpriteRenderer.playMeleeAttackFX(attackerId, targetCell, getGridMetrics());
}

function playProjectileFX(attackerCell: { x: number; y: number }, targetCell: { x: number; y: number }) {
  if (!tokenSpriteRenderer) {
    return;
  }
  tokenSpriteRenderer.playProjectileFX(attackerCell, targetCell, getGridMetrics());
}

function playAOEFX(cells: Array<{ x: number; y: number }>) {
  if (!tokenSpriteRenderer) {
    return;
  }
  tokenSpriteRenderer.playAOEFX(cells, getGridMetrics());
}

function playHealFX(targetId: string) {
  if (!tokenSpriteRenderer) {
    return;
  }
  tokenSpriteRenderer.playHealFX(targetId, getGridMetrics());
}

function getTokensInArea(center: { x: number; y: number }, radius: number) {
  return gameState.tokens.filter(
    (token) =>
      Math.max(Math.abs(token.x - center.x), Math.abs(token.y - center.y)) <= radius
  );
}

function applyDamage(token: GameToken, amount: number) {
  updateTokenState(token.id, (current) => ({
    ...current,
    hp: Math.max(0, current.hp - amount)
  }));
}

function applyHealing(token: GameToken, amount: number) {
  updateTokenState(token.id, (current) => ({
    ...current,
    hp: Math.min(current.maxHp, current.hp + amount)
  }));
}

function applyFireExplosion(center: { x: number; y: number }, radius: number) {
  const tokens = getTokensInArea(center, radius);
  tokens.forEach((token) => {
    applyDamage(token, 2);
    statusStore.addStatus(token.id, "burning", 2);
  });
  for (let dx = -radius; dx <= radius; dx += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      const x = center.x + dx;
      const y = center.y + dy;
      const surface = surfaceStore.getSurface(x, y);
      if (surface?.type === "oil") {
        surfaceStore.setSurface(x, y, { type: "fire", durationTurns: 2 });
      }
      if (surface?.type === "water") {
        surfaceStore.removeSurface(x, y);
      }
    }
  }
  appendChatMessage("Synergie : Explosion enflammée (huile).");
}

function castSpell(spell: SpellDefinition, cell: { x: number; y: number }) {
  const turnContext = getTurnContext();
  const caster = getSpellCaster();
  if (!caster) {
    return;
  }
  if (
    turnContext.combatStarted &&
    (!turnContext.isPlayerTurn || (caster.actionsRemaining ?? 0) < spell.actionCost)
  ) {
    showActionWarning("Pas assez d'actions.", "no-action");
    return;
  }
  if (!spellTargetingState || !isCellInRange(spellTargetingState, cell)) {
    showActionWarning("Hors portée.", "out-of-range");
    return;
  }
  computeSpellTargetingHover(spellTargetingState, caster, cell, gridSize);
  spellAreaCells = new Set(spellTargetingState.areaCells);
  const targets = getTokensInSpellArea(spellTargetingState, spell);
  if (spell.targeting === "enemy" && !targets.some((token) => !isAllyToken(caster, token))) {
    showActionWarning("Aucune cible ennemie.", "no-enemy");
    return;
  }
  if (spell.targeting === "ally" && !targets.some((token) => isAllyToken(caster, token))) {
    showActionWarning("Aucune cible alliée.", "no-ally");
    return;
  }
  if (spell.targeting !== "ground" && targets.length === 0) {
    showActionWarning("Aucune cible valide.", "no-target");
    return;
  }
  resolveSpell({
    spell,
    caster,
    targetCell: cell,
    targets,
    allTokens: gameState.tokens,
    surfaceStore,
    statusStore,
    log: appendChatMessage,
    applyDamage,
    applyHealing,
    playFx: (kind, from, to) => {
      if (kind === "fire") {
        playProjectileFX(from, to);
      } else if (kind === "heal") {
        targets.forEach((target) => {
          playHealFX(target.id);
        });
      } else if (kind === "electric") {
        const cells = spellTargetingState ? getAreaTargets(spellTargetingState) : [to];
        playAOEFX(cells);
      } else {
        playAOEFX([to]);
      }
    }
  });
  if (turnContext.combatStarted) {
    spendTokenActions(caster.id, spell.actionCost);
  }
  exitSpellTargeting();
}

function renderSpellMenu() {
  if (!combatHud) {
    return;
  }
  combatHud.spellList.innerHTML = "";
  spellbook.forEach((spell) => {
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `<span>${spell.name}</span><span>PO ${spell.range}</span>`;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      selectSpell(spell);
    });
    combatHud.spellList.appendChild(button);
  });
}

function selectSpell(spell: SpellDefinition) {
  const caster = getSpellCaster();
  if (!caster) {
    showActionWarning("Aucun lanceur disponible.", "no-caster");
    return;
  }
  selectedSpellId = spell.id;
  spellTargetingState = createSpellTargetingState(spell, caster.id, caster, gridSize);
  spellRangeCells = new Set(spellTargetingState.rangeCells);
  spellAreaCells = new Set();
  modeMachine.setMode("spell_targeting");
  closeSpellMenu({ preserveMode: true });
  updateSpellTargetingBanner(spell);
  renderGameGrid();
}

function updateSpellTargetingBanner(spell: SpellDefinition) {
  if (!combatHud) {
    return;
  }
  combatHud.actionNotice.textContent = `Ciblage : ${spell.name} (PO ${spell.range}) — Échap pour annuler`;
}

function exitSpellTargeting() {
  spellTargetingState = null;
  selectedSpellId = null;
  spellRangeCells = new Set();
  spellAreaCells = new Set();
  modeMachine.setMode("idle");
  updateCombatHUD();
  renderGameGrid();
}

function handleSpellTargetingHover(cell: { x: number; y: number } | null) {
  if (!spellTargetingState) {
    return;
  }
  const caster = getSpellCaster();
  if (!caster) {
    return;
  }
  computeSpellTargetingHover(spellTargetingState, caster, cell, gridSize);
  spellAreaCells = new Set(spellTargetingState.areaCells);
}

function getTokensInSpellArea(state: SpellTargetingState, spell: SpellDefinition) {
  const areaCells = getAreaTargets(state);
  const tokens = gameState.tokens.filter((token) =>
    areaCells.some((cell) => cell.x === token.x && cell.y === token.y)
  );
  if (spell.shape === "single") {
    return tokens.filter((token) => token.x === state.hoverCell?.x && token.y === state.hoverCell?.y);
  }
  return tokens;
}

function setActiveTool(tool: Tool) {
  activeTool = tool;
  if (tool !== "measure") {
    clearMeasure();
  }
  if (tool !== "draw") {
    isDrawing = false;
    drawStart = null;
    drawEnd = null;
  }
  if (topBarTool) {
    topBarTool.textContent = `Tool: ${toolLabels[tool]}`;
  }
  if (canvasViewport) {
    const currentMode = modeMachine.getMode();
    const cursor =
      currentMode === "attack" || currentMode === "spell_targeting"
        ? "crosshair"
        : tool === "pan"
          ? "grab"
          : tool === "draw"
            ? "crosshair"
            : tool === "token"
              ? "pointer"
              : "crosshair";
    canvasViewport.style.cursor = cursor;
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
  const { pixelsPerGrid, gridOffsetX, gridOffsetY } = gameState.scene;
  const cellSize = pixelsPerGrid;
  return { cellSize, step: cellSize, offsetX: gridOffsetX, offsetY: gridOffsetY };
}

function getGridCoordinates(event: PointerEvent) {
  if (!canvasViewport) {
    return null;
  }
  const rect = canvasViewport.getBoundingClientRect();
  const { step, offsetX, offsetY } = getGridMetrics();
  const localX = (event.clientX - rect.left - panOffset.x) / zoomLevel;
  const localY = (event.clientY - rect.top - panOffset.y) / zoomLevel;
  const gridX = Math.floor((localX - offsetX) / step);
  const gridY = Math.floor((localY - offsetY) / step);
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

function getReachableCells(origin: { x: number; y: number }, range: number) {
  const reachable = new Set<string>();
  if (range <= 0) {
    return reachable;
  }
  for (let dx = -range; dx <= range; dx += 1) {
    for (let dy = -range; dy <= range; dy += 1) {
      if (Math.abs(dx) + Math.abs(dy) > range) {
        continue;
      }
      const x = origin.x + dx;
      const y = origin.y + dy;
      if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) {
        continue;
      }
      reachable.add(`${x},${y}`);
    }
  }
  return reachable;
}

function getPathCells(origin: { x: number; y: number }, target: { x: number; y: number }) {
  const path: Array<{ x: number; y: number }> = [];
  let currentX = origin.x;
  let currentY = origin.y;
  while (currentX !== target.x || currentY !== target.y) {
    if (currentX < target.x) {
      currentX += 1;
    } else if (currentX > target.x) {
      currentX -= 1;
    } else if (currentY < target.y) {
      currentY += 1;
    } else if (currentY > target.y) {
      currentY -= 1;
    }
    path.push({ x: currentX, y: currentY });
  }
  return path;
}

function updateMovementPreview(origin: { x: number; y: number }, hover: { x: number; y: number }, range: number) {
  const reachable = getReachableCells(origin, range);
  movementPreviewCells = Array.from(reachable).map((key) => {
    const [xStr, yStr] = key.split(",");
    return { x: Number(xStr), y: Number(yStr) };
  });
  if (reachable.has(`${hover.x},${hover.y}`)) {
    movementPreviewPath = getPathCells(origin, hover);
  } else {
    movementPreviewPath = [];
  }
}

function updateAttackRange(origin: { x: number; y: number }, range: number) {
  attackRangeCells = getReachableCells(origin, range);
}

function showMovementWarning(message: string) {
  const now = Date.now();
  if (message === movementWarningMessage && now - movementWarningAt < 1200) {
    return;
  }
  movementWarningMessage = message;
  movementWarningAt = now;
  appendChatMessage(message);
}

function showActionWarning(message: string, key = message) {
  const now = Date.now();
  const last = actionWarningAt.get(key) ?? 0;
  if (now - last < 1200) {
    return;
  }
  actionWarningAt.set(key, now);
  appendChatMessage(message);
}

function clearMovementPreview() {
  movementPreviewCells = [];
  movementPreviewPath = [];
  hoveredGridCell = null;
}

function clearRangeOverlays() {
  attackRangeCells = new Set();
  spellRangeCells = new Set();
  spellAreaCells = new Set();
}

function clearSpellSelection() {
  selectedSpellId = null;
  closeSpellMenu({ preserveMode: true });
  spellTargetingState = null;
  spellAreaCells = new Set();
}

function handleModeChange(next: "idle" | "move" | "attack" | "spell_menu" | "spell_targeting") {
  if (next !== "move") {
    clearMovementPreview();
  }
  if (next !== "attack") {
    attackState = null;
    attackRangeCells = new Set();
  }
  if (next !== "spell_targeting") {
    spellRangeCells = new Set();
    spellTargetingState = null;
    spellAreaCells = new Set();
  }
  if (next !== "spell_menu" && next !== "spell_targeting") {
    clearSpellSelection();
  }
  if (next === "spell_menu") {
    openSpellMenu();
  } else if (isSpellMenuOpen) {
    closeSpellMenu({ preserveMode: true });
  }
  if (next === "idle") {
    hoveredTokenId = null;
  }
  renderGameGrid();
}

function applySurfaceToToken(tokenId: string) {
  const token = getTokenById(tokenId);
  if (!token) {
    return;
  }
  const surface = surfaceStore.getSurface(token.x, token.y);
  if (!surface) {
    return;
  }
  if (surface.type === "water") {
    statusStore.addStatus(tokenId, "wet", 2);
    appendChatMessage(`${token.name} est mouillé.`);
  }
  if (surface.type === "oil") {
    statusStore.addStatus(tokenId, "oiled", 2);
    appendChatMessage(`${token.name} est huilé.`);
  }
  if (surface.type === "fire") {
    statusStore.addStatus(tokenId, "burning", 2);
    appendChatMessage(`${token.name} brûle.`);
  }
}

function tickTurnEffects() {
  surfaceStore.tickSurfaces();
  statusStore.tickStatuses();
  const { activeToken } = getTurnContext();
  if (activeToken && statusStore.hasStatus(activeToken.id, "burning")) {
    updateTokenState(activeToken.id, (token) => ({
      ...token,
      hp: Math.max(0, token.hp - 1)
    }));
    appendChatMessage(`${activeToken.name} subit des dégâts de brûlure.`);
  }
}

function isAllyToken(reference: GameToken, target: GameToken) {
  if (reference.type === "player") {
    return target.type === "player" || target.type === "npc";
  }
  return reference.type === target.type;
}

function getSpellCaster() {
  return getTurnContext().activeToken ?? getTokenById(selectedTokenId);
}

function getNearbyNpcToken() {
  const player = getTokenById(selectedTokenId) ?? getTokenById("player");
  if (!player) {
    return null;
  }
  const npcs = gameState.tokens.filter((token) => token.type === "npc");
  return npcs.find((npc) => chebyshevDistance(player, npc) <= 1) ?? null;
}

function renderGameGrid() {
  if (!gamePosition || !canvasWorld) {
    return;
  }
  const currentActiveToken = getTokenById(selectedTokenId) ?? getTokenById("player");
  if (currentActiveToken) {
    gamePosition.textContent = `Position: (${currentActiveToken.x}, ${currentActiveToken.y})`;
  }
  if (!canvasGridLayer || !canvasOverlay) {
    return;
  }
  canvasGridLayer.innerHTML = "";
  if (canvasTokenLayer && !tokenSpriteRenderer) {
    canvasTokenLayer.innerHTML = "";
  }
  if (!movementOverlayLayer) {
    movementOverlayLayer = document.createElement("div");
    movementOverlayLayer.className = "vtt-movement-overlay";
  }
  if (!rangeOverlayLayer) {
    rangeOverlayLayer = document.createElement("div");
    rangeOverlayLayer.className = "vtt-movement-overlay";
  }
  if (!surfaceOverlayLayer) {
    surfaceOverlayLayer = document.createElement("div");
    surfaceOverlayLayer.className = "vtt-movement-overlay";
  }
  movementOverlayLayer.innerHTML = "";
  rangeOverlayLayer.innerHTML = "";
  surfaceOverlayLayer.innerHTML = "";
  if (!canvasOverlay.contains(surfaceOverlayLayer)) {
    canvasOverlay.appendChild(surfaceOverlayLayer);
  }
  if (!canvasOverlay.contains(rangeOverlayLayer)) {
    canvasOverlay.appendChild(rangeOverlayLayer);
  }
  if (!canvasOverlay.contains(movementOverlayLayer)) {
    canvasOverlay.appendChild(movementOverlayLayer);
  }
  const { step, offsetX, offsetY } = getGridMetrics();
  const worldSize = gridSize * step;
  canvasWorld.style.width = `${worldSize}px`;
  canvasWorld.style.height = `${worldSize}px`;

  surfaceStore.forEachSurface((cell) => {
    const surfaceEl = document.createElement("div");
    surfaceEl.className = `vtt-surface-cell ${cell.surface.type}`;
    surfaceEl.style.left = `${cell.x * step + offsetX + 2}px`;
    surfaceEl.style.top = `${cell.y * step + offsetY + 2}px`;
    surfaceEl.style.width = `${step - 4}px`;
    surfaceEl.style.height = `${step - 4}px`;
    surfaceOverlayLayer?.appendChild(surfaceEl);
  });

  movementPreviewCells.forEach((cellPoint) => {
    const cell = document.createElement("div");
    cell.className = "vtt-movement-cell";
    cell.style.left = `${cellPoint.x * step + offsetX + 2}px`;
    cell.style.top = `${cellPoint.y * step + offsetY + 2}px`;
    cell.style.width = `${step - 4}px`;
    cell.style.height = `${step - 4}px`;
    movementOverlayLayer?.appendChild(cell);
  });

  movementPreviewPath.forEach((cellPoint) => {
    const cell = document.createElement("div");
    cell.className = "vtt-movement-cell path";
    cell.style.left = `${cellPoint.x * step + offsetX + 4}px`;
    cell.style.top = `${cellPoint.y * step + offsetY + 4}px`;
    cell.style.width = `${step - 8}px`;
    cell.style.height = `${step - 8}px`;
    movementOverlayLayer?.appendChild(cell);
  });

  attackRangeCells.forEach((key) => {
    const [xStr, yStr] = key.split(",");
    const cell = document.createElement("div");
    cell.className = "vtt-range-cell";
    cell.style.left = `${Number(xStr) * step + offsetX + 2}px`;
    cell.style.top = `${Number(yStr) * step + offsetY + 2}px`;
    cell.style.width = `${step - 4}px`;
    cell.style.height = `${step - 4}px`;
    rangeOverlayLayer?.appendChild(cell);
  });

  if (rangeOverlayLayer) {
    renderOverlayCells(rangeOverlayLayer, expandCells(spellRangeCells), { step, offsetX, offsetY }, "vtt-range-cell spell");
    renderOverlayCells(rangeOverlayLayer, expandCells(spellAreaCells), { step, offsetX, offsetY }, "vtt-range-cell spell-area", 4);
  }

  canvasGridLayer.style.display = gridVisible ? "block" : "none";
  canvasGridLayer.style.backgroundImage =
    "linear-gradient(to right, rgba(148, 163, 184, 0.9) 1px, transparent 1px)," +
    "linear-gradient(to bottom, rgba(148, 163, 184, 0.9) 1px, transparent 1px)";
  canvasGridLayer.style.backgroundSize = `${step}px ${step}px`;
  canvasGridLayer.style.backgroundPosition = `${offsetX}px ${offsetY}px`;

  if (canvasTokenLayer && canvasOverlay) {
    // Token rendering lives here in main.ts/renderGameGrid (previously circle-based).
    if (!tokenSpriteRenderer) {
      tokenSpriteRenderer = new TokenSpriteRenderer(canvasTokenLayer, canvasOverlay);
    }
    const activeToken = getTurnContext().activeToken;
    const currentMode = modeMachine.getMode();
    const tokenIds = new Set<string>();
    gameState.tokens.forEach((tokenData) => {
      tokenIds.add(tokenData.id);
      const isKo = tokenData.hp <= 0;
      let targetable = false;
      let outOfRange = false;
      let hovered = false;
      if (activeToken && tokenData.id !== activeToken.id) {
        if (currentMode === "attack" && !isAllyToken(activeToken, tokenData)) {
          targetable = true;
          if (!attackRangeCells.has(`${tokenData.x},${tokenData.y}`)) {
            outOfRange = true;
          }
        }
        if (currentMode === "spell_targeting" && spellTargetingState) {
          const spell = spellTargetingState.spell;
          const isAlly = isAllyToken(activeToken, tokenData);
          const validTarget =
            spell.targeting === "any" ||
            (spell.targeting === "enemy" && !isAlly) ||
            (spell.targeting === "ally" && isAlly);
          if (validTarget) {
            targetable = true;
            if (!spellRangeCells.has(`${tokenData.x},${tokenData.y}`)) {
              outOfRange = true;
            }
          }
        }
        if (tokenData.id === hoveredTokenId) {
          hovered = true;
        }
      }
      const activeId = combatState.started ? getActiveCombatTokenId() : null;
      tokenSpriteRenderer?.renderToken(
        tokenData,
        {
          selected: tokenData.id === selectedTokenId,
          ko: isKo,
          targetable,
          outOfRange,
          hovered,
          activeTurn: Boolean(activeId && tokenData.id === activeId),
          locked: Boolean(activeId && tokenData.id !== activeId),
          showLabel: combatState.enabled
        },
        { step, offsetX, offsetY }
      );
    });
    tokenSpriteRenderer.cleanup(tokenIds);
  }

  drawZones.forEach((zone) => {
    const rect = document.createElement("div");
    rect.style.position = "absolute";
    rect.style.left = `${zone.x * step + offsetX}px`;
    rect.style.top = `${zone.y * step + offsetY}px`;
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
    rect.style.left = `${minX * step + offsetX}px`;
    rect.style.top = `${minY * step + offsetY}px`;
    rect.style.width = `${width * step - 4}px`;
    rect.style.height = `${height * step - 4}px`;
    rect.style.background = "rgba(148, 163, 184, 0.2)";
    rect.style.border = "1px dashed rgba(148, 163, 184, 0.8)";
    rect.style.borderRadius = "4px";
    canvasOverlay.appendChild(rect);
  }

  if (measureStart && measureEnd) {
    const line = document.createElement("div");
    const startX = measureStart.x * step + offsetX + step / 2;
    const startY = measureStart.y * step + offsetY + step / 2;
    const endX = measureEnd.x * step + offsetX + step / 2;
    const endY = measureEnd.y * step + offsetY + step / 2;
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
    label.textContent = `${gridDistance} cases (Chebyshev)`;
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

  if (gridDebugEnabled) {
    const crosshair = document.createElement("div");
    crosshair.className = "vtt-grid-crosshair";
    crosshair.style.left = `${offsetX}px`;
    crosshair.style.top = `${offsetY}px`;
    const vertical = document.createElement("span");
    const horizontal = document.createElement("span");
    crosshair.appendChild(vertical);
    crosshair.appendChild(horizontal);
    canvasOverlay.appendChild(crosshair);

    const debugLabel = document.createElement("div");
    debugLabel.className = "vtt-grid-debug";
    debugLabel.textContent = `pixelsPerGrid: ${step} · offset: ${offsetX}, ${offsetY}`;
    canvasOverlay.appendChild(debugLabel);
  }
}

function renderScenesPanel() {
  if (!tabContents) {
    return;
  }
  const container = tabContents.Scenes;
  container.innerHTML = "";

  const list = document.createElement("div");
  list.className = "vtt-scenes-panel";

  scenes.forEach((scene) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "vtt-scene-button";
    button.textContent = scene.name;
    button.classList.toggle("active", scene.id === gameState.scene.id);
    button.addEventListener("click", () => {
      applyScene(scene);
      renderScenesPanel();
    });
    list.appendChild(button);
  });

  const debugRow = document.createElement("label");
  debugRow.className = "vtt-scene-debug";
  const debugInput = document.createElement("input");
  debugInput.type = "checkbox";
  debugInput.checked = gridDebugEnabled;
  debugInput.addEventListener("change", () => {
    gridDebugEnabled = debugInput.checked;
    renderGameGrid();
  });
  debugRow.appendChild(debugInput);
  debugRow.appendChild(document.createTextNode(" Debug grille"));

  const meta = document.createElement("div");
  meta.className = "vtt-scene-meta";
  meta.textContent = "Sélectionnez une scène pour changer la map.";

  container.appendChild(list);
  container.appendChild(meta);
  container.appendChild(debugRow);
}

function renderActorsPanel(session: Session) {
  if (!tabContents) {
    return;
  }
  const container = tabContents.Actors;
  container.innerHTML = "";

  const header = document.createElement("div");
  header.style.fontWeight = "600";
  header.textContent = session.player.name;

  const meta = document.createElement("div");
  meta.style.color = "#94a3b8";
  meta.style.fontSize = "12px";
  const raceLabel = races.find((race) => race.id === session.player.raceId)?.name ?? session.player.raceId;
  const classLabel = classes.find((entry) => entry.id === session.player.classId)?.name ?? session.player.classId;
  meta.textContent = `${raceLabel} • ${classLabel}`;

  const actions = document.createElement("div");
  actions.className = "vtt-actors-actions";

  const addNpcButton = document.createElement("button");
  addNpcButton.type = "button";
  addNpcButton.textContent = "Add NPC";
  addNpcButton.addEventListener("click", () => {
    addToken("npc");
  });

  const addMonsterButton = document.createElement("button");
  addMonsterButton.type = "button";
  addMonsterButton.textContent = "Add Monster";
  addMonsterButton.addEventListener("click", () => {
    addToken("monster");
  });

  actions.appendChild(addNpcButton);
  actions.appendChild(addMonsterButton);

  const combatActions = document.createElement("div");
  combatActions.className = "vtt-actors-actions";

  const attackButton = document.createElement("button");
  attackButton.type = "button";
  attackButton.textContent = attackState ? "Choose Target..." : "Attack";
  const selectedToken = getTokenById(selectedTokenId);
  const activeId = getActiveCombatTokenId();
  const canAttack =
    combatState.enabled &&
    combatState.started &&
    selectedToken &&
    activeId === selectedToken.id &&
    canTokenAct(selectedToken) &&
    !attackState;
  attackButton.disabled = !canAttack;
  attackButton.addEventListener("click", () => {
    if (selectedTokenId) {
      requestAttack(selectedTokenId);
    }
  });

  const healButton = document.createElement("button");
  healButton.type = "button";
  healButton.textContent = "Heal +1";
  healButton.disabled = !selectedTokenId;
  healButton.addEventListener("click", () => {
    if (!selectedTokenId) {
      return;
    }
    gameState = {
      ...gameState,
      tokens: gameState.tokens.map((token) => {
        if (token.id !== selectedTokenId) {
          return token;
        }
        const nextHp = Math.min(token.maxHp, token.hp + 1);
        return { ...token, hp: nextHp };
      })
    };
    renderGameGrid();
    renderActorsPanel(session);
  });

  combatActions.appendChild(attackButton);
  combatActions.appendChild(healButton);

  const list = document.createElement("div");
  list.className = "vtt-actors-list";
  gameState.tokens.forEach((token) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "vtt-actors-token";
    row.classList.toggle("active", token.id === selectedTokenId);
    row.textContent = `${token.name} (${token.type}) • ${token.hp}/${token.maxHp}`;
    row.addEventListener("click", () => {
      selectToken(token.id);
    });
    list.appendChild(row);
  });

  if (combatState.enabled && combatState.started) {
    const initiative = document.createElement("div");
    initiative.className = "vtt-actors-initiative";
    initiative.textContent = `Ordre d'initiative (Round ${combatState.round})`;
    const orderList = document.createElement("div");
    orderList.className = "vtt-actors-initiative-list";
    combatState.initiativeOrder.forEach((id, index) => {
      const token = getTokenById(id);
      const item = document.createElement("div");
      item.className = "vtt-actors-initiative-item";
      item.textContent = token ? `${index + 1}. ${token.name}` : `${index + 1}. ${id}`;
      if (id === getActiveCombatTokenId()) {
        item.classList.add("active");
      }
      orderList.appendChild(item);
    });
    container.appendChild(initiative);
    container.appendChild(orderList);
  }

  container.appendChild(header);
  container.appendChild(meta);
  if (selectedToken) {
    const stats = document.createElement("div");
    stats.className = "vtt-actors-stats";
    stats.textContent = `AC ${selectedToken.ac} • Bonus +${selectedToken.attackBonus} • Dmg ${selectedToken.damage}`;
    container.appendChild(stats);
  }
  container.appendChild(actions);
  container.appendChild(combatActions);
  container.appendChild(list);
}

function setGameView(session: Session) {
  if (!gameView.hasChildNodes()) {
    const topBar = createTopBar();
    const leftToolbar = createLeftToolbar(activeTool, setActiveTool);
    const canvasView = createCanvasView({ mapUrl: gameState.scene.mapUrl });
    const rightSidebar = createRightSidebar();
    const bottom = createBottomControls();
    const combatHudView = createCombatHUD();
    const inventoryPanelEl = document.createElement("div");
    inventoryPanelEl.className = "vtt-inventory-panel";
    const inventoryHeader = document.createElement("div");
    inventoryHeader.className = "vtt-inventory-header";
    const inventoryTitle = document.createElement("strong");
    inventoryTitle.textContent = "Inventaire";
    const inventoryClose = document.createElement("button");
    inventoryClose.type = "button";
    inventoryClose.textContent = "Fermer";
    inventoryHeader.appendChild(inventoryTitle);
    inventoryHeader.appendChild(inventoryClose);
    const inventoryBody = document.createElement("div");
    inventoryBody.className = "vtt-inventory-body";
    const inventoryListEl = document.createElement("div");
    inventoryListEl.className = "vtt-inventory-list";
    const inventoryDetailEl = document.createElement("div");
    inventoryDetailEl.className = "vtt-inventory-detail";
    inventoryBody.appendChild(inventoryListEl);
    inventoryBody.appendChild(inventoryDetailEl);
    inventoryPanelEl.appendChild(inventoryHeader);
    inventoryPanelEl.appendChild(inventoryBody);

    const dialoguePanelEl = document.createElement("div");
    dialoguePanelEl.className = "vtt-dialogue-panel";
    const dialogueHeader = document.createElement("div");
    dialogueHeader.className = "vtt-dialogue-header";
    const dialogueSpeakerEl = document.createElement("div");
    dialogueSpeakerEl.className = "vtt-dialogue-speaker";
    const dialogueClose = document.createElement("button");
    dialogueClose.type = "button";
    dialogueClose.textContent = "Fermer";
    dialogueHeader.appendChild(dialogueSpeakerEl);
    dialogueHeader.appendChild(dialogueClose);
    const dialogueTextEl = document.createElement("div");
    dialogueTextEl.className = "vtt-dialogue-text";
    const dialogueChoicesEl = document.createElement("div");
    dialogueChoicesEl.className = "vtt-dialogue-choices";
    dialoguePanelEl.appendChild(dialogueHeader);
    dialoguePanelEl.appendChild(dialogueTextEl);
    dialoguePanelEl.appendChild(dialogueChoicesEl);

    const systemLogEl = document.createElement("div");
    systemLogEl.className = "vtt-system-log";

    const body = document.createElement("div");
    body.className = "vtt-body";

    body.appendChild(leftToolbar);
    body.appendChild(canvasView.root);
    body.appendChild(rightSidebar.root);

    bottom.root.style.position = "absolute";
    bottom.root.style.right = "16px";
    bottom.root.style.bottom = "16px";

    canvasView.root.appendChild(bottom.root);
    canvasView.root.appendChild(combatHudView.root);
    canvasView.root.appendChild(inventoryPanelEl);
    canvasView.root.appendChild(dialoguePanelEl);
    canvasView.root.appendChild(systemLogEl);

    gameView.appendChild(topBar.root);
    gameView.appendChild(body);

    gamePosition = canvasView.position;
    canvasWorld = canvasView.world;
    canvasOverlay = canvasView.overlayLayer;
    canvasViewport = canvasView.viewport;
    canvasGridLayer = canvasView.gridLayer;
    canvasTokenLayer = canvasView.tokenLayer;
    canvasMapLayer = canvasView.mapLayer;
    rightSidebarRoot = rightSidebar.root;
    topBarRoom = topBar.room;
    topBarStatus = topBar.status;
    topBarTool = topBar.tool;
    toggleSidebarBtn = topBar.toggleSidebar;
    combatToggleBtn = topBar.combatToggle;
    vttEndTurnBtn = topBar.endTurn;
    combatInfo = topBar.combatInfo;
    inventoryButton = topBar.inventoryButton;
    combatHud = combatHudView;
    backToLobbyBtn = rightSidebar.backButton;
    tabButtons = rightSidebar.tabs;
    tabContents = rightSidebar.contents;
    bottomControls = bottom;
    inventoryPanel = inventoryPanelEl;
    inventoryList = inventoryListEl;
    inventoryDetail = inventoryDetailEl;
    dialoguePanel = dialoguePanelEl;
    dialogueSpeaker = dialogueSpeakerEl;
    dialogueText = dialogueTextEl;
    dialogueChoices = dialogueChoicesEl;
    systemLog = systemLogEl;

    if (combatHud && chat) {
      chat.classList.add("vtt-combat-chat");
      if (!combatHud.chatSlot.contains(chat)) {
        combatHud.chatSlot.appendChild(chat);
      }
    }

    toggleSidebarBtn.addEventListener("click", () => {
      if (!rightSidebarRoot) {
        return;
      }
      rightSidebarRoot.classList.toggle("vtt-sidebar-collapsed");
    });

    if (inventoryButton) {
      inventoryButton.addEventListener("click", () => {
        openInventoryPanel();
      });
    }

    inventoryClose.addEventListener("click", () => {
      closeInventoryPanel();
    });
    dialogueClose.addEventListener("click", () => {
      closeDialogue();
    });

    if (combatToggleBtn) {
      combatToggleBtn.addEventListener("click", () => {
        combatState = { ...combatState, enabled: !combatState.enabled };
        if (combatState.enabled) {
          startCombat();
        } else {
          setAttackState(null);
          resetCombat();
        }
        updateCombatToggle();
      });
      updateCombatToggle();
    }
    if (vttEndTurnBtn) {
      vttEndTurnBtn.addEventListener("click", () => {
        endTurn();
      });
    }
    if (combatHud) {
      combatHud.attackButton.addEventListener("click", () => {
        const turnContext = getTurnContext();
        if (turnContext.activeToken) {
          requestAttack(turnContext.activeToken.id);
        }
      });
      combatHud.spellsButton.addEventListener("click", () => {
        requestSimpleAction("spells");
      });
      combatHud.itemsButton.addEventListener("click", () => {
        requestSimpleAction("items");
      });
      combatHud.endTurnButton.addEventListener("click", () => {
        endTurn();
      });
    renderSpellMenu();
    spellMenuRef = combatHud.spellMenu;
    spellButtonRef = combatHud.spellsButton;
    if (spellMenuRef) {
      spellMenuRef.style.pointerEvents = "auto";
    }
    if (spellButtonRef) {
      spellButtonRef.style.pointerEvents = "auto";
    }
    if (!spellMenuListenersReady) {
      spellMenuListenersReady = true;
        combatHud.spellMenu.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
        combatHud.spellsButton.addEventListener("pointerdown", (event) => {
          event.stopPropagation();
        });
        document.addEventListener(
          "pointerdown",
          (event) => {
            if (!isSpellMenuOpen || !spellMenuRef || !spellButtonRef) {
              return;
            }
            const target = event.target as Node | null;
            if (!target) {
              return;
            }
            if (spellMenuRef.contains(target) || spellButtonRef.contains(target)) {
              return;
            }
            closeSpellMenu();
          },
          true
        );
      }
    }

    setActiveTool(activeTool);

    const tabs = tabButtons;
    const contents = tabContents;
    if (tabs && contents) {
      (Object.keys(tabs) as Array<keyof typeof tabs>).forEach((label) => {
        const tab = tabs[label];
        tab.addEventListener("click", () => {
          (Object.keys(tabs) as Array<keyof typeof tabs>).forEach((key) => {
            tabs[key].classList.toggle("active", key === label);
            const shouldShow = key === label;
            if (combatState.enabled && key === "Chat") {
              contents[key].style.display = "block";
            } else {
              contents[key].style.display = shouldShow ? "block" : "none";
            }
          });
          if (combatState.enabled) {
            contents.Chat.style.display = "block";
          }
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
        resetCameraToScene(gameState.scene);
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
        const currentMode = modeMachine.getMode();
        if (isSpellMenuOpen) {
          return;
        }
        if (event.button === 2) {
          if (currentMode === "attack") {
            modeMachine.setMode("idle");
            return;
          }
          if (currentMode === "spell_targeting") {
            exitSpellTargeting();
            return;
          }
        }
        if (currentMode === "attack" && event.button === 0) {
          const targetId = getTokenIdFromEvent(event);
          if (targetId) {
            handleAttackTarget(targetId);
          } else {
            showActionWarning("Aucune cible sélectionnée.", "no-target");
          }
          return;
        }
        if (currentMode === "spell_targeting" && event.button === 0) {
          const coords = getGridCoordinates(event);
          if (!coords || !selectedSpellId) {
            return;
          }
          const spell = getSpellById(selectedSpellId);
          if (!spell) {
            return;
          }
          castSpell(spell, coords);
          return;
        }
        const isPanMode = activeTool === "pan" || isSpacePressed || event.button === 1;
        if (isPanMode) {
          isPanning = true;
          panStart = { x: event.clientX - panOffset.x, y: event.clientY - panOffset.y };
          canvasViewport.style.cursor = "grabbing";
          canvasViewport?.setPointerCapture(event.pointerId);
          return;
        }
        if (activeTool === "token" && event.button === 0) {
          const clickedTokenId = getTokenIdFromEvent(event);
          if (clickedTokenId) {
            const turnContext = getTurnContext();
            if (turnContext.combatOn && turnContext.combatStarted) {
              if (turnContext.activeToken && clickedTokenId !== turnContext.activeToken.id) {
                showActionWarning("Ce n'est pas votre tour.", "not-your-turn");
                return;
              }
            }
            const token = getTokenById(clickedTokenId);
            if (!token) {
              return;
            }
            if (token.type === "npc") {
              const npcDef = getNpcDef(token.id);
              if (npcDef) {
                selectToken(clickedTokenId);
                openDialogue(npcDef);
              }
              return;
            }
            selectToken(clickedTokenId);
            if (turnContext.combatOn && turnContext.combatStarted) {
              if (!canTokenMove(token, 1)) {
                showMovementWarning("PM insuffisants.");
                return;
              }
            }
            draggingTokenId = clickedTokenId;
            draggingTokenStart = { x: token.x, y: token.y };
            canvasViewport?.setPointerCapture(event.pointerId);
            return;
          }
          const coords = getGridCoordinates(event);
          if (coords) {
            const targetToken = getTokenById(selectedTokenId) ?? getTokenById("player");
            if (targetToken) {
              const turnContext = getTurnContext();
              if (turnContext.combatOn && turnContext.combatStarted) {
                if (turnContext.activeToken && targetToken.id !== turnContext.activeToken.id) {
                  showActionWarning("Ce n'est pas votre tour.", "not-your-turn");
                  return;
                }
                const cost = getMoveCost(targetToken, coords);
                if (cost !== 1) {
                  showMovementWarning("Case hors portée.");
                  return;
                }
                if (!canTokenMove(targetToken, cost)) {
                  showMovementWarning("PM insuffisants.");
                  return;
                }
              }
              updateTokenPosition(targetToken.id, coords);
              if (turnContext.combatOn && turnContext.combatStarted) {
                const cost = getMoveCost(targetToken, coords);
                if (cost === 1) {
                  spendTokenMovement(targetToken.id, cost);
                }
              }
              applySurfaceToToken(targetToken.id);
              selectToken(targetToken.id);
              renderGameGrid();
            }
          }
          return;
        }
        if (activeTool === "measure") {
          if (event.button === 2) {
            clearMeasure();
            return;
          }
          const coords = getGridCoordinates(event);
          if (coords) {
            if (!measureStart || !isMeasuring) {
              isMeasuring = true;
              measureLocked = false;
              measureStart = coords;
              measureEnd = coords;
              renderGameGrid();
              return;
            }
            if (!measureLocked) {
              measureEnd = coords;
              measureLocked = true;
              renderGameGrid();
              return;
            }
            measureStart = coords;
            measureEnd = coords;
            measureLocked = false;
            renderGameGrid();
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
        if (isSpellMenuOpen) {
          return;
        }
        const currentMode = modeMachine.getMode();
        if (currentMode === "attack") {
          const tokenId = getTokenIdFromEvent(event);
          if (tokenId !== hoveredTokenId) {
            hoveredTokenId = tokenId;
            renderGameGrid();
            updateCombatHUD();
          }
        }
        if (currentMode === "spell_targeting") {
          const coords = getGridCoordinates(event);
          handleSpellTargetingHover(coords);
          renderGameGrid();
          return;
        }
        if (draggingTokenId && activeTool === "token") {
          const coords = getGridCoordinates(event);
          if (coords) {
            const turnContext = getTurnContext();
            if (turnContext.combatOn && turnContext.combatStarted && draggingTokenStart) {
              const token = getTokenById(draggingTokenId);
              if (token) {
                const cost = getMoveCost(draggingTokenStart, coords);
                if (cost !== 1) {
                  return;
                }
                if (!canTokenMove(token, cost)) {
                  return;
                }
              }
            }
            updateTokenPosition(draggingTokenId, coords);
            renderGameGrid();
          }
          return;
        }
        if (isPanning) {
          panOffset = { x: event.clientX - panStart.x, y: event.clientY - panStart.y };
          updateCanvasTransform();
          return;
        }
        if (isMeasuring && !measureLocked && activeTool === "measure") {
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
          return;
        }

        if (currentMode === "attack" || currentMode === "spell_targeting") {
          return;
        }

        const coords = getGridCoordinates(event);
        const turnContext = getTurnContext();
        const origin = turnContext.activeToken ?? getTokenById(selectedTokenId);
        if (coords && origin) {
          if (turnContext.combatOn && turnContext.combatStarted) {
            if (turnContext.isPlayerTurn) {
              updateMovementPreview(origin, coords, origin.movementRemaining ?? 0);
              hoveredGridCell = coords;
              modeMachine.setMode("move");
              renderGameGrid();
            } else if (currentMode === "move") {
              modeMachine.setMode("idle");
            }
          } else {
            movementPreviewCells = [];
            movementPreviewPath = getPathCells(origin, coords);
            hoveredGridCell = coords;
            modeMachine.setMode("move");
            renderGameGrid();
          }
        } else if (currentMode === "move") {
          modeMachine.setMode("idle");
        }
      };
      const handlePointerUp = (event: PointerEvent) => {
        if (isPanning) {
          isPanning = false;
          if (canvasViewport) {
            const cursor = activeTool === "pan" ? "grab" : canvasViewport.style.cursor;
            canvasViewport.style.cursor = cursor;
          }
          canvasViewport?.releasePointerCapture(event.pointerId);
          return;
        }
        if (draggingTokenId) {
          const turnContext = getTurnContext();
          if (turnContext.combatOn && turnContext.combatStarted && draggingTokenStart) {
            const token = getTokenById(draggingTokenId);
            if (token) {
              const cost = getMoveCost(draggingTokenStart, token);
              if (cost === 1) {
                spendTokenMovement(draggingTokenId, cost);
              }
            }
          }
          applySurfaceToToken(draggingTokenId);
          draggingTokenId = null;
          draggingTokenStart = null;
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
      canvasViewport.addEventListener("pointerleave", () => {
        if (!isSpellMenuOpen && (hoveredGridCell || modeMachine.getMode() === "move")) {
          modeMachine.setMode("idle");
        }
      });
    }
  }

  if (topBarRoom) {
    topBarRoom.textContent = `Room ${session.id}`;
  }
  if (topBarStatus) {
    topBarStatus.textContent = `Solo · Scene: ${gameState.scene.name}`;
  }
  if (tabContents) {
    tabContents.Chat.innerHTML =
      `<div class="vtt-chat-log">Aucun message pour l'instant.</div>` +
      `<input class="vtt-chat-input" placeholder="Message..." />`;
    vttChatLog = tabContents.Chat.querySelector(".vtt-chat-log");
    tabContents.Items.textContent = "À venir";
    tabContents.Journal.textContent = "À venir";
  }

  renderScenesPanel();
  renderActorsPanel(session);
  updateCombatInfo();

  gameView.style.display = "flex";
  soloRoom.style.display = "none";
  lobby.style.display = "none";
  hud.style.display = "none";
  chat.style.display = "none";
  combatPanel.style.display = "none";
  applyScene(gameState.scene);
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

let inventoryState: InventoryState = defaultInventoryState;
let inventoryFlags: Record<string, boolean> = {};
let questFlags: Record<string, boolean> = {};

const adapter: GameAdapter = FEATURE_MULTIPLAYER ? createNetworkAdapter() : createLocalAdapter();
let gameState = initialState;

const loadedSave = loadGameState();
inventoryState = loadedSave.inventory ?? defaultInventoryState;
inventoryFlags = loadedSave.flags ?? {};
questFlags = loadedSave.quests ?? {};

ensureNpcTokensForScene(gameState.scene.id);

let room: Room<GameStateSchema> | null = null;
let sessionId: string | null = null;
let gridVisible = true;
let races: RaceData[] = [];
let classes: ClassData[] = [];
let spells: SpellData[] = [];
let monsters: MonsterData[] = [];
let lastPointer = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
let activeSession: Session | null = null;
let gridSize = gameState.scene.gridSize;
let zoomLevel = gameState.scene.initialZoom;
let panOffset = { x: gameState.scene.initialPanX, y: gameState.scene.initialPanY };
let isPanning = false;
let panStart = { x: 0, y: 0 };
let canvasWorld: HTMLDivElement | null = null;
let canvasViewport: HTMLDivElement | null = null;
let canvasOverlay: HTMLDivElement | null = null;
let canvasGridLayer: HTMLDivElement | null = null;
let canvasTokenLayer: HTMLDivElement | null = null;
let canvasMapLayer: HTMLDivElement | null = null;
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
let gridDebugEnabled = false;
let selectedTokenId: string | null = "player";
let draggingTokenId: string | null = null;
let draggingTokenStart: { x: number; y: number } | null = null;
let tokenIdCounter = 1;
let attackState: { attackerId: string; awaitingTarget: boolean } | null = null;
let hoveredTokenId: string | null = null;
let hoveredGridCell: { x: number; y: number } | null = null;
let measureLocked = false;
let vttChatLog: HTMLDivElement | null = null;
let movementOverlayLayer: HTMLDivElement | null = null;
let rangeOverlayLayer: HTMLDivElement | null = null;
let surfaceOverlayLayer: HTMLDivElement | null = null;
let tokenSpriteRenderer: TokenSpriteRenderer | null = null;
let movementWarningMessage = "";
let movementWarningAt = 0;
let actionWarningAt = new Map<string, number>();
let movementPreviewCells: Array<{ x: number; y: number }> = [];
let movementPreviewPath: Array<{ x: number; y: number }> = [];
let attackRangeCells = new Set<string>();
let spellRangeCells = new Set<string>();
let selectedSpellId: SpellDefinition["id"] | null = null;
let spellTargetingState: SpellTargetingState | null = null;
let spellAreaCells = new Set<string>();
let isSpellMenuOpen = false;
let spellMenuListenersReady = false;
let spellMenuRef: HTMLDivElement | null = null;
let spellButtonRef: HTMLButtonElement | null = null;
let inventoryPanel: HTMLDivElement | null = null;
let inventoryList: HTMLDivElement | null = null;
let inventoryDetail: HTMLDivElement | null = null;
let inventoryButton: HTMLButtonElement | null = null;
let dialoguePanel: HTMLDivElement | null = null;
let dialogueSpeaker: HTMLDivElement | null = null;
let dialogueText: HTMLDivElement | null = null;
let dialogueChoices: HTMLDivElement | null = null;
let activeDialogue: DialogueNode | null = null;
let activeNpc: NpcDef | null = null;
let systemLog: HTMLDivElement | null = null;
const surfaceStore = createSurfaceStore();
const statusStore = createStatusStore();
const modeMachine = createModeMachine("idle", handleModeChange);
let combatToggleBtn: HTMLButtonElement | null = null;
let vttEndTurnBtn: HTMLButtonElement | null = null;
let combatInfo: HTMLSpanElement | null = null;
let combatHud:
  | {
      root: HTMLDivElement;
      statusBadge: HTMLSpanElement;
      tokenName: HTMLSpanElement;
      tokenType: HTMLSpanElement;
      round: HTMLSpanElement;
      hp: HTMLSpanElement;
      actionPips: HTMLDivElement;
      actionValue: HTMLSpanElement;
      actionNotice: HTMLSpanElement;
      movementPips: HTMLDivElement;
      movementValue: HTMLSpanElement;
      movementNotice: HTMLSpanElement;
      attackButton: HTMLButtonElement;
      spellsButton: HTMLButtonElement;
      itemsButton: HTMLButtonElement;
      endTurnButton: HTMLButtonElement;
      spellMenu: HTMLDivElement;
      spellList: HTMLDivElement;
      chatSlot: HTMLDivElement;
    }
  | null = null;
let combatState = {
  enabled: false,
  started: false,
  initiativeOrder: [] as string[],
  activeIndex: 0,
  round: 0
};
let combatEnded = false;
let isAITurnRunning = false;

class GameScene extends Phaser.Scene {
  private gridGraphics?: Phaser.GameObjects.Graphics;
  private combatGridGraphics?: Phaser.GameObjects.Graphics;
  private obstacleGraphics?: Phaser.GameObjects.Graphics;
  private dragging = false;
  private dragStart = { x: 0, y: 0 };

  constructor() {
    super("GameScene");
  }

  preload() {
    preloadTokenAssets(this);
  }

  create() {
    this.createTilemap();

    this.gridGraphics = this.add.graphics();
    this.combatGridGraphics = this.add.graphics();
    this.obstacleGraphics = this.add.graphics();
    this.tokenSprites = new TokenSprites(this, TILE_SIZE);

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
    this.renderObstacles(obstacles);
    const combat = state.combat as CombatStateSchema;
    this.renderGrid();
    this.renderCombatGrid(combat);
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
  if (vttChatLog) {
    const vttLine = document.createElement("div");
    vttLine.textContent = message;
    vttChatLog.appendChild(vttLine);
    vttChatLog.scrollTop = vttChatLog.scrollHeight;
  }
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
  if (event.code === "KeyE") {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }
    const npcToken = getNearbyNpcToken();
    if (npcToken) {
      const npcDef = getNpcDef(npcToken.id);
      if (npcDef) {
        openDialogue(npcDef);
      }
    }
  }
  if (event.key === "Escape") {
    if (isSpellMenuOpen) {
      closeSpellMenu();
    }
    if (inventoryPanel?.classList.contains("open")) {
      closeInventoryPanel();
    }
    if (dialoguePanel?.classList.contains("open")) {
      closeDialogue();
    }
    if (modeMachine.getMode() === "spell_targeting") {
      exitSpellTargeting();
      return;
    }
    if (attackState || modeMachine.getMode() !== "idle") {
      modeMachine.setMode("idle");
    }
    if (activeTool === "measure") {
      clearMeasure();
    }
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "Space") {
    isSpacePressed = false;
  }
});

void game;
