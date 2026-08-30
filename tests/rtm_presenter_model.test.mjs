import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRtmPresenterFreezePayload,
  evaluateRtmPresenterBoundary,
  hasExceptionalExportCapability,
  hasPresenterDestinationProposeCapability,
  hasPresenterDocumentIngestCapability,
  hasPresenterDeliveryPrepareCapability,
  latestPresenterDocumentVersions,
  normalizePresenterRepresentationMode,
  orderedPresenterFields,
} from "../src/rtm-presenter/rtmPresenterModel.js";
import {
  createRtmPresenterClient,
  RTM_PRESENTER_MAX_EXTERNAL_DOCUMENT_BYTES,
  validateRtmPresenterAttachmentFilename,
  validateRtmPresenterDestinationProposal,
  validateRtmPresenterExternalFile,
} from "../src/rtm-presenter/rtmPresenterApi.js";

const CASE_ID = "11111111-1111-1111-1111-111111111111";
const PROFILE_ID = "22222222-2222-2222-2222-222222222222";
const FINE_VERSION_ID = "33333333-3333-3333-3333-333333333333";
const AUTH_VERSION_ID = "44444444-4444-4444-4444-444444444444";
const SHA = "a".repeat(64);

const destinationProfile = {
  destination_profile_id: PROFILE_ID,
  profile_code: "municipal-appeal",
  profile_version: 3,
  profile_sha256: "c".repeat(64),
  display_name: "Sede municipal sintética",
  portal_origin: "https://sede.synthetic.example",
  authorization_field_code: "authorization",
  representation_modes: ["self", "representative"],
  fields: [
    {
      step_order: 1,
      field_code: "fine",
      required: true,
      purposes: ["original_fine"],
      media_types: ["application/pdf"],
      max_files: 1,
      max_bytes: 2_000_000,
    },
    {
      step_order: 2,
      field_code: "authorization",
      required: false,
      required_for_modes: ["representative"],
      purposes: ["representation_authorization"],
      media_types: ["application/pdf"],
      max_files: 1,
      max_bytes: 1_000_000,
    },
  ],
};

const documents = [
  {
    document_version_id: FINE_VERSION_ID,
    case_id: CASE_ID,
    logical_document_id: "66666666-6666-6666-6666-666666666666",
    version_number: 2,
    sha256: SHA,
    purpose: "original_fine",
    state: "active",
    scan_status: "clean",
    original_filename: "multa.pdf",
    media_type: "application/pdf",
    size_bytes: 800_000,
    source_kind: "synthetic_fixture",
    synthetic_only: true,
  },
  {
    document_version_id: AUTH_VERSION_ID,
    case_id: CASE_ID,
    logical_document_id: "77777777-7777-7777-7777-777777777777",
    version_number: 1,
    sha256: "b".repeat(64),
    purpose: "representation_authorization",
    state: "active",
    scan_status: "clean",
    original_filename: "autorizacion.pdf",
    media_type: "application/pdf",
    size_bytes: 250_000,
    source_kind: "synthetic_fixture",
    synthetic_only: true,
  },
];

function jsonResponse(payload = { ok: true }, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) =>
        name.toLowerCase() === "content-type" ? "application/json" : null,
    },
    text: async () => JSON.stringify(payload),
  };
}

test("presenter is fail-closed outside synthetic staging", () => {
  assert.equal(
    evaluateRtmPresenterBoundary({ environment: "staging", syntheticOnly: true })
      .allowed,
    true
  );
  assert.equal(
    evaluateRtmPresenterBoundary({ environment: "production", syntheticOnly: true })
      .allowed,
    false
  );
  assert.equal(
    evaluateRtmPresenterBoundary({ environment: "staging", syntheticOnly: false })
      .allowed,
    false
  );
});

test("interested maps to backend self and fields follow verified step order", () => {
  assert.equal(normalizePresenterRepresentationMode("interested"), "self");
  assert.equal(normalizePresenterRepresentationMode("self"), "self");
  assert.deepEqual(
    orderedPresenterFields(destinationProfile, "interested").map(
      (field) => field.fieldCode
    ),
    ["fine", "authorization"]
  );
});

