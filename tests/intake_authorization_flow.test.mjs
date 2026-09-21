import assert from "node:assert/strict";
import test from "node:test";
import {
  LOCAL_RTM_AUTHORIZATION_KIND,
  LOCAL_RTM_AUTHORIZATION_VERSION,
  appendLocalAuthorizationBinding,
  authorizationRoutes,
  continueIntakeAuthorization,
  intakeAuthorizationFlow,
  localSyntheticIdentityError,
  parseLocalAuthorizationCandidate,
  parseLocalAuthorizationIssue,
} from "../src/lib/intakeAuthorizationFlow.js";

const CASE_ID = "11111111-1111-4111-8111-111111111111";
const DOCUMENT_ID = "22222222-2222-4222-8222-222222222222";
const NONCE = "33333333-3333-4333-8333-333333333333";
function issueEnvelope() {
  return {
    ok: true, case_id: CASE_ID, authorized: false, signed_authority_verified: false,
    authorization_kind: LOCAL_RTM_AUTHORIZATION_KIND,
    authorization_evidence_status: "document_issued",
    authorization_document_binding: {
      case_id: CASE_ID, authorization_kind: LOCAL_RTM_AUTHORIZATION_KIND,
      generated_document_id: DOCUMENT_ID, generated_document_sha256: "a".repeat(64),
      generated_document_version: LOCAL_RTM_AUTHORIZATION_VERSION,
      document_nonce: NONCE, issuance_attestation_sha256: "b".repeat(64),
    },
  };
}
function candidateEnvelope() {
  return {
    ok: true, case_id: CASE_ID, authorized: false, signed_authority_verified: false,
    authorization_kind: LOCAL_RTM_AUTHORIZATION_KIND,
    authorization_evidence_status: "pending_review", document_id: DOCUMENT_ID,
    document_sha256: "c".repeat(64),
  };
}

test("only traffic fines select DGT; four consumer families explicitly opt in to the local generic flow", () => {
  for (const family of ["bancos", "energia", "telecomunicaciones", "seguros"]) {
    assert.equal(intakeAuthorizationFlow({ department: "claims", caseType: "consumer", family, localProfile: true }), LOCAL_RTM_AUTHORIZATION_KIND);
    for (const localProfile of [false, undefined, "true"]) {
      assert.equal(intakeAuthorizationFlow({ department: "claims", caseType: "consumer", family, localProfile }), "unavailable");
    }
  }
  for (const selection of [
    { department: "claims", caseType: "airline", family: "viajes" },
    { department: "claims", caseType: "consumer", family: "vivienda" },
    { department: "claims", caseType: "consumer", family: "" },
    { department: "traffic", caseType: "other_traffic", family: "trafico" },
    { department: "debt", caseType: "asnef_equifax", family: "morosidad" },
  ]) assert.equal(intakeAuthorizationFlow({ ...selection, localProfile: true }), "unavailable");
  assert.equal(intakeAuthorizationFlow({ department: "traffic", caseType: "fine" }), "dgt");
  assert.equal(intakeAuthorizationFlow({ department: "traffic", caseType: "vehicle_removal", localProfile: true }), "vehicle_removal");
});

test("generic issue, PDF and candidate use their own endpoints and do not claim DGT representation", () => {
  assert.deepEqual(authorizationRoutes(CASE_ID, LOCAL_RTM_AUTHORIZATION_KIND), {
    issue: `/cases/${CASE_ID}/rtm-authorization`, pdf: `/cases/${CASE_ID}/rtm-authorization-pdf`,
    candidate: `/cases/${CASE_ID}/rtm-authorization-signed`, issueBody: { consent: true },
  });
  assert.equal(authorizationRoutes(CASE_ID, "dgt").issueBody.authority_version, "v1_dgt_homologado");
  assert.throws(() => authorizationRoutes(CASE_ID, "unavailable"));
  assert.throws(() => authorizationRoutes("../other-case", LOCAL_RTM_AUTHORIZATION_KIND));
});

test("local synthetic identity requires the explicit test document and example.com mailbox", () => {
  assert.equal(localSyntheticIdentityError({ dni: "RTMTEST001", email: "prueba.bancos@example.com" }), "");
  for (const value of [
    { dni: "12345678Z", email: "prueba@example.com" },
    { dni: "RTMTEST002", email: "prueba@example.com" },
    { dni: "RTMTEST001", email: "prueba@example.com.attacker.test" },
    { dni: "RTMTEST001", email: "prueba@gmail.com" },
  ]) assert.notEqual(localSyntheticIdentityError(value), "");
});

test("generic local binding must identify the exact case, artifact and version without legal authorization", () => {
  const parsed = parseLocalAuthorizationIssue(issueEnvelope(), CASE_ID);
  assert.equal(parsed.binding.generated_document_version, LOCAL_RTM_AUTHORIZATION_VERSION);
  for (const mutate of [
    (p) => { p.authorized = true; },
    (p) => { p.signed_authority_verified = true; },
    (p) => { p.case_id = DOCUMENT_ID; },
    (p) => { p.authorization_kind = "dgt"; },
    (p) => { p.authorization_evidence_status = "verified"; },
    (p) => { p.authorization_document_binding.case_id = DOCUMENT_ID; },
    (p) => { p.authorization_document_binding.generated_document_version = "v1_dgt_homologado"; },
    (p) => { p.authorization_document_binding.generated_document_sha256 = ""; },
    (p) => { p.authorization_document_binding.generated_document_id = [DOCUMENT_ID]; },
    (p) => { delete p.authorization_document_binding.document_nonce; },
    (p) => { p.authorization_document_binding.extra = "unreviewed"; },
  ]) { const payload = issueEnvelope(); mutate(payload); assert.throws(() => parseLocalAuthorizationIssue(payload, CASE_ID)); }
});

