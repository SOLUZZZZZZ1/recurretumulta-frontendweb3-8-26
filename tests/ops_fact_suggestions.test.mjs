import test from "node:test";
import assert from "node:assert/strict";
import { factReviewSuggestions, prepareAvailableFactProposals } from "../src/lib/opsFactSuggestions.js";
import { buildFactReviewBatchBody } from "../src/lib/opsFactsReview.js";

const caseId = "10000000-0000-4000-8000-000000000001";
const documentId = "20000000-0000-4000-8000-000000000001";
const record = {
  id: "30000000-0000-4000-8000-000000000001", case_id: caseId, payload_sha256: "a".repeat(64),
  facts: { case_id: caseId, source_document_ids: [documentId], facts: {
    matricula: { value: null, status: "unresolved", sources: [], notes: ["Lectura candidata no consolidada: NO PARSEAR"] },
    velocidad_medida_kmh: { value: 177, status: "validated", sources: [
      { document_id: documentId, page_index: 0, evidence: "Velocidad medida: 177 km/h", source_type: "operator_document_review" },
    ] },
  } },
};
const source = { document_id: documentId, page_index: 0, evidence: "Matrícula: RTM-TEST-002",
  source_type: "model_document_observation", evidence_kind: "document_excerpt" };
const reading = { key: "matricula", label: "Matrícula", value: "RTM-TEST-002", status: "candidate", sources: [source] };
const projection = { version: "rtm_working_document_v1", case_id: caseId, facts_id: record.id,
  facts_payload_sha256: record.payload_sha256, source_sha256: "b".repeat(64), fields: [reading] };
const byKey = (items, key) => items.find(item => item.field === key);

test("structured candidate prefills exact value, page and excerpt without an attestation or mutating facts", () => {
  const before = structuredClone({ record, projection });
  const item = byKey(factReviewSuggestions(record, projection), "matricula");
  assert.equal(item.form.value, "RTM-TEST-002");
  assert.equal(item.form.documentId, documentId);
  assert.equal(item.form.page, "1");
  assert.equal(item.form.evidence, source.evidence);
  assert.equal(item.form.checked, false);
  assert.equal(item.confirmed, false);
  assert.equal(item.ready, true);
  const proposals = prepareAvailableFactProposals(record, projection);
  assert.equal(proposals.length, 1);
  assert.throws(() => buildFactReviewBatchBody({ record, proposals, checked: false }));
  assert.equal(buildFactReviewBatchBody({ record, proposals, checked: true }).changes[0].page_index, 0);
  assert.deepEqual({ record, projection }, before);
});

test("candidate projection must bind to both the case and exact facts version", () => {
  for (const change of [{ case_id: documentId }, { facts_id: documentId },
    { facts_payload_sha256: "c".repeat(64) }, { version: "different" }]) {
    const item = byKey(factReviewSuggestions(record, { ...projection, ...change }), "matricula");
    assert.equal(item.form.value, "");
    assert.equal(item.ready, false);
  }
  assert.equal(byKey(factReviewSuggestions(record), "matricula").form.value, "");
});

test("existing confirmed facts remain reusable and are not queued for another review", () => {
  const items = factReviewSuggestions(record, { ...projection, fields: [reading,
    { key: "velocidad_medida_kmh", value: 180, status: "candidate", sources: [source] }] });
  const existing = byKey(items, "velocidad_medida_kmh");
  assert.equal(existing.form.value, "177");
  assert.equal(existing.confirmed, true);
  assert.equal(existing.form.checked, false);
  assert.deepEqual(prepareAvailableFactProposals(record, projection).map(item => item.field), ["matricula"]);
});

test("a missing page or excerpt stays missing, even when there is only one original", () => {
  for (const replacement of [{ ...source, page_index: null }, { ...source, evidence: null },
    { ...source, evidence_kind: undefined, evidence: '{"candidate_only":true,"value":"RTM-TEST-002"}' },
    { ...source, document_id: caseId }]) {
    const item = byKey(factReviewSuggestions(record, { ...projection, fields: [{ ...reading, sources: [replacement] }] }), "matricula");
    assert.equal(item.form.value, "RTM-TEST-002");
    assert.equal(item.ready, false);
    assert.ok(item.missing.length);
  }
  const item = byKey(factReviewSuggestions(record, { ...projection, fields: [{ ...reading, sources: [{ ...source, page_index: null }] }] }), "matricula");
  assert.equal(item.form.page, "");
});

