import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { join } from "node:path";

const buyer = join(process.cwd(), "apps/mobile-consumer/assets");
const seller = join(process.cwd(), "apps/mobile-seller/assets");
const colors = [[255,242,227,255], [5,82,71,255]];
const regular = [
  join(buyer, "hana-buyer-icon-only.png"),
  join(seller, "hana-seller-icon-only.png"),
];
const adaptive = [
  join(buyer, "hana-buyer-adaptive-foreground.png"),
  join(seller, "hana-seller-adaptive-foreground.png"),
];

async function image(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 512);
  assert.equal(info.height, 512);
  assert.equal(info.channels, 4);
  return data;
}
function at(data, x, y) {
  return Array.from(data.subarray((y*512+x)*4, (y*512+x)*4+4));
}
function bounds(data, isSymbol) {
  let count=0, minX=512, maxX=-1, minY=512, maxY=-1;
  for (let y=0; y<512; y++) for (let x=0; x<512; x++) {
    const i=(y*512+x)*4;
    if (!isSymbol(data,i)) continue;
    count++;
    minX=Math.min(minX,x); maxX=Math.max(maxX,x);
    minY=Math.min(minY,y); maxY=Math.max(maxY,y);
  }
  return {count,minX,maxX,minY,maxY};
}
const outside = [[0,0],[10,10],[511,0],[0,511],[511,511],
  [256,0],[0,256],[511,256],[256,511]];
test("buyer and seller icons display centered emblem only, never wordmark below it", async () => {
  for (let j=0;j<2;j++) {
    const data=await image(regular[j]), bg=colors[j];
    for (const [x,y] of outside) assert.deepEqual(at(data,x,y),bg);
    const area=bounds(data,(p,i)=>p[i]!==bg[0]||p[i+1]!==bg[1]||
      p[i+2]!==bg[2]||p[i+3]!==bg[3]);
    assert.ok(area.count>3500,"Approved emblem missing");
    assert.ok(area.minX>=85&&area.maxX<=426,"Artwork must be centered");
    assert.ok(area.minY>=85&&area.maxY<=426,"No extra text, subtitle, or decoration");
    assert.ok(area.minY<240&&area.maxY>270,"Emblem must be vertically centered");
  }
});
test("adaptive foregrounds share the same centered symbol and transparent edges", async () => {
  const a=await image(adaptive[0]),b=await image(adaptive[1]);
  assert.deepEqual(a,b,"Buyer and seller pictorial emblems must match");
  const area=bounds(a,(p,i)=>p[i+3]>=80);
  assert.ok(area.count>2500,"Pictorial emblem missing");
  assert.ok(area.minX>=116&&area.maxX<=395);
  assert.ok(area.minY>=116&&area.maxY<=395,
    "Any extra lettering or subtitle outside central safe area is forbidden");
  for (const [x,y] of outside) assert.equal(at(a,x,y)[3],0);
});
test("all 4 launcher assets are valid 512x512 PNGs", async () => {
  for (const path of [...regular,...adaptive]) {
    const info=await sharp(path).metadata();
    assert.equal(info.format,"png");
    assert.equal(info.width,512);
    assert.equal(info.height,512);
  }
});
