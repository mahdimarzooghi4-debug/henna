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
    const navigation = document.querySelector('nav[aria-label="دسته‌بندی اصلی"]');
    if (!navigation) throw new Error("Buyer category navigation missing");
    const navigationScroll = {
      clientHeight: navigation.clientHeight,
      scrollHeight: navigation.scrollHeight,
      clientWidth: navigation.clientWidth,
      scrollWidth: navigation.scrollWidth,
      overflowY: getComputedStyle(navigation).overflowY,
    };
    const offerCards = [...document.querySelectorAll("#offers article")];
    const visibleOfferCards = offerCards.filter(card => {
      const rect = card.getBoundingClientRect();
      return getComputedStyle(card).display !== "none" && rect.width > 0 && rect.height > 0;
    });
    const offersGrid = offerCards[0]?.parentElement;
    if (!offersGrid) throw new Error("Today's suggestions grid missing");
    const offersGridColumns = getComputedStyle(offersGrid).gridTemplateColumns.trim().split(/\s+/).length;
    const impactStats = [...document.querySelectorAll("#impact strong")].map(number => {
      const item = number.parentElement;
      if (!item) throw new Error("Impact statistic has no parent");
      return {
        value: number.textContent.trim(),
        label: number.nextElementSibling?.textContent.trim(),
        left: item.getBoundingClientRect().left,
        borderRightWidth: getComputedStyle(item).borderRightWidth,
        borderLeftWidth: getComputedStyle(item).borderLeftWidth,
      };
    });
    return {
      boxes,
      navigationScroll,
      impactStats,
      offers: { count: offerCards.length, visibleCount: visibleOfferCards.length, columns: offersGridColumns },
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
    // Reproduces the owner's Chrome screenshot: the category bar must never
    // show a vertical scrollbar beside "همه دسته‌ها".
    assert.equal(result.navigationScroll.overflowY,"hidden",
      "Vertical nav scrolling must be disabled at "+width);
    assert.ok(result.navigationScroll.scrollHeight<=result.navigationScroll.clientHeight+1,
      "Category labels must fit nav height at "+width+
      ": content="+result.navigationScroll.scrollHeight+
      ", viewport="+result.navigationScroll.clientHeight);
    if(width===390){
      assert.ok(result.navigationScroll.scrollWidth>result.navigationScroll.clientWidth+10,
        "Mobile category links must remain horizontally scrollable");
    }
    // Owner-requested social-impact statistic order and no vertical dividers.
    assert.deepEqual(result.impactStats.map(s => [s.value, s.label]), [
      ["۳,۴۰۰+", "فروشگاه محلی فعال"],
      ["۱۲,۸۰۰+", "خانواده تحت پوشش حمایتی"],
    ], "Impact statistics must preserve number-label pairings at "+width);
    assert.ok(result.impactStats[0].left > result.impactStats[1].left,
      "Store count must appear to the right of family count at "+width);
    for (const stat of result.impactStats) {
      assert.equal(stat.borderRightWidth, "0px",
        "No right-hand divider on impact statistic "+stat.value+" at "+width);
      assert.equal(stat.borderLeftWidth, "0px",
        "No left-hand divider on impact statistic "+stat.value+" at "+width);
    }
    assert.equal(result.offers.count,5,
      "Figma 190:4 Today's Suggestions must contain exactly five cards at "+width);
    assert.equal(result.offers.visibleCount,5,
      "All five Figma suggestion cards must remain visible at "+width);
    const expectedOfferColumns = width > 1000 ? 5 : width > 640 ? 3 : 2;
    assert.equal(result.offers.columns,expectedOfferColumns,
      "Today's Suggestions responsive grid columns at "+width);
  }
  // Figma 227:1085 (WEB / 01 Products) is a full catalog page,
  // not a mid-page anchor. Both homepage links must open it from the top.
  await context.route("**/api/catalog/**", route => route.fulfill({
    status: 503, contentType: "application/json; charset=utf-8",
    body: JSON.stringify({ message: "catalog offline in this browser test" }),
  }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + "/");
  // Owner-approved homepage-only simplification; product catalog chrome is separate.
  const homeNav = page.getByRole("navigation", { name: "دسته‌بندی اصلی" });
  assert.deepEqual(await homeNav.getByRole("link").allTextContents(), [
    "تخفیف‌های طلایی", "کالابرگ الکترونیکی",
    "طرح‌های ویژه حنا", "همه دسته‌ها",
  ], "Only four approved homepage links remain");
  assert.equal(await page.getByRole("link", {
    name: "ثبت‌نام فروشگاه‌ها", exact: true,
  }).count(), 1, "The header uses the approved short signup label");
  assert.equal(await page.getByRole("link", {
    name: "ثبت‌نام فروشگاه‌ها", exact: true,
  }).getAttribute("href"), "/seller/register",
    "Seller signup destination must remain unchanged");
  for (const removed of [
    "نیازمندی‌های محلی", "فروشندگان و ارائه‌دهندگان", "کالاها و خدمات",
  ]) {
    assert.equal(await homeNav.getByRole("link", { name: removed, exact: true }).count(),
      0, removed + " must not appear in homepage navigation");
  }
  const allCategoriesNav = page.getByRole("navigation", {
    name: "دسته‌بندی اصلی",
  }).getByRole("link", { name: "همه دسته‌ها", exact: true });
  assert.equal(await allCategoriesNav.getAttribute("href"), "/products");
  assert.equal(await page.getByRole("link", {
    name: "مشاهده همه دسته‌ها", exact: true,
  }).getAttribute("href"), "/products");
  await allCategoriesNav.click();
  await page.waitForURL(base + "/products");
  assert.equal(new URL(page.url()).hash, "",
    "Catalog should open at the top, not scroll to a filter anchor");
  await page.getByRole("heading", { name: "فیلترها" }).waitFor();
  await page.getByText("مرتب‌سازی براساس:").waitFor();
  await page.locator('[aria-label="محصولات فروشگاه"]').waitFor();
  assert.equal(await page.locator('[aria-label="محصولات فروشگاه"] article').count(), 8,
    "Figma 227:1085 preview shows eight clearly separated sample cards");
  // Owner's toolbar: four controls only; no left category chips.
  // These demo cards have display prices. Published catalog records do not,
  // so price sorting cannot claim a real offer or verified eligibility.
  const demoCards = page.locator('[aria-label="محصولات فروشگاه"] article');
  const sortBar = page.getByTestId("products-filter-toolbar");
  assert.deepEqual(await sortBar.getByRole("button").allTextContents(),
    ["ارزان‌ترین", "گران‌ترین", "تخفیف‌دارها", "کالابرگ"]);
  assert.equal(await sortBar.getByRole("button", { name: "کالابرگ" }).isDisabled(),
    true, "No verified benefit eligibility means no active kalabarg filter");
  for (const removed of ["همه", "لبنیات محلی", "روغن و خواربار"]) {
    assert.equal(await sortBar.getByRole("button", { name: removed, exact: true }).count(),
      0, "Removed left-side toolbar chip: " + removed);
  }

  await sortBar.getByRole("button", { name: "ارزان‌ترین" }).click();
  assert.equal(await demoCards.first().locator("h3").textContent(),
    "ماست سون همزده پرچرب", "Cheapest Figma demo item first");
  assert.equal(await demoCards.last().locator("h3").textContent(),
    "برنج هاشمی درجه یک", "Most expensive Figma demo item last");

  await sortBar.getByRole("button", { name: "گران‌ترین" }).click();
  assert.equal(await demoCards.first().locator("h3").textContent(),
    "برنج هاشمی درجه یک", "Descending Figma demo price order");
  await sortBar.getByRole("button", { name: "تخفیف‌دارها" }).click();
  assert.equal(await demoCards.count(), 5, "Only five demo items have reduced display prices");
  assert.equal(await demoCards.locator("del").count(), 5,
    "Discounted demo products must have a displayed previous price");
  await sortBar.getByRole("button", { name: "تخفیف‌دارها" }).click();
  assert.equal(await demoCards.count(), 8, "Re-selecting a sort restores default display");

  const previewCategories = page.locator('[aria-label="فیلتر محصولات نمایشی"]');
  await previewCategories.getByRole("button", { name: "لبنیات محلی", exact: true }).click();
  assert.equal(await demoCards.count(), 4, "Right sidebar dairy filter still works");
  await sortBar.getByRole("button", { name: "ارزان‌ترین" }).click();
  assert.equal(await demoCards.first().locator("h3").textContent(),
    "ماست سون همزده پرچرب", "Price order and sidebar category intersect");
  await sortBar.getByRole("button", { name: "ارزان‌ترین" }).click();
  await previewCategories.getByRole("button", { name: "روغن و خواربار", exact: true }).click();
  assert.equal(await demoCards.count(), 2, "Right sidebar pantry filter still works");
  await previewCategories.getByRole("button", { name: "عسل و خشکبار", exact: true }).click();
  assert.equal(await demoCards.count(), 2, "Right sidebar honey filter still works");
  await previewCategories.getByRole("button", { name: "همه محصولات نمایشی", exact: true }).click();
  assert.equal(await demoCards.count(), 8, "Right sidebar restores all demo products");
  assert.equal(new URL(page.url()).searchParams.has("categoryId"), false,
    "Demo filters and sorting must not invent a published catalog category ID");

  assert.equal(await page.getByRole("navigation", {
    name: "دسته‌بندی اصلی",
  }).getByRole("link", { name: "همه دسته‌ها", exact: true })
    .getAttribute("href"), "/products");

  // An unpublished homepage category never masquerades as a real catalog
  // filter. Show a clear, same-origin way to reach the Figma overview.
  await page.goto(base + "/");
  const bakery = page.locator("#categories").getByRole("link", {
    name: "نان و شیرینی", exact: true,
  });
  assert.ok((await bakery.getAttribute("href"))?.startsWith(
    "/products?categoryName="));
  assert.ok(!(await bakery.getAttribute("href")).includes("#"));
  await bakery.click();
  await page.waitForURL(url => url.pathname === "/products" &&
    url.searchParams.has("categoryName"));
  assert.equal(new URL(page.url()).hash, "");
  await page.getByText(
    "برای جلوگیری از نمایش دستهٔ اشتباه، کالاها بارگذاری نشدند.",
  ).waitFor();
  await page.getByRole("link", {
    name: "مشاهده صفحه همه کالاها و خدمات", exact: true,
  }).click();
  await page.waitForURL(base + "/products");
  await page.locator('[aria-label="محصولات فروشگاه"]').waitFor();

  // Figma 227:1085 desktop chrome geometry: 40px announcement,
  // 90px main header and 61px category navigation on a 1440px canvas.
  const announcement = await page.getByTestId("marketplace-announcement").boundingBox();
  const headerTop = await page.getByTestId("marketplace-header-top").boundingBox();
  const categoryNav = await page.getByTestId("marketplace-category-nav").boundingBox();
  assert.equal(announcement?.height, 40, "Figma top banner height");
  assert.equal(headerTop?.height, 90, "Figma main header height");
  assert.equal(categoryNav?.height, 61, "Figma category navigation height");
  assert.equal(headerTop?.width, 1280, "Figma header content width");
  assert.equal(categoryNav?.width, 1280, "Figma navigation content width");
  // Owner's approved four-item menu is identical to homepage in name/route.
  const productNav = page.getByTestId("marketplace-category-nav");
  const navLabels = [
    "همه دسته‌ها", "طرح‌های ویژه حنا",
    "کالابرگ الکترونیکی", "تخفیف‌های طلایی",
  ];
  const navHrefs = [
    "/products", "/benefits#special-plans", "/benefits#food-credit", "/#offers",
  ];
  assert.deepEqual(await productNav.getByRole("link").allTextContents(), navLabels,
    "Product categories must contain only the four approved homepage links");
  assert.deepEqual(await productNav.getByRole("link").evaluateAll(
    links => links.map(link => link.getAttribute("href"))), navHrefs,
    "Product category links must match homepage destinations");
  for (const removed of [
    "نیازهای روزمره", "فروشندگان / ارائه‌دهندگان", "فروشندگان",
    "کالاها و خدمات", "دسته‌بندی‌های منتخب", "پیشنهادها",
  ]) {
    assert.equal(await productNav.getByRole("link", { name: removed, exact: true }).count(),
      0, removed + " must not appear in product navigation");
  }

  const footer = page.getByTestId("marketplace-footer");
  await footer.scrollIntoViewIfNeeded();
  await footer.getByText("طرح‌های حمایتی", { exact: true }).waitFor();
  await footer.getByText("همکاری با حنا", { exact: true }).waitFor();
  await footer.getByText("دسترسی سریع", { exact: true }).waitFor();
  assert.equal(await footer.locator('[class*="footerColumn"]').count(), 3,
    "Figma footer has three link columns");
  assert.equal(await footer.locator('[class*="footerColumn"] a').count(), 12,
    "Figma footer has four links in each of three columns");
  assert.equal(await footer.locator('[class*="socialMedia"] span').count(), 3,
    "Footer social icon group retains three slots");
  const socialIcons = footer.locator('[class*="socialMedia"] span');
  assert.deepEqual(await socialIcons.evaluateAll(
    nodes => nodes.map(node => node.getAttribute("aria-label"))),
    ["اینستاگرام", "توییتر", "لینکدین"],
    "All three footer vector icons have accessible Persian names");
  assert.equal(await socialIcons.locator("svg").count(), 3,
    "Footer icons must be vector SVG, never platform-dependent text glyphs");
  assert.equal(await socialIcons.first().locator("svg rect").count(), 1,
    "Instagram icon contains a rounded camera frame");
  assert.equal(await socialIcons.first().locator("svg circle").count(), 2,
    "Instagram icon contains a lens and flash dot");
  const svgSizes = await socialIcons.locator("svg").evaluateAll(nodes =>
    nodes.map(node => ({
      width: Math.round(node.getBoundingClientRect().width),
      height: Math.round(node.getBoundingClientRect().height),
    })));
  assert.deepEqual(svgSizes, Array(3).fill({ width: 20, height: 20 }),
    "Footer social icons render at a consistent 20px square");

  // The same shared chrome must remain inside the viewport on mobile.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/products", { waitUntil: "domcontentloaded" });
  await page.getByTestId("marketplace-category-nav").waitFor();
  await page.getByTestId("marketplace-footer").waitFor();
  const mobileGeometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    navScrollWidth: document.querySelector('[data-testid="marketplace-category-nav"]')?.scrollWidth ?? 0,
    navClientWidth: document.querySelector('[data-testid="marketplace-category-nav"]')?.clientWidth ?? 0,
    navOverflowX: getComputedStyle(document.querySelector('[data-testid="marketplace-category-nav"]')).overflowX,
  }));
  assert.ok(mobileGeometry.scrollWidth <= mobileGeometry.clientWidth + 1,
    "Marketplace chrome must not create page-wide horizontal overflow on mobile");
  assert.equal(mobileGeometry.navOverflowX, "auto",
    "Mobile navigation allows scrolling if four links exceed the viewport");
  assert.ok(mobileGeometry.navScrollWidth >= mobileGeometry.navClientWidth,
    "Mobile navigation has no clipped, inaccessible category links");

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
