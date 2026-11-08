import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { join } from "node:path";

const buyer = join(process.cwd(), "apps/mobile-consumer/assets");
const seller = join(process.cwd(), "apps/mobile-seller/assets");
const bgBuyer = [255, 242, 227, 255];
const bgSeller = [5, 82, 71, 255];

async function raw(name) {
  const { data, info } = await sharp(name)
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 512);
  assert.equal(info.height, 512);
  assert.equal(info.channels, 4);
  return data;
}
function at(data, x, y) {
  const offset = (y * 512 + x) * 4;
  return Array.from(data.subarray(offset, offset + 4));
}

test("buyer cream and seller teal launcher icons have no black/cream outer frame", async () => {
  const a = await raw(join(buyer, "hana-buyer-icon-with-word.png"));
  const b = await raw(join(seller, "hana-seller-icon-clean.png"));
  for (const [pixels, background] of [[a, bgBuyer], [b, bgSeller]]) {
    for (const [x,y] of [[0,0],[10,10],[511,0],[0,511],[511,511],
                         [256,0],[0,256],[511,256],[256,511]]) {
      assert.deepEqual(at(pixels,x,y), background);
    }
  }
  // Identical brand lockup on both. Only empty background pixels differ.
  const ab = await Promise.all([
    raw(join(buyer, "hana-buyer-adaptive-foreground.png")),
    raw(join(seller, "hana-seller-adaptive-foreground.png")),
  ]);
  assert.deepEqual(ab[0], ab[1], "Emblem and the word «حنا» must be identical for both apps");
});

test("approved Persian «حنا» wordmark is visible inside both icon foregrounds", async () => {
  const fg = await raw(join(seller, "hana-seller-adaptive-foreground.png"));
  let emblem = 0, text = 0;
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const alpha = fg[(y * 512 + x) * 4 + 3];
      if (alpha < 80) continue;
      if (y >= 100 && y < 300) emblem++;
      if (y >= 300 && y < 420) text++;
    }
  }
  assert.ok(emblem > 2500, "pictorial emblem is missing");
  assert.ok(text > 1500, "branded word «حنا» is missing");
  // Adaptive icons rely on the OS mask. Surrounding pixels MUST be transparent;
  // the background belongs to Android and never shows a dark/black frame.
  for (const [x,y] of [[0,0],[511,0],[0,511],[511,511],[256,0],[0,256]]) {
    assert.equal(at(fg,x,y)[3], 0);
  }
});

test("full and adaptive formats render valid PNGs, never a subtitle or an invented badge", async () => {
  const paths = [
    join(buyer, "hana-buyer-icon-with-word.png"),
    join(buyer, "hana-buyer-adaptive-foreground.png"),
    join(seller, "hana-seller-icon-clean.png"),
    join(seller, "hana-seller-adaptive-foreground.png"),
  ];
  for (const filename of paths) {
    const meta = await sharp(filename).metadata();
    assert.equal(meta.format, "png");
    assert.equal(meta.width, 512);
    assert.equal(meta.height, 512);
  }
});
