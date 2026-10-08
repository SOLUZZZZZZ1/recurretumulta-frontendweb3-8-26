import test from "node:test";
import assert from "node:assert/strict";
import { fetchWorkingDocument, fetchWorkingDocumentPdf, verifyWorkingDocument, workingDocumentRoute } from "../src/lib/opsWorkingDocument.js";

const caseId = "10000000-0000-4000-8000-000000000001";
const documentId = "20000000-0000-4000-8000-000000000001";
const projection = {
  ok: true, case_id: caseId, version: "rtm_working_document_v1", source_sha256: "a".repeat(64),
  status: "working_draft", final_resource_generated: false, persisted: false, can_save: false,
  facts_id: "30000000-0000-4000-8000-000000000001", facts_payload_sha256: "b".repeat(64),
  latest_id: null, history: [], document_kind: "driver_identification", title: "Contestación por revisar",
  content: "BORRADOR\nPersona conductora: [pendiente].\n", fields: [
    { key: "matricula", label: "Matrícula", value: "RTM-TEST-002", status: "candidate",
      sources: [{ document_id: documentId, page_index: null, evidence: null, evidence_kind: null }],
      matches: [{ source: "client_declaration", value: "RTM-TEST-002", rule: "normalized_exact_v1" }] },
  ], issues: [{ code: "driver_identity_missing", severity: "blocking", message: "Falta indicar quién conducía.", field_keys: [] }],
};
const copy = value => structuredClone(value);

test("working document loads with one GET and keeps candidates distinct from a generated resource", async () => {
  let calls = 0;
  const loaded = await fetchWorkingDocument({ caseId, authFetch: async (url, options) => {
    calls++;
    assert.equal(url, `/api/ops/core/cases/${caseId}/study/working-document`);
    assert.equal(options.method, "GET"); assert.equal(options.cache, "no-store");
    assert.ok(!Object.hasOwn(options, "body"));
    return { ok: true, json: async () => projection };
  } });
  assert.equal(calls, 1); assert.equal(loaded, projection);
  assert.equal(loaded.fields[0].status, "candidate");
  assert.equal(loaded.fields[0].sources[0].page_index, null);
  assert.equal(loaded.final_resource_generated, false);
});

test("wrong case, stale contract and claims of a stored or final resource are rejected", () => {
  for (const alter of [data => data.case_id = documentId, data => data.version = "unknown",
    data => data.final_resource_generated = true, data => data.persisted = true,
    data => data.can_save = true, data => data.history = [{ id: documentId }],
    data => data.source_sha256 = "bad", data => data.facts_id = null,
    data => data.fields.push(data.fields[0]), data => data.fields[0].status = "approved",
    data => data.fields[0].sources[0].evidence_kind = "model_guess"]) {
    const data = copy(projection); alter(data);
    assert.throws(() => verifyWorkingDocument(data, caseId));
  }
  assert.throws(() => workingDocumentRoute("../../other"));
});

test("confirmed, deterministic, declared and missing fields retain their separate statuses", () => {
  const data = copy(projection);
  data.facts_id = null; data.facts_payload_sha256 = null;
  data.fields = [
    { key: "puntos", label: "Puntos", value: 0, status: "verified", sources: [], matches: [] },
    { key: "pago", label: "Pago", value: false, status: "reviewed", sources: [], matches: [] },
    { key: "nombre", label: "Nombre", value: "Prueba", status: "declared", sources: [], matches: [] },
    { key: "fecha", label: "Fecha", value: null, status: "missing", sources: [], matches: [] },
  ];
  assert.equal(verifyWorkingDocument(data, caseId), data);
  assert.equal(data.fields[0].value, 0); assert.equal(data.fields[1].value, false);
  assert.equal(data.fields[3].value, null);
});

test("blocked reads are not retried or replaced by a write", async () => {
  for (const status of [401, 403, 404, 409, 500]) {
    let calls = 0;
    await assert.rejects(fetchWorkingDocument({ caseId, authFetch: async (_, options) => {
      calls++; assert.equal(options.method, "GET"); return { ok: false, status };
    } }));
    assert.equal(calls, 1);
  }
});

const pdfBytes = new TextEncoder().encode("%PDF-1.4\nworking draft transport fixture\n%%EOF").buffer;
const pdfHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", pdfBytes)),
  item => item.toString(16).padStart(2, "0")).join("");
function pdfResponse({ sourceHash = projection.source_sha256, hash = pdfHash, bytes = pdfBytes, type = "application/pdf" } = {}) {
  return { ok: true, headers: new Headers({ "Content-Type": type,
    "X-RTM-Source-SHA256": sourceHash, "X-RTM-Document-SHA256": hash }), arrayBuffer: async () => bytes };
}

test("PDF GET is tied to the displayed source hash and checks the received bytes", async () => {
  let calls = 0;
  const bytes = await fetchWorkingDocumentPdf({ caseId, document: projection, authFetch: async (url, options) => {
    calls++; assert.equal(options.method, "GET");
    assert.equal(url, `${workingDocumentRoute(caseId)}/pdf?source_sha256=${projection.source_sha256}`);
    return pdfResponse();
  } });
  assert.equal(bytes, pdfBytes); assert.equal(calls, 1);
  for (const change of [{ sourceHash: "c".repeat(64) }, { hash: "d".repeat(64) },
    { bytes: new TextEncoder().encode("%PDF-modified").buffer }, { type: "text/html" }]) {
    await assert.rejects(fetchWorkingDocumentPdf({ caseId, document: projection, authFetch: async () => pdfResponse(change) }));
  }
});

test("PDF of a changed source or canceled session cannot be returned to the viewer", async () => {
  const controller = new AbortController();
  await assert.rejects(fetchWorkingDocumentPdf({ caseId, document: projection, signal: controller.signal,
    authFetch: async () => { controller.abort(); return pdfResponse(); } }));
  let called = false;
  await assert.rejects(fetchWorkingDocumentPdf({ caseId: documentId, document: projection,
    authFetch: async () => { called = true; return pdfResponse(); } }));
  assert.equal(called, false);
});
