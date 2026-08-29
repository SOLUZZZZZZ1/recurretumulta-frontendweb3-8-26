import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createRtmPresenterClient,
  RTM_PRESENTER_EXTERNAL_DOCUMENT_ACCEPT,
  RTM_PRESENTER_EXTERNAL_DOCUMENT_PURPOSES,
  RtmPresenterApiError,
  validateRtmPresenterExternalFile,
} from "./rtmPresenterApi.js";
import {
  buildRtmPresenterFreezePayload,
  evaluateRtmPresenterBoundary,
  evaluateRtmPresenterReadiness,
  hasExceptionalExportCapability,
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
  if (
    String(payload?.case_id || "") !== String(exactCaseId || "") ||
    payload?.synthetic_only !== true ||
    payload?.storage_references_exposed !== false ||
    payload?.unverified_destination_allowed !== false ||
    payload?.operator_supplied_url_allowed !== false ||
    Number(payload?.result_count) !== destinations.length
  ) {
    throw new Error("La búsqueda de sedes no respeta la frontera verificada.");
  }
  assertSafeDestinationProjection(destinations);
  return Object.freeze(destinations);
}

function packageFromResponse(
  payload,
  { caseId, requestPayload }
) {
  const value = payload?.package;
  if (!value || typeof value !== "object" || !value.package_id) {
    throw new Error("El backend no devolvió el paquete congelado esperado.");
  }
  if (Object.keys(value).some((key) => !ALLOWED_PACKAGE_KEYS.has(key))) {
    throw new Error("El paquete intentó exponer datos fuera del contrato seguro.");
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
        Object.keys(item).some((key) => !ALLOWED_PACKAGE_ITEM_KEYS.has(key))
    )
  ) {
    throw new Error("Los items del paquete no respetan la proyección segura.");
  }
  if (value.download_available !== false || value.zip_available !== false) {
    throw new Error("El paquete no respeta la política de no extracción.");
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
    throw new Error("La respuesta congelada no coincide con la solicitud activa.");
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
    throw new Error("El backend congeló una selección distinta de la solicitada.");
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
  if (
    String(value.case_id || "") !== String(caseId || "") ||
    String(value.package_id || "") !== String(frozenPackage?.package_id || "") ||
    String(value.package_manifest_sha256 || "") !==
      String(frozenPackage?.manifest_sha256 || "") ||
    value.channel !== channel ||
    value.state !== "prepared" ||
    !destinationMatches ||
    !correspondenceMatches ||
    value.external_effects_allowed !== false ||
    value.authoritative_submission !== false ||
    value.local_files_created !== false ||
    value.operator_download_available !== false ||
    value.automatic_retry_allowed !== false ||
    value.human_final_submit_required !== true ||
    value.receipt_required !== true ||
    JSON.stringify(exactItems) !== JSON.stringify(expectedItems)
  ) {
    throw new Error("La orden no coincide exactamente con el paquete preparado.");
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

export default function RtmPresenterWorkspace({
  caseId,
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
  const [deliveryChannel, setDeliveryChannel] = useState("");
  const [profileId, setProfileId] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [destinationOptions, setDestinationOptions] = useState([]);
  const [searchingDestinations, setSearchingDestinations] = useState(false);
  const [representationMode, setRepresentationMode] = useState("self");
  const [emailRecipientMode, setEmailRecipientMode] = useState("verified");
  const [manualEmail, setManualEmail] = useState("");
  const [manualEmailConfirmed, setManualEmailConfirmed] = useState(false);
  const [correspondenceSubject, setCorrespondenceSubject] = useState("");
  const [correspondenceBody, setCorrespondenceBody] = useState("");
  const [correspondenceConfirmations, setCorrespondenceConfirmations] = useState(
    emptyCorrespondenceConfirmations
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
      setSelections({});
      setAuthorizationVersionId("");
      setEmailRecipientMode("verified");
      setManualEmail("");
      setManualEmailConfirmed(false);
      setCorrespondenceSubject("");
      setCorrespondenceBody("");
      setCorrespondenceConfirmations(emptyCorrespondenceConfirmations());
      setFrozenPackage(null);
      setDelivery(null);
      setSupersedesPackageId(null);
      setExternalPanelOpen(false);
      setExternalMode("new");
      setExternalPurpose("");
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
        const payload = await client.loadWorkspace(caseId, { signal });
        applyWorkspace(payload);
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
  }, [caseId]);

  useEffect(() => {
    if (!externalPanelOpen) return undefined;
    const frame = globalThis.requestAnimationFrame?.(() => {
      globalThis.document
        ?.getElementById("rtmp-external-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const containerDocuments = useMemo(
    () => latestPresenterDocumentVersions(workspace?.documents || []),
    [workspace]
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

  const externalPurposeOptions = useMemo(() => {
    const purposes = new Set();
    for (const destination of workspace?.destinations || []) {
      for (const field of destination?.fields || []) {
        for (const purpose of field?.purposes || []) {
          const normalized = String(purpose || "").trim().toLowerCase();
          if (EXTERNAL_DOCUMENT_PURPOSES.has(normalized)) {
            purposes.add(normalized);
          }
        }
      }
    }
    for (const documentVersion of workspace?.documents || []) {
      const normalized = String(documentVersion?.purpose || "")
        .trim()
        .toLowerCase();
      if (EXTERNAL_DOCUMENT_PURPOSES.has(normalized)) {
        purposes.add(normalized);
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
  const outputReady =
    Boolean(deliveryChannel) && readiness.ready && emailDestinationReady;
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
    resetPreparedDelivery();
  }

  function selectDeliveryChannel(channel) {
    if (!new Set(["portal", "email"]).has(channel) || editingLocked) return;
    setDeliveryChannel(channel);
    setProfileId("");
    setSelections({});
    setAuthorizationVersionId("");
    setEmailRecipientMode("verified");
    setManualEmail("");
    setManualEmailConfirmed(false);
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
    setMessage("");
    try {
      const result = await client.searchDestinations(caseId, destinationQuery, {
        limit: 20,
      });
      const matches = destinationsFromSearchResponse(result, caseId);
      const selected = profile;
      const emailFallbacks =
        deliveryChannel === "email"
          ? workspace.destinations.filter((item) =>
              item.delivery_channels?.includes("email")
            )
          : [];
      const nextOptions = Object.freeze(
        [selected, ...matches, ...emailFallbacks]
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
      if (matches.length === 0) {
        setMessage(
          deliveryChannel === "email"
            ? "RTM no ha encontrado todavía esa empresa en el Centro de destinos. Puedes elegir el perfil sintético de correspondencia e introducir una dirección manual; quedará pendiente de verificación independiente."
            : "No existe todavía una sede verificada con ese nombre. Debe solicitarse su alta y doble verificación antes de presentar."
        );
      }
    } catch (error) {
      setMessage(publicError(error));
    } finally {
      setSearchingDestinations(false);
    }
  }

  function clearExternalFileInput() {
    if (externalFileInputRef.current) {
      externalFileInputRef.current.value = "";
    }
    setExternalFileMetadata(null);
    setSyntheticConfirmed(false);
  }

  function openExternalPanel(purpose = "") {
    setExternalMode("new");
    setExternalSupersedesId("");
    setExternalPurpose(
      externalPurposeOptions.includes(String(purpose || "").toLowerCase())
        ? String(purpose).toLowerCase()
        : ""
    );
    clearExternalFileInput();
    setExternalPanelOpen(true);
    setMessage("");
  }

  function closeExternalPanel() {
    if (busyCommand === "upload-external") return;
    setExternalPanelOpen(false);
    setExternalMode("new");
    setExternalPurpose("");
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
    try {
      metadata = validateRtmPresenterExternalFile(file);
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
      applyWorkspace(refreshed);
      setExternalMode("new");
      setExternalPurpose("");
      setExternalSupersedesId("");
      setExternalPanelOpen(false);
      setMessage(
        `${metadata.filename} queda custodiado en RTM y pendiente de análisis. En este corte el scanner y la activación aún no están conectados, por lo que todavía no será seleccionable.`
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
        "Paquete preparado. No se han emitido tickets ni se ha enviado contenido fuera de RTM."
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
      !frozenPackage ||
      !deliveryPrepareAllowed ||
      !new Set(["portal", "email"]).has(deliveryChannel) ||
      !emailDestinationReady ||
      !correspondenceDraftReady ||
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
        })
      );
      pendingDeliveryRef.current = null;
      setMessage(
        deliveryChannel === "email"
          ? emailRecipientMode === "manual"
            ? "Borrador de RTM Correspondencia guardado y pendiente de verificar el destinatario. No se ha enviado nada."
            : "Borrador de RTM Correspondencia auditado con destinatario verificado. El envío real continúa bloqueado en staging."
          : "Orden de presentación preparada y auditada. Todavía no se ha cargado ni enviado ningún documento fuera de RTM."
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
        campo de la sede. No descarga ni crea copias locales del operador.
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
                  {containerDocuments.length} EN RTM
                </span>
              </div>
            </div>
            <ul className="rtmp-container-list">
              {containerDocuments.map((documentVersion) => {
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
                  Busca DGT, ayuntamiento u organismo y completa sus casillas
                  en el orden exacto que exige.
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
            <ol>
              <li className="is-complete">
                <span className="rtmp-progress-number">1</span>
                <span>
                  <strong>Contenedor</strong>
                  <small>{containerDocuments.length} documentos</small>
                </span>
              </li>
              <li
                className={profile ? "is-complete" : deliveryChannel ? "is-current" : ""}
              >
                <span className="rtmp-progress-number">2</span>
                <span>
                  <strong>Canal y destino</strong>
                  <small>{profile ? "Completo" : "Pendiente"}</small>
                </span>
              </li>
              <li
                className={
                  outputReady
                    ? "is-complete"
                    : profile
                      ? "is-current"
                      : ""
                }
              >
                <span className="rtmp-progress-number">3</span>
                <span>
                  <strong>Elegir documentos</strong>
                  <small>{outputReady ? "Completo" : "Pendiente"}</small>
                </span>
              </li>
              <li
                className={
                  frozenPackage
                    ? "is-complete"
                    : outputReady
                      ? "is-current"
                      : ""
                }
              >
                <span className="rtmp-progress-number">4</span>
                <span>
                  <strong>Fijar selección</strong>
                  <small>{frozenPackage ? "Completo" : "Pendiente"}</small>
                </span>
              </li>
              <li
                className={
                  delivery
                    ? "is-complete"
                    : frozenPackage
                      ? "is-current"
                      : ""
                }
              >
                <span className="rtmp-progress-number">5</span>
                <span>
                  <strong>
                    {deliveryChannel === "email" ? "Correspondencia" : "Ejecutar"}
                  </strong>
                  <small>{delivery ? "Preparado en OPS" : "Pendiente"}</small>
                </span>
              </li>
            </ol>
          </nav>

          {deliveryChannel ? (
          <section className="rtmp-card" aria-labelledby="rtmp-destination-title">
            <div className="rtmp-section-heading">
              <div>
                <p className="rtmp-eyebrow">Paso 2 · Canal y destino</p>
                <h2 id="rtmp-destination-title">
                  {deliveryChannel === "email"
                    ? "¿A qué empresa u organismo escribes?"
                    : "¿En qué sede vas a presentarlo?"}
                </h2>
                <p>
                  {deliveryChannel === "email"
                    ? "Busca, por ejemplo, Endesa o una dirección registrada. Después elegirás los adjuntos desde el contenedor."
                    : "Elige la sede administrativa y cómo actúas. RTM mostrará sus casillas en el orden exacto que solicita."}
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
                  : "Buscar sede por organismo o municipio"}
                <input
                  type="search"
                  value={destinationQuery}
                  minLength={2}
                  maxLength={100}
                  placeholder={
                    deliveryChannel === "email"
                      ? "Ej. Endesa, atención al cliente, reclamaciones…"
                      : "Ej. Ayuntamiento de Madrid, DGT, Albacete…"
                  }
                  disabled={profileLocked || searchingDestinations}
                  onChange={(event) => setDestinationQuery(event.target.value)}
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
                ? "OPS busca primero en el directorio verificado. Si no está, puedes escribir un correo manual y solicitar su confirmación."
                : "OPS busca en su registro interno. El operador no puede pegar una URL ni sustituir el perfil verificado de la sede."}
            </p>
            <label className="rtmp-single-field">
              {deliveryChannel === "email"
                ? "Empresa u organismo"
                : "Sede administrativa"}
              <select
                value={profileId}
                onChange={(event) => {
                  setProfileId(event.target.value);
                  setSelections({});
                  setAuthorizationVersionId("");
                  setEmailRecipientMode("verified");
                  setManualEmail("");
                  setManualEmailConfirmed(false);
                  resetFrozenState();
                }}
                disabled={profileLocked}
              >
                <option value="">
                  {deliveryChannel === "email"
                    ? "Selecciona una empresa u organismo"
                    : "Selecciona una sede"}
                </option>
                {destinationOptions.map((item) => (
                  <option
                    key={item.destination_profile_id}
                    value={item.destination_profile_id}
                    disabled={!item.delivery_channels?.includes(deliveryChannel)}
                  >
                    {item.display_name}
                    {!item.delivery_channels?.includes(deliveryChannel)
                      ? ` · ${item.verified_email?.channel_status || "canal no disponible"}`
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
                      {profile.verified_email?.channel_status}
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

          {(deliveryChannel && profile) || externalPanelOpen ? (
          <section className="rtmp-card" aria-labelledby="rtmp-checklist-title">
            {deliveryChannel && profile ? (
            <div className="rtmp-section-heading">
              <div>
                <p className="rtmp-eyebrow">Paso 3 · Elegir documentos</p>
                <h2 id="rtmp-checklist-title">
                  {deliveryChannel === "email"
                    ? "Documentos que acompañarán al correo"
                    : "Documentación solicitada por la sede"}
                </h2>
                <p>
                  {deliveryChannel === "email"
                    ? "Selecciona desde el contenedor lo que acredita el problema o reclamación."
                    : "Las casillas aparecen en el mismo orden que la sede. En cada una eliges el fichero correspondiente del contenedor."}
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
                    disabled={
                      externalIngestLocked && !externalPanelOpen
                    }
                    aria-expanded={externalPanelOpen}
                    aria-controls="rtmp-external-panel"
                  >
                    {externalPanelOpen
                      ? "Cerrar"
                      : "+ Añadir documento al expediente"}
                  </button>
                ) : null}
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
              <section
                id="rtmp-external-panel"
                className="rtmp-ingest-panel"
                aria-labelledby="rtmp-external-title"
              >
                <div className="rtmp-section-heading rtmp-ingest-heading">
                  <div>
                    <p className="rtmp-eyebrow">Documento externo</p>
                    <h3 id="rtmp-external-title">
                      Añadir documento al expediente
                    </h3>
                    <p>
                      RTM lo custodiará directamente. En este staging quedará
                      pendiente de análisis y todavía no podrá seleccionarse.
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
                      <strong>{externalFileMetadata.filename}</strong>
                      <span>
                        {externalFileMetadata.mediaType} ·{" "}
                        {formatBytes(externalFileMetadata.size)}
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
            ) : null}

            {deliveryChannel && profile ? (
            <>
            <ol className="rtmp-requirements">
              {fields.map((field, index) => {
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
                            openExternalPanel(preferredExternalPurpose(field))
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
                <p className="rtmp-eyebrow">Paso 4 · Revisar selección</p>
                <h2 id="rtmp-freeze-title">
                  {deliveryChannel === "email"
                    ? "Fijar los adjuntos de Correspondencia"
                    : "Revisar y preparar"}
                </h2>
                <p>
                  {frozenPackage
                    ? "La selección ha quedado fijada sin sacar documentos de RTM."
                    : outputReadinessMessage}
                </p>
              </div>
              {frozenPackage ? (
                <span className="rtmp-chip rtmp-chip-ok">PAQUETE PREPARADO</span>
              ) : null}
            </div>
            {frozenPackage ? (
              <>
                <div className="rtmp-ready-summary" role="status">
                  <strong>
                    {deliveryChannel === "email"
                      ? "Adjuntos fijados para redactar la correspondencia."
                      : "Todo preparado para trabajar en la sede."}
                  </strong>
                  <span>
                    {frozenPackage.items.length}{" "}
                    {frozenPackage.items.length === 1
                      ? "documento relacionado"
                      : "documentos relacionados"}
                  </span>
                </div>
                <details className="rtmp-technical-details">
                  <summary>Ver identificadores y huellas del paquete</summary>
                  <dl className="rtmp-package-meta">
                    <div>
                      <dt>Paquete</dt>
                      <dd className="rtmp-mono">{frozenPackage.package_id}</dd>
                    </div>
                    <div>
                      <dt>Versión lógica</dt>
                      <dd>{frozenPackage.package_version}</dd>
                    </div>
                    <div>
                      <dt>Huella del manifiesto</dt>
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
                  ? "Preparando…"
                  : deliveryChannel === "email"
                    ? "Fijar adjuntos para Correspondencia"
                    : "Preparar paquete para presentar"}
              </button>
            )}
          </section>
          ) : null}

          {frozenPackage ? (
            <section className="rtmp-card rtmp-extension-card" aria-labelledby="rtmp-extension-title">
              <p className="rtmp-eyebrow">
                {deliveryChannel === "email"
                  ? "Paso 5 · Borrador y control"
                  : "Paso 5 · Presentación humana"}
              </p>
              <h2 id="rtmp-extension-title">
                {deliveryChannel === "email"
                  ? "RTM Correspondencia"
                  : "Presentar desde RTM"}
              </h2>
              <p>
                {deliveryChannel === "email"
                  ? "Revisa el remitente, el destinatario, la plantilla aprobada y el texto exacto. Los adjuntos salen directamente de la custodia RTM."
                  : "RTM seguirá el orden propio de la sede y relacionará cada campo con la versión exacta del contenedor. No se crea una carpeta local ni se ofrece descarga al operador."}
              </p>
              {deliveryChannel === "email" ? (
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
              ) : null}
              <ol className="rtmp-delivery-list">
                {frozenPackage.items.map((item) => (
                  <li key={item.item_id}>
                    <span className="rtmp-delivery-order">{item.item_order}</span>
                    <span>
                      <strong>{FIELD_LABELS[item.field_code] || item.field_code}</strong>
                      <small>{item.portal_filename}</small>
                    </span>
                    <span className="rtmp-field-status">
                      {delivery
                        ? "AUDITADO"
                        : deliveryChannel === "email"
                          ? "ADJUNTO"
                          : "EN PAQUETE"}
                    </span>
                  </li>
                ))}
              </ol>
              {deliveryChannel === "email" && !delivery ? (
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
                    <strong>
                      {deliveryChannel === "email"
                        ? "Borrador y evidencia guardados; sin envío externo."
                        : "Orden auditada; sin efecto externo."}
                    </strong>
                    <span>
                      {deliveryChannel === "email"
                        ? `Destinatario: ${delivery.destination.recipient}`
                        : `Destino verificado: ${delivery.destination.portal_origin}`}
                    </span>
                    <span>
                      {deliveryChannel === "email"
                        ? "SMTP no iniciado: no existe Message-ID, respuesta del servidor ni prueba de recepción."
                        : "El puente gestionado continúa cerrado hasta disponer de atestación criptográfica; cuando se active, cada documento exigirá un ticket de un solo uso. No se han entregado bytes."}
                    </span>
                  </div>
                  {deliveryChannel === "email" ? (
                    <button
                      type="button"
                      className="rtmp-button rtmp-button-primary"
                      disabled
                    >
                      Revisar y enviar · bloqueado en staging
                    </button>
                  ) : null}
                </>
              ) : deliveryPrepareAllowed ? (
                <div className="rtmp-button-row">
                  <button
                    type="button"
                    className="rtmp-button rtmp-button-primary"
                    onClick={() => void prepareSelectedDelivery()}
                    disabled={
                      Boolean(busyCommand) ||
                      (deliveryChannel === "email" && !correspondenceDraftReady)
                    }
                  >
                    {busyCommand === "prepare-delivery"
                      ? "Guardando orden…"
                      : deliveryChannel === "email"
                        ? "Guardar borrador auditado"
                        : "Preparar carga ordenada en la sede"}
                  </button>
                  {deliveryChannel === "email" ? (
                    <button
                      type="button"
                      className="rtmp-button rtmp-button-secondary"
                      disabled
                    >
                      Revisar y enviar · staging
                    </button>
                  ) : null}
                </div>
              ) : (
                <p className="rtmp-alert" role="note">
                  Esta cuenta todavía no tiene el permiso específico para preparar
                  entregas. Un supervisor debe actualizar su rol de operador.
                </p>
              )}
              <p className="rtmp-alert" role="note">
                {deliveryChannel === "email"
                  ? "La aceptación de un mensaje por SMTP no acreditaría por sí sola la recepción. Cuando la materia exija prueba reforzada, el Centro de destinos debe recomendar correo certificado, burofax u otro canal adecuado."
                  : "Cargar un adjunto puede comunicarlo ya a la sede. RTM nunca pulsa “Enviar”, firma, resuelve CAPTCHA ni completa Cl@ve: la confirmación final y la revisión del justificante siguen siendo humanas."}
              </p>
            </section>
          ) : null}

          <ExceptionalExportPanel allowed={exceptionalExportAllowed} />
        </>
      ) : null}
    </section>
  );
}