test("profile field order is explicit, unique and contiguous", () => {
  const reversed = structuredClone(destinationProfile);
  reversed.fields.reverse();
  assert.deepEqual(
    orderedPresenterFields(reversed, "self").map((field) => field.fieldCode),
    ["fine", "authorization"]
  );

  for (const invalidSteps of [
    [1, 1],
    [1, 3],
    [0, 1],
  ]) {
    const invalid = structuredClone(destinationProfile);
    invalid.fields.forEach((field, index) => {
      field.step_order = invalidSteps[index];
    });
    assert.throws(
      () => orderedPresenterFields(invalid, "self"),
      /orden|step_order/
    );
  }
});

test("representation makes its authorization field required", () => {
  const selfFields = orderedPresenterFields(destinationProfile, "self");
  const representativeFields = orderedPresenterFields(
    destinationProfile,
    "representative"
  );
  assert.equal(selfFields[1].required, false);
  assert.equal(representativeFields[1].required, true);
});

test("representation authorization must occupy the profile authorization field", () => {
  const wrongFieldProfile = structuredClone(destinationProfile);
  wrongFieldProfile.fields[1].required_for_modes = [];
  wrongFieldProfile.fields.push({
    step_order: 3,
    field_code: "evidence",
    required: false,
    purposes: ["representation_authorization"],
    media_types: ["application/pdf"],
    max_files: 1,
    max_bytes: 1_000_000,
  });
  assert.throws(
    () =>
      buildRtmPresenterFreezePayload({
        destinationProfile: wrongFieldProfile,
        representationMode: "representative",
        selections: {
          fine: [FINE_VERSION_ID],
          evidence: [AUTH_VERSION_ID],
        },
        documents,
        authorizationDocumentVersionId: AUTH_VERSION_ID,
        expiresAt: "2030-01-01T00:15:00Z",
      }),
    /autorización exacta/i
  );
});

test("portal origin is HTTPS-only and filenames fit the backend contract", () => {
  const httpProfile = structuredClone(destinationProfile);
  httpProfile.portal_origin = "http://sede.synthetic.example";
  assert.throws(
    () =>
      buildRtmPresenterFreezePayload({
        destinationProfile: httpProfile,
        representationMode: "self",
        selections: { fine: [FINE_VERSION_ID] },
        documents,
        expiresAt: "2030-01-01T00:15:00Z",
      }),
    /origen exacto de sede/i
  );

  const longNameDocuments = structuredClone(documents);
  longNameDocuments[0].original_filename = `${"a".repeat(157)}.pdf`;
  assert.throws(
    () =>
      buildRtmPresenterFreezePayload({
        destinationProfile,
        representationMode: "self",
        selections: { fine: [FINE_VERSION_ID] },
        documents: longNameDocuments,
        expiresAt: "2030-01-01T00:15:00Z",
      }),
    /nombre de archivo válido/i
  );
});

test("freeze payload matches the strict backend body and binds exact versions", () => {
  const payload = buildRtmPresenterFreezePayload({
    destinationProfile,
    representationMode: "representative",
    selections: {
      fine: [FINE_VERSION_ID],
      authorization: [AUTH_VERSION_ID],
    },
    documents,
    authorizationDocumentVersionId: AUTH_VERSION_ID,
    expiresAt: "2030-01-01T00:15:00.000Z",
  });

  assert.deepEqual(payload, {
    destination_profile_id: PROFILE_ID,
    portal_origin: "https://sede.synthetic.example",
    representation_mode: "representative",
    authorization_document_version_id: AUTH_VERSION_ID,
    expires_at: "2030-01-01T00:15:00.000Z",
    items: [
      {
        document_version_id: FINE_VERSION_ID,
        item_order: 1,
        field_code: "fine",
        portal_filename: "multa.pdf",
      },
      {
        document_version_id: AUTH_VERSION_ID,
        item_order: 2,
        field_code: "authorization",
        portal_filename: "autorizacion.pdf",
      },
    ],
  });
  assert.equal(Object.hasOwn(payload, "caseId"), false);
  assert.equal(Object.hasOwn(payload, "syntheticOnly"), false);
});

