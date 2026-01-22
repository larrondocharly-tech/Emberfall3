import type { InventoryState } from "@emberfall3/shared";

export type SaveState = {
  inventory: InventoryState;
  flags: Record<string, boolean>;
  quests: Record<string, boolean>;
};

const STORAGE_KEY = "emberfall.save";

export const defaultInventoryState: InventoryState = {
  items: {},
  equipment: {}
};

export const loadGameState = (): SaveState => {
  if (typeof window === "undefined") {
    return { inventory: defaultInventoryState, flags: {}, quests: {} };
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { inventory: defaultInventoryState, flags: {}, quests: {} };
  }
  try {
    const parsed = JSON.parse(raw) as SaveState;
    return {
      inventory: parsed.inventory ?? defaultInventoryState,
      flags: parsed.flags ?? {},
      quests: parsed.quests ?? {}
    };
  } catch {
    return { inventory: defaultInventoryState, flags: {}, quests: {} };
  }
};

export const saveGameState = (state: SaveState) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};
