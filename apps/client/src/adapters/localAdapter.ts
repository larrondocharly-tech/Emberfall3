import type { GameAdapter, AdapterResult } from "./types";
import type { PlayerProfile } from "../game/state";
import { createSession, findSessionById } from "../game/engine";

export function createLocalAdapter(): GameAdapter {
  return {
    connect: async () => {
      return;
    },
    createRoom: async (player: PlayerProfile): Promise<AdapterResult> => {
      const session = createSession(player);
      return { session };
    },
    joinRoomById: async (sessionId: string, player: PlayerProfile): Promise<AdapterResult> => {
      const session = findSessionById(sessionId);
      if (!session) {
        throw new Error("Room introuvable (solo local).");
      }
      return { session: { ...session, player } };
    },
    disconnect: async () => {
      return;
    },
    dispatch: () => {
      return;
    }
  };
}
