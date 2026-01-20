import type { GameAdapter, AdapterResult } from "./types";
import type { PlayerProfile } from "../game/state";
import { createSession, findSessionById, findSessionIdByCode } from "../game/engine";

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
      const isShortCode = /^\d{4}$/.test(sessionId);
      const resolvedId = isShortCode ? findSessionIdByCode(sessionId) : sessionId;
      const session = resolvedId ? findSessionById(resolvedId) : null;
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
