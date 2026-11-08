import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { join } from "node:path";

const dir = join(process.cwd(), "apps/mobile-seller/assets");
const fullPath = join(dir, "hana-seller-icon-clean.png");
const foregroundPath = join(dir, "hana-seller-adaptive-foreground.png");

test("seller icon has uniform teal corners with no cream halo", async () => {
  const { data, info } = await sharp(fullPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, info.height);
  for (const [x,y] of [[0,0],[10,10],[info.width-1,0],[0,info.height-1],[info.width-1,info.height-1]]) {
    const o=(y*info.width+x)*4;
    assert.deepEqual(Array.from(data.subarray(o,o+4)), [5,82,71,255]);
  }
  const foreground = await sharp(foregroundPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(foreground.info.width, info.width);
  assert.equal(foreground.data[3], 0, "Adaptive layer corners must be transparent");
  const colored = [];
  for(let i=3;i<foreground.data.length;i+=4) if(foreground.data[i]>0) colored.push(i);
  assert.ok(colored.length > info.width*info.height/15, "Emblem not extracted");
  assert.ok(colored.length < info.width*info.height/2, "Background was not removed");
});
