export const REG_SESSION_RECOVERY_CONTRACT_VERSION =
  "rtm.presenter.reg.session.recovery.v1";
export const REG_RECOVERY_SNAPSHOT_VERSION =
  "rtm.presenter.reg.recovery.snapshot.v1";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const CODE_PATTERN = /^[a-z][a-z0-9_.-]{1,127}$/;
const FORBIDDEN_KEYS = new Set([
  "password",
  "secret",
  "token",
  "cookie",
  "certificate",
  "private_key",
  "document_bytes",
  "blob",
  "b2_bucket",
  "b2_key",
  "presigned_url",
  "portal_session",
]);

function invalid(code) {
  throw new Error(code);
}

function assertNoRestrictedMaterial(value) {
  const pending = [value];
  while (pending.length) {
    const current = pending.pop();
    if (!current || typeof current !== "object") continue;
    if (Array.isArray(current)) {
      pending.push(...current);
      continue;
    }
    for (const [key, child] of Object.entries(current)) {
      if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
        invalid("reg_recovery_restricted_material");
      }
      pending.push(child);
    }
  }
}

function exactObject(value, keys, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(code);
  const actual = Object.keys(value);
  if (actual.length !== keys.size || actual.some((key) => !keys.has(key))) {
    invalid(code);
  }
}

function exactUuid(value, code) {
  const normalized = String(value || "").toLowerCase();
  if (!UUID_PATTERN.test(normalized)) invalid(code);
  return normalized;
}

function exactSha256(value, code) {
  const normalized = String(value || "").toLowerCase();
  if (!SHA256_PATTERN.test(normalized)) invalid(code);
  return normalized;
}

function exactCode(value, code) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!CODE_PATTERN.test(normalized)) invalid(code);
  return normalized;
}

function exactPortalOrigin(value) {
  const raw = String(value || "").trim();
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    invalid("reg_recovery_portal_origin_invalid");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    raw !== parsed.origin
  ) {
    invalid("reg_recovery_portal_origin_invalid");
  }
  return parsed.origin;
}

function normalizeFields(values) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 32) {
    invalid("reg_recovery_fields_invalid");
  }
  const seen = new Set();
  return Object.freeze(
    values.map((value, index) => {
      exactObject(
        value,
        new Set(["fieldCode", "stepOrder", "value"]),
        "reg_recovery_field_invalid"
      );
      const fieldCode = exactCode(value.fieldCode, "reg_recovery_field_invalid");
      const text = String(value.value ?? "");
      if (
        value.stepOrder !== index + 1 ||
        seen.has(fieldCode) ||
        text.length > 12_000 ||
        [...text].some(
          (character) =>
            character.charCodeAt(0) < 32 && !["\n", "\t"].includes(character)
        )
      ) {
        invalid("reg_recovery_field_invalid");
      }
      seen.add(fieldCode);
      return Object.freeze({ fieldCode, stepOrder: index + 1, value: text });
    })
  );
}

function normalizeDocuments(values) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 32) {
    invalid("reg_recovery_documents_invalid");
  }
  const seen = new Set();
  return Object.freeze(
    values.map((value, index) => {
      exactObject(
        value,
        new Set([
          "documentVersionId",
          "documentSha256",
          "itemOrder",
          "fieldCode",
          "portalFilename",
        ]),
        "reg_recovery_document_invalid"
      );
      const documentVersionId = exactUuid(
        value.documentVersionId,
        "reg_recovery_document_invalid"
      );
      const portalFilename = String(value.portalFilename || "");
      if (
        value.itemOrder !== index + 1 ||
        seen.has(documentVersionId) ||
        !portalFilename ||
        portalFilename.length > 180 ||
        portalFilename !== portalFilename.trim() ||
        !/^[A-Za-z0-9._() -]+$/.test(portalFilename) ||
        /^[ .]|[ .]$/.test(portalFilename)
      ) {
        invalid("reg_recovery_document_invalid");
      }
      seen.add(documentVersionId);
      return Object.freeze({
        documentVersionId,
        documentSha256: exactSha256(
          value.documentSha256,
          "reg_recovery_document_invalid"
        ),
        itemOrder: index + 1,
        fieldCode: exactCode(value.fieldCode, "reg_recovery_document_invalid"),
        portalFilename,
      });
    })
  );
}

