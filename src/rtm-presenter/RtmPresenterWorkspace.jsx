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
const EXTERNAL_DOCUMENT_PURPOSES = new Set(
  RTM_PRESENTER_EXTERNAL_DOCUMENT_PURPOSES
);

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

function deliveryFromResponse(payload, { caseId, frozenPackage }) {
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
  if (
    String(value.case_id || "") !== String(caseId || "") ||
    String(value.package_id || "") !== String(frozenPackage?.package_id || "") ||
    String(value.package_manifest_sha256 || "") !==
      String(frozenPackage?.manifest_sha256 || "") ||
    value.channel !== "portal" ||
    value.state !== "prepared" ||
    value.destination?.kind !== "verified_portal_origin" ||
    String(value.destination?.portal_origin || "") !==
      String(frozenPackage?.portal_origin || "") ||
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
  const [profileId, setProfileId] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [destinationOptions, setDestinationOptions] = useState([]);
  const [searchingDestinations, setSearchingDestinations] = useState(false);
  const [representationMode, setRepresentationMode] = useState("self");
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
      setProfileId("");
      setDestinationQuery("");
      setDestinationOptions(next.destinations);
      setSelections({});
      setAuthorizationVersionId("");
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
  }, [caseId]);

  const profile = useMemo(
    () =>
      destinationOptions.find(
        (item) => item.destination_profile_id === profileId
      ) || null,
    [destinationOptions, profileId]
  );

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

  const editingLocked = Boolean(busyCommand) || Boolean(frozenPackage);
  const profileLocked = editingLocked || Boolean(supersedesPackageId);
  const externalIngestLocked =
    Boolean(busyCommand) ||
    Boolean(frozenPackage) ||
    Boolean(supersedesPackageId);

  function resetFrozenState() {
    pendingFreezeRef.current = null;
    pendingDeliveryRef.current = null;
    setFrozenPackage(null);
    setDelivery(null);
    setMessage("");
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
      const nextOptions =
        selected &&
        !matches.some(
          (item) =>
            item.destination_profile_id === selected.destination_profile_id
        )
          ? Object.freeze([selected, ...matches])
          : matches;
      setDestinationOptions(nextOptions);
      if (matches.length === 0) {
        setMessage(
          "No existe todavía un destino verificado con ese nombre. Debe solicitarse su alta y doble verificación antes de presentar."
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
    if (!profile || !workspace || busyCommand || commandLockRef.current) return;
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

  async function preparePortalDelivery() {
    if (
      !frozenPackage ||
      !deliveryPrepareAllowed ||
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
          channel: "portal",
          idempotencyKey: pendingDeliveryRef.current,
        }
      );
      setDelivery(
        deliveryFromResponse(result, {
          caseId,
          frozenPackage,
        })
      );
      pendingDeliveryRef.current = null;
      setMessage(
        "Orden de presentación preparada y auditada. Todavía no se ha cargado ni enviado ningún documento fuera de RTM."
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
          <nav className="rtmp-flow-progress" aria-label="Progreso de la preparación">
            <ol>
              <li className={profile ? "is-complete" : "is-current"}>
                <span className="rtmp-progress-number">1</span>
                <span>
                  <strong>Destino y representación</strong>
                  <small>{profile ? "Completo" : "Pendiente"}</small>
                </span>
              </li>
              <li
                className={
                  readiness.ready
                    ? "is-complete"
                    : profile
                      ? "is-current"
                      : ""
                }
              >
                <span className="rtmp-progress-number">2</span>
                <span>
                  <strong>Documentación solicitada</strong>
                  <small>{readiness.ready ? "Completo" : "Pendiente"}</small>
                </span>
              </li>
              <li
                className={
                  frozenPackage
                    ? "is-complete"
                    : readiness.ready
                      ? "is-current"
                      : ""
                }
              >
                <span className="rtmp-progress-number">3</span>
                <span>
                  <strong>Revisar y preparar</strong>
                  <small>{frozenPackage ? "Preparado" : "Pendiente"}</small>
                </span>
              </li>
              <li className={delivery ? "is-complete" : frozenPackage ? "is-current" : ""}>
                <span className="rtmp-progress-number">4</span>
                <span>
                  <strong>Presentar y justificar</strong>
                  <small>{delivery ? "Orden preparada" : "Pendiente"}</small>
                </span>
              </li>
            </ol>
          </nav>

          <section className="rtmp-card" aria-labelledby="rtmp-destination-title">
            <div className="rtmp-section-heading">
              <div>
                <p className="rtmp-eyebrow">Paso 1</p>
                <h2 id="rtmp-destination-title">¿Dónde vas a presentarlo?</h2>
                <p>
                  Elige la sede administrativa y cómo actúas en este trámite.
                  RTM cargará automáticamente lo que esa sede solicita.
                </p>
              </div>
              <span className={`rtmp-chip ${profile ? "rtmp-chip-ok" : ""}`}>
                {profile ? "DESTINO ELEGIDO" : "PENDIENTE"}
              </span>
            </div>
            <form className="rtmp-destination-search" onSubmit={searchDestinations}>
              <label>
                Buscar sede por organismo o municipio
                <input
                  type="search"
                  value={destinationQuery}
                  minLength={2}
                  maxLength={100}
                  placeholder="Ej. Ayuntamiento de Madrid, DGT, Albacete…"
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
                {searchingDestinations ? "Buscando…" : "Buscar destino verificado"}
              </button>
            </form>
            <p className="rtmp-help">
              OPS busca en su registro interno. El operador no puede pegar una URL
              ni enviar a una dirección sin verificar.
            </p>
            <label className="rtmp-single-field">
              Sede administrativa
              <select
                value={profileId}
                onChange={(event) => {
                  setProfileId(event.target.value);
                  setSelections({});
                  setAuthorizationVersionId("");
                  resetFrozenState();
                }}
                disabled={profileLocked}
              >
                <option value="">Selecciona una sede</option>
                {destinationOptions.map((item) => (
                  <option
                    key={item.destination_profile_id}
                    value={item.destination_profile_id}
                  >
                    {item.display_name}
                  </option>
                ))}
              </select>
            </label>
            {profile ? (
              <details className="rtmp-technical-details">
                <summary>Ver datos técnicos verificados de la sede</summary>
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
          </section>

          <section className="rtmp-card" aria-labelledby="rtmp-checklist-title">
            <div className="rtmp-section-heading">
              <div>
                <p className="rtmp-eyebrow">Paso 2</p>
                <h2 id="rtmp-checklist-title">
                  Documentación solicitada por la sede
                </h2>
                <p>
                  Aparece en el mismo orden que la sede. Pulsa «Elegir desde RTM»
                  para relacionar cada campo con un documento del expediente.
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
                    readiness.ready ? "rtmp-chip-ok" : "rtmp-chip-warn"
                  }`}
                >
                  {readiness.ready ? "COMPLETO" : "PENDIENTE"}
                </span>
              </div>
            </div>

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

            {!profile ? (
              <p className="rtmp-empty-step">
                Primero selecciona una sede en el paso 1 para ver qué documentos
                solicita y en qué orden.
              </p>
            ) : null}
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
          </section>

          <section className="rtmp-card" aria-labelledby="rtmp-freeze-title">
            <div className="rtmp-section-heading">
              <div>
                <p className="rtmp-eyebrow">Paso 3</p>
                <h2 id="rtmp-freeze-title">Revisar y preparar</h2>
                <p>
                  {frozenPackage
                    ? "La selección ha quedado fijada sin sacar documentos de RTM."
                    : readiness.message}
                </p>
              </div>
              {frozenPackage ? (
                <span className="rtmp-chip rtmp-chip-ok">PAQUETE PREPARADO</span>
              ) : null}
            </div>
            {frozenPackage ? (
              <>
                <div className="rtmp-ready-summary" role="status">
                  <strong>Todo preparado para trabajar en la sede.</strong>
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
                disabled={!readiness.ready || Boolean(busyCommand)}
              >
                {busyCommand === "freeze"
                  ? "Preparando…"
                  : "Preparar paquete para presentar"}
              </button>
            )}
          </section>

          {frozenPackage ? (
            <section className="rtmp-card rtmp-extension-card" aria-labelledby="rtmp-extension-title">
              <p className="rtmp-eyebrow">Paso 4 · Presentación humana</p>
              <h2 id="rtmp-extension-title">Presentar desde RTM</h2>
              <p>
                RTM seguirá el orden propio de la sede y relacionará cada campo con
                la versión exacta del contenedor. No se crea una carpeta local ni se
                ofrece descarga al operador.
              </p>
              <ol className="rtmp-delivery-list">
                {frozenPackage.items.map((item) => (
                  <li key={item.item_id}>
                    <span className="rtmp-delivery-order">{item.item_order}</span>
                    <span>
                      <strong>{FIELD_LABELS[item.field_code] || item.field_code}</strong>
                      <small>{item.portal_filename}</small>
                    </span>
                    <span className="rtmp-field-status">
                      {delivery ? "PENDIENTE DE CARGA" : "EN PAQUETE"}
                    </span>
                  </li>
                ))}
              </ol>
              {delivery ? (
                <div className="rtmp-delivery-state" role="status">
                  <strong>Orden auditada; sin efecto externo.</strong>
                  <span>
                    Destino verificado: {delivery.destination.portal_origin}
                  </span>
                  <span>
                    El puente gestionado continúa cerrado hasta disponer de
                    atestación criptográfica; cuando se active, cada documento
                    exigirá un ticket de un solo uso. No se han entregado bytes.
                  </span>
                </div>
              ) : deliveryPrepareAllowed ? (
                <button
                  type="button"
                  className="rtmp-button rtmp-button-primary"
                  onClick={() => void preparePortalDelivery()}
                  disabled={Boolean(busyCommand)}
                >
                  {busyCommand === "prepare-delivery"
                    ? "Preparando orden…"
                    : "Preparar carga ordenada en la sede"}
                </button>
              ) : (
                <p className="rtmp-alert" role="note">
                  Esta cuenta todavía no tiene el permiso específico para preparar
                  entregas. Un supervisor debe actualizar su rol de operador.
                </p>
              )}
              <p className="rtmp-alert" role="note">
                Cargar un adjunto puede comunicarlo ya a la sede. RTM nunca pulsa
                “Enviar”, firma, resuelve CAPTCHA ni completa Cl@ve: la confirmación
                final y la revisión del justificante siguen siendo humanas.
              </p>
            </section>
          ) : null}

          <ExceptionalExportPanel allowed={exceptionalExportAllowed} />
        </>
      ) : null}
    </section>
  );
}
