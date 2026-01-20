export type CanvasViewElements = {
  root: HTMLDivElement;
  position: HTMLDivElement;
  grid: HTMLDivElement;
  viewport: HTMLDivElement;
  inner: HTMLDivElement;
};

export function createCanvasView(): CanvasViewElements {
  const root = document.createElement("div");
  root.className = "vtt-canvas";

  const header = document.createElement("div");
  header.className = "vtt-canvas-header";

  const position = document.createElement("div");
  header.appendChild(position);

  const viewport = document.createElement("div");
  viewport.className = "vtt-canvas-viewport";

  const inner = document.createElement("div");
  inner.className = "vtt-canvas-inner";

  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(12, 24px)";
  grid.style.gap = "4px";

  inner.appendChild(grid);
  viewport.appendChild(inner);

  root.appendChild(viewport);
  root.appendChild(header);

  return { root, position, grid, viewport, inner };
}
