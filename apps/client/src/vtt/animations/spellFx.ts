import Phaser from "phaser";

export type FxPoint = { x: number; y: number };

export const playFireBoltFx = (scene: Phaser.Scene, from: FxPoint, to: FxPoint) => {
  const orb = scene.add.circle(from.x, from.y, 6, 0xf97316, 1);
  scene.tweens.add({
    targets: orb,
    x: to.x,
    y: to.y,
    duration: 320,
    ease: "Quad.easeInOut",
    onComplete: () => {
      orb.destroy();
      const burst = scene.add.circle(to.x, to.y, 12, 0xf97316, 0.8);
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

export const playHealFx = (scene: Phaser.Scene, at: FxPoint) => {
  const halo = scene.add.circle(at.x, at.y, 10, 0x22c55e, 0.4);
  scene.tweens.add({
    targets: halo,
    scale: 2.4,
    alpha: 0,
    duration: 420,
    ease: "Sine.easeOut",
    onComplete: () => halo.destroy()
  });
};

export const playThunderFx = (scene: Phaser.Scene, at: FxPoint) => {
  const shock = scene.add.circle(at.x, at.y, 14, 0x38bdf8, 0.8);
  scene.tweens.add({
    targets: shock,
    scale: 2.2,
    alpha: 0,
    duration: 280,
    onComplete: () => shock.destroy()
  });
  scene.cameras.main.shake(120, 0.003);
};

export const playExplosionFx = (scene: Phaser.Scene, at: FxPoint) => {
  const blast = scene.add.circle(at.x, at.y, 16, 0xf59e0b, 0.7);
  scene.tweens.add({
    targets: blast,
    scale: 3,
    alpha: 0,
    duration: 360,
    onComplete: () => blast.destroy()
  });
  scene.cameras.main.shake(140, 0.004);
};
