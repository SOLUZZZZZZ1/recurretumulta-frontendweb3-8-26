import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  apiFetch,
  openCaseFile,
  requireSameOriginApiUrl,
  RTM_API_CANDIDATES,
} from "../lib/api.js";
import { getCaseScopedData } from "../lib/caseSession.js";
import {
  buildAuthorizationForm,
  createCaseRequestGuard,
  EMPTY_AUTHORIZATION_FORM,
} from "../lib/authorizationCase.js";
import {
  appendAuthorizationDocumentBinding,
  isVehicleRemovalCase,
  parseAuthorizationCandidateEnvelope,
  parseAuthorizationIssueEnvelope,
} from "../lib/authorizationEvidence.js";

function getCaseId(search) {
  const qs = new URLSearchParams(search);
  return qs.get("case") || qs.get("case_id") || qs.get("id") || "";
}

function buildUrl(base, path) {
  const cleanBase = String(base || "").replace(/\/$/, "");
  return `${cleanBase}${path}`;
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
    const detail = data?.detail || data?.message || text || `HTTP ${response.status}`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }

  return data;
}

async function fetchJsonFallback(path, options = {}) {
  const errors = [];

  for (const base of RTM_API_CANDIDATES) {
    const url = buildUrl(base, path);

    try {
      const response = await apiFetch(url, options);
      return await readResponse(response);
    } catch (e) {
      if (options.signal?.aborted || e?.name === "AbortError") throw e;
      errors.push(`${url} → ${e?.message || "Failed to fetch"}`);
    }
  }

  throw new Error(errors.join(" | "));
}

function openPdf(pathOrUrl, caseId, signal) {
  const url = requireSameOriginApiUrl(pathOrUrl);
  return openCaseFile(url, caseId, { signal });
}

function unwrapExtracted(value) {
  if (!value) return {};
  return value?.extracted?.extracted || value?.extracted || value || {};
}

