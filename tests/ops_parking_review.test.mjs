import test from "node:test";
import assert from "node:assert/strict";
import { buildCheckReviewBody, buildDocumentMetadata, buildStudyAction, verifyStudy,
  submitCheckReview, submitStudyDocument, submitStudyAction } from "../src/lib/opsCoreStudy.js";

const CASE = "11111111-1111-4111-8111-111111111111";
const FACT = "22222222-2222-4222-8222-222222222222";
const DOC = "33333333-3333-4333-8333-333333333333";
const FAMILY = "44444444-4444-4444-8444-444444444444";
const PREVIEW = "55555555-5555-4555-8555-555555555555";
const NEW = "66666666-6666-4666-8666-666666666666";
const EXTRA = "77777777-7777-4777-8777-777777777777";
const ids = ["procedure", "deadline", "location", "rule", "conditions", "evidence", "payment", "defense"];
function state() {
  return { ok: true, study_version: "rtm_ops_study_v1", case_id: CASE, stage: "preview_available",
    next_action: null, blockers: [], state_sha256: "a".repeat(64), can_add_document: true, can_reopen_facts: true,
    available_actions: ["reopen_facts"], documents: [{ id: DOC, sha256: "d".repeat(64) }],
    facts: { id: FACT, case_id: CASE, sequence: 13, payload_sha256: "b".repeat(64), frozen: true,
      facts: { case_id: CASE, frozen: true, source_document_ids: [DOC], facts: { pago_multa_reducido: { value: false, status: "validated" } } } },
    family: { id: FAMILY, case_id: CASE, payload_sha256: "c".repeat(64), validated_facts_id: FACT, locked: true,
      resolution: { case_id: CASE, family: "estacionamiento", status: "resolved", conflicts: [], unresolved: [], evidence: [] } },
    preview: { id: PREVIEW, case_id: CASE, payload_sha256: "d".repeat(64), validated_facts_id: FACT, family_resolution_id: FAMILY, status: "draft",
      preview: { case_id: CASE, problem_summary: "Hecho de prueba", primary_strategy: "Revisión pendiente", validated_facts_summary: [], risks: [], missing_items: [], deadlines: [] } },
    parking_review: { preview_id: PREVIEW, source_sha256: "e".repeat(64), approval_enabled: false, reviewed_count: 0,
      checks: ids.map(id => ({ id, title: id, instruction: "Contrastar documentación.", can_mark_reviewed: id === "payment",
        fields: [{ key: id, label: id, value: id === "payment" ? false : null,
          sources: id === "payment" ? [{ document_id: DOC, page_index: 0 }] : [] }],
        missing_fact_keys: id === "payment" ? [] : [id], review: null })) } };
}
const response = data => ({ ok: true, json: async () => data });
function reviewed(study, body) {
  const result = structuredClone(study);
  Object.assign(result, { state_sha256: "f".repeat(64), previous_state_sha256: study.state_sha256, completed_action: "review_check" });
  Object.assign(result.preview, { id: NEW, supersedes_id: PREVIEW });
  result.parking_review.preview_id = NEW;
  result.parking_review.checks.find(c => c.id === body.check_id).review = {
    check_id: body.check_id, result: body.result, notes: body.notes, actor: "operator:trusted", reviewed_at: "2026-10-05T10:00:00Z",
  };
  result.parking_review.reviewed_count = body.result === "reviewed" ? 1 : 0;
  return result;
}
function reopened(study, action = "reopen_facts") {
  const result = structuredClone(study);
  Object.assign(result, { stage: "facts_review", next_action: "freeze_facts", available_actions: ["freeze_facts"],
    can_reopen_facts: false, state_sha256: "f".repeat(64), previous_state_sha256: study.state_sha256, completed_action: action,
    family: null, parking_review: null });
  Object.assign(result.facts, { id: NEW, supersedes_id: FACT, frozen: false });
  result.facts.facts.frozen = false;
  result.preview.status = "invalidated";
  return result;
}
test("missing evidence remains pending and documentary false is reviewable", () => {
  const study = state();
  const input = { checkId: "payment", result: "reviewed", notes: "Estado y fuente contrastados", confirmed: true };
  assert.equal(buildCheckReviewBody(study, input).result, "reviewed");
  assert.throws(() => buildCheckReviewBody(study, { ...input, checkId: "location" }));
  assert.equal(buildCheckReviewBody(study, { ...input, checkId: "location", result: "needs_information" }).result, "needs_information");
  for (const changes of [{ confirmed: 1 }, { confirmed: false }, { notes: "   " }, { checkId: "unknown" }]) {
    assert.throws(() => buildCheckReviewBody(study, { ...input, ...changes }));
  }
});
test("review responses cannot switch source case, preview or documentary lineage", () => {
  for (const mutate of [
    s => { s.parking_review.preview_id = EXTRA; },
    s => { s.parking_review.checks[6].fields[0].sources[0].document_id = EXTRA; },
    s => { s.parking_review.checks[6].fields[0].sources[0].page_index = -1; },
    s => { s.parking_review.reviewed_count = 8; },
    s => { s.parking_review.approval_enabled = true; },
    s => { s.parking_review.checks[0].can_mark_reviewed = true; },
  ]) {
    const study = state(); mutate(study);
    assert.throws(() => verifyStudy(study, CASE));
  }
});
test("review saves one new bound draft without author headers or retries", async () => {
  const study = state();
  const body = buildCheckReviewBody(study, { checkId: "payment", result: "reviewed", notes: "Estado y fuente contrastados", confirmed: true });
  let calls = 0;
  const authFetch = async (url, options) => {
    calls++; assert.equal(url, "/api/ops/core/cases/" + CASE + "/study/check-reviews");
    assert.deepEqual(options.headers, { "Content-Type": "application/json" });
    assert.deepEqual(JSON.parse(options.body), body);
    return response(reviewed(study, body));
  };
  assert.equal((await submitCheckReview({ authFetch, study, body })).preview.id, NEW);
  assert.equal(calls, 1);
  for (const change of [
    s => { s.preview.supersedes_id = EXTRA; },
    s => { s.preview.status = "approved"; },
    s => { s.previous_state_sha256 = "0".repeat(64); },
    s => { s.parking_review.checks[6].review.notes = "Una conclusión diferente"; },
  ]) {
    const saved = reviewed(study, body); change(saved);
    await assert.rejects(submitCheckReview({ authFetch: async () => response(saved), study, body }));
  }
  calls = 0;
  await assert.rejects(submitCheckReview({ authFetch: async () => { calls++; throw Error("Lost response"); }, study, body }));
  assert.equal(calls, 1);
});
test("reopening requires a reason and binds the successor facts version", async () => {
  const study = state();
  const body = buildStudyAction(study, { requestedAction: "reopen_facts", confirmed: true, reason: "Documentación adicional que debe contrastarse" });
  assert.equal(body.action, "reopen_facts");
  assert.throws(() => buildStudyAction(study, { requestedAction: "reopen_facts", confirmed: true }));
  assert.throws(() => buildStudyAction({ ...study, can_reopen_facts: false }, { requestedAction: "reopen_facts", confirmed: true, reason: body.reason }));
  const saved = await submitStudyAction({ authFetch: async () => response(reopened(study)), caseId: CASE, study, body });
  assert.equal(saved.facts.supersedes_id, FACT);
  const wrong = reopened(study); wrong.facts.supersedes_id = EXTRA;
  await assert.rejects(submitStudyAction({ authFetch: async () => response(wrong), caseId: CASE, study, body }));
});
test("PDF uses authenticated multipart and verifies bytes and the new revision", async () => {
  const study = state(), file = new File(["%PDF-1.7 test bytes"], "prueba.pdf", { type: "application/pdf" });
  const sha = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))).map(v => v.toString(16).padStart(2, "0")).join("");
  const body = buildDocumentMetadata(study, { confirmed: true, reason: "Ampliación documental para la revisión" });
  let calls = 0;
  const saved = reopened(study, "add_document");
  saved.documents.push({ id: EXTRA, sha256: sha });
  saved.facts.facts.source_document_ids.push(EXTRA);
  saved.added_document = { id: EXTRA, sha256: sha };
  const authFetch = async (url, options) => {
    calls++; assert.equal(url, "/api/ops/core/cases/" + CASE + "/study/documents");
    assert.equal(options.headers, undefined);
    assert.ok(options.body instanceof FormData);
    assert.deepEqual(JSON.parse(options.body.get("metadata")), body);
    assert.equal(await options.body.get("file").text(), await file.text());
    return response(saved);
  };
  assert.equal((await submitStudyDocument({ authFetch, study, body, file })).added_document.sha256, sha);
  assert.equal(calls, 1);
  saved.added_document.sha256 = "0".repeat(64);
  await assert.rejects(submitStudyDocument({ authFetch, study, body, file }));
});
test("invalid, excessive or aborted uploads never send a request", async () => {
  const study = state(), body = buildDocumentMetadata(study, { confirmed: true, reason: "Ampliación documental de prueba" });
  let calls = 0; const authFetch = async () => { calls++; throw Error("Should not send"); };
  for (const file of [new File([], "vacio.pdf"), new File(["x"], "archivo.exe"),
    new File(["x"], "datos.pdf", { type: "text/html" }), { size: 4 * 1024 * 1024 + 1, name: "grande.pdf", type: "application/pdf" }]) {
    await assert.rejects(submitStudyDocument({ authFetch, study, body, file }));
  }
  const controller = new AbortController(); controller.abort();
  await assert.rejects(submitStudyDocument({ authFetch, study, body, file: new File(["pdf"], "prueba.pdf"), signal: controller.signal }));
  assert.equal(calls, 0);
});
