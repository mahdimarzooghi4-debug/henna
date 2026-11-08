/**
 * Real Next.js + Chromium layout regression for buyer Figma frame 190:4.
 * Frame 1440px: content starts at x=80 and ends at x=1360 (1280px wide).
 * No API fixtures, fake purchase data, or changes to other Figma screens.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3018";
let web, browser, logs = "";

async function start() {
  web = spawn("npm", ["run", "start", "--workspace",
    "@hana/web-marketplace", "--", "-p", "3018", "-H", "127.0.0.1"],
  { detached: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } });
  web.stdout.on("data", b => { logs += b.toString(); });
  web.stderr.on("data", b => { logs += b.toString(); });
  for (let i=0;i<45;i++) {
    if (web.exitCode !== null) throw Error("Next exited: " + logs);
    try {
      if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok) return;
    } catch { /* waiting for a real server */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw Error("Next never started: " + logs);
}
function near(actual, expected, label, tolerance=1.5) {
  assert.ok(Math.abs(actual-expected)<=tolerance,
    label + ": actual=" + actual + " expected=" + expected);
}
async function snapshot(page) {
  return page.evaluate(() => {
    const selectors = {
      header: "header > div",
      navigation: 'nav[aria-label="دسته‌بندی اصلی"]',
      hero: 'section[aria-labelledby="home-title"]',
      promos: 'section[aria-labelledby="home-title"] + div',
      categories: "#categories",
      offers: "#offers",
    };
    const boxes = {};
    for (const [name,selector] of Object.entries(selectors)) {
      const element = document.querySelector(selector);
      if (!element) throw new Error("Missing " + selector);
      const { left, width, right } = element.getBoundingClientRect();
      boxes[name] = { left, width, right };
    }
    return {
      boxes,
      viewport: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
    };
  });
}
async function main() {
  await start();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "fa-IR",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  for (const width of [1440, 1650, 1100, 900, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + "/", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { level: 1 }).waitFor();
    const result = await snapshot(page);
    const reference = result.boxes.hero;
    const gutter = Math.min(80, Math.max(16, width * 80 / 1440));
    const expectedWidth = Math.min(1280, width - 2*gutter);
    near(reference.width, expectedWidth, "Hero width at " + width);
    near(reference.left, (width-expectedWidth)/2, "Hero left edge at " + width);
    for (const name of ["header","navigation","promos","categories","offers"]) {
      near(result.boxes[name].left,reference.left,name+" left edge at "+width);
      near(result.boxes[name].right,reference.right,name+" right edge at "+width);
    }
    assert.ok(result.documentWidth<=result.documentClientWidth+1,
      "Unexpected page-wide horizontal overflow at "+width+
      ": document="+result.documentWidth+", viewport="+result.documentClientWidth);
  }
  assert.deepEqual(errors, []);
  await context.close();
  console.log("Figma 190:4 buyer header/nav/hero/categories: 1440,1650,1100,900,390 Chromium alignment OK");
}
try { await main(); }
finally {
  if (browser) await browser.close();
  if (web?.pid) {
    try { process.kill(-web.pid, "SIGTERM"); } catch { /* stopped */ }
  }
}
