export const RTM_PRESENTER_MODEL_VERSION =
  "rtm.presenter.frontend.workspace.v2";

export const RTM_PRESENTER_EXCEPTIONAL_EXPORT_CAPABILITY =
  "ops.documents.export_exceptional";
export const RTM_PRESENTER_DOCUMENT_INGEST_CAPABILITY =
  "presenter.documents.ingest";

const REPRESENTATION_MODES = new Set(["self", "representative"]);
const AUTHORIZATION_PURPOSES = new Set([
  "authorization",
  "representation",
  "signed_authorization",
  "representation_authorization",
]);

export class RtmPresenterModelError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "RtmPresenterModelError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new RtmPresenterModelError(code, message, details);
}

function requiredText(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    fail("presenter.required_text", `Falta ${field}.`, { field });
  }
  return value.trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizedList(value) {
  return asArray(value)
    .filter((item) => typeof item === "string" && item.trim())
    .map((item) => item.trim().toLowerCase());
}

function positiveInteger(value, field, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > maximum) {
    fail("presenter.integer_invalid", `${field} no es válido.`, { field });
  }
  return number;
}

function safePortalOrigin(value) {
  const raw = requiredText(value, "portal_origin");
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail("presenter.portal_origin_invalid", "El origen de la sede no es válido.");
  }
  if (url.protocol !== "https:" || url.origin !== raw) {
    fail(
      "presenter.portal_origin_invalid",
      "El perfil no contiene un origen exacto de sede."
    );
  }
  return url.origin;
}

function safePortalFilename(value, field) {
  const filename = requiredText(value, field);
  if (
    filename.length > 160 ||
    /[\\/\u0000-\u001f\u007f]/.test(filename) ||
    filename === "." ||
    filename === ".."
  ) {
    fail(
      "presenter.portal_filename_invalid",
      `${field} no es un nombre de archivo válido.`
    );
  }
  return filename;
}

function exactExpiry(value) {
  const raw = requiredText(value, "expires_at");
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) {
    fail("presenter.expiry_invalid", "La caducidad del paquete no es válida.");
  }
  return parsed.toISOString();
}

function fieldLabel(fieldCode) {
  return String(fieldCode || "")
    .replace(/[._-]+/g, " ")
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

export function evaluateRtmPresenterBoundary({
  environment,
  syntheticOnly,
} = {}) {
  const blockers = [];
  if (environment !== "staging") blockers.push("environment_not_staging");
  if (syntheticOnly !== true) blockers.push("synthetic_boundary_required");
  return Object.freeze({
    allowed: blockers.length === 0,
    blockers: Object.freeze(blockers),
    environment: String(environment || ""),
    syntheticOnly: syntheticOnly === true,
    externalEffectsAuthorized: false,
  });
}

export function hasExceptionalExportCapability(capabilities) {
  return asArray(capabilities)
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .includes(RTM_PRESENTER_EXCEPTIONAL_EXPORT_CAPABILITY);
}

export function hasPresenterDocumentIngestCapability(capabilities) {
  return asArray(capabilities).some(
    (item) => item === RTM_PRESENTER_DOCUMENT_INGEST_CAPABILITY
  );
}

export function normalizePresenterRepresentationMode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  const backendMode = normalized === "interested" ? "self" : normalized;
  if (!REPRESENTATION_MODES.has(backendMode)) {
    fail(
      "presenter.representation_mode_invalid",
      "El modo de representación no es válido."
    );
  }
  return backendMode;
}

