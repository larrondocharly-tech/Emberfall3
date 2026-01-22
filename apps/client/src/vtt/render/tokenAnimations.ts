import Phaser from "phaser";

export type TokenAnimationView = {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  hpBar?: Phaser.GameObjects.Graphics;
  selectionRing?: Phaser.GameObjects.Graphics;
  activeHalo?: Phaser.GameObjects.Graphics;
  hoverOutline?: Phaser.GameObjects.Graphics;
};

export type TokenAnimationEntry = {
  view: TokenAnimationView;
  displayX: number;
  displayY: number;
  moveTween?: Phaser.Tweens.Tween;
  bobTween?: Phaser.Tweens.Tween;
  stateTween?: Phaser.Tweens.Tween;
  castCircle?: Phaser.GameObjects.Arc;
};

const SPRITE_OFFSET_RATIO = 0.12;
const SHADOW_OFFSET_RATIO = 0.28;
const LABEL_OFFSET_RATIO = 0.55;
const HP_BAR_OFFSET_RATIO = 0.44;

const stopTween = (tween?: Phaser.Tweens.Tween) => {
  if (!tween) {
    return;
  }
  if (tween.isPlaying()) {
    tween.stop();
  }
  tween.remove();
};

export const positionTokenView = (view: TokenAnimationView, x: number, y: number, tileSize: number) => {
  const spriteOffset = tileSize * SPRITE_OFFSET_RATIO;
  const shadowOffset = tileSize * SHADOW_OFFSET_RATIO;
  const labelOffset = tileSize * LABEL_OFFSET_RATIO;
  const hpOffset = tileSize * HP_BAR_OFFSET_RATIO;
  view.sprite.setPosition(x, y + spriteOffset);
  view.shadow.setPosition(x, y + shadowOffset);
  view.label.setPosition(x, y - labelOffset);
  view.selectionRing?.setPosition(x, y + shadowOffset);
  view.activeHalo?.setPosition(x, y + shadowOffset);
  view.hoverOutline?.setPosition(x, y + spriteOffset);
  view.hpBar?.setPosition(x, y - hpOffset);
};

export const animateMove = (
  scene: Phaser.Scene,
  entry: TokenAnimationEntry,
  from: { x: number; y: number },
  to: { x: number; y: number },
  durationMs: number,
  tileSize: number
) => {
  stopTween(entry.moveTween);
  stopTween(entry.bobTween);

  const proxy = { x: from.x, y: from.y };
  entry.displayX = from.x;
  entry.displayY = from.y;

  entry.bobTween = scene.tweens.add({
    targets: entry.view.sprite,
    scaleX: 0.98,
    scaleY: 1.05,
    duration: 220,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut"
  });

  entry.moveTween = scene.tweens.add({
    targets: proxy,
    x: to.x,
    y: to.y,
    duration: durationMs,
    ease: "Sine.easeInOut",
    onUpdate: () => {
      entry.displayX = proxy.x;
      entry.displayY = proxy.y;
      positionTokenView(entry.view, proxy.x, proxy.y, tileSize);
    },
    onComplete: () => {
      entry.displayX = to.x;
      entry.displayY = to.y;
      positionTokenView(entry.view, to.x, to.y, tileSize);
      stopTween(entry.bobTween);
      entry.view.sprite.setScale(1, 1);
    }
  });
};

export const animateAttack = (
  scene: Phaser.Scene,
  entry: TokenAnimationEntry,
  target: { x: number; y: number },
  tileSize: number,
  fxLayer: Phaser.GameObjects.Container
) => {
  stopTween(entry.stateTween);
  const sprite = entry.view.sprite;
  const shadow = entry.view.shadow;
  const baseX = sprite.x;
  const baseY = sprite.y;
  const dx = target.x - baseX;
  const dy = target.y - baseY;
  const length = Math.hypot(dx, dy) || 1;
  const dash = tileSize * 0.2;
  const offsetX = (dx / length) * dash;
  const offsetY = (dy / length) * dash;

  entry.stateTween = scene.tweens.add({
    targets: [sprite, shadow, entry.view.hoverOutline].filter(Boolean),
    x: baseX + offsetX,
    y: baseY + offsetY,
    duration: 150,
    yoyo: true,
    ease: "Quad.easeOut"
  });

  scene.time.delayedCall(130, () => {
    const impact = scene.add.circle(target.x, target.y, tileSize * 0.18, 0xfacc15, 0.6);
    fxLayer.add(impact);
    scene.tweens.add({
      targets: impact,
      scale: 2,
      alpha: 0,
      duration: 220,
      onComplete: () => impact.destroy()
    });
  });
};

