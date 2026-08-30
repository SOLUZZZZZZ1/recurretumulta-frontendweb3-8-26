import { evaluateRtmPresenterBoundary } from "./rtmPresenterModel.js";

export const RTM_PRESENTER_API_VERSION = "rtm.presenter.api.client.v5";
export const RTM_PRESENTER_API_PREFIX = "/api/ops/presenter";

const MAX_JSON_CHARACTERS = 1_000_000;
export const RTM_PRESENTER_MAX_EXTERNAL_DOCUMENT_BYTES = 25 * 1024 * 1024;
export const RTM_PRESENTER_EXTERNAL_DOCUMENT_MEDIA_TYPES = Object.freeze([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
]);
export const RTM_PRESENTER_EXTERNAL_DOCUMENT_PURPOSES = Object.freeze([
  "main_filing",
  "prejudicial_authorization",
  "representation_authorization",
  "submission_receipt",
  "supporting_evidence",
]);
export const RTM_PRESENTER_EXTERNAL_DOCUMENT_ACCEPT =
  ".pdf,.docx,.jpg,.jpeg,.png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png";

const EXTERNAL_DOCUMENT_EXTENSIONS = Object.freeze({
  "application/pdf": Object.freeze([".pdf"]),
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    Object.freeze([".docx"]),
  "image/jpeg": Object.freeze([".jpg", ".jpeg"]),
  "image/png": Object.freeze([".png"]),
});
const CORRESPONDENCE_CONFIRMATION_KEYS = Object.freeze([
  "destination_reviewed",
  "interested_confirmed",
  "representation_confirmed",
  "text_confirmed",
  "attachments_confirmed",
  "data_minimization_confirmed",
]);
const PORTAL_PREPARATION_CONFIRMATION_KEYS = Object.freeze([
  "destination_reviewed",
  "interested_confirmed",
  "representation_confirmed",
  "text_confirmed",
  "attachments_confirmed",
]);

export class RtmPresenterApiError extends Error {
  constructor(code, message, status = null) {
    super(message);
    this.name = "RtmPresenterApiError";
    this.code = code;
    this.status = status;
  }
}

function fail(code, message, status = null) {
  throw new RtmPresenterApiError(code, message, status);
}

function safeSegment(value, field) {
  const text = String(value || "").trim();
  if (!text || text.length > 180 || /[/?#\\]/.test(text)) {
    fail("presenter.invalid_identifier", `${field} no es válido.`);
  }
  return encodeURIComponent(text);
}

function safePurpose(value) {
  const purpose = String(value || "").trim().toLowerCase();
  if (!RTM_PRESENTER_EXTERNAL_DOCUMENT_PURPOSES.includes(purpose)) {
    fail("presenter.external_purpose_invalid", "La finalidad documental no es válida.");
  }
  return purpose;
}

function normalizeCorrespondenceDraft(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(
      "presenter.correspondence_draft_required",
      "RTM Correspondencia exige un borrador revisado."
    );
  }
  const subject = String(value.subject || "").trim().replace(/\s+/g, " ");
  const body = String(value.body || "")
    .replace(/\r\n?/g, "\n")
    .trim();
  const confirmations = value.confirmations;
  if (
    !subject ||
    subject.length > 240 ||
    /[\u0000-\u001f\u007f]/.test(subject) ||
    !body ||
    body.length > 12000 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(body) ||
    !confirmations ||
    typeof confirmations !== "object" ||
    Array.isArray(confirmations) ||
    Object.keys(confirmations).length !==
      CORRESPONDENCE_CONFIRMATION_KEYS.length ||
    CORRESPONDENCE_CONFIRMATION_KEYS.some(
      (key) => confirmations[key] !== true
    )
  ) {
    fail(
      "presenter.correspondence_confirmation_required",
      "Revisa destinatario, interesado, representación, texto y adjuntos."
    );
  }
  return {
    subject,
    body,
    confirmations: Object.fromEntries(
      CORRESPONDENCE_CONFIRMATION_KEYS.map((key) => [key, true])
    ),
  };
}

