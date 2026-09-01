import assert from "node:assert/strict";
import test from "node:test";

import {
  REG_RECOVERY_SNAPSHOT_VERSION,
  markRegSessionExpired,
  normalizeRegRecoverySnapshot,
  prepareRegSessionRecovery,
  resumeAfterRegReauthentication,
} from "../lib/reg-session-recovery.js";


const DELIVERY_ID = "11111111-1111-4111-8111-111111111111";
const WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";
const DOCUMENT_ID = "33333333-3333-4333-8333-333333333333";
const FINGERPRINT = "a".repeat(64);

function snapshot() {
  return {
    snapshotVersion: REG_RECOVERY_SNAPSHOT_VERSION,
    deliveryId: DELIVERY_ID,
    workspaceId: WORKSPACE_ID,
    taskFingerprintSha256: FINGERPRINT,
    packageManifestSha256: "d".repeat(64),
    destinationProfileId: "44444444-4444-4444-8444-444444444444",
    destinationProfileSha256: "e".repeat(64),
    destinationDisplayName: "Registro general sintético",
    representationMode: "self",
    portalOrigin: "https://reg.synthetic.example",
    formCode: "reg_general_v1",
    formFields: [
      { fieldCode: "subject", stepOrder: 1, value: "Recurso sintético" },
      { fieldCode: "facts", stepOrder: 2, value: "Hechos sintéticos" },
    ],
    documents: [
      {
        documentVersionId: DOCUMENT_ID,
        documentSha256: "b".repeat(64),
        itemOrder: 1,
        fieldCode: "main_filing",
        portalFilename: "recurso_sintetico.pdf",
      },
    ],
    syntheticOnly: true,
    legalEffect: false,
  };
}

test("snapshot freezes the exact ordered RTM reconstruction data", () => {
  const exact = normalizeRegRecoverySnapshot(snapshot());
  assert.ok(Object.isFrozen(exact));
  assert.ok(Object.isFrozen(exact.formFields));
  assert.ok(Object.isFrozen(exact.formFields[0]));
  assert.deepEqual(exact.formFields.map((field) => field.stepOrder), [1, 2]);
  assert.equal(exact.documents[0].documentSha256, "b".repeat(64));
  assert.equal(exact.destinationProfileSha256, "e".repeat(64));
  assert.equal(exact.packageManifestSha256, "d".repeat(64));
});

test("snapshot rejects bytes, certificate, cookie or other restricted material", () => {
  for (const restricted of [
    { document_bytes: "JVBERi0=" },
    { certificate: "pkcs12" },
    { cookie: "REG_SESSION=x" },
    { presigned_url: "https://storage.invalid/object" },
  ]) {
    assert.throws(
      () => normalizeRegRecoverySnapshot({ ...snapshot(), ...restricted }),
      /reg_recovery_restricted_material/
    );
  }
});

test("REG expiry keeps the RTM snapshot and records that REG has no draft", () => {
  const ready = prepareRegSessionRecovery(snapshot());
  const expired = markRegSessionExpired(ready);
  assert.equal(expired.state, "reg_session_expired");
  assert.equal(expired.rtmDraftPersisted, true);
  assert.equal(expired.regDraftPersisted, false);
  assert.equal(expired.regReauthenticationRequired, true);
  assert.deepEqual(expired.snapshot, ready.snapshot);
});

test("resume requires an explicit REG reauthentication result", () => {
  const expired = markRegSessionExpired(prepareRegSessionRecovery(snapshot()));
  assert.throws(
    () =>
      resumeAfterRegReauthentication(expired, {
        expectedTaskFingerprintSha256: FINGERPRINT,
      }),
    /reg_recovery_reauthentication_required/
  );
});

test("resume fails closed if the RTM task fingerprint changed", () => {
  const expired = markRegSessionExpired(prepareRegSessionRecovery(snapshot()));
  assert.throws(
    () =>
      resumeAfterRegReauthentication(expired, {
        regReauthenticated: true,
        expectedTaskFingerprintSha256: "c".repeat(64),
      }),
    /reg_recovery_fingerprint_mismatch/
  );
});

test("resume preserves fields and documents exactly and increments the attempt", () => {
  const ready = prepareRegSessionRecovery(snapshot());
  const resumed = resumeAfterRegReauthentication(markRegSessionExpired(ready), {
    regReauthenticated: true,
    expectedTaskFingerprintSha256: FINGERPRINT,
  });
  assert.equal(resumed.state, "rtm_ready");
  assert.equal(resumed.attemptNumber, 2);
  assert.deepEqual(resumed.snapshot.formFields, ready.snapshot.formFields);
  assert.deepEqual(resumed.snapshot.documents, ready.snapshot.documents);
  assert.equal(resumed.portalSessionMaterialPresent, false);
  assert.equal(resumed.externalEffectsExecuted, false);
});

test("invalid transitions and a fabricated REG draft are rejected", () => {
  const ready = prepareRegSessionRecovery(snapshot());
  assert.throws(() => markRegSessionExpired(markRegSessionExpired(ready)));
  assert.throws(
    () => markRegSessionExpired({ ...ready, regDraftPersisted: true }),
    /reg_recovery_state_invalid/
  );
  const unsafeFilename = snapshot();
  unsafeFilename.documents[0].portalFilename = "../recurso.pdf";
  assert.throws(
    () => normalizeRegRecoverySnapshot(unsafeFilename),
    /reg_recovery_document_invalid/
  );
});
