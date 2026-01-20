export type BottomControlsElements = {
  root: HTMLDivElement;
  zoomIn: HTMLButtonElement;
  zoomOut: HTMLButtonElement;
  reset: HTMLButtonElement;
  toggleGrid: HTMLButtonElement;
};

export function createBottomControls(): BottomControlsElements {
  const root = document.createElement("div");
  root.className = "vtt-bottom-controls";

  const zoomOut = document.createElement("button");
  zoomOut.type = "button";
  zoomOut.textContent = "-";

  const zoomIn = document.createElement("button");
  zoomIn.type = "button";
  zoomIn.textContent = "+";

  const reset = document.createElement("button");
  reset.type = "button";
  reset.textContent = "Reset";

  const toggleGrid = document.createElement("button");
  toggleGrid.type = "button";
  toggleGrid.textContent = "Grille";

  root.appendChild(zoomOut);
  root.appendChild(zoomIn);
  root.appendChild(reset);
  root.appendChild(toggleGrid);

  return {
    root,
    zoomIn,
    zoomOut,
    reset,
    toggleGrid
  };
}
