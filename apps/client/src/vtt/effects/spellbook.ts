export type SpellId = "FIRE_BOLT" | "HEAL" | "THUNDER";

type SpellTarget = "enemy" | "ally" | "any" | "ground";

type SpellElement = "fire" | "healing" | "electric";

export type Spell = {
  id: SpellId;
  name: string;
  range: number;
  target: SpellTarget;
  element: SpellElement;
  areaRadius?: number;
  description: string;
};

export const spellbook: Spell[] = [
  {
    id: "FIRE_BOLT",
    name: "Fire Bolt",
    range: 6,
    target: "enemy",
    element: "fire",
    description: "Projectile de feu à cible unique."
  },
  {
    id: "HEAL",
    name: "Soin",
    range: 4,
    target: "ally",
    element: "healing",
    description: "Soin léger à une cible alliée."
  },
  {
    id: "THUNDER",
    name: "Tonnerre",
    range: 5,
    target: "ground",
    element: "electric",
    areaRadius: 1,
    description: "Décharge électrique en zone."
  }
];

export function getSpellById(id: SpellId) {
  return spellbook.find((spell) => spell.id === id) ?? null;
}
