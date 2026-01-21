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
  spriteKey: string;
};

const TOKEN_TEXTURE_SIZE = 48;
const TOKEN_DISPLAY_SIZE = 44;

const tokenSpriteOverrides: Record<string, string> = {};
const tokenSpriteMap: Record<string, string> = {
  player: "token-player",
  monster: "token-monster",
  npc: "token-npc",
  default: "token-generic"
};

const tokenColors: Record<string, number> = {
  player: 0x38bdf8,
  monster: 0xef4444,
  npc: 0x22c55e,
  default: 0xa855f7
};

const getSpriteKey = (token: TokenRenderSchema) =>
  tokenSpriteOverrides[token.id] ?? tokenSpriteMap[token.type] ?? tokenSpriteMap.default;

const ensurePlaceholderTexture = (scene: Phaser.Scene, key: string, color: number) => {
  if (scene.textures.exists(key)) {
    return;
  }
  const graphics = scene.add.graphics();
  graphics.fillStyle(color, 1);
  graphics.fillCircle(TOKEN_TEXTURE_SIZE / 2, TOKEN_TEXTURE_SIZE / 2, TOKEN_TEXTURE_SIZE / 2 - 4);
  graphics.lineStyle(2, 0x0f172a, 0.9);
  graphics.strokeCircle(TOKEN_TEXTURE_SIZE / 2, TOKEN_TEXTURE_SIZE / 2, TOKEN_TEXTURE_SIZE / 2 - 4);
  graphics.generateTexture(key, TOKEN_TEXTURE_SIZE, TOKEN_TEXTURE_SIZE);
  graphics.destroy();
};

export class TokenRenderer {
  private scene: Phaser.Scene;
  private tokenSprites = new Map<string, TokenSpriteEntry>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  render(tokens: Record<string, TokenRenderSchema>) {
    Object.entries(tokens).forEach(([id, token]) => {
      let entry = this.tokenSprites.get(id);
      const spriteKey = getSpriteKey(token);
      const color = tokenColors[token.type] ?? tokenColors.default;
      ensurePlaceholderTexture(this.scene, spriteKey, color);

      if (!entry) {
        const sprite = this.scene.add.sprite(token.x, token.y, spriteKey);
        sprite.setDisplaySize(TOKEN_DISPLAY_SIZE, TOKEN_DISPLAY_SIZE);
        sprite.setOrigin(0.5, 0.5);
        const label = this.scene.add.text(token.x, token.y - 30, "", {
          color: "#f8fafc",
          fontSize: "12px"
        });
        label.setOrigin(0.5, 1);
        entry = {
          sprite,
          label,
          facing: "S",
          animState: "idle",
          lastX: token.x,
          lastY: token.y,
          spriteKey
        };
        this.tokenSprites.set(id, entry);
        setIdle(entry);
      }

      entry.sprite.setPosition(token.x, token.y);
      entry.label.setText(`${token.name} ${token.hp}/${token.maxHp}`);
      entry.label.setPosition(token.x, token.y - 30);
      entry.sprite.setDepth(token.y);
      entry.label.setDepth(token.y + 1);

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
          entry.sprite.destroy();
          entry.label.destroy();
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
