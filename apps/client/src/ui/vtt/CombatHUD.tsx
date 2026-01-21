export type CombatHudElements = {
  root: HTMLDivElement;
  statusBadge: HTMLSpanElement;
  tokenName: HTMLSpanElement;
  tokenType: HTMLSpanElement;
  round: HTMLSpanElement;
  hp: HTMLSpanElement;
  actionPips: HTMLDivElement;
  actionValue: HTMLSpanElement;
  actionNotice: HTMLSpanElement;
  movementPips: HTMLDivElement;
  movementValue: HTMLSpanElement;
  movementNotice: HTMLSpanElement;
  attackButton: HTMLButtonElement;
  spellsButton: HTMLButtonElement;
  itemsButton: HTMLButtonElement;
  endTurnButton: HTMLButtonElement;
  chatSlot: HTMLDivElement;
};

export function createCombatHUD(): CombatHudElements {
  const root = document.createElement("div");
  root.className = "vtt-combat-hud";

  const left = document.createElement("div");
  left.className = "vtt-combat-hud-left";

  const statusBadge = document.createElement("span");
  statusBadge.className = "vtt-combat-hud-status";
  statusBadge.textContent = "EN ATTENTE";

  const tokenName = document.createElement("span");
  tokenName.className = "vtt-combat-hud-name";
  tokenName.textContent = "—";

  const tokenType = document.createElement("span");
  tokenType.className = "vtt-combat-hud-type";
  tokenType.textContent = "—";

  const hp = document.createElement("span");
  hp.className = "vtt-combat-hud-hp";
  hp.textContent = "PV: —";

  const round = document.createElement("span");
  round.className = "vtt-combat-hud-round";
  round.textContent = "Round —";

  left.appendChild(statusBadge);
  left.appendChild(tokenName);
  left.appendChild(tokenType);
  left.appendChild(hp);
  left.appendChild(round);

  const center = document.createElement("div");
  center.className = "vtt-combat-hud-center";

  const actionRow = document.createElement("div");
  actionRow.className = "vtt-combat-hud-row";

  const actionLabel = document.createElement("span");
  actionLabel.className = "vtt-combat-hud-label";
  actionLabel.textContent = "PA";

  const actionPips = document.createElement("div");
  actionPips.className = "vtt-combat-hud-pips";

  const actionValue = document.createElement("span");
  actionValue.className = "vtt-combat-hud-value";
  actionValue.textContent = "0/0";

  actionRow.appendChild(actionLabel);
  actionRow.appendChild(actionPips);
  actionRow.appendChild(actionValue);

  const actionNotice = document.createElement("span");
  actionNotice.className = "vtt-combat-hud-notice";

  const movementRow = document.createElement("div");
  movementRow.className = "vtt-combat-hud-row";

  const movementLabel = document.createElement("span");
  movementLabel.className = "vtt-combat-hud-label";
  movementLabel.textContent = "PM";

  const movementPips = document.createElement("div");
  movementPips.className = "vtt-combat-hud-pips";

  const movementValue = document.createElement("span");
  movementValue.className = "vtt-combat-hud-value";
  movementValue.textContent = "0/0";

  movementRow.appendChild(movementLabel);
  movementRow.appendChild(movementPips);
  movementRow.appendChild(movementValue);

  const movementNotice = document.createElement("span");
  movementNotice.className = "vtt-combat-hud-notice";

  center.appendChild(actionRow);
  center.appendChild(actionNotice);
  center.appendChild(movementRow);
  center.appendChild(movementNotice);

  const right = document.createElement("div");
  right.className = "vtt-combat-hud-right";

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
  endTurnButton.textContent = "Passer";

  right.appendChild(attackButton);
  right.appendChild(spellsButton);
  right.appendChild(itemsButton);
  right.appendChild(endTurnButton);

  const chatPanel = document.createElement("div");
  chatPanel.className = "vtt-combat-hud-chat";

  const chatHeader = document.createElement("div");
  chatHeader.className = "vtt-combat-hud-chat-header";
  chatHeader.textContent = "Chat de combat";

  const chatSlot = document.createElement("div");
  chatSlot.className = "vtt-combat-hud-chat-slot";

  chatPanel.appendChild(chatHeader);
  chatPanel.appendChild(chatSlot);

  root.appendChild(left);
  root.appendChild(center);
  root.appendChild(right);
  root.appendChild(chatPanel);

  return {
    root,
    statusBadge,
    tokenName,
    tokenType,
    round,
    hp,
    actionPips,
    actionValue,
    actionNotice,
    movementPips,
    movementValue,
    movementNotice,
    attackButton,
    spellsButton,
    itemsButton,
    endTurnButton,
    chatSlot
  };
}
