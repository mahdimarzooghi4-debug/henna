/**
 * Android launcher assets for buyer and seller.
 * Reuses the existing approved Henna emblem and the branded Persian «حنا»
 * wordmark from the repository's own hana-cart-logo.png. The old seller
 * source has an unwanted cream canvas; only its actual non-teal emblem is
 * kept. Everything outside the artwork is full-bleed cream or teal.
 *
 * User's latest contract: both icons MUST include «حنا» lettering and have
 * NO black frame; buyer=cream, seller=dark teal. Do not add the subtitle.
 * Android adaptive foreground stays transparent outside the logo lockup.
 */
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const buyerDir = resolve(root, "apps/mobile-consumer/assets");
const sellerDir = resolve(root, "apps/mobile-seller/assets");
const sourceSeller = resolve(sellerDir, "hana-seller-app-icon.png");
const sourceWordmark = resolve(buyerDir, "hana-cart-logo.png");
const backgrounds = {
  buyer: { r: 255, g: 242, b: 227, alpha: 1 },
  seller: { r: 5, g: 82, b: 71, alpha: 1 },
};
const size = 512;

// Extract only the approved pictorial emblem from the historical seller icon.
// Edge-connected unwanted cream outside its teal tile is NOT part of the mark.
const { data, info } = await sharp(sourceSeller)
  .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
if (width !== height || width < 256 || channels !== 4)
  throw new Error("Unexpected seller logo source geometry");
const count = width * height, teal = new Uint8Array(count);
for (let i = 0; i < count; i++) {
  const o = i * 4;
  const r = data[o], g = data[o + 1], b = data[o + 2];
  teal[i] = r < 112 && g >= r + 18 && b >= r + 7 ? 1 : 0;
}
const exterior = new Uint8Array(count), queue = new Int32Array(count);
let head = 0, tail = 0;
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
  const i = queue[head++], x = i % width, y = Math.floor(i / width);
  if (x > 0) enqueue(i - 1);
  if (x + 1 < width) enqueue(i + 1);
  if (y > 0) enqueue(i - width);
  if (y + 1 < height) enqueue(i + width);
}
const isolated = Buffer.alloc(count * 4);
let n = 0, minX = width, maxX = -1, minY = height, maxY = -1;
for (let i = 0; i < count; i++) {
  const o = i * 4;
  if (teal[i] || exterior[i] || data[o + 3] === 0) continue;
  data.copy(isolated, o, o, o + 4);
  const x = i % width, y = Math.floor(i / width);
  minX = Math.min(minX, x); maxX = Math.max(maxX, x);
  minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  n++;
}
if (n < count / 15 || n > count / 2 || tail < count / 200 ||
    maxX <= minX || maxY <= minY)
  throw new Error("Logo extraction failed closed: unexpected emblem pixels");
const emblem = await sharp(isolated, { raw: { width, height, channels: 4 } })
  .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
  .png().toBuffer();

// The repo's approved logo has «حنا» in its upper-left portion, with
// the subtitle on the bottom row. Crop the main word only (never subtitle).
const { width: logoWidth, height: logoHeight } = await sharp(sourceWordmark).metadata();
if (logoWidth !== 220 || logoHeight !== 72)
  throw new Error("Approved wordmark source dimensions changed; review crop");
const wordmark = await sharp(sourceWordmark)
  .extract({ left: 0, top: 0, width: 141, height: 51 })
  .trim({ threshold: 8 })
  .png().toBuffer();
const wordInfo = await sharp(wordmark).metadata();
if (!wordInfo.width || !wordInfo.height ||
    wordInfo.width < 70 || wordInfo.height < 20)
  throw new Error("Henna wordmark crop is incomplete");

async function fitted(buffer, maxWidth, maxHeight) {
  const image = await sharp(buffer)
    .resize({ width: maxWidth, height: maxHeight, fit: "inside",
              kernel: "lanczos3" })
    .png().toBuffer();
  const { width, height } = await sharp(image).metadata();
  if (!width || !height) throw new Error("Invalid resized icon artwork");
  return { input: image, left: Math.floor((size - width) / 2), height };
}
async function makeLockup(adaptive) {
  const mark = await fitted(emblem, adaptive ? 160 : 195, adaptive ? 181 : 222);
  const word = await fitted(wordmark, adaptive ? 252 : 312, adaptive ? 84 : 105);
  const markTop = adaptive ? 114 : 74;
  const wordTop = adaptive ? 301 : 310;
  if (wordTop + word.height >= size - 70)
    throw new Error("Wordmark exceeds Android icon safe area");
  const overlays = [
    { input: mark.input, left: mark.left, top: markTop },
    { input: word.input, left: word.left, top: wordTop },
  ];
  return overlays;
}
const regularOverlays = await makeLockup(false);
const adaptiveOverlays = await makeLockup(true);

async function render(target, color, overlays, transparent) {
  const background = transparent
    ? { r: 0, g: 0, b: 0, alpha: 0 }
    : color;
  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite(overlays)
    .png()
    .toFile(target);
}
await Promise.all([
  render(resolve(buyerDir, "hana-buyer-icon-with-word.png"),
    backgrounds.buyer, regularOverlays, false),
  render(resolve(buyerDir, "hana-buyer-adaptive-foreground.png"),
    backgrounds.buyer, adaptiveOverlays, true),
  render(resolve(sellerDir, "hana-seller-icon-clean.png"),
    backgrounds.seller, regularOverlays, false),
  render(resolve(sellerDir, "hana-seller-adaptive-foreground.png"),
    backgrounds.seller, adaptiveOverlays, true),
]);
console.log("Generated buyer/seller Android icons with «حنا» and border-free adaptive layers");
