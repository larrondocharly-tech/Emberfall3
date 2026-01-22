import {
  animateMove,
  createFxLayer,
  ensureIdleBreath,
  playAOEFX,
  playHealFX,
  playMeleeAttackFX,
  playProjectileFX,
  type AnimationHandle,
  type GridMetrics,
  type TokenElementEntry
} from "./tokenAnimations";
import { getTokenAccentColor, getTokenPlaceholderUrl, resolveTokenUrl } from "./tokenAssetResolver";

type TokenRenderSchema = {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
};

type TokenRenderFlags = {
  selected: boolean;
  ko: boolean;
  targetable: boolean;
  outOfRange: boolean;
  hovered: boolean;
  activeTurn: boolean;
  locked: boolean;
  showLabel: boolean;
};

type TokenSpriteEntry = TokenElementEntry & {
  label: HTMLDivElement;
  hpFill?: HTMLSpanElement;
  ring: HTMLDivElement;
  hover: HTMLDivElement;
  animations: AnimationHandle;
  lastCell: { x: number; y: number };
  facing: number;
};

const SPRITE_SCALE_RATIO = 0.85;

export class TokenSpriteRenderer {
  private container: HTMLDivElement;
  private fxLayer: HTMLDivElement;
  private tokens = new Map<string, TokenSpriteEntry>();

  constructor(container: HTMLDivElement, overlayLayer: HTMLDivElement) {
    this.container = container;
    this.fxLayer = createFxLayer(overlayLayer);
  }

  renderToken(token: TokenRenderSchema, flags: TokenRenderFlags, metrics: GridMetrics) {
    let entry = this.tokens.get(token.id);
    if (!entry) {
      const root = document.createElement("div");
      root.className = "vtt-token";
      root.dataset.tokenId = token.id;

      const shadow = document.createElement("div");
      shadow.className = "vtt-token-shadow";

      const ring = document.createElement("div");
      ring.className = "vtt-token-ring";

      const hover = document.createElement("div");
      hover.className = "vtt-token-hover";
      hover.style.borderColor = getTokenAccentColor(token.type);

      const sprite = document.createElement("img");
      sprite.className = "vtt-token-sprite";
      sprite.alt = token.name;
      sprite.src = getTokenPlaceholderUrl(token.type);
      sprite.draggable = false;

      const label = document.createElement("div");
      label.className = "vtt-token-label";

      root.appendChild(shadow);
      root.appendChild(ring);
      root.appendChild(hover);
      root.appendChild(sprite);
      root.appendChild(label);

      this.container.appendChild(root);

      entry = {
        root,
        sprite,
        shadow,
        label,
        ring,
        hover,
        animations: {},
        lastCell: { x: token.x, y: token.y },
        facing: 1
      };
      this.tokens.set(token.id, entry);

      resolveTokenUrl(token.type).then((url) => {
        sprite.src = url;
      });
    }

    const size = metrics.step;
    entry.root.style.width = `${size}px`;
    entry.root.style.height = `${size}px`;
    entry.root.style.left = `${token.x * metrics.step + metrics.offsetX}px`;
    entry.root.style.top = `${token.y * metrics.step + metrics.offsetY}px`;
    entry.root.style.setProperty("--token-size", `${size}px`);
    entry.root.style.zIndex = String(1000 + token.y);
    entry.root.dataset.gridX = String(token.x);
    entry.root.dataset.gridY = String(token.y);
    entry.sprite.style.width = `${SPRITE_SCALE_RATIO * 100}%`;
    entry.sprite.style.height = `${SPRITE_SCALE_RATIO * 100}%`;
    entry.sprite.style.setProperty("--sprite-flip", `${entry.facing}`);

    entry.root.classList.toggle("selected", flags.selected);
    entry.root.classList.toggle("ko", flags.ko);
    entry.root.classList.toggle("vtt-token-target", flags.targetable);
    entry.root.classList.toggle("out-of-range", flags.outOfRange);
    entry.root.classList.toggle("hovered", flags.hovered);
    entry.root.classList.toggle("active-turn", flags.activeTurn);
    entry.root.classList.toggle("locked", flags.locked);

    entry.label.textContent = flags.showLabel
      ? flags.ko
        ? "KO"
        : `${token.name} ${token.hp}/${token.maxHp}`
      : "";
    if (flags.showLabel) {
      const hpBar = entry.label.querySelector<HTMLDivElement>(".vtt-token-hp");
      if (!hpBar) {
        const bar = document.createElement("div");
        bar.className = "vtt-token-hp";
        const fill = document.createElement("span");
        bar.appendChild(fill);
        entry.label.appendChild(bar);
        entry.hpFill = fill;
      }
    }
    if (entry.hpFill) {
      const ratio = token.maxHp > 0 ? token.hp / token.maxHp : 0;
      entry.hpFill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
    }

    if (token.x !== entry.lastCell.x || token.y !== entry.lastCell.y) {
      const dx = token.x - entry.lastCell.x;
      if (dx !== 0) {
        entry.facing = dx > 0 ? 1 : -1;
        entry.sprite.style.setProperty("--sprite-flip", `${entry.facing}`);
      }
      const duration = 260;
      animateMove(entry, entry.lastCell, { x: token.x, y: token.y }, metrics, duration, entry.animations);
      entry.lastCell = { x: token.x, y: token.y };
    } else {
      if (!entry.animations.movement || entry.animations.movement.playState !== "running") {
        ensureIdleBreath(entry, entry.animations);
      }
    }
  }

  cleanup(tokenIds: Set<string>) {
    Array.from(this.tokens.keys()).forEach((id) => {
      if (!tokenIds.has(id)) {
        const entry = this.tokens.get(id);
        if (entry) {
          entry.root.remove();
        }
        this.tokens.delete(id);
      }
    });
  }

  playMeleeAttackFX(attackerId: string, targetCell: { x: number; y: number }, metrics: GridMetrics) {
    const entry = this.tokens.get(attackerId);
    if (!entry) {
      return;
    }
    playMeleeAttackFX(entry, targetCell, metrics, this.fxLayer);
  }

  playProjectileFX(attackerCell: { x: number; y: number }, targetCell: { x: number; y: number }, metrics: GridMetrics) {
    playProjectileFX(attackerCell, targetCell, metrics, this.fxLayer);
  }

  playAOEFX(cells: Array<{ x: number; y: number }>, metrics: GridMetrics) {
    playAOEFX(cells, metrics, this.fxLayer);
  }

  playHealFX(targetId: string, metrics: GridMetrics) {
    const entry = this.tokens.get(targetId);
    if (!entry) {
      return;
    }
    const cell = {
      x: Number(entry.root.dataset.gridX),
      y: Number(entry.root.dataset.gridY)
    };
    playHealFX(cell, metrics, this.fxLayer);
  }
}
