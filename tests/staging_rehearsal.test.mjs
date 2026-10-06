import test from "node:test";
import assert from "node:assert/strict";
import { rehearsalRequest, rehearsalJson, REHEARSAL_BASE, REHEARSAL_VERSION, parseRehearsalProgress } from "../src/lib/stagingRehearsal.js";
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

test("progress resumes renewal after invalidation and review only for a current candidate", () => {
  const profile = (step, status) => ({version:REHEARSAL_VERSION,synthetic_only:true,existing_case_id:ID,
    progress:{case_id:ID,step,main_document_received:true,authorization_evidence_status:status}});
  assert.equal(parseRehearsalProgress(profile("renewal","not_submitted"),ID).step,"renewal");
  assert.equal(parseRehearsalProgress(profile("review","pending_review"),ID).authorizationStatus,"pending_review");
  assert.equal(parseRehearsalProgress(profile("review","verified"),ID).authorizationStatus,"verified");
  assert.throws(() => parseRehearsalProgress(profile("review","not_submitted"),ID));
  assert.throws(() => parseRehearsalProgress(profile("review","pending_review"),"22222222-2222-5222-8222-222222222222"));
  assert.throws(() => parseRehearsalProgress({...profile("renewal","not_submitted"),synthetic_only:false},ID));
  assert.throws(() => parseRehearsalProgress({...profile("renewal","not_submitted"),progress:null},ID));
});

test("new trial and existing case progress cannot invent a saved document", () => {
  const fresh={version:REHEARSAL_VERSION,synthetic_only:true,existing_case_id:null,
    progress:{case_id:null,step:"intake",main_document_received:false,authorization_evidence_status:"missing"}};
  assert.equal(parseRehearsalProgress(fresh).caseId,null);
  assert.throws(() => parseRehearsalProgress(fresh,ID));
  assert.throws(() => parseRehearsalProgress({...fresh,progress:{...fresh.progress,step:"review"}}));
});
