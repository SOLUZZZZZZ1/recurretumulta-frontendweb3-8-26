import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Seo from "../components/Seo.jsx";

const API = "/api";

async function fetchJson(url, options = {}) {
  const r = await fetch(url, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail?.message || data?.detail || "Error API");
  return data;
}

function isDevSandbox() {
  const hash = window.location.hash || "";
  const hasDevQuery = hash.includes("dev=1");
  const stored = window.localStorage.getItem("rtm_dev_mode") === "1";
  const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  return hasDevQuery || stored || isLocalhost;
}

function getMockStatus(caseId) {
  try {
    const raw = window.localStorage.getItem(`rtm_mock_case_${caseId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveMockStatus(caseId, patch = {}) {
  const prev = getMockStatus(caseId) || {};
  const next = { ...prev, ...patch };
  window.localStorage.setItem(`rtm_mock_case_${caseId}`, JSON.stringify(next));
  return next;
}

export default function Autorizar() {
  const navigate = useNavigate();
  const params = useMemo(
    () => new URLSearchParams(window.location.hash.split("?")[1] || ""),
    []
  );
  const caseId = params.get("case") || "";
  const devMode = isDevSandbox();

  const [statusData, setStatusData] = useState(null);
  const [form, setForm] = useState({
    full_name: "",
    dni_nie: "",
    domicilio_notif: "",
    email: "",
    telefono: "",
  });

  const [acceptedText, setAcceptedText] = useState(false);
  const [confirmedIdentity, setConfirmedIdentity] = useState(false);
  const [authorizationGenerated, setAuthorizationGenerated] = useState(false);
  const [signedFile, setSignedFile] = useState(null);

  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [uploadingSigned, setUploadingSigned] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const [error, setError] = useState("");

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;

    async function loadStatus() {
      setLoadingStatus(true);
      setError("");
      try {
        if (devMode) {
          const mock = getMockStatus(caseId) || {};
          if (cancelled) return;
          setStatusData(mock);
          setForm((prev) => ({
            full_name: mock?.full_name || prev.full_name || "",
            dni_nie: mock?.dni_nie || prev.dni_nie || "",
            domicilio_notif: mock?.domicilio_notif || prev.domicilio_notif || "",
            email: mock?.email || prev.email || "",
            telefono: mock?.telefono || prev.telefono || "",
          }));
          if (mock?.authorized) setAuthorizationGenerated(true);
          return;
        }

        const data = await fetchJson(`${API}/cases/${encodeURIComponent(caseId)}/public-status`);
        if (cancelled) return;
        setStatusData(data || null);

        setForm((prev) => ({
          full_name: data?.full_name || prev.full_name || "",
          dni_nie: data?.dni_nie || prev.dni_nie || "",
          domicilio_notif: data?.domicilio_notif || prev.domicilio_notif || "",
          email: data?.email || prev.email || "",
          telefono: data?.telefono || prev.telefono || "",
        }));

        if (data?.authorized) {
          setAuthorizationGenerated(true);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "No se pudo cargar el expediente.");
      } finally {
        if (!cancelled) setLoadingStatus(false);
      }
    }

    loadStatus();
    return () => {
      cancelled = true;
    };
  }, [caseId, devMode]);

  async function handleGenerateAuthorization() {
    setError("");
    setOkMsg("");

    if (!caseId) return setError("Falta el expediente interno.");
    if (!form.full_name.trim()) return setError("Introduce tu nombre y apellidos.");
    if (!form.dni_nie.trim()) return setError("Introduce tu DNI / NIE.");
    if (!form.domicilio_notif.trim()) return setError("Introduce tu domicilio a efectos de notificaciones.");
    if (!form.email.trim()) return setError("Introduce un email válido.");
    if (!acceptedText) return setError("Debes aceptar el texto de autorización.");
    if (!confirmedIdentity) return setError("Debes confirmar que los datos corresponden a tu persona.");

    if (devMode) {
      const mock = saveMockStatus(caseId, {
        full_name: form.full_name.trim(),
        dni_nie: form.dni_nie.trim().toUpperCase(),
        domicilio_notif: form.domicilio_notif.trim(),
        email: form.email.trim(),
        telefono: form.telefono?.trim() ? form.telefono.trim() : null,
        authorized: true,
        status: "ready_to_pay",
        payment_status: "pending",
        message: "Modo prueba: autorización generada y expediente listo para pago.",
      });
      setAuthorizationGenerated(true);
      setStatusData(mock);
      setOkMsg("✅ [Modo prueba] Autorización simulada. Ya puedes continuar sin backend real.");
      return;
    }

    setLoading(true);
    try {
      await fetchJson(`${API}/cases/${encodeURIComponent(caseId)}/details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          dni_nie: form.dni_nie.trim().toUpperCase(),
          domicilio_notif: form.domicilio_notif.trim(),
          email: form.email.trim(),
          telefono: form.telefono?.trim() ? form.telefono.trim() : null,
        }),
      });

      await fetchJson(`${API}/cases/${encodeURIComponent(caseId)}/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: "v1_dgt_homologado",
          accepted_text: true,
          confirmed_identity: true,
        }),
      });

      setAuthorizationGenerated(true);
      setOkMsg("✅ Autorización generada. Ahora descárgala, fírmala y vuelve a subirla.");
    } catch (e) {
      setError(e.message || "No se pudo generar la autorización.");
    } finally {
      setLoading(false);
    }
  }

  function handleDownloadAuthorization() {
    if (!caseId) {
      setError("Falta el expediente interno.");
      return;
    }

    if (devMode) {
      setOkMsg("✅ [Modo prueba] Descarga simulada. Puedes seguir con la subida simulada.");
      return;
    }

    window.open(`${API}/cases/${encodeURIComponent(caseId)}/authorization-pdf`, "_blank");
  }

  async function handleUploadSigned() {
    setError("");
    setOkMsg("");

    if (!caseId) return setError("Falta el expediente interno.");
    if (!signedFile && !devMode) return setError("Debes seleccionar la autorización firmada.");

    if (devMode) {
      saveMockStatus(caseId, {
        authorized: true,
        authorization_signed_uploaded: true,
        status: "ready_to_pay",
        payment_status: "pending",
        message: "Modo prueba: autorización firmada simulada correctamente.",
      });
      setOkMsg("✅ [Modo prueba] Autorización firmada simulada correctamente.");
      setTimeout(() => {
        navigate(`/resumen?case=${encodeURIComponent(caseId)}&dev=1`);
      }, 800);
      return;
    }

    setUploadingSigned(true);
    try {
      const fd = new FormData();
      fd.append("file", signedFile);

      const r = await fetch(`${API}/cases/${encodeURIComponent(caseId)}/upload-authorization-signed`, {
        method: "POST",
        body: fd,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.detail || "No se pudo subir la autorización firmada.");

      setOkMsg("✅ Autorización firmada subida correctamente. Ya puedes continuar.");
      setTimeout(() => {
        navigate(`/resumen?case=${encodeURIComponent(caseId)}`);
      }, 1000);
    } catch (e) {
      setError(e.message || "No se pudo subir la autorización firmada.");
    } finally {
      setUploadingSigned(false);
    }
  }

  return (
    <>
      <Seo
        title="Autorización previa al pago"
        description="Descarga la autorización, fírmala y vuelve a subirla antes de continuar."
      />

      <main className="sr-container py-12">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h1 className="sr-h1">Autorización previa al pago</h1>
          <Link
            to={caseId ? `/resumen?case=${encodeURIComponent(caseId)}${devMode ? "&dev=1" : ""}` : "/"}
            className="sr-btn-secondary"
          >
            ← Volver
          </Link>
        </div>

        <div className="sr-card">
          {devMode && (
            <div className="sr-card" style={{ background: "#fffbeb", border: "1px solid #fde68a", marginBottom: 14 }}>
              <p className="sr-p" style={{ margin: 0 }}>
                🧪 <strong>Modo prueba activo.</strong> Puedes simular autorización y subida firmada sin usar backend real.
              </p>
            </div>
          )}

          <p className="sr-p" style={{ marginTop: 0 }}>
            Antes de pagar, necesitamos tus datos como interesado y una autorización firmada para poder
            presentar el recurso en tu nombre.
          </p>

          <p className="sr-p">
            <strong>Sin autorización firmada no se permite la tramitación.</strong>
          </p>

          <div className="sr-small" style={{ color: "#6b7280", marginTop: 10 }}>
            Expediente interno:{" "}
            <span style={{ fontFamily: "ui-monospace, Menlo, Monaco, Consolas, monospace" }}>
              {caseId || "—"}
            </span>
          </div>

          {loadingStatus && (
            <div className="sr-small" style={{ marginTop: 12, color: "#6b7280" }}>
              Cargando expediente…
            </div>
          )}

          {error && (
            <div className="sr-small" style={{ marginTop: 12, color: "#991b1b" }}>
              ❌ {error}
            </div>
          )}

          {okMsg && (
            <div className="sr-small" style={{ marginTop: 12, color: "#166534" }}>
              {okMsg}
            </div>
          )}

          <h3 className="sr-h3" style={{ marginTop: 18 }}>Paso 1 · Datos del interesado</h3>
          <p className="sr-small" style={{ color: "#6b7280", marginTop: 6 }}>
            Estos datos se usarán para generar la autorización que tendrás que descargar, firmar y volver a subir.
          </p>

          <div className="grid gap-3" style={{ maxWidth: 760, marginTop: 10 }}>
            <div>
              <label className="sr-small" style={{ fontWeight: 800 }}>Nombre y apellidos</label>
              <input
                className="sr-input"
                value={form.full_name}
                onChange={(e) => setField("full_name", e.target.value)}
              />
            </div>

            <div>
              <label className="sr-small" style={{ fontWeight: 800 }}>DNI / NIE / Pasaporte</label>
              <input
                className="sr-input"
                value={form.dni_nie}
                onChange={(e) => setField("dni_nie", e.target.value.toUpperCase())}
              />
            </div>

            <div>
              <label className="sr-small" style={{ fontWeight: 800 }}>Domicilio a efectos de notificaciones</label>
              <input
                className="sr-input"
                placeholder="Calle, número, piso, CP, ciudad, provincia"
                value={form.domicilio_notif}
                onChange={(e) => setField("domicilio_notif", e.target.value)}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="sr-small" style={{ fontWeight: 800 }}>Email</label>
                <input
                  className="sr-input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                />
              </div>
              <div>
                <label className="sr-small" style={{ fontWeight: 800 }}>Teléfono</label>
                <input
                  className="sr-input"
                  type="tel"
                  value={form.telefono}
                  onChange={(e) => setField("telefono", e.target.value)}
                />
              </div>
            </div>
          </div>

          <h3 className="sr-h3" style={{ marginTop: 18 }}>Paso 2 · Confirmación</h3>

          <div className="sr-card" style={{ background: "#f9fafb" }}>
            <p className="sr-p" style={{ whiteSpace: "pre-line", margin: 0 }}>
              Yo, {form.full_name || "el/la interesado/a"}, autorizo a LA TALAMANQUINA, S.L. (RecurreTuMulta)
              a actuar en mi nombre para la tramitación administrativa del expediente asociado a este proceso,
              incluyendo la preparación y presentación de alegaciones y/o recursos ante la DGT u organismo competente,
              así como la obtención del justificante oficial de presentación.
            </p>
          </div>

          <label className="sr-small" style={{ display: "block", marginTop: 14 }}>
            <input
              type="checkbox"
              checked={acceptedText}
              onChange={(e) => setAcceptedText(e.target.checked)}
            />{" "}
            He leído y acepto el texto de autorización.
          </label>

          <label className="sr-small" style={{ display: "block", marginTop: 8 }}>
            <input
              type="checkbox"
              checked={confirmedIdentity}
              onChange={(e) => setConfirmedIdentity(e.target.checked)}
            />{" "}
            Confirmo que los datos facilitados corresponden a mi persona y son correctos.
          </label>

          <div className="sr-cta-row" style={{ justifyContent: "flex-start", marginTop: 16 }}>
            <button className="sr-btn-primary" onClick={handleGenerateAuthorization} disabled={loading}>
              {loading ? "Generando…" : "Guardar datos y generar autorización"}
            </button>

            <Link
              to={caseId ? `/resumen?case=${encodeURIComponent(caseId)}${devMode ? "&dev=1" : ""}` : "/"}
              className="sr-btn-secondary"
            >
              Volver al expediente
            </Link>
          </div>

          <h3 className="sr-h3" style={{ marginTop: 24 }}>Paso 3 · Descargar, firmar y volver a subir</h3>

          <div className="sr-card" style={{ background: "#f9fafb" }}>
            <ol className="sr-p" style={{ margin: 0, paddingLeft: 18 }}>
              <li>Descarga la autorización.</li>
              <li>Fírmala a mano.</li>
              <li>Haz una foto o escanéala.</li>
              <li>Sube aquí el PDF o la imagen firmada.</li>
            </ol>
          </div>

          <div className="sr-cta-row" style={{ justifyContent: "flex-start", marginTop: 14 }}>
            <button
              className="sr-btn-secondary"
              onClick={handleDownloadAuthorization}
              disabled={!authorizationGenerated}
            >
              📄 Descargar autorización
            </button>
          </div>

          {!authorizationGenerated && (
            <div className="sr-small" style={{ marginTop: 8, color: "#6b7280" }}>
              Primero genera la autorización con tus datos para poder descargarla.
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <label className="sr-small" style={{ fontWeight: 800 }}>Subir autorización firmada</label>
            <input
              className="sr-input"
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setSignedFile(e.target.files?.[0] || null)}
            />
          </div>

          <div className="sr-cta-row" style={{ justifyContent: "flex-start", marginTop: 12 }}>
            <button
              className="sr-btn-primary"
              onClick={handleUploadSigned}
              disabled={uploadingSigned || (!signedFile && !devMode)}
            >
              {uploadingSigned ? "Subiendo…" : "Subir autorización firmada"}
            </button>
          </div>

          <div className="sr-small" style={{ marginTop: 12, color: "#6b7280" }}>
            Se registrarán la fecha, la hora, la IP y el navegador utilizado para esta autorización.
          </div>
        </div>
      </main>
    </>
  );
}
