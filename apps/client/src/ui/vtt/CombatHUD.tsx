export type CombatHudElements = {
  root: HTMLDivElement;
  statusBadge: HTMLSpanElement;
  tokenName: HTMLSpanElement;
  tokenType: HTMLSpanElement;
  round: HTMLSpanElement;
  actions: HTMLSpanElement;
  movement: HTMLSpanElement;
  hp: HTMLSpanElement;
  movementValue: HTMLSpanElement;
  movementFill: HTMLDivElement;
  movementState: HTMLSpanElement;
  actionStatus: HTMLSpanElement;
  attackButton: HTMLButtonElement;
  spellsButton: HTMLButtonElement;
  itemsButton: HTMLButtonElement;
  endTurnButton: HTMLButtonElement;
  chatSlot: HTMLDivElement;
};

export function createCombatHUD(): CombatHudElements {
  const root = document.createElement("div");
  root.className = "vtt-combat-hud";

  const header = document.createElement("div");
  header.className = "vtt-combat-hud-header";

  const statusBadge = document.createElement("span");
  statusBadge.className = "vtt-combat-hud-status";
  statusBadge.textContent = "EN ATTENTE";

  const round = document.createElement("span");
  round.className = "vtt-combat-hud-round";
  round.textContent = "Round —";

  header.appendChild(statusBadge);
  header.appendChild(round);

  const identity = document.createElement("div");
  identity.className = "vtt-combat-hud-identity";

  const tokenName = document.createElement("span");
  tokenName.className = "vtt-combat-hud-name";
  tokenName.textContent = "—";

  const tokenType = document.createElement("span");
  tokenType.className = "vtt-combat-hud-type";
  tokenType.textContent = "—";

  identity.appendChild(tokenName);
  identity.appendChild(tokenType);

  const stats = document.createElement("div");
  stats.className = "vtt-combat-hud-stats";

  const actions = document.createElement("span");
  const movement = document.createElement("span");
  const hp = document.createElement("span");

  stats.appendChild(actions);
  stats.appendChild(movement);
  stats.appendChild(hp);

  const movementPanel = document.createElement("div");
  movementPanel.className = "vtt-combat-hud-movement";

  const movementLabel = document.createElement("div");
  movementLabel.className = "vtt-combat-hud-movement-label";
  movementLabel.textContent = "Déplacement";

  const movementValue = document.createElement("span");
  movementValue.className = "vtt-combat-hud-movement-value";
  movementValue.textContent = "0/0 cases";
  movementLabel.appendChild(movementValue);

  const movementTrack = document.createElement("div");
  movementTrack.className = "vtt-combat-hud-movement-track";

  const movementFill = document.createElement("div");
  movementFill.className = "vtt-combat-hud-movement-fill";
  movementTrack.appendChild(movementFill);

  const movementState = document.createElement("span");
  movementState.className = "vtt-combat-hud-movement-state";
  movementState.textContent = "";

  movementPanel.appendChild(movementLabel);
  movementPanel.appendChild(movementTrack);
  movementPanel.appendChild(movementState);

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

  const actionStatus = document.createElement("span");
  actionStatus.className = "vtt-combat-hud-action-status";

  const chatPanel = document.createElement("div");
  chatPanel.className = "vtt-combat-hud-chat";

  const chatHeader = document.createElement("div");
  chatHeader.className = "vtt-combat-hud-chat-header";
  chatHeader.textContent = "Chat de combat";

  const chatSlot = document.createElement("div");
  chatSlot.className = "vtt-combat-hud-chat-slot";

  chatPanel.appendChild(chatHeader);
  chatPanel.appendChild(chatSlot);

  root.appendChild(header);
  root.appendChild(identity);
  root.appendChild(stats);
  root.appendChild(movementPanel);
  root.appendChild(buttons);
  root.appendChild(actionStatus);
  root.appendChild(chatPanel);

  return {
    root,
    statusBadge,
    tokenName,
    tokenType,
    round,
    actions,
    movement,
    hp,
    movementValue,
    movementFill,
    movementState,
    actionStatus,
    attackButton,
    spellsButton,
    itemsButton,
    endTurnButton,
    chatSlot
  };
}