test("self mode sends null authorization and never sends interested", () => {
  const payload = buildRtmPresenterFreezePayload({
    destinationProfile,
    actorMode: "interested",
    selections: { fine: [FINE_VERSION_ID] },
    documents,
    expiresAt: "2030-01-01T00:15:00Z",
  });
  assert.equal(payload.representation_mode, "self");
  assert.equal(payload.authorization_document_version_id, null);
});

test("unsafe, oversize, or repeated versions cannot enter a package", () => {
  const unsafe = structuredClone(documents);
  unsafe[0].scan_status = "pending";
  assert.throws(
    () =>
      buildRtmPresenterFreezePayload({
        destinationProfile,
        representationMode: "self",
        selections: { fine: [FINE_VERSION_ID] },
        documents: unsafe,
        expiresAt: "2030-01-01T00:15:00Z",
      }),
    /no cumple el perfil/
  );

  const repeatedProfile = structuredClone(destinationProfile);
  repeatedProfile.fields[1].purposes = ["original_fine"];
  assert.throws(
    () =>
      buildRtmPresenterFreezePayload({
        destinationProfile: repeatedProfile,
        representationMode: "self",
        selections: {
          fine: [FINE_VERSION_ID],
          authorization: [FINE_VERSION_ID],
        },
        documents,
        expiresAt: "2030-01-01T00:15:00Z",
      }),
    /no puede ocupar dos casillas/
  );
});

test("exceptional output depends on the exact capability, never a role", () => {
  assert.equal(hasExceptionalExportCapability(["rtm.admin"]), false);
  assert.equal(hasExceptionalExportCapability(["admin"]), false);
  assert.equal(
    hasExceptionalExportCapability(["ops.documents.export_exceptional"]),
    true
  );
  assert.equal(
    hasExceptionalExportCapability(["presenter.admin_export"]),
    false
  );
});

test("external document ingress depends on its exact capability", () => {
  assert.equal(hasPresenterDocumentIngestCapability(["rtm.admin"]), false);
  assert.equal(hasPresenterDocumentIngestCapability(["presenter.documents.read"]), false);
  assert.equal(
    hasPresenterDocumentIngestCapability(["presenter.documents.ingest"]),
    true
  );
  assert.equal(
    hasPresenterDocumentIngestCapability(["presenter.documents.ingest.extra"]),
    false
  );
  assert.equal(
    hasPresenterDocumentIngestCapability([" presenter.documents.ingest "]),
    false
  );
});

test("destination proposals depend on their exact capability", () => {
  assert.equal(hasPresenterDestinationProposeCapability(["rtm.admin"]), false);
  assert.equal(
    hasPresenterDestinationProposeCapability(["presenter.destination.propose"]),
    true
  );
  assert.equal(
    hasPresenterDestinationProposeCapability(["presenter.destination.verify"]),
    false
  );
});

test("controlled delivery preparation depends on its exact capability", () => {
  assert.equal(hasPresenterDeliveryPrepareCapability(["rtm.admin"]), false);
  assert.equal(
    hasPresenterDeliveryPrepareCapability(["presenter.delivery.prepare"]),
    true
  );
  assert.equal(
    hasPresenterDeliveryPrepareCapability(["presenter.delivery.execute"]),
    false
  );
});

test("new external versions can supersede only the absolute latest logical version", () => {
  const versionHistory = [
    { ...documents[0], document_version_id: "version-1", version_number: 1 },
    { ...documents[0], document_version_id: "version-3", version_number: 3, state: "rejected", scan_status: "rejected" },
    { ...documents[0], document_version_id: "version-2", version_number: 2 },
    documents[1],
  ];
  assert.deepEqual(
    latestPresenterDocumentVersions(versionHistory).map(
      (item) => item.document_version_id
    ),
    ["version-3", AUTH_VERSION_ID]
  );
});

