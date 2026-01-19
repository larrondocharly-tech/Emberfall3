import Phaser from "phaser";
import { Client as ColyseusClient, Room } from "colyseus.js";
import type { DialogueNode } from "@emberfall3/shared";

const SERVER_URL = "ws://localhost:2567";
const WORLD_WIDTH = 900;
const WORLD_HEIGHT = 600;

type PlayerSchema = {
  id: string;
  name: string;
  x: number;
  y: number;
  mode: string;
  gridX: number;
  gridY: number;
  movementPoints: number;
  maxMovement: number;
};

type CombatStateSchema = {
  active: boolean;
  turnIndex: number;
  turnOrder: string[];
  gridSize: number;
  gridCellSize: number;
  originX: number;
  originY: number;
};

type NpcSchema = {
  id: string;
  name: string;
  x: number;
  y: number;
};

type GameStateSchema = {
  players: Map<string, PlayerSchema>;
  npcs: NpcSchema[];
  combat: CombatStateSchema;
};

const lobby = document.getElementById("lobby") as HTMLDivElement;
const createRoomBtn = document.getElementById("createRoom") as HTMLButtonElement;
const joinRoomBtn = document.getElementById("joinRoom") as HTMLButtonElement;
const playerNameInput = document.getElementById("playerName") as HTMLInputElement;
const roomCodeInput = document.getElementById("roomCode") as HTMLInputElement;
const roomInfo = document.getElementById("roomInfo") as HTMLDivElement;
const statusText = document.getElementById("status") as HTMLDivElement;
const dialogueBox = document.getElementById("dialogue") as HTMLDivElement;
const dialogueText = document.getElementById("dialogueText") as HTMLDivElement;
const dialogueChoices = document.getElementById("dialogueChoices") as HTMLDivElement;
const combatPanel = document.getElementById("combatPanel") as HTMLDivElement;
const combatTurn = document.getElementById("combatTurn") as HTMLDivElement;
const endTurnBtn = document.getElementById("endTurn") as HTMLButtonElement;

let room: Room<GameStateSchema> | null = null;
let sessionId = "";

class GameScene extends Phaser.Scene {
  private playerSprites = new Map<string, Phaser.GameObjects.Rectangle>();
  private nameLabels = new Map<string, Phaser.GameObjects.Text>();
  private npcSprites = new Map<string, Phaser.GameObjects.Arc>();
  private gridGraphics?: Phaser.GameObjects.Graphics;
  private npcHint?: Phaser.GameObjects.Text;

  constructor() {
    super("GameScene");
  }

