import Phaser from "phaser";

export type TokenFacing = "N" | "E" | "S" | "W";
export type TokenAnimState = "idle" | "walk" | "attack" | "cast" | "hit";

export type TokenAnimEntry = {
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  facing: TokenFacing;
  animState: TokenAnimState;
  walkTween?: Phaser.Tweens.Tween;
  stateTween?: Phaser.Tweens.Tween;
  castCircle?: Phaser.GameObjects.Arc;
};

const WALK_SCALE = 1.06;
const WALK_DURATION = 320;
const ATTACK_SCALE = 1.15;
const CAST_COLOR = 0xfacc15;
const HIT_COLOR = 0xef4444;

const stopTween = (tween?: Phaser.Tweens.Tween) => {
  if (!tween) {
    return;
  }
  if (tween.isPlaying()) {
    tween.stop();
  }
  tween.remove();
};

export const resolveFacingFromDelta = (dx: number, dy: number): TokenFacing => {
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "E" : "W";
  }
  return dy >= 0 ? "S" : "N";
};

export const applyFacing = (entry: TokenAnimEntry) => {
  entry.sprite.setFlipX(entry.facing === "W");
};

export const setIdle = (entry: TokenAnimEntry) => {
  stopTween(entry.walkTween);
  entry.walkTween = undefined;
  entry.sprite.setScale(1);
  entry.sprite.setAlpha(1);
  entry.sprite.clearTint();
};

export const setWalk = (scene: Phaser.Scene, entry: TokenAnimEntry) => {
  if (entry.walkTween && entry.walkTween.isPlaying()) {
    return;
  }
  stopTween(entry.walkTween);
  entry.walkTween = scene.tweens.add({
    targets: entry.sprite,
    scale: WALK_SCALE,
    duration: WALK_DURATION,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut"
  });
};

export const playAttack = (scene: Phaser.Scene, entry: TokenAnimEntry, onComplete: () => void) => {
  stopTween(entry.stateTween);
  entry.sprite.setScale(1);
  entry.stateTween = scene.tweens.add({
    targets: entry.sprite,
    scale: ATTACK_SCALE,
    duration: 140,
    yoyo: true,
    ease: "Quad.easeOut",
    onComplete
  });
};

export const playCast = (scene: Phaser.Scene, entry: TokenAnimEntry, onComplete: () => void) => {
  stopTween(entry.stateTween);
  entry.sprite.setTint(CAST_COLOR);
  const circle = scene.add.circle(entry.sprite.x, entry.sprite.y + 8, 18, CAST_COLOR, 0.3);
  circle.setDepth(entry.sprite.depth - 1);
  entry.castCircle = circle;
  entry.stateTween = scene.tweens.add({
    targets: [entry.sprite, circle],
    scale: { from: 1, to: 1.1 },
    alpha: { from: 0.9, to: 0.2 },
    duration: 360,
    yoyo: true,
    ease: "Sine.easeInOut",
    onComplete: () => {
      circle.destroy();
      entry.castCircle = undefined;
      entry.sprite.clearTint();
      onComplete();
    }
  });
};

export const playHit = (scene: Phaser.Scene, entry: TokenAnimEntry, onComplete: () => void) => {
  stopTween(entry.stateTween);
  entry.sprite.setTint(HIT_COLOR);
  entry.stateTween = scene.tweens.add({
    targets: entry.sprite,
    alpha: { from: 1, to: 0.4 },
    duration: 120,
    yoyo: true,
    repeat: 1,
    onComplete: () => {
      entry.sprite.clearTint();
      entry.sprite.setAlpha(1);
      onComplete();
    }
  });
};