export function orderedPresenterFields(profile, representationMode) {
  const mode = normalizePresenterRepresentationMode(representationMode);
  const allowedModes = normalizedList(profile?.representation_modes);
  if (allowedModes.length > 0 && !allowedModes.includes(mode)) {
    fail(
      "presenter.representation_mode_rejected",
      "El perfil no admite este modo de representación."
    );
  }

  const normalizedFields = asArray(profile?.fields).map((field, index) => {
      const fieldCode = requiredText(
        field?.field_code,
        `fields[${index}].field_code`
      ).toLowerCase();
      const requiredForModes = Object.freeze(
        normalizedList(field?.required_for_modes)
      );
      if (
        requiredForModes.some(
          (requiredMode) => !REPRESENTATION_MODES.has(requiredMode)
        )
      ) {
        fail(
          "presenter.required_mode_invalid",
          `${fieldCode}.required_for_modes no es válido.`
        );
      }
      return Object.freeze({
        ...field,
        id: fieldCode,
        fieldCode,
        label: String(field?.label || fieldLabel(fieldCode)),
        order: positiveInteger(
          field?.step_order,
          `${fieldCode}.step_order`,
          128
        ),
        requiredForModes,
        required: field?.required === true || requiredForModes.includes(mode),
        purposes: Object.freeze(normalizedList(field?.purposes)),
        mediaTypes: Object.freeze(normalizedList(field?.media_types)),
        maxFiles: positiveInteger(
          field?.max_files || 1,
          `${fieldCode}.max_files`,
          32
        ),
        maxBytes: positiveInteger(
          field?.max_bytes || Number.MAX_SAFE_INTEGER,
          `${fieldCode}.max_bytes`
        ),
      });
    });
  normalizedFields.sort((left, right) => left.order - right.order);
  const fieldCodes = new Set();
  normalizedFields.forEach((field, index) => {
    if (field.order !== index + 1) {
      fail(
        "presenter.step_order_invalid",
        "El perfil no conserva un orden de pasos continuo y verificable."
      );
    }
    if (fieldCodes.has(field.fieldCode)) {
      fail(
        "presenter.field_code_repeated",
        "El perfil repite un campo de presentación."
      );
    }
    fieldCodes.add(field.fieldCode);
  });
  return Object.freeze(normalizedFields);
}

export const orderedPresenterRequirements = orderedPresenterFields;

export function presenterDocumentVersionMatchesField(documentVersion, field) {
  if (!documentVersion || !field) return false;
  if (documentVersion.synthetic_only !== true) return false;
  if (String(documentVersion.state || "").toLowerCase() !== "active") {
    return false;
  }
  if (String(documentVersion.scan_status || "").toLowerCase() !== "clean") {
    return false;
  }
  const purposes = normalizedList(field.purposes);
  if (
    purposes.length > 0 &&
    !purposes.includes(String(documentVersion.purpose || "").toLowerCase())
  ) {
    return false;
  }
  const mediaTypes = normalizedList(field.mediaTypes);
  if (
    mediaTypes.length > 0 &&
    !mediaTypes.includes(String(documentVersion.media_type || "").toLowerCase())
  ) {
    return false;
  }
  return Number(documentVersion.size_bytes || 0) <= Number(field.maxBytes || 0);
}

export function matchingPresenterDocumentVersions(documents, field) {
  return Object.freeze(
    latestPresenterDocumentVersions(documents).filter((documentVersion) =>
      presenterDocumentVersionMatchesField(documentVersion, field)
    )
  );
}

export function latestPresenterDocumentVersions(documents) {
  const latestByLogicalDocument = new Map();
  for (const documentVersion of asArray(documents)) {
    const logicalDocumentId = String(
      documentVersion?.logical_document_id || ""
    ).trim();
    const versionNumber = Number(documentVersion?.version_number);
    if (
      !logicalDocumentId ||
      !Number.isInteger(versionNumber) ||
      versionNumber < 1
    ) {
      continue;
    }
    const current = latestByLogicalDocument.get(logicalDocumentId);
    if (!current || versionNumber > Number(current.version_number)) {
      latestByLogicalDocument.set(logicalDocumentId, documentVersion);
    }
  }
  return Object.freeze([...latestByLogicalDocument.values()]);
}

export const matchingPresenterDocuments = matchingPresenterDocumentVersions;
export const presenterDocumentMatchesRequirement =
  presenterDocumentVersionMatchesField;
export const presenterVersionMatchesRequirement =
  presenterDocumentVersionMatchesField;

