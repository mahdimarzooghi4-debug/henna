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
  // The right-hand "Features" section has three real destinations, not
  // disabled pseudo-checkboxes or invented eligibility/product flags.
  const featureNav = page.getByRole("navigation", { name: "ویژگی‌های حنا" });
  assert.deepEqual(await featureNav.getByRole("link").allTextContents(),
    ["کالابرگ الکترونیکی", "تخفیف‌های طلایی", "طرح‌های ویژه حنا"],
    "Three owner-approved sidebar feature labels in exact order");
  assert.deepEqual(await featureNav.getByRole("link").evaluateAll(
    links => links.map(link => link.getAttribute("href"))),
    ["/benefits#food-credit", "/#offers", "/benefits#special-plans"],
    "Feature destinations match existing first-party homepage routes");
  assert.equal(await featureNav.locator('input[type="checkbox"]').count(), 0,
    "No misleading eligibility checkboxes in the feature area");
  assert.equal(await page.locator('[aria-label="محصولات فروشگاه"] article').count(), 8,
    "Feature destinations must not misclassify the Figma demo catalog");

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

  // Latest owner decision: the sample card adds one item and opens the cart.
  // The prior mandatory detail-first experiment is superseded.
  const readDemoCart = () => page.evaluate(() => JSON.parse(
    localStorage.getItem("henna:landing-preview-cart:v1") ?? "[]"));
  await page.evaluate(() => localStorage.removeItem("henna:landing-preview-cart:v1"));
  const expectedPreviewIds = ["cheese", "yogurt", "rice", "oil", "tea", "honey", "eggs", "walnut"];
  const addButtons = demoCards.getByTestId("preview-product-add");
  assert.deepEqual(await addButtons.evaluateAll(
    nodes => nodes.map(node => node.getAttribute("data-product-id"))),
    expectedPreviewIds, "Each catalog button is bound to its own sample product");
  assert.equal(await demoCards.locator('a[href^="/products/"]').count(), 0,
    "Sample catalog cards no longer require or link to the detail page");
  const cartUrl = base + "/buyer/cart?mode=preview";
  const cartTitle = page.getByRole("heading", { name: "اقلام سبد خرید شما" });
  const cheeseCard = demoCards.filter({ hasText: "پنیر سفید ایرانی ممتاز" });
  await cheeseCard.getByTestId("preview-product-add").click();
  await page.waitForURL(cartUrl);
  await cartTitle.waitFor();
  assert.deepEqual(await readDemoCart(), [{ productId: "cheese", quantity: 1 }],
    "Catalog add opens cart immediately and adds exactly one correct item");
  await page.getByRole("heading", { name: "پنیر سفید ایرانی ممتاز", exact: true }).waitFor();

  await page.goto(base + "/products");
  const yogurtCard = demoCards.filter({ hasText: "ماست سون همزده پرچرب" });
  await yogurtCard.getByTestId("preview-product-add").click();
  await page.waitForURL(cartUrl);
  await cartTitle.waitFor();
  assert.deepEqual(await readDemoCart(), [
    { productId: "cheese", quantity: 1 }, { productId: "yogurt", quantity: 1 },
  ], "Adding a different product preserves prior cart contents");
  await page.getByRole("heading", { name: "ماست سون همزده پرچرب", exact: true }).waitFor();

  // A repeat add increments the existing quantity, rather than replacing it.
  await page.goto(base + "/products");
  await cheeseCard.getByTestId("preview-product-add").click();
  await page.waitForURL(cartUrl);
  await cartTitle.waitFor();
  const expected = [
    { productId: "cheese", quantity: 2 }, { productId: "yogurt", quantity: 1 },
  ];
  assert.deepEqual(await readDemoCart(), expected);

  // Opening the header cart never adds another item.
  await page.goto(base + "/products");
  await page.locator('header a[href="/buyer/cart?mode=preview"]').click();
  await page.waitForURL(cartUrl);
  await cartTitle.waitFor();
  assert.deepEqual(await readDemoCart(), expected);

  // Homepage add stays on the homepage; only an explicit cart click navigates.
  await page.goto(base + "/");
  assert.equal(await page.locator('#offers article a[href^="/products/"]').count(), 0,
    "Homepage recommendations do not use the sample detail page");
  const riceOffer = page.locator("#offers article").filter({ hasText: "برنج هاشمی درجه یک" });
  const homeAdd = riceOffer.getByTestId("preview-product-add");
  await homeAdd.click();
  await page.locator('header a[href="/buyer/cart?mode=preview"] span').filter({ hasText: /^۴$/ }).waitFor();
  assert.equal(await riceOffer.getByRole("status").count(), 0,
    "Successful homepage add must not display a confirmation message");
  assert.equal(new URL(page.url()).pathname, "/", "Homepage add must not navigate");
  assert.equal(await homeAdd.isEnabled(), true, "Shopping can continue after add");
  const withRice = [...expected, { productId: "rice", quantity: 1 }];
  assert.deepEqual(await readDemoCart(), withRice, "Homepage adds the exact chosen item");
  const homeCartLink = page.locator('header a[href="/buyer/cart?mode=preview"]');
  await homeCartLink.locator("span").filter({ hasText: /^۴$/ }).waitFor();
  await homeCartLink.click();
  await page.waitForURL(cartUrl);
  await cartTitle.waitFor();
  assert.deepEqual(await readDemoCart(), withRice, "Opening the cart does not add another item");
  await page.getByRole("heading", { name: "برنج هاشمی درجه یک", exact: true }).waitFor();

  // Figma 227:1368 — Basket layout on the existing dynamic sample cart.
  // The sample frame's two item titles/prices are not inserted into storage.
  const basket = page.getByTestId("preview-cart-page");
  const cartRows = basket.getByTestId("preview-cart-item");
  const cartNav = page.getByTestId("marketplace-category-nav");
  assert.deepEqual(await cartNav.getByRole("link").allTextContents(), [
    "همه دسته‌ها", "طرح‌های ویژه حنا", "کالابرگ الکترونیکی", "تخفیف‌های طلایی",
  ], "Basket uses the approved four-link navigation");
  assert.deepEqual(await cartNav.getByRole("link").evaluateAll(
    links => links.map(link => link.getAttribute("href"))),
    ["/products", "/benefits#special-plans", "/benefits#food-credit", "/#offers"]);
  assert.equal(await page.getByTestId("marketplace-announcement").count(), 0,
    "Basket reference has no catalog announcement strip");
  assert.equal(await page.getByRole("link", { name: "ثبت‌نام فروشگاه‌ها", exact: true }).getAttribute("href"),
    "/seller/register");
  const comparison = basket.getByRole("link", { name: "مشاهده مقایسه فروشگاه‌ها", exact: true });
  assert.equal(await comparison.getAttribute("href"), "/buyer/compare?mode=preview");
  assert.equal(await cartRows.count(), 3);
  await basket.getByText("این سبد نمونه‌ی نمایشی است؛ مبلغ‌ها تقریبی‌اند و سفارش واقعی ثبت نمی‌شود.").waitFor();
  assert.equal(await page.getByTestId("marketplace-footer").locator('a[href="/social#instagram"] svg').count(), 1,
    "Basket keeps its social destination with the corrected vector icon");
  for (const width of [1440, 1650, 1150, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const g = await page.evaluate(() => {
      const rect = el => {
        const { x, y, width, height, right, bottom } = el.getBoundingClientRect();
        return { x, y, width, height, right, bottom };
      };
      const layout = document.querySelector('[data-testid="preview-cart-layout"]');
      const items = layout.querySelector("section");
      const summary = layout.querySelector("aside");
      const row = items.querySelector("li");
      const price = row.querySelector('strong[title="قیمت هر واحد"]');
      const remove = row.querySelector('button[class*="remove"]');
      const img = row.querySelector("img");
      return {
        layout:rect(layout),items:rect(items),summary:rect(summary),row:rect(row),
        price:rect(price),remove:rect(remove),img:rect(img),
        header:rect(document.querySelector('[data-testid="marketplace-header-top"]')),
        nav:rect(document.querySelector('[data-testid="marketplace-category-nav"]')),
        footer:rect(document.querySelector('[data-testid="marketplace-footer-top"]')),
        scrollWidth:document.documentElement.scrollWidth,
        clientWidth:document.documentElement.clientWidth,
        background:getComputedStyle(document.querySelector('[data-testid="preview-cart-page"]')).backgroundColor,
      };
    });
    near(g.layout.x,g.header.x,"Basket content aligns with header at "+width);
    near(g.layout.right,g.header.right,"Basket content right edge at "+width);
    near(g.footer.x,g.layout.x,"Basket footer aligns at "+width);
    near(g.footer.right,g.layout.right,"Basket footer right edge at "+width);
    assert.equal(g.background,"rgb(250, 248, 245)");
    assert.ok(g.scrollWidth <= g.clientWidth + 1, "Basket must not overflow at "+width);
    if (width >= 1440) {
      near(g.layout.width,1280,"Basket Figma 1280px canvas");
      near(g.summary.width,400,"Basket 400px summary");
      near(g.items.x-g.summary.right,32,"Basket columns gap");
      near(g.summary.y,g.items.y,"Basket column top alignment");
      near(g.row.height,122,"Basket row min height");
      near(g.img.width,80,"Basket product image width");
      near(g.img.height,80,"Basket product image height");
      assert.ok(g.price.x > g.remove.x, "RTL price is next to quantity, remove at left");
      assert.ok(g.img.x > g.price.x, "Product image remains on right");
    }
    if (width === 390) {
      assert.ok(g.summary.y >= g.items.bottom, "Mobile summary follows cart items");
      assert.ok(g.img.width <= 64 && g.img.height <= 64, "Mobile thumbnail fits card");
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const img of await cartRows.locator("img").all()) {
    await img.scrollIntoViewIfNeeded();
    assert.equal(await img.evaluate(async el => { try { await el.decode(); return el.naturalWidth > 0; } catch { return false; } }), true,
      "Each basket thumbnail must be a loaded local product image");
  }
  // Quantity editing and deletion are still functional after the layout change.
  const yogurtRow = cartRows.filter({ hasText: "ماست سون همزده پرچرب" });
  await yogurtRow.getByRole("button", { name: "افزایش تعداد ماست سون همزده پرچرب" }).click();
  assert.deepEqual(await readDemoCart(), withRice.map(item =>
    item.productId === "yogurt" ? { ...item, quantity: 2 } : item));
  await yogurtRow.getByRole("button", { name: "کاهش تعداد ماست سون همزده پرچرب" }).click();
  assert.deepEqual(await readDemoCart(), withRice);
  await cartRows.filter({ hasText: "برنج هاشمی درجه یک" }).getByRole("button", { name: "حذف کالا ×" }).click();
  assert.deepEqual(await readDemoCart(), expected);
  assert.equal(await cartRows.count(), 2);

  // Figma 227:1487 — seller comparison uses the basket chrome/canvas.
  // Current sample basket data is retained; no real seller quote is introduced.
  await comparison.click();
  await page.waitForURL(base + "/buyer/compare?mode=preview");
  const comparePage = page.getByTestId("preview-comparison-page");
  const sellerCards = comparePage.getByTestId("preview-seller-card");
  await sellerCards.first().waitFor();
  assert.equal(await sellerCards.count(), 3);
  assert.deepEqual(await page.getByTestId("marketplace-category-nav").getByRole("link").allTextContents(),
    ["همه دسته‌ها", "طرح‌های ویژه حنا", "کالابرگ الکترونیکی", "تخفیف‌های طلایی"]);
  assert.equal(await page.getByTestId("marketplace-announcement").count(), 0);
  assert.equal(await page.getByTestId("marketplace-footer").locator('a[href="/social#instagram"] svg').count(), 1);
  await comparePage.getByText("فروشگاه‌ها و قیمت‌های این صفحه نمونه‌ی نمایشی فیگما هستند و سفارش واقعی ثبت نمی‌کنند.").waitFor();
  const sortGroup = comparePage.getByRole("group", { name: "مرتب‌سازی فروشگاه‌ها" });
  const order = () => sellerCards.evaluateAll(nodes => nodes.map(node => node.getAttribute("data-seller-id")));
  assert.deepEqual(await sortGroup.getByRole("button").allTextContents(),
    ["ارزان‌ترین سبد", "کامل‌ترین سبد", "نزدیک‌ترین", "زمان تحویل"]);
  assert.equal(await sortGroup.getByRole("button", { name: "زمان تحویل" }).isDisabled(), true);
  assert.deepEqual(await order(), ["store-3", "store-1", "store-2"]);
  await sellerCards.first().getByText("۲ کالا ناموجود", { exact: true }).waitFor();
  assert.match(await sellerCards.first().getByTestId("preview-seller-availability").textContent(), /۱ از ۳/);
  await sortGroup.getByRole("button", { name: "کامل‌ترین سبد" }).click();
  assert.deepEqual(await order(), ["store-1", "store-2", "store-3"]);
  await sortGroup.getByRole("button", { name: "نزدیک‌ترین" }).click();
  assert.deepEqual(await order(), ["store-2", "store-1", "store-3"]);
  assert.match(await sellerCards.first().getByTestId("preview-seller-availability").textContent(), /نزدیک‌ترین/);
  await sortGroup.getByRole("button", { name: "ارزان‌ترین سبد" }).click();
  assert.deepEqual(await order(), ["store-3", "store-1", "store-2"]);

  for (const width of [1440, 1650, 1150, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const g = await page.evaluate(() => {
      const rect = el => {
        const { x,y,width,height,right,bottom } = el.getBoundingClientRect();
        return {x,y,width,height,right,bottom};
      };
      const main = document.querySelector('[data-testid="preview-comparison-page"]');
      const content = document.querySelector('[data-testid="preview-comparison-content"]');
      const card = main.querySelector('[data-testid="preview-seller-card"]');
      const filters = main.querySelector('[role="group"]');
      return {
        content:rect(content),card:rect(card),filters:rect(filters),firstFilter:rect(filters.querySelector("button")),
        filterDirection:getComputedStyle(filters).direction,filterButtons:Array.from(filters.querySelectorAll("button"),rect),filterPaddingRight:parseFloat(getComputedStyle(filters).paddingRight),filterBorderRight:parseFloat(getComputedStyle(filters).borderRightWidth),
        identity:rect(card.querySelector('[data-testid="preview-seller-identity"]')),
        availability:rect(card.querySelector('[data-testid="preview-seller-availability"]')),
        price:rect(card.querySelector('[data-testid="preview-seller-price"]')),
        action:rect(card.querySelector('[data-testid="preview-seller-action"]')),
        header:rect(document.querySelector('[data-testid="marketplace-header-top"]')),
        footer:rect(document.querySelector('[data-testid="marketplace-footer-top"]')),
        scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,
        background:getComputedStyle(main).backgroundColor,
      };
    });
    near(g.content.x,g.header.x,"Comparison header alignment at "+width);
    near(g.content.right,g.header.right,"Comparison right edge at "+width);
    near(g.footer.x,g.content.x,"Comparison footer alignment at "+width);
    near(g.card.width,g.content.width,"Comparison full-width card at "+width);
    assert.equal(g.background,"rgb(250, 248, 245)");
    assert.ok(g.scrollWidth <= g.clientWidth+1,"Comparison no horizontal overflow at "+width);
    assert.equal(g.filterDirection,"rtl","Comparison sorting direction at "+width);
    near(g.filters.right-g.firstFilter.right,g.filterPaddingRight+g.filterBorderRight,"First sort tab starts at right edge at "+width);
    for(let i=1;i<g.filterButtons.length;i++){
      const prev=g.filterButtons[i-1],curr=g.filterButtons[i];
      if(Math.abs(curr.y-prev.y)<2)assert.ok(curr.right<=prev.x,"Sort tabs run right to left at "+width);
      else assert.ok(curr.y>prev.y,"Wrapped sort tabs keep row order at "+width);
    }
    if (width>=1440) {
      near(g.content.width,1280,"Comparison Figma canvas");
      near(g.availability.width,220,"Comparison availability width");
      near(g.price.width,240,"Comparison price width");
      near(g.action.width,254,"Comparison action width");
      near(g.identity.x-g.availability.right,24,"Comparison column gap");
      assert.ok(g.identity.x>g.availability.x && g.availability.x>g.price.x && g.price.x>g.action.x,
        "Figma RTL four-column order");
      near(g.filters.right-g.firstFilter.right,17,"Right-aligned comparison sorting");
    }
    if(width===390) assert.ok(g.action.y>g.price.y,"Comparison action follows price on mobile");
  }
  await page.setViewportSize({width:1440,height:900});
  const continueCompare = comparePage.getByRole("link", {name:"ادامه به بازبینی سبد"});
  assert.equal(await continueCompare.count(),0,"No automatic selection");
  await sellerCards.filter({hasText:"فروشگاه نمونه ۱"}).getByRole("button",{name:"انتخاب این فروشگاه"}).click();
  await comparePage.getByRole("status").filter({hasText:"فروشگاه نمونه انتخاب شد."}).waitFor();
  assert.equal(await continueCompare.getAttribute("href"),"/buyer/review?mode=preview");
  assert.equal(await page.evaluate(()=>localStorage.getItem("henna:figma-preview-selected-seller:v1")),"store-1");
  assert.deepEqual(await readDemoCart(),expected,"Comparing and selecting does not mutate the basket");
  // Review shares the approved cart/comparison canvas, with invoice on the left.
  await continueCompare.click();
  await page.waitForURL(base + "/buyer/review?mode=preview");
  const review = page.getByTestId("preview-review-page");
  const reviewLayout = review.getByTestId("preview-review-layout");
  await reviewLayout.waitFor();
  await review.getByText("فروشگاه نمونه ۱ (محله رسالت)", {exact:true}).waitFor();
  assert.equal(await review.getByTestId("preview-review-item").count(),2);
  assert.deepEqual(await readDemoCart(),expected);
  assert.deepEqual(await page.getByTestId("marketplace-category-nav").getByRole("link").allTextContents(),
    ["همه دسته‌ها","طرح‌های ویژه حنا","کالابرگ الکترونیکی","تخفیف‌های طلایی"]);
  assert.equal(await review.getByRole("link",{name:"ادامه ثبت سفارش"}).getAttribute("href"),"/buyer/checkout?mode=preview");
  await review.getByText("این بازبینی نمونهٔ نمایشی است؛ مبلغ‌ها و شرایط ارسال قطعی نیستند و سفارش واقعی ثبت نمی‌شود.").waitFor();
  for(const width of [1440,1650,1150,390]){
    await page.setViewportSize({width,height:900});
    const g=await page.evaluate(()=>{
      const rect=el=>{const {x,y,width,height,right,bottom}=el.getBoundingClientRect();return {x,y,width,height,right,bottom}};
      const layout=document.querySelector('[data-testid="preview-review-layout"]');
      return {layout:rect(layout),lines:rect(layout.querySelector("section")),summary:rect(layout.querySelector("aside")),
        header:rect(document.querySelector('[data-testid="marketplace-header-top"]')),
        nav:rect(document.querySelector('[data-testid="marketplace-category-nav"]')),
        footer:rect(document.querySelector('[data-testid="marketplace-footer-top"]')),
        scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth};
    });
    near(g.layout.x,g.header.x,"Review left edge aligns with header at "+width);
    near(g.layout.right,g.header.right,"Review right edge aligns with header at "+width);
    near(g.layout.x,g.nav.x,"Review nav alignment at "+width);
    near(g.layout.x,g.footer.x,"Review footer alignment at "+width);
    near(g.layout.right,g.footer.right,"Review footer right edge at "+width);
    assert.ok(g.scrollWidth<=g.clientWidth+1,"Review no horizontal overflow at "+width);
    if(width>=1440){
      near(g.layout.width,1280,"Review desktop canvas");
      near(g.summary.width,400,"Review invoice width");
      near(g.lines.x-g.summary.right,32,"Review column gap");
      near(g.lines.y,g.summary.y,"Review column top alignment");
    }
    if(width===390)assert.ok(g.summary.y>=g.lines.bottom,"Mobile invoice follows review items");
  }
  await page.setViewportSize({width:1440,height:900});
  // Checkout shares the same aligned canvas. Delivery choice is functional,
  // but no courier price is fabricated from the preview fixtures.
  await review.getByRole("link",{name:"ادامه ثبت سفارش"}).click();
  await page.waitForURL(base+"/buyer/checkout?mode=preview");
  const checkout=page.getByTestId("preview-checkout-page");
  const checkoutLayout=checkout.getByTestId("preview-checkout-layout");
  await checkoutLayout.waitFor();
  const invoiceOption = checkout.getByRole("checkbox", { name: "خرید حقوقی و دریافت فاکتور رسمی" });
  assert.equal(await invoiceOption.isChecked(), false);
  await invoiceOption.check();
  await checkout.getByTestId("preview-legal-company-note").waitFor();
  assert.equal(await checkout.getByPlaceholder("نام شرکت ثبت‌شده").count(), 0,
    "Checkout must not ask for already registered company information");
  await invoiceOption.uncheck();
  assert.equal(await invoiceOption.isChecked(), false);
  assert.equal(await checkout.getByTestId("preview-legal-company-note").count(), 0);
  const pickup=checkout.getByRole("radio",{name:"تحویل حضوری از فروشگاه",exact:true});
  const courier=checkout.getByRole("radio",{name:"ارسال با پیک",exact:true});
  const fee=checkout.getByTestId("preview-delivery-fee");
  const checkoutTotal=checkout.getByTestId("preview-checkout-total");
  const submitPreview=checkout.getByRole("button",{name:"ثبت سفارش",exact:true});
  assert.equal(await pickup.isChecked(),true);
  assert.equal(await fee.textContent(),"۰ تومان");
  assert.equal(await checkout.getByTestId("preview-courier-fields").count(),0);
  await checkout.getByTestId("preview-pickup-info").getByText("فروشگاه نمونه ۱ (محله رسالت)",{exact:true}).waitFor();
  const pickupTotal=await checkoutTotal.textContent();
  assert.ok(pickupTotal.includes("تومان"));
  assert.equal(await submitPreview.isEnabled(),true);
  await courier.check();
  await checkout.getByTestId("preview-courier-fields").waitFor();
  assert.equal(await fee.textContent(),"در انتظار تعیین هزینه پیک");
  assert.equal(await checkoutTotal.textContent(),"پس از تعیین هزینه پیک");
  assert.equal(await submitPreview.isDisabled(),true);
  assert.equal(await checkout.getByTestId("preview-pickup-info").count(),0);
  await checkout.getByRole("button",{name:"تغییر موقعیت روی نقشه"}).waitFor();
  assert.deepEqual(await readDemoCart(),expected,"Delivery selection does not mutate the cart");
  assert.deepEqual(await page.getByTestId("marketplace-category-nav").getByRole("link").allTextContents(),
    ["همه دسته‌ها","طرح‌های ویژه حنا","کالابرگ الکترونیکی","تخفیف‌های طلایی"]);
  for(const width of [1440,1650,1150,390]){
    await page.setViewportSize({width,height:900});
    const g=await page.evaluate(()=>{
      const rect=el=>{const {x,y,width,height,right,bottom}=el.getBoundingClientRect();return {x,y,width,height,right,bottom}};
      const layout=document.querySelector('[data-testid="preview-checkout-layout"]');
      return {layout:rect(layout),fields:rect(layout.querySelector('[data-testid="preview-checkout-fields"]')),
        summary:rect(layout.querySelector('[data-testid="preview-checkout-summary"]')),
        header:rect(document.querySelector('[data-testid="marketplace-header-top"]')),
        footer:rect(document.querySelector('[data-testid="marketplace-footer-top"]')),
        scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth};
    });
    near(g.layout.x,g.header.x,"Checkout header alignment at "+width);
    near(g.layout.right,g.header.right,"Checkout right edge at "+width);
    near(g.footer.x,g.layout.x,"Checkout footer alignment at "+width);
    near(g.footer.right,g.layout.right,"Checkout footer right edge at "+width);
    assert.ok(g.scrollWidth<=g.clientWidth+1,"Checkout no horizontal overflow at "+width);
    if(width>=1440){
      near(g.layout.width,1280,"Checkout desktop canvas");
      near(g.summary.width,400,"Checkout summary width");
      near(g.fields.x-g.summary.right,32,"Checkout column gap");
    }
    if(width===390)assert.ok(g.summary.y>=g.fields.bottom,"Mobile summary follows checkout fields");
  }
  await page.setViewportSize({width:1440,height:900});
  await pickup.check();
  assert.equal(await checkoutTotal.textContent(),pickupTotal,"Switching back to pickup restores item-only total");
  assert.equal(await fee.textContent(),"۰ تومان");
  assert.equal(await checkout.getByTestId("preview-courier-fields").count(),0);
  assert.equal(await submitPreview.isEnabled(),true);
  await submitPreview.click();
  await page.waitForURL(base+"/buyer/success?mode=preview");
  const pickupOrder=await page.evaluate(()=>JSON.parse(sessionStorage.getItem("henna:figma-preview-order:v1")));
  assert.equal(pickupOrder.deliveryMethod,"pickup");
  assert.equal(pickupOrder.deliveryFee,0);
  assert.equal(pickupOrder.address,"دریافت حضوری از فروشگاه نمونه ۱ (محله رسالت)");
  assert.deepEqual(pickupOrder.items,expected);
  assert.deepEqual(await readDemoCart(),[]);
  // Figma 227:1977: tracking uses the same canvas and the actual local
  // preview checkout snapshot, not a fictional successful live fulfillment.
  await page.getByRole("link",{name:"مشاهده جزئیات سفارش",exact:true}).click();
  await page.waitForURL(base+"/buyer/tracking?mode=preview");
  const tracking=page.getByTestId("preview-tracking-page");
  const trackingLayout=tracking.getByTestId("preview-tracking-layout");
  await trackingLayout.waitFor();
  await tracking.getByTestId("preview-tracking-seller").getByText(pickupOrder.sellerName,{exact:true}).waitFor();
  assert.equal(await tracking.getByTestId("preview-tracking-delivery").textContent(),"تحویل حضوری از فروشگاه");
  assert.equal(await tracking.getByTestId("preview-tracking-address").textContent(),pickupOrder.address);
  assert.equal(await tracking.getByTestId("preview-tracking-total").textContent(),new Intl.NumberFormat("fa-IR").format(pickupOrder.total)+" تومان");
  assert.equal(await tracking.getByTestId("preview-tracking-items").locator('[data-testid="preview-tracking-item"]').count(),pickupOrder.items.length);
  assert.equal(await tracking.getByRole("button",{name:"تماس با فروشگاه",exact:true}).isDisabled(),true);
  assert.equal(await tracking.getByTestId("preview-tracking-legal").count(),0);
  assert.deepEqual(await tracking.getByTestId("preview-tracking-stage").allTextContents(),["✓ثبت سفارش","تأیید فروشگاه","آماده‌سازی","آماده دریافت","تحویل"]);
  assert.equal(await tracking.getByTestId("preview-tracking-stage").locator('[aria-current="step"]').count(),0);
  assert.equal(await tracking.locator('[aria-current="step"]').count(),1);
  assert.equal(await tracking.getByRole("link",{name:"بازگشت به سفارش‌ها",exact:true}).getAttribute("href"),"/buyer/orders?mode=preview");
  for(const width of [1440,1650,1150,390]){
    await page.setViewportSize({width,height:900});
    const g=await page.evaluate(()=>{
      const rect=el=>{const {x,y,width,height,right,bottom}=el.getBoundingClientRect();return {x,y,width,height,right,bottom}};
      const layout=document.querySelector('[data-testid="preview-tracking-layout"]');
      return {layout:rect(layout),core:rect(layout.querySelector('[data-testid="preview-tracking-core"]')),
        sidebar:rect(layout.querySelector('[data-testid="preview-tracking-sidebar"]')),
        header:rect(document.querySelector('[data-testid="marketplace-header-top"]')),
        nav:rect(document.querySelector('[data-testid="marketplace-category-nav"]')),
        footer:rect(document.querySelector('[data-testid="marketplace-footer-top"]')),
        scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth};
    });
    near(g.layout.x,g.header.x,"Tracking header left alignment at "+width);
    near(g.layout.right,g.header.right,"Tracking header right alignment at "+width);
    near(g.layout.x,g.nav.x,"Tracking navigation alignment at "+width);
    near(g.layout.x,g.footer.x,"Tracking footer left alignment at "+width);
    near(g.layout.right,g.footer.right,"Tracking footer right alignment at "+width);
    assert.ok(g.scrollWidth<=g.clientWidth+1,"Tracking no horizontal overflow at "+width);
    if(width>=1440){
      near(g.layout.width,1280,"Tracking desktop canvas");
      near(g.sidebar.width,400,"Tracking left sidebar width");
      near(g.core.x-g.sidebar.right,32,"Tracking column gap");
      near(g.core.y,g.sidebar.y,"Tracking column top alignment");
    }
    if(width===390)assert.ok(g.sidebar.y>=g.core.bottom,"Mobile tracking sidebar follows status");
  }
  await page.setViewportSize({width:1440,height:900});
  // Legal badge follows the stored preview flag; no actual invoice is issued.
  await page.evaluate(order=>sessionStorage.setItem("henna:figma-preview-order:v1",JSON.stringify({...order,legal:true})),pickupOrder);
  await page.reload();
  await tracking.getByTestId("preview-tracking-legal").getByText("خرید حقوقی",{exact:true}).waitFor();
  assert.equal(await tracking.getByText("درخواست فاکتور رسمی",{exact:true}).count(),1);
  assert.equal(await tracking.getByText("فاکتور رسمی: به نام شرکت ثبت‌شده",{exact:true}).count(),0);
  // Missing preview orders must never show invented seller fulfillment.
  await page.evaluate(()=>sessionStorage.removeItem("henna:figma-preview-order:v1"));
  await page.reload();
  await tracking.getByTestId("preview-tracking-empty").waitFor();
  assert.equal(await tracking.getByTestId("preview-tracking-layout").count(),0);
  assert.deepEqual(await readDemoCart(),[]);
  // Restore fixture state for the remainder of the existing buyer journey.
  await page.evaluate(items=>{
    localStorage.setItem("henna:landing-preview-cart:v1",JSON.stringify(items));
    sessionStorage.removeItem("henna:figma-preview-order:v1");
  },expected);
  await page.goto(base+"/buyer/review?mode=preview");
  await reviewLayout.waitFor();
  await review.getByRole("link",{name:"بازگشت به مقایسه فروشگاه‌ها",exact:true}).click();
  await page.waitForURL(base+"/buyer/compare?mode=preview");
  await sellerCards.first().waitFor();
  await comparePage.getByRole("link",{name:"بازگشت به سبد خرید"}).click();
  await page.waitForURL(cartUrl);
  await cartTitle.waitFor();
  assert.deepEqual(await readDemoCart(),expected);
  await page.evaluate(()=>localStorage.removeItem("henna:figma-preview-selected-seller:v1"));

  // A failed add must not redirect or imply an item was added.
  await page.goto(base + "/products");
  await page.evaluate(() => localStorage.setItem("henna:landing-preview-cart:v1",
    JSON.stringify([{ productId: "cheese", quantity: 99 }])));
  await cheeseCard.getByTestId("preview-product-add").click();
  await cheeseCard.getByRole("status").filter({ hasText: "۹۹ عدد" }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/products");
  assert.deepEqual(await readDemoCart(), [{ productId: "cheese", quantity: 99 }]);
  await page.evaluate(items => localStorage.setItem("henna:landing-preview-cart:v1",
    JSON.stringify(items)), withRice);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === "henna:landing-preview-cart:v1") throw new Error("CI storage blocked");
      return original.call(this, key, value);
    };
  });
  await yogurtCard.getByTestId("preview-product-add").click();
  await yogurtCard.getByRole("status").filter({ hasText: "ذخیرهٔ سبد" }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/products");
  assert.deepEqual(await readDemoCart(), withRice, "Failed storage preserves the old cart");
  await page.goto(base + "/products");
  await page.evaluate(() => localStorage.removeItem("henna:landing-preview-cart:v1"));

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

  // Figma WEB / 10 Account (227:2250): preserve existing preview routes.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + "/buyer/account?mode=preview");
  const account = page.getByTestId("preview-account");
  const accountNav = account.getByRole("complementary", { name: "بخش‌های حساب کاربری" });
  const accountLegal = account.getByTestId("preview-account-legal");
  const accountSummary = account.getByTestId("preview-account-summary");
  const accountInfo = account.getByTestId("preview-account-info");
  await accountInfo.waitFor();
  const navBox = await accountNav.boundingBox();
  const legalBox = await accountLegal.boundingBox();
  const summaryBox = await accountSummary.boundingBox();
  const infoBox = await accountInfo.boundingBox();
  assert.equal(navBox.width, 320, "Account nav matches Figma width");
  assert.ok(navBox.x > legalBox.x, "Account nav is on the right");
  assert.ok(legalBox.y < summaryBox.y && summaryBox.y < infoBox.y,
    "Legal, summary and info are separate ordered cards");
  assert.equal(await accountNav.locator('[aria-current="page"]').textContent(), "اطلاعات حساب");
  const accountRows = accountNav.getByRole("link");
  assert.equal(await accountRows.locator("svg").count(), 9, "Every account tab has a chevron");
  const rowGeometry = await accountRows.evaluateAll(rows => rows.map(row => {
    const label = row.querySelector("span").getBoundingClientRect();
    const arrow = row.querySelector("svg");
    const rect = arrow.getBoundingClientRect();
    return { left: rect.right <= label.left, path: arrow.querySelector("path").getAttribute("d"),
      transform: getComputedStyle(arrow).transform };
  }));
  assert.ok(rowGeometry.every(row => row.left && row.path === "M10 3.5 5.5 8 10 12.5" && row.transform === "none"),
    "RTL account arrows sit left of labels and point left without mirroring");
  assert.equal(await accountInfo.locator("dl > div").count(), 3);
  const fieldBoxes = await accountInfo.locator("dl > div").evaluateAll(nodes =>
    nodes.map(node => ({ x: node.offsetLeft, y: node.offsetTop, width: node.offsetWidth })));
  assert.ok(fieldBoxes[0].width > fieldBoxes[1].width);
  assert.equal(fieldBoxes[1].y, fieldBoxes[2].y);
  assert.equal(await accountInfo.getByRole("link", { name: "ویرایش اطلاعات حساب" }).getAttribute("href"), "/buyer/profile?mode=preview");
  await accountLegal.getByText("اطلاعات شرکت نمونه ثبت شده است", { exact: true }).waitFor();
  assert.equal(await accountLegal.getByRole("checkbox").count(), 0,
    "Invoice opt-in belongs to the order, not account company data");
  await accountLegal.getByRole("button", { name: "مشاهده اطلاعات" }).click();
  await accountLegal.getByRole("status").waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
    "Account layout must not overflow mobile viewport");

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
