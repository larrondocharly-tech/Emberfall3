export type PlayerId = string;

export interface Vector2 {
  x: number;
  y: number;
}

export type PlayerMode = "exploration" | "combat";

export interface RaceData {
  id: string;
  name: string;
  dexBonus: number;
  hpBonus: number;
}

export interface ClassData {
  id: string;
  name: string;
  baseHp: number;
  baseDex: number;
  movePoints: number;
}

export interface SpellData {
  id: string;
  name: string;
  type: "projectile" | "impact" | "aura";
  color: string;
  damage?: number;
  heal?: number;
  buff?: string;
}

export interface MonsterData {
  id: string;
  name: string;
  hp: number;
  dex: number;
  movePoints: number;
}

export interface QuestData {
  id: string;
  name: string;
  objective: string;
  reward: string;
}

export type ItemDef = {
  id: string;
  name: string;
  description: string;
  icon?: string;
  stackable: boolean;
  rarity: "common" | "uncommon" | "rare" | "epic";
};

export type InventoryState = {
  items: Record<string, number>;
  equipment: {
    weapon?: string;
    armor?: string;
    trinket?: string;
  };
};

export type DialogueChoice = {
  text: string;
  next?: string;
  giveItem?: string;
  startQuest?: string;
  end?: boolean;
};

export type DialogueNode = {
  id: string;
  speaker: string;
  text: string;
  choices: DialogueChoice[];
};

export type NpcDef = {
  id: string;
  name: string;
  tokenType: "npc";
  gridX: number;
  gridY: number;
  dialogueId: string;
};

export interface MapObstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CombatStateData {
  active: boolean;
  turnIndex: number;
  turnOrder: PlayerId[];
  activeTokenId: string;
  gridSize: number;
  gridCellSize: number;
  origin: Vector2;
}

export interface TokenStateData {
  id: string;
  name: string;
  ownerId: string;
  type: "player" | "monster";
  position: Vector2;
  dex: number;
  hp: number;
  maxHp: number;
  movePoints: number;
  maxMovePoints: number;
}

export type ClientToServerMessage =
  | { type: "move"; payload: Vector2 }
  | { type: "combat_move"; payload: { gridX: number; gridY: number } }
  | { type: "end_turn" }
  | { type: "spawn_monster"; payload: { monsterId: string } }
  | { type: "start_combat" }
  | { type: "chat"; payload: { text: string } }
  | { type: "roll"; payload: { kind: "d20" | "attack" | "skill" } }
  | { type: "cast_spell"; payload: { spellId: string; target: Vector2 } };

export type ServerToClientMessage =
  | { type: "chat"; payload: { message: string } }
  | { type: "roll_result"; payload: { message: string } }
  | { type: "spell_vfx"; payload: { spellId: string; from: Vector2; to: Vector2 } };
