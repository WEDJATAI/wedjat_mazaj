"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * EmberCanvas — the cinematic particle layer of the landing.
 *
 * A hand-rolled, zero-dependency canvas engine that paints:
 *  • rising embers — warm glowing motes that drift upward with a wobble
 *  • drifting smoke — huge, ultra-soft blobs that give the scene atmosphere
 *
 * Performance architecture:
 *  • sprites are pre-rendered once to offscreen canvases (radial gradients),
 *    so each frame is just drawImage() calls — no per-frame gradient work
 *  • devicePixelRatio capped at 2 · particle count adapts to viewport width
 *  • pauses when the tab is hidden OR the canvas scrolls out of view
 *  • honors prefers-reduced-motion (renders nothing, static gradients remain)
 */

interface EmberCanvasProps {
  className?: string;
  /** particle density multiplier (default 1) */
  density?: number;
  /** draw the smoke layer too (default true) */
  smoke?: boolean;
}

interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  sprite: number;
  wobble: number;
  wobbleSpeed: number;
}

interface Smoke {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  alpha: number;
}

function makeEmberSprite(hue: number, sat: number, light: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, `hsla(${hue}, ${sat}%, ${Math.min(light + 25, 92)}%, 1)`);
  g.addColorStop(0.25, `hsla(${hue}, ${sat}%, ${light}%, 0.9)`);
  g.addColorStop(0.6, `hsla(${hue}, ${sat}%, ${Math.max(light - 18, 30)}%, 0.28)`);
  g.addColorStop(1, `hsla(${hue}, ${sat}%, ${light}%, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return c;
}

function makeSmokeSprite(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  // layered soft blobs → wisp-like puff
  for (let i = 0; i < 5; i++) {
    const cx = 128 + (Math.random() - 0.5) * 90;
    const cy = 128 + (Math.random() - 0.5) * 90;
    const r = 70 + Math.random() * 80;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, "hsla(35, 18%, 78%, 0.10)");
    g.addColorStop(1, "hsla(35, 18%, 78%, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  }
  return c;
}

export function EmberCanvas({ className, density = 1, smoke = true }: EmberCanvasProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return; // static gradients behind remain — nothing animates

    let raf = 0;
    let running = true;
    let inView = true;
    let pageVisible = !document.hidden;
    let w = 0;
    let h = 0;
    let dpr = 1;

    // ---- sprites -------------------------------------------------------
    const emberSprites = [
      makeEmberSprite(38, 95, 62), // molten orange
      makeEmberSprite(46, 92, 66), // amber
      makeEmberSprite(30, 90, 58), // ember red
      makeEmberSprite(52, 85, 72), // pale gold
    ];
    const smokeSprite = makeSmokeSprite();

    // ---- particles -----------------------------------------------------
    const embers: Ember[] = [];
    const smokes: Smoke[] = [];

    const spawnEmber = (initial = false): Ember => {
      const maxLife = 5200 + Math.random() * 4200;
      return {
        x: Math.random() * w,
        y: initial ? Math.random() * h : h + 12 + Math.random() * 30,
        vx: (Math.random() - 0.5) * 0.12,
        vy: -(0.16 + Math.random() * 0.34),
        life: initial ? Math.random() * maxLife : 0,
        maxLife,
        size: 1.4 + Math.random() * 3.4,
        sprite: (Math.random() * emberSprites.length) | 0,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.0006 + Math.random() * 0.0012,
      };
    };

    const spawnSmoke = (initial = false): Smoke => ({
      x: Math.random() * w,
      y: initial ? Math.random() * h : h * (0.55 + Math.random() * 0.6),
      vx: (Math.random() - 0.5) * 0.05,
      vy: -(0.012 + Math.random() * 0.02),
      size: Math.min(w, 900) * (0.28 + Math.random() * 0.3),
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.00008,
      alpha: 0.32 + Math.random() * 0.3,
    });

    const build = () => {
      const base = w < 640 ? 26 : w < 1100 ? 42 : 60; // mobile → desktop
      const n = Math.round(base * density);
      embers.length = 0;
      for (let i = 0; i < n; i++) embers.push(spawnEmber(true));
      if (smoke) {
        smokes.length = 0;
        const sn = w < 640 ? 3 : 5;
        for (let i = 0; i < sn; i++) smokes.push(spawnSmoke(true));
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(rect.width, 1);
      h = Math.max(rect.height, 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    };

    // ---- frame loop ----------------------------------------------------
    let last = performance.now();

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!running || !inView || !pageVisible) {
        last = now;
        return;
      }
      let dt = now - last;
      last = now;
      if (dt > 64) dt = 64; // tab-switch guard

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      // smoke layer (soft, slow, screen-blend feel)
      if (smoke && smokes.length) {
        ctx.globalCompositeOperation = "source-over";
        for (const s of smokes) {
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.rot += s.vr * dt;
          if (s.y + s.size * 0.5 < -s.size) {
            Object.assign(s, spawnSmoke());
          }
          ctx.save();
          ctx.globalAlpha = s.alpha * 0.35;
          ctx.translate(s.x, s.y);
          ctx.rotate(s.rot);
          ctx.drawImage(smokeSprite, -s.size / 2, -s.size / 2, s.size, s.size);
          ctx.restore();
        }
        ctx.globalCompositeOperation = "lighter";
      }

      // ember layer
      for (let i = 0; i < embers.length; i++) {
        const e = embers[i];
        e.life += dt;
        e.wobble += e.wobbleSpeed * dt;
        e.x += (e.vx + Math.sin(e.wobble) * 0.08) * dt * 0.06 * 16;
        e.y += e.vy * dt * 0.06 * 16;

        if (e.life >= e.maxLife || e.y < -20) {
          embers[i] = spawnEmber();
          continue;
        }
        const t = e.life / e.maxLife;
        // fade in fast, glow mid-life, fade out
        const alpha = t < 0.15 ? t / 0.15 : Math.pow(1 - (t - 0.15) / 0.85, 1.6);
        const size = e.size * (2.6 + Math.sin(t * Math.PI) * 1.2);
        ctx.globalAlpha = Math.max(alpha, 0) * 0.85;
        ctx.drawImage(
          emberSprites[e.sprite],
          e.x - size / 2,
          e.y - size / 2,
          size,
          size
        );
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    resize();
    raf = requestAnimationFrame(frame);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const io = new IntersectionObserver(
      (entries) => {
        inView = entries[0]?.isIntersecting ?? true;
      },
      { rootMargin: "80px" }
    );
    io.observe(canvas);

    const onVisibility = () => {
      pageVisible = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      running = false;
    };
  }, [density, smoke]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
    />
  );
}
