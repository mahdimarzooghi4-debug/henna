import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isSupportedPreviewImage, previewImageMaxBytes, visiblePreviewPictures,
} from "../apps/web-marketplace/lib/seller-image-library-preview.ts";

const images = [
  { id: "sample-used", name: "روغن آفتابگردان", src: "/sample-1", used: true, local: false },
  { id: "sample-unused", name: "تصویر بسته‌بندی", src: "/sample-2", used: false, local: false },
  { id: "local", name: "test-image.png", src: "blob:preview", used: false, local: true },
];

test("preview accepts only supported non-empty files under the existing 10 MiB limit", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    assert.equal(isSupportedPreviewImage({ type, size: 1 }), true);
    assert.equal(isSupportedPreviewImage({ type, size: previewImageMaxBytes }), true);
    for (const size of [0, -1, previewImageMaxBytes + 1, NaN, Infinity]) {
      assert.equal(isSupportedPreviewImage({ type, size }), false);
    }
  }
  for (const type of ["", "image/svg+xml", "image/gif", "application/pdf", "text/html"]) {
    assert.equal(isSupportedPreviewImage({ type, size: 1024 }), false, type);
  }
});

test("filters and search operate only on the preview collection", () => {
  assert.equal(visiblePreviewPictures(images, "all", "", "recent").length, 3);
  assert.deepEqual(visiblePreviewPictures(images, "used", "", "recent").map(x => x.id), ["sample-used"]);
  assert.deepEqual(visiblePreviewPictures(images, "unused", "", "recent").map(x => x.id), ["sample-unused", "local"]);
  assert.deepEqual(visiblePreviewPictures(images, "local", "", "recent").map(x => x.id), ["local"]);
  assert.deepEqual(visiblePreviewPictures(images, "all", "  TEST-IMAGE  ", "recent").map(x => x.id), ["local"]);
  assert.deepEqual(visiblePreviewPictures(images, "used", "test-image", "recent"), []);
  assert.deepEqual(visiblePreviewPictures(images, "all", "", "name").map(x => x.id),
    [...images].sort((a, b) => a.name.localeCompare(b.name, "fa")).map(x => x.id));
  assert.deepEqual(images.map(x => x.id), ["sample-used", "sample-unused", "local"],
    "sorting and filtering must not mutate the original list");
});
