import Phaser from "phaser";

const TOKEN_TEXTURE_SIZE = 64;

const tokenAssets = {
  player: {
    key: "hero",
    file: "hero.png",
    color: 0x38bdf8
  },
  monster: {
    key: "monster",
    file: "monster.png",
    color: 0xef4444
  },
  npc: {
    key: "npc",
    file: "npc.png",
    color: 0x22c55e
  }
};

const resolveTokenAsset = (tokenType: string) =>
  tokenAssets[tokenType as keyof typeof tokenAssets] ?? tokenAssets.npc;

export const loadTokenAssets = (scene: Phaser.Scene) => {
  Object.values(tokenAssets).forEach((asset) => {
    if (!scene.textures.exists(asset.key)) {
      scene.load.image(asset.key, `assets/tokens/${asset.file}`);
    }
  });
};

const createPlaceholderTexture = (scene: Phaser.Scene, key: string, color: number) => {
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x0f172a, 0.9);
  graphics.fillRoundedRect(4, 4, TOKEN_TEXTURE_SIZE - 8, TOKEN_TEXTURE_SIZE - 8, 10);
  graphics.lineStyle(2, color, 1);
  graphics.strokeRoundedRect(4, 4, TOKEN_TEXTURE_SIZE - 8, TOKEN_TEXTURE_SIZE - 8, 10);
  graphics.fillStyle(color, 0.9);
  graphics.fillTriangle(20, 46, TOKEN_TEXTURE_SIZE / 2, 18, TOKEN_TEXTURE_SIZE - 20, 46);
  graphics.generateTexture(key, TOKEN_TEXTURE_SIZE, TOKEN_TEXTURE_SIZE);
  graphics.destroy();
};

export const ensureTokenTexture = (scene: Phaser.Scene, tokenType: string) => {
  const asset = resolveTokenAsset(tokenType);
  if (!scene.textures.exists(asset.key)) {
    createPlaceholderTexture(scene, asset.key, asset.color);
  }
  return asset.key;
};

export const getTokenFallbackColor = (tokenType: string) => resolveTokenAsset(tokenType).color;
