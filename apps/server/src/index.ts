import { createServer } from "http";
import express from "express";
import cors from "cors";
import { Server, Room, Client } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import {
  Schema,
  type,
  MapSchema,
  ArraySchema
} from "@colyseus/schema";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import type {
  DialogueData,
  DialogueNode,
  DialogueChoice,
  PlayerMode
} from "@emberfall3/shared";

class PlayerState extends Schema {
  @type("string") id = "";
  @type("string") name = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") targetX = -1;
  @type("number") targetY = -1;
  @type("number") dex = 10;
  @type("string") mode: PlayerMode = "exploration";
  @type("number") gridX = 0;
  @type("number") gridY = 0;
  @type("number") movementPoints = 0;
  @type("number") maxMovement = 4;
  @type("string") activeDialogueId = "";
  @type("string") activeDialogueNodeId = "";
  @type({ map: "boolean" }) flags = new MapSchema<boolean>();
}

class NpcState extends Schema {
  @type("string") id = "";
  @type("string") name = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("string") dialogueId = "";
}

class CombatState extends Schema {
  @type("boolean") active = false;
  @type("number") turnIndex = 0;
  @type(["string"]) turnOrder = new ArraySchema<string>();
  @type("number") gridSize = 6;
  @type("number") gridCellSize = 64;
  @type("number") originX = 120;
  @type("number") originY = 80;
}

class GameState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type([NpcState]) npcs = new ArraySchema<NpcState>();
  @type(CombatState) combat = new CombatState();
}

const SPEED = 180;

class RPGRoom extends Room<GameState> {
  private dialogues = new Map<string, DialogueData>();

  onCreate() {
    this.setState(new GameState());
    this.loadDialogues();
    this.addNpc();

    this.setSimulationInterval((deltaTime) => this.update(deltaTime));

    this.onMessage("move", (client, payload: { x: number; y: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.mode !== "exploration") {
        return;
      }
      player.targetX = payload.x;
      player.targetY = payload.y;
    });

    this.onMessage(
      "interact",
      (client, payload: { npcId: string }) => {
        const player = this.state.players.get(client.sessionId);
        const npc = this.state.npcs.find((entry) => entry.id === payload.npcId);
        if (!player || !npc || player.mode !== "exploration") {
          return;
        }
        const distance = Math.hypot(player.x - npc.x, player.y - npc.y);
        if (distance > 60) {
          return;
        }
        player.mode = "dialogue";
        player.activeDialogueId = npc.dialogueId;
        const dialogue = this.dialogues.get(npc.dialogueId);
        if (!dialogue) {
          return;
        }
        player.activeDialogueNodeId = dialogue.start;
        const node = this.getDialogueNode(dialogue, dialogue.start);
        if (node) {
          client.send("dialogue_node", node);
        }
      }
    );

    this.onMessage(
      "dialogue_choice",
      (client, payload: { choiceId: string }) => {
        const player = this.state.players.get(client.sessionId);
        if (!player || player.mode !== "dialogue") {
          return;
        }
        const dialogue = this.dialogues.get(player.activeDialogueId);
        if (!dialogue) {
          return;
        }
        const node = this.getDialogueNode(dialogue, player.activeDialogueNodeId);
        if (!node) {
          return;
        }
        const choice = node.choices.find((entry) => entry.id === payload.choiceId);
        if (!choice) {
          return;
        }
        this.applyChoiceEffects(player, choice);
        if (choice.action === "startCombat") {
          this.startCombat();
          client.send("dialogue_end");
          return;
        }
        if (choice.action === "endDialogue") {
          player.mode = "exploration";
          player.activeDialogueId = "";
          player.activeDialogueNodeId = "";
          client.send("dialogue_end");
          return;
        }
        if (choice.next) {
          player.activeDialogueNodeId = choice.next;
          const nextNode = this.getDialogueNode(dialogue, choice.next);
          if (nextNode) {
            client.send("dialogue_node", nextNode);
          }
        }
      }
    );

    this.onMessage(
      "combat_move",
      (client, payload: { gridX: number; gridY: number }) => {
        const player = this.state.players.get(client.sessionId);
        if (!player || !this.state.combat.active || player.mode !== "combat") {
          return;
        }
        const currentTurnId = this.state.combat.turnOrder[this.state.combat.turnIndex];
        if (currentTurnId !== player.id) {
          return;
        }
        const distance =
          Math.abs(payload.gridX - player.gridX) +
          Math.abs(payload.gridY - player.gridY);
        if (distance > player.movementPoints) {
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
        player.gridX = payload.gridX;
        player.gridY = payload.gridY;
        player.movementPoints -= distance;
        player.x =
          this.state.combat.originX +
          payload.gridX * this.state.combat.gridCellSize +
          this.state.combat.gridCellSize / 2;
        player.y =
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
      const currentTurnId = this.state.combat.turnOrder[this.state.combat.turnIndex];
      if (currentTurnId !== player.id) {
        return;
      }
      this.state.combat.turnIndex =
        (this.state.combat.turnIndex + 1) % this.state.combat.turnOrder.length;
      const nextPlayerId = this.state.combat.turnOrder[this.state.combat.turnIndex];
      const nextPlayer = Array.from(this.state.players.values()).find(
        (entry) => entry.id === nextPlayerId
      );
      if (nextPlayer) {
        nextPlayer.movementPoints = nextPlayer.maxMovement;
      }
    });
  }

  onJoin(client: Client, options: { name?: string }) {
    const player = new PlayerState();
    player.id = client.sessionId;
    player.name = options.name ?? `Heros-${client.sessionId.slice(0, 4)}`;
    player.x = 200 + Math.random() * 200;
    player.y = 200 + Math.random() * 200;
    player.dex = 10 + Math.floor(Math.random() * 6);
    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
  }

  private update(deltaTime: number) {
    const deltaSeconds = deltaTime / 1000;
    for (const player of this.state.players.values()) {
      if (player.mode !== "exploration") {
        continue;
      }
      if (player.targetX < 0 || player.targetY < 0) {
        continue;
      }
      const dx = player.targetX - player.x;
      const dy = player.targetY - player.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 4) {
        player.x = player.targetX;
        player.y = player.targetY;
        player.targetX = -1;
        player.targetY = -1;
        continue;
      }
      const step = SPEED * deltaSeconds;
      player.x += (dx / distance) * Math.min(step, distance);
      player.y += (dy / distance) * Math.min(step, distance);
    }
  }

