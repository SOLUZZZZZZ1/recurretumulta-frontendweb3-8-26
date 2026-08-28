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
const EXTERNAL_DOCUMENT_PURPOSES = new Set(
  RTM_PRESENTER_EXTERNAL_DOCUMENT_PURPOSES
);

const ACTOR_OPTIONS = Object.freeze([
  { value: "self", label: "Actúo como interesado" },
  { value: "representative", label: "Actúo como representante" },
]);

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

  return Object.freeze({
    caseId: exactCaseId,
    destinations: Object.freeze(destinations),
    documents: Object.freeze(documents),
    actions: Object.freeze({ ...actions }),
  });
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
  return String(value || "")
    .replace(/[._-]+/g, " ")
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
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
  const [representationMode, setRepresentationMode] = useState("self");
  const [selections, setSelections] = useState({});
  const [authorizationVersionId, setAuthorizationVersionId] = useState("");
  const [frozenPackage, setFrozenPackage] = useState(null);
  const [supersedesPackageId, setSupersedesPackageId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busyCommand, setBusyCommand] = useState("");
  const [message, setMessage] = useState("");
  const [externalMode, setExternalMode] = useState("new");
  const [externalPurpose, setExternalPurpose] = useState("");
  const [externalSupersedesId, setExternalSupersedesId] = useState("");
  const [externalFileMetadata, setExternalFileMetadata] = useState(null);
  const [syntheticConfirmed, setSyntheticConfirmed] = useState(false);
  const commandLockRef = useRef(false);
  const pendingFreezeRef = useRef(null);
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

  const applyWorkspace = useCallback(
    (payload) => {
      const next = normalizeWorkspace(payload, caseId);
      pendingFreezeRef.current = null;
      setWorkspace(next);
      setProfileId(next.destinations[0]?.destination_profile_id || "");
      setSelections({});
      setAuthorizationVersionId("");
      setFrozenPackage(null);
      setSupersedesPackageId(null);
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
    if (externalFileInputRef.current) {
      externalFileInputRef.current.value = "";
    }
    setExternalFileMetadata(null);
  }, [caseId]);

  const profile = useMemo(
    () =>
      workspace?.destinations.find(
        (item) => item.destination_profile_id === profileId
      ) || null,
    [profileId, workspace]
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
    setFrozenPackage(null);
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

  function clearExternalFileInput() {
    if (externalFileInputRef.current) {
      externalFileInputRef.current.value = "";
    }
    setExternalFileMetadata(null);
    setSyntheticConfirmed(false);
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
      setMessage(
        `${metadata.filename} queda custodiado en RTM como review/pending. En este corte el scanner y la activación aún no están conectados, por lo que no será seleccionable.`
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
      pendingFreezeRef.current = null;
      setSupersedesPackageId(null);
      setMessage(
        "Paquete congelado. No se han emitido tickets ni se ha enviado contenido fuera de RTM."
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
            Expediente sintético{" "}
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
          {loading ? "Actualizando…" : "Actualizar contenedor"}
        </button>
      </header>

      <p className="rtmp-stay-notice" role="note">
        <strong>Permanece en RTM.</strong> Para documentos ya custodiados, la
        interfaz de operador solo maneja metadatos, identificadores de versión y
        huellas. Al incorporar un archivo externo lo envía directamente a RTM,
        sin crear una previsualización, descarga ni copia persistente propia; la
        referencia temporal al archivo se limpia al terminar.
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
          {documentIngestAllowed ? (
            <section className="rtmp-card" aria-labelledby="rtmp-external-title">
              <div className="rtmp-section-heading">
                <div>
                  <p className="rtmp-eyebrow">Contenedor individual</p>
                  <h2 id="rtmp-external-title">Añadir documento externo</h2>
                  <p>
                    El archivo se incorpora directamente a la custodia de RTM.
                    En este corte el scanner y la activación aún no están
                    conectados: queda en review/pending y no puede seleccionarse.
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
                  <legend>Tipo de incorporación</legend>
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
                    Documento nuevo
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
                    Nueva versión de un documento existente
                  </label>
                </fieldset>

                {externalMode === "new" ? (
                  <label>
                    Finalidad documental
                    <select
                      value={effectiveExternalPurpose}
                      disabled={externalIngestLocked}
                      required
                      onChange={(event) => setExternalPurpose(event.target.value)}
                    >
                      <option value="">Selecciona una finalidad</option>
                      {externalPurposeOptions.map((purpose) => (
                        <option key={purpose} value={purpose}>
                          {purposeLabel(purpose)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label>
                    Versión existente que se sustituye
                    <select
                      value={externalSupersedesId}
                      disabled={externalIngestLocked}
                      required
                      onChange={(event) =>
                        setExternalSupersedesId(event.target.value)
                      }
                    >
                      <option value="">Selecciona una versión</option>
                      {externalLatestVersionCandidates.map(
                        (documentVersion) => (
                          <option
                            key={documentVersion.document_version_id}
                            value={documentVersion.document_version_id}
                          >
                            {versionLabel(documentVersion)} ·{" "}
                            {documentVersion.state}/
                            {documentVersion.scan_status}
                          </option>
                        )
                      )}
                    </select>
                    {externalSupersededDocument ? (
                      <span className="rtmp-help">
                        Conserva la finalidad:{" "}
                        {purposeLabel(effectiveExternalPurpose)}
                      </span>
                    ) : null}
                  </label>
                )}

                <label>
                  Archivo
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
                <p id="rtmp-external-file-help" className="rtmp-help">
                  PDF, DOCX, JPEG o PNG; máximo 25 MiB. No se crea una
                  previsualización, descarga ni copia persistente propia; la
                  referencia temporal al archivo se limpia al terminar.
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
                      Confirmo que es un documento completamente sintético y sin
                      datos reales
                    </strong>
                    <span className="rtmp-help">
                      Staging bloquea la incorporación sin esta confirmación
                      expresa.
                    </span>
                  </span>
                </label>
                {externalIngestLocked && !busyCommand ? (
                  <p className="rtmp-alert" role="note">
                    Termina la preparación o congelación actual antes de incorporar
                    otra versión al contenedor.
                  </p>
                ) : null}
                <button
                  type="submit"
                  className="rtmp-button rtmp-button-primary"
                  disabled={
                    externalIngestLocked ||
                    !externalFileMetadata ||
                    !effectiveExternalPurpose ||
                    !syntheticConfirmed ||
                    (externalMode === "version" && !externalSupersededDocument)
                  }
                >
                  {busyCommand === "upload-external"
                    ? "Incorporando…"
                    : "Incorporar al contenedor"}
                </button>
              </form>
            </section>
          ) : null}

          <section className="rtmp-card" aria-labelledby="rtmp-destination-title">
            <div className="rtmp-section-heading">
              <div>
                <p className="rtmp-eyebrow">Paso 1</p>
                <h2 id="rtmp-destination-title">Sede, perfil y representación</h2>
                <p>El origen y el contrato del perfil llegan verificados por RTM.</p>
              </div>
              <span className="rtmp-chip">Custodia interna</span>
            </div>
            <label className="rtmp-single-field">
              Sede y perfil de presentación
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
                {workspace.destinations.map((item) => (
                  <option
                    key={item.destination_profile_id}
                    value={item.destination_profile_id}
                  >
                    {item.display_name} · {item.profile_code} v{item.profile_version}
                  </option>
                ))}
              </select>
            </label>
            {profile ? (
              <dl className="rtmp-profile-meta">
                <div>
                  <dt>Origen exacto</dt>
                  <dd className="rtmp-mono">{profile.portal_origin}</dd>
                </div>
                <div>
                  <dt>Huella del perfil</dt>
                  <dd className="rtmp-mono">{profile.profile_sha256}</dd>
                </div>
              </dl>
            ) : null}
            <fieldset className="rtmp-actor-fieldset">
              <legend>Modo de actuación</legend>
              {ACTOR_OPTIONS.filter((option) =>
                profile?.representation_modes?.includes(option.value)
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
          </section>

          <section className="rtmp-card" aria-labelledby="rtmp-checklist-title">
            <div className="rtmp-section-heading">
              <div>
                <p className="rtmp-eyebrow">Paso 2</p>
                <h2 id="rtmp-checklist-title">Elegir versiones del contenedor</h2>
                <p>
                  Se seleccionan únicamente metadatos de versiones activas,
                  verificadas y compatibles con cada campo de la sede.
                </p>
              </div>
              <span
                className={`rtmp-chip ${
                  readiness.ready ? "rtmp-chip-ok" : "rtmp-chip-warn"
                }`}
              >
                {readiness.ready ? "COMPLETO" : "PENDIENTE"}
              </span>
            </div>

            {!profile ? <p>Selecciona una sede para cargar sus campos.</p> : null}
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
                      <h3>
                        {field.label}
                        {field.required ? " *" : ""}
                      </h3>
                      <p className="rtmp-help">
                        {field.mediaTypes.join(", ")} · máximo {field.maxFiles}{" "}
                        {field.maxFiles === 1 ? "archivo" : "archivos"} ·{" "}
                        {formatBytes(field.maxBytes)} por archivo
                      </p>
                      <div className="rtmp-selection-slots">
                        {Array.from({ length: field.maxFiles }, (_, slot) => {
                          const selectedId = values[slot] || "";
                          const selected = selectedDocumentVersion(
                            workspace.documents,
                            selectedId
                          );
                          return (
                            <div key={`${field.fieldCode}-${slot}`} className="rtmp-version-slot">
                              <label>
                                Versión {slot + 1}
                                <select
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
                                      ? "Selecciona una versión"
                                      : "Sin documento adicional"}
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
                                <dl className="rtmp-version-meta">
                                  <div>
                                    <dt>Finalidad</dt>
                                    <dd>{selected.purpose}</dd>
                                  </div>
                                  <div>
                                    <dt>Tipo</dt>
                                    <dd>{selected.media_type}</dd>
                                  </div>
                                  <div>
                                    <dt>Huella SHA-256</dt>
                                    <dd className="rtmp-mono">{selected.sha256}</dd>
                                  </div>
                                </dl>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>

            {representationMode === "representative" ? (
              <label className="rtmp-single-field">
                Autorización exacta incluida en el paquete
                <select
                  value={effectiveAuthorizationVersionId || ""}
                  onChange={(event) => {
                    setAuthorizationVersionId(event.target.value);
                    resetFrozenState();
                  }}
                  required
                  disabled={editingLocked}
                >
                  <option value="">Selecciona la autorización firmada</option>
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
                <h2 id="rtmp-freeze-title">Congelar paquete</h2>
                <p>{readiness.message}</p>
              </div>
              {frozenPackage ? (
                <span className="rtmp-chip rtmp-chip-ok">PAQUETE CONGELADO</span>
              ) : null}
            </div>
            {frozenPackage ? (
              <>
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
                    <dd className="rtmp-mono">{frozenPackage.manifest_sha256}</dd>
                  </div>
                  <div>
                    <dt>Caduca</dt>
                    <dd>{String(frozenPackage.expires_at)}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  className="rtmp-button rtmp-button-secondary rtmp-new-version-button"
                  onClick={() => {
                    setSupersedesPackageId(frozenPackage.package_id);
                    setFrozenPackage(null);
                    setMessage(
                      "Edita la selección y congela una nueva versión; el paquete anterior no se modifica."
                    );
                  }}
                >
                  Preparar nueva versión
                </button>
              </>
            ) : (
              <button
                type="button"
                className="rtmp-button rtmp-button-primary"
                onClick={() => void freezePackage()}
                disabled={!readiness.ready || Boolean(busyCommand)}
              >
                {busyCommand === "freeze" ? "Congelando…" : "Congelar paquete"}
              </button>
            )}
          </section>

          {frozenPackage ? (
            <section className="rtmp-card rtmp-extension-card" aria-labelledby="rtmp-extension-title">
              <p className="rtmp-eyebrow">Paso 4</p>
              <h2 id="rtmp-extension-title">Adjuntar desde la sede</h2>
              <p>
                El puente remoto sigue cerrado en este staging; hoy solo existe un
                prototipo local sintético y no se entregan bytes. El diseño previsto
                hará que la extensión confiable identifique cada campo y solicite un
                ticket de un solo uso ligado al origen, paquete y versión congelada,
                sin crear copias locales del operador.
              </p>
              <p className="rtmp-alert" role="note">
                La extensión nunca pulsa “Enviar”, firma, resuelve CAPTCHA ni
                completa Cl@ve. Esas acciones siguen siendo humanas.
              </p>
            </section>
          ) : null}

          <ExceptionalExportPanel allowed={exceptionalExportAllowed} />
        </>
      ) : null}
    </section>
  );
}
