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

export type Scene = {
  id: string;
  name: string;
  mapUrl: string;
};

export type GameState = {
  session: Session | null;
  scene: Scene;
};

export const initialState: GameState = {
  session: null,
  scene: getSceneById(defaultSceneId)
};
