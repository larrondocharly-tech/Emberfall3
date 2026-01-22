export type GridPoint = { x: number; y: number };
export type GridMetrics = { step: number; offsetX: number; offsetY: number };

const createCell = (point: GridPoint, metrics: GridMetrics, className: string, inset = 2) => {
  const cell = document.createElement("div");
  cell.className = className;
  cell.style.left = `${point.x * metrics.step + metrics.offsetX + inset}px`;
  cell.style.top = `${point.y * metrics.step + metrics.offsetY + inset}px`;
  cell.style.width = `${metrics.step - inset * 2}px`;
  cell.style.height = `${metrics.step - inset * 2}px`;
  return cell;
};

export const clearOverlay = (layer: HTMLDivElement) => {
  layer.innerHTML = "";
};

export const renderOverlayCells = (
  layer: HTMLDivElement,
  cells: GridPoint[],
  metrics: GridMetrics,
  className: string,
  inset = 2
) => {
  cells.forEach((point) => {
    layer.appendChild(createCell(point, metrics, className, inset));
  });
};
