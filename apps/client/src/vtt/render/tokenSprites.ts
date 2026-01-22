import Phaser from "phaser";
import {
  animateAttack,
  animateCast,
  animateHit,
  animateMove,
  playExplosionFx,
  playFireBoltFx,
  playHealFx,
  playThunderFx,
  positionTokenView,
  type TokenAnimationEntry,
  type TokenAnimationView
} from "./tokenAnimations";
import { getTokenFallbackColor, resolveTokenTextureKey } from "./tokenAssetResolver";

type TokenRenderSchema = {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
};

type TokenSpriteEntry = TokenAnimationEntry & {
  lastX: number;
  lastY: number;
  targetX: number;
  targetY: number;
  isMoving: boolean;
};

type TokenRenderOptions = {
  selectedTokenId?: string | null;
  hoveredTokenId?: string | null;
  activeTokenId?: string | null;
};

const DEPTH_BASE = 1000;
const SPRITE_SCALE_RATIO = 0.85;

const createShadow = (scene: Phaser.Scene, tileSize: number) => {
  const shadow = scene.add.graphics();
  shadow.fillStyle(0x0b0f1a, 0.4);
  shadow.fillEllipse(0, 0, tileSize * 0.5, tileSize * 0.18);
  return shadow;
};

const createRing = (scene: Phaser.Scene, tileSize: number, color: number, lineWidth: number, alpha: number) => {
  const ring = scene.add.graphics();
  ring.lineStyle(lineWidth, color, alpha);
  ring.strokeEllipse(0, 0, tileSize * 0.7, tileSize * 0.28);
  return ring;
};

const createHoverOutline = (scene: Phaser.Scene, tileSize: number, color: number) => {
  const outline = scene.add.graphics();
  outline.lineStyle(2, color, 0.6);
  outline.strokeRoundedRect(-tileSize * 0.36, -tileSize * 0.5, tileSize * 0.72, tileSize * 0.85, 8);
  return outline;
};

const createHpBar = (scene: Phaser.Scene) => scene.add.graphics();

const updateHpBar = (bar: Phaser.GameObjects.Graphics, token: TokenRenderSchema) => {
  bar.clear();
  const width = 40;
  const height = 5;
  const ratio = token.maxHp > 0 ? token.hp / token.maxHp : 0;
  bar.fillStyle(0x0f172a, 0.7);
  bar.fillRoundedRect(-width / 2, 0, width, height, 2);
  bar.fillStyle(0x22c55e, 0.9);
  bar.fillRoundedRect(-width / 2, 0, width * Math.max(0, Math.min(1, ratio)), height, 2);
};

const createTokenView = (scene: Phaser.Scene, token: TokenRenderSchema, tileSize: number): TokenAnimationView => {
  const textureKey = resolveTokenTextureKey(scene, token.type);
  const sprite = scene.add.sprite(token.x, token.y, textureKey);
  sprite.setDisplaySize(tileSize * SPRITE_SCALE_RATIO, tileSize * SPRITE_SCALE_RATIO);
  sprite.setOrigin(0.5, 0.9);
  sprite.disableInteractive();

  const shadow = createShadow(scene, tileSize);
  const label = scene.add.text(token.x, token.y, "", {
    color: "#f8fafc",
    fontSize: "12px"
  });
  label.setOrigin(0.5, 1);

  const selectionRing = createRing(scene, tileSize, 0x38bdf8, 2, 0.8);
  const activeHalo = createRing(scene, tileSize, 0xfacc15, 3, 0.7);
  const hoverOutline = createHoverOutline(scene, tileSize, getTokenFallbackColor(token.type));
  const hpBar = createHpBar(scene);

  selectionRing.setVisible(false);
  activeHalo.setVisible(false);
  hoverOutline.setVisible(false);

  return {
    sprite,
    shadow,
    label,
    selectionRing,
    activeHalo,
    hoverOutline,
    hpBar
  };
};

const updateDepth = (view: TokenAnimationView, y: number) => {
  const depth = DEPTH_BASE + y;
  view.shadow.setDepth(depth - 2);
  view.selectionRing?.setDepth(depth - 1);
  view.activeHalo?.setDepth(depth - 1);
  view.sprite.setDepth(depth);
  view.hoverOutline?.setDepth(depth + 1);
  view.label.setDepth(depth + 2);
  view.hpBar?.setDepth(depth + 2);
};