test("a pending successor invalidates an older active version for freeze", () => {
  const history = [
    documents[0],
    {
      ...documents[0],
      document_version_id: "88888888-8888-4888-8888-888888888888",
      version_number: 3,
      state: "review",
      scan_status: "pending",
      sha256: "d".repeat(64),
    },
    documents[1],
  ];
  assert.throws(
    () =>
      buildRtmPresenterFreezePayload({
        destinationProfile,
        representationMode: "self",
        selections: { fine: [FINE_VERSION_ID] },
        documents: history,
        expiresAt: "2030-01-01T00:15:00Z",
      }),
    /versión seleccionada no cumple/i
  );
});

test("normal client only loads workspace and freezes by case", async () => {
  const calls = [];
  const client = createRtmPresenterClient({
    fetchImpl: async (path, options) => {
      calls.push({ path, options });
      return jsonResponse({ ok: true });
    },
    getAuthHeaders: () => ({ Authorization: "Bearer synthetic-operator" }),
    environment: "staging",
    syntheticOnly: true,
  });

  await client.loadWorkspace(CASE_ID);
  assert.equal(
    calls.at(-1).path,
    `/api/ops/presenter/cases/${CASE_ID}/workspace`
  );
  assert.equal(calls.at(-1).options.credentials, "same-origin");
  assert.equal(calls.at(-1).options.cache, "no-store");
  assert.equal(
    calls.at(-1).options.headers.Authorization,
    "Bearer synthetic-operator"
  );

  await client.loadSignatureQueue({ limit: 25 });
  assert.equal(
    calls.at(-1).path,
    "/api/ops/presenter/signature-queue?limit=25"
  );
  assert.equal(calls.at(-1).options.method, "GET");

  await client.searchDestinations(CASE_ID, "Ayuntamiento de Madrid");
  assert.equal(
    calls.at(-1).path,
    `/api/ops/presenter/cases/${CASE_ID}/destinations/search?q=Ayuntamiento%20de%20Madrid&limit=20`
  );
  assert.equal(calls.at(-1).options.method, "GET");

  await client.proposeDestinationLink(CASE_ID, {
    label: " Recurso de tráfico sintético ",
    portalUrl: "https://tramite.synthetic.example/recurso",
  });
  assert.equal(
    calls.at(-1).path,
    `/api/ops/presenter/cases/${CASE_ID}/destinations/proposals`
  );
  assert.equal(calls.at(-1).options.method, "POST");
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), {
    label: "Recurso de tráfico sintético",
    portal_url: "https://tramite.synthetic.example/recurso",
  });

  const body = { destination_profile_id: PROFILE_ID, items: [] };
  await client.freezePackage(CASE_ID, body, {
    idempotencyKey: "idem-presenter-1",
  });
  assert.equal(
    calls.at(-1).path,
    `/api/ops/presenter/cases/${CASE_ID}/packages/freeze`
  );
  assert.equal(calls.at(-1).options.method, "POST");
  assert.equal(calls.at(-1).options.headers["Idempotency-Key"], "idem-presenter-1");
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), body);
  const packageId = "55555555-5555-5555-5555-555555555555";
  const portalConfirmations = {
    destination_reviewed: true,
    interested_confirmed: true,
    representation_confirmed: true,
    text_confirmed: true,
    attachments_confirmed: true,
  };
  const portalPreparation = {
    formCode: "reg_general_v1",
    values: {
      subject: " Recurso sintético ",
      facts: "Hechos sintéticos.",
      request: "Solicitud sintética.",
    },
    confirmations: portalConfirmations,
  };
  await client.prepareDelivery(CASE_ID, packageId, {
    channel: "portal",
    portalPreparation,
    idempotencyKey: "idem-delivery-0001",
  });
  assert.equal(
    calls.at(-1).path,
    `/api/ops/presenter/cases/${CASE_ID}/packages/${packageId}/deliveries/prepare`
  );
  assert.equal(calls.at(-1).options.method, "POST");
  assert.equal(
    calls.at(-1).options.headers["Idempotency-Key"],
    "idem-delivery-0001"
  );
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), {
    channel: "portal",
    recipient_email: null,
    recipient_confirmed: false,
    correspondence: null,
    portal_preparation: {
      form_code: "reg_general_v1",
      values: {
        subject: "Recurso sintético",
        facts: "Hechos sintéticos.",
        request: "Solicitud sintética.",
      },
      confirmations: portalConfirmations,
    },
  });
  const correspondenceDraft = {
    subject: "Reclamación sintética",
    body: "Texto sintético revisado.",
    confirmations: {
      destination_reviewed: true,
      interested_confirmed: true,
      representation_confirmed: true,
      text_confirmed: true,
      attachments_confirmed: true,
      data_minimization_confirmed: true,
    },
  };
  await client.prepareDelivery(CASE_ID, packageId, {
    channel: "email",
    recipientEmail: " manual@synthetic.example ",
    recipientConfirmed: true,
    correspondenceDraft,
    idempotencyKey: "idem-delivery-0002",
  });
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), {
    channel: "email",
    recipient_email: "manual@synthetic.example",
    recipient_confirmed: true,
    correspondence: correspondenceDraft,
    portal_preparation: null,
  });
  assert.equal(calls.length, 7);
  assert.ok(calls.every((call) => !call.path.endsWith("/documents/external")));
});

