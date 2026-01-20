export function createLeftToolbar(): HTMLDivElement {
  const root = document.createElement("div");
  root.className = "vtt-left-toolbar";
  const tools = ["🗺️", "🧭", "⚔️", "🎲", "✨", "🧰"];
  tools.forEach((icon) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = icon;
    root.appendChild(button);
  });
  return root;
}
