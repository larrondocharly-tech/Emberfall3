export type Scene = {
  id: string;
  name: string;
  mapUrl: string;
  gridSize: number;
  gridOffsetX: number;
  gridOffsetY: number;
  pixelsPerGrid: number;
  initialZoom: number;
  initialPanX: number;
  initialPanY: number;
};

export const scenes: Scene[] = [
  {
    id: "tavern",
    name: "Taverne",
    mapUrl: "/data/maps/tavern_01.webp",
    gridSize: 12,
    gridOffsetX: 0,
    gridOffsetY: 0,
    pixelsPerGrid: 100,
    initialZoom: 1,
    initialPanX: 0,
    initialPanY: 0
  },
  {
    id: "tavern_upstairs",
    name: "Taverne · Étage",
    mapUrl: "/data/maps/tavern_01.webp",
    gridSize: 12,
    gridOffsetX: 0,
    gridOffsetY: 0,
    pixelsPerGrid: 100,
    initialZoom: 1,
    initialPanX: 0,
    initialPanY: 0
  },
  {
    id: "town",
    name: "Ville",
    mapUrl: "/data/maps/town_01.webp",
    gridSize: 14,
    gridOffsetX: 0,
    gridOffsetY: 0,
    pixelsPerGrid: 100,
    initialZoom: 0.9,
    initialPanX: 0,
    initialPanY: 0
  },
  {
    id: "frontier",
    name: "Frontière d’Ember",
    mapUrl: "/assets/maps/frontier.png",
    gridSize: 20,
    gridOffsetX: 0,
    gridOffsetY: 0,
    pixelsPerGrid: 64,
    initialZoom: 0.9,
    initialPanX: 0,
    initialPanY: 0
  }
];

export const defaultSceneId = "tavern";

export function getSceneById(id: string) {
  return scenes.find((scene) => scene.id === id) ?? scenes[0];
}