test("destination proposal validation remains synthetic and pending-only", () => {
  assert.deepEqual(
    validateRtmPresenterDestinationProposal(
      "  Recurso DGT sintético  ",
      "https://tramite.synthetic.example/recurso"
    ),
    {
      label: "Recurso DGT sintético",
      portalUrl: "https://tramite.synthetic.example/recurso",
    }
  );
  for (const portalUrl of [
    "https://sede.dgt.gob.es/recurso",
    "http://tramite.synthetic.example/recurso",
    "https://user:secret@tramite.synthetic.example/recurso",
    "https://tramite.synthetic.example/recurso?session=secret",
    "https://tramite.synthetic.example/recurso#paso",
    "https://tramite.synthetic.example/a/%2e%2e/b",
  ]) {
    assert.throws(
      () => validateRtmPresenterDestinationProposal("Sede sintética", portalUrl),
      /enlace|Staging/
    );
  }
});

test("external ingress validates the file and sends the exact multipart contract", async () => {
  const calls = [];
  const client = createRtmPresenterClient({
    fetchImpl: async (path, options) => {
      calls.push({ path, options });
      return jsonResponse({ ok: true });
    },
    getAuthHeaders: () => ({
      Authorization: "Bearer synthetic-operator",
      "Content-Type": "application/json",
    }),
    environment: "staging",
    syntheticOnly: true,
  });
  const file = new File(["%PDF-1.7 synthetic"], "prueba-sintetica.pdf", {
    type: "application/pdf",
  });

  await client.uploadExternalDocument(CASE_ID, {
    purpose: "supporting_evidence",
    file,
    attachmentFilename: "Resolucion_sancionadora_DGT.pdf",
    syntheticConfirmed: true,
  });
  const first = calls.at(-1);
  assert.equal(
    first.path,
    `/api/ops/presenter/cases/${CASE_ID}/documents/external`
  );
  assert.equal(first.options.method, "POST");
  assert.equal(first.options.headers.Authorization, "Bearer synthetic-operator");
  assert.equal(first.options.headers["Content-Type"], undefined);
  assert.ok(first.options.body instanceof FormData);
  assert.equal(first.options.body.get("purpose"), "supporting_evidence");
  assert.equal(
    first.options.body.get("source_original_filename"),
    "prueba-sintetica.pdf"
  );
  assert.equal(first.options.body.get("synthetic_confirmed"), "true");
  assert.equal(first.options.body.get("supersedes_document_version_id"), null);
  assert.equal(
    first.options.body.get("file").name,
    "Resolucion_sancionadora_DGT.pdf"
  );

  await client.uploadExternalDocument(CASE_ID, {
    purpose: "representation_authorization",
    file,
    syntheticConfirmed: true,
    supersedesDocumentVersionId: AUTH_VERSION_ID,
  });
  assert.equal(
    calls.at(-1).options.body.get("supersedes_document_version_id"),
    AUTH_VERSION_ID
  );
});

