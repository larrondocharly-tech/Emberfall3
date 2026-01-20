import type { Tool } from "../../game/tools";

const TOOL_ICONS: Record<Tool, string> = {
  token: "👤",
  pan: "🖐️",
  measure: "📏",
  draw: "🖊️"
};

export function createLeftToolbar(
  activeTool: Tool,
  onSelect: (tool: Tool) => void
): HTMLDivElement {
  const root = document.createElement("div");
  root.className = "vtt-left-toolbar";
  (Object.keys(TOOL_ICONS) as Tool[]).forEach((tool) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = TOOL_ICONS[tool];
    button.dataset.tool = tool;
    if (tool === activeTool) {
      button.classList.add("active");
    }
    button.addEventListener("click", () => onSelect(tool));
    root.appendChild(button);
  });
  return root;
}
