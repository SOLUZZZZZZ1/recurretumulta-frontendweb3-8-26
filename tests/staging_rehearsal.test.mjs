import test from "node:test";
import assert from "node:assert/strict";
import { rehearsalRequest, rehearsalJson, REHEARSAL_BASE } from "../src/lib/stagingRehearsal.js";
const ID = "11111111-1111-5111-8111-111111111111";

test("trial transports the case capability only to a fixed same-origin OPS route", () => {
  const request = rehearsalRequest(`/cases/${ID}/append-documents`, { method: "POST" }, () => "test-token");
  assert.equal(request.url, `${REHEARSAL_BASE}/cases/${ID}/append-documents`);
  assert.equal(request.options.headers.get("X-RTM-Case-Token"), "test-token");
  assert.equal(rehearsalRequest("/cases/intake-draft", { method: "POST" }).url, REHEARSAL_BASE + "/intake-draft");
});

test("foreign URLs, extra query, traversal, unlisted actions and methods never receive credentials", () => {
  let reads = 0;
  const token = () => { reads++; return "test-token"; };
  for (const path of [`https://other.invalid/cases/${ID}/authorize`, `/cases/${ID}/../authorize`,
    `/cases/${ID}/authorize?case=other`, `/cases/${ID}/contact`, `/cases/${ID}/checkout`, "/cases/not-uuid/authorize"]) {
    assert.throws(() => rehearsalRequest(path, { method: "POST" }, token));
  }
  assert.throws(() => rehearsalRequest(`/cases/${ID}/authorization-pdf`, { method: "POST" }, token));
  assert.equal(reads, 0);
  assert.throws(() => rehearsalRequest(`/cases/${ID}/authorize`, { method: "POST" }, () => ""));
});

test("a rehearsal response must explicitly confirm success", async () => {
  await assert.rejects(rehearsalJson(new Response(JSON.stringify({ ok: false }), { status: 200 })));
  await assert.rejects(rehearsalJson(new Response(JSON.stringify({ detail: "Solo fixture" }), { status: 422 })), /Solo fixture/);
  assert.deepEqual(await rehearsalJson(new Response(JSON.stringify({ ok: true }))), { ok: true });
});
