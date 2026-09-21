/**
 * Frontend 018: shipping Expo public detail controller/client, CI-only network.
 * State/transport regression; does NOT claim real on-device touch coverage.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { BuyerDetailController } from "../apps/mobile-consumer/src/buyer-detail-controller.ts";
import { MobileCatalogClient } from "../apps/mobile-consumer/src/mobile-catalog.ts";

const A = "2fd59aad-5834-4717-9462-c5e520dd7a31";
const ID = "60000000-0000-4000-8000-000000000001";
const OTHER = "60000000-0000-4000-8000-000000000002";
const published = {
  id: ID, categoryId: A, name: "عنوان معتبر CI",
  kind: "SERVICE", description: "توضیح منتشرشده CI",
};
const response = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json" },
});
async function until(check) {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await new Promise(r => setTimeout(r, 3));
  }
  throw Error("detail state did not settle");
}
function scenario(fetchFn, id = ID) {
  const calls = [], states = [];
  const client = new MobileCatalogClient(
    "https://api.hana.test", async (path, init) => {
      const url = new URL(path);
      calls.push({ url, init });
      assert.equal(init.method, "GET");
      assert.equal(init.cache, "no-store");
      assert.equal(init.credentials, "omit");
      assert.equal(init.headers.Authorization, undefined);
      assert.equal(init.headers.Cookie, undefined);
      assert.equal(init.headers["Cache-Control"], "no-store");
      assert.ok(init.signal instanceof AbortSignal);
      return fetchFn(url, init);
    },
  );
  const ctrl = new BuyerDetailController(client, s => states.push(s), id);
  return { ctrl, calls, states };
}
test("published detail uses real public endpoint, allowlist and optional fields", async () => {
  const { ctrl: c, calls, states } = scenario(() => response(200, {
    ...published, sellerPhone: "SECRET", price: 999, stock: 10,
  }));
  c.start();
  await until(() => c.snapshot().status === "ok");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.pathname, "/api/v1/catalog/products/" + ID);
  assert.deepEqual(c.snapshot().product, published);
  assert.equal(JSON.stringify(states).includes("SECRET"), false);
  assert.equal(JSON.stringify(states).includes('"price"'), false);
  c.stop();
  const count = calls.length;
  await c.refresh();
  assert.equal(calls.length, count);
});

test("404 and malformed ID are missing, but 503 and invalid data are unavailable", async () => {
  for (const [status, data, expected] of [
    [404, {}, "missing"],
    [503, {}, "unavailable"],
    [200, { ...published, id: OTHER }, "unavailable"],
    [200, { ...published, kind: "PRICED_OFFER" }, "unavailable"],
    [200, { ...published, name: "" }, "unavailable"],
  ]) {
    const { ctrl: c } = scenario(() => response(status, data));
    c.start();
    await until(() => c.snapshot().status !== "loading");
    assert.equal(c.snapshot().status, expected);
    c.stop();
  }
  const { ctrl: invalid, calls } = scenario(
    () => { throw Error("should not fetch"); }, "not-a-uuid");
  invalid.start();
  await until(() => invalid.snapshot().status === "missing");
  assert.equal(calls.length, 0);
  invalid.stop();
});

test("retry does not reuse unavailable product and can recover from 503", async () => {
  let mode = "503";
  const { ctrl: c } = scenario(() => mode === "503"
    ? response(503, {}) : response(200, { ...published, description: null }));
  c.start();
  await until(() => c.snapshot().status === "unavailable");
  mode = "ok";
  const promise = c.refresh();
  assert.equal(c.snapshot().status, "loading");
  await promise;
  assert.deepEqual(c.snapshot(), {
    status: "ok", id: ID, product: { ...published, description: null },
  });
  c.stop();
});

test("opening another id aborts in-flight detail and ignores even late success", async () => {
  let deliverOld, oldSignal;
  const deferred = new Promise(resolve => { deliverOld = resolve; });
  const { ctrl: c, calls } = scenario((url, init) => {
    if (url.pathname.endsWith(ID)) {
      oldSignal = init.signal;
      return deferred; // Misbehaving transport ignores cancellation.
    }
    return response(200, { ...published, id: OTHER, name: "کالای تازه" });
  });
  c.start();
  assert.equal(c.snapshot().status, "loading");
  c.open(OTHER);
  assert.equal(oldSignal.aborted, true);
  await until(() => c.snapshot().status === "ok");
  assert.equal(c.snapshot().product.name, "کالای تازه");
  deliverOld(response(200, published));
  await new Promise(r => setTimeout(r, 10));
  assert.equal(c.snapshot().id, OTHER);
  assert.equal(c.snapshot().product.name, "کالای تازه");
  c.stop();
  const n = calls.length;
  await c.refresh();
  assert.equal(calls.length, n);
});
