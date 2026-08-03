import React, { useRef, useState, useEffect } from "react";
import Seo from "../components/Seo.jsx";
import { useNavigate } from "react-router-dom";

const API = "/api";
const AUTHORIZATION_TEMPLATE_URL = `${import.meta.env.BASE_URL}Mod.24-ES.pdf`;

async function fetchJson(url, options = {}) {
  const r = await fetch(url, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail || "Error API");
  return data;
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

  const [token, setToken] = useState(() => localStorage.getItem("partner_token") || "");
  const [partnerName, setPartnerName] = useState(() => localStorage.getItem("partner_name") || "");
  const authed = token && token.trim().length > 10;

  const mustChange = (localStorage.getItem("partner_must_change") || "0") === "1";

  const [email, setEmail] = useState(() => localStorage.getItem("partner_email") || "");
  const [password, setPassword] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [logging, setLogging] = useState(false);

  const inputRef = useRef(null);
  const authInputRef = useRef(null);

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

  function logout() {
    localStorage.removeItem("partner_token");
    localStorage.removeItem("partner_name");
    localStorage.removeItem("partner_email");
    localStorage.removeItem("partner_must_change");
    setToken("");
    setPartnerName("");
    setEmail("");
    setPassword("");
    setMsg("");
    setErr("");
  }

  async function login() {
    setLoginErr("");
    setLogging(true);
    try {
      const data = await fetchJson(`${API}/partner/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem("partner_email", email.trim().toLowerCase());

      if (data?.must_change_password) {
        localStorage.setItem("partner_must_change", "1");
        setPassword("");
        nav("/partner/change-password");
        return;
      }

      localStorage.setItem("partner_must_change", "0");
      localStorage.setItem("partner_token", data.token);
      localStorage.setItem("partner_name", data.partner_name || "");
      setToken(data.token);
      setPartnerName(data.partner_name || "");
      setPassword("");
    } catch (e) {
      setLoginErr(e.message || "No se pudo iniciar sesión");
    } finally {
      setLogging(false);
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
    setMsg("");
    setErr("");
  }

  function onAuthorizationSelected(list) {
    const picked = Array.from(list || [])[0] || null;
    setAuthorizationFile(picked);
    setMsg("");
    setErr("");
  }

  function downloadAuthorizationTemplate() {
    const link = document.createElement("a");
    link.href = `${API}/partner/authorization-template-pdf`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.download = "Mod.24-ES.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
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

    const interesado = {
      nombre: nombre.trim(),
      dni: dni.trim(),
      domicilio: domicilio.trim(),
      localidad: localidad.trim(),
    };

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

      const r = await fetch(`${API}/partner/cases`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.detail || "Error al enviar expediente");

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
      setErr(e.message || "No se pudo enviar el expediente.");
    } finally {
      setSending(false);
    }
  }

  if (!authed) {
    return (
      <>
        <Seo
          title="Asesorías · RecurreTuMulta"
          description="Acceso profesional para asesorías y gestorías."
          canonical="https://www.recurretumulta.eu/gestorias"
        />
        <main className="sr-container py-12" style={{ minHeight: "calc(100vh - 160px)" }}>
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
      <main className="sr-container py-12" style={{ minHeight: "calc(100vh - 160px)" }}>
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
            <button className="sr-btn-secondary" onClick={logout}>
              Salir
            </button>
          </div>
        </div>

        <div className="sr-card">
          <h2 className="sr-h2" style={{ marginTop: 0 }}>Subir expediente</h2>

          <div className="sr-card" style={{ background: "rgba(255,255,255,0.7)" }}>
            <div className="sr-small" style={{ fontWeight: 800 }}>Datos del cliente</div>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
              <input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="Email del cliente" style={inputStyle} />
              <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nombre del cliente" style={inputStyle} />
            </div>
          </div>

          <div className="sr-card" style={{ marginTop: 12, background: "rgba(255,255,255,0.7)" }}>
            <div className="sr-small" style={{ fontWeight: 800 }}>Datos del interesado</div>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellidos" style={inputStyle} />
              <input value={dni} onChange={(e) => setDni(e.target.value)} placeholder="DNI / NIE" style={inputStyle} />
              <input value={domicilio} onChange={(e) => setDomicilio(e.target.value)} placeholder="Domicilio" style={inputStyle} />
              <input value={localidad} onChange={(e) => setLocalidad(e.target.value)} placeholder="Localidad" style={inputStyle} />
            </div>
          </div>

          <div className="sr-card" style={{ marginTop: 12, background: "rgba(255,255,255,0.7)" }}>
            <div className="sr-small" style={{ fontWeight: 800 }}>Documentos del expediente</div>

            <input
              ref={inputRef}
              type="file"
              multiple
              accept="application/pdf,image/*"
              style={{ display: "none" }}
              onChange={(e) => onFilesSelected(e.target.files)}
            />

            <div className="sr-cta-row" style={{ justifyContent: "flex-start", marginTop: 10 }}>
              <button className="sr-btn-primary" type="button" onClick={pickFiles}>
                Añadir documentos (máx. 5)
              </button>

              {files.length > 0 && (
                <span className="sr-small" style={{ color: "#6b7280" }}>
                  {files.length} archivo(s) seleccionado(s)
                </span>
              )}
            </div>

            {files.length > 0 && (
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                {files.map((f, idx) => (
                  <div key={idx} className="sr-small">• {f.name}</div>
                ))}
              </div>
            )}
          </div>

          <div className="sr-card" style={{ marginTop: 12, background: "rgba(255,255,255,0.7)" }}>
            <div className="sr-small" style={{ fontWeight: 800 }}>
              Autorización firmada del cliente (obligatoria)
            </div>

            <div className="sr-small" style={{ marginTop: 8, color: "#6b7280" }}>
              Descarga primero el modelo con vuestros datos, haz que el cliente lo firme y súbelo aquí antes de enviar el expediente.
            </div>

            <div className="sr-cta-row" style={{ justifyContent: "flex-start", marginTop: 12, gap: 10 }}>
              <button className="sr-btn-secondary" type="button" onClick={downloadAuthorizationTemplate}>
                Descargar autorización
              </button>

              <input
                ref={authInputRef}
                type="file"
                accept="application/pdf,image/*"
                style={{ display: "none" }}
                onChange={(e) => onAuthorizationSelected(e.target.files)}
              />

              <button className="sr-btn-primary" type="button" onClick={pickAuthorizationFile}>
                Adjuntar autorización firmada
              </button>
            </div>

            {authorizationFile ? (
              <div className="sr-small" style={{ marginTop: 10, color: "#166534" }}>
                ✅ {authorizationFile.name}
              </div>
            ) : (
              <div className="sr-small" style={{ marginTop: 10, color: "#991b1b" }}>
                ❌ Falta adjuntar la autorización firmada
              </div>
            )}
          </div>

          <div className="sr-card" style={{ marginTop: 12, background: "rgba(255,255,255,0.7)" }}>
            <div className="sr-small" style={{ fontWeight: 800 }}>Observaciones internas (opcional)</div>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota interna (opcional)" style={{ ...inputStyle, marginTop: 8 }} />
          </div>

          <div className="sr-card" style={{ marginTop: 12, background: "rgba(255,255,255,0.7)" }}>
            <label className="sr-small" style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} style={{ marginTop: 3 }} />
              <span>Confirmo que el cliente ha sido informado y autoriza la tramitación.</span>
            </label>
          </div>

          {err && <div className="sr-small" style={{ marginTop: 12, color: "#991b1b" }}>❌ {err}</div>}
          {msg && <div className="sr-small" style={{ marginTop: 12, color: "#166534" }}>{msg}</div>}

          <div className="sr-cta-row" style={{ justifyContent: "flex-start", marginTop: 14 }}>
            <button className="sr-btn-primary" onClick={submitCase} disabled={sending}>
              {sending ? "Enviando…" : "Enviar expediente"}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