const updateIndicators = (
  view: TokenAnimationView,
  token: TokenRenderSchema,
  options: TokenRenderOptions,
  isMoving: boolean
) => {
  const isSelected = options.selectedTokenId === token.id;
  const isActive = options.activeTokenId === token.id;
  const isHovered = options.hoveredTokenId === token.id;
  view.selectionRing?.setVisible(isSelected && !isMoving);
  view.activeHalo?.setVisible(isActive);
  view.hoverOutline?.setVisible(isHovered);
};

export class TokenSprites {
  private scene: Phaser.Scene;
  private tileSize: number;
  private fxLayer: Phaser.GameObjects.Container;
  private tokenSprites = new Map<string, TokenSpriteEntry>();

  constructor(scene: Phaser.Scene, tileSize: number) {
    this.scene = scene;
    this.tileSize = tileSize;
    this.fxLayer = scene.add.container(0, 0);
    this.fxLayer.setDepth(DEPTH_BASE + 2000);
  }

  render(tokens: Record<string, TokenRenderSchema>, options: TokenRenderOptions = {}) {
    Object.entries(tokens).forEach(([id, token]) => {
      let entry = this.tokenSprites.get(id);
      if (!entry) {
        const view = createTokenView(this.scene, token, this.tileSize);
        entry = {
          view,
          displayX: token.x,
          displayY: token.y,
          lastX: token.x,
          lastY: token.y,
          targetX: token.x,
          targetY: token.y,
          isMoving: false
        };
        this.tokenSprites.set(id, entry);
        positionTokenView(entry.view, token.x, token.y, this.tileSize);
        updateDepth(entry.view, token.y);
      }

      if (token.x !== entry.targetX || token.y !== entry.targetY) {
        const from = { x: entry.displayX, y: entry.displayY };
        const to = { x: token.x, y: token.y };
        const distance = Math.hypot(to.x - from.x, to.y - from.y);
        const duration = Math.max(180, Math.min(420, (distance / this.tileSize) * 200 + 140));
        entry.isMoving = true;
        animateMove(this.scene, entry, from, to, duration, this.tileSize);
        entry.targetX = token.x;
        entry.targetY = token.y;
        this.scene.time.delayedCall(duration, () => {
          entry.isMoving = false;
        });
      } else if (!entry.isMoving) {
        entry.displayX = token.x;
        entry.displayY = token.y;
        positionTokenView(entry.view, token.x, token.y, this.tileSize);
      }

      updateDepth(entry.view, entry.displayY);
      updateIndicators(entry.view, token, options, entry.isMoving);

      entry.view.label.setText(`${token.name} ${token.hp}/${token.maxHp}`);
      if (entry.view.hpBar) {
        updateHpBar(entry.view.hpBar, token);
      }

      entry.lastX = token.x;
      entry.lastY = token.y;
    });

    Array.from(this.tokenSprites.keys()).forEach((id) => {
      if (!tokens[id]) {
        const entry = this.tokenSprites.get(id);
        if (entry) {
          entry.view.sprite.destroy();
          entry.view.shadow.destroy();
          entry.view.label.destroy();
          entry.view.hpBar?.destroy();
          entry.view.selectionRing?.destroy();
          entry.view.activeHalo?.destroy();
          entry.view.hoverOutline?.destroy();
          entry.castCircle?.destroy();
        }
        this.tokenSprites.delete(id);
      }
    });
  }

  animateAttack(tokenId: string, target: { x: number; y: number }) {
    const entry = this.tokenSprites.get(tokenId);
    if (!entry) {
      return;
    }
    animateAttack(this.scene, entry, target, this.tileSize, this.fxLayer);
  }

  animateCast(tokenId: string) {
    const entry = this.tokenSprites.get(tokenId);
    if (!entry) {
      return;
    }
    animateCast(this.scene, entry);
  }

  animateHit(tokenId: string) {
    const entry = this.tokenSprites.get(tokenId);
    if (!entry) {
      return;
    }
    animateHit(this.scene, entry);
  }

  playFireBolt(from: { x: number; y: number }, to: { x: number; y: number }) {
    playFireBoltFx(this.scene, this.fxLayer, from, to);
  }

  playThunder(at: { x: number; y: number }) {
    playThunderFx(this.scene, this.fxLayer, at, this.tileSize * 0.35);
  }

  playHeal(at: { x: number; y: number }) {
    playHealFx(this.scene, this.fxLayer, at);
  }

  playExplosion(at: { x: number; y: number }) {
    playExplosionFx(this.scene, this.fxLayer, at);
  }
}
