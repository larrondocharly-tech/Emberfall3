import type { Scene } from "./scenes";
import { defaultSceneId, getSceneById } from "./scenes";

export type PlayerProfile = {
  name: string;
  raceId: string;
  classId: string;
};

export type Session = {
  id: string;
  player: PlayerProfile;
  createdAt: string;
  code: string;
};

export type TokenType = "player" | "npc" | "monster";

export type GameToken = {
  id: string;
  name: string;
  x: number;
  y: number;
  size: number;
  color: string;
  type: TokenType;
};

export type GameState = {
  session: Session | null;
  scene: Scene;
  tokens: GameToken[];
};

export const initialState: GameState = {
  session: null,
  scene: getSceneById(defaultSceneId),
  tokens: [
    {
      id: "player",
      name: "Héros",
      x: 6,
      y: 6,
      size: 1,
      color: "#38bdf8",
      type: "player"
    }
  ]
};
