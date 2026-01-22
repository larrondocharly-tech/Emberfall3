export type SpellElement = "fire" | "electric" | "heal";
export type SpellShape = "single" | "circle" | "line" | "cone";
export type SpellTargeting = "enemy" | "ally" | "any" | "ground";

export type SpellDefinition = {
  id: "FIRE_BOLT" | "HEAL" | "THUNDER";
  name: string;
  range: number;
  actionCost: number;
  element: SpellElement;
  shape: SpellShape;
  targeting: SpellTargeting;
  requiresLOS: boolean;
  radius?: number;
  length?: number;
  angle?: number;
  damage?: string;
  heal?: string;
  logLabel: string;
};

export const spellbook: SpellDefinition[] = [
  {
    id: "FIRE_BOLT",
    name: "Fire Bolt",
    range: 6,
    actionCost: 1,
    element: "fire",
    shape: "single",
    targeting: "enemy",
    requiresLOS: false,
    damage: "1d10",
    logLabel: "feu"
  },
  {
    id: "HEAL",
    name: "Heal",
    range: 4,
    actionCost: 1,
    element: "heal",
    shape: "single",
    targeting: "ally",
    requiresLOS: false,
    heal: "1d8+1",
    logLabel: "soin"
  },
  {
    id: "THUNDER",
    name: "Thunder",
    range: 5,
    actionCost: 1,
    element: "electric",
    shape: "circle",
    targeting: "any",
    requiresLOS: false,
    radius: 1,
    damage: "1d6",
    logLabel: "électrique"
  }
];

export const getSpellById = (id: SpellDefinition["id"]) =>
  spellbook.find((spell) => spell.id === id) ?? null;