  private loadDialogues() {
    const filePath = fileURLToPath(new URL("../assets/dialogues.json", import.meta.url));
    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as DialogueData[];
    parsed.forEach((dialogue) => this.dialogues.set(dialogue.id, dialogue));
  }

  private addNpc() {
    const npc = new NpcState();
    npc.id = "sage";
    npc.name = "Sage du village";
    npc.x = 500;
    npc.y = 300;
    npc.dialogueId = "village_sage";
    this.state.npcs.push(npc);
  }

  private getDialogueNode(dialogue: DialogueData, nodeId: string): DialogueNode | undefined {
    return dialogue.nodes.find((node) => node.id === nodeId);
  }

  private applyChoiceEffects(player: PlayerState, choice: DialogueChoice) {
    if (!choice.setFlags) {
      return;
    }
    Object.entries(choice.setFlags).forEach(([key, value]) => {
      player.flags.set(key, value);
    });
  }

  private startCombat() {
    if (this.state.combat.active) {
      return;
    }
    const participants = Array.from(this.state.players.values());
    if (participants.length === 0) {
      return;
    }
    this.state.combat.active = true;
    this.state.combat.turnIndex = 0;
    this.state.combat.turnOrder.clear();

    const initiatives = participants.map((player) => ({
      id: player.id,
      roll: Math.floor(Math.random() * 20) + 1 + player.dex
    }));
    initiatives.sort((a, b) => b.roll - a.roll);
    initiatives.forEach((entry) => this.state.combat.turnOrder.push(entry.id));

    participants.forEach((player, index) => {
      player.mode = "combat";
      player.maxMovement = 4;
      player.movementPoints = player.maxMovement;
      player.gridX = index % this.state.combat.gridSize;
      player.gridY = Math.floor(index / this.state.combat.gridSize);
      player.x =
        this.state.combat.originX +
        player.gridX * this.state.combat.gridCellSize +
        this.state.combat.gridCellSize / 2;
      player.y =
        this.state.combat.originY +
        player.gridY * this.state.combat.gridCellSize +
        this.state.combat.gridCellSize / 2;
    });
  }
}

const app = express();
app.use(cors());
app.get("/", (_req, res) => {
  res.send("Emberfall 3 server running");
});

const server = createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server })
});

gameServer.define("rpg", RPGRoom);

gameServer.listen(2567);

console.log("Server listening on ws://localhost:2567");
