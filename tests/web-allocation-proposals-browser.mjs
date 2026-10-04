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
  await page.route(/\/api\/admin\/allocation-proposals(?:\/|\?|$)/, async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    assert.equal(request.headers().authorization, undefined);
    if (path.includes("/research/runs")) {
      const run = { id, status: "PROPOSED", datasetVersion: "ui-dataset", modelVersion: "ui-model", proposalId: id, recordedAtUtc: "2026-10-04T00:00:00Z" };
      if (path.endsWith(id)) return route.fulfill(json({ ...run, active: false, cutoffUtc: "2026-10-03T00:00:00Z", poolRial:1000, sourceInstructionReference:"ui-source",rubricVersion:"ui-rubric",trainingCount:30,validationCount:10,learningMetrics:{BaselineValidationMse:.01,CandidateValidationMse:.001} }));
      return route.fulfill(json({ active:false,items:[run] }));
    }
    if (path.includes("/research/")) {
      if (path.endsWith("/assessments") && request.method() === "POST") {
        const input = request.postDataJSON();
        assert.equal(input.householdKey, id); assert.equal(input.scores.health, 3);
        assert.equal(input.evidenceReference, "approved-document-ui");
        return route.fulfill(json({ id: input.snapshotId, active: false }, 201));
      }
      if (path.endsWith("/assessments")) return route.fulfill(json({ active: false, items: [{ id, datasetVersion: "ui-dataset", sourceInstructionReference: "ui-source", health: 3, hardship: 0, age: 0, size: 0, care: 0, education: 0 }] }));
      if (path.endsWith("/labels") && request.method() === "POST") {
        assert.equal(request.postDataJSON().needScore, .8);
        return route.fulfill(json({ id, active: false }));
      }
      if (path.endsWith("/labels")) return route.fulfill(json({ active: false, items: Array.from({ length: 40 }, (_, i) => ({ id: `label-${i}`, snapshotId: id, needScore: .8, partition: i < 30 ? 1 : 2 })) }));
      if (path.endsWith("/train")) {
        assert.equal(request.postDataJSON().labelIds.length, 40);
        assert.equal(request.postDataJSON().poolRial, 1000);
        return route.fulfill(json({ id, proposalId: id, status: "PROPOSED", active: false }));
      }
    }
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
  await page.getByRole("alert").filter({ hasText: "این صفحه فقط برای مدیر مجاز است." }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "ضرایب پیشنهادی" }).count(), 0);
  mode = "empty"; await page.reload(); await page.getByText("هنوز پیشنهادی ثبت نشده است.").waitFor();
  mode = "normal";
  await page.goto(base + "/admin/allocation-assessments");
  await page.getByLabel("شناسه ثابت خانوار (UUID)").fill(id);
  await page.getByLabel("نسخه مجموعه ارزیابی").fill("ui-dataset");
  await page.getByLabel("مرجع دستور تأمین مالی").fill("ui-source");
  await page.getByLabel("مرجع سند ارزیابی").fill("approved-document-ui");
  await page.getByLabel("تاریخ و ساعت ارزیابی").fill("2026-10-01T10:00");
  await page.getByLabel("ضریب جغرافیایی مصوب").fill("1.1");
  await page.getByLabel("مبلغ تخصیص ثبت‌شده به ریال").fill("1000");
  for (const name of ["سلامت و درمان", "فشار معیشتی", "سن و وابستگی", "اندازه خانوار", "مراقبت و حمایت", "تحصیلات"]) await page.getByLabel(name, { exact: true }).selectOption(name === "سلامت و درمان" ? "3" : "0");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "ثبت ارزیابی مستند", exact: true }).click();
  await page.getByText("ارزیابی ثبت شد و در صفحه آموزش قابل انتخاب است.").waitFor();
  assert.equal(await page.getByLabel("شناسه ثابت خانوار (UUID)").isDisabled(), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.goto(base + "/admin/allocation-training");
  await page.getByLabel("نسخه معیار ارزیابی").fill("reviewed-rubric-v1");
  await page.getByLabel("ارزیابی خانوار").selectOption(id);
  await page.getByLabel("امتیاز نیاز از صفر تا یک").fill("0.8");
  await page.getByRole("button", { name: "ثبت امتیاز", exact: true }).click();
  await page.getByText("امتیاز ثبت شد و قابل بازنویسی نیست.").waitFor();
  await page.getByRole("button", { name: "انتخاب همه موارد نمایش‌داده‌شده" }).click();
  await page.getByLabel("مبلغ شبیه‌سازی به ریال").fill("1000");
  await page.getByRole("button", { name: "شروع آموزش آزمایشی" }).click();
  await page.getByText("آموزش انجام شد؛ پیشنهاد برای بررسی انسانی ثبت شد.").waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal((await fetch(base + "/api/admin/allocation-proposals/research/assessments")).status, 401);
  assert.equal((await fetch(base + "/api/admin/allocation-proposals/research/train", { method: "POST", headers: { Origin: "https://untrusted.test" } })).status, 403);
  await page.goto(base + "/admin/allocation-training-runs");
  await page.getByRole("button", { name: /پیشنهاد ثبت‌شده/ }).click();
  await page.getByText("معیار: ui-rubric").waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByRole("link", { name:"بررسی پیشنهاد این اجرا" }).click();
  await page.getByRole("heading", { name:"ضرایب پیشنهادی" }).waitFor();
  assert.equal((await fetch(base + "/api/admin/allocation-proposals/research/runs")).status,401);
  assert.deepEqual(errors, []);
  console.log("Allocation review UI: authentication gateway, CSRF, reports, review reason, refresh, access denial and mobile reflow passed");
} finally {
  if (browser) await browser.close();
  if (web?.pid) { try { process.kill(-web.pid, "SIGTERM"); } catch {} }
}
