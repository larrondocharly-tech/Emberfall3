import type { GameToken } from "./state";
import { chebyshevDistance } from "./combat";

export type EnemyAction = {
  targetId: string | null;
  nextPosition: { x: number; y: number } | null;
  distance: number;
};

export function findNearestHero(enemy: GameToken, tokens: GameToken[]) {
  const heroes = tokens.filter((token) => token.type === "player");
  if (!heroes.length) {
    return null;
  }
  let closest = heroes[0];
  let bestDistance = chebyshevDistance(enemy, closest);
  heroes.slice(1).forEach((hero) => {
    const distance = chebyshevDistance(enemy, hero);
    if (distance < bestDistance) {
      bestDistance = distance;
      closest = hero;
    }
  });
  return { target: closest, distance: bestDistance };
}

export function stepTowardTarget(enemy: GameToken, target: GameToken) {
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const stepX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
  const stepY = dy === 0 ? 0 : dy > 0 ? 1 : -1;
  return { x: enemy.x + stepX, y: enemy.y + stepY };
}

export function getEnemyAction(enemy: GameToken, tokens: GameToken[]): EnemyAction {
  const nearest = findNearestHero(enemy, tokens);
  if (!nearest) {
    return { targetId: null, nextPosition: null, distance: 0 };
  }
  if (nearest.distance <= 1) {
    return { targetId: nearest.target.id, nextPosition: null, distance: nearest.distance };
  }
  return {
    targetId: nearest.target.id,
    nextPosition: stepTowardTarget(enemy, nearest.target),
    distance: nearest.distance
  };
}
