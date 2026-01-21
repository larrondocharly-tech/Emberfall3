export type SurfaceType = "water" | "oil" | "fire";

export type Surface = {
  type: SurfaceType;
  durationTurns: number;
  intensity?: number;
};

export type SurfaceCell = { x: number; y: number; surface: Surface };

const keyFor = (x: number, y: number) => `${x},${y}`;

export function createSurfaceStore() {
  const surfaces = new Map<string, Surface>();

  const setSurface = (x: number, y: number, surface: Surface) => {
    surfaces.set(keyFor(x, y), surface);
  };

  const getSurface = (x: number, y: number) => surfaces.get(keyFor(x, y)) ?? null;

  const removeSurface = (x: number, y: number) => {
    surfaces.delete(keyFor(x, y));
  };

  const forEachSurface = (handler: (cell: SurfaceCell) => void) => {
    surfaces.forEach((surface, key) => {
      const [xStr, yStr] = key.split(",");
      handler({ x: Number(xStr), y: Number(yStr), surface });
    });
  };

  const tickSurfaces = () => {
    surfaces.forEach((surface, key) => {
      const nextDuration = surface.durationTurns - 1;
      if (nextDuration <= 0) {
        surfaces.delete(key);
      } else {
        surfaces.set(key, { ...surface, durationTurns: nextDuration });
      }
    });
  };

  return {
    setSurface,
    getSurface,
    removeSurface,
    forEachSurface,
    tickSurfaces
  };
}
