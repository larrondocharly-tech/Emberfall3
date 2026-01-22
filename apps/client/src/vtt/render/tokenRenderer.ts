import Phaser from "phaser";
import {
  applyFacing,
  playAttack,
  playCast,
  playHit,
  resolveFacingFromDelta,
  setIdle,
  setWalk,
  type TokenAnimEntry,
  type TokenAnimState,
  type TokenFacing
} from "../animations/tokenAnims";
import { ensureTokenTexture, getTokenFallbackColor } from "./tokenAssets";
import type { TokenView } from "./tokenViewTypes";

type TokenRenderSchema = {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
};

type TokenSpriteEntry = TokenAnimEntry & {
  lastX: number;
  lastY: number;
  isHovered: boolean;
};

type TokenRenderOptions = {
  selectedTokenId?: string | null;
  hoveredTokenId?: string | null;
  activeTokenId?: string | null;
};

const TOKEN_DISPLAY_WIDTH = 44;
const TOKEN_DISPLAY_HEIGHT = 54;
const LABEL_OFFSET_Y = 36;
const DEPTH_BASE = 1000;

const createShadow = (scene: Phaser.Scene) => {
  const shadow = scene.add.graphics();
  shadow.fillStyle(0x0b0f1a, 0.4);
  shadow.fillEllipse(0, 0, 30, 12);
  shadow.setVisible(true);
  return shadow;
};

const createRing = (scene: Phaser.Scene, color: number, lineWidth: number, alpha: number) => {
  const ring = scene.add.graphics();
  ring.lineStyle(lineWidth, color, alpha);
  ring.strokeEllipse(0, 0, 34, 16);
  return ring;
};

const createHoverOutline = (scene: Phaser.Scene, color: number) => {
  const outline = scene.add.graphics();
  outline.lineStyle(2, color, 0.6);
  outline.strokeRoundedRect(-TOKEN_DISPLAY_WIDTH / 2, -TOKEN_DISPLAY_HEIGHT / 2, TOKEN_DISPLAY_WIDTH, TOKEN_DISPLAY_HEIGHT, 8);
  return outline;
};

const createHpBar = (scene: Phaser.Scene) => {
  const bar = scene.add.graphics();
  return bar;
};

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

const createTokenView = (scene: Phaser.Scene, token: TokenRenderSchema) => {
  const textureKey = ensureTokenTexture(scene, token.type);
  const sprite = scene.add.sprite(token.x, token.y, textureKey);
  sprite.setDisplaySize(TOKEN_DISPLAY_WIDTH, TOKEN_DISPLAY_HEIGHT);
  sprite.setOrigin(0.5, 0.8);
  sprite.setInteractive({ useHandCursor: true });

  const shadow = createShadow(scene);
  const label = scene.add.text(token.x, token.y - LABEL_OFFSET_Y, "", {
    color: "#f8fafc",
    fontSize: "12px"
  });
  label.setOrigin(0.5, 1);

  const selectionRing = createRing(scene, 0x38bdf8, 2, 0.8);
  const activeHalo = createRing(scene, 0xfacc15, 3, 0.7);
  const hoverOutline = createHoverOutline(scene, getTokenFallbackColor(token.type));
  const hpBar = createHpBar(scene);

  selectionRing.setVisible(false);
  activeHalo.setVisible(false);
  hoverOutline.setVisible(false);

  const view: TokenView = {
    sprite,
    shadow,
    label,
    selectionRing,
    activeHalo,
    hoverOutline,
    hpBar
  };

  return view;
};

const updateViewPosition = (view: TokenView, token: TokenRenderSchema) => {
  view.sprite.setPosition(token.x, token.y);
  view.shadow.setPosition(token.x, token.y + 12);
  view.label.setPosition(token.x, token.y - LABEL_OFFSET_Y);
  view.selectionRing?.setPosition(token.x, token.y + 14);
  view.activeHalo?.setPosition(token.x, token.y + 14);
  view.hoverOutline?.setPosition(token.x, token.y - 10);
  view.hpBar?.setPosition(token.x, token.y - LABEL_OFFSET_Y + 6);
};

