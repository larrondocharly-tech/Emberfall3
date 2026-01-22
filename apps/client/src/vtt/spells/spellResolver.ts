import type { SpellDefinition } from "./spellbook";
import type { SurfaceType } from "../effects/surfaces";
import type { TokenStatusType } from "../effects/statuses";

export type GridPoint = { x: number; y: number };
export type TokenLike = {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
};

export type SurfaceStoreLike = {
  getSurface: (x: number, y: number) => { type: SurfaceType; durationTurns: number } | null;
  setSurface: (x: number, y: number, surface: { type: SurfaceType; durationTurns: number }) => void;
  removeSurface: (x: number, y: number) => void;
};

export type StatusStoreLike = {
  addStatus: (tokenId: string, type: TokenStatusType, durationTurns: number) => void;
  hasStatus: (tokenId: string, type: TokenStatusType) => boolean;
};

export type SpellResolverContext = {
  spell: SpellDefinition;
  caster: TokenLike;
  targetCell: GridPoint;
  targets: TokenLike[];
  allTokens: TokenLike[];
  surfaceStore: SurfaceStoreLike;
  statusStore: StatusStoreLike;
  log: (message: string) => void;
  applyDamage: (token: TokenLike, amount: number) => void;
  applyHealing: (token: TokenLike, amount: number) => void;
  playFx: (kind: "fire" | "heal" | "electric" | "explosion", from: GridPoint, to: GridPoint) => void;
};

export type DiceResult = { total: number; rolls: number[] };

const rollDie = (sides: number) => Math.floor(Math.random() * sides) + 1;

export const rollDice = (formula: string): DiceResult => {
  const match = formula.trim().match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) {
    return { total: 0, rolls: [] };
  }
  const count = Number(match[1]);
  const sides = Number(match[2]);
  const modifier = match[3] ? Number(match[3]) : 0;
  const rolls = Array.from({ length: count }, () => rollDie(sides));
  const total = rolls.reduce((sum, value) => sum + value, 0) + modifier;
  return { total, rolls };
};

const applyWetSynergy = (
  token: TokenLike,
  baseDamage: number,
  statusStore: StatusStoreLike,
  log: (message: string) => void
) => {
  if (!statusStore.hasStatus(token.id, "wet")) {
    return baseDamage;
  }
  const boosted = Math.ceil(baseDamage * 1.5);
  statusStore.addStatus(token.id, "shocked", 1);
  log("Synergie : Cible mouillée → dégâts électriques amplifiés.");
  return boosted;
};

const triggerOilExplosion = (
  center: GridPoint,
  allTokens: TokenLike[],
  surfaceStore: SurfaceStoreLike,
  statusStore: StatusStoreLike,
  applyDamage: (token: TokenLike, amount: number) => void,
  log: (message: string) => void,
  playFx: (kind: "fire" | "explosion", from: GridPoint, to: GridPoint) => void
) => {
  const affected = allTokens.filter(
    (token) => Math.max(Math.abs(token.x - center.x), Math.abs(token.y - center.y)) <= 1
  );
  affected.forEach((token) => {
    const result = rollDice("1d4");
    applyDamage(token, result.total);
    statusStore.addStatus(token.id, "burning", 2);
    log(`Explosion d'huile : ${token.name} subit ${result.total} dégâts.`);
  });
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      const x = center.x + dx;
      const y = center.y + dy;
      const surface = surfaceStore.getSurface(x, y);
      if (surface?.type === "oil") {
        surfaceStore.setSurface(x, y, { type: "fire", durationTurns: 2 });
      }
      if (surface?.type === "water") {
        surfaceStore.removeSurface(x, y);
      }
    }
  }
  playFx("explosion", center, center);
  log("Synergie : Explosion enflammée (huile).");
};

export const resolveSpell = (context: SpellResolverContext) => {
  const {
    spell,
    caster,
    targetCell,
    targets,
    allTokens,
    surfaceStore,
    statusStore,
    log,
    applyDamage,
    applyHealing,
    playFx
  } = context;

  if (spell.element === "heal") {
    const result = rollDice(spell.heal ?? "1d8");
    targets.forEach((token) => {
      applyHealing(token, result.total);
      log(`${caster.name} soigne ${token.name} : ${result.total} PV.`);
      playFx("heal", targetCell, { x: token.x, y: token.y });
    });
    return;
  }

  const base = rollDice(spell.damage ?? "1d6");
  targets.forEach((token) => {
    let total = base.total;
    if (spell.element === "electric") {
      total = applyWetSynergy(token, total, statusStore, log);
      playFx("electric", targetCell, { x: token.x, y: token.y });
    }
    if (spell.element === "fire") {
      playFx("fire", { x: caster.x, y: caster.y }, { x: token.x, y: token.y });
      if (statusStore.hasStatus(token.id, "oiled") || surfaceStore.getSurface(token.x, token.y)?.type === "oil") {
        triggerOilExplosion(
          { x: token.x, y: token.y },
          allTokens,
          surfaceStore,
          statusStore,
          applyDamage,
          log,
          playFx
        );
      }
      statusStore.addStatus(token.id, "burning", 2);
      surfaceStore.setSurface(token.x, token.y, { type: "fire", durationTurns: 1 });
    }
    applyDamage(token, total);
    log(`${caster.name} lance ${spell.name} sur ${token.name} : ${total} dégâts (${spell.logLabel}).`);
  });

  if (spell.element === "electric") {
    const surface = surfaceStore.getSurface(targetCell.x, targetCell.y);
    if (surface?.type === "water") {
      log("Synergie : L'eau amplifie la décharge électrique.");
    }
  }
};
