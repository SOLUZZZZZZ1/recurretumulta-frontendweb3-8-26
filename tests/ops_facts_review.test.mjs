import test from "node:test";
import assert from "node:assert/strict";
import { buildFactReviewBody, fetchFactsWorkspace, submitFactReview, originalSources, reviewBlockReason, FACT_FIELDS, FACT_GROUPS, missingFactGroups, factValue } from "../src/lib/opsFactsReview.js";

const caseId = "10000000-0000-4000-8000-000000000001";
const doc = "20000000-0000-4000-8000-000000000001";
const record = { id: "30000000-0000-4000-8000-000000000001", case_id: caseId, sequence: 1,
  frozen: false, payload_sha256: "a".repeat(64), facts: { case_id: caseId, source_document_ids: [doc],
    facts: { fecha_notificacion: { value: null, status: "unresolved" }, puntos_detraccion: { value: null, status: "unresolved" } } } };
const workspace = { ok: true, case_id: caseId, case: { department: "traffic", case_type: "fine", payment_status: "paid", authorized: true, status: "facts_validation" },
  authority: { validated_facts: { latest_active: record } }, documents: [{ id: doc, kind: "original" }, { id: "x", kind: "original" }] };
const form = { record, field: "fecha_notificacion", value: "2026-09-20", documentId: doc, page: "1", evidence: "Notificada el 20/09/2026", reason: "Original contrastado", checked: true };
const response = data => ({ ok: true, json: async () => data });

test("requires human check, original source, real date and typed numeric value", () => {
  const body = buildFactReviewBody(form);
  assert.equal(body.changes[0].page_index, 0);
  assert.equal(body.expected_payload_sha256, record.payload_sha256);
  assert.deepEqual(Object.keys(body).sort(), ["changes", "expected_payload_sha256", "reason"]);
  for (const change of [{ checked: false }, { value: "2026-02-30" }, { value: "0000-01-01" }, { page: "0" }, { page: "1.5" }, { documentId: caseId }, { reason: " " }, { field: "familia_resuelta" }]) {
    assert.throws(() => buildFactReviewBody({ ...form, ...change }));
  }
  assert.equal(buildFactReviewBody({ ...form, field: "puntos_detraccion", value: "0" }).changes[0].value, 0);
  assert.throws(() => buildFactReviewBody({ ...form, field: "puntos_detraccion", value: "1.5" }));
});
test("workspace binds to requested case and refuses mismatched facts", async () => {
  assert.equal(await fetchFactsWorkspace({ authFetch: async () => response(workspace), caseId }), workspace);
  for (const bad of [{ ...workspace, case_id: doc }, { ...workspace, authority: { validated_facts: { latest_active: { ...record, case_id: doc } } } }]) {
    await assert.rejects(fetchFactsWorkspace({ authFetch: async () => response(bad), caseId }));
  }
  let called = false;
  await assert.rejects(fetchFactsWorkspace({ authFetch: async () => { called = true; }, caseId: "../../other" }));
  assert.equal(called, false);
});
test("review access and original selection stay restricted", () => {
  assert.deepEqual(originalSources(workspace), [workspace.documents[0]]);
  assert.equal(reviewBlockReason(workspace, true, "session", true), "");
  assert.ok(reviewBlockReason(workspace, false, "session", true));
  assert.ok(reviewBlockReason(workspace, true, "", true));
  assert.ok(reviewBlockReason({ ...workspace, case: { ...workspace.case, status: "submitted" } }, true, "session", true));
  assert.ok(reviewBlockReason({ ...workspace, case: { ...workspace.case, payment_status: "pending" } }, true, "session", true));
});
test("facts stay read-only until the signed authorization is verified, not merely consented", () => {
  for (const flag of [undefined, false, null, "true", 1]) {
    assert.match(reviewBlockReason(workspace, true, "session", flag), /autorización firmada/);
  }
  assert.equal(reviewBlockReason(workspace, true, "session", true), "");
  assert.match(reviewBlockReason({ ...workspace, case: { ...workspace.case, authorized: false } }, true, "session", true), /autorización firmada/);
});
test("save posts exact version once and does not retry conflicting requests", async () => {
  let calls = 0;
  const body = buildFactReviewBody(form);
  const authFetch = async (url, options) => {
    calls++;
    assert.equal(url, `/api/ops/core/cases/${caseId}/validated-facts/${record.id}/review`);
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(options.body), body);
    assert.deepEqual(Object.keys(options.headers), ["Content-Type"]);
    return { ok: false, status: 409 };
  };
  await assert.rejects(submitFactReview({ authFetch, caseId, record, body }), err => err.status === 409);
  assert.equal(calls, 1);
});
test("successful save must be a new draft superseding this exact record", async () => {
  const saved = { ...record, id: "30000000-0000-4000-8000-000000000002", supersedes_id: record.id, sequence: 2,
    facts: {...record.facts, facts: {...record.facts.facts, fecha_notificacion:{value:"2026-09-20",status:"validated",sources:[{document_id:doc,page_index:0,evidence:form.evidence,source_type:"operator_document_review"}]}}} };
  const run = facts => submitFactReview({ authFetch: async () => response({ ok: true, case_id: caseId, facts }), caseId, record, body: buildFactReviewBody(form) });
  assert.equal(await run(saved), saved);
  for (const bad of [record, { ...saved, frozen: true }, { ...saved, supersedes_id: doc }, { ...saved, case_id: doc }]) await assert.rejects(run(bad));
});

