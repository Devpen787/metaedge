import React, { useEffect, useRef } from 'react';

// Ambient "constellation" background rendered with PixiJS: drifting glow
// nodes linked by proximity lines that lean gently toward the pointer.
// Purely decorative — pointer-transparent, skipped entirely under
// prefers-reduced-motion, and torn down fully on unmount.
export default function ParticleField({ className = '' }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let destroyed = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const PIXI = await import('pixi.js');
        if (destroyed) return;
        const app = new PIXI.Application();
        await app.init({
          resizeTo: host,
          backgroundAlpha: 0,
          antialias: true,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
        });
        if (destroyed) {
          app.destroy(true, { children: true, texture: true });
          return;
        }
        host.appendChild(app.canvas);

        const lines = new PIXI.Graphics();
        app.stage.addChild(lines);

        const dot = app.renderer.generateTexture(
          new PIXI.Graphics().circle(0, 0, 4).fill(0xffffff)
        );
        const COLORS = [0x6366f1, 0x818cf8, 0x22d3ee, 0x94a3b8];
        const count = Math.max(
          36,
          Math.min(90, Math.floor((host.clientWidth * host.clientHeight) / 16000))
        );
        const pts = Array.from({ length: count }, () => {
          const sp = new PIXI.Sprite(dot);
          sp.anchor.set(0.5);
          sp.tint = COLORS[Math.floor(Math.random() * COLORS.length)];
          sp.blendMode = 'add';
          sp.x = Math.random() * app.screen.width;
          sp.y = Math.random() * app.screen.height;
          sp.scale.set(0.3 + Math.random() * 0.5);
          app.stage.addChild(sp);
          return {
            sp,
            vx: (Math.random() - 0.5) * 0.3,
            vy: -0.1 - Math.random() * 0.25,
            tw: Math.random() * Math.PI * 2,
          };
        });

        const mouse = { x: -9999, y: -9999 };
        const onMove = (e: PointerEvent) => {
          const r = host.getBoundingClientRect();
          mouse.x = e.clientX - r.left;
          mouse.y = e.clientY - r.top;
        };
        window.addEventListener('pointermove', onMove);

        const LINK = 120;
        let t = 0;
        app.ticker.add((ticker) => {
          const dt = ticker.deltaTime;
          t += dt;
          const W = app.screen.width;
          const H = app.screen.height;

          for (const p of pts) {
            // Gentle pull toward the pointer, damped so it never runs away.
            const dx = mouse.x - p.sp.x;
            const dy = mouse.y - p.sp.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > 1 && d2 < 180 * 180) {
              const f = (0.015 / Math.sqrt(d2)) * dt;
              p.vx += dx * f;
              p.vy += dy * f;
            }
            p.vx *= 0.985;
            p.vy *= 0.985;
            // Base upward drift keeps the field alive without the pointer.
            p.sp.x += p.vx * dt;
            p.sp.y += (p.vy - 0.08) * dt;

            if (p.sp.x < -12) p.sp.x = W + 12;
            if (p.sp.x > W + 12) p.sp.x = -12;
            if (p.sp.y < -12) p.sp.y = H + 12;
            if (p.sp.y > H + 12) p.sp.y = -12;

            p.sp.alpha = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(t * 0.03 + p.tw));
          }

          lines.clear();
          for (let i = 0; i < pts.length; i++) {
            for (let j = i + 1; j < pts.length; j++) {
              const a = pts[i].sp;
              const b = pts[j].sp;
              const dx = a.x - b.x;
              const dy = a.y - b.y;
              const d = Math.hypot(dx, dy);
              if (d < LINK) {
                lines
                  .moveTo(a.x, a.y)
                  .lineTo(b.x, b.y)
                  .stroke({ width: 1, color: 0x6366f1, alpha: (1 - d / LINK) * 0.22 });
              }
            }
          }
        });

        cleanup = () => {
          window.removeEventListener('pointermove', onMove);
          app.destroy(true, { children: true, texture: true });
        };
      } catch {
        /* decorative only — never break the screen over a WebGL failure */
      }
    })();

    return () => {
      destroyed = true;
      cleanup?.();
    };
  }, []);

  return <div ref={hostRef} aria-hidden className={`pointer-events-none ${className}`} />;
}
