export type DiceSpec = {
  count: number;
  sides: number;
  bonus: number;
};

export function parseDice(input: string): DiceSpec {
  const match = /^(\d+)d(\d+)([+-]\d+)?$/i.exec(input.trim());
  if (!match) {
    return { count: 1, sides: 4, bonus: 0 };
  }
  const count = Number.parseInt(match[1], 10);
  const sides = Number.parseInt(match[2], 10);
  const bonus = match[3] ? Number.parseInt(match[3], 10) : 0;
  return {
    count: Number.isFinite(count) && count > 0 ? count : 1,
    sides: Number.isFinite(sides) && sides > 0 ? sides : 4,
    bonus: Number.isFinite(bonus) ? bonus : 0
  };
}

export function rollDice(input: string) {
  const spec = parseDice(input);
  const rolls: number[] = [];
  let total = spec.bonus;
  for (let index = 0; index < spec.count; index += 1) {
    const roll = Math.floor(Math.random() * spec.sides) + 1;
    rolls.push(roll);
    total += roll;
  }
  return { total, rolls, bonus: spec.bonus };
}

export function rollD20() {
  return Math.floor(Math.random() * 20) + 1;
}
