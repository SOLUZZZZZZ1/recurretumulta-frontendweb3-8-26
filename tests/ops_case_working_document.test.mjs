import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parse } from '@babel/parser';
import { verifyCaseDocument, verifyCaseVersions, contentHash, readCaseVersion, saveCaseVersion,
  selectCaseVersion, CASE_DOCUMENT, CASE_VERSIONS } from '../src/lib/opsCaseWorkingDocument.js';

const caseId = randomUUID(), id = randomUUID(), docId = randomUUID(), selection = randomUUID();
const hash = 'a'.repeat(64), content = 'PRUEBA SINTÉTICA\r\nContenido exacto.  \r\n';
const snapshot = { ok: true, case_id: caseId, version: CASE_DOCUMENT, status: 'working_draft',
  final_resource_generated: false, operator_export_allowed: false, synthetic_only: true,
  content, source_sha256: hash, used_document_ids: [docId],
  sources: { case_id: caseId, data_status: 'complete', document_reading: 'not_performed',
    customer_comment: null, public_service_family: 'seguros',
    roles: { interested: { status: 'declared', value: { full_name: 'INTERESADA', dni_nie: null, address: null,
      address_parts: Object.fromEntries(['street','street_number','floor','door','postal_code','city','province'].map(k => [k,null])) } },
      contact: { status: 'declared', value: { name: 'OTRO CONTACTO', email: 'test@example.com', phone: null, preferred_contact: null } },
      ...Object.fromEntries(['driver', 'owner', 'representative'].map(key => [key, { status: 'not_available', value: null, reason: 'Lectura no disponible' }])) },
    documents: [{ id: docId, sha256: hash, kind: 'identity_front', mime: 'application/pdf', size_bytes: 120,
      operator_export_allowed: false, reading_status: 'not_read' }] } };
const entry = { id, case_id: caseId, format: CASE_VERSIONS, sequence: 1, previous_id: null,
  previous_material_sha256: null, based_on_id: null, status: 'working_draft', synthetic_only: true,
  final_resource_generated: false, operator_export_allowed: false, source_sha256: hash,
  snapshot_sha256: hash, content_sha256: await contentHash(content), context_sha256: hash,
  title: 'Borrador', created_at: '2026-10-16T14:00:00Z', created_by: `operator:${randomUUID()}`,
  pdf: { document_id: randomUUID(), sha256: hash, size_bytes: 1500 },
  provenance: 'operator_edit', change_reason: 'Prueba inicial', persisted: true };
const versions = { ok: true, case_id: caseId, version: CASE_VERSIONS, synthetic_only: true,
  final_resource_generated: false, operator_export_allowed: false, can_save: true,
  latest_id: id, selected_id: id, selection_revision: selection, history: [entry] };
const reply = { ok: true, version: CASE_VERSIONS, case_id: caseId, persisted: true,
  custody_verified: true, operator_export_allowed: false, entry, snapshot };

test('case snapshot preserves missing values, distinct roles and unavailable readings', () => {
  assert.equal(verifyCaseDocument(snapshot, caseId), snapshot);
  const incomplete = structuredClone(snapshot); delete incomplete.sources.roles.contact.value.email;
  assert.throws(() => verifyCaseDocument(incomplete, caseId));
  assert.throws(() => verifyCaseDocument(snapshot, randomUUID()));
  const foreignDoc = structuredClone(snapshot); foreignDoc.used_document_ids = [randomUUID()];
  assert.throws(() => verifyCaseDocument(foreignDoc, caseId));
  const invalid = structuredClone(snapshot); invalid.sources.roles.interested.value.dni_nie = 123;
  assert.throws(() => verifyCaseDocument(invalid, caseId));
});

test('history binds parent chain and durable selected version separately', () => {
  assert.equal(verifyCaseVersions(versions, caseId), versions);
  assert.throws(() => verifyCaseVersions({ ...versions, selected_id: randomUUID() }, caseId));
  assert.throws(() => verifyCaseVersions({ ...versions, history: [{ ...entry, based_on_id: id }] }, caseId));
  assert.throws(() => verifyCaseVersions({ ...versions, history: [entry, entry] }, caseId));
  assert.throws(() => verifyCaseVersions({ ...versions, operator_export_allowed: true }, caseId));
});

test('historical recovery is a single GET, verifies exact whitespace and hash, and cannot select', async () => {
  const calls = [];
  const authFetch = async (...args) => { calls.push(args); return Response.json(reply); };
  const result = await readCaseVersion({ authFetch, caseId, entry });
  assert.equal(result.snapshot.content, content);
  assert.equal(calls.length, 1); assert.equal(calls[0][1].method, undefined);
  assert.ok(calls[0][0].endsWith(`/versions/${id}`));
  await assert.rejects(readCaseVersion({ caseId, entry, authFetch: async () => Response.json({ ...reply,
    snapshot: { ...snapshot, content: content.replaceAll('\r\n', '\n') } }) }));
  await assert.rejects(readCaseVersion({ caseId, entry, signal: AbortSignal.abort(), authFetch }));
});

test('save sends independent head and selection preconditions and never retries a conflict', async () => {
  let count = 0;
  const body = { expected_latest_id: id, expected_selection_revision: selection, content, based_on_id: id };
  const authFetch = async (url, options) => {
    count++; assert.equal(options.method, 'POST'); assert.deepEqual(JSON.parse(options.body), body);
    return Response.json({}, { status: 409 });
  };
  await assert.rejects(saveCaseVersion({ authFetch, caseId, body }), error => error.status === 409);
  assert.equal(count, 1);
});

test('explicit selection is the only selection call and includes both concurrency guards', async () => {
  let body;
  const authFetch = async (url, options) => { assert.ok(url.endsWith('/selection')); body = JSON.parse(options.body); return Response.json(versions); };
  await selectCaseVersion({ authFetch, caseId, entry, versions });
  assert.deepEqual(body, { version_id: id, expected_latest_id: id, expected_selection_revision: selection });
});

test('external correction sends bounded file plus metadata, without duplicating editable content', async () => {
  const file = new File([`RTM-CASE: ${caseId}\nRTM-VERSION: ${id}\n\n${content}`], 'correccion.txt', { type: 'text/plain' });
  let count = 0;
  const authFetch = async (_, options) => {
    count++; assert.ok(options.body instanceof FormData);
    assert.equal(JSON.parse(options.body.get('metadata')).content, undefined);
    assert.equal(await options.body.get('file').text(), await file.text());
    return Response.json({ ...versions, saved_id: id });
  };
  await saveCaseVersion({ authFetch, caseId, file, body: { content, based_on_id: id } });
  await assert.rejects(saveCaseVersion({ authFetch, caseId, file: new File(['x'], 'a.html'), body: {} }));
  assert.equal(count, 1);
});

test('OPS mounts on local individual case context, destroys state across sessions and has no export UI', () => {
  const component = readFileSync(new URL('../src/components/OpsCaseWorkingDocument.jsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../src/pages/OpsCaseDetail.jsx', import.meta.url), 'utf8');
  parse(component, { sourceType: 'module', plugins: ['jsx'] });
  assert.ok(component.includes('key={`${props.caseId}:${props.sessionId}`}'));
  assert.ok(component.includes('request.current?.abort()'));
  assert.ok(page.includes('caseProjectionReady && canSupervise && authStatus?.authProfile === "local_development"'));
  for (const forbidden of ['window.open', 'createObjectURL', 'dangerouslySetInnerHTML', 'localStorage', 'sessionStorage']) assert.ok(!component.includes(forbidden));
});