test("explicit zero and false remain candidates while an absent value never acquires a default", () => {
  const fields = [
    { key: "puntos_detraccion", value: 0, status: "candidate", sources: [{ ...source, evidence: "Puntos: 0" }] },
    { key: "pago_multa_reducido", value: false, status: "candidate", sources: [{ ...source, evidence: "Pago reducido: no" }] },
    { key: "fecha_notificacion", value: null, status: "missing", sources: [] },
  ];
  const items = factReviewSuggestions(record, { ...projection, fields });
  assert.equal(byKey(items, "puntos_detraccion").form.value, "0");
  assert.equal(byKey(items, "pago_multa_reducido").form.value, "false");
  assert.equal(byKey(items, "fecha_notificacion").form.value, "");
  const body = buildFactReviewBatchBody({ record, checked: true,
    proposals: prepareAvailableFactProposals(record, { ...projection, fields }) });
  assert.equal(body.changes.find(item => item.field === "puntos_detraccion").value, 0);
  assert.equal(body.changes.find(item => item.field === "pago_multa_reducido").value, false);
  assert.ok(!body.changes.some(item => item.field === "fecha_notificacion"));
});

test("conflicting, duplicate and rejected observations are never selected for the batch", () => {
  for (const fields of [[{ ...reading, status: "conflict" }], [reading, { ...reading, value: "OTRA" }]]) {
    const item = byKey(factReviewSuggestions(record, { ...projection, fields }), "matricula");
    assert.equal(item.conflict, true);
    assert.equal(item.form.value, "");
    assert.equal(item.ready, false);
  }
  const rejected = structuredClone(record);
  rejected.facts.facts.matricula.status = "rejected";
  assert.equal(prepareAvailableFactProposals(rejected, projection).length, 0);
});

test("prepared manual changes win over later observations and the set remains unchecked", () => {
  const manual = { ...byKey(factReviewSuggestions(record, projection), "matricula").proposal,
    value: "MANUAL-003", evidence: "Corrección introducida por el operador", checked: true };
  const prepared = prepareAvailableFactProposals(record, projection, [manual]);
  assert.equal(prepared.length, 1);
  assert.equal(prepared[0].value, "MANUAL-003");
  assert.equal(prepared[0].evidence, manual.evidence);
  assert.equal(prepared[0].checked, false);
  assert.equal(manual.checked, true);
});

test("document subject conflicts stay out of automatic preparation and remain correctable with their source", () => {
  const identityFields = [
    { key: "document_subject_name", label: "Persona interesada que figura en el documento", value: "Persona documental de prueba" },
    { key: "document_subject_id", label: "Identificador de esa persona en el documento", value: "IDENTIDAD-PRUEBA-01" },
  ];
  const factsRecord = structuredClone(record);
  for (const field of identityFields) factsRecord.facts.facts[field.key] = { value: null, status: "unresolved", sources: [] };
  const fields = identityFields.map(field => ({ ...field, status: "conflict", sources: [
    { ...source, page_index: 1, evidence: `Persona interesada: Persona documental de prueba. Identificador: IDENTIDAD-PRUEBA-01.` },
  ] }));
  const workingDocument = { ...projection, fields };
  assert.deepEqual(prepareAvailableFactProposals(factsRecord, workingDocument), []);
  const proposals = identityFields.map(field => {
    const item = byKey(factReviewSuggestions(factsRecord, workingDocument), field.key);
    assert.equal(item.label, field.label);
    assert.equal(item.conflict, true);
    assert.equal(item.ready, false);
    assert.equal(item.form.checked, false);
    assert.equal(item.form.value, "");
    assert.equal(item.form.documentId, documentId);
    assert.equal(item.form.page, "2");
    assert.equal(item.form.evidence, fields[0].sources[0].evidence);
    return { ...item.proposal, value: field.value, reason: "Persona interesada contrastada en la página indicada" };
  });
  assert.throws(() => buildFactReviewBatchBody({ record: factsRecord, proposals, checked: false }));
  const body = buildFactReviewBatchBody({ record: factsRecord, proposals, checked: true });
  assert.deepEqual(body.changes.map(change => [change.field, change.value]), identityFields.map(field => [field.key, field.value]));
  assert.ok(body.changes.every(change => change.document_id === documentId && change.page_index === 1 && change.evidence === fields[0].sources[0].evidence));
  assert.throws(() => buildFactReviewBatchBody({ record: factsRecord, checked: true, proposals: [{ ...proposals[0], evidence: "" }] }));
});
