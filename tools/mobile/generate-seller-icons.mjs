/**
 * Regenerate the seller launcher icon from the approved logo image.
 * The old source PNG contains a cream canvas outside its rounded green tile.
 * Its border is NOT a logo detail: flood-fill the edge-connected non-teal canvas,
 * then composite only the actual emblem onto uniform teal.
 *
 * No network, new brand/logo artwork, or external graphics provider.
 */
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const assetsDir = resolve(repoRoot, "apps/mobile-seller/assets");
const original = resolve(assetsDir, "hana-seller-app-icon.png");
const cleanPath = resolve(assetsDir, "hana-seller-icon-clean.png");
const foregroundPath = resolve(assetsDir, "hana-seller-adaptive-foreground.png");
const background = [5, 82, 71];
const { data, info } = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
if (width !== height || width < 256 || channels !== 4) {
  throw new Error("Unexpected seller icon geometry or pixel format");
}
const count = width * height;
const teal = new Uint8Array(count);
for (let i = 0; i < count; i++) {
  const o = i * 4;
  const r = data[o], g = data[o + 1], b = data[o + 2];
  // The approved emblem is terracotta/orange/gold, not teal.
  teal[i] = r < 112 && g >= r + 18 && b >= r + 7 ? 1 : 0;
}
const exterior = new Uint8Array(count);
const queue = new Int32Array(count);
let tail = 0, head = 0;
function enqueue(i) {
  if (teal[i] || exterior[i]) return;
  exterior[i] = 1;
  queue[tail++] = i;
}
for (let x = 0; x < width; x++) {
  enqueue(x);
  enqueue((height - 1) * width + x);
}
for (let y = 0; y < height; y++) {
  enqueue(y * width);
  enqueue(y * width + width - 1);
}
while (head < tail) {
  const i = queue[head++];
  const x = i % width, y = Math.floor(i / width);
  if (x > 0) enqueue(i - 1);
  if (x + 1 < width) enqueue(i + 1);
  if (y > 0) enqueue(i - width);
  if (y + 1 < height) enqueue(i + width);
}

const full = Buffer.alloc(count * 4);
const foreground = Buffer.alloc(count * 4);
let emblemCount = 0;
for (let i = 0; i < count; i++) {
  const o = i * 4;
  const emblemPixel = !teal[i] && !exterior[i] && data[o + 3] > 0;
  if (emblemPixel) {
    emblemCount++;
    for (let c = 0; c < 4; c++) full[o + c] = foreground[o + c] = data[o + c];
  } else {
    full[o] = background[0];
    full[o + 1] = background[1];
    full[o + 2] = background[2];
    full[o + 3] = 255;
    foreground[o + 3] = 0;
  }
}
if (emblemCount < count / 15 || emblemCount > count / 2 || tail < count / 200) {
  throw new Error("Seller icon color isolation unexpected: refusing to publish");
}
const raw = { width, height, channels: 4 };
await sharp(full, { raw }).png().toFile(cleanPath);
await sharp(foreground, { raw }).png().toFile(foregroundPath);
console.log("Generated full-bleed seller icon and transparent adaptive foreground");
