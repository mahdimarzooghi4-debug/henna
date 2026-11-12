/**
 * Browser contract for the Figma seller-image-library PREVIEW.
 * The test enables preview only in this isolated CI Next process.
 * Never simulates server upload or claims that images are persisted.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3010";
let web;
let browser;
let logs = "";

async function startWeb() {
  web = spawn("npm", ["run", "start", "--workspace", "@hana/web-marketplace",
    "--", "-p", "3010", "-H", "127.0.0.1"], {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, HANA_AUTH_UI_PREVIEW: "1", NEXT_TELEMETRY_DISABLED: "1" },
  });
  web.stdout.on("data", (chunk) => { logs += chunk.toString(); });
  web.stderr.on("data", (chunk) => { logs += chunk.toString(); });
  for (let i = 0; i < 45; i++) {
    if (web.exitCode !== null) throw Error("Next exited: " + logs);
    try {
      const response = await fetch(base + "/seller/panel/images", {
        signal: AbortSignal.timeout(1000),
        redirect: "manual",
      });
      if (response.status === 200) return;
    } catch { /* retry */ }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw Error("Seller image preview did not start: " + logs);
}

try {
  await startWeb();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1360, height: 920 }, locale: "fa-IR" });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  const apiMutations = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/") &&
      request.method() !== "GET") apiMutations.push(request.url());
  });

  await page.goto(base + "/seller/panel/images");
  await page.getByRole("heading", { name: "کتابخانه تصاویر" }).waitFor();
  await page.getByText("حالت پیش‌نمایش طراحی").waitFor();
  await page.getByRole("heading", { name: "از کجا شروع کنم؟" }).waitFor();
  assert.equal(await page.getByRole("button", { name: /^بررسی تصویر / }).count(), 6);

  await page.getByRole("button", { name: "بررسی تصویر روغن آفتابگردان" }).click();
  await page.getByRole("heading", { name: "جزئیات تصویر" }).waitFor();
  await page.getByText("متصل به کالای نمایشی").waitFor();
  assert.equal(await page.getByRole("button", { name: "حذف فایل محلی از این صفحه" }).count(), 0);
  await page.getByRole("button", { name: "بستن جزئیات تصویر" }).click();
  await page.getByRole("heading", { name: "یک تصویر انتخاب کنید" }).waitFor();

  await page.getByRole("button", { name: /در حال استفاده/ }).click();
  assert.equal(await page.getByRole("button", { name: /^بررسی تصویر / }).count(), 2);
  await page.getByRole("button", { name: /بدون اتصال/ }).click();
  assert.equal(await page.getByRole("button", { name: /^بررسی تصویر / }).count(), 4);
  await page.getByRole("searchbox", { name: "جست‌وجو در نام تصویر" }).fill("غیرموجود");
  await page.getByText("تصویری مطابق این جست‌وجو پیدا نشد").waitFor();
  await page.getByRole("button", { name: "نمایش همه تصاویر" }).click();
  assert.equal(await page.getByRole("button", { name: /^بررسی تصویر / }).count(), 6);

  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+KDgZAAAAAElFTkSuQmCC",
    "base64",
  );
  await page.locator('input[type="file"]').setInputFiles([
    { name: "photo.png", mimeType: "image/png", buffer: tinyPng },
    { name: "unsafe.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") },
  ]);
  await page.getByText(/۱ فایل نامعتبر پذیرفته نشد/).waitFor();
  await page.getByRole("button", { name: "بررسی تصویر photo.png" }).waitFor();
  await page.getByRole("heading", { name: "photo.png" }).waitFor();
  await page.getByText("فایل محلی همین نشست").waitFor();
  assert.equal(await page.getByRole("button", { name: /^بررسی تصویر / }).count(), 7);
  await page.getByRole("button", { name: "حذف فایل محلی از این صفحه" }).click();
  await page.getByRole("button", { name: "انصراف" }).click();
  assert.equal(await page.getByRole("button", { name: "بررسی تصویر photo.png" }).count(), 1);
  await page.getByRole("button", { name: "حذف فایل محلی از این صفحه" }).click();
  await page.getByRole("button", { name: "بله، حذف از این صفحه" }).click();
  assert.equal(await page.getByRole("button", { name: "بررسی تصویر photo.png" }).count(), 0);
  await page.getByText("هیچ داده‌ای در سرور تغییر نکرد").waitFor();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "افزودن تصویر" }).waitFor();
  await page.getByRole("heading", { name: "کتابخانه تصاویر" }).waitFor();
  assert.deepEqual(apiMutations, [], "preview must not make any write to API");
  assert.deepEqual(errors, [], "no runtime errors while filtering/uploading/removing preview images");
  await context.close();
  console.log("Seller image preview: guidance, filter, search, preview, local upload/delete, responsive UI OK");
} finally {
  if (browser) await browser.close();
  if (web?.pid) {
    try { process.kill(-web.pid, "SIGTERM"); } catch { /* server already stopped */ }
  }
}
