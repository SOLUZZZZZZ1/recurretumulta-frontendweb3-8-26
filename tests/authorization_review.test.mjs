import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizationRoot, validateAuthorization, buildAuthorizationDecision, authorizationJson} from '../src/lib/authorizationReview.js';

const CASE = '32f865da-25df-5a3f-bf59-234da18621a6';
const DOCUMENT = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const HASH = 'a'.repeat(64), ATTESTATION = 'b'.repeat(64), NOW = 1794828600000;
const projection = () => ({id: CASE, authorization_evidence_status: 'pending_review', signed_authority_verified: false,
  candidate_document_id: DOCUMENT, candidate_attestation_sha256: ATTESTATION});
const decision = () => ({candidate: validateAuthorization(projection(), CASE),
  reviewed: {document_id: DOCUMENT, observed_sha256: HASH, read_confirmed: true}, pdfHash: HASH,
  checks: {generated_document_matches: true, identity_matches: true, signature_present: true},
  decision: 'approve', reauthenticatedAt: NOW - 1000, now: NOW});

test('Binds approval to the verified candidate and the actual viewed PDF', () => {
  const result = buildAuthorizationDecision(decision());
  assert.equal(result.candidate_document_id, DOCUMENT);
  assert.equal(result.candidate_attestation_sha256, ATTESTATION);
  assert.equal(result.reviewed_entire_document, true);
  assert.equal(result.reason_code, null);
});
test('Rejects a response from another case or inconsistent verified state', () => {
  assert.throws(() => validateAuthorization({...projection(), id: OTHER}, CASE));
  assert.throws(() => validateAuthorization({...projection(), signed_authority_verified: true}, CASE));
  assert.throws(() => validateAuthorization({...projection(), candidate_attestation_sha256: undefined}, CASE));
  assert.throws(() => authorizationRoot('../another-case'));
});
test('A different file, stale hash or incomplete reading cannot approve or reject', () => {
  for (const reviewed of [null, {document_id: OTHER, observed_sha256: HASH, read_confirmed: true},
    {document_id: DOCUMENT, observed_sha256: 'c'.repeat(64), read_confirmed: true},
    {document_id: DOCUMENT, observed_sha256: HASH, read_confirmed: false}]) {
    assert.throws(() => buildAuthorizationDecision({...decision(), reviewed}));
    assert.throws(() => buildAuthorizationDecision({...decision(), reviewed, decision: 'reject', reason: 'signature_missing'}));
  }
});
test('Every approval check is independent and cannot be implied by upload', () => {
  for (const key of ['generated_document_matches', 'identity_matches', 'signature_present']) {
    const value = decision(); value.checks[key] = false;
    assert.throws(() => buildAuthorizationDecision(value));
  }
  assert.throws(() => buildAuthorizationDecision({...decision(), candidate: {...decision().candidate, status: 'verified'}}));
});
test('Expired, future or absent reauthentication blocks decisions', () => {
  for (const reauthenticatedAt of [null, undefined, NaN, NOW - 270000, NOW + 1]) {
    assert.throws(() => buildAuthorizationDecision({...decision(), reauthenticatedAt}));
  }
});
test('Rejecting missing signature keeps the failed checks and requires a known reason', () => {
  const value = decision(); value.checks.signature_present = false;
  const result = buildAuthorizationDecision({...value, decision: 'reject', reason: 'signature_missing'});
  assert.equal(result.signature_present, false); assert.equal(result.reason_code, 'signature_missing');
  for (const reason of ['', '__proto__', 'unlisted']) {
    assert.throws(() => buildAuthorizationDecision({...value, decision: 'reject', reason}));
  }
});
test('Network failure is not retried or converted into a successful operation', async () => {
  let calls = 0;
  await assert.rejects(authorizationJson(async () => {calls++; throw new Error('network');}, authorizationRoot(CASE)));
  assert.equal(calls, 1);
});
test('Malformed and failed responses remain errors without exposing arbitrary server text', async () => {
  await assert.rejects(authorizationJson(async () => new Response('<html>no</html>'), authorizationRoot(CASE)));
  await assert.rejects(authorizationJson(async () => new Response(JSON.stringify({detail: 'private diagnostic'}), {status: 409}), authorizationRoot(CASE)),
    error => !error.message.includes('private diagnostic') && error.message.includes('cambiado'));
});
