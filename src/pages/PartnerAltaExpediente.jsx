import React, { useMemo, useRef, useState } from "react";

const API = "/api";
const MAX_FILES = 5;

async function fetchJson(url, options = {}) {
  const r = await fetch(url, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail || data?.message || "Error API");
  return data;
}

function formatBytes(bytes) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

export default function PartnerAltaExpediente({ partnerToken = "" }) {
  const originalsRef = useRef(null);
  const authRef = useRef(null);

  const [files, setFiles] = useState([]);
  const [authorizationFile, setAuthorizationFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [result, setResult] = useState(null);

  const [form, setForm] = useState({
    client_name: "",
    client_email: "",
    partner_note: "",
    authorization_mode: "partner_custody",
    confirm_client_informed: true,
    confirm_authorization_held: true,
    full_name: "",
    dni_nie: "",
    domicilio_notif: "",
    telefono: "",
    email: "",
  });

  const maxFilesReached = useMemo(() => files.length >= MAX_FILES, [files.length]);

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function addFiles(fileList) {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;

    const space = MAX_FILES - files.length;
    const sliced = incoming.slice(0, Math.max(0, space));
    const mapped = sliced.map((file) => ({ id: crypto.randomUUID(), file }));

    setFiles((prev) => [...prev, ...mapped]);

    if (incoming.length > sliced.length) {
      setMsg(`Máximo ${MAX_FILES} documentos por expediente.`);
    }
  }

  function removeFile(id) {
    setFiles((prev) => prev.filter((x) => x.id !== id));
  }

  function clearAll() {
    setFiles([]);
    setAuthorizationFile(null);
    setResult(null);
    setMsg("");
    if (originalsRef.current) originalsRef.current.value = "";
    if (authRef.current) authRef.current.value = "";
  }

  async function submit() {
    setMsg("");
    setResult(null);

    if (!partnerToken.trim()) {
      setMsg("Falta el token de partner.");
      return;
    }
    if (!form.client_name.trim()) {
      setMsg("Indica el nombre del cliente.");
      return;
    }
    if (!form.client_email.trim()) {
      setMsg("Indica el email del cliente.");
      return;
    }
    if (files.length === 0) {
      setMsg("Añade al menos un documento del expediente.");
      return;
    }
    if (form.authorization_mode === "partner_custody" && !form.confirm_authorization_held) {
      setMsg("Debes confirmar que la gestoría custodia la autorización.");
      return;
    }

    setLoading(true);

    try {
      const fd = new FormData();

      fd.append("client_name", form.client_name.trim());
      fd.append("client_email", form.client_email.trim());
      fd.append("partner_note", form.partner_note.trim());
      fd.append("authorization_mode", form.authorization_mode);
      fd.append("confirm_client_informed", String(!!form.confirm_client_informed));
      fd.append("confirm_authorization_held", String(!!form.confirm_authorization_held));

      const interesado = {
        full_name: form.full_name.trim(),
        dni_nie: form.dni_nie.trim(),
        domicilio_notif: form.domicilio_notif.trim(),
        telefono: form.telefono.trim(),
        email: form.email.trim() || form.client_email.trim(),
      };
      fd.append("interesado_json", JSON.stringify(interesado));

      files.forEach((x) => fd.append("files", x.file));

      if (authorizationFile) {
        fd.append("authorization_file", authorizationFile);
      }

      const data = await fetchJson(`${API}/partner/cases`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${partnerToken.trim()}`,
        },
        body: fd,
      });

      setResult(data);
      setMsg("✅ Expediente de gestoría creado correctamente.");
    } catch (e) {
      setMsg(e?.message || "No se pudo crear el expediente partner.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sr-card" style={{ textAlign: "left" }}>
      <h2 className="sr-h2" style={{ marginBottom: 8 }}>
        Alta de expediente para gestorías
      </h2>

      <p className="sr-p">
        Este formulario crea expedientes por canal partner y permite decidir cómo se gestiona
        la autorización del cliente.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="sr-small" style={{ fontWeight: 800 }}>Nombre del cliente</label>
          <input className="sr-input" value={form.client_name} onChange={(e) => setField("client_name", e.target.value)} />
        </div>

        <div>
          <label className="sr-small" style={{ fontWeight: 800 }}>Email del cliente</label>
          <input className="sr-input" type="email" value={form.client_email} onChange={(e) => setField("client_email", e.target.value)} />
        </div>
      </div>

      <div style={{ marginTop: 14 }} className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="sr-small" style={{ fontWeight: 800 }}>Nombre completo del interesado</label>
          <input className="sr-input" value={form.full_name} onChange={(e) => setField("full_name", e.target.value)} />
        </div>

        <div>
          <label className="sr-small" style={{ fontWeight: 800 }}>DNI / NIE</label>
          <input className="sr-input" value={form.dni_nie} onChange={(e) => setField("dni_nie", e.target.value.toUpperCase())} />
        </div>

        <div className="md:col-span-2">
          <label className="sr-small" style={{ fontWeight: 800 }}>Domicilio a efectos de notificaciones</label>
          <input className="sr-input" value={form.domicilio_notif} onChange={(e) => setField("domicilio_notif", e.target.value)} />
        </div>

        <div>
          <label className="sr-small" style={{ fontWeight: 800 }}>Teléfono</label>
          <input className="sr-input" value={form.telefono} onChange={(e) => setField("telefono", e.target.value)} />
        </div>

        <div>
          <label className="sr-small" style={{ fontWeight: 800 }}>Email del interesado</label>
          <input className="sr-input" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} />
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <label className="sr-small" style={{ fontWeight: 800 }}>Nota interna de gestoría</label>
        <textarea
          className="sr-input"
          rows={3}
          value={form.partner_note}
          onChange={(e) => setField("partner_note", e.target.value)}
        />
      </div>

      <div className="sr-card" style={{ marginTop: 16 }}>
        <div className="sr-h3">Autorización del cliente</div>

        <div style={{ marginTop: 10 }}>
          <label className="sr-small" style={{ fontWeight: 800 }}>Modo de autorización</label>
          <select
            className="sr-input"
            value={form.authorization_mode}
            onChange={(e) => setField("authorization_mode", e.target.value)}
          >
            <option value="partner_custody">La gestoría custodia la autorización</option>
            <option value="recurre_flow">El cliente autorizará en RecurreTuMulta</option>
          </select>
        </div>

        <label className="sr-small" style={{ display: "block", marginTop: 12 }}>
          <input
            type="checkbox"
            checked={!!form.confirm_client_informed}
            onChange={(e) => setField("confirm_client_informed", e.target.checked)}
          />{" "}
          Confirmo que el cliente ha sido informado de la tramitación.
        </label>

        {form.authorization_mode === "partner_custody" ? (
          <>
            <label className="sr-small" style={{ display: "block", marginTop: 8 }}>
              <input
                type="checkbox"
                checked={!!form.confirm_authorization_held}
                onChange={(e) => setField("confirm_authorization_held", e.target.checked)}
              />{" "}
              Confirmo que la gestoría custodia la autorización del cliente.
            </label>

            <div style={{ marginTop: 12 }}>
              <label className="sr-small" style={{ fontWeight: 800 }}>
                PDF de autorización (opcional pero recomendado)
              </label>
              <input
                ref={authRef}
                type="file"
                accept=".pdf,image/*"
                className="sr-input"
                onChange={(e) => setAuthorizationFile(e.target.files?.[0] || null)}
              />
              {authorizationFile ? (
                <div className="sr-small" style={{ marginTop: 6 }}>
                  {authorizationFile.name} · {formatBytes(authorizationFile.size)}
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div className="sr-small" style={{ marginTop: 10, color: "#6b7280" }}>
            En este modo, el cliente tendrá que completar la autorización dentro de RecurreTuMulta.
          </div>
        )}
      </div>

      <div className="sr-card" style={{ marginTop: 16 }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="sr-h3">Documentos del expediente</div>
            <div className="sr-small" style={{ color: "#6b7280" }}>
              Hasta {MAX_FILES} documentos por expediente.
            </div>
          </div>
          <button
            type="button"
            className="sr-btn-secondary"
            disabled={maxFilesReached}
            onClick={() => originalsRef.current?.click()}
          >
            Añadir documentos
          </button>
        </div>

        <input
          ref={originalsRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx"
          style={{ display: "none" }}
          onChange={(e) => addFiles(e.target.files)}
        />

        {files.length > 0 ? (
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {files.map((x, idx) => (
              <div
                key={x.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 10,
                  background: "rgba(255,255,255,0.7)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div>
                  <div className="sr-small" style={{ fontWeight: 800 }}>
                    Documento {idx + 1}
                  </div>
                  <div className="sr-small" style={{ color: "#6b7280" }}>
                    {x.file.name} · {formatBytes(x.file.size)}
                  </div>
                </div>

                <button className="sr-btn-secondary" type="button" onClick={() => removeFile(x.id)}>
                  Quitar
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="sr-small" style={{ marginTop: 12, color: "#6b7280" }}>
            No has añadido documentos todavía.
          </div>
        )}
      </div>

      <div className="sr-cta-row" style={{ justifyContent: "flex-start", marginTop: 16 }}>
        <button className="sr-btn-primary" onClick={submit} disabled={loading}>
          {loading ? "Creando expediente…" : "Crear expediente partner"}
        </button>

        <button className="sr-btn-secondary" type="button" onClick={clearAll}>
          Limpiar
        </button>
      </div>

      {msg ? (
        <div className="sr-small" style={{ marginTop: 12, color: msg.startsWith("✅") ? "#166534" : "#991b1b" }}>
          {msg}
        </div>
      ) : null}

      {result ? (
        <div className="sr-card" style={{ marginTop: 16 }}>
          <div className="sr-h3">Resultado</div>
          <div className="sr-small" style={{ marginTop: 6 }}>
            <b>case_id:</b> {result.case_id}
          </div>
          <div className="sr-small">
            <b>authorization_mode:</b> {result.authorization_mode}
          </div>
          <div className="sr-small">
            <b>next_step:</b> {result.next_step}
          </div>
          <div className="sr-small">
            <b>authorization_document_uploaded:</b> {String(result.authorization_document_uploaded)}
          </div>
          {result.resume_url ? (
            <div className="sr-small" style={{ marginTop: 8 }}>
              <a href={result.resume_url} target="_blank" rel="noreferrer">
                Abrir expediente
              </a>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
