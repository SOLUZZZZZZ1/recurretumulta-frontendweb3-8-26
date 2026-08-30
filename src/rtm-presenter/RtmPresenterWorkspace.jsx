import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createRtmPresenterClient,
  RTM_PRESENTER_EXTERNAL_DOCUMENT_ACCEPT,
  RTM_PRESENTER_EXTERNAL_DOCUMENT_PURPOSES,
  RtmPresenterApiError,
  validateRtmPresenterAttachmentFilename,
  validateRtmPresenterDestinationProposal,
  validateRtmPresenterExternalFile,
} from "./rtmPresenterApi.js";
import {
  buildRtmPresenterFreezePayload,
  evaluateRtmPresenterBoundary,
  evaluateRtmPresenterReadiness,
  hasExceptionalExportCapability,
  hasPresenterDestinationProposeCapability,
  hasPresenterDocumentIngestCapability,
  hasPresenterDeliveryPrepareCapability,
  latestPresenterDocumentVersions,
  matchingPresenterDocumentVersions,
  orderedPresenterFields,
} from "./rtmPresenterModel.js";
import "./rtmPresenter.css";

const EMPTY_HEADERS = () => ({});
const EMPTY_CALLBACK = () => {};
const EMPTY_CAPABILITIES = Object.freeze([]);
const EXACT_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PACKAGE_LIFETIME_MS = 15 * 60 * 1000;
const AUTHORIZATION_PURPOSES = new Set([
  "authorization",
  "representation",
  "signed_authorization",
  "representation_authorization",
]);
const ALLOWED_DOCUMENT_KEYS = new Set([
  "document_version_id",
  "case_id",
  "logical_document_id",
  "version_number",
  "sha256",
  "purpose",
  "state",
  "scan_status",
  "original_filename",
  "media_type",
  "size_bytes",
  "source_kind",
  "synthetic_only",
]);
const ALLOWED_DESTINATION_KEYS = new Set([
  "destination_profile_id",
  "profile_code",
  "profile_version",
  "profile_sha256",
  "authority_code",
  "display_name",
  "portal_origin",
  "delivery_channels",
  "verified_email",
  "portal_preparation",
  "representation_modes",
  "authorization_field_code",
  "fields",
  "verified_at",
]);
const ALLOWED_DESTINATION_FIELD_KEYS = new Set([
  "field_code",
  "step_order",
  "required",
  "required_for_modes",
  "purposes",
  "media_types",
  "max_files",
  "max_bytes",
]);
const ALLOWED_PORTAL_PREPARATION_KEYS = new Set([
  "enabled",
  "form_code",
  "fields",
  "operator_can_open_portal_session",
  "signer_local_activation_required",
  "certificate_stored_by_rtm",
  "signature_automated",
  "final_submit_automated",
]);
const ALLOWED_PORTAL_PREPARATION_FIELD_KEYS = new Set([
  "field_code",
  "label",
  "required",
  "multiline",
  "max_length",
  "step_order",
]);
const ALLOWED_VERIFIED_EMAIL_KEYS = new Set([
  "recipient",
  "verified",
  "template_code",
  "template_version",
  "sender",
  "legal_entity_name",
  "entity_role",
  "channel_label",
  "channel_status",
  "routing_scope_label",
  "routing_warning",
  "official_source_label",
  "official_source_url",
  "recommended_evidence_channel",
  "sensitive_attachment_policy",
  "subject_template",
  "body_template",
  "matter_codes",
]);
const ALLOWED_DIRECTORY_RESULT_KEYS = new Set([
  "directory_code",
  "display_name",
  "administration_level",
  "autonomous_community",
  "province",
  "locality_name",
  "entity_type_code",
  "sir_listed",
  "sir_offices",
  "source_basis",
  "directory_snapshot_id",
  "source_listed_modified_at",
  "reference_only",
  "usable_as_destination",
  "procedure_profile_available",
  "routing_decision_available",
]);
const ALLOWED_DIRECTORY_OFFICE_KEYS = new Set([
  "office_code",
  "office_name",
]);
const ALLOWED_DIRECTORY_SOURCE_KEYS = new Set([
  "available",
  "reason",
  "snapshot_id",
  "official_source_url",
  "official_listing_modified_at",
  "reference_only",
  "real_public_directory_data",
]);
const ALLOWED_PACKAGE_KEYS = new Set([
  "package_id",
  "logical_package_id",
  "package_version",
  "case_id",
  "status",
  "portal_origin",
  "destination_profile_id",
  "destination_profile_code",
  "destination_profile_version",
  "destination_profile_sha256",
  "representation_mode",
  "authorization_document_version_id",
  "manifest_sha256",
  "items",
  "expires_at",
  "download_available",
  "zip_available",
]);
const ALLOWED_PACKAGE_ITEM_KEYS = new Set([
  "item_id",
  "document_version_id",
  "logical_document_id",
  "document_version",
  "document_sha256",
  "item_order",
  "field_code",
  "purpose",
  "portal_filename",
  "media_type",
  "size_bytes",
  "required",
]);
const ALLOWED_DELIVERY_KEYS = new Set([
  "delivery_contract_version",
  "delivery_id",
  "case_id",
  "package_id",
  "package_manifest_sha256",
  "destination_profile_id",
  "destination_profile_code",
  "destination_profile_version",
  "destination_profile_sha256",
  "destination_display_name",
  "channel",
  "mode",
  "state",
  "destination",
  "correspondence",
  "portal_preparation",
  "signature_queue_ready",
  "signing_controls",
  "items",
  "prepared_at",
  "prepared_by_operator_id",
  "request_sha256",
  "external_effects_allowed",
  "authoritative_submission",
  "local_files_created",
  "operator_download_available",
  "automatic_retry_allowed",
  "human_final_submit_required",
  "receipt_required",
  "next_action",
]);
const ALLOWED_DELIVERY_PORTAL_PREPARATION_KEYS = new Set([
  "form_code",
  "fields",
  "values",
  "confirmations",
]);
const ALLOWED_SIGNING_CONTROL_KEYS = new Set([
  "certificate_stored_by_rtm",
  "certificate_secret_allowed",
  "browser_session_shared_with_operator",
  "remote_desktop_required",
  "local_signer_activation_required",
  "final_review_required",
  "signature_automated",
  "final_submit_automated",
]);
const ALLOWED_SIGNATURE_QUEUE_KEYS = new Set([
  "queue_contract_version",
  "state",
  "items",
  "item_count",
  "certificate_stored_by_rtm",
  "browser_session_shared",
  "local_activation_available",
]);
const ALLOWED_SIGNATURE_QUEUE_ITEM_KEYS = new Set([
  "delivery_id",
  "case_id",
  "package_id",
  "destination_display_name",
  "prepared_at",
  "prepared_by_operator_id",
  "document_count",
  "state",
  "authoritative_submission",
  "local_signer_activation_required",
  "local_activation_available",
  "certificate_stored_by_rtm",
  "browser_session_shared",
]);
const ALLOWED_DELIVERY_ITEM_KEYS = new Set([
  "package_item_id",
  "item_order",
  "field_code",
  "portal_filename",
  "document_version_id",
  "document_sha256",
  "media_type",
  "size_bytes",
  "state",
]);
const ALLOWED_DELIVERY_DESTINATION_KEYS = new Set([
  "kind",
  "portal_origin",
  "recipient",
  "verified",
  "template_code",
  "template_version",
  "official_profile_recipient",
  "legal_entity_name",
  "entity_role",
  "channel_status",
  "official_source_label",
  "official_source_url",
  "recommended_evidence_channel",
  "sensitive_attachment_policy",
]);
const EXTERNAL_DOCUMENT_PURPOSES = new Set(
  RTM_PRESENTER_EXTERNAL_DOCUMENT_PURPOSES
);
const OUTBOUND_EXCLUDED_PURPOSES = new Set(["submission_receipt"]);
const CORRESPONDENCE_CONFIRMATION_KEYS = Object.freeze([
  "destination_reviewed",
  "interested_confirmed",
  "representation_confirmed",
  "text_confirmed",
  "attachments_confirmed",
  "data_minimization_confirmed",
]);
const CORRESPONDENCE_CONFIRMATION_LABELS = Object.freeze({
  destination_reviewed: "Destinatario y canal oficial revisados",
  interested_confirmed: "Interesado y referencia del expediente correctos",
  representation_confirmed: "Representación comprobada cuando corresponde",
  text_confirmed: "Asunto, texto y pretensión definitivos",
  attachments_confirmed: "Adjuntos y versiones exactos",
  data_minimization_confirmed: "No se incluyen documentos innecesarios",
});
const PORTAL_PREPARATION_CONFIRMATION_KEYS = Object.freeze([
  "destination_reviewed",
  "interested_confirmed",
  "representation_confirmed",
  "text_confirmed",
  "attachments_confirmed",
]);
const PORTAL_PREPARATION_CONFIRMATION_LABELS = Object.freeze({
  destination_reviewed: "Sede, procedimiento y órgano de destino revisados",
  interested_confirmed: "Interesado y datos del expediente correctos",
  representation_confirmed: "Representación y autorización comprobadas",
  text_confirmed: "Asunto, Expone y Solicita definitivos",
  attachments_confirmed: "Documentos y versiones exactos para la sede",
});
const ALLOWED_CORRESPONDENCE_KEYS = new Set([
  "sender",
  "recipient",
  "subject",
  "body",
  "template_code",
  "template_version",
  "confirmations",
  "attachments",
  "transport_evidence",
]);
const ALLOWED_CORRESPONDENCE_ATTACHMENT_KEYS = new Set([
  "package_item_id",
  "document_version_id",
  "document_sha256",
  "filename",
]);
const ALLOWED_TRANSPORT_EVIDENCE_KEYS = new Set([
  "message_id",
  "smtp_response",
  "server_accepted",
  "delivery_receipt_proven",
  "bounce_status",
  "reply_recorded",
  "claim_reference",
]);

const ACTOR_OPTIONS = Object.freeze([
  { value: "self", label: "Actúo como interesado" },
  { value: "representative", label: "Actúo como representante" },
]);
const PURPOSE_LABELS = Object.freeze({
  original_fine: "Multa o notificación",
  identity_document: "Documento de identidad",
  main_filing: "Recurso o escrito principal",
  prejudicial_authorization: "Autorización prejudicial para abogado",
  authorization: "Autorización",
  representation: "Autorización de representación",
  signed_authorization: "Autorización firmada",
  representation_authorization: "Autorización de representación",
  submission_receipt: "Justificante de presentación",
  supporting_evidence: "Documentación de apoyo",
});
const FIELD_LABELS = Object.freeze({
  fine: "Multa o notificación",
  identity_document: "Documento de identidad",
  main_document: "Recurso o escrito principal",
  authorization: "Autorización de representación",
  representation_authorization: "Autorización de representación",
  submission_receipt: "Justificante de presentación",
  evidence: "Documentación de apoyo",
  supporting_evidence: "Documentación de apoyo",
});
const MEDIA_TYPE_LABELS = Object.freeze({
  "application/json": "JSON",
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "DOCX",
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "text/plain": "TXT",
});

function emptyCorrespondenceConfirmations() {
  return Object.fromEntries(
    CORRESPONDENCE_CONFIRMATION_KEYS.map((key) => [key, false])
  );
}

function emptyPortalPreparationConfirmations() {
  return Object.fromEntries(
    PORTAL_PREPARATION_CONFIRMATION_KEYS.map((key) => [key, false])
  );
}

function fillCorrespondenceTemplate(template, { caseId, company }) {
  return String(template || "")
    .replaceAll("[expediente]", String(caseId || ""))
    .replaceAll("[empresa]", String(company || ""))
    .replaceAll("[referencia]", "SYNTHETIC-REFERENCE");
}

function randomCommandKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `rtmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nextPackageExpiry() {
  return new Date(Date.now() + PACKAGE_LIFETIME_MS).toISOString();
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function publicError(error) {
  if (error instanceof RtmPresenterApiError) return error.message;
  return error?.message || "No se pudo completar la operación.";
}

function assertSafeDocumentProjection(documents, exactCaseId) {
  for (const documentVersion of documents) {
    if (!documentVersion || typeof documentVersion !== "object") {
      throw new Error("El contenedor devolvió metadatos documentales no válidos.");
    }
    for (const key of Object.keys(documentVersion)) {
      if (!ALLOWED_DOCUMENT_KEYS.has(key)) {
        throw new Error("El contenedor intentó exponer una referencia de almacenamiento.");
      }
    }
    if (documentVersion.synthetic_only !== true) {
      throw new Error("RTM Presenter solo admite versiones sintéticas en staging.");
    }
    if (String(documentVersion.case_id || "") !== exactCaseId) {
      throw new Error("El contenedor intentó mezclar versiones de otro expediente.");
    }
    if (!/^[0-9a-f]{64}$/.test(String(documentVersion.sha256 || ""))) {
      throw new Error("El contenedor devolvió una huella documental no verificable.");
    }
  }
}

function assertSafePortalPreparationProjection(value) {
  if (value === null || value === undefined) return;
  if (
    typeof value !== "object" ||
    Object.keys(value).some(
      (key) => !ALLOWED_PORTAL_PREPARATION_KEYS.has(key)
    ) ||
    value.enabled !== true ||
    !/^[a-z][a-z0-9_.-]{1,127}$/.test(String(value.form_code || "")) ||
    !Array.isArray(value.fields) ||
    value.fields.length < 1 ||
    value.fields.length > 32 ||
    value.operator_can_open_portal_session !== false ||
    value.signer_local_activation_required !== true ||
    value.certificate_stored_by_rtm !== false ||
    value.signature_automated !== false ||
    value.final_submit_automated !== false
  ) {
    throw new Error("RTM devolvió una hoja de firma fuera del contrato seguro.");
  }
  const seen = new Set();
  for (const [index, field] of value.fields.entries()) {
    const code = String(field?.field_code || "");
    if (
      !field ||
      typeof field !== "object" ||
      Object.keys(field).some(
        (key) => !ALLOWED_PORTAL_PREPARATION_FIELD_KEYS.has(key)
      ) ||
      !/^[a-z][a-z0-9_.-]{1,127}$/.test(code) ||
      seen.has(code) ||
      !String(field.label || "").trim() ||
      typeof field.required !== "boolean" ||
      typeof field.multiline !== "boolean" ||
      !Number.isInteger(field.max_length) ||
      field.max_length < 1 ||
      field.max_length > 12000 ||
      field.step_order !== index + 1
    ) {
      throw new Error("RTM devolvió un campo de firma fuera del contrato seguro.");
    }
    seen.add(code);
  }
}

function assertSafeDestinationProjection(destinations) {
  for (const destination of destinations) {
    if (
      !destination ||
      typeof destination !== "object" ||
      Object.keys(destination).some(
        (key) => !ALLOWED_DESTINATION_KEYS.has(key)
      ) ||
      !Array.isArray(destination.fields) ||
      !Array.isArray(destination.delivery_channels) ||
      destination.delivery_channels.some(
        (channel) => !new Set(["portal", "email"]).has(channel)
      ) ||
      destination.fields.some(
        (field) =>
          !field ||
          typeof field !== "object" ||
          Object.keys(field).some(
            (key) => !ALLOWED_DESTINATION_FIELD_KEYS.has(key)
          )
      ) ||
      !/^[0-9a-f]{64}$/.test(String(destination.profile_sha256 || ""))
    ) {
      throw new Error("RTM devolvió un perfil de sede fuera del contrato seguro.");
    }
    let url;
    try {
      url = new URL(String(destination.portal_origin || ""));
    } catch {
      throw new Error("RTM devolvió un origen de sede no verificable.");
    }
    if (url.protocol !== "https:" || url.origin !== destination.portal_origin) {
      throw new Error("RTM devolvió un origen de sede no verificable.");
    }
    assertSafePortalPreparationProjection(destination.portal_preparation);
    const verifiedEmail = destination.verified_email;
    if (
      verifiedEmail !== null &&
      verifiedEmail !== undefined &&
      (
        typeof verifiedEmail !== "object" ||
        Object.keys(verifiedEmail).some(
          (key) => !ALLOWED_VERIFIED_EMAIL_KEYS.has(key)
        ) ||
        verifiedEmail.verified !== true ||
        verifiedEmail.sender !== "info@recurretumulta.eu" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          String(verifiedEmail.recipient || "")
        ) ||
        !Array.isArray(verifiedEmail.matter_codes) ||
        verifiedEmail.matter_codes.length < 1 ||
        !String(verifiedEmail.legal_entity_name || "").trim() ||
        !String(verifiedEmail.channel_label || "").trim() ||
        !new Set(["accepted", "form_required", "alternative_preferred"]).has(
          verifiedEmail.channel_status
        ) ||
        !String(verifiedEmail.routing_scope_label || "").trim() ||
        !String(verifiedEmail.routing_warning || "").trim() ||
        !String(verifiedEmail.sensitive_attachment_policy || "").trim() ||
        !String(verifiedEmail.subject_template || "").trim() ||
        !String(verifiedEmail.body_template || "").trim() ||
        !String(verifiedEmail.official_source_url || "").startsWith("https://") ||
        (verifiedEmail.channel_status === "accepted") !==
          destination.delivery_channels.includes("email")
      )
    ) {
      throw new Error("RTM devolvió un correo de destino no verificable.");
    }
  }
}

function assertSafeDirectoryProjection(results, source) {
  if (
    !source ||
    typeof source !== "object" ||
    Object.keys(source).some((key) => !ALLOWED_DIRECTORY_SOURCE_KEYS.has(key)) ||
    source.reference_only !== true ||
    typeof source.available !== "boolean"
  ) {
    throw new Error("RTM devolvió una fuente DIR3/SIR fuera de contrato.");
  }
  if (source.available === true) {
    if (
      source.real_public_directory_data !== true ||
      !/^[0-9a-f]{64}$/.test(String(source.snapshot_id || "")) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(
        String(source.official_listing_modified_at || "")
      ) ||
      source.official_source_url !==
        "https://administracionelectronica.gob.es/ctt/dir3/descargas"
    ) {
      throw new Error("RTM devolvió una fuente DIR3/SIR no verificable.");
    }
  } else if (
    source.real_public_directory_data !== false ||
    !String(source.reason || "").trim()
  ) {
    throw new Error("RTM no acreditó el estado del directorio.");
  }
  for (const result of results) {
    if (
      !result ||
      typeof result !== "object" ||
      Object.keys(result).some(
        (key) => !ALLOWED_DIRECTORY_RESULT_KEYS.has(key)
      ) ||
      !/^[A-Z][A-Z0-9]{8}$/.test(String(result.directory_code || "")) ||
      !String(result.display_name || "").trim() ||
      !Array.isArray(result.sir_offices) ||
      result.sir_offices.some(
        (office) =>
          !office ||
          typeof office !== "object" ||
          Object.keys(office).some(
            (key) => !ALLOWED_DIRECTORY_OFFICE_KEYS.has(key)
          ) ||
          !/^O[A-Z0-9]{8}$/.test(String(office.office_code || "")) ||
          !String(office.office_name || "").trim()
      ) ||
      result.sir_listed !== (result.sir_offices.length > 0) ||
      result.reference_only !== true ||
      result.usable_as_destination !== false ||
      result.procedure_profile_available !== false ||
      result.routing_decision_available !== false ||
      !source.available ||
      result.directory_snapshot_id !== source.snapshot_id ||
      result.source_listed_modified_at !==
        source.official_listing_modified_at
    ) {
      throw new Error("RTM devolvió un resultado DIR3/SIR fuera de contrato.");
    }
  }
}

function normalizeWorkspace(payload, fallbackCaseId) {
  const source = payload || {};
  const destinations = Array.isArray(source.destinations)
    ? source.destinations
    : [];
  const documents = Array.isArray(source.documents) ? source.documents : [];
  const actions = source.actions || {};
  const exactCaseId = String(source.case_id || "");

  if (
    !exactCaseId ||
    exactCaseId !== String(fallbackCaseId || "") ||
    source.synthetic_only !== true ||
    source.storage_references_exposed !== false ||
    actions.operator_download !== false ||
    actions.operator_preview !== false ||
    actions.operator_zip !== false ||
    actions.operator_handoff !== false
  ) {
    throw new Error("La frontera de custodia del workspace no es verificable.");
  }
  assertSafeDocumentProjection(documents, exactCaseId);
  assertSafeDestinationProjection(destinations);

  return Object.freeze({
    caseId: exactCaseId,
    destinations: Object.freeze(destinations),
    documents: Object.freeze(documents),
    actions: Object.freeze({ ...actions }),
  });
}

function destinationsFromSearchResponse(payload, exactCaseId) {
  const destinations = Array.isArray(payload?.destinations)
    ? payload.destinations
    : [];
  const directoryResults = Array.isArray(payload?.directory_results)
    ? payload.directory_results
    : [];
  const directorySource = payload?.directory_source;
  if (
    String(payload?.case_id || "") !== String(exactCaseId || "") ||
    payload?.synthetic_only !== true ||
    payload?.storage_references_exposed !== false ||
    payload?.unverified_destination_allowed !== false ||
    payload?.operator_supplied_url_allowed !== false ||
    payload?.operator_url_proposal_allowed !== true ||
    Number(payload?.result_count) !== destinations.length ||
    Number(payload?.directory_result_count) !== directoryResults.length ||
    payload?.directory_results_selectable !== false ||
    payload?.directory_network_used !== false ||
    payload?.directory_procedure_inference_performed !== false
  ) {
    throw new Error("La búsqueda de sedes no respeta la frontera verificada.");
  }
  assertSafeDestinationProjection(destinations);
  assertSafeDirectoryProjection(directoryResults, directorySource);
  return Object.freeze({
    destinations: Object.freeze(destinations),
    directoryResults: Object.freeze(directoryResults),
    directorySource: Object.freeze({ ...directorySource }),
  });
}

function signatureQueueFromResponse(payload) {
  const queue = payload?.queue;
  if (
    payload?.synthetic_only !== true ||
    payload?.storage_references_exposed !== false ||
    !queue ||
    typeof queue !== "object" ||
    Object.keys(queue).some((key) => !ALLOWED_SIGNATURE_QUEUE_KEYS.has(key)) ||
    queue.queue_contract_version !== "rtm_presenter_signature_queue_v1_0" ||
    queue.state !== "awaiting_signature" ||
    !Array.isArray(queue.items) ||
    queue.item_count !== queue.items.length ||
    queue.certificate_stored_by_rtm !== false ||
    queue.browser_session_shared !== false ||
    typeof queue.local_activation_available !== "boolean"
  ) {
    throw new Error("La cola de firma no respeta el contrato seguro.");
  }
  const seen = new Set();
  for (const item of queue.items) {
    const preparedAt = String(item?.prepared_at || "");
    if (
      !item ||
      typeof item !== "object" ||
      Object.keys(item).some(
        (key) => !ALLOWED_SIGNATURE_QUEUE_ITEM_KEYS.has(key)
      ) ||
      !EXACT_UUID_PATTERN.test(String(item.delivery_id || "")) ||
      !EXACT_UUID_PATTERN.test(String(item.case_id || "")) ||
      !EXACT_UUID_PATTERN.test(String(item.package_id || "")) ||
      !EXACT_UUID_PATTERN.test(String(item.prepared_by_operator_id || "")) ||
      seen.has(item.delivery_id) ||
      !String(item.destination_display_name || "").trim() ||
      !/(?:Z|[+-]\d{2}:\d{2})$/.test(preparedAt) ||
      Number.isNaN(Date.parse(preparedAt)) ||
      !Number.isInteger(item.document_count) ||
      item.document_count < 1 ||
      item.state !== "awaiting_signature" ||
      item.authoritative_submission !== false ||
      item.local_signer_activation_required !== true ||
      item.local_activation_available !== queue.local_activation_available ||
      item.certificate_stored_by_rtm !== false ||
      item.browser_session_shared !== false
    ) {
      throw new Error("La cola contiene una tarea de firma no verificable.");
    }
    seen.add(item.delivery_id);
  }
  return Object.freeze({
    ...queue,
    items: Object.freeze(queue.items.map((item) => Object.freeze({ ...item }))),
  });
}

function packageFromResponse(
  payload,
  { caseId, requestPayload }
) {
  const value = payload?.package;
  if (!value || typeof value !== "object" || !value.package_id) {
    throw new Error("El backend no devolvió la selección fijada esperada.");
  }
  if (Object.keys(value).some((key) => !ALLOWED_PACKAGE_KEYS.has(key))) {
    throw new Error("La selección intentó exponer datos fuera del contrato seguro.");
  }
  if (
    !Array.isArray(value.items) ||
    value.items.some(
      (item) =>
        !item ||
        typeof item !== "object" ||
        Object.keys(item).some((key) => !ALLOWED_PACKAGE_ITEM_KEYS.has(key))
    )
  ) {
    throw new Error("Los documentos elegidos no respetan la proyección segura.");
  }
  if (value.download_available !== false || value.zip_available !== false) {
    throw new Error("La selección no respeta la política de no extracción.");
  }
  if (
    String(value.case_id || "") !== String(caseId || "") ||
    String(value.destination_profile_id || "") !==
      String(requestPayload?.destination_profile_id || "") ||
    String(value.portal_origin || "") !== String(requestPayload?.portal_origin || "") ||
    String(value.representation_mode || "") !==
      String(requestPayload?.representation_mode || "") ||
    String(value.authorization_document_version_id || "") !==
      String(requestPayload?.authorization_document_version_id || "") ||
    String(value.status || "") !== "frozen" ||
    !/^[0-9a-f]{64}$/.test(String(value.manifest_sha256 || ""))
  ) {
    throw new Error("La selección fijada no coincide con la solicitud activa.");
  }
  const responseItems = Array.isArray(value.items) ? value.items : [];
  const expectedItems = Array.isArray(requestPayload?.items)
    ? requestPayload.items
    : [];
  const exactResponseItems = responseItems.map((item) => ({
    document_version_id: String(item?.document_version_id || ""),
    item_order: Number(item?.item_order || 0),
    field_code: String(item?.field_code || ""),
    portal_filename: String(item?.portal_filename || ""),
  }));
  if (JSON.stringify(exactResponseItems) !== JSON.stringify(expectedItems)) {
    throw new Error("El backend fijó una selección distinta de la solicitada.");
  }
  return value;
}

function deliveryFromResponse(
  payload,
  {
    caseId,
    frozenPackage,
    channel,
    expectedRecipient = "",
    expectedCorrespondence = null,
    expectedPortalPreparation = null,
  }
) {
  const value = payload?.delivery;
  if (
    !value ||
    typeof value !== "object" ||
    Object.keys(value).some((key) => !ALLOWED_DELIVERY_KEYS.has(key)) ||
    payload?.synthetic_only !== true ||
    payload?.storage_references_exposed !== false
  ) {
    throw new Error("La orden de presentación no respeta la frontera de custodia.");
  }
  if (
    !Array.isArray(value.items) ||
    !value.destination ||
    typeof value.destination !== "object" ||
    Object.keys(value.destination).some(
      (key) => !ALLOWED_DELIVERY_DESTINATION_KEYS.has(key)
    ) ||
    value.items.some(
      (item) =>
        !item ||
        typeof item !== "object" ||
        Object.keys(item).some((key) => !ALLOWED_DELIVERY_ITEM_KEYS.has(key))
    )
  ) {
    throw new Error("La orden contiene documentos fuera del contrato seguro.");
  }
  const packageItems = Array.isArray(frozenPackage?.items)
    ? frozenPackage.items
    : [];
  const exactItems = value.items.map((item) => ({
    document_version_id: String(item.document_version_id || ""),
    document_sha256: String(item.document_sha256 || ""),
    item_order: Number(item.item_order || 0),
    field_code: String(item.field_code || ""),
    portal_filename: String(item.portal_filename || ""),
    state: String(item.state || ""),
  }));
  const expectedItems = packageItems.map((item) => ({
    document_version_id: String(item.document_version_id || ""),
    document_sha256: String(item.document_sha256 || ""),
    item_order: Number(item.item_order || 0),
    field_code: String(item.field_code || ""),
    portal_filename: String(item.portal_filename || ""),
    state: "pending",
  }));
  const exactRecipient = String(expectedRecipient || "").trim().toLowerCase();
  const destinationMatches =
    channel === "portal"
      ? value.destination?.kind === "verified_portal_origin" &&
        String(value.destination?.portal_origin || "") ===
          String(frozenPackage?.portal_origin || "")
      : new Set([
            "verified_email",
            "operator_entered_email_pending_verification",
          ]).has(value.destination?.kind) &&
        (!exactRecipient ||
          String(value.destination?.recipient || "").toLowerCase() ===
            exactRecipient) &&
        value.destination?.channel_status === "accepted" &&
        String(value.destination?.official_source_url || "").startsWith(
          "https://"
        );
  const correspondence = value.correspondence;
  const correspondenceAttachments = packageItems.map((item) => ({
    package_item_id: String(item.item_id || ""),
    document_version_id: String(item.document_version_id || ""),
    document_sha256: String(item.document_sha256 || ""),
    filename: String(item.portal_filename || ""),
  }));
  const correspondenceMatches =
    channel === "portal"
      ? correspondence === undefined
      : correspondence &&
        typeof correspondence === "object" &&
        !Object.keys(correspondence).some(
          (key) => !ALLOWED_CORRESPONDENCE_KEYS.has(key)
        ) &&
        correspondence.sender === "info@recurretumulta.eu" &&
        String(correspondence.recipient || "").toLowerCase() === exactRecipient &&
        correspondence.subject === expectedCorrespondence?.subject &&
        correspondence.body === expectedCorrespondence?.body &&
        JSON.stringify(correspondence.confirmations) ===
          JSON.stringify(expectedCorrespondence?.confirmations) &&
        Array.isArray(correspondence.attachments) &&
        correspondence.attachments.every(
          (item) =>
            item &&
            typeof item === "object" &&
            !Object.keys(item).some(
              (key) => !ALLOWED_CORRESPONDENCE_ATTACHMENT_KEYS.has(key)
            )
        ) &&
        JSON.stringify(correspondence.attachments) ===
          JSON.stringify(correspondenceAttachments) &&
        correspondence.transport_evidence &&
        typeof correspondence.transport_evidence === "object" &&
        !Object.keys(correspondence.transport_evidence).some(
          (key) => !ALLOWED_TRANSPORT_EVIDENCE_KEYS.has(key)
        ) &&
        correspondence.transport_evidence.message_id === null &&
        correspondence.transport_evidence.smtp_response === null &&
        correspondence.transport_evidence.server_accepted === false &&
        correspondence.transport_evidence.delivery_receipt_proven === false;
  const portalPreparation = value.portal_preparation;
  const signingControls = value.signing_controls;
  const portalPreparationMatches =
    channel === "email"
      ? portalPreparation === undefined &&
        value.signature_queue_ready === undefined &&
        signingControls === undefined
      : portalPreparation &&
        typeof portalPreparation === "object" &&
        !Object.keys(portalPreparation).some(
          (key) => !ALLOWED_DELIVERY_PORTAL_PREPARATION_KEYS.has(key)
        ) &&
        Array.isArray(portalPreparation.fields) &&
        portalPreparation.fields.every(
          (field) =>
            field &&
            typeof field === "object" &&
            !Object.keys(field).some(
              (key) => !ALLOWED_PORTAL_PREPARATION_FIELD_KEYS.has(key)
            )
        ) &&
        JSON.stringify(portalPreparation) ===
          JSON.stringify(expectedPortalPreparation) &&
        value.signature_queue_ready === true &&
        signingControls &&
        typeof signingControls === "object" &&
        !Object.keys(signingControls).some(
          (key) => !ALLOWED_SIGNING_CONTROL_KEYS.has(key)
        ) &&
        signingControls.certificate_stored_by_rtm === false &&
        signingControls.certificate_secret_allowed === false &&
        signingControls.browser_session_shared_with_operator === false &&
        signingControls.remote_desktop_required === false &&
        signingControls.local_signer_activation_required === true &&
        signingControls.final_review_required === true &&
        signingControls.signature_automated === false &&
        signingControls.final_submit_automated === false;
  const expectedState = channel === "portal" ? "awaiting_signature" : "prepared";
  const expectedMode =
    channel === "portal"
      ? "operator_prepared_signer_local_bridge"
      : "server_side_email_from_custody";
  if (
    String(value.case_id || "") !== String(caseId || "") ||
    String(value.package_id || "") !== String(frozenPackage?.package_id || "") ||
    String(value.package_manifest_sha256 || "") !==
      String(frozenPackage?.manifest_sha256 || "") ||
    value.channel !== channel ||
    value.state !== expectedState ||
    value.mode !== expectedMode ||
    !destinationMatches ||
    !correspondenceMatches ||
    !portalPreparationMatches ||
    value.external_effects_allowed !== false ||
    value.authoritative_submission !== false ||
    value.local_files_created !== false ||
    value.operator_download_available !== false ||
    value.automatic_retry_allowed !== false ||
    value.human_final_submit_required !== true ||
    value.receipt_required !== true ||
    (channel === "portal" &&
      !new Set([
        "signer_local_activation_ready",
        "managed_signing_bridge_activation_required",
      ]).has(value.next_action)) ||
    JSON.stringify(exactItems) !== JSON.stringify(expectedItems)
  ) {
    throw new Error("La orden no coincide exactamente con la selección fijada.");
  }
  return Object.freeze({ ...value, items: Object.freeze(value.items) });
}

function selectedDocumentVersionIds(selections) {
  return Object.values(selections).flatMap((value) =>
    Array.isArray(value) ? value.filter(Boolean) : []
  );
}

function selectedDocumentVersion(documents, documentVersionId) {
  return documents.find(
    (item) => item.document_version_id === documentVersionId
  );
}

function versionLabel(documentVersion) {
  return `${documentVersion.original_filename} · v${documentVersion.version_number} · ${formatBytes(
    documentVersion.size_bytes
  )}`;
}

function purposeLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (PURPOSE_LABELS[normalized]) return PURPOSE_LABELS[normalized];
  return normalized
    .replace(/[._-]+/g, " ")
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

function readableFilenameStem(filename) {
  const value = String(filename || "").trim();
  const dot = value.lastIndexOf(".");
  const stem = dot > 0 ? value.slice(0, dot) : value;
  return stem.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
}

function attachmentFilenameFromLabel(label, sourceFilename) {
  const source = String(sourceFilename || "").trim();
  const dot = source.lastIndexOf(".");
  const extension = dot > 0 ? source.slice(dot).toLowerCase() : "";
  const safeStem = String(label || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._() -]+/g, " ")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._ -]+|[._ -]+$/g, "")
    .slice(0, Math.max(1, 180 - extension.length));
  return safeStem ? `${safeStem}${extension}` : "";
}

function fieldLabel(field) {
  return FIELD_LABELS[field?.fieldCode] || field?.label || "Documento";
}

function preferredExternalPurpose(field) {
  return (
    (field?.purposes || []).find((purpose) =>
      EXTERNAL_DOCUMENT_PURPOSES.has(String(purpose || "").toLowerCase())
    ) || ""
  );
}

function mediaTypeLabel(value) {
  return MEDIA_TYPE_LABELS[value] || value;
}

function correspondenceChannelStatusLabel(value) {
  return value === "accepted"
    ? "admitido en el directorio RTM"
    : value || "canal no disponible";
}

function ExceptionalExportPanel({ allowed }) {
  if (!allowed) return null;

  return (
    <section className="rtmp-exception" aria-labelledby="rtmp-exception-title">
      <p className="rtmp-eyebrow">Control administrativo separado</p>
      <h2 id="rtmp-exception-title">Salida administrativa excepcional</h2>
      <p>
        Capacidad específica detectada. El canal permanece cerrado hasta que
        exista un flujo administrativo separado, con doble control y recibo JSON.
        Esta pantalla no solicita contraseña ni llama a una ruta de exportación.
      </p>
    </section>
  );
}

function PresenterStatusTimeline({
  channel,
  destinationReady,
  attachmentsFixed,
  draftPrepared,
}) {
  if (!channel) return null;

  const attachmentsLinked = attachmentsFixed;
  const awaitingHumanAction = draftPrepared;
  const steps = [
    {
      label: "Preparando",
      detail: destinationReady
        ? "Destino elegido; todavía no existe presentación."
        : "Falta elegir un destino verificado.",
      state: destinationReady ? "complete" : "current",
    },
    {
      label: "Adjuntos vinculados",
      detail: attachmentsLinked
        ? channel === "portal"
          ? "Versiones y huellas fijadas para entrega individual en el puesto local."
          : "Versiones fijadas para revisar la correspondencia."
        : channel === "portal"
          ? "Falta revisar y fijar qué versión corresponde a cada requisito."
          : "Falta elegir y fijar los adjuntos del correo.",
      state: attachmentsLinked
        ? "complete"
        : destinationReady
          ? "current"
          : "pending",
    },
    {
      label: channel === "portal" ? "En cola de firma" : "Pendiente de envío humano",
      detail: awaitingHumanAction
        ? channel === "portal"
          ? "Preparado, pero no presentado: el firmante debe abrir su sesión local, revisar y firmar."
          : "La persona debe revisar y completar el envío en el canal de destino."
        : "Preparar o adjuntar nunca equivale a enviar.",
      state: awaitingHumanAction ? "current" : "pending",
    },
    {
      label: "Pendiente de justificante",
      detail:
        "No existe todavía un justificante conciliado por RTM. Capturarlo desde la sede o recibir una copia por correo solo crea una evidencia candidata.",
      state: "pending",
    },
    {
      label: "Verificar justificante y activar seguimiento",
      detail:
        "Bloqueado. La fecha del seguimiento operativo solo podrá venir del justificante verificado. Los plazos legales se mostrarán únicamente si existe una regla validada del procedimiento.",
      state: "blocked",
    },
  ];

  return (
    <section
      className="rtmp-card rtmp-status-card"
      aria-labelledby="rtmp-status-title"
    >
      <div className="rtmp-section-heading">
        <div>
          <p className="rtmp-eyebrow">Estado real del envío</p>
          <h2 id="rtmp-status-title">Qué está acreditado y qué falta</h2>
          <p>
            RTM separa la preparación, la entrega de archivos, el envío humano y
            el justificante. Ningún paso se da por completado por ausencia de
            errores.
          </p>
        </div>
        <span className="rtmp-chip rtmp-chip-warn">NO ENVIADO</span>
      </div>
      <ol className="rtmp-status-timeline">
        {steps.map((step, index) => (
          <li key={step.label} className={`is-${step.state}`}>
            <span className="rtmp-status-marker" aria-hidden="true">
              {index + 1}
            </span>
            <span>
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PortalReceiptCapturePanel() {
  return (
    <section
      className="rtmp-card rtmp-receipt-capture-card"
      aria-labelledby="rtmp-receipt-capture-title"
    >
      <div className="rtmp-section-heading">
        <div>
          <p className="rtmp-eyebrow">Después del envío humano · Justificante</p>
          <h2 id="rtmp-receipt-capture-title">
            Traer el justificante al expediente por una de dos vías
          </h2>
          <p>
            Las dos vías empiezan como pendiente de verificación. Incorporar un
            PDF no acredita por sí solo la presentación ni activa el seguimiento.
          </p>
        </div>
        <span className="rtmp-chip rtmp-chip-warn">JUSTIFICANTE PENDIENTE</span>
      </div>

      <div className="rtmp-receipt-paths">
        <article className="rtmp-receipt-path">
          <span className="rtmp-channel-kicker">DESDE LA SEDE</span>
          <h3>Capturar al descargar en la sede</h3>
          <p>
            Cuando la sede muestre «Descargar justificante», la extensión
            ofrecerá al lado una acción explícita para custodiar esa misma copia
            en el expediente, sin conservar una descarga permanente en el PC.
          </p>
          <button
            type="button"
            className="rtmp-button rtmp-button-primary"
            disabled
          >
            Incorporar justificante a RTM
          </button>
          <small>
            Puente cerrado en staging. Requerirá un adaptador verificado para esa
            sede y una acción expresa del operador.
          </small>
        </article>

        <article className="rtmp-receipt-path">
          <span className="rtmp-channel-kicker">DESDE EL CORREO</span>
          <h3>Conciliar la copia recibida por correo</h3>
          <p>
            Una copia llegada al buzón controlado podrá asociarse al expediente
            como candidata. RTM deberá comprobar que corresponde al mismo envío,
            organismo, registro y relación de documentos.
          </p>
          <button
            type="button"
            className="rtmp-button rtmp-button-secondary"
            disabled
          >
            Conciliar copia recibida por correo
          </button>
          <small>
            Conciliador cerrado en staging. Recibir un mensaje no demuestra por
            sí solo que la presentación sea válida.
          </small>
        </article>
      </div>

      <div className="rtmp-receipt-pending" role="note">
        <strong>Estado inicial de ambas vías: pendiente de verificación.</strong>
        <span>
          RTM deberá validar los datos oficiales disponibles, la firma o huella
          declarada y la lista de anexos. Solo entonces podrá tomar la fecha del
          justificante como inicio del seguimiento operativo.
        </span>
      </div>
      <p className="rtmp-alert rtmp-alert-error" role="alert">
        No todas las sedes permiten capturar su descarga de forma segura. Si una
        sede fuerza una descarga nativa que el adaptador no puede custodiar, RTM
        no afirmará que el justificante quedó incorporado.
      </p>
    </section>
  );
}

function SignatureQueuePanel({ queue, currentCaseId, onOpenCase }) {
  if (!queue) return null;
  return (
    <section className="rtmp-card rtmp-signature-queue" aria-labelledby="rtmp-global-signature-queue-title">
      <div className="rtmp-section-heading">
        <div>
          <p className="rtmp-eyebrow">Cola asignada · sin autoridad de firma</p>
          <h2 id="rtmp-global-signature-queue-title">Tareas preparadas pendientes de firma</h2>
          <p>
            Solo aparecen expedientes asignados a esta cuenta. Estar en esta lista
            significa «preparado», nunca «presentado», y no concede permiso para
            firmar.
          </p>
        </div>
        <span className={`rtmp-chip ${queue.item_count ? "rtmp-chip-warn" : "rtmp-chip-ok"}`}>
          {queue.item_count} PENDIENTES
        </span>
      </div>
      {queue.items.length ? (
        <ol className="rtmp-delivery-list">
          {queue.items.map((item, index) => {
            const current = item.case_id === String(currentCaseId || "");
            return (
              <li key={item.delivery_id}>
                <span className="rtmp-delivery-order">{index + 1}</span>
                <span>
                  <strong>{item.destination_display_name}</strong>
                  <small className="rtmp-mono">Expediente {item.case_id}</small>
                  <small>
                    {item.document_count} documentos · preparado {new Date(item.prepared_at).toLocaleString("es-ES")}
                  </small>
                </span>
                {current ? (
                  <span className="rtmp-field-status is-selected">ABIERTO</span>
                ) : (
                  <button
                    type="button"
                    className="rtmp-button rtmp-button-secondary"
                    onClick={() => onOpenCase(item.case_id)}
                  >
                    Abrir sin cerrar sesión
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rtmp-empty">No hay tareas de firma pendientes asignadas a esta cuenta.</p>
      )}
      <p className="rtmp-alert" role="note">
        {queue.local_activation_available
          ? "El puesto local gestionado está disponible; la firma y el envío final continúan siendo humanos."
          : "La cola está operativa, pero el puesto local de firma sigue pendiente de activación en este staging."}
      </p>
    </section>
  );
}

export default function RtmPresenterWorkspace({
  caseId,
  onOpenCase = EMPTY_CALLBACK,
  apiClient = null,
  getAuthHeaders = EMPTY_HEADERS,
  onUnauthorized = EMPTY_CALLBACK,
  operatorCapabilities = EMPTY_CAPABILITIES,
  initialWorkspace = null,
  environment = "staging",
  syntheticOnly = true,
}) {
  const boundary = useMemo(
    () => evaluateRtmPresenterBoundary({ environment, syntheticOnly }),
    [environment, syntheticOnly]
  );
  const client = useMemo(() => {
    if (apiClient) return apiClient;
    if (!boundary.allowed) return null;
    return createRtmPresenterClient({
      getAuthHeaders,
      onUnauthorized,
      environment,
      syntheticOnly,
    });
  }, [
    apiClient,
    boundary.allowed,
    environment,
    getAuthHeaders,
    onUnauthorized,
    syntheticOnly,
  ]);

  const [workspace, setWorkspace] = useState(null);
  const [signatureQueue, setSignatureQueue] = useState(null);
  const [deliveryChannel, setDeliveryChannel] = useState("");
  const [profileId, setProfileId] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [destinationOptions, setDestinationOptions] = useState([]);
  const [directoryResults, setDirectoryResults] = useState([]);
  const [directorySource, setDirectorySource] = useState(null);
  const [searchingDestinations, setSearchingDestinations] = useState(false);
  const [destinationSearchMissed, setDestinationSearchMissed] = useState(false);
  const [destinationProposalOpen, setDestinationProposalOpen] = useState(false);
  const [destinationProposalLabel, setDestinationProposalLabel] = useState("");
  const [destinationProposalUrl, setDestinationProposalUrl] = useState("");
  const [destinationProposalConfirmed, setDestinationProposalConfirmed] = useState(false);
  const [representationMode, setRepresentationMode] = useState("self");
  const [emailRecipientMode, setEmailRecipientMode] = useState("verified");
  const [manualEmail, setManualEmail] = useState("");
  const [manualEmailConfirmed, setManualEmailConfirmed] = useState(false);
  const [correspondenceSubject, setCorrespondenceSubject] = useState("");
  const [correspondenceBody, setCorrespondenceBody] = useState("");
  const [correspondenceConfirmations, setCorrespondenceConfirmations] = useState(
    emptyCorrespondenceConfirmations
  );
  const [portalValues, setPortalValues] = useState({});
  const [portalConfirmations, setPortalConfirmations] = useState(
    emptyPortalPreparationConfirmations
  );
  const [selections, setSelections] = useState({});
  const [authorizationVersionId, setAuthorizationVersionId] = useState("");
  const [frozenPackage, setFrozenPackage] = useState(null);
  const [delivery, setDelivery] = useState(null);
  const [supersedesPackageId, setSupersedesPackageId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busyCommand, setBusyCommand] = useState("");
  const [message, setMessage] = useState("");
  const [externalMode, setExternalMode] = useState("new");
  const [externalPurpose, setExternalPurpose] = useState("");
  const [externalDocumentName, setExternalDocumentName] = useState("");
  const [externalSupersedesId, setExternalSupersedesId] = useState("");
  const [externalFileMetadata, setExternalFileMetadata] = useState(null);
  const [syntheticConfirmed, setSyntheticConfirmed] = useState(false);
  const [externalPanelOpen, setExternalPanelOpen] = useState(false);
  const commandLockRef = useRef(false);
  const pendingFreezeRef = useRef(null);
  const pendingDeliveryRef = useRef(null);
  const externalFileInputRef = useRef(null);
  const externalUploadAbortRef = useRef(null);

  const exceptionalExportAllowed = useMemo(
    () => hasExceptionalExportCapability(operatorCapabilities),
    [operatorCapabilities]
  );
  const documentIngestAllowed = useMemo(
    () => hasPresenterDocumentIngestCapability(operatorCapabilities),
    [operatorCapabilities]
  );
  const destinationProposalAllowed = useMemo(
    () => hasPresenterDestinationProposeCapability(operatorCapabilities),
    [operatorCapabilities]
  );
  const deliveryPrepareAllowed = useMemo(
    () => hasPresenterDeliveryPrepareCapability(operatorCapabilities),
    [operatorCapabilities]
  );

  const applyWorkspace = useCallback(
    (payload) => {
      const next = normalizeWorkspace(payload, caseId);
      pendingFreezeRef.current = null;
      setWorkspace(next);
      setDeliveryChannel("");
      setProfileId("");
      setDestinationQuery("");
      setDestinationOptions(next.destinations);
      setDirectoryResults([]);
      setDirectorySource(null);
      setDestinationSearchMissed(false);
      setDestinationProposalOpen(false);
      setDestinationProposalLabel("");
      setDestinationProposalUrl("");
      setDestinationProposalConfirmed(false);
      setSelections({});
      setAuthorizationVersionId("");
      setEmailRecipientMode("verified");
      setManualEmail("");
      setManualEmailConfirmed(false);
      setCorrespondenceSubject("");
      setCorrespondenceBody("");
      setCorrespondenceConfirmations(emptyCorrespondenceConfirmations());
      setPortalValues({});
      setPortalConfirmations(emptyPortalPreparationConfirmations());
      setFrozenPackage(null);
      setDelivery(null);
      setSupersedesPackageId(null);
      setExternalPanelOpen(false);
      setExternalMode("new");
      setExternalPurpose("");
      setExternalDocumentName("");
      setExternalSupersedesId("");
      setExternalFileMetadata(null);
      setSyntheticConfirmed(false);
      if (externalFileInputRef.current) {
        externalFileInputRef.current.value = "";
      }
    },
    [caseId]
  );

  const loadWorkspace = useCallback(
    async (signal = null) => {
      if (!boundary.allowed || !caseId || !client) return;
      setLoading(true);
      setMessage("");
      try {
        const workspaceRequest = client.loadWorkspace(caseId, { signal });
        const queueRequest = client.loadSignatureQueue({ signal }).then(
          (queuePayload) => ({ ok: true, queuePayload }),
          (queueError) => ({ ok: false, queueError })
        );
        const payload = await workspaceRequest;
        applyWorkspace(payload);
        const queueResult = await queueRequest;
        if (queueResult.ok) {
          setSignatureQueue(
            signatureQueueFromResponse(queueResult.queuePayload)
          );
        } else {
          const queueError = queueResult.queueError;
          if (queueError?.code !== "presenter.request_aborted") {
            setSignatureQueue(null);
            setMessage(
              `El expediente se cargó, pero la cola de firma no está disponible: ${publicError(queueError)}`
            );
          }
        }
      } catch (error) {
        if (error?.code !== "presenter.request_aborted") {
          setMessage(publicError(error));
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [applyWorkspace, boundary.allowed, caseId, client]
  );

  useEffect(() => {
    if (!boundary.allowed) return undefined;
    if (initialWorkspace) {
      try {
        applyWorkspace(initialWorkspace);
      } catch (error) {
        setMessage(publicError(error));
      }
      return undefined;
    }
    const controller = new AbortController();
    void loadWorkspace(controller.signal);
    return () => controller.abort();
  }, [applyWorkspace, boundary.allowed, initialWorkspace, loadWorkspace]);

  useEffect(
    () => () => {
      externalUploadAbortRef.current?.abort();
    },
    []
  );

  useEffect(() => {
    setExternalMode("new");
    setExternalPurpose("");
    setExternalDocumentName("");
    setExternalSupersedesId("");
    setSyntheticConfirmed(false);
    setExternalPanelOpen(false);
    if (externalFileInputRef.current) {
      externalFileInputRef.current.value = "";
    }
    setExternalFileMetadata(null);
    setDeliveryChannel("");
    setEmailRecipientMode("verified");
    setManualEmail("");
    setManualEmailConfirmed(false);
    setCorrespondenceSubject("");
    setCorrespondenceBody("");
    setCorrespondenceConfirmations(emptyCorrespondenceConfirmations());
    setPortalValues({});
    setPortalConfirmations(emptyPortalPreparationConfirmations());
  }, [caseId]);

  useEffect(() => {
    if (!externalPanelOpen) return undefined;
    const frame = globalThis.requestAnimationFrame?.(() => {
      globalThis.document
        ?.getElementById("rtmp-external-panel")
        ?.querySelector("input, select, button")
        ?.focus();
    });
    return () => {
      if (frame !== undefined) globalThis.cancelAnimationFrame?.(frame);
    };
  }, [externalPanelOpen]);

  const profile = useMemo(
    () =>
      destinationOptions.find(
        (item) => item.destination_profile_id === profileId
      ) || null,
    [destinationOptions, profileId]
  );
  const availableChannelDestinations = useMemo(
    () =>
      (workspace?.destinations || []).filter((item) =>
        item.delivery_channels?.includes(deliveryChannel)
      ),
    [deliveryChannel, workspace]
  );

  const containerDocuments = useMemo(
    () => latestPresenterDocumentVersions(workspace?.documents || []),
    [workspace]
  );
  const filingDocuments = useMemo(
    () =>
      containerDocuments.filter(
        (item) =>
          !OUTBOUND_EXCLUDED_PURPOSES.has(
            String(item?.purpose || "").trim().toLowerCase()
          )
      ),
    [containerDocuments]
  );
  const evidenceDocuments = useMemo(
    () =>
      containerDocuments.filter((item) =>
        OUTBOUND_EXCLUDED_PURPOSES.has(
          String(item?.purpose || "").trim().toLowerCase()
        )
      ),
    [containerDocuments]
  );

  const normalizedManualEmail = manualEmail.trim().toLowerCase();
  const manualEmailIsSynthetic =
    /^[^\s@]+@(?:[a-z0-9-]+\.)*synthetic\.example$/i.test(
      normalizedManualEmail
    ) ||
    /^[^\s@]+@example\.(?:com|net|org)$/i.test(normalizedManualEmail);
  const verifiedRecipient = String(
    profile?.verified_email?.recipient || ""
  ).toLowerCase();
  const emailDestinationReady =
    deliveryChannel !== "email" ||
    (emailRecipientMode === "verified"
      ? profile?.verified_email?.verified === true && Boolean(verifiedRecipient)
      : manualEmailIsSynthetic && manualEmailConfirmed);
  useEffect(() => {
    if (deliveryChannel !== "email" || !profile) return;
    if (profile.verified_email?.verified === true) return;
    setEmailRecipientMode("manual");
  }, [deliveryChannel, profile]);

  useEffect(() => {
    if (deliveryChannel !== "email" || !profile?.verified_email) {
      setCorrespondenceSubject("");
      setCorrespondenceBody("");
      setCorrespondenceConfirmations(emptyCorrespondenceConfirmations());
      return;
    }
    const values = {
      caseId,
      company:
        profile.verified_email.legal_entity_name || profile.display_name,
    };
    setCorrespondenceSubject(
      fillCorrespondenceTemplate(
        profile.verified_email.subject_template,
        values
      )
    );
    setCorrespondenceBody(
      fillCorrespondenceTemplate(profile.verified_email.body_template, values)
    );
    setCorrespondenceConfirmations(emptyCorrespondenceConfirmations());
  }, [caseId, deliveryChannel, profile]);

  useEffect(() => {
    const form = profile?.portal_preparation;
    if (deliveryChannel !== "portal" || form?.enabled !== true) {
      setPortalValues({});
      setPortalConfirmations(emptyPortalPreparationConfirmations());
      return;
    }
    setPortalValues(
      Object.fromEntries(form.fields.map((field) => [field.field_code, ""]))
    );
    setPortalConfirmations(emptyPortalPreparationConfirmations());
  }, [deliveryChannel, profile]);

  useEffect(() => {
    if (!profile) return;
    const modes = Array.isArray(profile.representation_modes)
      ? profile.representation_modes
      : [];
    if (modes.includes(representationMode)) return;
    setRepresentationMode(modes.includes("self") ? "self" : modes[0] || "self");
  }, [profile, representationMode]);

  const fields = useMemo(() => {
    if (!profile) return [];
    try {
      return orderedPresenterFields(profile, representationMode);
    } catch {
      return [];
    }
  }, [profile, representationMode]);
  const outboundFields = useMemo(
    () =>
      fields.filter(
        (field) =>
          field.fieldCode !== "submission_receipt" &&
          !(field.purposes || []).some((purpose) =>
            OUTBOUND_EXCLUDED_PURPOSES.has(
              String(purpose || "").trim().toLowerCase()
            )
          )
      ),
    [fields]
  );

  const externalPurposeOptions = useMemo(() => {
    const purposes = new Set();
    for (const destination of workspace?.destinations || []) {
      for (const field of destination?.fields || []) {
        for (const purpose of field?.purposes || []) {
          const normalized = String(purpose || "").trim().toLowerCase();
          if (EXTERNAL_DOCUMENT_PURPOSES.has(normalized)) {
            if (!OUTBOUND_EXCLUDED_PURPOSES.has(normalized)) {
              purposes.add(normalized);
            }
          }
        }
      }
    }
    for (const documentVersion of workspace?.documents || []) {
      const normalized = String(documentVersion?.purpose || "")
        .trim()
        .toLowerCase();
      if (EXTERNAL_DOCUMENT_PURPOSES.has(normalized)) {
        if (!OUTBOUND_EXCLUDED_PURPOSES.has(normalized)) {
          purposes.add(normalized);
        }
      }
    }
    return Object.freeze([...purposes].sort());
  }, [workspace]);

  const externalLatestVersionCandidates = useMemo(
    () =>
      Object.freeze(
        latestPresenterDocumentVersions(workspace?.documents).filter((item) =>
          EXTERNAL_DOCUMENT_PURPOSES.has(
            String(item?.purpose || "").trim().toLowerCase()
          ) &&
          !OUTBOUND_EXCLUDED_PURPOSES.has(
            String(item?.purpose || "").trim().toLowerCase()
          )
        )
      ),
    [workspace]
  );

  const externalSupersededDocument = useMemo(
    () =>
      externalLatestVersionCandidates.find(
        (item) => item.document_version_id === externalSupersedesId
      ) || null,
    [externalLatestVersionCandidates, externalSupersedesId]
  );
  const effectiveExternalPurpose =
    externalMode === "version"
      ? String(externalSupersededDocument?.purpose || "")
      : externalPurposeOptions.includes(externalPurpose)
        ? externalPurpose
        : "";
  const externalAttachmentFilename = useMemo(
    () =>
      externalFileMetadata
        ? attachmentFilenameFromLabel(
            externalDocumentName,
            externalFileMetadata.filename
          )
        : "",
    [externalDocumentName, externalFileMetadata]
  );

  const selectedVersionIds = useMemo(
    () => selectedDocumentVersionIds(selections),
    [selections]
  );
  const authorizationCandidates = useMemo(
    () =>
      selectedVersionIds
        .map((id) => selectedDocumentVersion(workspace?.documents || [], id))
        .filter(
          (item) =>
            item &&
            AUTHORIZATION_PURPOSES.has(String(item.purpose || "").toLowerCase())
        ),
    [selectedVersionIds, workspace]
  );
  const effectiveAuthorizationVersionId =
    representationMode === "representative"
      ? authorizationCandidates.some(
          (item) => item.document_version_id === authorizationVersionId
        )
        ? authorizationVersionId
        : authorizationCandidates.length === 1
          ? authorizationCandidates[0].document_version_id
          : ""
      : null;

  const readiness = useMemo(() => {
    if (!workspace || !profile) {
      return {
        ready: false,
        payload: null,
        message: "Selecciona una sede y su perfil verificado.",
      };
    }
    return evaluateRtmPresenterReadiness({
      destinationProfile: profile,
      representationMode,
      selections,
      documents: workspace.documents,
      authorizationDocumentVersionId: effectiveAuthorizationVersionId,
      expiresAt: nextPackageExpiry(),
      supersedesPackageId,
    });
  }, [
    effectiveAuthorizationVersionId,
    profile,
    representationMode,
    selections,
    supersedesPackageId,
    workspace,
  ]);
  const portalPreparationSnapshot = useMemo(() => {
    const form = profile?.portal_preparation;
    if (deliveryChannel !== "portal" || form?.enabled !== true) return null;
    const values = Object.fromEntries(
      form.fields.map((field) => {
        const raw = String(portalValues[field.field_code] || "")
          .replace(/\r\n?/g, "\n")
          .trim();
        return [
          field.field_code,
          field.multiline ? raw : raw.replace(/\s+/g, " "),
        ];
      })
    );
    return {
      form_code: form.form_code,
      fields: form.fields.map((field) => ({
        field_code: field.field_code,
        label: field.label,
        required: field.required,
        multiline: field.multiline,
        max_length: field.max_length,
        step_order: field.step_order,
      })),
      values,
      confirmations: Object.fromEntries(
        PORTAL_PREPARATION_CONFIRMATION_KEYS.map((key) => [
          key,
          portalConfirmations[key] === true,
        ])
      ),
    };
  }, [deliveryChannel, portalConfirmations, portalValues, profile]);
  const portalFormValuesReady = Boolean(
    portalPreparationSnapshot &&
      portalPreparationSnapshot.fields.every((field) => {
        const value = portalPreparationSnapshot.values[field.field_code];
        return (
          (!field.required || value.length > 0) &&
          value.length <= field.max_length &&
          !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value) &&
          (field.multiline || !value.includes("\n"))
        );
      })
  );
  const portalConfirmed = PORTAL_PREPARATION_CONFIRMATION_KEYS.every(
    (key) => portalConfirmations[key] === true
  );
  const portalPreparationReady = portalFormValuesReady && portalConfirmed;
  const receiptCaptureAvailable = new Set([
    "awaiting_receipt",
    "completed",
  ]).has(String(delivery?.state || ""));
  const outputReady =
    readiness.ready &&
    (deliveryChannel === "email"
      ? emailDestinationReady
      : deliveryChannel === "portal"
        ? portalPreparationReady
        : false);
  const correspondenceConfirmed = CORRESPONDENCE_CONFIRMATION_KEYS.every(
    (key) => correspondenceConfirmations[key] === true
  );
  const correspondenceDraftReady =
    deliveryChannel !== "email" ||
    (correspondenceSubject.trim().length > 0 &&
      correspondenceSubject.trim().length <= 240 &&
      correspondenceBody.trim().length > 0 &&
      correspondenceBody.trim().length <= 12000 &&
      correspondenceConfirmed);
  const outputReadinessMessage = !deliveryChannel
    ? "Elige primero si vas a una sede o a RTM Correspondencia."
    : !profile
      ? "Selecciona un destino del Centro de destinos."
      : deliveryChannel === "portal" && !profile.portal_preparation
        ? "Este perfil todavía no admite una preparación segura para la cola de firma."
        : deliveryChannel === "portal" && !portalFormValuesReady
          ? "Completa Asunto, Expone y Solicita antes de continuar."
          : deliveryChannel === "portal" && !portalConfirmed
            ? "Revisa y confirma destino, interesado, representación, texto y documentos."
      : !emailDestinationReady
        ? "Selecciona un correo verificado o confirma una dirección sintética manual."
        : readiness.message;

  const editingLocked = Boolean(busyCommand) || Boolean(frozenPackage);
  const profileLocked = editingLocked || Boolean(supersedesPackageId);
  const externalIngestLocked =
    Boolean(busyCommand) ||
    Boolean(frozenPackage) ||
    Boolean(supersedesPackageId);

  function resetPreparedDelivery() {
    pendingDeliveryRef.current = null;
    setDelivery(null);
    setMessage("");
  }

  function resetFrozenState() {
    pendingFreezeRef.current = null;
    setFrozenPackage(null);
    setCorrespondenceConfirmations(emptyCorrespondenceConfirmations());
    setPortalConfirmations(emptyPortalPreparationConfirmations());
    resetPreparedDelivery();
  }

  function selectDeliveryChannel(channel) {
    if (!new Set(["portal", "email"]).has(channel) || editingLocked) return;
    setDeliveryChannel(channel);
    setProfileId("");
    setDestinationQuery("");
    setDestinationOptions(workspace?.destinations || []);
    setDirectoryResults([]);
    setDirectorySource(null);
    setDestinationSearchMissed(false);
    setDestinationProposalOpen(false);
    setDestinationProposalLabel("");
    setDestinationProposalUrl("");
    setDestinationProposalConfirmed(false);
    setSelections({});
    setAuthorizationVersionId("");
    setEmailRecipientMode("verified");
    setManualEmail("");
    setManualEmailConfirmed(false);
    setPortalValues({});
    setPortalConfirmations(emptyPortalPreparationConfirmations());
    resetFrozenState();
  }

  function chooseDestinationProfile(nextProfileId) {
    setProfileId(nextProfileId);
    setSelections({});
    setAuthorizationVersionId("");
    setEmailRecipientMode("verified");
    setManualEmail("");
    setManualEmailConfirmed(false);
    setPortalConfirmations(emptyPortalPreparationConfirmations());
    resetFrozenState();
  }

  function updateFieldSelection(fieldCode, slot, value) {
    setSelections((current) => {
      const nextValues = [...(current[fieldCode] || [])];
      nextValues[slot] = value;
      return { ...current, [fieldCode]: nextValues };
    });
    resetFrozenState();
  }

  async function searchDestinations(event) {
    event.preventDefault();
    if (!client || !workspace || searchingDestinations || busyCommand) return;
    setSearchingDestinations(true);
    setDestinationSearchMissed(false);
    setMessage("");
    try {
      const result = await client.searchDestinations(caseId, destinationQuery, {
        limit: 12,
      });
      const searchResult = destinationsFromSearchResponse(result, caseId);
      const matches = searchResult.destinations;
      const selected = profile;
      const channelFallbacks = workspace.destinations.filter((item) =>
        item.delivery_channels?.includes(deliveryChannel)
      );
      const nextOptions = Object.freeze(
        [selected, ...matches, ...channelFallbacks]
          .filter(Boolean)
          .filter(
            (item, index, values) =>
              values.findIndex(
                (candidate) =>
                  candidate.destination_profile_id ===
                  item.destination_profile_id
              ) === index
          )
      );
      setDestinationOptions(nextOptions);
      setDirectoryResults(searchResult.directoryResults);
      setDirectorySource(searchResult.directorySource);
      setDestinationSearchMissed(matches.length === 0);
      if (matches.length === 0) {
        setMessage(
          deliveryChannel === "email"
            ? "RTM no ha encontrado todavía esa empresa en el Centro de destinos. Puedes elegir el perfil sintético de correspondencia e introducir una dirección manual; quedará pendiente de verificación independiente."
            : searchResult.directoryResults.length > 0
              ? "RTM ha identificado el organismo en DIR3/SIR. Si constaba en SIR puede ser candidato para el REG cuando no haya una vía específica, pero el perfil REG aún no está activo y el resultado no se ha convertido en destino."
              : "RTM no ha identificado ese organismo en el snapshot disponible. Puedes continuar con el recorrido sintético para probar la operativa o proponer un enlace para revisión."
        );
      }
    } catch (error) {
      setMessage(publicError(error));
    } finally {
      setSearchingDestinations(false);
    }
  }

  async function proposeDestinationLink(event) {
    event.preventDefault();
    if (
      !client ||
      !workspace ||
      deliveryChannel !== "portal" ||
      !destinationProposalAllowed ||
      !destinationProposalConfirmed ||
      busyCommand ||
      commandLockRef.current
    ) {
      return;
    }
    let exactProposal;
    try {
      exactProposal = validateRtmPresenterDestinationProposal(
        destinationProposalLabel,
        destinationProposalUrl
      );
    } catch (error) {
      setMessage(publicError(error));
      return;
    }
    commandLockRef.current = true;
    setBusyCommand("propose-destination");
    setMessage("");
    try {
      const result = await client.proposeDestinationLink(caseId, {
        label: exactProposal.label,
        portalUrl: exactProposal.portalUrl,
      });
      if (
        result?.case_id !== caseId ||
        result?.label !== exactProposal.label ||
        result?.portal_url !== exactProposal.portalUrl ||
        result?.status !== "pending_independent_verification" ||
        result?.usable_as_destination !== false ||
        result?.profile_created !== false ||
        result?.portal_opened !== false ||
        result?.network_used !== false ||
        result?.external_effects_executed !== false ||
        result?.synthetic_only !== true
      ) {
        throw new Error("RTM devolvió una propuesta de sede fuera del contrato seguro.");
      }
      setDestinationProposalOpen(false);
      setDestinationProposalLabel("");
      setDestinationProposalUrl("");
      setDestinationProposalConfirmed(false);
      setMessage(
        `Enlace propuesto con referencia ${result.proposal_id}. Queda pendiente de verificación y todavía no puede abrirse ni utilizarse para presentar.`
      );
    } catch (error) {
      setMessage(publicError(error));
    } finally {
      commandLockRef.current = false;
      setBusyCommand("");
    }
  }

  function clearExternalFileInput() {
    if (externalFileInputRef.current) {
      externalFileInputRef.current.value = "";
    }
    setExternalFileMetadata(null);
    setSyntheticConfirmed(false);
  }

  function openExternalPanel(purpose = "", suggestedName = "") {
    setExternalMode("new");
    setExternalSupersedesId("");
    setExternalPurpose(
      externalPurposeOptions.includes(String(purpose || "").toLowerCase())
        ? String(purpose).toLowerCase()
        : ""
    );
    setExternalDocumentName(String(suggestedName || "").trim());
    clearExternalFileInput();
    setExternalPanelOpen(true);
    setMessage("");
  }

  function closeExternalPanel() {
    if (busyCommand === "upload-external") return;
    setExternalPanelOpen(false);
    setExternalMode("new");
    setExternalPurpose("");
    setExternalDocumentName("");
    setExternalSupersedesId("");
    clearExternalFileInput();
  }

  function chooseExternalFile(event) {
    const input = event.currentTarget;
    const file = input.files?.[0] || null;
    setExternalFileMetadata(null);
    setSyntheticConfirmed(false);
    if (!file) return;
    try {
      const metadata = validateRtmPresenterExternalFile(file);
      setExternalFileMetadata(metadata);
      setExternalDocumentName((current) =>
        current.trim() || readableFilenameStem(metadata.filename)
      );
      setMessage("");
    } catch (error) {
      input.value = "";
      setMessage(publicError(error));
    }
  }

  async function uploadExternalDocument(event) {
    event.preventDefault();
    if (
      !documentIngestAllowed ||
      externalIngestLocked ||
      commandLockRef.current ||
      !client ||
      !workspace
    ) {
      return;
    }
    const file = externalFileInputRef.current?.files?.[0] || null;
    let metadata;
    let exactAttachmentFilename;
    try {
      metadata = validateRtmPresenterExternalFile(file);
      const exactDocumentName = externalDocumentName.trim().replace(/\s+/g, " ");
      if (exactDocumentName.length < 3 || exactDocumentName.length > 120) {
        throw new Error(
          "Escribe un nombre reconocible de entre 3 y 120 caracteres."
        );
      }
      exactAttachmentFilename = validateRtmPresenterAttachmentFilename(
        externalAttachmentFilename,
        metadata.mediaType
      );
      if (!effectiveExternalPurpose) {
        throw new Error("Selecciona la finalidad del documento.");
      }
      if (syntheticConfirmed !== true) {
        throw new Error(
          "Confirma que el documento es completamente sintético y no contiene datos reales."
        );
      }
      if (externalMode === "version" && !externalSupersededDocument) {
        throw new Error("Selecciona la versión existente que se sustituye.");
      }
    } catch (error) {
      setMessage(publicError(error));
      clearExternalFileInput();
      return;
    }

    commandLockRef.current = true;
    setBusyCommand("upload-external");
    setMessage("");
    const controller = new AbortController();
    externalUploadAbortRef.current = controller;
    let uploadConfirmed = false;
    try {
      await client.uploadExternalDocument(caseId, {
        purpose: effectiveExternalPurpose,
        file,
        attachmentFilename: exactAttachmentFilename,
        syntheticConfirmed,
        supersedesDocumentVersionId:
          externalMode === "version"
            ? externalSupersededDocument.document_version_id
            : null,
        signal: controller.signal,
      });
      uploadConfirmed = true;
      const refreshed = await client.loadWorkspace(caseId, {
        signal: controller.signal,
      });
      const nextWorkspace = normalizeWorkspace(refreshed, caseId);
      setWorkspace(nextWorkspace);
      setDestinationOptions(nextWorkspace.destinations);
      setExternalMode("new");
      setExternalPurpose("");
      setExternalDocumentName("");
      setExternalSupersedesId("");
      setExternalPanelOpen(false);
      setMessage(
        `${exactAttachmentFilename} queda custodiado en RTM y pendiente de análisis. Conservamos también el nombre de origen ${metadata.filename}. En este corte el scanner y la activación aún no están conectados, por lo que todavía no será seleccionable.`
      );
    } catch (error) {
      if (uploadConfirmed) {
        pendingFreezeRef.current = null;
        setWorkspace(null);
        setProfileId("");
        setSelections({});
        setAuthorizationVersionId("");
        setFrozenPackage(null);
        setSupersedesPackageId(null);
      }
      setMessage(
        uploadConfirmed
          ? "RTM confirmó la custodia, pero no se pudo recargar el contenedor. La copia local del workspace se ha invalidado: actualiza antes de continuar."
          : publicError(error)
      );
    } finally {
      clearExternalFileInput();
      if (externalUploadAbortRef.current === controller) {
        externalUploadAbortRef.current = null;
      }
      commandLockRef.current = false;
      setBusyCommand("");
    }
  }

  async function freezePackage() {
    if (
      !new Set(["portal", "email"]).has(deliveryChannel) ||
      !profile ||
      !workspace ||
      !outputReady ||
      busyCommand ||
      commandLockRef.current
    ) {
      return;
    }
    commandLockRef.current = true;
    setBusyCommand("freeze");
    setMessage("");
    try {
      if (!pendingFreezeRef.current) {
        pendingFreezeRef.current = {
          payload: buildRtmPresenterFreezePayload({
            destinationProfile: profile,
            representationMode,
            selections,
            documents: workspace.documents,
            authorizationDocumentVersionId: effectiveAuthorizationVersionId,
            expiresAt: nextPackageExpiry(),
            supersedesPackageId,
          }),
          idempotencyKey: randomCommandKey(),
        };
      }
      const { payload, idempotencyKey } = pendingFreezeRef.current;
      const result = await client.freezePackage(caseId, payload, {
        idempotencyKey,
      });
      setFrozenPackage(
        packageFromResponse(result, {
          caseId,
          requestPayload: payload,
        })
      );
      setDelivery(null);
      pendingDeliveryRef.current = null;
      pendingFreezeRef.current = null;
      setSupersedesPackageId(null);
      setMessage(
        "Selección fijada. Los documentos siguen separados en RTM y no se ha enviado contenido fuera."
      );
    } catch (error) {
      if (error instanceof RtmPresenterApiError && error.status && error.status < 500) {
        pendingFreezeRef.current = null;
      }
      setMessage(publicError(error));
    } finally {
      commandLockRef.current = false;
      setBusyCommand("");
    }
  }

  async function prepareSelectedDelivery() {
    if (
      !new Set(["portal", "email"]).has(deliveryChannel) ||
      !frozenPackage ||
      !deliveryPrepareAllowed ||
      !emailDestinationReady ||
      !correspondenceDraftReady ||
      (deliveryChannel === "portal" && !portalPreparationReady) ||
      busyCommand ||
      commandLockRef.current
    ) {
      return;
    }
    commandLockRef.current = true;
    setBusyCommand("prepare-delivery");
    setMessage("");
    try {
      if (!pendingDeliveryRef.current) {
        pendingDeliveryRef.current = randomCommandKey();
      }
      const result = await client.prepareDelivery(
        caseId,
        frozenPackage.package_id,
        {
          channel: deliveryChannel,
          recipientEmail:
            deliveryChannel === "email" && emailRecipientMode === "manual"
              ? normalizedManualEmail
              : "",
          recipientConfirmed:
            deliveryChannel === "email" && emailRecipientMode === "manual"
              ? manualEmailConfirmed
              : false,
          correspondenceDraft:
            deliveryChannel === "email"
              ? {
                  subject: correspondenceSubject.trim(),
                  body: correspondenceBody.trim(),
                  confirmations: correspondenceConfirmations,
                }
              : null,
          portalPreparation:
            deliveryChannel === "portal" && portalPreparationSnapshot
              ? {
                  formCode: portalPreparationSnapshot.form_code,
                  values: portalPreparationSnapshot.values,
                  confirmations: portalPreparationSnapshot.confirmations,
                }
              : null,
          idempotencyKey: pendingDeliveryRef.current,
        }
      );
      setDelivery(
        deliveryFromResponse(result, {
          caseId,
          frozenPackage,
          channel: deliveryChannel,
          expectedRecipient:
            deliveryChannel === "email"
              ? emailRecipientMode === "manual"
                ? normalizedManualEmail
                : verifiedRecipient
              : "",
          expectedCorrespondence:
            deliveryChannel === "email"
              ? {
                  subject: correspondenceSubject.trim(),
                  body: correspondenceBody.trim(),
                  confirmations: correspondenceConfirmations,
                }
              : null,
          expectedPortalPreparation:
            deliveryChannel === "portal" ? portalPreparationSnapshot : null,
        })
      );
      pendingDeliveryRef.current = null;
      try {
        const queuePayload = await client.loadSignatureQueue();
        setSignatureQueue(signatureQueueFromResponse(queuePayload));
      } catch {
        setSignatureQueue(null);
      }
      setMessage(
        deliveryChannel === "email"
          ? emailRecipientMode === "manual"
            ? "Borrador de RTM Correspondencia guardado y pendiente de verificar el destinatario. No se ha enviado nada."
            : "Borrador de RTM Correspondencia auditado con destinatario verificado. El envío real continúa bloqueado en staging."
          : "Tarea añadida a la cola de firma. El certificado y la sesión siguen únicamente en el puesto local del firmante; no se ha presentado nada."
      );
    } catch (error) {
      if (error instanceof RtmPresenterApiError && error.status && error.status < 500) {
        pendingDeliveryRef.current = null;
      }
      setMessage(publicError(error));
    } finally {
      commandLockRef.current = false;
      setBusyCommand("");
    }
  }

  if (!boundary.allowed) {
    return (
      <section className="rtmp-shell" aria-label="RTM Presenter bloqueado">
        <div className="rtmp-safety-banner" role="alert">
          STAGING · SOLO CASOS SINTÉTICOS · PRESENTER BLOQUEADO
        </div>
        <section className="rtmp-card">
          <h1>Preparar presentación</h1>
          <p>La frontera de staging sintético no está completa.</p>
        </section>
      </section>
    );
  }

  return (
    <section
      className="rtmp-shell"
      aria-label="RTM Presenter"
      aria-busy={loading}
    >
      <div className="rtmp-safety-banner" role="status">
        STAGING · SOLO CASOS SINTÉTICOS · SIN EFECTO JURÍDICO
      </div>

      <header className="rtmp-hero">
        <div>
          <p className="rtmp-eyebrow">RTM Presenter</p>
          <h1>Preparar presentación</h1>
          <p>
            Documentación del expediente sintético{" "}
            <span className="rtmp-mono">{caseId || "sin identificar"}</span>
          </p>
        </div>
        <button
          type="button"
          className="rtmp-button rtmp-button-muted"
          onClick={() => void loadWorkspace()}
          disabled={
            loading ||
            !caseId ||
            editingLocked ||
            Boolean(supersedesPackageId)
          }
        >
          {loading ? "Actualizando…" : "Actualizar documentos"}
        </button>
      </header>

      <p className="rtmp-stay-notice" role="note">
        <strong>Tus documentos permanecen en RTM.</strong> Esta pantalla solo maneja
        metadatos verificados para que elijas qué documento corresponde a cada
        campo de la sede. No descarga ni crea copias locales del operador. No se crea una carpeta local.
      </p>

      {message ? (
        <p className="rtmp-alert" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}

      {!workspace && !loading ? (
        <section className="rtmp-card">
          <p>No se ha podido abrir el contenedor.</p>
        </section>
      ) : null}

      {workspace ? (
        <>
          <SignatureQueuePanel
            queue={signatureQueue}
            currentCaseId={caseId}
            onOpenCase={onOpenCase}
          />
          <section className="rtmp-card rtmp-container-card" aria-labelledby="rtmp-container-title">
            <div className="rtmp-section-heading">
              <div>
                <p className="rtmp-eyebrow">Contenedor del expediente</p>
                <h2 id="rtmp-container-title">Documentos disponibles en RTM</h2>
                <p>
                  Aquí está el expediente completo. Después elegirás el canal y
                  relacionarás cada petición de la sede o del correo con uno de
                  estos documentos.
                </p>
              </div>
              <div className="rtmp-heading-actions">
                {documentIngestAllowed ? (
                  <button
                    type="button"
                    className="rtmp-button rtmp-button-muted"
                    onClick={() =>
                      externalPanelOpen
                        ? closeExternalPanel()
                        : openExternalPanel()
                    }
                    disabled={externalIngestLocked && !externalPanelOpen}
                    aria-expanded={externalPanelOpen}
                    aria-controls="rtmp-external-panel"
                  >
                    {externalPanelOpen
                      ? "Cerrar alta"
                      : "+ Añadir documento al contenedor"}
                  </button>
                ) : null}
                <span className="rtmp-chip rtmp-chip-ok">
                  {filingDocuments.length} PARA USAR
                </span>
              </div>
            </div>
            <ul className="rtmp-container-list">
              {filingDocuments.map((documentVersion) => {
                const ready =
                  documentVersion.state === "active" &&
                  documentVersion.scan_status === "clean";
                return (
                  <li key={documentVersion.document_version_id}>
                    <span className="rtmp-document-icon" aria-hidden="true">
                      {mediaTypeLabel(documentVersion.media_type)}
                    </span>
                    <span className="rtmp-container-document-main">
                      <strong>{purposeLabel(documentVersion.purpose)}</strong>
                      <span>{documentVersion.original_filename}</span>
                      <small>
                        Versión {documentVersion.version_number} · {formatBytes(documentVersion.size_bytes)}
                      </small>
                    </span>
                    <span
                      className={`rtmp-field-status ${ready ? "is-selected" : ""}`}
                    >
                      {ready ? "LISTO" : "EN REVISIÓN"}
                    </span>
                  </li>
                );
              })}
            </ul>
            {evidenceDocuments.length > 0 ? (
              <div className="rtmp-evidence-zone" aria-labelledby="rtmp-evidence-title">
                <div>
                  <p className="rtmp-eyebrow">Evidencias posteriores</p>
                  <h3 id="rtmp-evidence-title">Justificantes y acuses</h3>
                  <p>
                    Se conservan en el expediente, pero nunca aparecen como
                    documentos para enviar.
                  </p>
                </div>
                <ul className="rtmp-container-list">
                  {evidenceDocuments.map((documentVersion) => (
                    <li key={documentVersion.document_version_id}>
                      <span className="rtmp-document-icon" aria-hidden="true">
                        {mediaTypeLabel(documentVersion.media_type)}
                      </span>
                      <span className="rtmp-container-document-main">
                        <strong>{purposeLabel(documentVersion.purpose)}</strong>
                        <span>{documentVersion.original_filename}</span>
                        <small>
                          Versión {documentVersion.version_number} · {formatBytes(documentVersion.size_bytes)}
                        </small>
                      </span>
                      <span className="rtmp-field-status is-evidence">EVIDENCIA</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="rtmp-card" aria-labelledby="rtmp-channel-title">
            <div className="rtmp-section-heading">
              <div>
                <p className="rtmp-eyebrow">¿Qué quieres hacer?</p>
                <h2 id="rtmp-channel-title">Elige cómo sale el expediente</h2>
                <p>
                  La sede y el correo son circuitos distintos. Los documentos
                  siempre se eligen desde el contenedor anterior.
                </p>
              </div>
              <span className={`rtmp-chip ${deliveryChannel ? "rtmp-chip-ok" : ""}`}>
                {deliveryChannel ? "CANAL ELEGIDO" : "PENDIENTE"}
              </span>
            </div>
            <div className="rtmp-channel-grid">
              <button
                type="button"
                className={`rtmp-channel-card ${deliveryChannel === "portal" ? "is-selected" : ""}`}
                onClick={() => selectDeliveryChannel("portal")}
                disabled={editingLocked}
                aria-pressed={deliveryChannel === "portal"}
              >
                <span className="rtmp-channel-kicker">SEDE O PORTAL</span>
                <strong>Presentar un escrito o recurso</strong>
                <span>
                  El operador prepara texto y documentos; el firmante abre la
                  sede en su propio PC y conserva siempre su certificado y sesión.
                </span>
              </button>
              <button
                type="button"
                className={`rtmp-channel-card ${deliveryChannel === "email" ? "is-selected" : ""}`}
                onClick={() => selectDeliveryChannel("email")}
                disabled={editingLocked}
                aria-pressed={deliveryChannel === "email"}
              >
                <span className="rtmp-channel-kicker">RTM CORRESPONDENCIA</span>
                <strong>Enviar una reclamación desde OPS</strong>
                <span>
                  Resuelve la empresa, el canal oficial y una plantilla aprobada;
                  después revisas texto y adjuntos desde el contenedor.
                </span>
              </button>
            </div>
          </section>

          <nav className="rtmp-flow-progress" aria-label="Progreso de la preparación">
            {deliveryChannel === "portal" ? (
              <ol>
                <li className="is-complete">
                  <span className="rtmp-progress-number">1</span>
                  <span>
                    <strong>Contenedor</strong>
                    <small>{filingDocuments.length} documentos sueltos</small>
                  </span>
                </li>
                <li className={profile ? "is-complete" : "is-current"}>
                  <span className="rtmp-progress-number">2</span>
                  <span>
                    <strong>Sede y procedimiento</strong>
                    <small>{profile ? "Elegidos" : "Pendiente"}</small>
                  </span>
                </li>
                <li className={portalFormValuesReady ? "is-complete" : profile ? "is-current" : ""}>
                  <span className="rtmp-progress-number">3</span>
                  <span>
                    <strong>Completar solicitud</strong>
                    <small>{portalFormValuesReady ? "Texto completo" : "Pendiente"}</small>
                  </span>
                </li>
                <li className={frozenPackage ? "is-complete" : portalFormValuesReady ? "is-current" : ""}>
                  <span className="rtmp-progress-number">4</span>
                  <span>
                    <strong>Fijar documentos</strong>
                    <small>{frozenPackage ? "Huellas fijadas" : "Pendiente"}</small>
                  </span>
                </li>
                <li className={delivery ? "is-complete" : frozenPackage ? "is-current" : ""}>
                  <span className="rtmp-progress-number">5</span>
                  <span>
                    <strong>Cola de firma</strong>
                    <small>{delivery ? "Preparado, no presentado" : "Pendiente"}</small>
                  </span>
                </li>
              </ol>
            ) : (
              <ol>
                <li className="is-complete">
                  <span className="rtmp-progress-number">1</span>
                  <span>
                    <strong>Contenedor</strong>
                    <small>{filingDocuments.length} documentos</small>
                  </span>
                </li>
                <li className={profile ? "is-complete" : deliveryChannel ? "is-current" : ""}>
                  <span className="rtmp-progress-number">2</span>
                  <span>
                    <strong>Empresa y canal</strong>
                    <small>{profile ? "Completo" : "Pendiente"}</small>
                  </span>
                </li>
                <li className={outputReady ? "is-complete" : profile ? "is-current" : ""}>
                  <span className="rtmp-progress-number">3</span>
                  <span>
                    <strong>Elegir adjuntos</strong>
                    <small>{outputReady ? "Completo" : "Pendiente"}</small>
                  </span>
                </li>
                <li className={frozenPackage ? "is-complete" : outputReady ? "is-current" : ""}>
                  <span className="rtmp-progress-number">4</span>
                  <span>
                    <strong>Fijar selección</strong>
                    <small>{frozenPackage ? "Completo" : "Pendiente"}</small>
                  </span>
                </li>
                <li className={delivery ? "is-complete" : frozenPackage ? "is-current" : ""}>
                  <span className="rtmp-progress-number">5</span>
                  <span>
                    <strong>Correspondencia</strong>
                    <small>{delivery ? "Borrador preparado" : "Pendiente"}</small>
                  </span>
                </li>
              </ol>
            )}
          </nav>

          {deliveryChannel ? (
          <section className="rtmp-card" aria-labelledby="rtmp-destination-title">
            <div className="rtmp-section-heading">
              <div>
                <p className="rtmp-eyebrow">Paso 2 · Canal y destino</p>
                <h2 id="rtmp-destination-title">
                  {deliveryChannel === "email"
                    ? "¿A qué empresa u organismo escribes?"
                    : "¿Qué sede o procedimiento vas a abrir?"}
                </h2>
                <p>
                  {deliveryChannel === "email"
                    ? "Busca una empresa o una dirección ya registrada. Después elegirás los adjuntos desde el contenedor."
                    : "Elige un perfil disponible y cómo actúas. Los documentos no se preseleccionan: la sede irá pidiéndolos uno a uno."}
                </p>
              </div>
              <span className={`rtmp-chip ${profile ? "rtmp-chip-ok" : ""}`}>
                {profile ? "DESTINO ELEGIDO" : "PENDIENTE"}
              </span>
            </div>
            <form className="rtmp-destination-search" onSubmit={searchDestinations}>
              <label>
                {deliveryChannel === "email"
                  ? "Buscar empresa, organismo o correo verificado"
                  : "Buscar organismo o procedimiento"}
                <input
                  type="search"
                  value={destinationQuery}
                  minLength={2}
                  maxLength={100}
                  placeholder={
                    deliveryChannel === "email"
                      ? "Ej. empresa sintética, atención al cliente…"
                      : "Ej. DGT, alegaciones, ayuntamiento…"
                  }
                  disabled={profileLocked || searchingDestinations}
                  onChange={(event) => {
                    setDestinationQuery(event.target.value);
                    setDestinationSearchMissed(false);
                    setDirectoryResults([]);
                    setDirectorySource(null);
                    setDestinationProposalOpen(false);
                  }}
                />
              </label>
              <button
                type="submit"
                className="rtmp-button rtmp-button-secondary"
                disabled={
                  profileLocked ||
                  searchingDestinations ||
                  destinationQuery.trim().length < 2
                }
              >
                {searchingDestinations ? "Buscando…" : "Buscar en RTM"}
              </button>
            </form>
            <p className="rtmp-help">
              {deliveryChannel === "email"
                ? "OPS busca primero en el Centro de destinos verificados. Si no está, puedes escribir un correo manual y solicitar su confirmación."
                : "DIR3 identifica el organismo. Si constaba en SIR, puede ser candidato para el REG cuando no exista un procedimiento o formulario específico. RTM todavía debe verificar la integración, la competencia y la vía correcta."}
            </p>
            {deliveryChannel === "portal" && directoryResults.length > 0 ? (
              <section className="rtmp-directory-results" aria-labelledby="rtmp-directory-results-title">
                <div className="rtmp-directory-results-heading">
                  <div>
                    <p className="rtmp-eyebrow">Directorio administrativo</p>
                    <h3 id="rtmp-directory-results-title">Organismos encontrados</h3>
                  </div>
                  <span className="rtmp-directory-date">
                    Snapshot {directorySource?.official_listing_modified_at}
                  </span>
                </div>
                <p className="rtmp-help">
                  Sirven para identificar el organismo. No son todavía una sede
                  ni un procedimiento seleccionable.
                </p>
                <ul className="rtmp-directory-list">
                  {directoryResults.map((result) => (
                    <li key={result.directory_code}>
                      <div className="rtmp-directory-primary">
                        <strong>{result.display_name}</strong>
                        <span>
                          {[result.locality_name, result.province, result.autonomous_community]
                            .filter(Boolean)
                            .filter((value, index, values) => values.indexOf(value) === index)
                            .join(" · ")}
                        </span>
                      </div>
                      <div className="rtmp-directory-badges">
                        <span>DIR3 {result.directory_code}</span>
                        <span className={result.sir_listed ? "is-sir" : "is-pending"}>
                          {result.sir_listed
                            ? "Constaba en SIR · candidato REG"
                            : "Sin oficina SIR en el snapshot"}
                        </span>
                      </div>
                      {result.sir_offices.length > 0 ? (
                        <details>
                          <summary>Ver oficina registral de referencia</summary>
                          <ul>
                            {result.sir_offices.map((office) => (
                              <li key={office.office_code}>
                                <span className="rtmp-mono">{office.office_code}</span>
                                {" · "}{office.office_name}
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                      <p>
                        {result.sir_listed
                          ? "Puede encajar en el REG si la integración sigue vigente y no existe una vía específica. Falta verificar competencia, procedimiento y destino antes de abrirlo."
                          : "Falta verificar el procedimiento, su enlace y si esta unidad es competente para este expediente."}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {deliveryChannel === "portal" &&
            destinationSearchMissed &&
            destinationProposalAllowed ? (
              <section className="rtmp-destination-proposal" aria-labelledby="rtmp-destination-proposal-title">
                <div>
                  <h3 id="rtmp-destination-proposal-title">¿La sede no aparece?</h3>
                  <p>
                    Puedes proponer su enlace para que el Centro de destinos lo
                    revise. La propuesta no se abrirá ni podrá utilizarse hasta
                    superar una verificación independiente.
                  </p>
                </div>
                {!destinationProposalOpen ? (
                  <button
                    type="button"
                    className="rtmp-button rtmp-button-muted"
                    disabled={Boolean(busyCommand)}
                    onClick={() => {
                      setDestinationProposalLabel(destinationQuery.trim());
                      setDestinationProposalOpen(true);
                      setDestinationProposalConfirmed(false);
                    }}
                  >
                    Proponer enlace de sede
                  </button>
                ) : (
                  <form className="rtmp-form-stack" onSubmit={proposeDestinationLink}>
                    <label>
                      Nombre reconocible
                      <input
                        type="text"
                        value={destinationProposalLabel}
                        minLength={3}
                        maxLength={120}
                        required
                        disabled={Boolean(busyCommand)}
                        placeholder="Ej.: Trámite sintético de alegaciones"
                        onChange={(event) =>
                          setDestinationProposalLabel(event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Enlace de la sede
                      <input
                        type="url"
                        value={destinationProposalUrl}
                        minLength={9}
                        maxLength={1024}
                        required
                        disabled={Boolean(busyCommand)}
                        placeholder="https://tramite.synthetic.example/recurso"
                        onChange={(event) => {
                          setDestinationProposalUrl(event.target.value);
                          setDestinationProposalConfirmed(false);
                        }}
                      />
                    </label>
                    <label className="rtmp-check-line">
                      <input
                        type="checkbox"
                        checked={destinationProposalConfirmed}
                        required
                        disabled={Boolean(busyCommand)}
                        onChange={(event) =>
                          setDestinationProposalConfirmed(event.target.checked)
                        }
                      />
                      <span>
                        <strong>Entiendo que es una propuesta, no una sede verificada</strong>
                        <span className="rtmp-help">
                          Staging solo admite enlaces sintéticos y no realiza ninguna conexión.
                        </span>
                      </span>
                    </label>
                    <div className="rtmp-button-row">
                      <button
                        type="submit"
                        className="rtmp-button rtmp-button-primary"
                        disabled={
                          Boolean(busyCommand) ||
                          !destinationProposalConfirmed ||
                          destinationProposalLabel.trim().length < 3 ||
                          destinationProposalUrl.trim().length < 9
                        }
                      >
                        {busyCommand === "propose-destination"
                          ? "Registrando propuesta…"
                          : "Enviar para verificar"}
                      </button>
                      <button
                        type="button"
                        className="rtmp-button rtmp-button-muted"
                        disabled={Boolean(busyCommand)}
                        onClick={() => {
                          setDestinationProposalOpen(false);
                          setDestinationProposalUrl("");
                          setDestinationProposalConfirmed(false);
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}
              </section>
            ) : null}
            {availableChannelDestinations.length > 0 ? (
              <div className="rtmp-synthetic-routes" role="group" aria-label="Recorridos sintéticos disponibles">
                <span>Para continuar la prueba ahora:</span>
                {availableChannelDestinations.map((item) => (
                  <button
                    key={item.destination_profile_id}
                    type="button"
                    className="rtmp-inline-action"
                    disabled={profileLocked}
                    onClick={() =>
                      chooseDestinationProfile(item.destination_profile_id)
                    }
                  >
                    Usar {item.display_name}
                  </button>
                ))}
              </div>
            ) : null}
            <label className="rtmp-single-field">
              {deliveryChannel === "email"
                ? "Empresa u organismo"
                : "Sede o procedimiento verificado"}
              <select
                value={profileId}
                onChange={(event) =>
                  chooseDestinationProfile(event.target.value)
                }
                disabled={profileLocked}
              >
                <option value="">
                  {deliveryChannel === "email"
                    ? "Selecciona una empresa u organismo"
                    : "Selecciona una sede o procedimiento"}
                </option>
                {destinationOptions.map((item) => (
                  <option
                    key={item.destination_profile_id}
                    value={item.destination_profile_id}
                    disabled={!item.delivery_channels?.includes(deliveryChannel)}
                  >
                    {item.display_name}
                    {!item.delivery_channels?.includes(deliveryChannel)
                      ? ` · ${correspondenceChannelStatusLabel(
                          item.verified_email?.channel_status
                        )}`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
            {profile ? (
              <details className="rtmp-technical-details">
                <summary>
                  Ver datos técnicos verificados del destino
                </summary>
                <dl className="rtmp-profile-meta">
                  <div>
                    <dt>Origen exacto</dt>
                    <dd className="rtmp-mono">{profile.portal_origin}</dd>
                  </div>
                  <div>
                    <dt>Perfil verificado</dt>
                    <dd>
                      {profile.profile_code} · versión {profile.profile_version}
                    </dd>
                  </div>
                  <div>
                    <dt>Huella del perfil</dt>
                    <dd className="rtmp-mono">{profile.profile_sha256}</dd>
                  </div>
                  {deliveryChannel === "email" ? (
                    <div>
                      <dt>Fuente oficial</dt>
                      <dd className="rtmp-mono">
                        {profile.verified_email?.official_source_url}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </details>
            ) : null}
            {profile ? (
              <fieldset className="rtmp-actor-fieldset">
                <legend>¿Cómo actúas en este trámite?</legend>
                {ACTOR_OPTIONS.filter((option) =>
                  profile.representation_modes?.includes(option.value)
                ).map((option) => (
                  <label key={option.value} className="rtmp-radio-card">
                    <input
                      type="radio"
                      name="rtmp-actor-mode"
                      value={option.value}
                      checked={representationMode === option.value}
                      disabled={editingLocked}
                      onChange={(event) => {
                        setRepresentationMode(event.target.value);
                        setSelections({});
                        setAuthorizationVersionId("");
                        resetFrozenState();
                      }}
                    />
                    {option.label}
                  </label>
                ))}
              </fieldset>
            ) : null}

            {profile && deliveryChannel === "email" ? (
              <section className="rtmp-email-destination" aria-labelledby="rtmp-email-title">
                <div>
                  <p className="rtmp-eyebrow">Destinatario del correo</p>
                  <h3 id="rtmp-email-title">Elige una dirección</h3>
                </div>
                <dl className="rtmp-destination-evidence">
                  <div>
                    <dt>Empresa jurídica</dt>
                    <dd>{profile.verified_email?.legal_entity_name}</dd>
                  </div>
                  <div>
                    <dt>Papel en la reclamación</dt>
                    <dd>{profile.verified_email?.entity_role}</dd>
                  </div>
                  <div>
                    <dt>Canal oficial</dt>
                    <dd>
                      {profile.verified_email?.channel_label} · {" "}
                      {correspondenceChannelStatusLabel(
                        profile.verified_email?.channel_status
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Materias admitidas</dt>
                    <dd>{profile.verified_email?.routing_scope_label}</dd>
                  </div>
                  <div>
                    <dt>Derivación necesaria</dt>
                    <dd>{profile.verified_email?.routing_warning}</dd>
                  </div>
                  <div>
                    <dt>Fuente verificada</dt>
                    <dd>{profile.verified_email?.official_source_label}</dd>
                  </div>
                  <div>
                    <dt>Última comprobación</dt>
                    <dd>{String(profile.verified_at)}</dd>
                  </div>
                  <div>
                    <dt>Alternativa probatoria</dt>
                    <dd>{profile.verified_email?.recommended_evidence_channel}</dd>
                  </div>
                  <div>
                    <dt>Adjuntos sensibles</dt>
                    <dd>{profile.verified_email?.sensitive_attachment_policy}</dd>
                  </div>
                </dl>
                <div className="rtmp-email-choice-grid">
                  <label
                    className={`rtmp-radio-card ${
                      emailRecipientMode === "verified" ? "is-selected" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="rtmp-email-recipient-mode"
                      value="verified"
                      checked={emailRecipientMode === "verified"}
                      disabled={
                        editingLocked || profile.verified_email?.verified !== true
                      }
                      onChange={() => {
                        setEmailRecipientMode("verified");
                        setManualEmail("");
                        setManualEmailConfirmed(false);
                        resetFrozenState();
                      }}
                    />
                    <span>
                      <strong>Usar correo verificado por RTM</strong>
                      <span className="rtmp-help">
                        {profile.verified_email?.verified === true
                          ? profile.verified_email.recipient
                          : "Este destino todavía no tiene correo verificado."}
                      </span>
                    </span>
                  </label>
                  <label
                    className={`rtmp-radio-card ${
                      emailRecipientMode === "manual" ? "is-selected" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="rtmp-email-recipient-mode"
                      value="manual"
                      checked={emailRecipientMode === "manual"}
                      disabled={editingLocked}
                      onChange={() => {
                        setEmailRecipientMode("manual");
                        setManualEmailConfirmed(false);
                        resetFrozenState();
                      }}
                    />
                    <span>
                      <strong>Introducir otra dirección</strong>
                      <span className="rtmp-help">
                        Quedará pendiente de verificación antes de poder enviarse.
                      </span>
                    </span>
                  </label>
                </div>
                {emailRecipientMode === "manual" ? (
                  <div className="rtmp-manual-email-panel">
                    <label>
                      Correo electrónico
                      <input
                        type="email"
                        value={manualEmail}
                        placeholder="reclamaciones@synthetic.example"
                        disabled={editingLocked}
                        onChange={(event) => {
                          setManualEmail(event.target.value);
                          setManualEmailConfirmed(false);
                          resetFrozenState();
                        }}
                      />
                    </label>
                    <label className="rtmp-check-line">
                      <input
                        type="checkbox"
                        checked={manualEmailConfirmed}
                        disabled={editingLocked || !manualEmailIsSynthetic}
                        onChange={(event) => {
                          setManualEmailConfirmed(event.target.checked);
                          resetFrozenState();
                        }}
                      />
                      <span>
                        <strong>He comprobado la dirección escrita</strong>
                        <span className="rtmp-help">
                          En staging solo se admiten dominios sintéticos reservados.
                        </span>
                      </span>
                    </label>
                    {manualEmail && !manualEmailIsSynthetic ? (
                      <p className="rtmp-alert" role="note">
                        Esta prueba no admite correos reales. Utiliza una dirección
                        terminada en synthetic.example.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </section>
            ) : null}
          </section>
          ) : null}

          {deliveryChannel === "portal" && profile ? (
            <section
              className="rtmp-card rtmp-portal-open-card"
              aria-labelledby="rtmp-portal-preparation-title"
            >
              <div className="rtmp-section-heading">
                <div>
                  <p className="rtmp-eyebrow">Paso 3 · Hoja del trámite</p>
                  <h2 id="rtmp-portal-preparation-title">
                    Deja completa la solicitud para el firmante
                  </h2>
                  <p>
                    El operador prepara los datos que verá el puesto de firma. No
                    abre la sesión de la sede ni utiliza el certificado del firmante.
                  </p>
                </div>
                <span className={`rtmp-chip ${portalFormValuesReady ? "rtmp-chip-ok" : "rtmp-chip-warn"}`}>
                  {portalFormValuesReady ? "TEXTO COMPLETO" : "PENDIENTE"}
                </span>
              </div>
              <div className="rtmp-portal-origin-box">
                <span>
                  <strong>{profile.display_name}</strong>
                  <small className="rtmp-mono">{profile.portal_origin}</small>
                </span>
                <span className="rtmp-field-status">SESIÓN DEL FIRMANTE</span>
              </div>
              {profile.portal_preparation ? (
                <div className="rtmp-form-stack">
                  {profile.portal_preparation.fields.map((field) => {
                    const value = portalValues[field.field_code] || "";
                    const controlProps = {
                      value,
                      maxLength: field.max_length,
                      required: field.required,
                      disabled: editingLocked || Boolean(delivery),
                      onChange: (event) => {
                        setPortalValues((current) => ({
                          ...current,
                          [field.field_code]: event.target.value,
                        }));
                        resetFrozenState();
                      },
                    };
                    return (
                      <label key={field.field_code}>
                        {field.label}{field.required ? " *" : ""}
                        {field.multiline ? (
                          <textarea rows={field.field_code === "subject" ? 2 : 6} {...controlProps} />
                        ) : (
                          <input type="text" {...controlProps} />
                        )}
                        <span className="rtmp-help">
                          {value.trim().length}/{field.max_length} caracteres
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="rtmp-alert rtmp-alert-error" role="alert">
                  Este perfil aún no define una hoja segura para la cola de firma.
                  No se puede preparar con datos inventados.
                </p>
              )}
              <p className="rtmp-alert" role="note">
                El puesto local abrirá la sede y completará los pasos previos. La
                firma final siempre requerirá tu certificado y una revisión humana.
              </p>
            </section>
          ) : null}

          {(profile && deliveryChannel) || externalPanelOpen ? (
          <section className="rtmp-card" aria-labelledby="rtmp-checklist-title">
            {profile && deliveryChannel ? (
            <div className="rtmp-section-heading">
              <div>
                <p className="rtmp-eyebrow">
                  {deliveryChannel === "portal" ? "Paso 4 · Documentos exactos" : "Paso 3 · Elegir documentos"}
                </p>
                <h2 id="rtmp-checklist-title">
                  {deliveryChannel === "email"
                    ? "Documentos que acompañarán al correo"
                    : "Documentos que el puente entregará uno a uno"}
                </h2>
                <p>
                  {deliveryChannel === "email"
                    ? "Selecciona desde el contenedor lo que acredita el problema o reclamación."
                    : "Fija qué versión corresponde a cada requisito. En el puesto de firma, el puente la entregará solo cuando la sede muestre su casilla."}
                </p>
              </div>
              <div className="rtmp-heading-actions">
                <span
                  className={`rtmp-chip ${
                    outputReady ? "rtmp-chip-ok" : "rtmp-chip-warn"
                  }`}
                >
                  {outputReady ? "COMPLETO" : "PENDIENTE"}
                </span>
              </div>
            </div>
            ) : null}

            {documentIngestAllowed && externalPanelOpen ? (
              <>
              <button
                type="button"
                className="rtmp-modal-backdrop"
                aria-label="Cerrar alta de documento"
                onClick={closeExternalPanel}
                disabled={busyCommand === "upload-external"}
              />
              <section
                id="rtmp-external-panel"
                className="rtmp-ingest-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="rtmp-external-title"
              >
                <div className="rtmp-section-heading rtmp-ingest-heading">
                  <div>
                    <p className="rtmp-eyebrow">Documento externo</p>
                    <h3 id="rtmp-external-title">
                      Añadir documento al contenedor
                    </h3>
                    <p>
                      Ponle un nombre claro para reconocerlo. RTM conservará
                      el tipo interno, el nombre de origen, la versión y la huella.
                    </p>
                  </div>
                  <span className="rtmp-chip rtmp-chip-warn">
                    Análisis obligatorio
                  </span>
                </div>

                <form
                  className="rtmp-form-stack"
                  onSubmit={uploadExternalDocument}
                >
                  <fieldset className="rtmp-actor-fieldset">
                    <legend>¿Qué quieres hacer?</legend>
                    <label className="rtmp-radio-card">
                      <input
                        type="radio"
                        name="rtmp-external-mode"
                        value="new"
                        checked={externalMode === "new"}
                        disabled={externalIngestLocked}
                        onChange={() => {
                          setExternalMode("new");
                          setExternalSupersedesId("");
                        }}
                      />
                      Es un documento nuevo
                    </label>
                    <label className="rtmp-radio-card">
                      <input
                        type="radio"
                        name="rtmp-external-mode"
                        value="version"
                        checked={externalMode === "version"}
                        disabled={externalIngestLocked}
                        onChange={() => {
                          setExternalMode("version");
                          setExternalSupersedesId("");
                        }}
                      />
                      Sustituye o mejora uno existente
                    </label>
                  </fieldset>

                  <div className="rtmp-ingest-grid">
                    <label className="rtmp-ingest-name-field">
                      Nombre reconocible para el operador
                      <input
                        type="text"
                        value={externalDocumentName}
                        minLength={3}
                        maxLength={120}
                        required
                        disabled={externalIngestLocked}
                        placeholder="Ej.: Resolución sancionadora DGT"
                        onChange={(event) =>
                          setExternalDocumentName(event.target.value)
                        }
                      />
                      <span className="rtmp-help">
                        Es libre, pero el tipo documental seguirá controlado por RTM.
                      </span>
                    </label>
                    {externalMode === "new" ? (
                      <label>
                        ¿Qué documento es?
                        <select
                          value={effectiveExternalPurpose}
                          disabled={externalIngestLocked}
                          required
                          onChange={(event) =>
                            setExternalPurpose(event.target.value)
                          }
                        >
                          <option value="">Selecciona el tipo de documento</option>
                          {externalPurposeOptions.map((purpose) => (
                            <option key={purpose} value={purpose}>
                              {purposeLabel(purpose)}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <label>
                        Documento que se sustituye
                        <select
                          value={externalSupersedesId}
                          disabled={externalIngestLocked}
                          required
                          onChange={(event) =>
                            setExternalSupersedesId(event.target.value)
                          }
                        >
                          <option value="">Selecciona el documento anterior</option>
                          {externalLatestVersionCandidates.map(
                            (documentVersion) => (
                              <option
                                key={documentVersion.document_version_id}
                                value={documentVersion.document_version_id}
                              >
                                {versionLabel(documentVersion)}
                              </option>
                            )
                          )}
                        </select>
                        {externalSupersededDocument ? (
                          <span className="rtmp-help">
                            Mantendrá el tipo «
                            {purposeLabel(effectiveExternalPurpose)}».
                          </span>
                        ) : null}
                      </label>
                    )}

                    <label>
                      Seleccionar archivo
                      <input
                        ref={externalFileInputRef}
                        type="file"
                        accept={RTM_PRESENTER_EXTERNAL_DOCUMENT_ACCEPT}
                        disabled={externalIngestLocked}
                        required
                        aria-describedby="rtmp-external-file-help"
                        onChange={chooseExternalFile}
                      />
                    </label>
                  </div>

                  <p id="rtmp-external-file-help" className="rtmp-help">
                    PDF, DOCX, JPEG o PNG; máximo 25 MiB. El archivo se envía a
                    RTM sin crear una previsualización ni una copia local.
                  </p>
                  {externalFileMetadata ? (
                    <p className="rtmp-version-summary" role="status">
                      <strong>
                        Se adjuntará como: {externalAttachmentFilename || "—"}
                      </strong>
                      <span>
                        Origen conservado: {externalFileMetadata.filename} ·{" "}
                        {externalFileMetadata.mediaType} · {formatBytes(externalFileMetadata.size)}
                      </span>
                    </p>
                  ) : null}
                  <label className="rtmp-check-line">
                    <input
                      type="checkbox"
                      checked={syntheticConfirmed}
                      disabled={externalIngestLocked || !externalFileMetadata}
                      required
                      onChange={(event) =>
                        setSyntheticConfirmed(event.target.checked)
                      }
                    />
                    <span>
                      <strong>
                        Confirmo que es un documento completamente sintético y
                        sin datos reales
                      </strong>
                      <span className="rtmp-help">
                        Esta confirmación solo aparece en staging.
                      </span>
                    </span>
                  </label>
                  {externalIngestLocked && !busyCommand ? (
                    <p className="rtmp-alert" role="note">
                      Termina la preparación actual antes de añadir otra versión.
                    </p>
                  ) : null}
                  <div className="rtmp-button-row">
                    <button
                      type="submit"
                      className="rtmp-button rtmp-button-primary"
                      disabled={
                        externalIngestLocked ||
                        !externalFileMetadata ||
                        externalDocumentName.trim().length < 3 ||
                        !externalAttachmentFilename ||
                        !effectiveExternalPurpose ||
                        !syntheticConfirmed ||
                        (externalMode === "version" &&
                          !externalSupersededDocument)
                      }
                    >
                      {busyCommand === "upload-external"
                        ? "Guardando en RTM…"
                        : "Guardar en RTM"}
                    </button>
                    <button
                      type="button"
                      className="rtmp-button rtmp-button-muted"
                      onClick={closeExternalPanel}
                      disabled={busyCommand === "upload-external"}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </section>
              </>
            ) : null}

            {deliveryChannel && profile ? (
            <>
            <ol className="rtmp-requirements">
              {outboundFields.map((field, index) => {
                const candidates = matchingPresenterDocumentVersions(
                  workspace.documents,
                  field
                );
                const values = selections[field.fieldCode] || [];
                return (
                  <li key={field.fieldCode} className="rtmp-requirement">
                    <div className="rtmp-step-number" aria-hidden="true">
                      {index + 1}
                    </div>
                    <div className="rtmp-requirement-body">
                      <div className="rtmp-requirement-title">
                        <h3>{fieldLabel(field)}</h3>
                        <span
                          className={`rtmp-field-status ${
                            values.filter(Boolean).length > 0
                              ? "is-selected"
                              : ""
                          }`}
                        >
                          {values.filter(Boolean).length > 0
                            ? "ELEGIDO"
                            : field.required
                              ? "OBLIGATORIO"
                              : "OPCIONAL"}
                        </span>
                      </div>
                      <p className="rtmp-help">
                        Admite {field.mediaTypes.map(mediaTypeLabel).join(", ")} ·{" "}
                        hasta {field.maxFiles}{" "}
                        {field.maxFiles === 1 ? "documento" : "documentos"} ·{" "}
                        máximo {formatBytes(field.maxBytes)} cada uno
                      </p>
                      <div className="rtmp-selection-slots">
                        {Array.from({ length: field.maxFiles }, (_, slot) => {
                          const selectedId = values[slot] || "";
                          const selected = selectedDocumentVersion(
                            workspace.documents,
                            selectedId
                          );
                          return (
                            <div
                              key={`${field.fieldCode}-${slot}`}
                              className={`rtmp-version-slot ${
                                selected ? "is-selected" : ""
                              }`}
                            >
                              <label>
                                {field.maxFiles === 1
                                  ? "Documento del expediente"
                                  : `Documento ${slot + 1}`}
                                <select
                                  aria-label={`Elegir desde RTM: ${fieldLabel(
                                    field
                                  )}${
                                    field.maxFiles === 1 ? "" : ` ${slot + 1}`
                                  }`}
                                  value={selectedId}
                                  required={field.required && slot === 0}
                                  disabled={editingLocked}
                                  onChange={(event) =>
                                    updateFieldSelection(
                                      field.fieldCode,
                                      slot,
                                      event.target.value
                                    )
                                  }
                                >
                                  <option value="">
                                    {field.required && slot === 0
                                      ? "Elegir desde RTM"
                                      : "No añadir otro documento"}
                                  </option>
                                  {candidates.map((documentVersion) => (
                                    <option
                                      key={documentVersion.document_version_id}
                                      value={documentVersion.document_version_id}
                                    >
                                      {versionLabel(documentVersion)}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              {selected ? (
                                <details className="rtmp-selected-details">
                                  <summary>Ver detalles del documento elegido</summary>
                                  <dl className="rtmp-version-meta">
                                    <div>
                                      <dt>Tipo documental</dt>
                                      <dd>{purposeLabel(selected.purpose)}</dd>
                                    </div>
                                    <div>
                                      <dt>Formato</dt>
                                      <dd>{mediaTypeLabel(selected.media_type)}</dd>
                                    </div>
                                    <div>
                                      <dt>Versión</dt>
                                      <dd>{selected.version_number}</dd>
                                    </div>
                                    <div>
                                      <dt>Huella SHA-256</dt>
                                      <dd className="rtmp-mono">{selected.sha256}</dd>
                                    </div>
                                  </dl>
                                </details>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                      {documentIngestAllowed && candidates.length === 0 ? (
                        <button
                          type="button"
                          className="rtmp-inline-action"
                          onClick={() =>
                            openExternalPanel(
                              preferredExternalPurpose(field),
                              fieldLabel(field)
                            )
                          }
                          disabled={externalIngestLocked}
                        >
                          + Añadir un documento para este requisito
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>

            {representationMode === "representative" ? (
              <label className="rtmp-single-field">
                Autorización que acredita la representación
                <select
                  value={effectiveAuthorizationVersionId || ""}
                  onChange={(event) => {
                    setAuthorizationVersionId(event.target.value);
                    resetFrozenState();
                  }}
                  required
                  disabled={editingLocked}
                >
                  <option value="">Elegir autorización desde RTM</option>
                  {authorizationCandidates.map((item) => (
                    <option
                      key={item.document_version_id}
                      value={item.document_version_id}
                    >
                      {versionLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            </>
            ) : null}
          </section>
          ) : null}

          {deliveryChannel && profile ? (
          <section className="rtmp-card" aria-labelledby="rtmp-freeze-title">
            <div className="rtmp-section-heading">
              <div>
                <p className="rtmp-eyebrow">
                  {deliveryChannel === "portal" ? "Paso 4 · Revisar y fijar" : "Paso 4 · Revisar selección"}
                </p>
                <h2 id="rtmp-freeze-title">
                  {deliveryChannel === "portal"
                    ? "Revisar la tarea antes de enviarla a firma"
                    : "Revisar los adjuntos de Correspondencia"}
                </h2>
                <p>
                  {frozenPackage
                    ? "La selección ha quedado fijada sin sacar documentos de RTM."
                    : outputReadinessMessage}
                </p>
              </div>
              {frozenPackage ? (
                <span className="rtmp-chip rtmp-chip-ok">SELECCIÓN FIJADA</span>
              ) : null}
            </div>
            {deliveryChannel === "portal" && !frozenPackage ? (
              <fieldset className="rtmp-correspondence-confirmations">
                <legend>Comprobaciones obligatorias del operador</legend>
                {PORTAL_PREPARATION_CONFIRMATION_KEYS.map((key) => (
                  <label key={key} className="rtmp-check-line">
                    <input
                      type="checkbox"
                      checked={portalConfirmations[key] === true}
                      disabled={Boolean(busyCommand) || !portalFormValuesReady || !readiness.ready}
                      onChange={(event) => {
                        setPortalConfirmations((current) => ({
                          ...current,
                          [key]: event.target.checked,
                        }));
                        resetPreparedDelivery();
                      }}
                    />
                    <span>{PORTAL_PREPARATION_CONFIRMATION_LABELS[key]}</span>
                  </label>
                ))}
              </fieldset>
            ) : null}
            {frozenPackage ? (
              <>
                <div className="rtmp-ready-summary" role="status">
                  <strong>
                    {deliveryChannel === "portal"
                      ? "Texto y documentos fijados para el puesto de firma."
                      : "Adjuntos fijados para redactar la correspondencia."}
                  </strong>
                  <span>
                    {frozenPackage.items.length}{" "}
                    {frozenPackage.items.length === 1
                      ? "documento relacionado"
                      : "documentos relacionados"}
                  </span>
                </div>
                <details className="rtmp-technical-details">
                  <summary>Ver identificadores y huellas de la selección</summary>
                  <dl className="rtmp-package-meta">
                    <div>
                      <dt>Selección interna</dt>
                      <dd className="rtmp-mono">{frozenPackage.package_id}</dd>
                    </div>
                    <div>
                      <dt>Versión de la selección</dt>
                      <dd>{frozenPackage.package_version}</dd>
                    </div>
                    <div>
                      <dt>Huella de la selección</dt>
                      <dd className="rtmp-mono">
                        {frozenPackage.manifest_sha256}
                      </dd>
                    </div>
                    <div>
                      <dt>Caduca</dt>
                      <dd>{String(frozenPackage.expires_at)}</dd>
                    </div>
                  </dl>
                </details>
                <button
                  type="button"
                  className="rtmp-button rtmp-button-secondary rtmp-new-version-button"
                  onClick={() => {
                    setSupersedesPackageId(frozenPackage.package_id);
                    setFrozenPackage(null);
                    setDelivery(null);
                    setCorrespondenceConfirmations(
                      emptyCorrespondenceConfirmations()
                    );
                    setPortalConfirmations(
                      emptyPortalPreparationConfirmations()
                    );
                    pendingDeliveryRef.current = null;
                    setMessage(
                      "Puedes cambiar la selección y preparar una nueva versión; la anterior no se modifica."
                    );
                  }}
                >
                  Cambiar la selección
                </button>
              </>
            ) : (
              <button
                type="button"
                className="rtmp-button rtmp-button-primary"
                onClick={() => void freezePackage()}
                disabled={!outputReady || Boolean(busyCommand)}
              >
                {busyCommand === "freeze"
                  ? "Fijando selección…"
                  : deliveryChannel === "portal"
                    ? "Fijar tarea para firma"
                    : "Fijar adjuntos elegidos"}
              </button>
            )}
          </section>
          ) : null}

          {deliveryChannel === "portal" && frozenPackage ? (
            <>
              <section
                className="rtmp-card rtmp-extension-card"
                aria-labelledby="rtmp-signature-queue-title"
              >
                <div className="rtmp-section-heading">
                  <div>
                    <p className="rtmp-eyebrow">Paso 5 · Cola de firma</p>
                    <h2 id="rtmp-signature-queue-title">
                      {delivery ? "Preparado para tu revisión y firma" : "Dejar la tarea al firmante"}
                    </h2>
                    <p>
                      Se fijan el texto y las huellas de cada documento. La cola no
                      guarda el certificado, no comparte la sesión y no presenta nada.
                    </p>
                  </div>
                  <span className={`rtmp-chip ${delivery ? "rtmp-chip-ok" : "rtmp-chip-warn"}`}>
                    {delivery ? "EN COLA · NO PRESENTADO" : "PENDIENTE"}
                  </span>
                </div>
                <dl className="rtmp-correspondence-routing">
                  <div>
                    <dt>Destino</dt>
                    <dd>{profile.display_name}</dd>
                  </div>
                  <div>
                    <dt>Firmante</dt>
                    <dd>Puesto local autorizado</dd>
                  </div>
                  <div>
                    <dt>Certificado en RTM/Render</dt>
                    <dd>No permitido</dd>
                  </div>
                  <div>
                    <dt>Sesión compartida</dt>
                    <dd>No</dd>
                  </div>
                </dl>
                <ol className="rtmp-delivery-list">
                  {frozenPackage.items.map((item) => (
                    <li key={item.item_id}>
                      <span className="rtmp-delivery-order">{item.item_order}</span>
                      <span>
                        <strong>{FIELD_LABELS[item.field_code] || item.field_code}</strong>
                        <small>{item.portal_filename}</small>
                      </span>
                      <span className="rtmp-field-status">
                        {delivery ? "EN COLA" : "FIJADO"}
                      </span>
                    </li>
                  ))}
                </ol>
                {delivery ? (
                  <>
                    <div className="rtmp-delivery-state" role="status">
                      <strong>Tarea preparada; presentación no realizada.</strong>
                      <span>
                        El puesto local deberá abrir la sede, completar los pasos,
                        entregar cada archivo y detenerse en la firma final.
                      </span>
                    </div>
                    <button
                      type="button"
                      className="rtmp-button rtmp-button-primary"
                      disabled
                    >
                      Abrir para revisar y firmar · puesto local pendiente
                    </button>
                  </>
                ) : deliveryPrepareAllowed ? (
                  <button
                    type="button"
                    className="rtmp-button rtmp-button-primary"
                    onClick={() => void prepareSelectedDelivery()}
                    disabled={Boolean(busyCommand) || !portalPreparationReady}
                  >
                    {busyCommand === "prepare-delivery"
                      ? "Añadiendo a la cola…"
                      : "Dejar preparado para firma"}
                  </button>
                ) : (
                  <p className="rtmp-alert" role="note">
                    Esta cuenta no tiene permiso para preparar tareas de firma.
                  </p>
                )}
                <p className="rtmp-alert rtmp-alert-error" role="alert">
                  El puente gestionado continúa cerrado en este staging. La cola
                  puede registrarse, pero cada entrega individual requerirá un
                  ticket de un solo uso. No se han entregado bytes. No intentes
                  resolverlo guardando el certificado en Render.
                </p>
              </section>
              {receiptCaptureAvailable ? <PortalReceiptCapturePanel /> : null}
            </>
          ) : null}

          {deliveryChannel === "email" && frozenPackage ? (
            <section className="rtmp-card rtmp-extension-card" aria-labelledby="rtmp-extension-title">
              <p className="rtmp-eyebrow">Paso 5 · Borrador y control</p>
              <h2 id="rtmp-extension-title">RTM Correspondencia</h2>
              <p>
                Revisa el remitente, el destinatario, la plantilla aprobada y el
                texto exacto. Los adjuntos salen directamente de la custodia RTM.
              </p>
              <div className="rtmp-correspondence-composer">
                  <dl className="rtmp-correspondence-routing">
                    <div>
                      <dt>Empresa</dt>
                      <dd>{profile.verified_email?.legal_entity_name}</dd>
                    </div>
                    <div>
                      <dt>Canal oficial</dt>
                      <dd>{profile.verified_email?.channel_label}</dd>
                    </div>
                    <div>
                      <dt>Remitente</dt>
                      <dd>info@recurretumulta.eu</dd>
                    </div>
                    <div>
                      <dt>Destinatario</dt>
                      <dd>
                        {emailRecipientMode === "manual"
                          ? normalizedManualEmail
                          : verifiedRecipient}
                      </dd>
                    </div>
                    <div>
                      <dt>Plantilla aprobada</dt>
                      <dd>
                        {profile.verified_email?.template_code} · versión {" "}
                        {profile.verified_email?.template_version}
                      </dd>
                    </div>
                    <div>
                      <dt>Verificación</dt>
                      <dd>{String(profile.verified_at)}</dd>
                    </div>
                  </dl>
                  <label>
                    Asunto
                    <input
                      type="text"
                      maxLength={240}
                      value={correspondenceSubject}
                      disabled={Boolean(busyCommand) || Boolean(delivery)}
                      onChange={(event) => {
                        setCorrespondenceSubject(event.target.value);
                        setCorrespondenceConfirmations(
                          emptyCorrespondenceConfirmations()
                        );
                        resetPreparedDelivery();
                      }}
                    />
                  </label>
                  <label>
                    Texto definitivo
                    <textarea
                      rows={10}
                      maxLength={12000}
                      value={correspondenceBody}
                      disabled={Boolean(busyCommand) || Boolean(delivery)}
                      onChange={(event) => {
                        setCorrespondenceBody(event.target.value);
                        setCorrespondenceConfirmations(
                          emptyCorrespondenceConfirmations()
                        );
                        resetPreparedDelivery();
                      }}
                    />
                  </label>
              </div>
              <ol className="rtmp-delivery-list">
                {frozenPackage.items.map((item) => (
                  <li key={item.item_id}>
                    <span className="rtmp-delivery-order">{item.item_order}</span>
                    <span>
                      <strong>{FIELD_LABELS[item.field_code] || item.field_code}</strong>
                      <small>{item.portal_filename}</small>
                    </span>
                    <span className="rtmp-field-status">
                      {delivery ? "AUDITADO" : "ADJUNTO"}
                    </span>
                  </li>
                ))}
              </ol>
              {!delivery ? (
                <fieldset className="rtmp-correspondence-confirmations">
                  <legend>Confirmación obligatoria antes de preparar</legend>
                  {CORRESPONDENCE_CONFIRMATION_KEYS.map((key) => (
                    <label key={key} className="rtmp-check-line">
                      <input
                        type="checkbox"
                        checked={correspondenceConfirmations[key] === true}
                        disabled={Boolean(busyCommand)}
                        onChange={(event) => {
                          setCorrespondenceConfirmations((current) => ({
                            ...current,
                            [key]: event.target.checked,
                          }));
                          resetPreparedDelivery();
                        }}
                      />
                      <span>{CORRESPONDENCE_CONFIRMATION_LABELS[key]}</span>
                    </label>
                  ))}
                </fieldset>
              ) : null}
              {delivery ? (
                <>
                  <div className="rtmp-delivery-state" role="status">
                    <strong>Borrador y evidencia guardados; sin envío externo.</strong>
                    <span>Destinatario: {delivery.destination.recipient}</span>
                    <span>
                      SMTP no iniciado: no existe Message-ID, respuesta del
                      servidor ni prueba de recepción.
                    </span>
                  </div>
                  <button
                    type="button"
                    className="rtmp-button rtmp-button-primary"
                    disabled
                  >
                    Revisar y enviar · bloqueado en staging
                  </button>
                </>
              ) : deliveryPrepareAllowed ? (
                <div className="rtmp-button-row">
                  <button
                    type="button"
                    className="rtmp-button rtmp-button-primary"
                    onClick={() => void prepareSelectedDelivery()}
                    disabled={Boolean(busyCommand) || !correspondenceDraftReady}
                  >
                    {busyCommand === "prepare-delivery"
                      ? "Guardando orden…"
                      : "Guardar borrador auditado"}
                  </button>
                  <button
                    type="button"
                    className="rtmp-button rtmp-button-secondary"
                    disabled
                  >
                    Revisar y enviar · staging
                  </button>
                </div>
              ) : (
                <p className="rtmp-alert" role="note">
                  Esta cuenta todavía no tiene el permiso específico para preparar
                  entregas. Un supervisor debe actualizar su rol de operador.
                </p>
              )}
              <p className="rtmp-alert" role="note">
                La aceptación de un mensaje por SMTP no acreditaría por sí sola
                la recepción. Cuando la materia exija prueba reforzada, el Centro
                de destinos debe recomendar correo certificado, burofax u otro
                canal adecuado.
              </p>
            </section>
          ) : null}

          <PresenterStatusTimeline
            channel={deliveryChannel}
            destinationReady={Boolean(profile)}
            attachmentsFixed={Boolean(frozenPackage)}
            draftPrepared={Boolean(delivery)}
          />

          <ExceptionalExportPanel allowed={exceptionalExportAllowed} />
        </>
      ) : null}
    </section>
  );
}