export function normalizeRegRecoverySnapshot(value) {
  assertNoRestrictedMaterial(value);
  exactObject(
    value,
    new Set([
      "snapshotVersion",
      "deliveryId",
      "workspaceId",
      "taskFingerprintSha256",
      "packageManifestSha256",
      "destinationProfileId",
      "destinationProfileSha256",
      "destinationDisplayName",
      "representationMode",
      "portalOrigin",
      "formCode",
      "formFields",
      "documents",
      "syntheticOnly",
      "legalEffect",
    ]),
    "reg_recovery_snapshot_invalid"
  );
  if (
    value.snapshotVersion !== REG_RECOVERY_SNAPSHOT_VERSION ||
    value.syntheticOnly !== true ||
    value.legalEffect !== false ||
    !["self", "representative"].includes(value.representationMode)
  ) {
    invalid("reg_recovery_snapshot_invalid");
  }
  const destinationDisplayName = String(value.destinationDisplayName || "")
    .trim()
    .replace(/\s+/g, " ");
  if (destinationDisplayName.length < 2 || destinationDisplayName.length > 240) {
    invalid("reg_recovery_snapshot_invalid");
  }
  return Object.freeze({
    snapshotVersion: REG_RECOVERY_SNAPSHOT_VERSION,
    deliveryId: exactUuid(value.deliveryId, "reg_recovery_snapshot_invalid"),
    workspaceId: exactUuid(value.workspaceId, "reg_recovery_snapshot_invalid"),
    taskFingerprintSha256: exactSha256(
      value.taskFingerprintSha256,
      "reg_recovery_snapshot_invalid"
    ),
    packageManifestSha256: exactSha256(
      value.packageManifestSha256,
      "reg_recovery_snapshot_invalid"
    ),
    destinationProfileId: exactUuid(
      value.destinationProfileId,
      "reg_recovery_snapshot_invalid"
    ),
    destinationProfileSha256: exactSha256(
      value.destinationProfileSha256,
      "reg_recovery_snapshot_invalid"
    ),
    destinationDisplayName,
    representationMode: value.representationMode,
    portalOrigin: exactPortalOrigin(value.portalOrigin),
    formCode: exactCode(value.formCode, "reg_recovery_snapshot_invalid"),
    formFields: normalizeFields(value.formFields),
    documents: normalizeDocuments(value.documents),
    syntheticOnly: true,
    legalEffect: false,
  });
}

function recoveryState(snapshot, state, attemptNumber) {
  return Object.freeze({
    recoveryContractVersion: REG_SESSION_RECOVERY_CONTRACT_VERSION,
    state,
    attemptNumber,
    snapshot,
    rtmDraftPersisted: true,
    regDraftPersisted: false,
    regSessionExpired: state === "reg_session_expired",
    regReauthenticationRequired: state === "reg_session_expired",
    portalSessionMaterialPresent: false,
    documentBytesPresent: false,
    certificateMaterialPresent: false,
    finalSubmitAutomated: false,
    externalEffectsExecuted: false,
  });
}

function validateRecoveryState(value) {
  assertNoRestrictedMaterial(value);
  exactObject(
    value,
    new Set([
      "recoveryContractVersion",
      "state",
      "attemptNumber",
      "snapshot",
      "rtmDraftPersisted",
      "regDraftPersisted",
      "regSessionExpired",
      "regReauthenticationRequired",
      "portalSessionMaterialPresent",
      "documentBytesPresent",
      "certificateMaterialPresent",
      "finalSubmitAutomated",
      "externalEffectsExecuted",
    ]),
    "reg_recovery_state_invalid"
  );
  if (
    value.recoveryContractVersion !== REG_SESSION_RECOVERY_CONTRACT_VERSION ||
    !["rtm_ready", "reg_session_expired"].includes(value.state) ||
    !Number.isInteger(value.attemptNumber) ||
    value.attemptNumber < 1 ||
    value.rtmDraftPersisted !== true ||
    value.regDraftPersisted !== false ||
    value.regSessionExpired !== (value.state === "reg_session_expired") ||
    value.regReauthenticationRequired !==
      (value.state === "reg_session_expired") ||
    value.portalSessionMaterialPresent !== false ||
    value.documentBytesPresent !== false ||
    value.certificateMaterialPresent !== false ||
    value.finalSubmitAutomated !== false ||
    value.externalEffectsExecuted !== false
  ) {
    invalid("reg_recovery_state_invalid");
  }
  return recoveryState(
    normalizeRegRecoverySnapshot(value.snapshot),
    value.state,
    value.attemptNumber
  );
}

export function prepareRegSessionRecovery(snapshot) {
  return recoveryState(normalizeRegRecoverySnapshot(snapshot), "rtm_ready", 1);
}

export function markRegSessionExpired(current) {
  const exact = validateRecoveryState(current);
  if (exact.state !== "rtm_ready") invalid("reg_recovery_transition_invalid");
  return recoveryState(exact.snapshot, "reg_session_expired", exact.attemptNumber);
}

export function resumeAfterRegReauthentication(
  current,
  { regReauthenticated = false, expectedTaskFingerprintSha256 = "" } = {}
) {
  const exact = validateRecoveryState(current);
  if (
    exact.state !== "reg_session_expired" ||
    regReauthenticated !== true
  ) {
    invalid("reg_recovery_reauthentication_required");
  }
  const expected = exactSha256(
    expectedTaskFingerprintSha256,
    "reg_recovery_fingerprint_invalid"
  );
  if (expected !== exact.snapshot.taskFingerprintSha256) {
    invalid("reg_recovery_fingerprint_mismatch");
  }
  return recoveryState(exact.snapshot, "rtm_ready", exact.attemptNumber + 1);
}
