export type CanvasViewElements = {
  root: HTMLDivElement;
  position: HTMLDivElement;
  viewport: HTMLDivElement;
  world: HTMLDivElement;
  mapLayer: HTMLDivElement;
  gridLayer: HTMLDivElement;
  tokenLayer: HTMLDivElement;
  overlayLayer: HTMLDivElement;
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

  const world = document.createElement("div");
  world.className = "vtt-canvas-world";
  world.style.position = "absolute";
  world.style.left = "0";
  world.style.top = "0";
  world.style.transformOrigin = "0 0";

  const mapLayer = document.createElement("div");
  mapLayer.className = "vtt-layer vtt-layer-map";

  const mapImage = document.createElement("img");
  mapImage.src = "/maps/tavern_01.jpg";
  mapImage.alt = "Taverne";
  mapImage.draggable = false;
  mapLayer.appendChild(mapImage);

  const gridLayer = document.createElement("div");
  gridLayer.className = "vtt-layer vtt-layer-grid";
  gridLayer.dataset.grid = "true";

  const tokenLayer = document.createElement("div");
  tokenLayer.className = "vtt-layer vtt-layer-tokens";

  const overlayLayer = document.createElement("div");
  overlayLayer.className = "vtt-layer vtt-layer-overlay";

  world.appendChild(mapLayer);
  world.appendChild(gridLayer);
  world.appendChild(tokenLayer);
  world.appendChild(overlayLayer);
  viewport.appendChild(world);

  root.appendChild(viewport);
  root.appendChild(header);

  return {
    root,
    position,
    viewport,
    world,
    mapLayer,
    gridLayer,
    tokenLayer,
    overlayLayer
  };
}
