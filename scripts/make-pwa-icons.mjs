import sharp from "sharp";
import fs from "fs";

const RAW = "/tmp/mazaj-icon-raw.png";
const OUT = "/home/z/my-project/public/icons";
const BG = "#16110e"; // matches --background dark lounge theme

fs.mkdirSync(OUT, { recursive: true });

async function makeRegular(size, file) {
  // icon fills canvas with a tiny inset so rounded-corner crops don't clip the motif
  const inner = Math.round(size * 0.98);
  const buf = await sharp(RAW)
    .resize(inner, inner, { fit: "cover", position: "centre" })
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: buf, gravity: "center" }])
    .png()
    .toFile(`${OUT}/${file}`);
  console.log(`✓ ${file}`);
}

async function makeMaskable(size, file) {
  // maskable: motif at ~72% inside the safe zone on solid bg
  const inner = Math.round(size * 0.72);
  const buf = await sharp(RAW)
    .resize(inner, inner, { fit: "cover", position: "centre" })
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: buf, gravity: "center" }])
    .png()
    .toFile(`${OUT}/${file}`);
  console.log(`✓ ${file}`);
}

await makeRegular(192, "icon-192.png");
await makeRegular(512, "icon-512.png");
await makeRegular(180, "apple-touch-icon.png");
await makeMaskable(192, "maskable-192.png");
await makeMaskable(512, "maskable-512.png");

// favicon from the icon too
await sharp(RAW).resize(64, 64, { fit: "cover" }).png().toFile(`${OUT}/favicon-64.png`);
console.log("✓ favicon-64.png");
console.log("done");
