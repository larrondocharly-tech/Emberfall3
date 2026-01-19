import type { PlayerProfile, Session } from "../game/state";

export type AdapterResult = {
  session: Session;
};

export interface GameAdapter {
  connect: () => Promise<void>;
  createRoom: (player: PlayerProfile) => Promise<AdapterResult>;
  joinRoomById: (sessionId: string, player: PlayerProfile) => Promise<AdapterResult>;
  disconnect: () => Promise<void>;
  dispatch: (action: unknown) => void;
}
