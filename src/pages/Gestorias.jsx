import React, { useCallback, useRef, useState, useEffect } from "react";
import Seo from "../components/Seo.jsx";
import { useNavigate } from "react-router-dom";
import {
  clearPartnerSession,
  getPartnerSessionValue,
  hasPartnerSessionHint,
  parsePartnerLoginEnvelope,
  parsePartnerSessionEnvelope,
  partnerSessionRemainingMs,
  setPartnerSessionValue,
} from "../lib/partnerSession.js";
import {
  bindPartnerCookieSession,
  clearPartnerCookieSessionBinding,
  partnerFetch,
  readJsonResponseLimited,
  readPartnerCsrfToken,
} from "../lib/partnerApi.js";
import {
  announcePartnerSessionChange,
  bindPartnerCrossTabSession,
  bindPartnerViewLifecycle,
} from "../lib/partnerViewLifecycle.js";

const API = "/api";
const PARTNER_JSON_MAX_BYTES = 64 * 1024;

async function fetchJson(url, options = {}, security = {}) {
  const r = await partnerFetch(url, options, security);
  const data = await readJsonResponseLimited(r, PARTNER_JSON_MAX_BYTES).catch(
    () => ({})
  );
  if (!r.ok) {
    const error = new Error(data?.detail || "Error API");
    error.status = r.status;
    throw error;
  }

  // El backend puede mantener temporalmente campos Bearer por compatibilidad
  // con clientes de API. La web nunca los conserva ni los propaga.
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const safeData = { ...data };
  delete safeData.token;
  delete safeData.api_token;
  delete safeData.csrf_token;
  return safeData;
}

const inputStyle = {
  padding: "12px 14px",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  width: "100%",
  background: "#fff",
};

