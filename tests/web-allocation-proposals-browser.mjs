// Real Next UI; fixtures intercept browser requests only and never seed a database.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
const base = "http://127.0.0.1:3022";
const id = "b8b52eee-b4c3-4ae5-a72a-8a78dd1561c0";
const firstPartyId = "b8b52eee-b4c3-4ae5-a72a-8a78dd1561c2";
let web, browser, logs = "", mode = "normal", decision = null, postedReason = "";
let firstTraining = null, trainingAttempts = 0;
let firstRetention = null, retentionAttempts = 0, retentionEvent = null;
const retentionDigest = "a".repeat(64);
const trainingLabelIds = Array.from({ length: 40 }, (_, i) =>
  `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`);
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
      if (path.endsWith("/retention/preview")) {
        const cutoffUtc = new URL(request.url()).searchParams.get("cutoffUtc");
        assert.equal(new Date(cutoffUtc).toISOString(), cutoffUtc);
        return route.fulfill(json({
          scope: "ATTRIBUTED_RESEARCH",
          cutoffUtc,
          totalEligibleSnapshotCount: 7,
          selectedSnapshotCount: 5,
          selectedOutcomeCount: 2,
          truncated: true,
          previewDigest: retentionDigest,
          active: false,
        }));
      }
      if (path.endsWith("/retention/events")) {
        return route.fulfill(json({
          items: retentionEvent ? [retentionEvent] : [],
          page: 1,
          active: false,
        }));
      }
      if (path.endsWith("/retention/purge")) {
        retentionAttempts++;
        const current = {
          key: request.headers()["idempotency-key"],
          body: request.postData(),
        };
        assert.match(current.key,
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        const body = request.postDataJSON();
        assert.equal(body.previewDigest, retentionDigest);
        assert.equal(body.reason, "حذف پژوهشی مصوب در تست مرورگر");
        assert.equal(new Date(body.cutoffUtc).toISOString(), body.cutoffUtc);
        if (retentionAttempts === 1) {
          firstRetention = current;
          return route.fulfill(json({ message: "unknown retention outcome" }, 503));
        }
        assert.deepEqual(current, firstRetention,
          "retention retry after reload must retain exact key and body");
        retentionEvent = {
          id: current.key,
          actorAccountId: id,
          scope: "ATTRIBUTED_RESEARCH",
          cutoffUtc: body.cutoffUtc,
          deletedSnapshotCount: 5,
          deletedOutcomeCount: 2,
          reason: body.reason,
          recordedAtUtc: "2026-10-06T12:00:00.000Z",
        };
        return route.fulfill(json({
          eventId: current.key,
          deletedSnapshotCount: 5,
          deletedOutcomeCount: 2,
          previewDigest: retentionDigest,
          active: false,
        }));
      }
      if (path.endsWith("/assessments") && request.method() === "POST") {
        const input = request.postDataJSON();
        assert.equal(input.householdKey, id); assert.equal(input.scores.health, 3);
        assert.equal(input.evidenceReference, "approved-document-ui");
        return route.fulfill(json({ id: input.snapshotId, active: false }, 201));
      }
      if (path.endsWith("/assessments")) return route.fulfill(json({ active: false, items: [
        { id, datasetVersion: "ui-dataset", sourceInstructionReference: "ui-source", evidenceReference: "approved-document-ui",
          health: 3, hardship: 0, age: 0, size: 0, care: 0, education: 0, trainingEligible: false },
        { id: firstPartyId, datasetVersion: "henna-first-party-v1", sourceInstructionReference: "ui-source",
          evidenceReference: null, health: 2, hardship: 1, age: 0, size: 1, care: 0, education: 1, trainingEligible: true }
      ] }));
      if (path.endsWith("/labels") && request.method() === "POST") {
        assert.equal(request.postDataJSON().snapshotId, firstPartyId);
        assert.equal(request.postDataJSON().needScore, .8);
        return route.fulfill(json({ id, active: false }));
      }
      if (path.endsWith("/labels")) return route.fulfill(json({
        active: false,
        items: trainingLabelIds.map((labelId, i) => ({
          id: labelId, snapshotId: id, needScore: .8,
          partition: i < 30 ? 1 : 2,
        })),
      }));
      if (path.endsWith("/train")) {
        trainingAttempts++;
        const current = {
          key: request.headers()["idempotency-key"],
          body: request.postData(),
        };
        assert.deepEqual(request.postDataJSON(), {
          labelIds: trainingLabelIds,
          poolRial: 1000,
        });
        assert.match(current.key,
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        if (trainingAttempts === 1) {
          firstTraining = current;
          return route.fulfill(json({ message: "unknown outcome" }, 503));
        }
        assert.deepEqual(current, firstTraining,
          "allocation training retry after reload must retain exact key and body");
        return route.fulfill(json({
          id: current.key,
          proposalId: id,
          status: "PROPOSED",
          active: false,
        }));
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
  await page.getByText("ارزیابی پژوهشی ثبت شد؛ این رکورد برای آموزش هوش حنا مجاز نیست.").waitFor();
  assert.equal(await page.getByLabel("شناسه ثابت خانوار (UUID)").isDisabled(), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.goto(base + "/admin/allocation-training");
  await page.getByLabel("نسخه معیار ارزیابی").fill("reviewed-rubric-v1");
  const assessmentSelect = page.getByLabel("ارزیابی خانوار");
  await assessmentSelect.selectOption(firstPartyId);
  assert.equal(await assessmentSelect.locator(`option[value="${id}"]`).isDisabled(), true);
  await page.getByLabel("امتیاز نیاز از صفر تا یک").fill("0.8");
  await page.getByRole("button", { name: "ثبت امتیاز", exact: true }).click();
  await page.getByText("امتیاز ثبت شد و قابل بازنویسی نیست.").waitFor();
  await page.getByRole("button", { name: "انتخاب همه موارد نمایش‌داده‌شده" }).click();
  await page.getByLabel("مبلغ شبیه‌سازی به ریال").fill("1000");
  await page.getByRole("button", { name: "شروع آموزش آزمایشی" }).click();
  await page.getByText("نتیجه اجرای آموزش قطعی نیست.", {
    exact: false,
  }).waitFor();
  assert.equal(trainingAttempts, 1);

  await page.reload();
  await page.getByRole("heading", { name: "آموزش آزمایشی تخصیص" }).waitFor();
  await page.getByRole("button", {
    name: "تکرار امن اجرای آموزش قبلی",
  }).waitFor();
  assert.equal(await page.getByRole("button", {
    name: "ثبت امتیاز",
  }).isDisabled(), true);
  await page.getByRole("button", {
    name: "تکرار امن اجرای آموزش قبلی",
  }).click();
  await page.getByText("آموزش انجام شد؛ پیشنهاد برای بررسی انسانی ثبت شد.").waitFor();
  assert.equal(trainingAttempts, 2);
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

  const retentionPreviewUrl =
    base + "/api/admin/allocation-proposals/research/retention/preview" +
    "?cutoffUtc=2026-10-01T10%3A00%3A00.000Z";
  assert.equal((await fetch(retentionPreviewUrl)).status, 401);
  assert.equal((await fetch(
    base + "/api/admin/allocation-proposals/research/retention/purge",
    {
      method: "POST",
      headers: {
        Origin: "https://untrusted.test",
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        cutoffUtc: "2026-10-01T10:00:00.000Z",
        previewDigest: retentionDigest,
        reason: "test",
      }),
    },
  )).status, 403);

  await page.goto(base + "/admin/allocation-retention");
  await page.getByRole("heading", {
    name: "Retention داده‌های پژوهشی تخصیص",
  }).waitFor();
  await page.getByLabel("cutoff صریح").fill("2026-10-01T10:00");
  await page.getByRole("button", { name: "گرفتن Preview" }).click();
  await page.getByText("Preview digest:", { exact: false }).waitFor();
  await page.getByText("بیش از ۵۰۰۰ snapshot واجد شرایط است.", {
    exact: false,
  }).waitFor();
  await page.getByLabel("دلیل مصوب حذف").fill(
    "حذف پژوهشی مصوب در تست مرورگر",
  );
  await page.getByRole("checkbox").check();
  await page.getByRole("button", {
    name: "حذف batch پژوهشی و ثبت audit",
  }).click();
  await page.getByText("نتیجه retention قطعی نیست.", {
    exact: false,
  }).waitFor();
  assert.equal(retentionAttempts, 1);

  await page.reload();
  await page.getByRole("button", {
    name: "تکرار امن همان حذف قبلی",
  }).waitFor();
  assert.equal(await page.getByLabel("cutoff صریح").isDisabled(), true);
  await page.getByRole("button", {
    name: "تکرار امن همان حذف قبلی",
  }).click();
  await page.getByText("Retention اجرا و audit شد:", {
    exact: false,
  }).waitFor();
  assert.equal(retentionAttempts, 2);
  await page.getByText("حذف پژوهشی مصوب در تست مرورگر").waitFor();
  assert.equal(await page.evaluate(
    () => document.documentElement.scrollWidth <= innerWidth,
  ), true);

  assert.deepEqual(errors, []);
  console.log("Allocation admin UI: proposal review, training durable retry and retention preview/reload-safe purge passed");
} finally {
  if (browser) await browser.close();
  if (web?.pid) { try { process.kill(-web.pid, "SIGTERM"); } catch {} }
}
