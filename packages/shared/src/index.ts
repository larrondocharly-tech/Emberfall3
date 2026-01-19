export type PlayerId = string;

export interface Vector2 {
  x: number;
  y: number;
}

export interface PlayerFlags {
  [key: string]: boolean;
}

export type PlayerMode = "exploration" | "combat" | "dialogue";

export interface PlayerStateData {
  id: PlayerId;
  name: string;
  position: Vector2;
  target?: Vector2;
  dex: number;
  flags: PlayerFlags;
  mode: PlayerMode;
}

export interface NpcDefinition {
  id: string;
  name: string;
  position: Vector2;
  dialogueId: string;
}

export interface DialogueChoice {
  id: string;
  label: string;
  next?: string;
  setFlags?: Record<string, boolean>;
  action?: "startCombat" | "endDialogue";
}

export interface DialogueNode {
  id: string;
  text: string;
  choices: DialogueChoice[];
}

export interface DialogueData {
  id: string;
  start: string;
  nodes: DialogueNode[];
}

export interface CombatParticipant {
  id: PlayerId;
  initiative: number;
  movement: number;
  maxMovement: number;
}

export interface CombatStateData {
  active: boolean;
  turnIndex: number;
  turnOrder: PlayerId[];
  gridSize: number;
  gridCellSize: number;
}

export type ClientToServerMessage =
  | { type: "move"; payload: Vector2 }
  | { type: "interact"; payload: { npcId: string } }
  | { type: "dialogue_choice"; payload: { choiceId: string } }
  | { type: "combat_move"; payload: { gridX: number; gridY: number } }
  | { type: "end_turn" };

export type ServerToClientMessage =
  | { type: "dialogue_node"; payload: DialogueNode }
  | { type: "dialogue_end" }
  | { type: "combat_start" }
  | { type: "combat_update"; payload: CombatStateData };
