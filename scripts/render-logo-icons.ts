/**
 * Rasterizes the Mazaj living-ember mark into every PWA icon size,
 * straight from the same geometry the animated in-app logo uses
 * (src/lib/logo-geometry.ts) — home-screen icon and in-app brand stay
 * perfectly in sync.
 *
 *   bun scripts/render-logo-icons.ts
 */

import sharp from "sharp";
import { writeFileSync } from "node:fs";
import {
  COALS,
  HOOKAH_STROKES,
  SMOKE_PATHS,
  SMOKE_TENDRILS,
} from "../src/lib/logo-geometry";

/* Hex approximations of the Midnight Ember oklch palette (librsvg-safe). */
const GOLD_STOPS = [
  { off: "0%", color: "#b36511" },
  { off: "45%", color: "#e8a53c" },
  { off: "100%", color: "#ffe0a0" },
];
const SMOKE_STOPS = [
  { off: "0%", color: "rgba(255,242,214,0.85)" },
  { off: "55%", color: "rgba(255,236,200,0.5)" },
  { off: "100%", color: "rgba(255,236,200,0)" },
];

function iconSvg(size: number, markScale: number, withBg: boolean): string {
  const c = size / 2;
  const s = (size * markScale) / 132; // scale factor for the 132-tall mark
  const tx = c - 60 * s;
  const ty = c - 66 * s;

  const defs = `
    <linearGradient id="gold" x1="0" y1="1" x2="1" y2="0">
      ${GOLD_STOPS.map((g) => `<stop offset="${g.off}" stop-color="${g.color}"/>`).join("")}
    </linearGradient>
    <linearGradient id="smoke" x1="0" y1="1" x2="0" y2="0">
      ${SMOKE_STOPS.map((g) => `<stop offset="${g.off}" stop-color="${g.color}"/>`).join("")}
    </linearGradient>
    <radialGradient id="ember" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffd98c"/>
      <stop offset="60%" stop-color="#e08a2e"/>
      <stop offset="100%" stop-color="rgba(224,138,46,0)"/>
    </radialGradient>
    <radialGradient id="halo" cx="50%" cy="62%" r="55%">
      <stop offset="0%" stop-color="rgba(240,160,70,0.5)"/>
      <stop offset="55%" stop-color="rgba(230,140,60,0.16)"/>
      <stop offset="100%" stop-color="rgba(230,140,60,0)"/>
    </radialGradient>
    <filter id="bloom" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="smokefx" x="-60%" y="-60%" width="220%" height="220%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.045" numOctaves="2" seed="7" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
  `;

  const bg = withBg
    ? `
    <radialGradient id="bg" cx="50%" cy="36%" r="80%">
      <stop offset="0%" stop-color="#2a1a12"/>
      <stop offset="55%" stop-color="#1a110c"/>
      <stop offset="100%" stop-color="#0f0a08"/>
    </radialGradient>
    <rect width="${size}" height="${size}" fill="url(#bg)"/>
    <ellipse cx="${c}" cy="${c}" rx="${size * 0.46}" ry="${size * 0.44}" fill="url(#halo)"/>`
    : "";

  const smoke = SMOKE_PATHS.map(
    (d, i) =>
      `<path d="${d}" stroke="url(#smoke)" stroke-width="${SMOKE_TENDRILS[i].width}" fill="none" stroke-linecap="round" opacity="${SMOKE_TENDRILS[i].opacity}"/>`
  ).join("\n      ");

  const strokes = HOOKAH_STROKES.map(
    (st) => `<path d="${st.d}" stroke="url(#gold)" stroke-width="${st.width}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
  ).join("\n      ");

  const coals = COALS.map(
    (c2) => `<circle cx="${c2.x}" cy="${c2.y}" r="${c2.r * 2.1}" fill="url(#ember)" opacity="0.9"/><circle cx="${c2.x}" cy="${c2.y}" r="${c2.r * 0.72}" fill="#fff0c8"/>`
  ).join("\n      ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>${defs}</defs>
  ${bg}
  <g transform="translate(${tx} ${ty}) scale(${s})">
    <g filter="url(#smokefx)">${smoke}</g>
    <g filter="url(#bloom)">${strokes}</g>
    ${coals}
  </g>
</svg>`;
}

async function render(file: string, svg: string, size: number) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(file);
  console.log(`✓ ${file} (${size}×${size})`);
}

async function main() {
  const out = "public/icons";

  // standard icons — mark fills most of the tile
  const full = iconSvg(512, 0.8, true);
  await render(`${out}/icon-512.png`, full, 512);
  await render(`${out}/icon-192.png`, full, 192);
  await render(`${out}/apple-touch-icon.png`, full, 180);
  await render(`${out}/favicon-64.png`, full, 64);

  // maskable icons — smaller mark inside the 80% safe-zone circle
  const maskable = iconSvg(512, 0.6, true);
  await render(`${out}/maskable-512.png`, maskable, 512);
  await render(`${out}/maskable-192.png`, maskable, 192);

  // a transparent static SVG favicon (crisp at any size)
  writeFileSync("src/app/icon.svg", iconSvg(64, 0.92, false));
  console.log("✓ src/app/icon.svg");
  console.log("Done — brand icons regenerated from the living-ember geometry.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
