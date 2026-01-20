export type TopBarElements = {
  root: HTMLDivElement;
  room: HTMLSpanElement;
  status: HTMLSpanElement;
  tool: HTMLSpanElement;
  toggleSidebar: HTMLButtonElement;
  combatToggle: HTMLButtonElement;
  combatInfo: HTMLSpanElement;
  endTurn: HTMLButtonElement;
};

export function createTopBar(): TopBarElements {
  const root = document.createElement("div");
  root.className = "vtt-topbar";

  const title = document.createElement("strong");
  title.textContent = "Emberfall VTT";

  const meta = document.createElement("div");
  meta.className = "vtt-topbar-meta";

  const room = document.createElement("span");
  const status = document.createElement("span");
  status.textContent = "Solo";
  const tool = document.createElement("span");
  tool.textContent = "Tool: Token";

  const toggleSidebar = document.createElement("button");
  toggleSidebar.type = "button";
  toggleSidebar.textContent = "☰";

  const combatToggle = document.createElement("button");
  combatToggle.type = "button";
  combatToggle.textContent = "Combat: OFF";

  const combatInfo = document.createElement("span");
  combatInfo.textContent = "Exploration";

  const endTurn = document.createElement("button");
  endTurn.type = "button";
  endTurn.textContent = "Passer";

  meta.appendChild(room);
  meta.appendChild(status);
  meta.appendChild(tool);
  meta.appendChild(combatInfo);
  meta.appendChild(combatToggle);
  meta.appendChild(endTurn);
  meta.appendChild(toggleSidebar);

  root.appendChild(title);
  root.appendChild(meta);

  return { root, room, status, tool, toggleSidebar, combatToggle, combatInfo, endTurn };
}
