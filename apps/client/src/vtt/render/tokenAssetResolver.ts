import Phaser from "phaser";

const TOKEN_TEXTURE_SIZE = 64;

const tokenAssetMap = {
  player: {
    baseName: "hero",
    color: 0x38bdf8
  },
  monster: {
    baseName: "monster",
    color: 0xef4444
  },
  npc: {
    baseName: "npc",
    color: 0x22c55e
  }
};

type TokenAssetInfo = {
  baseName: string;
  color: number;
};

const resolveTokenAsset = (tokenType: string): TokenAssetInfo =>
  tokenAssetMap[tokenType as keyof typeof tokenAssetMap] ?? tokenAssetMap.npc;

const buildTokenUrl = (baseName: string, suffix: "png" | "png.jpg") =>
  `assets/tokens/${baseName}.${suffix}`;

const buildTextureKey = (baseName: string, variant: "png" | "png.jpg") =>
  variant === "png" ? baseName : `${baseName}-jpg`;

export const preloadTokenAssets = (scene: Phaser.Scene) => {
  Object.values(tokenAssetMap).forEach((asset) => {
    const pngKey = buildTextureKey(asset.baseName, "png");
    const jpgKey = buildTextureKey(asset.baseName, "png.jpg");
    if (!scene.textures.exists(pngKey)) {
      scene.load.image(pngKey, buildTokenUrl(asset.baseName, "png"));
    }
    if (!scene.textures.exists(jpgKey)) {
      scene.load.image(jpgKey, buildTokenUrl(asset.baseName, "png.jpg"));
    }
  });
};

const ensurePlaceholderTexture = (scene: Phaser.Scene, key: string, color: number) => {
  if (scene.textures.exists(key)) {
    return;
  }
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x0f172a, 0.9);
  graphics.fillRoundedRect(4, 4, TOKEN_TEXTURE_SIZE - 8, TOKEN_TEXTURE_SIZE - 8, 12);
  graphics.lineStyle(2, color, 1);
  graphics.strokeRoundedRect(4, 4, TOKEN_TEXTURE_SIZE - 8, TOKEN_TEXTURE_SIZE - 8, 12);
  graphics.fillStyle(color, 0.9);
  graphics.fillTriangle(16, 48, TOKEN_TEXTURE_SIZE / 2, 14, TOKEN_TEXTURE_SIZE - 16, 48);
  graphics.generateTexture(key, TOKEN_TEXTURE_SIZE, TOKEN_TEXTURE_SIZE);
  graphics.destroy();
};

export const resolveTokenTextureKey = (scene: Phaser.Scene, tokenType: string) => {
  const asset = resolveTokenAsset(tokenType);
  const pngKey = buildTextureKey(asset.baseName, "png");
  const jpgKey = buildTextureKey(asset.baseName, "png.jpg");
  if (scene.textures.exists(pngKey)) {
    return pngKey;
  }
  if (scene.textures.exists(jpgKey)) {
    return jpgKey;
  }
  ensurePlaceholderTexture(scene, pngKey, asset.color);
  return pngKey;
};

export const getTokenFallbackColor = (tokenType: string) => resolveTokenAsset(tokenType).color;