  create() {
    this.add.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, 0x111827);
    this.add.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH - 60, WORLD_HEIGHT - 60, 0x1f2937);

    this.gridGraphics = this.add.graphics();
    this.npcHint = this.add.text(16, WORLD_HEIGHT - 30, "", {
      color: "#facc15",
      fontSize: "14px"
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!room) {
        return;
      }
      const state = room.state;
      const combat = state.combat as CombatStateSchema;
      if (combat.active) {
        if (pointer.leftButtonDown()) {
          const gridX = Math.floor((pointer.worldX - combat.originX) / combat.gridCellSize);
          const gridY = Math.floor((pointer.worldY - combat.originY) / combat.gridCellSize);
          room.send("combat_move", { gridX, gridY });
        }
        return;
      }
      if (pointer.rightButtonDown()) {
        room.send("move", { x: pointer.worldX, y: pointer.worldY });
      }
    });

    this.input.keyboard?.on("keydown-E", () => {
      if (!room) {
        return;
      }
      const npc = room.state.npcs?.[0];
      if (!npc) {
        return;
      }
      room.send("interact", { npcId: npc.id });
    });

    endTurnBtn.addEventListener("click", () => {
      room?.send("end_turn", {});
    });
  }

  update() {
    if (!room) {
      return;
    }
    const state = room.state as GameStateSchema;
    this.syncNpcs(state.npcs ?? []);
    this.syncPlayers(state.players as Map<string, PlayerSchema>);
    this.renderCombat(state.combat as CombatStateSchema);
    this.updateNpcHint(state.npcs ?? [], state.players as Map<string, PlayerSchema>);
  }

  private syncPlayers(players: Map<string, PlayerSchema>) {
    players.forEach((player, id) => {
      let sprite = this.playerSprites.get(id);
      let label = this.nameLabels.get(id);
      if (!sprite) {
        sprite = this.add.rectangle(player.x, player.y, 24, 24, id === sessionId ? 0x60a5fa : 0x34d399);
        label = this.add.text(player.x, player.y - 24, player.name, {
          color: "#f9fafb",
          fontSize: "12px"
        });
        this.playerSprites.set(id, sprite);
        this.nameLabels.set(id, label);
      }
      sprite.setPosition(player.x, player.y);
      label?.setPosition(player.x - label.width / 2, player.y - 32);
    });

    Array.from(this.playerSprites.keys()).forEach((id) => {
      if (!players.has(id)) {
        this.playerSprites.get(id)?.destroy();
        this.nameLabels.get(id)?.destroy();
        this.playerSprites.delete(id);
        this.nameLabels.delete(id);
      }
    });
  }

  private syncNpcs(npcs: NpcSchema[]) {
    npcs.forEach((npc) => {
      let sprite = this.npcSprites.get(npc.id);
      if (!sprite) {
        sprite = this.add.circle(npc.x, npc.y, 16, 0xf97316);
        this.add.text(npc.x - 24, npc.y - 30, npc.name, { color: "#fde68a", fontSize: "12px" });
        this.npcSprites.set(npc.id, sprite);
      }
      sprite.setPosition(npc.x, npc.y);
    });
  }

  private renderCombat(combat: CombatStateSchema) {
    if (!this.gridGraphics) {
      return;
    }
    this.gridGraphics.clear();
    if (!combat.active) {
      combatPanel.style.display = "none";
      return;
    }
    combatPanel.style.display = "flex";
    const current = combat.turnOrder?.[combat.turnIndex] ?? "";
    combatTurn.textContent = `Tour de: ${current === sessionId ? "Vous" : current}`;

    this.gridGraphics.lineStyle(1, 0x475569, 1);
    for (let x = 0; x <= combat.gridSize; x += 1) {
      const startX = combat.originX + x * combat.gridCellSize;
      this.gridGraphics.lineBetween(startX, combat.originY, startX, combat.originY + combat.gridSize * combat.gridCellSize);
    }
    for (let y = 0; y <= combat.gridSize; y += 1) {
      const startY = combat.originY + y * combat.gridCellSize;
      this.gridGraphics.lineBetween(combat.originX, startY, combat.originX + combat.gridSize * combat.gridCellSize, startY);
    }
  }

  private updateNpcHint(npcs: NpcSchema[], players: Map<string, PlayerSchema>) {
    const player = players.get(sessionId);
    const npc = npcs[0];
    if (!player || !npc || !this.npcHint) {
      return;
    }
    const distance = Math.hypot(player.x - npc.x, player.y - npc.y);
    if (distance < 70 && player.mode === "exploration") {
      this.npcHint.setText("Appuyez sur E pour parler au PNJ");
    } else {
      this.npcHint.setText("");
    }
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  backgroundColor: "#111827",
  scene: [GameScene]
});

const client = new ColyseusClient(SERVER_URL);

function setStatus(text: string) {
  statusText.textContent = text;
}

function attachRoomListeners(activeRoom: Room<GameStateSchema>) {
  activeRoom.onMessage("dialogue_node", (node: DialogueNode) => {
    dialogueBox.style.display = "flex";
    dialogueText.textContent = node.text;
    dialogueChoices.innerHTML = "";
    node.choices.forEach((choice) => {
      const button = document.createElement("button");
      button.textContent = choice.label;
      button.addEventListener("click", () => {
        activeRoom.send("dialogue_choice", { choiceId: choice.id });
      });
      dialogueChoices.appendChild(button);
    });
  });

  activeRoom.onMessage("dialogue_end", () => {
    dialogueBox.style.display = "none";
    dialogueChoices.innerHTML = "";
  });

  activeRoom.onStateChange(() => {
    const state = activeRoom.state as GameStateSchema;
    if (state.combat?.active) {
      setStatus(`Combat actif - Room ${activeRoom.id}`);
    } else {
      setStatus(`Exploration - Room ${activeRoom.id}`);
    }
  });
}

async function createRoom() {
  const name = playerNameInput.value.trim() || "Aventurier";
  const newRoom = await client.create<GameStateSchema>("rpg", { name });
  enterRoom(newRoom);
  roomInfo.textContent = `Code de room: ${newRoom.id}`;
}

async function joinRoom() {
  const name = playerNameInput.value.trim() || "Aventurier";
  const code = roomCodeInput.value.trim();
  if (!code) {
    roomInfo.textContent = "Entrez un code.";
    return;
  }
  const joinedRoom = await client.joinById<GameStateSchema>(code, { name });
  enterRoom(joinedRoom);
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

setStatus("En attente de connexion...");

void game;
