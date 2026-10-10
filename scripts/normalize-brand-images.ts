// Normalize every brand logo to a clean, square, white-backed JPEG so all
// chips/cards render consistently on the dark theme (and fix the mislabeled
// webp-bytes-as-.jpg files). Idempotent — safe to re-run.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), "public/images/brands");

// r59: VLM-audited brand-accurate sources (fetched via image-search +
// verified, or generated where the brand is too obscure to find).
const CAND = "/tmp/brand-candidates";

// source file (absolute or in DIR) -> normalized output name
const JOBS: { src: string; out: string }[] = [
  { src: `${CAND}/mazaya-3.jpg`, out: "mazaya.jpg" },
  { src: "al-fakher.jpg", out: "al-fakher.jpg" }, // already correct (VLM pass)
  { src: `${CAND}/dandash-1.png`, out: "dandash.jpg" },
  { src: "nakhla.jpg", out: "nakhla.jpg" }, // already correct (VLM pass)
  { src: `${CAND}/amy-1.png`, out: "amy.jpg" },
  { src: `${CAND}/salom-gen.png`, out: "salom.jpg" },
  { src: `${CAND}/kass-gen.png`, out: "kass.jpg" },
  { src: `${CAND}/regular-2.jpg`, out: "regular.jpg" }, // "Regular shisha" category tile
];

const SIZE = 512;

async function run() {
  for (const job of JOBS) {
    const srcPath = path.isAbsolute(job.src) ? job.src : path.join(DIR, job.src);
    const outPath = path.join(DIR, job.out);
    if (!fs.existsSync(srcPath)) {
      console.error(`MISSING source: ${job.src}`);
      process.exitCode = 1;
      continue;
    }
    // Trim transparent/near-white borders first so logos fill the square,
    // then contain onto a white square with a small margin.
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
    console.log(`OK ${job.out} ${SIZE}x${SIZE} ${kb}KB (from ${job.src} ${width}x${height})`);
  }

  // Remove stale variants no longer referenced by the catalog.
  const keep = new Set(JOBS.map((j) => j.out));
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