test("external ingress rejects unconfirmed, mismatched and oversized files before fetch", async () => {
  let calls = 0;
  const client = createRtmPresenterClient({
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({ ok: true });
    },
    environment: "staging",
    syntheticOnly: true,
  });
  const pdf = new File(["%PDF-1.7 synthetic"], "prueba.pdf", {
    type: "application/pdf",
  });
  const mismatched = new File(["synthetic"], "prueba.png", {
    type: "image/jpeg",
  });
  const oversized = {
    name: "prueba.pdf",
    size: RTM_PRESENTER_MAX_EXTERNAL_DOCUMENT_BYTES + 1,
    type: "application/pdf",
    slice() {},
  };

  await assert.rejects(
    client.uploadExternalDocument(CASE_ID, {
      purpose: "supporting_evidence",
      file: pdf,
    }),
    /completamente sintético/i
  );
  await assert.rejects(
    client.uploadExternalDocument(CASE_ID, {
      purpose: "original_fine",
      file: pdf,
      syntheticConfirmed: true,
    }),
    /finalidad documental/i
  );
  assert.throws(() => validateRtmPresenterExternalFile(mismatched), /Solo se admiten/);
  assert.throws(() => validateRtmPresenterExternalFile(oversized), /25 MiB/);
  assert.equal(calls, 0);
  assert.equal(
    validateRtmPresenterAttachmentFilename("DNI_Ramon.pdf", "application/pdf"),
    "DNI_Ramon.pdf"
  );
  assert.throws(
    () => validateRtmPresenterAttachmentFilename("DNI_Ramon.png", "application/pdf"),
    /conservar la extensión/
  );
});

test("external ingress file allowlist accepts only matching PDF, DOCX, JPEG and PNG", () => {
  for (const [name, type] of [
    ["documento.pdf", "application/pdf"],
    [
      "documento.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    ["imagen.jpg", "image/jpeg"],
    ["imagen.jpeg", "image/jpeg"],
    ["imagen.png", "image/png"],
  ]) {
    const metadata = validateRtmPresenterExternalFile(
      new File(["synthetic"], name, { type })
    );
    assert.equal(metadata.filename, name);
    assert.equal(metadata.mediaType, type);
  }
  assert.throws(
    () =>
      validateRtmPresenterExternalFile(
        new File(["synthetic"], "archivo.exe", {
          type: "application/octet-stream",
        })
      ),
    /Solo se admiten/
  );
});

test("normal Presenter client exposes no admin or export transport", () => {
  const client = createRtmPresenterClient({
    fetchImpl: async () => jsonResponse({ ok: true }),
    environment: "staging",
    syntheticOnly: true,
  });
  assert.equal("reauthenticate" in client, false);
  assert.equal("requestExceptionalExportReceipt" in client, false);
});

test("a Presenter 401 invalidates the in-memory session", async () => {
  let invalidations = 0;
  const client = createRtmPresenterClient({
    fetchImpl: async () => jsonResponse({ detail: "Sesión no válida" }, 401),
    onUnauthorized: () => {
      invalidations += 1;
    },
    environment: "staging",
    syntheticOnly: true,
  });
  await assert.rejects(() => client.loadWorkspace(CASE_ID), /Sesión no válida/);
  assert.equal(invalidations, 1);
});
