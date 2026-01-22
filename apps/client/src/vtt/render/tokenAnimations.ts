type GridMetrics = {
  step: number;
  offsetX: number;
  offsetY: number;
};

type TokenElementEntry = {
  root: HTMLDivElement;
  sprite: HTMLImageElement;
  shadow: HTMLDivElement;
};

type AnimationHandle = {
  movement?: Animation;
  bob?: Animation;
  idle?: Animation;
};

const createImpactFlash = (layer: HTMLDivElement, x: number, y: number, className: string) => {
  const impact = document.createElement("div");
  impact.className = className;
  impact.style.left = `${x}px`;
  impact.style.top = `${y}px`;
  layer.appendChild(impact);
  const animation = impact.animate(
    [
      { transform: "translate(-50%, -50%) scale(0.6)", opacity: 0.8 },
      { transform: "translate(-50%, -50%) scale(2)", opacity: 0 }
    ],
    {
      duration: 280,
      easing: "ease-out"
    }
  );
  animation.onfinish = () => impact.remove();
};

const getCellCenter = (cell: { x: number; y: number }, metrics: GridMetrics) => ({
  x: cell.x * metrics.step + metrics.offsetX + metrics.step / 2,
  y: cell.y * metrics.step + metrics.offsetY + metrics.step / 2
});

export const animateMove = (
  entry: TokenElementEntry,
  fromCell: { x: number; y: number },
  toCell: { x: number; y: number },
  metrics: GridMetrics,
  duration: number,
  handles: AnimationHandle
) => {
  const from = getCellCenter(fromCell, metrics);
  const to = getCellCenter(toCell, metrics);
  const dx = from.x - to.x;
  const dy = from.y - to.y;

  handles.movement?.cancel();
  handles.bob?.cancel();
  if (handles.idle) {
    handles.idle.cancel();
    handles.idle = undefined;
  }

  handles.movement = entry.root.animate(
    [
      { transform: `translate(${dx}px, ${dy}px)` },
      { transform: "translate(0, 0)" }
    ],
    {
      duration,
      easing: "ease-in-out"
    }
  );

  handles.bob = entry.sprite.animate(
    [
      { transform: "translate(-50%, -50%) translateY(12%) scaleX(var(--sprite-flip)) scale(1) rotate(0deg)" },
      { transform: "translate(-50%, -50%) translateY(8%) scaleX(var(--sprite-flip)) scale(1.04) rotate(-2deg)" }
    ],
    {
      duration: 200,
      easing: "ease-in-out",
      direction: "alternate",
      iterations: Math.max(1, Math.ceil(duration / 200))
    }
  );
};

export const ensureIdleBreath = (entry: TokenElementEntry, handles: AnimationHandle) => {
  if (handles.idle) {
    return;
  }
  handles.idle = entry.sprite.animate(
    [
      { transform: "translate(-50%, -50%) translateY(12%) scaleX(var(--sprite-flip)) scaleY(1)" },
      { transform: "translate(-50%, -50%) translateY(12%) scaleX(var(--sprite-flip)) scaleY(1.02)" }
    ],
    {
      duration: 1500,
      easing: "ease-in-out",
      direction: "alternate",
      iterations: Infinity
    }
  );
};

export const playMeleeAttackFX = (
  entry: TokenElementEntry,
  targetCell: { x: number; y: number },
  metrics: GridMetrics,
  layer: HTMLDivElement
) => {
  const from = getCellCenter({ x: Number(entry.root.dataset.gridX), y: Number(entry.root.dataset.gridY) }, metrics);
  const to = getCellCenter(targetCell, metrics);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const dash = metrics.step * 0.2;
  const offsetX = (dx / length) * dash;
  const offsetY = (dy / length) * dash;

  entry.sprite.animate(
    [
      { transform: "translate(-50%, -50%) translateY(12%)" },
      { transform: `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px) translateY(12%)` },
      { transform: "translate(-50%, -50%) translateY(12%)" }
    ],
    {
      duration: 320,
      easing: "ease-out"
    }
  );
  entry.shadow.animate(
    [
      { transform: "translate(-50%, -50%)" },
      { transform: `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px)` },
      { transform: "translate(-50%, -50%)" }
    ],
    {
      duration: 320,
      easing: "ease-out"
    }
  );

  window.setTimeout(() => {
    createImpactFlash(layer, to.x, to.y, "vtt-fx-impact");
  }, 160);
};

