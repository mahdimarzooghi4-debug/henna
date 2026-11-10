import test from "node:test";
import assert from "node:assert/strict";
import {changePreviewQuantity,previewCartCount,previewCartTotal} from "../apps/mobile-consumer/src/preview-cart.ts";
test("preview cart adds multiple products, increments, decrements and deletes",()=>{
 const empty={};
 let cart=changePreviewQuantity(empty,"cheese",1);
 cart=changePreviewQuantity(cart,"cheese",1);
 cart=changePreviewQuantity(cart,"yogurt",1);
 assert.deepEqual(empty,{});
 assert.equal(previewCartCount(cart),3);
 assert.equal(previewCartTotal(cart),102000);
 cart=changePreviewQuantity(cart,"cheese",-1);
 assert.equal(previewCartTotal(cart),57000);
 cart=changePreviewQuantity(cart,"cheese",-99);
 assert.deepEqual(cart,{yogurt:1});
 cart=changePreviewQuantity(cart,"yogurt",-1);
 assert.deepEqual(cart,{});
});
test("preview only accepts known sample keys, integer changes and bounded quantities",()=>{
 const empty={};
 assert.equal(changePreviewQuantity(empty,"unknown",1),empty);
 assert.equal(changePreviewQuantity(empty,"__proto__",1),empty);
 assert.equal(changePreviewQuantity(empty,"tea",0.5),empty);
 assert.deepEqual(changePreviewQuantity(empty,"tea",1000),{tea:99});
 assert.equal(previewCartTotal({tea:99}),3366000);
});