const updateViewDepth = (view: TokenView, token: TokenRenderSchema) => {
  const depth = DEPTH_BASE + token.y;
  view.shadow.setDepth(depth - 2);
  view.selectionRing?.setDepth(depth - 1);
  view.activeHalo?.setDepth(depth - 1);
  view.sprite.setDepth(depth);
  view.hoverOutline?.setDepth(depth + 1);
  view.label.setDepth(depth + 2);
  view.hpBar?.setDepth(depth + 2);
};

const updateIndicators = (
  entry: TokenSpriteEntry,
  token: TokenRenderSchema,
  options: TokenRenderOptions
) => {
  const isSelected = options.selectedTokenId === token.id;
  const isActive = options.activeTokenId === token.id;
  const isHovered = entry.isHovered || options.hoveredTokenId === token.id;

  entry.view.selectionRing?.setVisible(isSelected);
  entry.view.activeHalo?.setVisible(isActive);
  entry.view.hoverOutline?.setVisible(isHovered);
};

export class TokenRenderer {
  private scene: Phaser.Scene;
  private tokenSprites = new Map<string, TokenSpriteEntry>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  render(tokens: Record<string, TokenRenderSchema>, options: TokenRenderOptions = {}) {
    Object.entries(tokens).forEach(([id, token]) => {
      let entry = this.tokenSprites.get(id);
      if (!entry) {
        const view = createTokenView(this.scene, token);
        entry = {
          view,
          facing: "S",
          animState: "idle",
          lastX: token.x,
          lastY: token.y,
          isHovered: false
        };
        this.tokenSprites.set(id, entry);
        view.sprite.on("pointerover", () => {
          entry?.view.hoverOutline?.setVisible(true);
          if (entry) {
            entry.isHovered = true;
          }
        });
        view.sprite.on("pointerout", () => {
          entry?.view.hoverOutline?.setVisible(false);
          if (entry) {
            entry.isHovered = false;
          }
        });
        setIdle(entry);
      }

      updateViewPosition(entry.view, token);
      updateViewDepth(entry.view, token);
      updateIndicators(entry, token, options);

      entry.view.label.setText(`${token.name} ${token.hp}/${token.maxHp}`);
      if (entry.view.hpBar) {
        updateHpBar(entry.view.hpBar, token);
      }

      const dx = token.x - entry.lastX;
      const dy = token.y - entry.lastY;
      if (dx !== 0 || dy !== 0) {
        entry.facing = resolveFacingFromDelta(dx, dy);
        applyFacing(entry);
        if (entry.animState === "idle" || entry.animState === "walk") {
          this.setAnimState(id, "walk");
        }
      } else if (entry.animState === "walk") {
        this.setAnimState(id, "idle");
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

  setAnimState(tokenId: string, state: TokenAnimState) {
    const entry = this.tokenSprites.get(tokenId);
    if (!entry || entry.animState === state) {
      return;
    }
    entry.animState = state;
    if (state === "idle") {
      setIdle(entry);
      return;
    }
    if (state === "walk") {
      setWalk(this.scene, entry);
      return;
    }
    if (state === "attack") {
      playAttack(this.scene, entry, () => this.setAnimState(tokenId, "idle"));
      return;
    }
    if (state === "cast") {
      playCast(this.scene, entry, () => this.setAnimState(tokenId, "idle"));
      return;
    }
    if (state === "hit") {
      playHit(this.scene, entry, () => this.setAnimState(tokenId, "idle"));
    }
  }

  setFacing(tokenId: string, facing: TokenFacing) {
    const entry = this.tokenSprites.get(tokenId);
    if (!entry) {
      return;
    }
    entry.facing = facing;
    applyFacing(entry);
  }
}