export const animateCast = (scene: Phaser.Scene, entry: TokenAnimationEntry) => {
  stopTween(entry.stateTween);
  entry.view.sprite.setTint(0xfacc15);
  const circle = scene.add.circle(entry.view.sprite.x, entry.view.sprite.y + 12, 18, 0xfacc15, 0.28);
  circle.setDepth(entry.view.sprite.depth - 1);
  entry.castCircle = circle;
  entry.stateTween = scene.tweens.add({
    targets: [entry.view.sprite, circle],
    scale: { from: 1, to: 1.1 },
    alpha: { from: 0.9, to: 0.2 },
    duration: 320,
    yoyo: true,
    ease: "Sine.easeInOut",
    onComplete: () => {
      circle.destroy();
      entry.castCircle = undefined;
      entry.view.sprite.clearTint();
    }
  });
};

export const animateHit = (scene: Phaser.Scene, entry: TokenAnimationEntry) => {
  stopTween(entry.stateTween);
  entry.view.sprite.setTint(0xef4444);
  entry.stateTween = scene.tweens.add({
    targets: entry.view.sprite,
    alpha: { from: 1, to: 0.4 },
    duration: 120,
    yoyo: true,
    repeat: 1,
    onComplete: () => {
      entry.view.sprite.clearTint();
      entry.view.sprite.setAlpha(1);
    }
  });
};

export const playFireBoltFx = (
  scene: Phaser.Scene,
  fxLayer: Phaser.GameObjects.Container,
  from: { x: number; y: number },
  to: { x: number; y: number }
) => {
  const orb = scene.add.circle(from.x, from.y, 6, 0xf97316, 1);
  fxLayer.add(orb);
  scene.tweens.add({
    targets: orb,
    x: to.x,
    y: to.y,
    duration: 320,
    ease: "Quad.easeInOut",
    onComplete: () => {
      orb.destroy();
      const burst = scene.add.circle(to.x, to.y, 12, 0xf97316, 0.8);
      fxLayer.add(burst);
      scene.tweens.add({
        targets: burst,
        scale: 2.5,
        alpha: 0,
        duration: 360,
        onComplete: () => burst.destroy()
      });
    }
  });
};

export const playThunderFx = (
  scene: Phaser.Scene,
  fxLayer: Phaser.GameObjects.Container,
  at: { x: number; y: number },
  radius = 22
) => {
  const pulse = scene.add.circle(at.x, at.y, radius, 0x38bdf8, 0.55);
  fxLayer.add(pulse);
  scene.tweens.add({
    targets: pulse,
    scale: 2,
    alpha: 0,
    duration: 240,
    onComplete: () => pulse.destroy()
  });
  scene.cameras.main.shake(120, 0.003);
};

export const playHealFx = (
  scene: Phaser.Scene,
  fxLayer: Phaser.GameObjects.Container,
  at: { x: number; y: number }
) => {
  const halo = scene.add.circle(at.x, at.y, 14, 0x22c55e, 0.5);
  fxLayer.add(halo);
  scene.tweens.add({
    targets: halo,
    scale: 2.4,
    alpha: 0,
    duration: 420,
    ease: "Sine.easeOut",
    onComplete: () => halo.destroy()
  });
};

export const playExplosionFx = (
  scene: Phaser.Scene,
  fxLayer: Phaser.GameObjects.Container,
  at: { x: number; y: number }
) => {
  const blast = scene.add.circle(at.x, at.y, 16, 0xf59e0b, 0.7);
  fxLayer.add(blast);
  scene.tweens.add({
    targets: blast,
    scale: 3,
    alpha: 0,
    duration: 360,
    onComplete: () => blast.destroy()
  });
  scene.cameras.main.shake(140, 0.004);
};
