/**
 * Generates branded Android launcher + splash art for the Mazaj APK
 * (native-app/android) from the existing PWA brand icon.
 *
 * - mipmap <dpi> ic_launcher(_round).png - legacy full-bleed launcher rasters
 *   (system launchers mask these)
 * - mipmap <dpi> ic_launcher_foreground.png - adaptive-icon foreground layers
 *   (glyph at 58% canvas, well inside the 66dp safe zone)
 * - values color patch is handled separately (ic_launcher_background → #16110e)
 * - drawable(-port/-land) splash.png - charcoal launch splash with centered mark
 *
 * Run: node scripts/make-android-art.mjs   (sharp comes from the root project)
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const ROOT = "/home/z/my-project";
const RES = `${ROOT}/native-app/android/app/src/main/res`;
const BRAND = `${ROOT}/public/icons/icon-512.png`; // 512², bg exactly #16110e

const CHARCOAL = { r: 0x16, g: 0x11, b: 0x0e, alpha: 1 };

async function write(buf, path) {
  mkdirSync(dirname(path), { recursive: true });
  await sharp(buf).png().toFile(path);
  console.log("✓", path.replace(ROOT + "/", ""));
}

async function main() {
  // 1. Legacy launcher rasters (full-bleed; launcher applies its own mask)
  const legacy = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [dpi, size] of Object.entries(legacy)) {
    const buf = await sharp(BRAND).resize(size, size).png().toBuffer();
    await write(buf, `${RES}/mipmap-${dpi}/ic_launcher.png`);
    await write(buf, `${RES}/mipmap-${dpi}/ic_launcher_round.png`);
  }

  // 2. Adaptive foreground: glyph scaled to 58% of the 108dp canvas, centered
  const fg = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
  for (const [dpi, size] of Object.entries(fg)) {
    const iconSize = Math.round(size * 0.58);
    const icon = await sharp(BRAND).resize(iconSize, iconSize).png().toBuffer();
    const buf = await sharp({
      create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: icon, left: Math.round((size - iconSize) / 2), top: Math.round((size - iconSize) / 2) }])
      .png()
      .toBuffer();
    await write(buf, `${RES}/mipmap-${dpi}/ic_launcher_foreground.png`);
  }

  // 3. Splash screens — charcoal with the mark at 30% of the short edge
  const splashPort = {
    "drawable": [480, 640],
    "drawable-port-mdpi": [480, 640],
    "drawable-port-hdpi": [720, 960],
    "drawable-port-xhdpi": [960, 1280],
    "drawable-port-xxhdpi": [1280, 1706],
    "drawable-port-xxxhdpi": [1920, 2560],
  };
  const splashLand = {
    "drawable-land-mdpi": [640, 480],
    "drawable-land-hdpi": [960, 720],
    "drawable-land-xhdpi": [1280, 960],
    "drawable-land-xxhdpi": [1706, 1280],
    "drawable-land-xxxhdpi": [2560, 1920],
  };
  for (const [dir, [w, h]] of [...Object.entries(splashPort), ...Object.entries(splashLand)]) {
    const iconSize = Math.round(Math.min(w, h) * 0.3);
    const icon = await sharp(BRAND).resize(iconSize, iconSize).png().toBuffer();
    const buf = await sharp({ create: { width: w, height: h, channels: 4, background: CHARCOAL } })
      .composite([{ input: icon, left: Math.round((w - iconSize) / 2), top: Math.round((h - iconSize) / 2) }])
      .png()
      .toBuffer();
    await write(buf, `${RES}/${dir}/splash.png`);
  }

  console.log("android art done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
