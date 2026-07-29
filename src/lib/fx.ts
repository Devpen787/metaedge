// Celebration FX layer powered by PixiJS. Lazily boots a transparent,
// click-through canvas above the app the first time a burst fires, so the
// library never loads for sessions that never earn a celebration.
// Bursts only fire on genuine events (rank-up, locked-in profit) — never
// decorative noise, per the Anti-Slop Directive in BRAND_GUIDELINES.md.

export type BurstKind = 'profit' | 'rankup';

interface Particle {
  sprite: import('pixi.js').Sprite;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  life: number;
  maxLife: number;
  spin: number;
  // flip > 0 gives a coin-style scale.x wobble; 0 means a plain spark.
  flip: number;
  baseScale: number;
}

interface FxCtx {
  PIXI: typeof import('pixi.js');
  app: import('pixi.js').Application;
  dot: import('pixi.js').Texture;
}

let ctxPromise: Promise<FxCtx | null> | null = null;
const particles: Particle[] = [];

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

async function getCtx(): Promise<FxCtx | null> {
  if (!ctxPromise) {
    ctxPromise = (async () => {
      try {
        const PIXI = await import('pixi.js');
        const app = new PIXI.Application();
        await app.init({
          resizeTo: window,
          backgroundAlpha: 0,
          antialias: true,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
        });
        app.canvas.style.cssText =
          'position:fixed;inset:0;pointer-events:none;z-index:9999;';
        document.body.appendChild(app.canvas);

        const dot = app.renderer.generateTexture(
          new PIXI.Graphics().circle(0, 0, 8).fill(0xffffff)
        );

        app.ticker.add((ticker) => {
          const dt = ticker.deltaTime;
          for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.life += dt;
            const t = p.life / p.maxLife;
            if (t >= 1) {
              p.sprite.destroy();
              particles.splice(i, 1);
              continue;
            }
            p.vy += p.gravity * dt;
            const drag = Math.pow(p.drag, dt);
            p.vx *= drag;
            p.vy *= drag;
            p.sprite.x += p.vx * dt;
            p.sprite.y += p.vy * dt;
            p.sprite.rotation += p.spin * dt;
            p.sprite.alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
            if (p.flip > 0) {
              p.sprite.scale.x =
                p.baseScale * (0.25 + 0.75 * Math.abs(Math.cos(p.life * p.flip)));
              p.sprite.scale.y = p.baseScale;
            } else {
              p.sprite.scale.set(p.baseScale * (1 - 0.5 * t));
            }
          }
          // Idle the render loop between celebrations; this tick still renders
          // the cleared frame before the ticker actually halts.
          if (particles.length === 0) app.ticker.stop();
        });

        return { PIXI, app, dot };
      } catch {
        return null;
      }
    })();
  }
  return ctxPromise;
}

interface SpawnOpts {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tint: number;
  gravity: number;
  drag: number;
  maxLife: number;
  spin?: number;
  flip?: number;
  baseScale: number;
  additive?: boolean;
}

