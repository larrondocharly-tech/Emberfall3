export type CombatHudElements = {
  root: HTMLDivElement;
  tokenName: HTMLSpanElement;
  tokenType: HTMLSpanElement;
  round: HTMLSpanElement;
  actions: HTMLSpanElement;
  movement: HTMLSpanElement;
  attackButton: HTMLButtonElement;
  spellsButton: HTMLButtonElement;
  itemsButton: HTMLButtonElement;
  endTurnButton: HTMLButtonElement;
};

export function createCombatHUD(): CombatHudElements {
  const root = document.createElement("div");
  root.className = "vtt-combat-hud";

  const header = document.createElement("div");
  header.className = "vtt-combat-hud-header";

  const tokenName = document.createElement("span");
  tokenName.textContent = "—";
  const tokenType = document.createElement("span");
  tokenType.className = "vtt-combat-hud-type";
  tokenType.textContent = "—";
  header.appendChild(tokenName);
  header.appendChild(tokenType);

  const stats = document.createElement("div");
  stats.className = "vtt-combat-hud-stats";

  const round = document.createElement("span");
  const actions = document.createElement("span");
  const movement = document.createElement("span");
  stats.appendChild(round);
  stats.appendChild(actions);
  stats.appendChild(movement);

  const buttons = document.createElement("div");
  buttons.className = "vtt-combat-hud-actions";

  const attackButton = document.createElement("button");
  attackButton.type = "button";
  attackButton.textContent = "Attaquer";

  const spellsButton = document.createElement("button");
  spellsButton.type = "button";
  spellsButton.textContent = "Sorts";

  const itemsButton = document.createElement("button");
  itemsButton.type = "button";
  itemsButton.textContent = "Objets";

  const endTurnButton = document.createElement("button");
  endTurnButton.type = "button";
  endTurnButton.textContent = "Passer le tour";

  buttons.appendChild(attackButton);
  buttons.appendChild(spellsButton);
  buttons.appendChild(itemsButton);
  buttons.appendChild(endTurnButton);

  root.appendChild(header);
  root.appendChild(stats);
  root.appendChild(buttons);

  return {
    root,
    tokenName,
    tokenType,
    round,
    actions,
    movement,
    attackButton,
    spellsButton,
    itemsButton,
    endTurnButton
  };
}
