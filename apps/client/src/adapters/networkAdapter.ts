import type { GameAdapter, AdapterResult } from "./types";
import type { PlayerProfile } from "../game/state";

export function createNetworkAdapter(): GameAdapter {
  return {
    connect: async () => {
      // Multi à brancher plus tard via Colyseus.
      throw new Error("Multijoueur non disponible.");
    },
    createRoom: async (_player: PlayerProfile): Promise<AdapterResult> => {
      // Multi à brancher plus tard via Colyseus.
      throw new Error("Multijoueur non disponible.");
    },
    joinRoomById: async (_sessionId: string, _player: PlayerProfile): Promise<AdapterResult> => {
      // Multi à brancher plus tard via Colyseus.
      throw new Error("Multijoueur non disponible.");
    },
    disconnect: async () => {
      return;
    },
    dispatch: () => {
      return;
    }
  };
}
