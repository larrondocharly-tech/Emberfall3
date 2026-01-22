import Phaser from "phaser";

export type TokenFacing = "N" | "E" | "S" | "W";
export type TokenAnimState = "idle" | "walk" | "attack" | "cast" | "hit";

export type TokenView = {
  root?: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  hpBar?: Phaser.GameObjects.Graphics;
  selectionRing?: Phaser.GameObjects.Graphics;
  activeHalo?: Phaser.GameObjects.Graphics;
  hoverOutline?: Phaser.GameObjects.Graphics;
};

export type TokenAnimEntry = {
  view: TokenView;
  facing: TokenFacing;
  animState: TokenAnimState;
  walkTween?: Phaser.Tweens.Tween;
  stateTween?: Phaser.Tweens.Tween;
  castCircle?: Phaser.GameObjects.Arc;
};