function spawn(ctx: FxCtx, o: SpawnOpts) {
  const sprite = new ctx.PIXI.Sprite(ctx.dot);
  sprite.anchor.set(0.5);
  sprite.position.set(o.x, o.y);
  sprite.tint = o.tint;
  sprite.scale.set(o.baseScale);
  if (o.additive) sprite.blendMode = 'add';
  ctx.app.stage.addChild(sprite);
  particles.push({
    sprite,
    vx: o.vx,
    vy: o.vy,
    gravity: o.gravity,
    drag: o.drag,
    life: 0,
    maxLife: o.maxLife,
    spin: o.spin ?? 0,
    flip: o.flip ?? 0,
    baseScale: o.baseScale,
  });
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

/** Center point of a DOM element in viewport coords, for anchoring a spark. */
export function originOf(el: Element | null | undefined): { x: number; y: number } | undefined {
  if (!el) return undefined;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return undefined;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

const SPARK_PALETTES = {
  emerald: [0x10b981, 0x34d399, 0x6ee7b7, 0xffffff],
  rose: [0xf43f5e, 0xfb7185, 0xfda4af, 0xffffff],
  indigo: [0x6366f1, 0x818cf8, 0xa5b4fc, 0xffffff],
  gold: [0xfbbf24, 0xfcd34d, 0x34d399, 0xffffff],
} as const;

export interface SparkOpts {
  origin?: { x: number; y: number };
  palette?: keyof typeof SPARK_PALETTES;
  count?: number;
  /** 'up' = confirmation puff, 'radial' = milestone ring. */
  direction?: 'up' | 'radial';
}

/**
 * A small, localized spark — the everyday-action reward (a paper fill, a
 * funding tx, a wallet connect). Deliberately lighter than `burst`: it should
 * feel like a tactile tap, not a fireworks show. No-ops under reduced motion.
 */
export async function spark(opts: SparkOpts = {}) {
  if (reducedMotion()) return;
  const ctx = await getCtx();
  if (!ctx) return;
  const { app } = ctx;
  const cx = opts.origin?.x ?? app.screen.width / 2;
  const cy = opts.origin?.y ?? app.screen.height / 2;
  const colors = SPARK_PALETTES[opts.palette ?? 'indigo'];
  const count = opts.count ?? 22;
  const radial = opts.direction === 'radial';

  for (let i = 0; i < count; i++) {
    let vx: number, vy: number;
    if (radial) {
      const a = (i / count) * Math.PI * 2 + rand(-0.2, 0.2);
      const speed = rand(3, 7);
      vx = Math.cos(a) * speed;
      vy = Math.sin(a) * speed;
    } else {
      // Upward cone with a little horizontal scatter.
      vx = rand(-3.5, 3.5);
      vy = rand(-11, -5);
    }
    spawn(ctx, {
      x: cx + rand(-6, 6),
      y: cy + rand(-6, 6),
      vx,
      vy,
      tint: pick(colors as readonly number[] as number[]),
      gravity: radial ? 0.05 : 0.22,
      drag: 0.94,
      maxLife: rand(28, 52),
      baseScale: rand(0.18, 0.42),
      additive: true,
    });
  }

  app.ticker.start();
}

/**
 * Fire a fullscreen celebration burst. Safe to call from anywhere; no-ops
 * under prefers-reduced-motion or if WebGL is unavailable.
 */
export async function burst(kind: BurstKind, origin?: { x: number; y: number }) {
  if (reducedMotion()) return;
  const ctx = await getCtx();
  if (!ctx) return;
  const { app } = ctx;

  if (kind === 'rankup') {
    // Indigo firework — brand-primary radial burst with a white-hot core.
    const cx = origin?.x ?? app.screen.width / 2;
    const cy = origin?.y ?? app.screen.height * 0.38;
    const colors = [0x6366f1, 0x818cf8, 0xa5b4fc, 0xc7d2fe, 0xffffff];
    for (let i = 0; i < 90; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = rand(3, 15);
      spawn(ctx, {
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        tint: pick(colors),
        gravity: 0.12,
        drag: 0.955,
        maxLife: rand(45, 85),
        baseScale: rand(0.2, 0.55),
        additive: true,
      });
    }
  } else {
    // Emerald coin fountain — profit locked in.
    const bx = origin?.x ?? app.screen.width / 2;
    const by = origin?.y ?? app.screen.height + 12;
    const coinTints = [0x10b981, 0x34d399, 0x059669];
    for (let i = 0; i < 36; i++) {
      spawn(ctx, {
        x: bx + rand(-60, 60),
        y: by,
        vx: rand(-5, 5),
        vy: rand(-22, -13),
        tint: pick(coinTints),
        gravity: 0.35,
        drag: 0.995,
        maxLife: rand(85, 125),
        spin: rand(-0.15, 0.15),
        flip: rand(0.12, 0.28),
        baseScale: rand(0.45, 0.85),
      });
    }
    for (let i = 0; i < 28; i++) {
      spawn(ctx, {
        x: bx + rand(-80, 80),
        y: by,
        vx: rand(-4, 4),
        vy: rand(-20, -10),
        tint: pick([0x6ee7b7, 0xa7f3d0, 0xffffff]),
        gravity: 0.28,
        drag: 0.99,
        maxLife: rand(60, 95),
        baseScale: rand(0.15, 0.4),
        additive: true,
      });
    }
  }

  app.ticker.start();
}
