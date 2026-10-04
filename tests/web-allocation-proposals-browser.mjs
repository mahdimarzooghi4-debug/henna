// Real Next UI; fixtures intercept browser requests only and never seed a database.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
const base = "http://127.0.0.1:3022";
const id = "b8b52eee-b4c3-4ae5-a72a-8a78dd1561c0";
let web, browser, logs = "", mode = "normal", decision = null, postedReason = "";
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
try {
  web = spawn("npm", ["run", "start", "--workspace", "@hana/web-marketplace", "--", "--port", "3022"],
    { detached: true, env: { ...process.env, HANA_API_BASE_URL: "", NEXT_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"] });
  web.stdout.on("data", d => { logs += d; }); web.stderr.on("data", d => { logs += d; });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(base + "/admin/allocation-proposals", { signal: AbortSignal.timeout(2000) })).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, logs);
  assert.equal((await fetch(base + "/api/admin/allocation-proposals")).status, 401);
  assert.equal((await fetch(base + `/api/admin/allocation-proposals/${id}/review`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: "https://untrusted.test" },
    body: JSON.stringify({ decision: "APPROVED", reason: "test" }) })).status, 403);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage(); const errors = [];
  page.on("pageerror", e => { errors.push(e.message); console.log("Page error:", e.message); });
  page.on("requestfailed", request => console.log("Failed request:", request.url(), request.failure()?.errorText));
  await page.route(/\/api\/admin\/allocation-proposals(?:\/|\?|$)/, async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    assert.equal(request.headers().authorization, undefined);
    if (mode === "forbidden") return route.fulfill(json({ message: "این صفحه فقط برای مدیر مجاز است." }, 403));
    if (mode === "empty") return route.fulfill(json({ items: [], active: false }));
    if (path.endsWith("/review")) {
      const input = request.postDataJSON(); decision = input.decision; postedReason = input.reason;
      return route.fulfill(json({ id, status: decision, active: false }));
    }
    if (path.endsWith(id)) return route.fulfill(json({ id, active: false, candidateVersion: "candidate-ui-test", rationale: "گزارش آزمایشی",
      status: decision ?? "PENDING_REVIEW", review: decision ? { decision, reason: postedReason } : null,
      weights: { Health: .3, Hardship: .25, Age: .18, Size: .12, Care: .1, Education: .05 },
      learningMetrics: { TrainingCount: 36, ValidationCount: 12, BaselineValidationMse: .001, CandidateValidationMse: .0001 },
      simulation: { Rows: [{ HouseholdKey: id, BaselineAmountRial: 100, ProposedAmountRial: 110 }] } }));
    return route.fulfill(json({ active: false, items: [{ id, candidateVersion: "candidate-ui-test", baselineVersion: "baseline", modelVersion: "model", createdAtUtc: "2026-10-04T00:00:00Z", decision }] }));
  });
  await page.goto(base + "/admin/allocation-proposals");
  await page.getByRole("button", { name: /candidate-ui-test/ }).click();
  try { await page.getByRole("heading", { name: "ضرایب پیشنهادی" }).waitFor(); }
  catch (error) { console.log("Review page state:", await page.locator("main").innerText()); throw error; }
  assert.equal(await page.getByRole("button", { name: "تأیید پیشنهاد", exact: true }).isEnabled(), false);
  await page.getByLabel("دلیل تصمیم").fill("بررسی گزارش و تأیید آزمایشی");
  await page.getByRole("button", { name: "تأیید پیشنهاد", exact: true }).click();
  await page.getByText("دلیل تصمیم ثبت‌شده:", { exact: false }).waitFor();
  assert.equal(decision, "APPROVED"); assert.ok(postedReason.includes("بررسی"));
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  mode = "forbidden"; await page.reload();
  await page.getByRole("alert").waitFor();
  assert.equal(await page.getByRole("heading", { name: "ضرایب پیشنهادی" }).count(), 0);
  mode = "empty"; await page.reload(); await page.getByText("هنوز پیشنهادی ثبت نشده است.").waitFor();
  assert.deepEqual(errors, []);
  console.log("Allocation review UI: authentication gateway, CSRF, reports, review reason, refresh, access denial and mobile reflow passed");
} finally {
  if (browser) await browser.close();
  if (web?.pid) { try { process.kill(-web.pid, "SIGTERM"); } catch {} }
}
