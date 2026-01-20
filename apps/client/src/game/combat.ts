import type { GameToken } from "./state";
import { rollD20, rollDice } from "./dice";

export type AttackResult = {
  roll: number;
  total: number;
  hit: boolean;
  damageTotal: number;
  damageRolls: number[];
  remainingHp: number;
};

export function chebyshevDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function isInMeleeRange(attacker: GameToken, target: GameToken, range = 1) {
  return chebyshevDistance(attacker, target) <= range;
}

export function resolveAttack(attacker: GameToken, target: GameToken): AttackResult {
  const roll = rollD20();
  const total = roll + attacker.attackBonus;
  const hit = total >= target.ac;
  const damage = hit ? rollDice(attacker.damage) : { total: 0, rolls: [], bonus: 0 };
  const remainingHp = Math.max(0, target.hp - damage.total);
  return {
    roll,
    total,
    hit,
    damageTotal: damage.total,
    damageRolls: damage.rolls,
    remainingHp
  };
}
