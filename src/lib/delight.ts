// Micro-delight: tiny zero-dependency celebration + haptics helpers.
// Used on golden moments (order placed, rating submitted) for an
// app-store-quality feel on the phone.

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  rotation: number;
  vr: number;
  shape: "rect" | "circle";
}

const EMBER_COLORS = [
  "#f59e0b", // amber-500
  "#f97316", // orange-500
  "#ef4444", // red-500
  "#eab308", // yellow-500
  "#fb7185", // rose-400
  "#fbbf24", // amber-400
];

/**
 * Fire a short ember-colored confetti burst (two side cannons).
 * Safe everywhere: no-op on very old browsers / reduced motion.
 */
export function celebrate(intensity: "small" | "big" = "big"): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: `${w}px`,
    height: `${h}px`,
    pointerEvents: "none",
    zIndex: "90",
  });
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  document.body.appendChild(canvas);

  const count = intensity === "big" ? 120 : 60;
  const particles: Particle[] = [];

  const spawn = (
    ox: number,
    oy: number,
    spread: number,
    dir: number,
    n: number
  ) => {
    for (let i = 0; i < n; i++) {
      const angle = dir + (Math.random() - 0.5) * spread;
      const speed = 6 + Math.random() * 9;
      particles.push({
        x: ox,
        y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 4 + Math.random() * 5,
        color: EMBER_COLORS[Math.floor(Math.random() * EMBER_COLORS.length)],
        life: 1,
        rotation: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.3,
        shape: Math.random() > 0.4 ? "rect" : "circle",
      });
    }
  };

  // two side cannons pointing up-inward
  spawn(w * 0.12, h * 0.75, 0.9, -Math.PI / 2.6, Math.ceil(count / 2));
  spawn(w * 0.88, h * 0.75, 0.9, -Math.PI + Math.PI / 2.6, Math.floor(count / 2));

  let frame = 0;
  const tick = () => {
    frame++;
    ctx.clearRect(0, 0, w, h);
    let alive = false;
    for (const p of particles) {
      if (p.life <= 0) continue;
      alive = true;
      p.vy += 0.22; // gravity
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.vr;
      p.life -= 0.012;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      if (p.shape === "rect") {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (alive && frame < 260) {
      requestAnimationFrame(tick);
    } else {
      canvas.remove();
    }
  };
  requestAnimationFrame(tick);
}

/** Short success haptic (Android / supported browsers; no-op elsewhere). */
export function haptic(pattern: "light" | "success" | "error" = "light"): void {
  if (typeof navigator === "undefined") return;
  const vibrate = (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate;
  if (typeof vibrate !== "function") return;
  try {
    if (pattern === "success") vibrate([12, 40, 24]);
    else if (pattern === "error") vibrate([30, 30, 30]);
    else vibrate(10);
  } catch {
    // ignore — haptics are best-effort
  }
}
