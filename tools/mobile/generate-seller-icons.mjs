/** Android launcher asset generator.
 * Latest owner decision: ONLY the approved pictorial Henna emblem.
 * No separate word lettering, slogan, subtitle, borders, or seller glyph.
 * Buyer cream and seller teal backgrounds; adaptive icon transparency.
 * Original approved source assets stay unmodified.
 */
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const buyerDir = resolve(root, "apps/mobile-consumer/assets");
const sellerDir = resolve(root, "apps/mobile-seller/assets");
const sourceSeller = resolve(sellerDir, "hana-seller-app-icon.png");
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

// Keep a single pictorial mark safely centered in each Android launcher icon.
async function centeredEmblem(limit) {
  const buffer = await sharp(emblem)
    .resize({ width: limit, height: limit, fit: "inside", kernel: "lanczos3" })
    .png().toBuffer();
  const { width: w, height: h } = await sharp(buffer).metadata();
  if (!w || !h || w > limit || h > limit)
    throw new Error("Invalid resized emblem");
  return [{ input: buffer, left: Math.floor((size - w) / 2),
            top: Math.floor((size - h) / 2) }];
}
const regularOverlays = await centeredEmblem(336);
const adaptiveOverlays = await centeredEmblem(276);

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
  render(resolve(buyerDir, "hana-buyer-icon-only.png"),
    backgrounds.buyer, regularOverlays, false),
  render(resolve(buyerDir, "hana-buyer-adaptive-foreground.png"),
    backgrounds.buyer, adaptiveOverlays, true),
  render(resolve(sellerDir, "hana-seller-icon-only.png"),
    backgrounds.seller, regularOverlays, false),
  render(resolve(sellerDir, "hana-seller-adaptive-foreground.png"),
    backgrounds.seller, adaptiveOverlays, true),
]);
console.log("Generated logo-only buyer/seller Android launcher icons");
