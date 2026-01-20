export type CanvasViewElements = {
  root: HTMLDivElement;
  position: HTMLDivElement;
  grid: HTMLDivElement;
  viewport: HTMLDivElement;
  inner: HTMLDivElement;
  overlay: HTMLDivElement;
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
  viewport.style.position = "absolute";
  viewport.style.inset = "0";

  const inner = document.createElement("div");
  inner.className = "vtt-canvas-inner";
  inner.style.position = "relative";

  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(12, 24px)";
  grid.style.gap = "4px";

  const overlay = document.createElement("div");
  overlay.style.position = "absolute";
  overlay.style.inset = "0";
  overlay.style.pointerEvents = "none";

  inner.appendChild(grid);
  inner.appendChild(overlay);
  viewport.appendChild(inner);

  root.appendChild(viewport);
  root.appendChild(header);

  return { root, position, grid, viewport, inner, overlay };
}