test("candidate upload sends exactly the five issued binding fields and rejects another case", () => {
  const { binding } = parseLocalAuthorizationIssue(issueEnvelope(), CASE_ID);
  const fd = appendLocalAuthorizationBinding(new FormData(), binding, CASE_ID);
  assert.deepEqual([...fd.keys()].sort(), ["document_nonce", "generated_document_id", "generated_document_sha256", "generated_document_version", "issuance_attestation_sha256"].sort());
  assert.equal(fd.get("generated_document_id"), DOCUMENT_ID);
  assert.throws(() => appendLocalAuthorizationBinding(new FormData(), binding, DOCUMENT_ID));
});

test("a local candidate can only be pending review and never authorize or verify a signature", () => {
  assert.equal(parseLocalAuthorizationCandidate(candidateEnvelope(), CASE_ID).status, "pending_review");
  for (const changed of [
    { authorized: true }, { signed_authority_verified: true },
    { authorization_evidence_status: "verified" }, { case_id: DOCUMENT_ID },
    { document_sha256: "bad" }, { authorization_kind: "dgt" },
  ]) assert.throws(() => parseLocalAuthorizationCandidate({ ...candidateEnvelope(), ...changed }, CASE_ID));
});

test("failed emission preserves the draft and retries authorization without another intake", async () => {
  let draft = null;
  let intakeCalls = 0;
  let issueCalls = 0;
  let downloads = 0;
  const options = {
    createDraft: async () => { intakeCalls++; return { caseId: CASE_ID, authorizationFlow: LOCAL_RTM_AUTHORIZATION_KIND }; },
    persistDraft: (saved) => { draft = saved; },
    issueAuthorization: async () => { issueCalls++; throw new Error("emission unavailable"); },
    openAuthorization: async () => { downloads++; },
  };
  await assert.rejects(continueIntakeAuthorization(options), /emission unavailable/);
  assert.equal(draft.caseId, CASE_ID);
  assert.equal(draft.authorizationBinding, undefined);
  assert.equal(downloads, 0);
  const completed = await continueIntakeAuthorization({ ...options, draft,
    issueAuthorization: async () => { issueCalls++; return parseLocalAuthorizationIssue(issueEnvelope(), CASE_ID); },
  });
  assert.equal(completed.caseId, CASE_ID);
  assert.equal(intakeCalls, 1);
  assert.equal(issueCalls, 2);
  assert.equal(downloads, 1);
});

test("failed PDF opening retries only download, retaining the validated binding", async () => {
  let draft = null;
  let intakeCalls = 0;
  let issueCalls = 0;
  const options = {
    createDraft: async () => { intakeCalls++; return { caseId: CASE_ID, authorizationFlow: LOCAL_RTM_AUTHORIZATION_KIND }; },
    persistDraft: (saved) => { draft = saved; },
    issueAuthorization: async () => { issueCalls++; return parseLocalAuthorizationIssue(issueEnvelope(), CASE_ID); },
    openAuthorization: async () => { throw new Error("download failed"); },
  };
  await assert.rejects(continueIntakeAuthorization(options), /download failed/);
  assert.equal(draft.authorizationBinding.generated_document_id, DOCUMENT_ID);
  await continueIntakeAuthorization({ ...options, draft, openAuthorization: async () => {} });
  assert.equal(intakeCalls, 1);
  assert.equal(issueCalls, 1);
});

test("a malformed issue or an unconfirmed synthetic intake never opens a PDF", async () => {
  let draft;
  let issueCalls = 0;
  const options = {
    createDraft: async () => ({ caseId: CASE_ID, authorizationFlow: LOCAL_RTM_AUTHORIZATION_KIND }),
    persistDraft: (saved) => { draft = saved; },
    issueAuthorization: async () => { issueCalls++; return parseLocalAuthorizationIssue({ ok: true }, CASE_ID); },
    openAuthorization: async () => { assert.fail("No unbound PDF may open"); },
  };
  await assert.rejects(continueIntakeAuthorization(options));
  assert.equal(draft.caseId, CASE_ID);
  assert.equal(draft.authorizationBinding, undefined);
  await assert.rejects(continueIntakeAuthorization({ ...options,
    draft: { ...draft, blockedMessage: "test_mode not confirmed" },
  }), /test_mode not confirmed/);
  assert.equal(issueCalls, 1);
});

test("vehicle removal keeps its existing continuation without generic or DGT emission", async () => {
  const draft = { caseId: CASE_ID, authorizationFlow: "vehicle_removal" };
  const completed = await continueIntakeAuthorization({ draft,
    createDraft: () => assert.fail("already saved"), persistDraft: () => assert.fail("unchanged"),
    issueAuthorization: () => assert.fail("vehicle removal has its own consent"),
    openAuthorization: () => assert.fail("no generic PDF"),
  });
  assert.equal(completed, draft);
});
