import type { SpellDefinition } from "./spellbook";

export type GridPoint = { x: number; y: number };

export type SpellTargetingState = {
  spell: SpellDefinition;
  casterId: string;
  rangeCells: Set<string>;
  areaCells: Set<string>;
  hoverCell: GridPoint | null;
};

const keyFor = (point: GridPoint) => `${point.x},${point.y}`;

export const buildRangeCells = (caster: GridPoint, range: number, gridSize: number) => {
  const cells = new Set<string>();
  for (let dx = -range; dx <= range; dx += 1) {
    for (let dy = -range; dy <= range; dy += 1) {
      const distance = Math.abs(dx) + Math.abs(dy);
      if (distance > range) {
        continue;
      }
      const x = caster.x + dx;
      const y = caster.y + dy;
      if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) {
        continue;
      }
      cells.add(`${x},${y}`);
    }
  }
  return cells;
};

const clampPoint = (point: GridPoint, gridSize: number) => ({
  x: Math.max(0, Math.min(gridSize - 1, point.x)),
  y: Math.max(0, Math.min(gridSize - 1, point.y))
});

const bresenhamLine = (start: GridPoint, end: GridPoint) => {
  const points: GridPoint[] = [];
  let x0 = start.x;
  let y0 = start.y;
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  const sx = start.x < end.x ? 1 : -1;
  const sy = start.y < end.y ? 1 : -1;
  let err = dx - dy;
  while (true) {
    points.push({ x: x0, y: y0 });
    if (x0 === end.x && y0 === end.y) {
      break;
    }
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
  return points;
};

const buildCircle = (center: GridPoint, radius: number, gridSize: number) => {
  const cells: GridPoint[] = [];
  for (let dx = -radius; dx <= radius; dx += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      if (Math.abs(dx) + Math.abs(dy) > radius) {
        continue;
      }
      const point = clampPoint({ x: center.x + dx, y: center.y + dy }, gridSize);
      cells.push(point);
    }
  }
  return cells;
};

const buildLine = (caster: GridPoint, target: GridPoint, length: number, gridSize: number) => {
  const points = bresenhamLine(caster, target).slice(1, length + 1);
  return points.map((point) => clampPoint(point, gridSize));
};

const buildCone = (caster: GridPoint, target: GridPoint, length: number, gridSize: number) => {
  const points: GridPoint[] = [];
  const dx = target.x - caster.x;
  const dy = target.y - caster.y;
  const dirX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
  const dirY = dy === 0 ? 0 : dy > 0 ? 1 : -1;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  for (let step = 1; step <= length; step += 1) {
    const width = Math.floor(step / 2);
    for (let offset = -width; offset <= width; offset += 1) {
      const point = horizontal
        ? { x: caster.x + dirX * step, y: caster.y + offset }
        : { x: caster.x + offset, y: caster.y + dirY * step };
      points.push(clampPoint(point, gridSize));
    }
  }
  return points;
};

export const buildAreaCells = (
  spell: SpellDefinition,
  caster: GridPoint,
  target: GridPoint,
  gridSize: number
) => {
  if (spell.shape === "single") {
    return [clampPoint(target, gridSize)];
  }
  if (spell.shape === "circle") {
    return buildCircle(target, spell.radius ?? 1, gridSize);
  }
  if (spell.shape === "line") {
    return buildLine(caster, target, spell.length ?? spell.range, gridSize);
  }
  return buildCone(caster, target, spell.length ?? spell.range, gridSize);
};

export const createSpellTargetingState = (
  spell: SpellDefinition,
  casterId: string,
  casterPosition: GridPoint,
  gridSize: number
): SpellTargetingState => ({
  spell,
  casterId,
  rangeCells: buildRangeCells(casterPosition, spell.range, gridSize),
  areaCells: new Set<string>(),
  hoverCell: null
});

export const updateSpellTargetingHover = (
  state: SpellTargetingState,
  caster: GridPoint,
  hover: GridPoint | null,
  gridSize: number
) => {
  state.hoverCell = hover;
  state.areaCells = new Set<string>();
  if (!hover) {
    return;
  }
  const area = buildAreaCells(state.spell, caster, hover, gridSize);
  area.forEach((cell) => state.areaCells.add(keyFor(cell)));
};

export const isCellInRange = (state: SpellTargetingState, cell: GridPoint) =>
  state.rangeCells.has(keyFor(cell));

export const expandCells = (cells: Set<string>) =>
  Array.from(cells).map((key) => {
    const [xStr, yStr] = key.split(",");
    return { x: Number(xStr), y: Number(yStr) };
  });

export const getAreaTargets = (state: SpellTargetingState) => expandCells(state.areaCells);