function normalizePortalPreparation(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(
      "presenter.portal_preparation_required",
      "Completa la hoja del trámite antes de dejarlo para firma."
    );
  }
  const formCode = String(value.formCode || "").trim().toLowerCase();
  const rawValues = value.values;
  const confirmations = value.confirmations;
  if (
    !/^[a-z][a-z0-9_.-]{1,127}$/.test(formCode) ||
    !rawValues ||
    typeof rawValues !== "object" ||
    Array.isArray(rawValues) ||
    Object.keys(rawValues).length < 1 ||
    Object.keys(rawValues).length > 32 ||
    Object.entries(rawValues).some(
      ([key, text]) =>
        !/^[a-z][a-z0-9_.-]{1,127}$/.test(key) ||
        typeof text !== "string" ||
        text.length > 12000 ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)
    ) ||
    !confirmations ||
    typeof confirmations !== "object" ||
    Array.isArray(confirmations) ||
    Object.keys(confirmations).length !==
      PORTAL_PREPARATION_CONFIRMATION_KEYS.length ||
    PORTAL_PREPARATION_CONFIRMATION_KEYS.some(
      (key) => confirmations[key] !== true
    )
  ) {
    fail(
      "presenter.portal_preparation_confirmation_required",
      "Revisa destino, interesado, representación, texto y adjuntos."
    );
  }
  return {
    form_code: formCode,
    values: Object.fromEntries(
      Object.entries(rawValues).map(([key, text]) => [
        key,
        text.replace(/\r\n?/g, "\n").trim(),
      ])
    ),
    confirmations: Object.fromEntries(
      PORTAL_PREPARATION_CONFIRMATION_KEYS.map((key) => [key, true])
    ),
  };
}

export function validateRtmPresenterExternalFile(file) {
  if (
    !file ||
    typeof file.name !== "string" ||
    typeof file.size !== "number" ||
    typeof file.type !== "string" ||
    typeof file.slice !== "function"
  ) {
    fail("presenter.external_file_required", "Selecciona un archivo válido.");
  }
  const filename = file.name.trim();
  const size = Number(file.size);
  const mediaType = file.type.trim().toLowerCase();
  if (
    !filename ||
    filename.length > 180 ||
    /[\\/\u0000-\u001f\u007f]/.test(filename)
  ) {
    fail("presenter.external_filename_invalid", "El nombre del archivo no es válido.");
  }
  if (
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > RTM_PRESENTER_MAX_EXTERNAL_DOCUMENT_BYTES
  ) {
    fail(
      "presenter.external_file_size_invalid",
      "El archivo debe ocupar entre 1 byte y 25 MiB."
    );
  }
  const allowedExtensions = EXTERNAL_DOCUMENT_EXTENSIONS[mediaType];
  const lowerFilename = filename.toLowerCase();
  if (
    !RTM_PRESENTER_EXTERNAL_DOCUMENT_MEDIA_TYPES.includes(mediaType) ||
    !allowedExtensions?.some((extension) => lowerFilename.endsWith(extension))
  ) {
    fail(
      "presenter.external_file_type_invalid",
      "Solo se admiten PDF, DOCX, JPEG y PNG con extensión y tipo coincidentes."
    );
  }
  return Object.freeze({ filename, mediaType, size });
}

export function validateRtmPresenterAttachmentFilename(value, mediaType) {
  const filename = String(value || "").trim();
  const exactMediaType = String(mediaType || "").trim().toLowerCase();
  const allowedExtensions = EXTERNAL_DOCUMENT_EXTENSIONS[exactMediaType];
  if (
    !filename ||
    filename.length > 180 ||
    /[\\/\u0000-\u001f\u007f]/.test(filename) ||
    !allowedExtensions?.some((extension) =>
      filename.toLowerCase().endsWith(extension)
    )
  ) {
    fail(
      "presenter.external_attachment_filename_invalid",
      "El nombre para adjuntar debe ser seguro y conservar la extensión del archivo."
    );
  }
  return filename;
}

