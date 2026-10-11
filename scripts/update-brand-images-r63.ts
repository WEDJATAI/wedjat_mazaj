// r63 — Replace the brand logos with the owner's uploaded pictures.
//
// The owner uploaded 7 pictures (upload/): six named for their brand +
// "Regular.png" (a Khalil Mamoon ornate hookah — VLM-verified) for the
// "Regular shisha" category tile. Kass keeps its r59 logo (no upload).
//
// Same normalization pipeline as r59 (trim near-white borders, contain on
// a white 512² square with a small margin, mozjpeg) so every chip renders
// consistently on the dark theme.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const UPLOAD = path.join(process.cwd(), "upload");
const DIR = path.join(process.cwd(), "public/images/brands");

// owner upload -> normalized catalog output (catalog paths stay unchanged)
const JOBS: { src: string; out: string }[] = [
  { src: "mazaya.png", out: "mazaya.jpg" }, // Mazaya — hookah silhouette
  { src: "alfakher.jpg", out: "al-fakher.jpg" }, // Al Fakher — crowned wordmark
  { src: "Dandash.png", out: "dandash.jpg" }, // Dandash — ندش calligraphy
  { src: "nakhla.jpg", out: "nakhla.jpg" }, // Nakhla — palm, since 1913
  { src: "Amy.jpg", out: "amy.jpg" }, // Amy Deluxe — full hookah
  { src: "salloum.jpeg", out: "salom.jpg" }, // Moassel Saloum — معسل سالم
  { src: "Regular.png", out: "regular.jpg" }, // Khalil Mamoon — regular tile
  // kass.jpg intentionally untouched — no Kass picture was provided
];

const SIZE = 512;

async function run() {
  for (const job of JOBS) {
    const srcPath = path.join(UPLOAD, job.src);
    const outPath = path.join(DIR, job.out);
    if (!fs.existsSync(srcPath)) {
      console.error(`MISSING source: ${job.src}`);
      process.exitCode = 1;
      continue;
    }
    // Flatten transparency onto white, trim near-white borders so the
    // artwork fills the square, then contain onto a white square.
    const trimmed = await sharp(srcPath)
      .flatten({ background: "#ffffff" })
      .trim({ threshold: 12 })
      .toBuffer({ resolveWithObject: true });
    const { width, height } = trimmed.info;
    const margin = Math.round(Math.max(width, height) * 0.06) + 2;
    await sharp(trimmed.data)
      .resize(SIZE - margin * 2, SIZE - margin * 2, {
        fit: "contain",
        background: "#ffffff",
      })
      .extend({
        top: margin,
        bottom: margin,
        left: margin,
        right: margin,
        background: "#ffffff",
      })
      .jpeg({ quality: 86, mozjpeg: true })
      .toFile(outPath);
    const kb = (fs.statSync(outPath).size / 1024).toFixed(0);
    console.log(
      `OK ${job.out} ${SIZE}x${SIZE} ${kb}KB (from ${job.src} ${width}x${height})`
    );
  }

  // Remove stale originals (Oct-8 uploads never referenced by the catalog).
  const keep = new Set([
    ...JOBS.map((j) => j.out),
    "kass.jpg", // kept from r59
  ]);
  for (const f of fs.readdirSync(DIR)) {
    if (!keep.has(f)) {
      fs.unlinkSync(path.join(DIR, f));
      console.log(`removed stale ${f}`);
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
