import Phaser from "phaser";
import type { TokenAnimEntry, TokenAnimState, TokenFacing } from "../render/tokenViewTypes";

export type { TokenAnimEntry, TokenAnimState, TokenFacing } from "../render/tokenViewTypes";

const WALK_SCALE_Y = 1.05;
const WALK_SCALE_X = 0.98;
const WALK_DURATION = 320;
const ATTACK_SCALE = 1.12;
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
  entry.view.sprite.setFlipX(entry.facing === "W");
};

export const setIdle = (entry: TokenAnimEntry) => {
  stopTween(entry.walkTween);
  entry.walkTween = undefined;
  entry.view.sprite.setScale(1, 1);
  entry.view.sprite.setAlpha(1);
  entry.view.sprite.clearTint();
};

export const setWalk = (scene: Phaser.Scene, entry: TokenAnimEntry) => {
  if (entry.walkTween && entry.walkTween.isPlaying()) {
    return;
  }
  stopTween(entry.walkTween);
  entry.walkTween = scene.tweens.add({
    targets: entry.view.sprite,
    scaleX: WALK_SCALE_X,
    scaleY: WALK_SCALE_Y,
    duration: WALK_DURATION,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut"
  });
};

export const playAttack = (scene: Phaser.Scene, entry: TokenAnimEntry, onComplete: () => void) => {
  stopTween(entry.stateTween);
  entry.view.sprite.setScale(1, 1);
  entry.stateTween = scene.tweens.add({
    targets: entry.view.sprite,
    scale: ATTACK_SCALE,
    duration: 140,
    yoyo: true,
    ease: "Quad.easeOut",
    onComplete
  });
};

export const playCast = (scene: Phaser.Scene, entry: TokenAnimEntry, onComplete: () => void) => {
  stopTween(entry.stateTween);
  entry.view.sprite.setTint(CAST_COLOR);
  const circle = scene.add.circle(entry.view.sprite.x, entry.view.sprite.y + 10, 20, CAST_COLOR, 0.28);
  circle.setDepth(entry.view.sprite.depth - 1);
  entry.castCircle = circle;
  entry.stateTween = scene.tweens.add({
    targets: [entry.view.sprite, circle],
    scale: { from: 1, to: 1.08 },
    alpha: { from: 0.9, to: 0.2 },
    duration: 360,
    yoyo: true,
    ease: "Sine.easeInOut",
    onComplete: () => {
      circle.destroy();
      entry.castCircle = undefined;
      entry.view.sprite.clearTint();
      onComplete();
    }
  });
};

export const playHit = (scene: Phaser.Scene, entry: TokenAnimEntry, onComplete: () => void) => {
  stopTween(entry.stateTween);
  entry.view.sprite.setTint(HIT_COLOR);
  entry.stateTween = scene.tweens.add({
    targets: entry.view.sprite,
    alpha: { from: 1, to: 0.4 },
    duration: 120,
    yoyo: true,
    repeat: 1,
    onComplete: () => {
      entry.view.sprite.clearTint();
      entry.view.sprite.setAlpha(1);
      onComplete();
    }
  });
};