export default function Gestorias() {
  const nav = useNavigate();

  const [authenticated, setAuthenticated] = useState(false);
  const [sessionValidated, setSessionValidated] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(() => hasPartnerSessionHint());
  const [viewVisible, setViewVisible] = useState(() => !hasPartnerSessionHint());
  const [partnerName, setPartnerName] = useState(() => getPartnerSessionValue("partner_name"));
  const authed = authenticated && sessionValidated;

  const mustChange = getPartnerSessionValue("partner_must_change") === "1";

  const [email, setEmail] = useState(() => getPartnerSessionValue("partner_email"));
  const [password, setPassword] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [logging, setLogging] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const inputRef = useRef(null);
  const authInputRef = useRef(null);
  const authGenerationRef = useRef(0);
  const submissionAbortRef = useRef(null);
  const sensitiveViewRef = useRef(null);

  const [clientEmail, setClientEmail] = useState("");
  const [clientName, setClientName] = useState("");

  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");
  const [domicilio, setDomicilio] = useState("");
  const [localidad, setLocalidad] = useState("");

  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [files, setFiles] = useState([]);
  const [authorizationFile, setAuthorizationFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (mustChange) nav("/partner/change-password");
  }, [mustChange, nav]);

  const clearSubmissionData = useCallback(() => {
    submissionAbortRef.current?.abort();
    submissionAbortRef.current = null;
    setClientEmail("");
    setClientName("");
    setNombre("");
    setDni("");
    setDomicilio("");
    setLocalidad("");
    setNote("");
    setConfirm(false);
    setFiles([]);
    setAuthorizationFile(null);
    setSending(false);
    setMsg("");
    setErr("");
    if (inputRef.current) inputRef.current.value = "";
    if (authInputRef.current) authInputRef.current.value = "";
  }, []);

  const invalidateSensitiveView = useCallback(() => {
    authGenerationRef.current += 1;
    if (sensitiveViewRef.current) sensitiveViewRef.current.hidden = true;
    setViewVisible(false);
    clearSubmissionData();
    setAuthenticated(false);
    setSessionValidated(false);
    setPartnerName("");
    setEmail("");
    setPassword("");
  }, [clearSubmissionData]);

  const clearLocalSession = useCallback(() => {
    invalidateSensitiveView();
    clearPartnerCookieSessionBinding();
    clearPartnerSession();
    setEmail("");
    setPassword("");
    setLoginErr("");
    setLogging(false);
    setLoggingOut(false);
    setSessionChecking(false);
    setViewVisible(true);
  }, [invalidateSensitiveView]);

  const revalidateSession = useCallback(async () => {
    invalidateSensitiveView();
    if (!hasPartnerSessionHint()) {
      clearLocalSession();
      return;
    }

    const generation = ++authGenerationRef.current;
    setSessionChecking(true);
    try {
      const csrfBefore = readPartnerCsrfToken();
      if (!csrfBefore) throw new Error("Falta la protección de la sesión partner.");
      const probe = parsePartnerSessionEnvelope(
        await fetchJson(`${API}/partner/session`)
      );
      if (generation !== authGenerationRef.current) return;
      if (csrfBefore !== readPartnerCsrfToken()) {
        throw new Error("La sesión partner ha cambiado en otra ventana.");
      }
      bindPartnerCookieSession(csrfBefore);
      setPartnerSessionValue("partner_authenticated", "1");
      setPartnerSessionValue("partner_must_change", "0");
      setPartnerSessionValue("partner_expires_at", probe.expiresAt);
      setPartnerSessionValue("partner_name", probe.partnerName);
      setPartnerName(probe.partnerName);
      setAuthenticated(true);
      setSessionValidated(true);
      setViewVisible(true);
    } catch (error) {
      if (generation !== authGenerationRef.current) return;
      clearLocalSession();
      setLoginErr(
        error?.status === 401 || error?.status === 403
          ? "La sesión ha caducado. Vuelve a iniciar sesión."
          : "No se pudo verificar la sesión de forma segura."
      );
    } finally {
      if (generation === authGenerationRef.current) setSessionChecking(false);
    }
  }, [clearLocalSession, invalidateSensitiveView]);

  useEffect(() => {
    const unbind = bindPartnerViewLifecycle(window, document, {
      invalidate: invalidateSensitiveView,
      revalidate: revalidateSession,
    });
    const unbindCrossTab = bindPartnerCrossTabSession(window, () => {
      clearLocalSession();
      setLoginErr("La sesión cambió en otra ventana. Vuelve a identificarte.");
    });
    if (hasPartnerSessionHint()) revalidateSession();
    else {
      setSessionChecking(false);
      setViewVisible(true);
    }
    return () => {
      unbind();
      unbindCrossTab();
      invalidateSensitiveView();
    };
  }, [invalidateSensitiveView, revalidateSession]);

  useEffect(() => {
    if (!authed) return undefined;
    const remainingMs = partnerSessionRemainingMs();
    if (remainingMs <= 0) {
      clearLocalSession();
      return undefined;
    }
    const expirationTimer = window.setTimeout(
      clearLocalSession,
      Math.min(remainingMs, 2_147_483_647)
    );
    return () => window.clearTimeout(expirationTimer);
  }, [authed, clearLocalSession]);

  async function logout() {
    invalidateSensitiveView();
    setSessionChecking(true);
    setErr("");
    setLoggingOut(true);
    try {
      await fetchJson(
        `${API}/partner/logout`,
        { method: "POST" },
        { requireCsrf: true }
      );
      clearLocalSession();
      announcePartnerSessionChange();
    } catch (e) {
      if (e?.status === 401) {
        clearLocalSession();
        announcePartnerSessionChange();
        return;
      }
      clearLocalSession();
      announcePartnerSessionChange();
      setLoginErr(
        "No se pudo confirmar la revocación remota. La vista local se ha cerrado; vuelve a identificarte."
      );
    } finally {
      setLoggingOut(false);
    }
  }

  function updateSubmissionField(setter, value) {
    setter(value);
    setConfirm(false);
    setMsg("");
    setErr("");
  }

  async function login() {
    const generation = ++authGenerationRef.current;
    setLoginErr("");
    setLogging(true);
    try {
      const data = await fetchJson(`${API}/partner/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (generation !== authGenerationRef.current) return;
      let session;
      try {
        session = parsePartnerLoginEnvelope(data);
      } catch {
        await fetchJson(
          `${API}/partner/logout`,
          { method: "POST" },
          { requireCsrf: true }
        ).catch(() => {});
        clearLocalSession();
        setLoginErr("El servidor no confirmó una sesión vigente.");
        return;
      }

      setPartnerSessionValue("partner_email", email.trim().toLowerCase());

      if (session.mustChangePassword) {
        clearPartnerCookieSessionBinding();
        setPartnerSessionValue("partner_authenticated", "0");
        setPartnerSessionValue("partner_expires_at", "");
        setPartnerSessionValue("partner_must_change", "1");
        setPartnerSessionValue("partner_name", session.partnerName);
        setPassword("");
        announcePartnerSessionChange();
        nav("/partner/change-password");
        return;
      }

      bindPartnerCookieSession();

      setPartnerSessionValue("partner_must_change", "0");
      setPartnerSessionValue("partner_authenticated", "1");
      setPartnerSessionValue("partner_expires_at", session.expiresAt);
      setPartnerSessionValue("partner_name", session.partnerName);
      setAuthenticated(true);
      setSessionValidated(true);
      setSessionChecking(false);
      setViewVisible(true);
      setPartnerName(session.partnerName);
      setPassword("");
      announcePartnerSessionChange();
    } catch (e) {
      if (generation === authGenerationRef.current) {
        setLoginErr(e.message || "No se pudo iniciar sesión");
      }
    } finally {
      if (generation === authGenerationRef.current) setLogging(false);
    }
  }

  function pickFiles() {
    inputRef.current?.click();
  }

  function pickAuthorizationFile() {
    authInputRef.current?.click();
  }

  function onFilesSelected(list) {
    const arr = Array.from(list || []).slice(0, 5);
    setFiles(arr);
    setConfirm(false);
    setMsg("");
    setErr("");
  }

  function onAuthorizationSelected(list) {
    const picked = Array.from(list || [])[0] || null;
    setAuthorizationFile(picked);
    setConfirm(false);
    setMsg("");
    setErr("");
  }

  async function submitCase() {
    setMsg("");
    setErr("");

    if (!clientEmail.trim()) return setErr("Email del cliente obligatorio.");
    if (!clientName.trim()) return setErr("Nombre del cliente obligatorio.");
    if (!nombre.trim()) return setErr("Nombre del interesado obligatorio.");
    if (!dni.trim()) return setErr("DNI/NIE del interesado obligatorio.");
    if (!files.length) return setErr("Sube al menos un documento del expediente.");
    if (!authorizationFile) return setErr("Debes adjuntar la autorización firmada del cliente.");
    if (!confirm) return setErr("Debes confirmar que el cliente ha sido informado.");
    if (!authed || !hasPartnerSessionHint()) {
      clearLocalSession();
      return;
    }

    const interesado = {
      nombre: nombre.trim(),
      dni: dni.trim(),
      domicilio: domicilio.trim(),
      localidad: localidad.trim(),
    };

    submissionAbortRef.current?.abort();
    const controller = new AbortController();
    const generation = authGenerationRef.current;
    submissionAbortRef.current = controller;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append("client_email", clientEmail.trim());
      fd.append("client_name", clientName.trim());
      fd.append("interesado_json", JSON.stringify(interesado));
      if (note.trim()) fd.append("partner_note", note.trim());
      fd.append("confirm_client_informed", "true");
      files.forEach((f) => fd.append("files", f));
      fd.append("authorization_file", authorizationFile);

      const data = await fetchJson(
        `${API}/partner/cases`,
        {
          method: "POST",
          body: fd,
          signal: controller.signal,
        },
        { requireCsrf: true }
      );

      if (
        controller.signal.aborted ||
        generation !== authGenerationRef.current
      ) return;

      setMsg(`✅ Expediente enviado (case_id: ${data.case_id}).`);
      setClientEmail("");
      setClientName("");
      setNombre("");
      setDni("");
      setDomicilio("");
      setLocalidad("");
      setNote("");
      setConfirm(false);
      setFiles([]);
      setAuthorizationFile(null);
      if (inputRef.current) inputRef.current.value = "";
      if (authInputRef.current) authInputRef.current.value = "";
    } catch (e) {
      if (
        e?.name === "AbortError" ||
        controller.signal.aborted ||
        generation !== authGenerationRef.current
      ) return;
      if (e?.status === 401) {
        clearLocalSession();
        return;
      }
      setErr(e.message || "No se pudo enviar el expediente.");
    } finally {
      if (
        submissionAbortRef.current === controller &&
        generation === authGenerationRef.current
      ) {
        submissionAbortRef.current = null;
        setSending(false);
      }
    }
  }

  if (sessionChecking) {
    return (
      <main className="sr-container py-12" style={{ minHeight: "calc(100vh - 160px)" }}>
        <div className="sr-card">Comprobando la sesión segura…</div>
      </main>
    );
  }

  if (!authed) {
    return (
      <>
        <Seo
          title="Asesorías · RecurreTuMulta"
          description="Acceso profesional para asesorías y gestorías."
          canonical="https://www.recurretumulta.eu/gestorias"
        />
        <main ref={sensitiveViewRef} hidden={!viewVisible} className="sr-container py-12" style={{ minHeight: "calc(100vh - 160px)" }}>
          <h1 className="sr-h1 mb-6">Acceso profesional para asesorías</h1>

          <div className="sr-card" style={{ maxWidth: 620 }}>
            <p className="sr-p" style={{ marginTop: 0 }}>
              Portal B2B · <b>Facturación mensual</b>.
            </p>

            <div style={{ display: "grid", gap: 10 }}>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                style={inputStyle}
              />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                type="password"
                style={inputStyle}
              />
              {loginErr && <div className="sr-small" style={{ color: "#991b1b" }}>❌ {loginErr}</div>}
              <button className="sr-btn-primary" onClick={login} disabled={logging}>
                {logging ? "Entrando…" : "Entrar"}
              </button>
            </div>
          </div>

          <div className="sr-card" style={{ maxWidth: 620, marginTop: 18 }}>
            <h3 className="sr-h3" style={{ marginTop: 0 }}>¿Eres una asesoría y quieres trabajar con nosotros?</h3>
            <p className="sr-p">
              Solicita el alta profesional y te responderemos tras revisar tu solicitud.
            </p>
            <button className="sr-btn-primary" onClick={() => nav("/gestorias/alta")}>
              Solicitar alta
            </button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Seo
        title="Asesorías · RecurreTuMulta"
        description="Portal profesional para asesorías."
        canonical="https://www.recurretumulta.eu/gestorias"
      />
      <main ref={sensitiveViewRef} hidden={!viewVisible} className="sr-container py-12" style={{ minHeight: "calc(100vh - 160px)" }}>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div>
            <h1 className="sr-h1">Portal asesorías</h1>
            <div className="sr-small" style={{ color: "#6b7280" }}>
              Partner: <b>{partnerName || "—"}</b>
            </div>
          </div>

          <div className="sr-cta-row" style={{ justifyContent: "flex-end" }}>
            <button className="sr-btn-secondary" onClick={() => nav("/partner/panel")}>
              Ver mis expedientes
            </button>
            <button className="sr-btn-secondary" onClick={logout} disabled={loggingOut}>
              {loggingOut ? "Cerrando…" : "Salir"}
            </button>
          </div>
        </div>

        <div className="sr-card" role="status">
          <h2 className="sr-h2" style={{ marginTop: 0 }}>
            Alta de expedientes temporalmente no disponible
          </h2>
          <p className="sr-p">
            Hemos pausado la descarga de modelos y el envío de nuevos expedientes
            partner mientras implantamos una autorización específica, ligada a cada
            expediente y revisable por una persona.
          </p>
          <p className="sr-small" style={{ color: "#64748b" }}>
            Los expedientes ya existentes siguen disponibles desde “Ver mis expedientes”.
            Esta pantalla no enviará datos ni archivos durante el mantenimiento.
          </p>
        </div>
      </main>
    </>
  );
}
