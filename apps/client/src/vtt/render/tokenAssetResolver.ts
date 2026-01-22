type TokenAssetInfo = {
  baseName: string;
  color: string;
};

const tokenAssetMap: Record<string, TokenAssetInfo> = {
  player: {
    baseName: "hero",
    color: "#38bdf8"
  },
  monster: {
    baseName: "monster",
    color: "#ef4444"
  },
  npc: {
    baseName: "npc",
    color: "#22c55e"
  }
};

const resolveTokenAsset = (tokenType: string): TokenAssetInfo =>
  tokenAssetMap[tokenType] ?? tokenAssetMap.npc;

const resolvedUrlCache = new Map<string, string>();
const resolvingCache = new Map<string, Promise<string>>();

const buildTokenUrl = (baseName: string, suffix: "png" | "png.jpg") =>
  `/assets/tokens/${baseName}.${suffix}`;

const loadImage = (url: string) =>
  new Promise<boolean>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });

const createPlaceholderDataUrl = (color: string) => {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) {
    return "";
  }
  context.fillStyle = "#0f172a";
  context.fillRect(0, 0, 64, 64);
  context.strokeStyle = color;
  context.lineWidth = 3;
  context.strokeRect(6, 6, 52, 52);
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(16, 48);
  context.lineTo(32, 14);
  context.lineTo(48, 48);
  context.closePath();
  context.fill();
  return canvas.toDataURL("image/png");
};

export const resolveTokenUrl = (tokenType: string) => {
  if (resolvedUrlCache.has(tokenType)) {
    return Promise.resolve(resolvedUrlCache.get(tokenType) as string);
  }
  if (resolvingCache.has(tokenType)) {
    return resolvingCache.get(tokenType) as Promise<string>;
  }
  const asset = resolveTokenAsset(tokenType);
  const promise = (async () => {
    const pngUrl = buildTokenUrl(asset.baseName, "png");
    const pngExists = await loadImage(pngUrl);
    if (pngExists) {
      resolvedUrlCache.set(tokenType, pngUrl);
      return pngUrl;
    }
    const jpgUrl = buildTokenUrl(asset.baseName, "png.jpg");
    const jpgExists = await loadImage(jpgUrl);
    if (jpgExists) {
      resolvedUrlCache.set(tokenType, jpgUrl);
      return jpgUrl;
    }
    const placeholder = createPlaceholderDataUrl(asset.color);
    resolvedUrlCache.set(tokenType, placeholder);
    return placeholder;
  })();
  resolvingCache.set(tokenType, promise);
  return promise;
};

export const getTokenPlaceholderUrl = (tokenType: string) =>
  createPlaceholderDataUrl(resolveTokenAsset(tokenType).color);

export const getTokenAccentColor = (tokenType: string) => resolveTokenAsset(tokenType).color;
