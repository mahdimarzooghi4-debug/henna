import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3026";
const route = "/buyer/tracking?mode=preview";
const expectedNav = [
  "پیشنهادها",
  "کالابرگ / اعتبارها",
  "طرح‌های ویژه",
  "دسته‌بندی‌های منتخب",
  "همه دسته‌ها",
  "کالاها و خدمات",
  "فروشندگان / ارائه‌دهندگان",
  "نیازهای روزمره",
];
const announcement = "بازارگاه حنا؛ کالاها و خدمات در یک تجربه یکپارچه";
let web;
let browser;
let logs = "";

function near(actual, expected, label, tolerance = 2) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    label + ": actual=" + actual + " expected=" + expected,
  );
}

async function start() {
  web = spawn(
    "npm",
    ["run", "start", "--workspace", "@hana/web-marketplace", "--", "-p", "3026", "-H", "127.0.0.1"],
    {
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    },
  );
  web.stdout.on("data", (chunk) => { logs += chunk.toString(); });
  web.stderr.on("data", (chunk) => { logs += chunk.toString(); });
  for (let attempt = 0; attempt < 45; attempt += 1) {
    if (web.exitCode !== null) throw new Error("Next exited: " + logs);
    try {
      if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok) return;
    } catch {
      // Wait for the built Next server.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Next did not start: " + logs);
}

async function stop() {
  if (browser) await browser.close();
  if (web?.pid) {
    try { process.kill(-web.pid, "SIGTERM"); } catch { /* already stopped */ }
  }
}

async function main() {
  await start();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "fa-IR",
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  const failedResponses = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failedResponses.push({ status: response.status(), url: response.url() });
    }
  });

  await page.goto(base + route);
  await page.getByRole("heading", { name: "وضعیت سفارش", exact: true }).waitFor();
  assert.equal(await page.getByTestId("buyer-tracking-announcement").textContent(), announcement);
  assert.deepEqual(
    await page.getByRole("navigation", { name: "دسته‌بندی اصلی" }).getByRole("link").allTextContents(),
    expectedNav,
    "Tracking page navigation must match Figma 227:1977",
  );
  assert.equal(
    await page.getByRole("link", { name: "بازگشت به سفارش‌ها" }).getAttribute("href"),
    "/buyer/orders?mode=preview",
  );
  assert.equal(await page.getByText("فاکتور رسمی: به نام شرکت ثبت‌شده", { exact: true }).count(), 1);
  assert.equal(await page.getByText("خرید حقوقی", { exact: true }).count(), 0);
  assert.equal(await page.getByTestId("buyer-tracking-total").count(), 0);

  for (const width of [1440, 1650, 1150, 1024, 900, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(base + route);
    await page.getByRole("heading", { name: "وضعیت سفارش", exact: true }).waitFor();

    const metrics = await page.evaluate(() => {
      const rect = (selector) => {
        const element = document.querySelector(selector);
        if (!element) throw new Error("Missing " + selector);
        const box = element.getBoundingClientRect();
        return {
          left: box.left,
          right: box.right,
          top: box.top,
          bottom: box.bottom,
          width: box.width,
          height: box.height,
        };
      };
      const stages = [...document.querySelectorAll('[data-testid="buyer-tracking-stage"]')]
        .map((element) => element.getBoundingClientRect().left);
      const connectors = [...document.querySelectorAll('[data-testid="buyer-tracking-connector"]')]
        .map((element) => element.getBoundingClientRect().width);
      const nav = document.querySelector('nav[aria-label="دسته‌بندی اصلی"]');
      return {
        main: rect('[data-testid="buyer-tracking-page"]'),
        layout: rect('[data-testid="buyer-tracking-layout"]'),
        sidebar: rect('[data-testid="buyer-tracking-sidebar"]'),
        core: rect('[data-testid="buyer-tracking-core"]'),
        heading: rect('[data-testid="buyer-tracking-heading"]'),
        back: rect('[data-testid="buyer-tracking-back"]'),
        status: rect('[data-testid="buyer-tracking-status"]'),
        timeline: rect('[data-testid="buyer-tracking-timeline"]'),
        recipient: rect('[data-testid="buyer-tracking-recipient"]'),
        stages,
        connectors,
        navScrollWidth: nav.scrollWidth,
        navClientWidth: nav.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    });

    assert.ok(
      metrics.documentWidth <= metrics.clientWidth + 1,
      "Tracking page must not create document horizontal overflow at " + width,
    );

    if (width > 900) {
      assert.ok(metrics.sidebar.left < metrics.core.left, "Figma sidebar must be on the left at " + width);
      near(metrics.sidebar.left, 80, "Sidebar left edge at " + width);
      near(metrics.sidebar.width, 400, "Sidebar width at " + width);
      near(metrics.core.left - metrics.sidebar.right, 32, "Sidebar/core gap at " + width);
      assert.ok(
        metrics.stages[0] > metrics.stages[1] &&
        metrics.stages[1] > metrics.stages[2] &&
        metrics.stages[2] > metrics.stages[3] &&
        metrics.stages[3] > metrics.stages[4],
        "Timeline stages must run right-to-left at " + width,
      );
      assert.equal(metrics.connectors.length, 4);
      if (width === 1440) {
        near(metrics.main.top, 191, "Figma header height");
        near(metrics.layout.top, 231, "Figma tracking content top");
        near(metrics.core.left, 512, "Figma core left edge");
        near(metrics.core.width, 848, "Figma core width");
        near(metrics.heading.height, 42, "Figma title block height");
        near(metrics.timeline.top - metrics.core.top, 66, "Figma timeline top offset");
        near(metrics.timeline.height, 121, "Figma timeline card height");
        near(metrics.recipient.top - metrics.core.top, 211, "Figma recipient card top offset");
        near(metrics.recipient.height, 176, "Figma recipient card height");
        assert.ok(metrics.back.right < metrics.status.left, "Back link must sit left of the status header");
        for (const width of metrics.connectors) near(width, 60, "Figma timeline connector width");
      }
    } else {
      assert.ok(metrics.core.top < metrics.sidebar.top, "Core must stack above sidebar at " + width);
      if (width === 390) {
        assert.ok(metrics.navScrollWidth > metrics.navClientWidth, "Mobile header navigation must scroll horizontally");
      }
    }
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + route);
  await page.evaluate(() => {
    sessionStorage.setItem("henna:figma-preview-order:v1", JSON.stringify({
      total: 89000,
      sellerName: "فروشگاه آزمون",
      address: "نشانی آزمون",
      legal: true,
      items: [{ productId: "oil", quantity: 1 }],
    }));
  });
  await page.reload();
  await page.getByText("خرید حقوقی", { exact: true }).waitFor();
  await page.getByText("فاکتور رسمی: به نام شرکت ثبت‌شده", { exact: true }).waitFor();
  await page.getByText("فروشگاه آزمون", { exact: true }).waitFor();
  await page.getByText("نشانی آزمون", { exact: true }).waitFor();
  await page.getByText("روغن آفتابگردان خالص × ۱", { exact: true }).waitFor();
  assert.match(
    await page.getByTestId("buyer-tracking-total").textContent(),
    /۸۹.*۰۰۰ تومان/,
    "The stored preview total must remain dynamic",
  );
  assert.deepEqual(runtimeErrors, [], "Order tracking must not emit browser runtime errors");
  const applicationFailures = failedResponses.filter((response) =>
    new URL(response.url).pathname !== "/favicon.ico");
  assert.deepEqual(applicationFailures, [], "Order tracking must not return failed application resources");

  await context.close();
  await stop();
}

main().catch(async (error) => {
  console.error(error);
  console.error(logs);
  try { await stop(); } catch { /* preserve the original failure */ }
  process.exitCode = 1;
});
