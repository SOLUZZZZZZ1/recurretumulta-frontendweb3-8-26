import test from "node:test";
import assert from "node:assert/strict";
import { ACTIONS, verifyStudy, buildStudyAction, fetchStudy, submitStudyAction } from "../src/lib/opsCoreStudy.js";

const CASE = "11111111-1111-4111-8111-111111111111";
const FACTS = "22222222-2222-4222-8222-222222222222";
const DOC = "33333333-3333-4333-8333-333333333333";
function state() {
  return { ok: true, study_version: "rtm_ops_study_v1", case_id: CASE,
    state_sha256: "a".repeat(64), stage: "facts_review", next_action: "freeze_facts", blockers: [],
    facts: { id: FACTS, case_id: CASE, sequence: 13, payload_sha256: "b".repeat(64), frozen: false,
      facts: { case_id: CASE, frozen: false, source_document_ids: [DOC], facts: { matricula: { value: "RTM-TEST", status: "validated" } } } },
    family: null, preview: null };
}
function frozen(previous) {
  const saved = structuredClone(previous);
  saved.facts.frozen = saved.facts.facts.frozen = true;
  saved.facts.payload_sha256 = "c".repeat(64);
  Object.assign(saved, { stage: "family_pending", next_action: "resolve_family",
    completed_action: "freeze_facts", previous_state_sha256: previous.state_sha256, state_sha256: "d".repeat(64) });
  return saved;
}
const response = data => ({ ok: true, json: async () => data });
test("only the four reviewed-facts actions are exposed", () => {
  assert.deepEqual(Object.keys(ACTIONS), ["freeze_facts", "resolve_family", "lock_family", "build_preview"]);
});
test("binds a personal attestation to exact facts and documents without changing state", () => {
  const study = state(), before = structuredClone(study);
  const body = buildStudyAction(study, { confirmed: true, reviewNotes: " Original contrastado " });
  assert.equal(body.document_review.review_notes, "Original contrastado");
  assert.equal(body.document_review.facts_payload_sha256, study.facts.payload_sha256);
  assert.deepEqual(body.document_review.source_document_ids, [DOC]);
  assert.equal(body.expected_state_sha256, study.state_sha256);
  assert.deepEqual(study, before);
  for (const values of [{ confirmed: false }, { confirmed: 1 }, { confirmed: true, reviewNotes: "  " }]) {
    assert.throws(() => buildStudyAction(study, values));
  }
});
test("rejects foreign, malformed, blocked-action and inconsistent responses", () => {
  for (const update of [
    { case_id: DOC }, { state_sha256: "bad" }, { study_version: "old" }, { next_action: "approve_preview" },
    { stage: "preview_available" }, { blockers: ["Pago pendiente"] }, { blockers: [{}] },
    { facts: { ...state().facts, case_id: DOC } },
    { facts: { ...state().facts, frozen: true } },
    { family: { id: DOC, case_id: DOC } },
    { preview: { id: DOC, case_id: DOC } },
  ]) assert.throws(() => verifyStudy({ ...state(), ...update }, CASE));
});
test("fetch is scoped, no-store, abortable and rejects case substitutions", async () => {
  const signal = new AbortController().signal;
  const authFetch = async (url, options) => {
    assert.equal(url, "/api/ops/core/cases/" + CASE + "/study");
    assert.equal(options.cache, "no-store"); assert.equal(options.signal, signal);
    return response(state());
  };
  assert.equal((await fetchStudy({ authFetch, caseId: CASE, signal })).case_id, CASE);
  await assert.rejects(fetchStudy({ authFetch: async () => response({ ...state(), case_id: DOC }), caseId: CASE }));
});
test("accepts exact successful transition and never sends actor headers", async () => {
  const study = state(), body = buildStudyAction(study, { confirmed: true, reviewNotes: "Original contrastado" });
  let calls = 0;
  const authFetch = async (url, options) => {
    calls++; assert.equal(url, "/api/ops/core/cases/" + CASE + "/study/actions");
    assert.equal(options.method, "POST");
    assert.deepEqual(options.headers, { "Content-Type": "application/json" });
    assert.deepEqual(JSON.parse(options.body), body);
    return response(frozen(study));
  };
  const saved = await submitStudyAction({ authFetch, caseId: CASE, study, body });
  assert.equal(saved.facts.id, FACTS); assert.equal(calls, 1);
});
test("failed or lost writes are never retried", async () => {
  const study = state(), body = buildStudyAction(study, { confirmed: true, reviewNotes: "Original contrastado" });
  for (const status of [401, 403, 409, 500, 0]) {
    let calls = 0;
    const authFetch = async () => { calls++; if (!status) throw new Error("Network lost"); return { ok: false, status }; };
    await assert.rejects(submitStudyAction({ authFetch, caseId: CASE, study, body }));
    assert.equal(calls, 1);
  }
});
test("does not accept replay, switched facts, or unbound action success", async () => {
  const study = state(), body = buildStudyAction(study, { confirmed: true, reviewNotes: "Original contrastado" });
  for (const change of [
    { previous_state_sha256: "e".repeat(64) }, { state_sha256: study.state_sha256 },
    { completed_action: "build_preview" }, { facts: { ...frozen(study).facts, id: DOC } },
  ]) {
    let calls = 0;
    await assert.rejects(submitStudyAction({ authFetch: async () => { calls++; return response({ ...frozen(study), ...change }); }, caseId: CASE, study, body }));
    assert.equal(calls, 1);
  }
});