test("missing data picker excludes existing fields and covers the editable catalog once", () => {
  const grouped=FACT_GROUPS.flatMap(group=>group.fields);
  assert.equal(new Set(grouped).size,grouped.length);
  assert.deepEqual([...grouped].sort(),Object.keys(FACT_FIELDS).sort());
  const choices=missingFactGroups(record).flatMap(group=>group.fields);
  assert.ok(choices.includes("pago_multa_reducido"));
  assert.ok(!choices.includes("fecha_notificacion") && !choices.includes("puntos_detraccion"));
  assert.deepEqual(missingFactGroups(null),[]);
});
test("adding requires an explicit operation and never overwrites an existing field", () => {
  const added=buildFactReviewBody({...form,field:"lugar_infraccion",value:"Vía ficticia",operation:"add"});
  assert.equal(added.changes[0].operation,"add");
  assert.equal(added.changes[0].value,"Vía ficticia");
  assert.throws(()=>buildFactReviewBody({...form,field:"lugar_infraccion",value:"Vía ficticia"}));
  assert.throws(()=>buildFactReviewBody({...form,operation:"add"}));
  assert.throws(()=>buildFactReviewBody({...form,operation:"overwrite"}));
});
test("yes/no has no default and serializes false separately from missing data", () => {
  const base={...form,field:"pago_multa_reducido",operation:"add"};
  assert.equal(buildFactReviewBody({...base,value:"false"}).changes[0].value,false);
  assert.equal(buildFactReviewBody({...base,value:"true"}).changes[0].value,true);
  for(const value of ["",undefined,null,"0","1","no","Sí",false])assert.throws(()=>buildFactReviewBody({...base,value}));
  assert.equal(factValue(false),"No");assert.equal(factValue(true),"Sí");
  assert.equal(factValue(null),"Pendiente de confirmar");
});
test("a new version without the exact added value and documentary source is rejected", async () => {
  const body=buildFactReviewBody({...form,field:"pago_multa_reducido",operation:"add",value:"false"});
  const added={value:false,status:"validated",sources:[{document_id:doc,page_index:0,evidence:form.evidence,source_type:"operator_document_review"}]};
  const saved={...record,id:"30000000-0000-4000-8000-000000000002",supersedes_id:record.id,sequence:2,
    facts:{...record.facts,facts:{...record.facts.facts,pago_multa_reducido:added}}};
  const run = value => submitFactReview({authFetch:async()=>response({ok:true,case_id:caseId,facts:value}),caseId,record,body});
  assert.equal(await run(saved),saved);
  for(const bad of [undefined,{...added,value:true},{...added,status:"unresolved"},{...added,sources:[]},
    {...added,sources:[{...added.sources[0],document_id:caseId}]},{...added,sources:[{...added.sources[0],evidence:"different"}]}]) {
    await assert.rejects(run({...saved,facts:{...saved.facts,facts:{...saved.facts.facts,pago_multa_reducido:bad}}}));
  }
});
