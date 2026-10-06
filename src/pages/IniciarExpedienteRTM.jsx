import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import {
  PUBLIC_SERVICE_FAMILIES,
  VEHICLE_REMOVAL_PATH,
  getPublicService,
} from "../data/publicServices.js";
import {
  apiFetch,
  openCaseFile,
  normalizeCaseId,
  rememberCaseAccessToken,
  RTM_API_CANDIDATES,
} from "../lib/api.js";
import {
  appendAuthorizationDocumentBinding,
  parseAuthorizationCandidateEnvelope,
  parseAuthorizationIssueEnvelope,
} from "../lib/authorizationEvidence.js";
import { safeInternalPath } from "../lib/safeNavigation.js";
import { readOpsAuthStatus } from "../ops-auth/opsAuthApi.js";
import { currentLocalOpsDevelopmentEnabled } from "../ops-auth/opsLocalDevelopment.js";
import {
  LOCAL_RTM_AUTHORIZATION_KIND,
  appendLocalAuthorizationBinding,
  authorizationRoutes,
  continueIntakeAuthorization,
  intakeAuthorizationFlow,
  localSyntheticIdentityError,
  parseLocalAuthorizationCandidate,
  parseLocalAuthorizationIssue,
} from "../lib/intakeAuthorizationFlow.js";

const MAX_FILE_BYTES = 8 * 1024 * 1024;

const SERVICE_CONFIG = {
  traffic: {
    label: "Tráfico",
    icon: "🚗",
    defaultCaseType: "fine",
    nextPath: "/multas",
    caseTypes: {
      fine: "Recurrir una multa",
      vehicle_removal: "Eliminar un vehículo",
      other_traffic: "Otro trámite de tráfico",
    },
  },
  debt: {
    label: "Deudas y morosidad",
    icon: "💳",
    defaultCaseType: "asnef_equifax",
    nextPath: "/deudas/documentos",
    caseTypes: {
      asnef_equifax: "ASNEF / Equifax",
      creditor_claim: "Reclamación frente al acreedor",
      other_debt: "Otro asunto de deuda",
    },
  },
  administration: {
    label: "Administración",
    icon: "🏛️",
    defaultCaseType: "general_administration",
    nextPath: "/administracion/documentos",
    caseTypes: {
      aeat: "Hacienda / AEAT",
      social_security: "Seguridad Social",
      town_hall: "Ayuntamiento",
      general_administration: "Otro organismo público",
    },
  },
  claims: {
    label: "Reclamaciones",
    icon: "✈️",
    defaultCaseType: "airline",
    nextPath: "/reclamaciones/documentos",
    caseTypes: {
      airline: "Aerolínea",
      consumer: "Consumo",
      other_claim: "Otra reclamación",
    },
  },
};

function nextPathForCase(department, caseType, defaultPath) {
  if (department === "traffic" && caseType === "vehicle_removal") {
    return VEHICLE_REMOVAL_PATH;
  }
  return defaultPath;
}

function buildUrl(base, path) {
  return `${String(base || "").replace(/\/$/, "")}${path}`;
}

