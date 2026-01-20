export type TopBarElements = {
  root: HTMLDivElement;
  room: HTMLSpanElement;
  status: HTMLSpanElement;
  toggleSidebar: HTMLButtonElement;
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

  const toggleSidebar = document.createElement("button");
  toggleSidebar.type = "button";
  toggleSidebar.textContent = "☰";

  meta.appendChild(room);
  meta.appendChild(status);
  meta.appendChild(toggleSidebar);

  root.appendChild(title);
  root.appendChild(meta);

  return { root, room, status, toggleSidebar };
}