export default function Autorizar() {
  const location = useLocation();
  const navigate = useNavigate();
  const caseId = useMemo(() => getCaseId(location.search), [location.search]);

  const [stateCaseId, setStateCaseId] = useState(caseId);
  const [form, setForm] = useState(() => ({ ...EMPTY_AUTHORIZATION_FORM }));

  const [checks, setChecks] = useState({
    autorizo_gestion: false,
    acepto_responsabilidad: false,
  });

  const [caseData, setCaseData] = useState(null);
  const [signedFile, setSignedFile] = useState(null);
  const [generated, setGenerated] = useState(false);
  const [authorizationBinding, setAuthorizationBinding] = useState(null);
  const [msg, setMsg] = useState("");
  const [debug, setDebug] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingCase, setLoadingCase] = useState(true);
  const loadGuardRef = useRef(null);
  const mutationAbortRef = useRef(null);
  const mutationPendingRef = useRef(false);
  const navigationTimerRef = useRef(null);
  const signedFileInputRef = useRef(null);
  const currentCaseIdRef = useRef(caseId);
  currentCaseIdRef.current = caseId;
  if (!loadGuardRef.current) loadGuardRef.current = createCaseRequestGuard();

  const caseStateIsCurrent = stateCaseId === caseId;
  const visibleForm = caseStateIsCurrent ? form : EMPTY_AUTHORIZATION_FORM;
  const visibleChecks = caseStateIsCurrent
    ? checks
    : { autorizo_gestion: false, acepto_responsabilidad: false };
  const visibleCaseData = caseStateIsCurrent ? caseData : null;
  const visibleSignedFile = caseStateIsCurrent ? signedFile : null;
  const visibleGenerated = caseStateIsCurrent && generated;
  const visibleAuthorizationBinding = caseStateIsCurrent
    ? authorizationBinding
    : null;
  const visibleMsg = caseStateIsCurrent ? msg : "";
  const visibleDebug = caseStateIsCurrent ? debug : "";

  useEffect(() => {
    const request = loadGuardRef.current.begin(caseId);
    mutationAbortRef.current?.abort();
    mutationAbortRef.current = null;
    mutationPendingRef.current = false;
    if (navigationTimerRef.current) {
      window.clearTimeout(navigationTimerRef.current);
      navigationTimerRef.current = null;
    }
    setStateCaseId(caseId);
    setForm({ ...EMPTY_AUTHORIZATION_FORM });
    setChecks({ autorizo_gestion: false, acepto_responsabilidad: false });
    setCaseData(null);
    setSignedFile(null);
    if (signedFileInputRef.current) signedFileInputRef.current.value = "";
    setGenerated(false);
    setAuthorizationBinding(null);
    setLoading(false);
    setMsg("");
    setDebug("");

    async function loadCase() {
      if (!caseId) {
        setLoadingCase(false);
        return;
      }

      setLoadingCase(true);
      setMsg("");
      setDebug("");

      try {
        const status = await fetchJsonFallback(`/cases/${caseId}/public-status`, {
          signal: request.controller.signal,
        });
        if (!request.isCurrent()) return;
        if (isVehicleRemovalCase(status)) {
          navigate(`/eliminar-coche?case=${encodeURIComponent(caseId)}`, {
            replace: true,
          });
          return;
        }
        setCaseData(status);

        const localExtracted = getCaseScopedData(caseId)?.case_data || {};
        setForm(buildAuthorizationForm(status, localExtracted));
      } catch (e) {
        if (e?.name === "AbortError" || !request.isCurrent()) return;
        setMsg("❌ No se pudieron cargar los datos del expediente.");
        setDebug(e?.message || "");
      } finally {
        if (request.isCurrent()) setLoadingCase(false);
      }
    }

    loadCase();
    return () => request.controller.abort();
  }, [caseId]);

  useEffect(() => () => {
    loadGuardRef.current?.cancel();
    mutationAbortRef.current?.abort();
    mutationAbortRef.current = null;
    mutationPendingRef.current = false;
    if (navigationTimerRef.current) {
      window.clearTimeout(navigationTimerRef.current);
      navigationTimerRef.current = null;
    }
  }, []);

  function invalidateGeneratedArtifact() {
    setGenerated(false);
    setAuthorizationBinding(null);
    setSignedFile(null);
    if (signedFileInputRef.current) signedFileInputRef.current.value = "";
  }

  function resetAcceptanceAndGeneratedArtifact() {
    setChecks({ autorizo_gestion: false, acepto_responsabilidad: false });
    invalidateGeneratedArtifact();
  }

  function update(field, value) {
    if (!caseStateIsCurrent || loading) return;
    setForm((prev) => ({ ...prev, [field]: value }));
    resetAcceptanceAndGeneratedArtifact();
    setMsg("");
    setDebug("");
  }

  function validateDetails() {
    if (!caseId) return "No se ha encontrado el expediente.";
    if (!caseStateIsCurrent || loadingCase) return "Espera a que se cargue este expediente.";
    if (!visibleForm.full_name.trim()) return "Indica nombre y apellidos.";
    if (!visibleForm.dni_nie.trim()) return "Indica DNI/NIE.";
    if (!visibleForm.matricula.trim()) return "Indica la matrícula del vehículo.";
    if (!visibleForm.domicilio_notif.trim()) return "Indica domicilio de notificaciones.";
    if (!visibleChecks.autorizo_gestion) return "Debes marcar la autorización de gestión.";
    if (!visibleChecks.acepto_responsabilidad) return "Debes confirmar que los datos son correctos.";
    if (!visibleForm.email.trim()) return "Indica email.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(visibleForm.email.trim())) return "Indica un email válido.";
    return "";
  }

  async function saveDetailsAndDownloadPdf() {
    setMsg("");
    setDebug("");

    const error = validateDetails();
    if (error) {
      setMsg(`❌ ${error}`);
      return;
    }
    if (mutationPendingRef.current) return;

    const targetCaseId = caseId;
    const formSnapshot = { ...visibleForm };
    const checksSnapshot = { ...visibleChecks };
    const controller = new AbortController();
    mutationPendingRef.current = true;
    mutationAbortRef.current = controller;
    setLoading(true);

    try {
      await fetchJsonFallback(`/cases/${targetCaseId}/details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          full_name: formSnapshot.full_name.trim(),
          dni_nie: formSnapshot.dni_nie.trim().toUpperCase(),
          matricula: formSnapshot.matricula.trim().toUpperCase(),
          domicilio_notif: formSnapshot.domicilio_notif.trim(),
          autorizo_gestion: checksSnapshot.autorizo_gestion,
          acepto_responsabilidad: checksSnapshot.acepto_responsabilidad,
          email: formSnapshot.email.trim(),
          telefono: formSnapshot.telefono.trim() || null,
        }),
      });
      if (controller.signal.aborted || currentCaseIdRef.current !== targetCaseId) return;

      const auth = await fetchJsonFallback(`/cases/${targetCaseId}/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          authority_version: "v1_dgt_homologado",
          consent: true,
          representation_confirmed: true,
        }),
      });
      if (controller.signal.aborted || currentCaseIdRef.current !== targetCaseId) return;
      const issued = parseAuthorizationIssueEnvelope(auth, targetCaseId);
      const pdfUrl = requireSameOriginApiUrl(
        `/api/cases/${encodeURIComponent(targetCaseId)}/authorization-pdf`
      );

      setAuthorizationBinding(issued.binding);
      setGenerated(true);
      setMsg("✅ Datos guardados. Se ha abierto la autorización para descargar, firmar y volver a subir.");
      await openPdf(pdfUrl, targetCaseId, controller.signal);
    } catch (e) {
      if (e?.name === "AbortError" || controller.signal.aborted) return;
      setMsg("❌ No se pudo generar la autorización.");
      setDebug(e?.message || "");
    } finally {
      if (mutationAbortRef.current === controller) {
        mutationAbortRef.current = null;
        mutationPendingRef.current = false;
        setLoading(false);
      }
    }
  }

  async function uploadSignedAuthorization() {
    setMsg("");
    setDebug("");

    if (!caseStateIsCurrent || loadingCase) {
      setMsg("❌ Espera a que se cargue este expediente.");
      return;
    }
    if (!visibleGenerated) {
      setMsg("❌ Regenera la autorización con los datos actuales antes de subirla.");
      return;
    }
    if (!visibleAuthorizationBinding) {
      setMsg("❌ Falta la ligadura segura del documento generado.");
      return;
    }
    if (!visibleSignedFile) {
      setMsg("❌ Selecciona la autorización firmada antes de subirla.");
      return;
    }
    if (visibleSignedFile.type !== "application/pdf") {
      setMsg("❌ La autorización firmada debe ser un PDF.");
      return;
    }
    if (mutationPendingRef.current) return;

    const targetCaseId = caseId;
    const fileSnapshot = visibleSignedFile;
    const controller = new AbortController();
    mutationPendingRef.current = true;
    mutationAbortRef.current = controller;
    setLoading(true);

    try {
      const fd = new FormData();
      fd.append("file", fileSnapshot);
      appendAuthorizationDocumentBinding(fd, visibleAuthorizationBinding);

      const result = await fetchJsonFallback(`/cases/${targetCaseId}/upload-authorization-signed`, {
        method: "POST",
        body: fd,
        signal: controller.signal,
      });
      if (controller.signal.aborted || currentCaseIdRef.current !== targetCaseId) return;
      parseAuthorizationCandidateEnvelope(result, targetCaseId);

      setSignedFile(null);
      if (signedFileInputRef.current) signedFileInputRef.current.value = "";
      setMsg("✅ Documento recibido como candidato. Queda pendiente de revisión humana antes de habilitar cualquier pago o presentación.");
    } catch (e) {
      if (e?.name === "AbortError" || controller.signal.aborted) return;
      setMsg("❌ No se pudo subir la autorización firmada.");
      setDebug(e?.message || "");
    } finally {
      if (mutationAbortRef.current === controller) {
        mutationAbortRef.current = null;
        mutationPendingRef.current = false;
        setLoading(false);
      }
    }
  }

  const extracted = unwrapExtracted(visibleCaseData?.extracted || {});
  const organismo = visibleCaseData?.organismo || extracted?.organismo || extracted?.organismo_cabecera || "";
  const expediente = visibleCaseData?.expediente_ref || extracted?.expediente_ref || extracted?.numero_expediente || "";

  return (
    <main className="sr-page">
      <section className="sr-section">
        <div className="sr-card" style={{ maxWidth: 900, margin: "0 auto" }}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="sr-kicker">Autorización previa al pago</p>
              <h1 className="sr-h1">Autorizar la gestión del expediente</h1>
              <p className="sr-p" style={{ marginBottom: 0 }}>
                Completa los datos, descarga la autorización, fírmala y súbela para poder continuar.
              </p>
            </div>

            <button
              type="button"
              className="sr-btn-secondary"
              onClick={() => navigate(`/resumen?case=${encodeURIComponent(caseId)}`)}
            >
              ← Volver
            </button>
          </div>

          <div
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
            }}
          >
            <Info label="Expediente interno" value={caseId} />
            <Info label="Organismo" value={organismo || "Pendiente de revisar"} />
            <Info label="Expediente sancionador" value={expediente || "Pendiente de revisar"} />
          </div>

          {!caseStateIsCurrent || loadingCase ? (
            <div className="sr-card" style={{ marginTop: 16 }}>
              Cargando datos del expediente…
            </div>
          ) : null}

          <div className="sr-card" style={{ marginTop: 18 }}>
            <h2 className="sr-h2" style={{ marginTop: 0 }}>
              Paso 1 · Datos del interesado
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 12,
              }}
            >
              <Field label="Nombre y apellidos" value={visibleForm.full_name} onChange={(v) => update("full_name", v)} disabled={!caseStateIsCurrent || loadingCase || loading} />
              <Field label="DNI/NIE/Pasaporte" value={visibleForm.dni_nie} onChange={(v) => update("dni_nie", v)} disabled={!caseStateIsCurrent || loadingCase || loading} />
              <Field label="Matrícula" value={visibleForm.matricula} onChange={(v) => update("matricula", v.toUpperCase())} disabled={!caseStateIsCurrent || loadingCase || loading} />
              <Field label="Email" value={visibleForm.email} onChange={(v) => update("email", v)} type="email" disabled={!caseStateIsCurrent || loadingCase || loading} />
              <Field label="Teléfono" value={visibleForm.telefono} onChange={(v) => update("telefono", v)} disabled={!caseStateIsCurrent || loadingCase || loading} />
            </div>

            <label style={{ display: "block", marginTop: 12 }}>
              <span style={labelStyle}>Domicilio a efectos de notificaciones</span>
              <textarea
                value={visibleForm.domicilio_notif}
                onChange={(e) => update("domicilio_notif", e.target.value)}
                disabled={!caseStateIsCurrent || loadingCase || loading}
                placeholder="Calle, número, piso, CP, ciudad"
                rows={3}
                style={inputStyle}
              />
            </label>

            <div
              style={{
                marginTop: 14,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 14,
                padding: 14,
                color: "#334155",
                lineHeight: 1.55,
              }}
            >
              Yo, {visibleForm.full_name || "el/la interesado/a"}, autorizo a LA TALAMANQUINA, S.L.
              (RecurreTuMulta) a actuar en mi nombre para la tramitación administrativa
              del expediente asociado a este proceso, incluyendo la preparación y presentación
              de alegaciones y/o recursos ante la DGT u organismo competente.
            </div>


            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              <CheckRow
                checked={visibleChecks.autorizo_gestion}
                disabled={!caseStateIsCurrent || loadingCase || loading}
                onChange={(value) => {
                  if (!caseStateIsCurrent || loading) return;
                  invalidateGeneratedArtifact();
                  setChecks((prev) => ({ ...prev, autorizo_gestion: value }));
                  setMsg("");
                  setDebug("");
                }}
              >
                Autorizo expresamente a LA TALAMANQUINA, S.L. (RecurreTuMulta) a gestionar este expediente en mi nombre ante la Administración u organismo competente.
              </CheckRow>

              <CheckRow
                checked={visibleChecks.acepto_responsabilidad}
                disabled={!caseStateIsCurrent || loadingCase || loading}
                onChange={(value) => {
                  if (!caseStateIsCurrent || loading) return;
                  invalidateGeneratedArtifact();
                  setChecks((prev) => ({ ...prev, acepto_responsabilidad: value }));
                  setMsg("");
                  setDebug("");
                }}
              >
                Confirmo que los datos introducidos son correctos y que dispongo de legitimación para solicitar esta gestión.
              </CheckRow>
            </div>

            <div
              style={{
                marginTop: 18,
                background: "#fffbeb",
                border: "1px solid #f59e0b",
                borderRadius: 14,
                padding: 16,
                color: "#92400e",
                lineHeight: 1.6,
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 8 }}>
                ⚠ IMPORTANTE
              </div>

              <div>
                En la mayoría de multas de tráfico, si decides presentar alegaciones o recursos administrativos perderás el derecho al descuento del 50% por pronto pago.
              </div>

              <div style={{ marginTop: 10 }}>
                Si pagas la multa con reducción, normalmente renuncias a continuar el procedimiento administrativo de recurso.
              </div>

              <div style={{ marginTop: 10, fontWeight: 800 }}>
                Antes de continuar, valora qué opción prefieres:
              </div>

              <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                <li>Pago reducido inmediato</li>
                <li>Recurso y defensa del expediente</li>
              </ul>
            </div>


            <div className="sr-cta-row" style={{ marginTop: 16, justifyContent: "flex-start" }}>
              <button
                type="button"
                className="sr-btn-primary"
                onClick={saveDetailsAndDownloadPdf}
                disabled={loading || loadingCase || !caseStateIsCurrent}
              >
                {loading ? "Generando…" : "Guardar datos y descargar autorización"}
              </button>
            </div>
          </div>

          <div className="sr-card" style={{ marginTop: 18 }}>
            <h2 className="sr-h2" style={{ marginTop: 0 }}>
              Paso 2 · Subir autorización firmada
            </h2>

            <p className="sr-p">
              Firma el PDF descargado y súbelo aquí. El documento quedará pendiente
              de revisión humana y no habilita por sí solo el pago ni la presentación.
            </p>

            {!visibleGenerated ? (
              <div
                style={{
                  background: "#fff7ed",
                  color: "#9a3412",
                  border: "1px solid #fed7aa",
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 12,
                  fontWeight: 800,
                }}
              >
                Primero guarda los datos y descarga la autorización.
              </div>
            ) : null}

            <input
              ref={signedFileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => {
                if (!caseStateIsCurrent || loadingCase) return;
                setSignedFile(e.target.files?.[0] || null);
                setMsg("");
                setDebug("");
              }}
              style={inputStyle}
              disabled={!caseStateIsCurrent || loadingCase || loading}
            />

            {visibleSignedFile ? (
              <p className="sr-small" style={{ marginTop: 8, color: "#475569" }}>
                Archivo seleccionado: {visibleSignedFile.name}
              </p>
            ) : null}

            <div className="sr-cta-row" style={{ marginTop: 16, justifyContent: "flex-start" }}>
              <button
                type="button"
                className="sr-btn-primary"
                onClick={uploadSignedAuthorization}
                disabled={loading || loadingCase || !caseStateIsCurrent || !visibleSignedFile}
              >
                {loading ? "Subiendo…" : "Subir autorización firmada"}
              </button>
            </div>
          </div>

          {visibleMsg ? (
            <div
              style={{
                marginTop: 16,
                color: visibleMsg.startsWith("✅") ? "#166534" : "#991b1b",
                background: visibleMsg.startsWith("✅") ? "#ecfdf5" : "#fef2f2",
                border: visibleMsg.startsWith("✅") ? "1px solid #bbf7d0" : "1px solid #fecaca",
                borderRadius: 14,
                padding: 14,
                fontWeight: 900,
              }}
            >
              {visibleMsg}
            </div>
          ) : null}

          {visibleDebug ? (
            <div
              style={{
                marginTop: 10,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 10,
                color: "#475569",
                fontSize: 12,
                wordBreak: "break-word",
              }}
            >
              Detalle técnico: {visibleDebug}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function CheckRow({ checked, onChange, children, disabled = false }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: 12,
        color: "#334155",
        fontWeight: 700,
        lineHeight: 1.45,
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 3, width: 18, height: 18, flex: "0 0 auto" }}
      />
      <span>{children}</span>
    </label>
  );
}

function Info({ label, value }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div className="sr-small" style={{ color: "#64748b", fontWeight: 800 }}>
        {label}
      </div>
      <div style={{ marginTop: 4, fontWeight: 900, color: "#0f172a", wordBreak: "break-word" }}>
        {value || "—"}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", disabled = false }) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </label>
  );
}

const labelStyle = {
  display: "block",
  fontWeight: 900,
  color: "#0f172a",
  marginBottom: 6,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "11px 12px",
  fontSize: 15,
  background: "#fff",
};