async function readResponse(response) {
  const text = await response.text().catch(() => "");
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  if (!response.ok) {
    const detail = data?.detail?.message || data?.detail || data?.message || text || `HTTP ${response.status}`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data;
}

async function fetchJsonFallback(path, options = {}) {
  const errors = [];
  for (const base of RTM_API_CANDIDATES) {
    try {
      const response = await apiFetch(buildUrl(base, path), options);
      return await readResponse(response);
    } catch (error) {
      errors.push(error?.message || "Error");
    }
  }
  throw new Error(errors.join(" | "));
}

function openBackendFile(path, caseId) {
  return openCaseFile(buildUrl(RTM_API_CANDIDATES[0], path), caseId);
}

function normalizeDni(value = "") {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
}

function validEmail(value = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function formatBytes(bytes = 0) {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function IniciarExpedienteRTM({ rehearsal = null }) {
  const intakeJson = rehearsal?.fetchJson || fetchJsonFallback;
  const intakeFile = rehearsal?.openFile || openBackendFile;
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();

  const requestedDepartment =
    (rehearsal ? "traffic" : params.department) ||
    searchParams.get("department") ||
    "";
  const requestedType = rehearsal ? "fine" : params.caseType || searchParams.get("case_type") || "";
  const requestedFamilyId = rehearsal ? "trafico" : searchParams.get("family") || "";
  const ambiguousLegacyService = searchParams.get("service") || "";
  const department = requestedDepartment;
  const config = requestedDepartment ? SERVICE_CONFIG[requestedDepartment] : null;
  const selectedFamily = requestedFamilyId
    ? getPublicService(requestedFamilyId)
    : null;
  const invalidDepartment = Boolean(requestedDepartment && !config);
  const invalidType = Boolean(
    requestedType && (!config || !config.caseTypes[requestedType])
  );
  const invalidFamily = Boolean(
    requestedFamilyId && (!selectedFamily || !selectedFamily.intake)
  );
  const familyMismatch = Boolean(
    selectedFamily?.intake &&
      config &&
      (selectedFamily.intake.department !== department ||
        (requestedType && !selectedFamily.intake.caseTypes.includes(requestedType)))
  );
  const familyWithoutDepartment = Boolean(selectedFamily && !requestedDepartment);
  const invalidSelection =
    Boolean(ambiguousLegacyService) ||
    invalidDepartment ||
    invalidType ||
    invalidFamily ||
    familyMismatch ||
    familyWithoutDepartment;
  const needsServiceSelection = !requestedDepartment && !invalidSelection;
  const initialType =
    !invalidSelection && config
      ? requestedType || config.defaultCaseType
      : "";
  const availableCaseTypes = rehearsal ? ["fine"] : config
    ? selectedFamily?.intake?.caseTypes || Object.keys(config.caseTypes)
    : [];

  const [form, setForm] = useState({
    full_name: "",
    dni_nie: "",
    email: "",
    telefono: "",
    street: "",
    street_number: "",
    floor: "",
    door: "",
    postal_code: "",
    city: "",
    province: "",
    preferred_contact: "email",
    case_type: initialType,
    customer_comment: "",
    ...(rehearsal?.profile || {}),
    representation_confirmed: false,
    prejudicial_counsel_requested: false,
    privacy_accepted: false,
  });

  const [dniFront, setDniFront] = useState(rehearsal?.identityFront || null);
  const [dniBack, setDniBack] = useState(rehearsal?.identityBack || null);
  const [signedAuthorization, setSignedAuthorization] = useState(null);
  const [draftCase, setDraftCase] = useState(null);
  const draftCaseRef = useRef(null);
  const createRequestRef = useRef(false);
  const localRuntimeEnabled = currentLocalOpsDevelopmentEnabled();
  const [localProfileState, setLocalProfileState] = useState(localRuntimeEnabled ? "checking" : "disabled");
  const [authorizationUploaded, setAuthorizationUploaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const isVehicleRemoval =
    department === "traffic" && form.case_type === "vehicle_removal";
  const localProfileReady = localProfileState === "ready";
  const authorizationFlow = intakeAuthorizationFlow({
    department, caseType: form.case_type, family: selectedFamily?.id,
    localProfile: localProfileReady,
  });
  const isLocalGeneric = authorizationFlow === LOCAL_RTM_AUTHORIZATION_KIND;

  useEffect(() => {
    if (!localRuntimeEnabled) return undefined;
    const controller = new AbortController();
    void readOpsAuthStatus({ signal: controller.signal, allowLocalDevelopment: true })
      .then((status) => {
        if (!controller.signal.aborted) {
          setLocalProfileState(status.authProfile === "local_development" && status.localOnly === true ? "ready" : "blocked");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setLocalProfileState("blocked");
      });
    return () => controller.abort();
  }, [localRuntimeEnabled]);

  const dniFrontRef = useRef(null);
  const dniBackRef = useRef(null);
  const authRef = useRef(null);

  const domicilio = useMemo(() => {
    const line1 = [form.street, form.street_number, form.floor ? `Piso ${form.floor}` : "", form.door ? `Puerta ${form.door}` : ""].filter(Boolean).join(", ");
    const line2 = [form.postal_code, form.city, form.province ? `(${form.province})` : ""].filter(Boolean).join(" ");
    return [line1, line2].filter(Boolean).join(" · ");
  }, [form]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage("");
  }

  function validateDraft() {
    if (!config || invalidSelection) return "La ruta del expediente no es válida.";
    if (!availableCaseTypes.includes(form.case_type)) {
      return "El tipo de expediente no corresponde al área elegida.";
    }
    if (localRuntimeEnabled && !localProfileReady) return "Todavía no se ha confirmado el entorno local de pruebas.";
    if (authorizationFlow === "unavailable") return "La autorización de este servicio todavía no está disponible en este entorno.";
    if (form.full_name.trim().length < 3) return "Indica el nombre y apellidos.";
    if (normalizeDni(form.dni_nie).length < 5) return "Indica el DNI, NIE o pasaporte.";
    if (!validEmail(form.email)) return "Indica un email válido.";
    if (localProfileReady) {
      const localError = localSyntheticIdentityError({ dni: normalizeDni(form.dni_nie), email: form.email });
      if (localError) return localError;
    }
    if (form.telefono.trim().length < 6) return "Indica un teléfono.";
    if (!form.street.trim()) return "Indica la calle.";
    if (!form.street_number.trim()) return "Indica el número.";
    if (!form.postal_code.trim()) return "Indica el código postal.";
    if (!form.city.trim()) return "Indica la población.";
    if (!form.province.trim()) return "Indica la provincia.";
    if (!dniFront) return "Adjunta la parte frontal del documento de identidad.";
    if (!dniBack) return "Adjunta la parte posterior del documento de identidad.";
    if (dniFront.size > MAX_FILE_BYTES || dniBack.size > MAX_FILE_BYTES) return "Algún documento de identidad supera 8 MB.";
    if (form.customer_comment.trim().length < 15) return "Cuéntanos brevemente qué ha ocurrido.";
    if (!isVehicleRemoval && !isLocalGeneric && !form.representation_confirmed) {
      return "Confirma la generación de la autorización.";
    }
    if (!form.privacy_accepted) return "Acepta la política de privacidad.";
    return "";
  }

  async function createDraftAndDownload(event) {
    event.preventDefault();
    if (createRequestRef.current) return;
    const error = draftCaseRef.current ? "" : validateDraft();
    if (error) return setMessage(error);

    createRequestRef.current = true;
    setLoading(true);
    setMessage("");

    try {
      const completed = await continueIntakeAuthorization({
        draft: draftCaseRef.current,
        persistDraft: (saved) => {
          draftCaseRef.current = saved;
          setDraftCase(saved);
        },
        createDraft: async () => {
          const fd = new FormData();
          Object.entries({
            department,
            case_type: form.case_type,
            source_module: "rtm_web",
            public_service_family: selectedFamily?.id || "",
            full_name: form.full_name.trim(),
            dni_nie: normalizeDni(form.dni_nie),
            email: form.email.trim(),
            telefono: form.telefono.trim(),
            domicilio_notif: domicilio,
            street: form.street.trim(),
            street_number: form.street_number.trim(),
            floor: form.floor.trim(),
            door: form.door.trim(),
            postal_code: form.postal_code.trim(),
            city: form.city.trim(),
            province: form.province.trim(),
            preferred_contact: form.preferred_contact,
            customer_comment: selectedFamily
              ? `Área pública seleccionada: ${selectedFamily.title}\n\n${form.customer_comment.trim()}`
              : form.customer_comment.trim(),
            representation_confirmed: String(
              isVehicleRemoval || isLocalGeneric ? false : form.representation_confirmed
            ),
            prejudicial_counsel_requested: String(
              isVehicleRemoval || isLocalGeneric ? false : form.prejudicial_counsel_requested
            ),
            privacy_accepted: String(form.privacy_accepted),
          }).forEach(([key, value]) => fd.append(key, value));

          fd.append("dni_front", dniFront);
          fd.append("dni_back", dniBack);

          const data = await intakeJson("/cases/intake-draft", { method: "POST", body: fd });
          const caseId = normalizeCaseId(data?.case_id || data?.id);
          if (!caseId) throw new Error("El backend no devolvió el número del expediente.");
          let hasAccess = false;
          try { hasAccess = rememberCaseAccessToken(caseId, data?.case_access_token); } catch { /* Preserve the created reference below. */ }

          const fallbackNextPath = nextPathForCase(
            department,
            form.case_type,
            config.nextPath
          );
          const nextPath =
            safeInternalPath(data?.next_path, {
              allowedPathnames: [fallbackNextPath],
              pathOnly: true,
            }) || fallbackNextPath;

          const routes = isVehicleRemoval ? {} : authorizationRoutes(caseId, authorizationFlow);
          const blockedMessage = data.ok !== true
            ? "El servidor no confirmó correctamente el alta. Conservamos la referencia para evitar duplicados."
            : !hasAccess
              ? "El backend no devolvió la capacidad segura del expediente. Conservamos la referencia para evitar duplicados."
              : (localProfileReady || rehearsal) && data.test_mode !== true
                ? "El servidor no confirmó que el expediente sea sintético. No se ha solicitado ninguna autorización."
                : "";
          return { caseId, nextPath, pdfPath: routes.pdf, authorizationFlow, blockedMessage };
        },
        issueAuthorization: async (saved) => {
          const routes = authorizationRoutes(saved.caseId, saved.authorizationFlow);
          const authority = await intakeJson(routes.issue, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(routes.issueBody),
          });
          return saved.authorizationFlow === LOCAL_RTM_AUTHORIZATION_KIND
            ? parseLocalAuthorizationIssue(authority, saved.caseId)
            : parseAuthorizationIssueEnvelope(authority, saved.caseId);
        },
        openAuthorization: (saved) => intakeFile(saved.pdfPath, saved.caseId),
      });
      if (completed.authorizationFlow === "vehicle_removal") {
        navigate(`${completed.nextPath}?case=${encodeURIComponent(completed.caseId)}`);
        return;
      }
      setMessage(completed.authorizationFlow === LOCAL_RTM_AUTHORIZATION_KIND
        ? "✅ Expediente sintético creado. PDF de prueba preparado; se ha solicitado su descarga. No tiene validez ni acredita representación."
        : rehearsal?.renewal ? "✅ Autorización del mismo expediente actualizada. Descarga y sube el nuevo candidato con firma ficticia."
        : rehearsal ? "✅ Expediente de ensayo creado. Descarga el candidato con firma ficticia y súbelo en el paso siguiente."
        : "✅ Expediente creado. Se ha abierto la autorización para descargar y firmar.");
    } catch (error) {
      setMessage(error?.message || "No se pudo crear el expediente.");
    } finally {
      createRequestRef.current = false;
      setLoading(false);
    }
  }

  async function uploadAuthorization() {
    if (!draftCase?.caseId) return setMessage("Primero crea el expediente.");
    if (!draftCase.authorizationBinding) return setMessage("Primero hay que emitir el documento de autorización.");
    if (!signedAuthorization) return setMessage("Selecciona la autorización firmada.");
    if (signedAuthorization.type !== "application/pdf") return setMessage("La autorización firmada debe ser PDF.");
    if (signedAuthorization.size > MAX_FILE_BYTES) return setMessage("La autorización supera 8 MB.");

    setUploading(true);
    setMessage("");
    try {
      const fd = new FormData();
      fd.append("file", signedAuthorization);
      const localCandidate = draftCase.authorizationFlow === LOCAL_RTM_AUTHORIZATION_KIND;
      if (localCandidate) appendLocalAuthorizationBinding(fd, draftCase.authorizationBinding, draftCase.caseId);
      else appendAuthorizationDocumentBinding(fd, draftCase.authorizationBinding);
      const routes = authorizationRoutes(draftCase.caseId, draftCase.authorizationFlow);
      const result = await intakeJson(routes.candidate, { method: "POST", body: fd });
      if (localCandidate) parseLocalAuthorizationCandidate(result, draftCase.caseId);
      else parseAuthorizationCandidateEnvelope(result, draftCase.caseId);
      setAuthorizationUploaded(true);
      setMessage(localCandidate
        ? "✅ Documento de prueba recibido como candidato pendiente de revisión. No acredita una firma ni representación y no habilita pagos o presentaciones."
        : "✅ Documento recibido como candidato y pendiente de revisión humana. Puedes continuar aportando documentación; por sí solo no habilita pagos ni presentaciones que exijan apoderamiento verificado.");
    } catch (error) {
      setMessage(error?.message || "No se pudo subir la autorización.");
    } finally {
      setUploading(false);
    }
  }

  function continueToDocuments() {
    if (rehearsal) { rehearsal.onContinue(draftCase); return; }
    const separator = draftCase.nextPath.includes("?") ? "&" : "?";
    navigate(`${draftCase.nextPath}${separator}case=${encodeURIComponent(draftCase.caseId)}`);
  }

  if (invalidSelection) {
    return (
      <>
        <Seo
          title="Ruta de expediente no válida · RTM"
          description="La combinación solicitada no corresponde a un tipo de expediente RTM."
          canonical="https://www.recurretumulta.eu/iniciar-expediente"
          noindex
        />
        <main className="rtm-intake-invalid">
          <section>
            <span aria-hidden="true">🧭</span>
            <div className="rtm-intake-invalid-badge">Selección no reconocida</div>
            <h1>No hemos abierto un expediente equivocado</h1>
            <p>
              La dirección contiene un área o un tipo que RTM no reconoce. Por
              seguridad, no lo convertimos automáticamente en un expediente de tráfico.
            </p>
            <button type="button" onClick={() => navigate("/iniciar-expediente")}>
              Elegir una de las 9 áreas
            </button>
          </section>
        </main>
      </>
    );
  }

  if (needsServiceSelection) {
    const services = PUBLIC_SERVICE_FAMILIES;

    return (
      <>
        <Seo
          title="Iniciar expediente · RTM"
          description="Selecciona el área correspondiente e inicia tu expediente RTM."
          canonical="https://www.recurretumulta.eu/iniciar-expediente"
        />

        <main
          style={{
            minHeight: "calc(100vh - 120px)",
            padding: "54px 16px 76px",
            background:
              "linear-gradient(135deg,#0f172a 0%,#1e3a8a 56%,#0f766e 100%)",
          }}
        >
          <section
            style={{
              maxWidth: 1080,
              margin: "0 auto",
              padding: "36px 24px",
              borderRadius: 28,
              background: "rgba(255,255,255,.98)",
              boxShadow: "0 24px 70px rgba(15,23,42,.34)",
            }}
          >
            <header
              style={{
                maxWidth: 760,
                margin: "0 auto 30px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  marginBottom: 14,
                  padding: "7px 12px",
                  borderRadius: 999,
                  background: "#dbeafe",
                  color: "#1d4ed8",
                  fontWeight: 900,
                }}
              >
                Revisión Inicial del Expediente
              </div>

              <h1
                style={{
                  margin: "0 0 14px",
                  color: "#0f172a",
                  fontSize: "clamp(36px,5vw,54px)",
                  lineHeight: 1.04,
                  letterSpacing: "-.04em",
                }}
              >
                ¿Qué problema necesitas resolver?
              </h1>

              <p
                style={{
                  margin: 0,
                  color: "#64748b",
                  fontSize: 18,
                  lineHeight: 1.65,
                }}
              >
                Selecciona el área correspondiente. Te llevaremos al expediente
                disponible o, en Vivienda, a una consulta previa de encaje.
              </p>
            </header>

            <div
              className="rtm-intake-family-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
                gap: 17,
              }}
            >
              {services.map((service) => (
                <button
                  className="rtm-intake-family-card"
                  key={service.id}
                  type="button"
                  onClick={() => navigate(service.startPath)}
                  style={{
                    minHeight: 205,
                    padding: 24,
                    border: "1px solid #dbeafe",
                    borderRadius: 22,
                    background: "#fff",
                    color: "#0f172a",
                    textAlign: "left",
                    boxShadow: "0 14px 35px rgba(15,23,42,.07)",
                    cursor: "pointer",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: "grid",
                      width: 52,
                      height: 52,
                      placeItems: "center",
                      marginBottom: 17,
                      borderRadius: 16,
                      background: "#eff6ff",
                      fontSize: 27,
                    }}
                  >
                    {service.icon}
                  </span>

                  <strong
                    style={{
                      display: "block",
                      marginBottom: 9,
                      color: "#0c2f61",
                      fontSize: 21,
                    }}
                  >
                    {service.title}
                  </strong>

                  <span
                    style={{
                      display: "block",
                      color: "#64748b",
                      lineHeight: 1.55,
                    }}
                  >
                    {service.summary}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      marginTop: 14,
                      padding: "6px 9px",
                      borderRadius: 999,
                      background:
                        service.entryMode === "consultation" ? "#fff7ed" : "#ecfdf5",
                      color:
                        service.entryMode === "consultation" ? "#9a3412" : "#166534",
                      fontSize: 12,
                      fontWeight: 900,
                    }}
                  >
                    {service.entryMode === "consultation"
                      ? "Consulta de encaje"
                      : "Expediente disponible"}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <Seo
        title={`Iniciar expediente · ${config.label} · RTM`}
        description={
          isVehicleRemoval
            ? "Crea tu expediente RTM y continúa al flujo específico de retirada del vehículo."
            : "Crea tu expediente RTM y descarga la autorización."
        }
        canonical="https://www.recurretumulta.eu/iniciar-expediente"
      />

      <main style={{ minHeight: "calc(100vh - 120px)", padding: "42px 16px 68px", background: "linear-gradient(135deg,#0f172a 0%,#1e3a8a 56%,#0f766e 100%)" }}>
        <section style={{ maxWidth: 1040, margin: "0 auto", padding: "30px 22px", borderRadius: 26, background: "rgba(255,255,255,.98)", boxShadow: "0 24px 70px rgba(15,23,42,.34)" }}>
          <header style={{ marginBottom: 26 }}>
            <h1 style={{ margin: "0 0 12px", fontSize: "clamp(34px,5vw,50px)", lineHeight: 1.04 }}>{rehearsal?.renewal ? "Renovar autorización del ensayo" : "Inicia tu expediente"}</h1>
            <p style={{ margin: 0, color: "#475569", fontSize: 18, lineHeight: 1.6 }}>
              {isVehicleRemoval
                ? "Cuéntanos lo necesario para abrir el expediente. Después comprobarás el permiso de circulación y revisarás el consentimiento y la cotización específicos antes del pago."
                : rehearsal?.renewal ? "La notificación ya está recibida. Confirma las casillas para emitir una autorización actualizada, descarga el nuevo candidato ficticio y súbelo. Conservamos este mismo expediente y sus documentos."
                : rehearsal ? "Conserva los datos ficticios preparados. Después descarga y sube el candidato de autorización de prueba y continúa con la notificación."
                : "Cuéntanos lo necesario para abrir el expediente. Después descarga la autorización RTM, fírmala y continúa con la documentación."}
            </p>
            <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 14, background: "#eff6ff", color: "#1e3a8a", fontWeight: 800, lineHeight: 1.5 }}>
              {isVehicleRemoval
                ? "Un único expediente RTM · Datos → Verificación del vehículo → Consentimiento específico → Cotización → Pago"
                : rehearsal?.renewal ? "Documentación recibida → Autorización actualizada → Revisión personal → Pago de prueba"
                : "Un único expediente RTM · Datos → Autorización → Documentación → Revisión inicial → Valoración"}
            </div>
            {selectedFamily ? (
              <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 14, background: "#ecfdf5", color: "#166534", fontWeight: 900, lineHeight: 1.5 }}>
                {selectedFamily.icon} Área pública elegida: {selectedFamily.title}
              </div>
            ) : null}
          </header>

          {localRuntimeEnabled ? (
            <aside role="status" style={{ marginBottom: 22, padding: 16, borderRadius: 14, background: "#fffbeb", color: "#78350f", lineHeight: 1.6 }}>
              <strong>Entorno local de pruebas · solo datos y archivos ficticios.</strong>
              <p style={{ margin: "8px 0 0" }}>Utiliza el documento RTMTEST001 y un email terminado en @example.com. Los PDF de esta prueba no tienen validez ni acreditan representación.</p>
              {localProfileState === "checking" ? <p>Comprobando la configuración local…</p> : null}
              {localProfileState === "blocked" ? <p>No se ha podido confirmar la configuración local. El alta permanece cerrada.</p> : null}
            </aside>
          ) : null}
          {authorizationFlow === "unavailable" && (!localRuntimeEnabled || localProfileReady) ? (
            <p role="status" style={{ padding: 16, background: "#fff7ed", color: "#9a3412", borderRadius: 14 }}>
              La generación de autorización para este servicio todavía no está disponible en este entorno. No se creará un expediente con una autorización de otro servicio.
            </p>
          ) : null}

          <form onSubmit={createDraftAndDownload}>
            <Section title="1. Tipo de expediente">
              <select value={form.case_type} onChange={(e) => update("case_type", e.target.value)} style={inputStyle} disabled={Boolean(rehearsal) || Boolean(draftCase) || loading}>
                {availableCaseTypes.map((value) => (
                  <option key={value} value={value}>{config.caseTypes[value]}</option>
                ))}
              </select>
            </Section>

            <Section title="2. Datos personales">
              <div style={gridStyle}>
                <Field label="Nombre y apellidos" value={form.full_name} onChange={(v) => update("full_name", v)} placeholder="Nombre completo" disabled={Boolean(rehearsal) || Boolean(draftCase) || loading} />
                <Field label="DNI / NIE / Pasaporte" value={form.dni_nie} onChange={(v) => update("dni_nie", v)} placeholder="Ej. 12345678Z" disabled={Boolean(rehearsal) || Boolean(draftCase) || loading} />
                <Field label="Email" type="email" value={form.email} onChange={(v) => update("email", v)} placeholder="tu@email.com" disabled={Boolean(rehearsal) || Boolean(draftCase) || loading} />
                <Field label="Teléfono" value={form.telefono} onChange={(v) => update("telefono", v)} placeholder="Ej. 600 000 000" disabled={Boolean(rehearsal) || Boolean(draftCase) || loading} />
              </div>
              <div style={{ marginTop: 16 }}>
                <span style={labelStyle}>Preferencia de contacto</span>
                <select value={form.preferred_contact} onChange={(e) => update("preferred_contact", e.target.value)} style={inputStyle} disabled={Boolean(rehearsal) || Boolean(draftCase) || loading}>
                  <option value="email">Email</option><option value="phone">Teléfono</option><option value="whatsapp">WhatsApp</option>
                </select>
              </div>
            </Section>

            <Section title="3. Domicilio a efectos de notificaciones">
              <div style={gridStyle}>
                <Field label="Calle" value={form.street} onChange={(v) => update("street", v)} placeholder="Nombre de la vía" disabled={Boolean(rehearsal) || Boolean(draftCase) || loading} />
                <Field label="Número" value={form.street_number} onChange={(v) => update("street_number", v)} placeholder="Número" disabled={Boolean(rehearsal) || Boolean(draftCase) || loading} />
                <Field label="Piso" value={form.floor} onChange={(v) => update("floor", v)} placeholder="Opcional" disabled={Boolean(rehearsal) || Boolean(draftCase) || loading} />
                <Field label="Puerta" value={form.door} onChange={(v) => update("door", v)} placeholder="Opcional" disabled={Boolean(rehearsal) || Boolean(draftCase) || loading} />
                <Field label="Código postal" value={form.postal_code} onChange={(v) => update("postal_code", v)} placeholder="Código postal" disabled={Boolean(rehearsal) || Boolean(draftCase) || loading} />
                <Field label="Población" value={form.city} onChange={(v) => update("city", v)} placeholder="Población" disabled={Boolean(rehearsal) || Boolean(draftCase) || loading} />
                <Field label="Provincia" value={form.province} onChange={(v) => update("province", v)} placeholder="Provincia" disabled={Boolean(rehearsal) || Boolean(draftCase) || loading} />
              </div>
            </Section>

            <Section title="4. Documento de identidad">
              <p style={{ marginTop: 0, color: "#475569" }}>{rehearsal ? "Los dos PDF ficticios ya están preparados. Continúa con estos archivos." : "Imagen o PDF, máximo 8 MB por archivo."}{localProfileReady ? " Adjunta únicamente los documentos ficticios de la prueba." : ""}</p>
              <div style={gridStyle}>
                <UploadBox label="Parte frontal" file={dniFront} inputRef={dniFrontRef} onChange={setDniFront} disabled={Boolean(rehearsal) || Boolean(draftCase) || loading} />
                <UploadBox label="Parte posterior" file={dniBack} inputRef={dniBackRef} onChange={setDniBack} disabled={Boolean(rehearsal) || Boolean(draftCase) || loading} />
              </div>
            </Section>

            <Section title="5. Cuéntanos brevemente qué ha ocurrido">
              <textarea rows={7} maxLength={1500} value={form.customer_comment} onChange={(e) => update("customer_comment", e.target.value)} placeholder="Explica brevemente el problema..." style={{ ...inputStyle, resize: "vertical" }} disabled={Boolean(rehearsal) || Boolean(draftCase) || loading} />
            </Section>

            {!draftCase && <>
              {isVehicleRemoval ? (
                <div style={{ margin: "14px 0", padding: 16, border: "1px solid #bfdbfe", borderRadius: 15, background: "#eff6ff", color: "#1e3a5f", lineHeight: 1.55 }}>
                  Esta alta no genera ni solicita una autorización DGT genérica. El
                  consentimiento limitado a preparar la retirada se mostrará completo,
                  sin marcar, después de verificar el permiso de circulación y junto a
                  la cotización vigente.
                </div>
              ) : isLocalGeneric ? (
                <p style={{ padding: 16, borderRadius: 14, background: "#fffbeb", color: "#78350f" }}>
                  Se generará un documento genérico RTM marcado como prueba local. Esta operación no concede representación ni solicita una firma real.
                </p>
              ) : (
                <>
                  <Check disabled={loading} checked={form.representation_confirmed} onChange={(v) => update("representation_confirmed", v)}>{rehearsal ? "Confirmo que este ensayo utiliza únicamente datos ficticios y solicito el documento de prueba." : "Autorizo expresamente a RTM a representarme y gestionar únicamente este expediente conforme al documento de autorización."}</Check>
                  <div style={{ margin: "14px 0", padding: 16, border: "1px solid #bfdbfe", borderRadius: 15, background: "#eff6ff", color: "#1e3a5f" }}>
                    <Check disabled={loading || Boolean(rehearsal)} checked={form.prejudicial_counsel_requested} onChange={(v) => update("prejudicial_counsel_requested", v)}>
                      Quiero valorar una autorización separada y opcional para que un abogado pueda realizar reclamaciones prejudiciales por escrito en este expediente.
                    </Check>
                    <p style={{ margin: "6px 0 0", lineHeight: 1.55 }}>
                      Esta elección no autoriza todavía al abogado y no es necesaria para que RTM gestione el expediente. El Documento 2 se explicará y firmará aparte; no incluye aceptar acuerdos, renunciar a derechos, someterse a arbitraje, cobrar cantidades ni iniciar actuaciones judiciales. La mediación y cualquier fase judicial requieren un encargo específico.
                    </p>
                  </div>
                </>
              )}
              <Check disabled={loading} checked={form.privacy_accepted} onChange={(v) => update("privacy_accepted", v)}>Acepto la política de privacidad y confirmo que los datos son correctos.</Check>
              <button type="submit" disabled={loading || authorizationFlow === "unavailable" || (localRuntimeEnabled && !localProfileReady)} style={primaryButton}>
                {loading
                  ? (rehearsal?.renewal ? "Renovando autorización…" : "Creando expediente…")
                  : isVehicleRemoval
                    ? "Crear expediente y continuar"
                    : rehearsal?.renewal ? "Renovar autorización de prueba" : isLocalGeneric ? "Crear expediente de prueba y descargar documento" : "Crear expediente y descargar autorización"}
              </button>
            </>}
          </form>

          {draftCase && <Section title="6. Descargar y subir la autorización RTM">
            <div style={{ padding: 14, marginBottom: 16, borderRadius: 14, background: "#dcfce7", color: "#166534", fontWeight: 900, overflowWrap: "anywhere" }}>Expediente: {draftCase.caseId}</div>
            {!draftCase.authorizationBinding ? <>
              <p role="status">El expediente ya tiene referencia. La emisión del documento todavía no se ha completado; el reintento conserva este mismo expediente.</p>
              <button type="button" className="sr-btn-primary" onClick={createDraftAndDownload} disabled={loading || Boolean(draftCase.blockedMessage)}>{loading ? "Emitiendo documento…" : "Reintentar autorización"}</button>
            </> : <>
            <button type="button" className="sr-btn-primary" onClick={createDraftAndDownload} disabled={loading}>{loading ? "Descargando…" : isLocalGeneric ? "⬇ Descargar PDF de prueba RTM" : "⬇ Descargar autorización RTM"}</button>
            {rehearsal ? <button type="button" className="sr-btn-primary" style={{ marginTop: 16 }} onClick={() => intakeFile(`/cases/${draftCase.caseId}/candidate-fixture`).catch(error => setMessage(error.message))}>Descargar candidato con firma ficticia para subirlo en el ensayo</button> : null}
            <div style={{ marginTop: 18 }}>
              <UploadBox label={isLocalGeneric || rehearsal ? "PDF candidato de prueba · sin firma real" : "Autorización firmada"} file={signedAuthorization} inputRef={authRef} onChange={setSignedAuthorization} accept=".pdf,application/pdf" />
            </div>
            <button type="button" className="sr-btn-primary" onClick={uploadAuthorization} disabled={uploading || !signedAuthorization} style={{ marginTop: 16 }}>{uploading ? "Subiendo…" : isLocalGeneric || rehearsal ? "Subir candidato de prueba" : "Subir autorización firmada"}</button>
            {authorizationUploaded && <button type="button" className="sr-btn-primary" onClick={continueToDocuments} style={{ marginTop: 16, width: "100%" }}>{rehearsal?.renewal ? "Continuar a la revisión de autorización" : "Continuar y subir documentación (autorización pendiente de revisión)"}</button>}
            </>}
            {isLocalGeneric ? <button type="button" className="sr-btn-primary" onClick={() => navigate(`/ops/case/${encodeURIComponent(draftCase.caseId)}`)} style={{ marginTop: 16 }}>Ver expediente en OPS</button> : null}
          </Section>}

          {message && <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: message.startsWith("✅") ? "#ecfdf5" : "#fef2f2", color: message.startsWith("✅") ? "#166534" : "#991b1b", fontWeight: 850 }}>{message}</div>}
        </section>
      </main>
    </>
  );
}