export function validateRtmPresenterDestinationProposal(label, portalUrl) {
  const cleanLabel = String(label || "").trim().replace(/\s+/g, " ");
  const cleanUrl = String(portalUrl || "").trim();
  if (cleanLabel.length < 3 || cleanLabel.length > 120) {
    fail(
      "presenter.destination_proposal_label_invalid",
      "Escribe un nombre de sede de entre 3 y 120 caracteres."
    );
  }
  if (
    cleanUrl.length < 9 ||
    cleanUrl.length > 1024 ||
    /[\u0000-\u001f\u007f]/.test(cleanUrl)
  ) {
    fail(
      "presenter.destination_proposal_url_invalid",
      "El enlace de sede no es válido."
    );
  }
  let url;
  try {
    url = new URL(cleanUrl);
  } catch {
    fail(
      "presenter.destination_proposal_url_invalid",
      "El enlace de sede no es válido."
    );
  }
  const host = url.hostname.toLowerCase();
  const syntheticHost =
    host === "synthetic.example" || host.endsWith(".synthetic.example");
  if (
    url.protocol !== "https:" ||
    !syntheticHost ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    url.search ||
    url.hash
  ) {
    fail(
      "presenter.destination_proposal_url_not_synthetic",
      "Staging solo admite enlaces HTTPS sintéticos sin credenciales, parámetros ni fragmentos."
    );
  }
  const authorityOffset = cleanUrl.indexOf("://") + 3;
  const pathOffset = cleanUrl.indexOf("/", authorityOffset);
  const rawPath = pathOffset >= 0 ? cleanUrl.slice(pathOffset) : "/";
  let decodedSegments;
  try {
    decodedSegments = rawPath
      .split("/")
      .map((segment) => decodeURIComponent(segment).trim().toLowerCase());
  } catch {
    fail(
      "presenter.destination_proposal_url_invalid",
      "El enlace de sede no es válido."
    );
  }
  if (decodedSegments.some((segment) => segment === "." || segment === "..")) {
    fail(
      "presenter.destination_proposal_url_invalid",
      "El enlace de sede no es válido."
    );
  }
  return Object.freeze({
    label: cleanLabel,
    portalUrl: `${url.origin}${url.pathname || "/"}`,
  });
}

function requireFetch(fetchImpl) {
  if (typeof fetchImpl !== "function") {
    fail("presenter.fetch_required", "No hay transporte seguro disponible.");
  }
  return fetchImpl;
}

function requireHeaders(getAuthHeaders) {
  const headers = getAuthHeaders?.() || {};
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
    fail("presenter.auth_headers_invalid", "La sesión de operador no es válida.");
  }
  return { ...headers };
}

function requestOptions(getAuthHeaders, options = {}) {
  const headers = {
    Accept: "application/json",
    ...requireHeaders(getAuthHeaders),
    ...(options.headers || {}),
  };
  if (
    typeof FormData !== "undefined" &&
    options.body instanceof FormData
  ) {
    for (const name of Object.keys(headers)) {
      if (name.toLowerCase() === "content-type") delete headers[name];
    }
  }
  return {
    ...options,
    headers,
    cache: "no-store",
    credentials: "same-origin",
    redirect: "error",
    referrerPolicy: "same-origin",
  };
}

async function readJson(response) {
  const declared = Number(response?.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > MAX_JSON_CHARACTERS) {
    fail("presenter.response_too_large", "La respuesta es demasiado grande.");
  }
  const text = await response.text().catch(() => "");
  if (text.length > MAX_JSON_CHARACTERS) {
    fail("presenter.response_too_large", "La respuesta es demasiado grande.");
  }
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    fail(
      "presenter.response_not_json",
      "El servicio devolvió una respuesta no válida.",
      response.status
    );
  }
  if (!response.ok) {
    const detail =
      payload?.error?.message ||
      payload?.detail?.error?.message ||
      payload?.detail?.message ||
      payload?.detail;
    fail(
      "presenter.request_failed",
      typeof detail === "string" && detail.trim()
        ? detail.slice(0, 320)
        : "No se pudo completar la operación.",
      response.status
    );
  }
  return payload;
}

