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
      footerTop: '[data-testid="landing-footer-top"]',
      footerBottom: '[data-testid="landing-footer-bottom"]',
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
    for (const name of ["header","navigation","promos","categories","offers","footerTop","footerBottom"]) {
      near(result.boxes[name].left,reference.left,name+" left edge at "+width);
      near(result.boxes[name].right,reference.right,name+" right edge at "+width);
    }
    // The footer background remains full width; only its content follows
    // the approved shared header canvas (including 1650px and mobile).
    const footerFrame = await page.locator("#footer").boundingBox();
    near(footerFrame.x, 0, "Homepage footer background starts at viewport edge at "+width);
    near(footerFrame.width, width, "Homepage footer background fills viewport at "+width);
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
  // Owner request: the three carousel secondary CTAs are removed, while each
  // slide retains one real /products action and the slider controls.
  const heroActions = page.locator('section[aria-labelledby="home-title"]');
  const slideButtons = [
    ["مشاهده پیشنهادها", "شروع خرید روزانه"],
    ["طرح‌های مسئولیت اجتماعی", "خرید از کسب‌وکارهای محلی"],
    ["استعلام اعتبار یارانه", "خرید با کالابرگ"],
  ];
  for (let i=0;i<slideButtons.length;i++) {
    if(i>0) await heroActions.getByRole("button", {
      name: "رفتن به اسلاید " + (i+1),
    }).click();
    const [removed, retained] = slideButtons[i];
    assert.equal(await heroActions.getByRole("link",{name:removed,exact:true}).count(),0,
      removed+" must not appear in slide "+(i+1));
    assert.equal(await heroActions.locator("a").count(),1,
      "Each hero slide keeps exactly one shopping link");
    assert.equal(await heroActions.getByRole("link",{name:retained,exact:true}).getAttribute("href"),
      "/products","Primary shopping CTA remains functional");
  }

  // Promotional copy stays distinct; each whole card and corresponding
  // navigation filter must select its *own provenance-qualified* collection.
  // Until the backend publishes verified eligibility, show no fake matches.
  const promoCards = page.locator('section[aria-labelledby="home-title"] + div > a');
  const selectedCollections = [
    ["/products?collection=golden", "تخفیف‌های طلایی"],
    ["/products?collection=kalabarg", "کالابرگ الکترونیکی"],
    ["/products?collection=henna", "طرح‌های ویژه حنا"],
  ];
  assert.equal(await promoCards.count(),3,"Homepage has exactly three promo cards");
  assert.deepEqual(await promoCards.evaluateAll(anchors=>anchors.map(a=>a.getAttribute("href"))),
    selectedCollections.map(([route])=>route),
    "Each promotional card carries its separate real-catalog filter");
  let unverifiedProductRequests=0;
  await page.route("**/api/catalog/products?*",route=>{
    unverifiedProductRequests++;
    return route.fulfill({status:200,contentType:"application/json",
      body:JSON.stringify({items:[],page:1,pageSize:20,total:0})});
  });
  for(let i=0;i<3;i++){
    const [route,label]=selectedCollections[i];
    const card=promoCards.nth(i);
    assert.equal(await card.getByText("مشاهده کالاها و شروع خرید ←",{exact:true}).count(),1,
      "Every promo keeps the owner's common CTA text");
    await card.click();
    await page.waitForURL(base+route);
    await page.getByTestId("catalog-collection-status")
      .getByRole("heading",{name:"فیلتر فعال: "+label,exact:true}).waitFor();
    assert.equal(await page.getByTestId("marketplace-category-nav")
      .getByRole("link",{name:label,exact:true}).getAttribute("aria-current"),"page",
      "The selected catalog filter is visibly and accessibly active");
    const sourceExplanation = [
      "مغازه‌دار", "مرجع معتبر", "خود حنا",
    ][i];
    await page.getByTestId("catalog-collection-status")
      .getByText(sourceExplanation,{exact:false}).waitFor();
    assert.equal(await page.locator('[aria-label="محصولات فروشگاه"] article').count(),0,
      "Never show Figma product fixtures as promotion-eligible");
    assert.equal(await page.locator('[aria-label="فهرست کالاهای منتشرشده"] li').count(),0,
      "Do not label unverified published identities as promotion-eligible");
    await page.goto(base+"/");
  }
  assert.equal(unverifiedProductRequests,0,
    "Selected collections must not fetch ordinary unfiltered catalog products");
  await page.unroute("**/api/catalog/products?*");
  await page.goto(base+"/products?collection=unsupported");
  await page.getByTestId("catalog-collection-status")
    .getByRole("heading",{name:"فیلتر انتخاب‌شده معتبر نیست"}).waitFor();
  assert.equal(await page.locator('[aria-label="محصولات فروشگاه"] article').count(),0);
  await page.getByRole("link",{name:"نمایش همه کالاها بدون این فیلتر"}).click();
  await page.waitForURL(base+"/products");
  await page.goto(base+"/");
  const expectedHomeNavRoutes = [
    "/products?collection=golden", "/products?collection=kalabarg", "/products?collection=henna", "/products",
  ];
  assert.deepEqual(await page.getByRole("navigation",{name:"دسته‌بندی اصلی"})
    .getByRole("link").evaluateAll(links=>links.map(a=>a.getAttribute("href"))),
    expectedHomeNavRoutes,"Homepage category links open their dedicated pages");
  // Owner-approved homepage-only simplification; product catalog chrome is separate.
  const homeNav = page.getByRole("navigation", { name: "دسته‌بندی اصلی" });
  assert.deepEqual(await homeNav.getByRole("link").allTextContents(), [
    "تخفیف‌های طلایی", "کالابرگ الکترونیکی",
    "طرح‌های ویژه حنا", "همه دسته‌ها",
  ], "Only four approved homepage links remain");
  const sellerSignupLink = page.locator("header").getByRole("link", {
    name: "ثبت‌نام فروشگاه‌ها", exact: true,
  });
  assert.equal(await sellerSignupLink.count(), 1,
    "The header uses the approved short signup label");
  assert.equal(await sellerSignupLink.getAttribute("href"), "/seller/register",
    "Seller signup destination must remain unchanged");
  for (const removed of [
    "نیازمندی‌های محلی", "فروشندگان و ارائه‌دهندگان", "کالاها و خدمات",
  ]) {
    assert.equal(await homeNav.getByRole("link", { name: removed, exact: true }).count(),
      0, removed + " must not appear in homepage navigation");
  }
  // Figma WEB / 11 Auth: the shared homepage login action must reach
  // the existing auth route without requiring a working SMS provider.
  const loginLink = page.locator('header a[href="/auth"]');
  assert.equal(await loginLink.count(), 1, "Shared header login must target /auth");
  assert.equal(await page.locator('header a[href="/account/profile"]').count(), 0);
  await loginLink.click();
  await page.waitForURL(base + "/auth");
  await page.getByRole("heading", { name: "ورود یا ثبت‌نام در حنا" }).waitFor();
  await page.locator("#auth-phone").waitFor();
  await page.goto(base + "/");
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
    ["/products?collection=kalabarg", "/products?collection=golden", "/products?collection=henna"],
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

  // Catalog sample products add in place, like homepage offers. Only an explicit
  // click on the header cart navigates; no real order or payment is created.
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
  const catalogCartLink = page.locator('header a[href="/buyer/cart?mode=preview"]');
  const cheeseCard = demoCards.filter({ hasText: "پنیر سفید ایرانی ممتاز" });
  const cheeseAdd = cheeseCard.getByTestId("preview-product-add");
  await cheeseAdd.click();
  await catalogCartLink.locator("span").filter({ hasText: /^۱$/ }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/products",
    "Catalog add must not redirect to the cart");
  assert.deepEqual(await readDemoCart(), [{ productId: "cheese", quantity: 1 }],
    "Catalog adds the selected product exactly once");
  assert.equal(await cheeseAdd.isEnabled(), true, "Further catalog adds remain possible");

  const yogurtCard = demoCards.filter({ hasText: "ماست سون همزده پرچرب" });
  await yogurtCard.getByTestId("preview-product-add").click();
  await catalogCartLink.locator("span").filter({ hasText: /^۲$/ }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/products",
    "Adding another catalog item must not navigate away");
  assert.deepEqual(await readDemoCart(), [
    { productId: "cheese", quantity: 1 }, { productId: "yogurt", quantity: 1 },
  ], "Catalog preserves existing cart items");

  // Repeated clicks increase the quantity without replacing existing items.
  await cheeseAdd.click();
  await catalogCartLink.locator("span").filter({ hasText: /^۳$/ }).waitFor();
  const expected = [
    { productId: "cheese", quantity: 2 }, { productId: "yogurt", quantity: 1 },
  ];
  assert.deepEqual(await readDemoCart(), expected);
  assert.equal(new URL(page.url()).pathname, "/products");
  assert.equal(await demoCards.count(), 8, "All catalog cards remain visible after add");

  // Only an intentional click on the basket link opens the basket.
  await catalogCartLink.click();
  await page.waitForURL(cartUrl);
  await cartTitle.waitFor();
  await page.getByRole("heading", { name: "پنیر سفید ایرانی ممتاز", exact: true }).waitFor();
  await page.getByRole("heading", { name: "ماست سون همزده پرچرب", exact: true }).waitFor();
  assert.deepEqual(await readDemoCart(), expected,
    "Opening the cart does not add another item");

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
    ["/products", "/products?collection=henna", "/products?collection=kalabarg", "/products?collection=golden"]);
  assert.equal(await page.getByTestId("marketplace-announcement").count(), 0,
    "Basket reference has no catalog announcement strip");
  assert.equal(await page.getByRole("link", { name: "ثبت‌نام فروشگاه‌ها", exact: true }).getAttribute("href"),
    "/seller/register");
  const comparison = basket.getByRole("link", { name: "مشاهده مقایسه فروشگاه‌ها", exact: true });
  assert.equal(await comparison.getAttribute("href"), "/buyer/compare?mode=preview");
  assert.equal(await cartRows.count(), 3);
  await basket.getByText("این سبد نمونه‌ی نمایشی است؛ مبلغ‌ها تقریبی‌اند و سفارش واقعی ثبت نمی‌شود.").waitFor();
  assert.equal(await page.getByTestId("landing-footer-bottom").locator('a[href="/social#instagram"] svg').count(), 1,
    "Basket keeps its social destination with the corrected vector icon");
  await page.getByTestId("landing-footer-top").getByText("ارتباط با ما").waitFor();
  assert.equal(await page.getByTestId("landing-footer-top").getByRole("link",{name:"دریافت اپلیکیشن حنا"}).getAttribute("href"),"/download");
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
        footer:rect(document.querySelector('[data-testid="landing-footer-top"]')),
        scrollWidth:document.documentElement.scrollWidth,
        clientWidth:document.documentElement.clientWidth,
        background:getComputedStyle(document.querySelector('[data-testid="preview-cart-page"]')).backgroundColor,
      };
    });
    near(g.layout.x,g.header.x,"Basket content aligns with header at "+width);
    near(g.layout.right,g.header.right,"Basket content right edge at "+width);
    near(g.footer.x,width-g.footer.right,"Basket footer centered like homepage at "+width);
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
  assert.equal(await page.getByTestId("landing-footer-bottom").locator('a[href="/social#instagram"] svg').count(), 1);
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
        footer:rect(document.querySelector('[data-testid="landing-footer-top"]')),
        scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,
        background:getComputedStyle(main).backgroundColor,
      };
    });
    near(g.content.x,g.header.x,"Comparison header alignment at "+width);
    near(g.content.right,g.header.right,"Comparison right edge at "+width);
    near(g.footer.x,width-g.footer.right,"Comparison footer centered like homepage at "+width);
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
        footer:rect(document.querySelector('[data-testid="landing-footer-top"]')),
        scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth};
    });
    near(g.layout.x,g.header.x,"Review left edge aligns with header at "+width);
    near(g.layout.right,g.header.right,"Review right edge aligns with header at "+width);
    near(g.layout.x,g.nav.x,"Review nav alignment at "+width);
    near(g.footer.x,width-g.footer.right,"Review footer centered like homepage at "+width);
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
        footer:rect(document.querySelector('[data-testid="landing-footer-top"]')),
        scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth};
    });
    near(g.layout.x,g.header.x,"Checkout header alignment at "+width);
    near(g.layout.right,g.header.right,"Checkout right edge at "+width);
    near(g.footer.x,width-g.footer.right,"Checkout footer centered like homepage at "+width);
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
        footer:rect(document.querySelector('[data-testid="landing-footer-top"]')),
        scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth};
    });
    near(g.layout.x,g.header.x,"Tracking header left alignment at "+width);
    near(g.layout.right,g.header.right,"Tracking header right alignment at "+width);
    near(g.layout.x,g.nav.x,"Tracking navigation alignment at "+width);
    near(g.footer.x,width-g.footer.right,"Tracking footer centered like homepage at "+width);
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

  // Seven distinct landing-category destinations. Missing taxonomy must
  // preserve the category identity without showing unrelated sample products.
  await page.goto(base + "/");
  const categoryLinks = [
    ["نان و شیرینی", "/categories/bread-and-pastry"],
    ["کنسرو و آماده", "/categories/canned-and-ready"],
    ["بهداشتی و سلامت", "/categories/health-and-hygiene"],
    ["میوه و صیفی", "/categories/fruit-and-vegetables"],
    ["روغن و خواربار", "/categories/oil-and-grocery"],
    ["نوشیدنی‌ها", "/categories/drinks"],
    ["لبنیات محلی", "/categories/local-dairy"],
  ];
  const homeCategoryLinks = page.locator("#categories").getByRole("link");
  assert.deepEqual(await homeCategoryLinks.evaluateAll(links => links
    .filter(a => a.closest("[class*=categoryGrid]"))
    .map(a => [a.textContent.trim(), a.getAttribute("href")])), categoryLinks,
    "Every homepage category has a real dedicated route");
  for(const [label,route] of categoryLinks) {
    await page.goto(base+route);
    assert.equal(new URL(page.url()).pathname,route,"Category route remains shareable");
    await page.getByTestId("landing-category-intro")
      .getByRole("heading",{name:label,exact:true}).waitFor();
    await page.getByText("برای جلوگیری از نمایش دستهٔ اشتباه، کالاها بارگذاری نشدند.")
      .waitFor();
    assert.equal(await page.locator("[data-testid=preview-product-add]").count(),0,
      "No sample catalog items shown for an unverified landing category");
  }

  // A confirmed matching published category can load its real results, without
  // changing the dedicated URL, even when the verified result set is empty.
  await page.route("**/api/catalog/categories", route => route.fulfill({
    status:200,contentType:"application/json",body:JSON.stringify({items:[
      {id:"30000000-0000-4000-8000-000000000002",
        name:"لبنیات محلی",slug:"local-dairy"},
    ]}),
  }));
  await page.route("**/api/catalog/products?*", route => route.fulfill({
    status:200,contentType:"application/json",body:JSON.stringify({
      items:[],page:1,pageSize:20,total:0,
    }),
  }));
  await page.goto(base+"/categories/local-dairy");
  await page.getByRole("heading",{name:"فعلاً کالایی برای نمایش نداریم"}).waitFor();
  assert.equal(new URL(page.url()).pathname,"/categories/local-dairy",
    "Published taxonomy resolution must preserve the category landing route");
  assert.equal(await page.locator("[data-testid=preview-product-add]").count(),0);
  // Changing filters from a category landing moves to the canonical catalog.
  await page.getByRole("button",{name:"همه دسته‌ها",exact:true}).click();
  await page.waitForURL(base+"/products");
  await page.unroute("**/api/catalog/categories");
  await page.unroute("**/api/catalog/products?*");
  await page.goto(base+"/categories/bread-and-pastry");
  await page.getByRole("link",{name:"مشاهده همه کالاها و خدمات",exact:true}).click();
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
    "/products", "/products?collection=henna", "/products?collection=kalabarg", "/products?collection=golden",
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

  const footer = page.getByTestId("landing-footer-top");
  await footer.scrollIntoViewIfNeeded();
  await footer.getByText("ارتباط با ما", { exact: true }).waitFor();
  await footer.getByText("همکاری با حنا", { exact: true }).waitFor();
  await footer.getByText("دسترسی سریع", { exact: true }).waitFor();
  assert.equal(await page.getByTestId("marketplace-footer").count(), 0,
    "Catalog must not use the legacy marketplace footer");
  assert.equal(await footer.getByRole("link", { name: "دریافت اپلیکیشن حنا" })
    .getAttribute("href"), "/download",
    "Catalog footer exposes the same download destination as homepage");
  const socialIcons = page.getByTestId("landing-footer-bottom")
    .getByRole("link");
  assert.deepEqual(await socialIcons.evaluateAll(
    nodes => nodes.map(node => node.getAttribute("aria-label"))),
    ["اینستاگرام حنا", "توییتر حنا", "لینکدین حنا"],
    "Catalog uses the homepage social links");
  assert.equal(await socialIcons.locator("svg").count(), 3);

  // Account overview stays concise; personal and legal details are edited together on the profile page.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + "/buyer/account?mode=preview");
  const account = page.getByTestId("preview-account");
  const accountNav = account.getByRole("complementary", { name: "بخش‌های حساب کاربری" });
  const accountSummary = account.getByTestId("preview-account-summary");
  const accountInfo = account.getByTestId("preview-account-info");
  await accountInfo.waitFor();
  const navBox = await accountNav.boundingBox();
  const summaryBox = await accountSummary.boundingBox();
  const infoBox = await accountInfo.boundingBox();
  assert.equal(navBox.width, 320, "Account nav matches Figma width");
  assert.ok(navBox.x > infoBox.x, "Account nav is on the right");
  assert.ok(summaryBox.y < infoBox.y, "Account summary precedes account information");
  assert.equal(await accountNav.locator('[aria-current="page"]').textContent(), "اطلاعات حساب");
  const accountRows = accountNav.getByRole("link");
  assert.equal(await accountRows.count(), 7, "Settings is removed from the account navigation");
  assert.equal(await accountRows.locator("svg").count(), 7, "Every remaining account tab has a chevron");
  assert.equal(await accountNav.getByRole("link", { name: "تنظیمات", exact: true }).count(), 0);
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
  assert.equal(await account.getByTestId("preview-account-legal").count(), 0,
    "Legal company details are no longer split onto the account overview");

  const profile = page.getByTestId("preview-profile");
  await page.goto(base + "/buyer/profile?mode=preview");
  const personalProfile = profile.getByTestId("preview-personal-profile");
  const accountLegal = profile.getByTestId("preview-account-legal");
  await personalProfile.waitFor();
  await personalProfile.getByRole("heading", { name: "اطلاعات شخص حقیقی", exact: true }).waitFor();
  await accountLegal.getByRole("heading", { name: "اطلاعات شخص حقوقی", exact: true }).waitFor();
  await personalProfile.getByLabel("نام و نام خانوادگی").waitFor();
  await personalProfile.getByLabel("شماره موبایل").waitFor();
  await accountLegal.getByTestId("preview-company-form").waitFor();
  assert.equal(await accountLegal.getByRole("checkbox").count(), 0,
    "Invoice opt-in belongs to the order, not account company data");
  await accountLegal.getByLabel("نام شرکت", { exact: true }).fill("شرکت نمونه CI");
  await accountLegal.getByLabel("شناسه ملی شرکت", { exact: true }).fill("۱۰۰۰۰۰۰۰۰۰۰");
  await accountLegal.getByLabel("شماره ثبت", { exact: true }).fill("۱۲۳۴۵");
  await accountLegal.getByRole("button", { name: "ذخیره مشخصات شرکت", exact: true }).click();
  await accountLegal.getByTestId("preview-company-details").getByText("شرکت نمونه CI", { exact: true }).waitFor();
  await page.reload();
  const reloadedLegal = page.getByTestId("preview-profile").getByTestId("preview-account-legal");
  await reloadedLegal.getByRole("button", { name: "مشاهده اطلاعات", exact: true }).click();
  await reloadedLegal.getByTestId("preview-company-details").getByText("شرکت نمونه CI", { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
    "Profile page with personal and legal information must not overflow mobile viewport");

  // Every account destination shares one canvas, sidebar width and content width.
  const accountCanvasRoutes = [
    ["account","preview-account","/buyer/account?mode=preview"],
    ["profile","preview-profile","/buyer/profile?mode=preview"],
    ["addresses","preview-addresses","/account/addresses"],
    ["orders","preview-orders","/buyer/orders?mode=preview"],
    ["payments","preview-payments","/buyer/payments?mode=preview"],
    ["credits","preview-credits","/benefits?section=credits"],
    ["social","preview-social","/social"],
    ["support","preview-support","/support"],
  ];
  const canvasByWidth = new Map();
  for (const [route, testId, path] of accountCanvasRoutes) {
    await page.goto(base + path);
    await page.getByTestId(testId).waitFor();
    for (const width of [1440, 1650, 1150, 900, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      const g = await page.evaluate(id => {
        const rect = el => {
        const { x, y, top, bottom, right, width, height } = el.getBoundingClientRect();
        return { x, y, top, bottom, right, width, height };
      };
        const main = document.querySelector('[data-testid="' + id + '"]');
        const nav = main.querySelector("aside");
        const content = main.querySelector("section");
        const first = nav.querySelector("a");
        const arrow = first.querySelector("svg");
        return { body: rect(main), header: rect(document.querySelector('[data-testid="landing-header-top"]')),
          footer: rect(document.querySelector('[data-testid="landing-footer-top"]')),
          bottom: rect(document.querySelector('[data-testid="landing-footer-bottom"]')),
          nav: rect(nav), content: rect(content), label: rect(first.querySelector("span")), arrow: rect(arrow),
          arrowPath: arrow.querySelector("path").getAttribute("d"),
          scroll: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth };
      }, testId);
      for (const key of ["body", "footer", "bottom"]) {
        near(g[key].x, g.header.x, route + " " + key + " left aligns at " + width);
        near(g[key].right, g.header.right, route + " " + key + " right aligns at " + width);
      }
      const expected = canvasByWidth.get(width);
      if (route === "account") {
        canvasByWidth.set(width, { body: g.body.width, nav: g.nav.width, content: g.content.width,
          navX: g.nav.x, contentX: g.content.x });
      } else {
        near(g.body.width, expected.body, route + " stable page width at " + width);
        near(g.nav.width, expected.nav, route + " stable sidebar width at " + width);
        near(g.content.width, expected.content, route + " stable content width at " + width);
        near(g.nav.x, expected.navX, route + " stable sidebar position at " + width);
        near(g.content.x, expected.contentX, route + " stable content position at " + width);
      }
      if (width >= 900) {
        assert.ok(g.nav.x > g.content.x, route + " sidebar on right");
        near(g.nav.y, g.content.y, route + " sidebar/content top alignment at " + width);
      } else {
        assert.ok(g.content.y >= g.nav.bottom, route + " mobile content follows the sidebar");
      }
      assert.ok(g.arrow.right <= g.label.x && g.arrowPath === "M10 3.5 5.5 8 10 12.5", route + " arrow left");
      assert.ok(g.scroll <= g.viewport + 1, route + " no horizontal overflow at " + width);
    }
  }

  // BNPL directory offers real external links, not pretend checkout authorization.
  for (const width of [1440,390]) {
    await page.setViewportSize({width,height:900});
    await page.goto(base + "/buyer/payments?mode=preview");
    await page.getByTestId("bnpl-provider-cards").waitFor();
    assert.equal(await page.getByTestId("bnpl-provider-card").count(),3);
    assert.deepEqual(await page.getByTestId("bnpl-step-number").allTextContents(),["۱","۲","۳"],
      "Payment process step numbers use Persian digits");
    assert.doesNotMatch(await page.getByTestId("preview-payments").innerText(),/[0-9]/,
      "No Latin digits are visible anywhere on the payment methods page");
    await page.getByTestId("bnpl-integration-notice").getByText(/متصل نشده/).waitFor();
    for (const [name,href] of [
      ["اسنپ‌پی","https://snapppay.ir/"],
      ["دیجی‌پی","https://www.mydigipay.com/"],
      ["تارا","https://taracredit.com/"],
    ]) {
      const link=page.getByRole("link",{name:"ورود به سایت "+name});
      assert.equal(await link.getAttribute("href"),href);
      assert.equal(await link.getAttribute("target"),"_blank");
      const rel=await link.getAttribute("rel");
      assert.ok(rel.includes("noopener")&&rel.includes("noreferrer"));
    }
    assert.equal(await page.getByText("برای مشاهده روش‌های پرداخت ابتدا وارد شوید").count(),0);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),
      "BNPL cards must not overflow viewport at "+width);
    await page.goto(base+"/checkout",{waitUntil:"domcontentloaded"});
    await page.getByTestId("bnpl-checkout-unavailable").waitFor();
    await page.getByTestId("landing-footer-top").getByText("همکاری با حنا").waitFor();
    assert.equal(await page.getByTestId("bnpl-checkout-unavailable").locator('input').count(),0,
      "Unconnected BNPL providers cannot be selected for checkout");
  }

  // Company information is read from account storage; checkout never asks twice.
  await page.evaluate(items=>localStorage.setItem("henna:landing-preview-cart:v1",JSON.stringify(items)),expected);
  await page.goto(base+"/buyer/checkout?mode=preview");
  const legalCheckout=page.getByTestId("preview-checkout-page");
  await legalCheckout.getByRole("checkbox",{name:"خرید حقوقی و دریافت فاکتور رسمی"}).check();
  await legalCheckout.getByTestId("preview-legal-company-note").getByText(/شرکت نمونه CI/).waitFor();
  await legalCheckout.getByTestId("bnpl-checkout-unavailable").waitFor();
  assert.equal(await legalCheckout.getByRole("radio",{name:/پرداخت هنگام دریافت حضوری|پرداخت در محل/}).count(),0,
    "Cash on delivery is never offered in preview checkout");
  assert.equal(await legalCheckout.getByLabel("نام شرکت",{exact:true}).count(),0);
  assert.equal(await legalCheckout.getByRole("button",{name:"ثبت سفارش",exact:true}).isEnabled(),true);
  await page.evaluate(()=>localStorage.removeItem("henna:landing-preview-cart:v1"));

  // Every account tab has a real destination and a persistent navigation.
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(base + "/buyer/account?mode=preview");
  for (const [label, route, heading] of [
    ["آدرس‌های من","/account/addresses","مدیریت آدرس‌های من"],
    ["سفارش‌های من","/buyer/orders?mode=preview","سفارش‌های من"],
    ["روش‌های پرداخت","/buyer/payments?mode=preview","روش‌های پرداخت"],
    ["اعتبارهای من","/benefits?section=credits","اعتبارهای من"],
    ["مشارکت اجتماعی","/social","مشارکت اجتماعی"],
    ["پشتیبانی","/support","پشتیبانی حنا"],
    ["اطلاعات حساب","/buyer/account?mode=preview","حساب من"],
  ]) {
    const nav = page.getByTestId("buyer-account-nav");
    await nav.getByRole("link",{name:label,exact:true}).click();
    await page.waitForURL(base+route);
    await page.getByRole("heading",{name:heading,exact:true}).waitFor();
    assert.equal(await nav.locator('[aria-current="page"]').textContent(),label);
    assert.equal(await nav.getByRole("link").count(),7);
    assert.equal(await nav.getByRole("link",{name:"تنظیمات",exact:true}).count(),0);
    assert.equal(await nav.getByRole("link",{name:"طرح‌های فعال",exact:true}).count(),0);
    if (label==="مشارکت اجتماعی") {
      await page.getByTestId("buyer-social-report").waitFor();
      assert.equal(await page.getByRole("link",{name:"انتخاب طرح جدید"}).count(),0);
      await page.getByText("در انتظار گزارش تأییدشده").first().waitFor();
    }
  }

  // Preview is explicitly opted-in on local dev and is never a financial grant.
  let previewApiCalls = 0;
  await page.route("**/api/buyer/credits?page=*", route => {
    previewApiCalls += 1;
    return route.fulfill({status:500,body:"Unexpected preview credit API access"});
  });
  await page.goto(base + "/benefits?section=credits&mode=preview");
  await page.getByTestId("buyer-credit-preview-notice").waitFor();
  assert.equal(await page.getByTestId("buyer-credit-card").count(),3,
    "Three distinctly labeled, fictional credits appear in the account preview");
  await page.getByText("اعتبار سازمانی",{exact:true}).waitFor();
  await page.getByText("اعتبار کالای اساسی",{exact:true}).waitFor();
  assert.equal(await page.getByText("نمونه ـ غیرقابل استفاده").count(),3);
  assert.equal(await page.getByText("وارد حساب شوید").count(),0,
    "Preview must not ask the preview account to sign in again");
  assert.equal(previewApiCalls,0,"Preview never calls the real credit BFF");
  await page.unroute("**/api/buyer/credits?page=*");

  // A legacy plans link resolves to the same credit view, not a separate tab.
  await page.goto(base + "/benefits?section=plans");
  await page.getByRole("heading",{name:"اعتبارهای من",exact:true}).waitFor();
  assert.equal(await page.getByRole("link",{name:"طرح‌های فعال",exact:true}).count(),0);
  // The card view consumes multiple independent, account-scoped grants; no sample
  // balances are visible without a validated response from the read model.
  const sampleGrants = {
    items: [
      { id:"10000000-0000-4000-8000-000000000001", programId:"20000000-0000-4000-8000-000000000001",
        grantedRial:1250000, availableRial:750000, expiresAtUtc:"2030-11-01T00:00:00Z", categoryIds:["30000000-0000-4000-8000-000000000001"] },
      { id:"10000000-0000-4000-8000-000000000002", programId:"20000000-0000-4000-8000-000000000002",
        grantedRial:450000, availableRial:0, expiresAtUtc:"2030-11-01T00:00:00Z", categoryIds:["30000000-0000-4000-8000-000000000002"] },
    ],
    page:1, pageSize:20,
  };
  await page.route("**/api/buyer/credits?page=1", route => route.fulfill({
    status:200, contentType:"application/json", body:JSON.stringify(sampleGrants),
  }));
  await page.goto(base + "/benefits?section=credits");
  await page.getByTestId("buyer-credit-card").first().waitFor();
  assert.equal(await page.getByTestId("buyer-credit-card").count(),2,
    "Each valid credit grant appears as its own card");
  await page.unroute("**/api/buyer/credits?page=1");
  await page.route("**/api/buyer/credits?page=1", route => route.fulfill({
    status:503, contentType:"application/json", body:JSON.stringify({message:"unavailable"}),
  }));
  await page.goto(base + "/benefits?section=credits");
  await page.getByText("اطلاعات اعتبارهای حساب در دسترس نیست. این وضعیت به معنای نداشتن اعتبار نیست.").waitFor();
  assert.equal(await page.getByTestId("buyer-credit-card").count(),0,
    "No balance or sample credit is invented on upstream failure");
  await page.unroute("**/api/buyer/credits?page=1");

  // The same shared chrome must remain inside the viewport on mobile.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/products", { waitUntil: "domcontentloaded" });
  await page.getByTestId("marketplace-category-nav").waitFor();
  await page.getByTestId("landing-footer-top").waitFor();
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

  // Informational footer and public pages use one approved visual system.
  for (const width of [1440,900,390]) {
    await page.setViewportSize({width,height:900});
    for (const [path, title] of [
      ["/faq","سؤالات متداول"],
      ["/terms","قوانین و مقررات حنا"],
      ["/about","خرید محلی، انتخاب آگاهانه، حمایت مسئولانه"],
    ]) {
      await page.goto(base + path);
      await page.getByTestId("public-guide").waitFor();
      await page.getByRole("heading",{level:1,name:title}).waitFor();
      const footer = page.getByTestId("landing-footer-top");
      assert.equal(await footer.locator(":scope > div").count(),4,
        "Exactly four footer columns on "+path);
      const cooperation = footer.getByText("همکاری با حنا").locator("..");
      assert.equal(await cooperation.locator("a").count(),3,
        "Seller collaboration contains registration, seller panel and app download");
      assert.equal(await footer.getByText("فرصت‌های شغلی").count(),0);
      assert.equal(await footer.getByText("شرایط همکاری پیک‌ها").count(),0);
      const footerColumns = footer.locator(":scope > div");
      assert.equal(await footerColumns.nth(0).getAttribute("data-testid"),"footer-contact",
        "Contact replaces the removed support-plan column");
      assert.equal(await footerColumns.nth(3).getAttribute("data-testid"),"footer-brand",
        "Hana brand remains the last (rightmost) desktop footer column");
      assert.equal(await footer.getByText("طرح‌های حمایتی",{exact:true}).count(),0,
        "Removed support-plan column does not reappear");
      const brand = page.getByTestId("footer-brand");
      assert.equal(await brand.locator('img[alt="حنا"]').count(),1,"Hana logo restored in the footer");
      assert.equal(await brand.locator('a[href="/"]').count(),1,"Footer brand links to homepage");
      const contact = page.getByTestId("footer-contact");
      await contact.getByText("تهران، خیابان انقلاب، خیابان رازی، کوچه شهبازیان، پلاک ۲۲").waitFor();
      assert.equal(await contact.locator('a[href="tel:+982166485374"]').count(),1);
      assert.equal(await contact.locator('a[href="mailto:info@hennamarket.ir"]').count(),1);
      assert.equal(await contact.locator('[class*="footerContactIcon"] svg').count(),3,
        "Address, phone and email each have a vector icon");
      const footerAlignment = await page.evaluate(() => {
        const brand = document.querySelector('[data-testid="footer-brand"]');
        const logo = brand.querySelector('a[href="/"]');
        const contact = document.querySelector('[data-testid="footer-contact"]');
        const contactHeading = contact.querySelector("h3");
        const contactIcon = contact.querySelector('[class*="footerContactIcon"]');
        return {
          brandRight:brand.getBoundingClientRect().right,
          logoRight:logo.getBoundingClientRect().right,
          contactRight:contact.getBoundingClientRect().right,
          headingRight:contactHeading.getBoundingClientRect().right,
          iconRight:contactIcon.getBoundingClientRect().right,
        };
      });
      near(footerAlignment.brandRight,footerAlignment.logoRight,
        "Footer Hana logo anchored to right edge at "+width+" on "+path);
      near(footerAlignment.contactRight,footerAlignment.headingRight,
        "Footer contact heading anchored to right edge at "+width+" on "+path);
      near(footerAlignment.contactRight,footerAlignment.iconRight,
        "Footer contact heading aligned with icon column at "+width+" on "+path);
      const bounds = await page.evaluate(() => ({
        scroll:document.documentElement.scrollWidth,
        viewport:document.documentElement.clientWidth,
        header:document.querySelector('[data-testid="landing-header-top"]').getBoundingClientRect(),
        footer:document.querySelector('[data-testid="landing-footer-top"]').getBoundingClientRect(),
      }));
      assert.ok(bounds.scroll <= bounds.viewport+1, "No horizontal overflow on "+path+" at "+width);
      if (width >= 1000) {
        const columns = await footerColumns.evaluateAll(nodes =>
          nodes.map(node => ({ left:node.getBoundingClientRect().left, right:node.getBoundingClientRect().right }))
        );
        assert.ok(columns[0].right <= columns[3].left,
          "Contact appears to the left of the restored Hana logo on "+path);
      }
      near(bounds.header.left,bounds.footer.left,"Public footer left alignment on "+path+" at "+width);
      near(bounds.header.right,bounds.footer.right,"Public footer right alignment on "+path+" at "+width);
    }
    await page.goto(base + "/faq");
    const question = page.locator('details').first();
    assert.equal(await question.getAttribute("open"),null);
    await question.locator("summary").click();
    assert.ok(await question.evaluate(node=>node.open),"FAQ answer expands by user interaction");
    await question.locator("summary").click();
    assert.equal(await question.getAttribute("open"),null,"FAQ answer collapses");
    await page.goto(base + "/terms");
    await page.getByText("راهنمای عمومی، نه قرارداد لازم‌الاجرا",{exact:false}).waitFor();
  }
  // App download is a clearly identified test-only Android preview, never a production release.
  await page.goto(base + "/download");
  await page.getByTestId("download-app-page").waitFor();
  await page.getByRole("heading",{level:1,name:"دریافت اپلیکیشن حنا"}).waitFor();
  for(const [role,file] of [["buyer","hana-buyer-preview.apk"],["seller","hana-seller-preview.apk"]]){
    const card=page.getByTestId("app-download-"+role);
    await card.getByText("نسخه آزمایشی اندروید", {exact:true}).waitFor();
    const apk=card.locator('a[href$="/'+file+'"]');
    assert.equal(await apk.count(),1,"Verified download for "+role);
    assert.equal(await apk.getAttribute("target"),"_blank");
    assert.ok((await apk.getAttribute("rel")).includes("noopener"),"No opener on APK navigation");
  }
  await page.getByText(/مناسب استفاده تجاری واقعی نیستند/).waitFor();
  assert.equal(await page.getByTestId("download-app-page").locator('a[href*=".ipa"]').count(),0,
    "No unsupported native iOS download");
  const sums=page.getByRole("link",{name:"بررسی صحت فایل‌ها"});
  assert.equal(await sums.getAttribute("href"),
    "https://github.com/mahdimarzooghi4-debug/henna/releases/download/hana-mobile-preview-1783-1/SHA256SUMS.txt");
  const downloadFooter=page.getByTestId("landing-footer-top");
  assert.equal(await downloadFooter.getByRole("link",{name:"دریافت اپلیکیشن حنا"}).getAttribute("href"),"/download");
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),
    "Download page does not overflow on mobile");

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