function selectionIds(value) {
  const candidates = Array.isArray(value) ? value : [value];
  return candidates
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function documentVersionById(documents, documentVersionId) {
  return asArray(documents).find(
    (item) => item?.document_version_id === documentVersionId
  );
}

export function buildRtmPresenterFreezePayload({
  destinationProfile,
  representationMode,
  actorMode,
  selections = {},
  documents = [],
  authorizationDocumentVersionId = null,
  expiresAt,
  supersedesPackageId = null,
} = {}) {
  const profileId = requiredText(
    destinationProfile?.destination_profile_id,
    "destination_profile_id"
  );
  const portalOrigin = safePortalOrigin(destinationProfile?.portal_origin);
  const mode = normalizePresenterRepresentationMode(
    representationMode || actorMode
  );
  const fields = orderedPresenterFields(destinationProfile, mode);
  const items = [];
  const selectedIds = new Set();
  const latestDocumentVersionIds = new Set(
    latestPresenterDocumentVersions(documents).map((item) =>
      String(item?.document_version_id || "")
    )
  );

  for (const field of fields) {
    const ids = selectionIds(selections[field.fieldCode]);
    if (field.required && ids.length === 0) {
      fail(
        "presenter.required_document_missing",
        `${field.label}: selecciona al menos una versión documental.`,
        { fieldCode: field.fieldCode }
      );
    }
    if (ids.length > field.maxFiles) {
      fail(
        "presenter.field_file_limit",
        `${field.label}: demasiados documentos seleccionados.`,
        { fieldCode: field.fieldCode }
      );
    }
    for (const documentVersionId of ids) {
      if (selectedIds.has(documentVersionId)) {
        fail(
          "presenter.document_version_repeated",
          "Una versión documental no puede ocupar dos campos del paquete."
        );
      }
      const documentVersion = documentVersionById(
        documents,
        documentVersionId
      );
      if (
        !documentVersion ||
        !latestDocumentVersionIds.has(documentVersionId) ||
        !presenterDocumentVersionMatchesField(documentVersion, field)
      ) {
        fail(
          "presenter.document_version_not_eligible",
          `${field.label}: la versión seleccionada no cumple el perfil.`,
          { fieldCode: field.fieldCode, documentVersionId }
        );
      }
      selectedIds.add(documentVersionId);
      items.push(
        Object.freeze({
          document_version_id: requiredText(
            documentVersion.document_version_id,
            `${field.label}: document_version_id`
          ),
          item_order: items.length + 1,
          field_code: field.fieldCode,
          portal_filename: safePortalFilename(
            documentVersion.original_filename,
            `${field.label}: original_filename`
          ),
        })
      );
    }
  }

  let exactAuthorizationId = null;
  if (mode === "representative") {
    exactAuthorizationId = requiredText(
      authorizationDocumentVersionId,
      "authorization_document_version_id"
    );
    const authorization = documentVersionById(documents, exactAuthorizationId);
    const authorizationFieldCode = requiredText(
      destinationProfile?.authorization_field_code,
      "authorization_field_code"
    ).toLowerCase();
    const authorizationItem = items.find(
      (item) => item.document_version_id === exactAuthorizationId
    );
    if (
      !fields.some((field) => field.fieldCode === authorizationFieldCode) ||
      authorizationItem?.field_code !== authorizationFieldCode ||
      !AUTHORIZATION_PURPOSES.has(
        String(authorization?.purpose || "").toLowerCase()
      )
    ) {
      fail(
        "presenter.authorization_not_in_package",
        "La autorización exacta debe estar seleccionada dentro del paquete."
      );
    }
  } else if (authorizationDocumentVersionId) {
    fail(
      "presenter.unexpected_authorization",
      "La presentación propia no admite autorización de representante."
    );
  }

  const payload = {
    destination_profile_id: profileId,
    portal_origin: portalOrigin,
    representation_mode: mode,
    authorization_document_version_id: exactAuthorizationId,
    expires_at: exactExpiry(expiresAt),
    items,
  };
  if (supersedesPackageId) {
    payload.supersedes_package_id = requiredText(
      supersedesPackageId,
      "supersedes_package_id"
    );
  }
  return Object.freeze({
    ...payload,
    items: Object.freeze(items),
  });
}

export function evaluateRtmPresenterReadiness(input) {
  try {
    return Object.freeze({
      ready: true,
      payload: buildRtmPresenterFreezePayload(input),
      message: "El paquete cumple el perfil de la sede.",
    });
  } catch (error) {
    if (error instanceof RtmPresenterModelError) {
      return Object.freeze({
        ready: false,
        payload: null,
        message: error.message,
        code: error.code,
      });
    }
    throw error;
  }
}