function commandHeaders({ idempotencyKey = "" } = {}) {
  const headers = {};
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  return headers;
}

export function createRtmPresenterClient({
  fetchImpl = globalThis.fetch?.bind(globalThis),
  getAuthHeaders = () => ({}),
  onUnauthorized = () => {},
  environment = "staging",
  syntheticOnly = true,
} = {}) {
  const transport = requireFetch(fetchImpl);
  const boundary = evaluateRtmPresenterBoundary({
    environment,
    syntheticOnly,
  });
  if (!boundary.allowed) {
    fail(
      "presenter.boundary_blocked",
      "RTM Presenter solo está disponible en STAGING sintético."
    );
  }
  async function transportRequest(path, options = {}) {
    try {
      const response = await transport(
        path,
        requestOptions(getAuthHeaders, options)
      );
      if (response?.status === 401) {
        try {
          onUnauthorized();
        } catch {
          // La invalidación local no puede convertir un 401 en otro tipo de fallo.
        }
      }
      return response;
    } catch {
      if (options.signal?.aborted) {
        fail("presenter.request_aborted", "Operación cancelada.");
      }
      fail("presenter.transport_failed", "No se puede alcanzar RTM Presenter.");
    }
  }

  async function jsonRequest(path, options = {}) {
    return readJson(await transportRequest(path, options));
  }

  return Object.freeze({
    boundary,

    async loadWorkspace(caseId, { signal = null } = {}) {
      const id = safeSegment(caseId, "caseId");
      return jsonRequest(`${RTM_PRESENTER_API_PREFIX}/cases/${id}/workspace`, {
        method: "GET",
        signal,
      });
    },

    async loadSignatureQueue({ signal = null, limit = 50 } = {}) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        fail(
          "presenter.signature_queue_limit_invalid",
          "El límite de la cola de firma no es válido."
        );
      }
      return jsonRequest(
        `${RTM_PRESENTER_API_PREFIX}/signature-queue?limit=${limit}`,
        { method: "GET", signal }
      );
    },

    async searchDestinations(caseId, query, { signal = null, limit = 20 } = {}) {
      const id = safeSegment(caseId, "caseId");
      const cleanQuery = String(query || "").trim().replace(/\s+/g, " ");
      if (cleanQuery.length < 2 || cleanQuery.length > 100) {
        fail(
          "presenter.destination_query_invalid",
          "Escribe al menos dos caracteres para buscar una sede."
        );
      }
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
        fail(
          "presenter.destination_limit_invalid",
          "El límite de búsqueda no es válido."
        );
      }
      return jsonRequest(
        `${RTM_PRESENTER_API_PREFIX}/cases/${id}/destinations/search?q=${encodeURIComponent(cleanQuery)}&limit=${limit}`,
        { method: "GET", signal }
      );
    },

    async proposeDestinationLink(
      caseId,
      { label, portalUrl, signal = null } = {}
    ) {
      const id = safeSegment(caseId, "caseId");
      const proposal = validateRtmPresenterDestinationProposal(label, portalUrl);
      return jsonRequest(
        `${RTM_PRESENTER_API_PREFIX}/cases/${id}/destinations/proposals`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: proposal.label,
            portal_url: proposal.portalUrl,
          }),
          signal,
        }
      );
    },

    async freezePackage(
      caseId,
      payload,
      { signal = null, idempotencyKey = "" } = {}
    ) {
      const id = safeSegment(caseId, "caseId");
      return jsonRequest(
        `${RTM_PRESENTER_API_PREFIX}/cases/${id}/packages/freeze`,
        {
          method: "POST",
          headers: {
            ...commandHeaders({ idempotencyKey }),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal,
        }
      );
    },

    async prepareDelivery(
      caseId,
      packageId,
      {
        channel = "portal",
        recipientEmail = "",
        recipientConfirmed = false,
        correspondenceDraft = null,
        portalPreparation = null,
        signal = null,
        idempotencyKey = "",
      } = {}
    ) {
      const id = safeSegment(caseId, "caseId");
      const exactPackageId = safeSegment(packageId, "packageId");
      if (!new Set(["portal", "email"]).has(channel)) {
        fail(
          "presenter.delivery_channel_invalid",
          "El canal de presentación no es válido."
        );
      }
      const normalizedRecipient = String(recipientEmail || "").trim().toLowerCase();
      if (channel === "portal" && normalizedRecipient) {
        fail(
          "presenter.delivery_email_not_allowed_for_portal",
          "Una presentación en sede no admite destinatario de correo."
        );
      }
      if (channel === "portal" && correspondenceDraft !== null) {
        fail(
          "presenter.delivery_email_not_allowed_for_portal",
          "Una presentación en sede no admite datos de correspondencia."
        );
      }
      if (channel === "email" && portalPreparation !== null) {
        fail(
          "presenter.portal_preparation_not_allowed_for_email",
          "RTM Correspondencia no admite una hoja de sede."
        );
      }
      const correspondence =
        channel === "email"
          ? normalizeCorrespondenceDraft(correspondenceDraft)
          : null;
      const portalPreparationPayload =
        channel === "portal"
          ? normalizePortalPreparation(portalPreparation)
          : null;
      return jsonRequest(
        `${RTM_PRESENTER_API_PREFIX}/cases/${id}/packages/${exactPackageId}/deliveries/prepare`,
        {
          method: "POST",
          headers: {
            ...commandHeaders({ idempotencyKey }),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channel,
            recipient_email: normalizedRecipient || null,
            recipient_confirmed:
              channel === "email" && normalizedRecipient
                ? recipientConfirmed === true
                : false,
            correspondence,
            portal_preparation: portalPreparationPayload,
          }),
          signal,
        }
      );
    },

    async loadDeliveryStatus(
      caseId,
      packageId,
      deliveryId,
      { signal = null } = {}
    ) {
      const id = safeSegment(caseId, "caseId");
      const exactPackageId = safeSegment(packageId, "packageId");
      const exactDeliveryId = safeSegment(deliveryId, "deliveryId");
      return jsonRequest(
        `${RTM_PRESENTER_API_PREFIX}/cases/${id}/packages/${exactPackageId}/deliveries/${exactDeliveryId}`,
        { method: "GET", signal }
      );
    },

    async uploadExternalDocument(
      caseId,
      {
        purpose,
        file,
        attachmentFilename = null,
        syntheticConfirmed = false,
        supersedesDocumentVersionId = null,
        signal = null,
      } = {}
    ) {
      const id = safeSegment(caseId, "caseId");
      const exactPurpose = safePurpose(purpose);
      const fileMetadata = validateRtmPresenterExternalFile(file);
      const exactAttachmentFilename = validateRtmPresenterAttachmentFilename(
        attachmentFilename || fileMetadata.filename,
        fileMetadata.mediaType
      );
      if (syntheticConfirmed !== true) {
        fail(
          "presenter.synthetic_confirmation_required",
          "Confirma que el documento es completamente sintético y no contiene datos reales."
        );
      }
      const supersedesId = supersedesDocumentVersionId
        ? safeSegment(
            supersedesDocumentVersionId,
            "supersedes_document_version_id"
          )
        : null;
      const form = new FormData();
      form.append("purpose", exactPurpose);
      form.append("source_original_filename", fileMetadata.filename);
      form.append("synthetic_confirmed", "true");
      if (supersedesId) {
        form.append("supersedes_document_version_id", supersedesId);
      }
      form.append("file", file, exactAttachmentFilename);
      return jsonRequest(
        `${RTM_PRESENTER_API_PREFIX}/cases/${id}/documents/external`,
        {
          method: "POST",
          body: form,
          signal,
        }
      );
    },
  });
}
