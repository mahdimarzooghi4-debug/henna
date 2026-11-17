import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parsePreviewToman, previewDiscount,
} from "../apps/web-marketplace/lib/seller-pricing-preview.ts";

test("pricing preview parses Persian, Arabic and ASCII integer tomans without rounding", () => {
  for (const value of ["۸۵۰۰", "۸٬۵۰۰", "٨,٥٠٠", "8500", " ۸۵۰۰ "]) {
    assert.equal(parsePreviewToman(value), 8500, value);
  }
  for (const value of ["", " ", "۰", "0", "-100", "1.5", "۱٫۵", "۸۵۰۰ تومان",
    "123abc", "1e4", "Infinity", "999999999999999999999999999999"]) {
    assert.equal(parsePreviewToman(value), null, value);
  }
});

test("preview-only discount is positive and strictly below the unchanged base price", () => {
  assert.deepEqual(previewDiscount(8500, 7000), { finalToman: 7000, savedToman: 1500 });
  assert.deepEqual(previewDiscount(98000, 97999), { finalToman: 97999, savedToman: 1 });
  for (const value of [-100, 0, 8500, 8501, 9000, NaN, Infinity, 1.2]) {
    assert.equal(previewDiscount(8500, value), null, String(value));
  }
  assert.equal(previewDiscount(1, 1), null);
});