export const playProjectileFX = (
  fromCell: { x: number; y: number },
  toCell: { x: number; y: number },
  metrics: GridMetrics,
  layer: HTMLDivElement
) => {
  const from = getCellCenter(fromCell, metrics);
  const to = getCellCenter(toCell, metrics);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const projectile = document.createElement("div");
  projectile.className = "vtt-fx-projectile";
  projectile.style.left = `${from.x}px`;
  projectile.style.top = `${from.y}px`;
  layer.appendChild(projectile);
  const animation = projectile.animate(
    [
      { transform: "translate(-50%, -50%) scale(1)" },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1)` }
    ],
    {
      duration: 360,
      easing: "ease-in-out"
    }
  );
  animation.onfinish = () => {
    projectile.remove();
    createImpactFlash(layer, to.x, to.y, "vtt-fx-impact");
  };
};

export const playAOEFX = (
  cells: Array<{ x: number; y: number }>,
  metrics: GridMetrics,
  layer: HTMLDivElement
) => {
  cells.forEach((cell) => {
    const center = getCellCenter(cell, metrics);
    const pulse = document.createElement("div");
    pulse.className = "vtt-fx-aoe";
    pulse.style.left = `${center.x}px`;
    pulse.style.top = `${center.y}px`;
    layer.appendChild(pulse);
    const animation = pulse.animate(
      [
        { transform: "translate(-50%, -50%) scale(0.6)", opacity: 0.7 },
        { transform: "translate(-50%, -50%) scale(2)", opacity: 0 }
      ],
      {
        duration: 320,
        easing: "ease-out"
      }
    );
    animation.onfinish = () => pulse.remove();
  });
};

export const playHealFX = (
  cell: { x: number; y: number },
  metrics: GridMetrics,
  layer: HTMLDivElement
) => {
  const center = getCellCenter(cell, metrics);
  const heal = document.createElement("div");
  heal.className = "vtt-fx-heal";
  heal.style.left = `${center.x}px`;
  heal.style.top = `${center.y}px`;
  layer.appendChild(heal);
  const animation = heal.animate(
    [
      { transform: "translate(-50%, -50%) scale(0.8)", opacity: 0.7 },
      { transform: "translate(-50%, -50%) scale(1.6)", opacity: 0.4 },
      { transform: "translate(-50%, -50%) scale(2.2)", opacity: 0 }
    ],
    {
      duration: 450,
      easing: "ease-out",
      iterations: 2
    }
  );
  animation.onfinish = () => heal.remove();

  const particleCount = 6;
  for (let i = 0; i < particleCount; i += 1) {
    const particle = document.createElement("div");
    particle.className = "vtt-fx-heal-particle";
    const angle = (Math.PI * 2 * i) / particleCount;
    const radius = 10 + Math.random() * 6;
    const startX = center.x + Math.cos(angle) * radius;
    const startY = center.y + Math.sin(angle) * radius;
    particle.style.left = `${startX}px`;
    particle.style.top = `${startY}px`;
    layer.appendChild(particle);
    const particleAnim = particle.animate(
      [
        { transform: "translate(-50%, -50%) scale(1)", opacity: 0.8 },
        { transform: "translate(-50%, -90%) scale(0.6)", opacity: 0 }
      ],
      {
        duration: 450,
        easing: "ease-out"
      }
    );
    particleAnim.onfinish = () => particle.remove();
  }
};

export const createFxLayer = (parent: HTMLDivElement) => {
  const layer = document.createElement("div");
  layer.className = "vtt-fx-layer";
  parent.appendChild(layer);
  return layer;
};

export type { GridMetrics, TokenElementEntry, AnimationHandle };