function Section({ title, children }) {
  return <section style={{ marginBottom: 22, padding: 22, border: "1px solid #e2e8f0", borderRadius: 20, background: "#fff" }}><h2 style={{ margin: "0 0 16px", fontSize: 23 }}>{title}</h2>{children}</section>;
}

function Field({ label, value, onChange, placeholder, type = "text", disabled = false }) {
  return <label style={{ display: "block" }}><span style={labelStyle}>{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} disabled={disabled} /></label>;
}

function UploadBox({ label, file, inputRef, onChange, accept = "image/*,application/pdf", disabled = false }) {
  return <div><span style={labelStyle}>{label}</span><button type="button" onClick={() => !disabled && inputRef.current?.click()} disabled={disabled} style={{ width: "100%", minHeight: 118, padding: 16, border: "2px dashed #cbd5e1", borderRadius: 16, background: file ? "#f0fdf4" : "#f8fafc", cursor: disabled ? "not-allowed" : "pointer" }}><div style={{ fontSize: 30 }}>{file ? "✅" : "📷"}</div><strong>{file ? file.name : "Seleccionar archivo"}</strong>{file && <div style={{ color: "#64748b", fontSize: 13 }}>{formatBytes(file.size)}</div>}</button><input ref={inputRef} type="file" accept={accept} onChange={(e) => onChange(e.target.files?.[0] || null)} style={{ display: "none" }} disabled={disabled} /></div>;
}

function Check({ checked, onChange, children, disabled = false }) {
  return <label style={{ display: "flex", gap: 10, marginBottom: 12, color: "#334155" }}><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /><span>{children}</span></label>;
}

const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 };
const labelStyle = { display: "block", marginBottom: 7, fontWeight: 850, color: "#0f172a" };
const inputStyle = { width: "100%", boxSizing: "border-box", padding: "12px 13px", border: "1px solid #cbd5e1", borderRadius: 13, background: "#fff", fontSize: 15 };
const primaryButton = { width: "100%", minHeight: 56, border: 0, borderRadius: 15, padding: "15px 18px", background: "#16a34a", color: "#fff", fontSize: 17, fontWeight: 950, cursor: "pointer" };
