import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import AiDocumentConsent from "../components/AiDocumentConsent.jsx";
import { VEHICLE_REMOVAL_INTAKE_PATH } from "../data/publicServices.js";
import {
  appendAiDocumentConsent,
  VEHICLE_REMOVAL_AI_PRIVACY_VERSION,
} from "../lib/aiDocumentConsent.js";
import {
  forgetCaseAccessToken,
  getCaseAccessToken,
  requiredCaseAccessFetch,
  RTM_API_CANDIDATES,
} from "../lib/api.js";
import { requireStripeCheckoutUrl } from "../lib/safeNavigation.js";
import {
  formatVehicleRemovalQuote,
  isExpectedVehicleCaseStatus,
  isVehiclePaymentConfirmed,
  parseVehicleRemovalCheckout,
  sameVehicleRemovalQuote,
  verifyVehicleRemovalQuote,
  vehicleCaseAllowsMutation,
  vehicleCaseIdFromSearch,
  vehicleCheckoutSignal,
} from "../lib/vehicleRemovalAccess.js";

// CORE defaults to 2 MiB for appended files. Keeping the client at that
// conservative limit prevents an AI verification from succeeding only for the
// subsequent custodial upload to fail.
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 5;
const APPEND_DOCUMENT_EXTENSION = /\.(?:pdf|jpe?g|png|webp|tiff?|docx)$/i;

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
    const detail =
      data?.detail?.message ||
      data?.detail ||
      data?.message ||
      data?.error ||
      text ||
      `HTTP ${response.status}`;
    const error = new Error(
      typeof detail === "string" ? detail : JSON.stringify(detail)
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

async function fetchJsonFallback(path, options = {}, requiredCaseId = "") {
  if (!requiredCaseId) {
    throw new Error("Falta el expediente autorizado para esta operación.");
  }
  const errors = [];

  for (const base of RTM_API_CANDIDATES) {
    const url = buildUrl(base, path);
    try {
      const response = await requiredCaseAccessFetch(
        url,
        requiredCaseId,
        options
      );
      return await readResponse(response);
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      if (error?.status === 401 || error?.status === 403) throw error;
      errors.push(`${url} → ${error?.message || "Error"}`);
    }
  }

  throw new Error(errors.join(" | "));
}

function normalizePlate(value = "") {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
}

function formatBytes(bytes = 0) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function EliminarCoche() {
  const location = useLocation();
  const caseId = useMemo(
    () => vehicleCaseIdFromSearch(location.search),
    [location.search]
  );
  const checkoutSignal = useMemo(
    () => vehicleCheckoutSignal(location.search),
    [location.search]
  );
  const checkoutReturned = checkoutSignal === "returned";
  const cancelled = checkoutSignal === "cancelled";

  const permitRef = useRef(null);
  const taxRef = useRef(null);
  const otherRef = useRef(null);
  const activeCaseIdRef = useRef(caseId);
  const submitAbortRef = useRef(null);
  activeCaseIdRef.current = caseId;

  const [loadingCase, setLoadingCase] = useState(true);
  const [verifiedCaseId, setVerifiedCaseId] = useState("");
  const [rejectedCaseId, setRejectedCaseId] = useState("");
  const [paidCaseId, setPaidCaseId] = useState("");
  const [plate, setPlate] = useState("");
  const [vehicleLocation, setVehicleLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [permitFile, setPermitFile] = useState(null);
  const [taxFile, setTaxFile] = useState(null);
  const [otherFiles, setOtherFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [messageState, setMessageState] = useState({ caseId: "", text: "" });
  const [aiProcessingConsent, setAiProcessingConsent] = useState(false);
  const [vehicleAuthorizationAccepted, setVehicleAuthorizationAccepted] = useState(false);
  const [authorizedPlate, setAuthorizedPlate] = useState("");
  const [quoteState, setQuoteState] = useState({ caseId: "", quote: null });

  const normalizedPlate = useMemo(() => normalizePlate(plate), [plate]);
  const plateIsValid = /^\d{4}[A-Z]{3}$/.test(normalizedPlate);
  const caseVerified = Boolean(caseId && verifiedCaseId === caseId);
  const accessRejected = Boolean(caseId && rejectedCaseId === caseId);
  const paymentConfirmed = Boolean(caseId && paidCaseId === caseId);
  const message = messageState.caseId === caseId ? messageState.text : "";
  const vehicleQuote = quoteState.caseId === caseId ? quoteState.quote : null;
  const hasCaseAccess = useMemo(
    () => Boolean(caseId && getCaseAccessToken(caseId)),
    [caseId]
  );

  function setMessage(text) {
    setMessageState({ caseId, text: String(text || "") });
  }

  useEffect(() => {
    let active = true;
    const loadController = new AbortController();
    submitAbortRef.current?.abort();
    submitAbortRef.current = null;

    // This component may be reused by the router for a different case. Reset all
    // transient data before authorizing the new case so case A can never be
    // rendered or submitted while case B is being loaded.
    setLoadingCase(true);
    setVerifiedCaseId("");
    setRejectedCaseId("");
    setPaidCaseId("");
    setPlate("");
    setVehicleLocation("");
    setNotes("");
    setPermitFile(null);
    setTaxFile(null);
    setOtherFiles([]);
    setAiProcessingConsent(false);
    setVehicleAuthorizationAccepted(false);
    setAuthorizedPlate("");
    setQuoteState({ caseId, quote: null });
    setLoading(false);
    setMessageState({ caseId, text: "" });

    async function loadCase() {
      if (!caseId || !hasCaseAccess) {
        setLoadingCase(false);
        return;
      }

      try {
        const publicStatus = await fetchJsonFallback(
          `/cases/${encodeURIComponent(caseId)}/public-status`,
          { method: "GET", signal: loadController.signal },
          caseId
        );
        if (!isExpectedVehicleCaseStatus(publicStatus, caseId)) {
          throw new Error(
            "El expediente autorizado no corresponde a una retirada de vehículo."
          );
        }

        let paid = false;
        try {
          const billing = await fetchJsonFallback(
            `/billing/status/${encodeURIComponent(caseId)}`,
            { method: "GET", signal: loadController.signal },
            caseId
          );
          paid = isVehiclePaymentConfirmed(billing);
        } catch (error) {
          if (error?.status === 401 || error?.status === 403) throw error;
          if (checkoutReturned && active) {
            setMessage(
              "El retorno desde la pasarela no confirma por sí solo el pago. Vuelve a comprobarlo en unos instantes."
            );
          }
        }

        if (!active) return;
        setPaidCaseId(paid ? caseId : "");
        if (paid) {
          setVerifiedCaseId(caseId);
        } else if (vehicleCaseAllowsMutation(publicStatus, caseId)) {
          const quotePayload = await fetchJsonFallback(
            `/vehicle-removal/quote?case_id=${encodeURIComponent(caseId)}`,
            { method: "GET", signal: loadController.signal },
            caseId
          );
          if (!active) return;
          const quote = await verifyVehicleRemovalQuote(quotePayload, caseId);
          setQuoteState({ caseId, quote });
          setVerifiedCaseId(caseId);
        } else {
          setMessage(
            "El estado actual del expediente no permite iniciar otra gestión o pago."
          );
        }
        if (checkoutReturned && !paid) {
          setMessage(
            "El pago todavía no consta confirmado. No se mostrará como realizado hasta que lo confirme el servidor."
          );
        }
      } catch (error) {
        if (!active) return;
        if (error?.status === 401 || error?.status === 403) {
          forgetCaseAccessToken(caseId);
          setRejectedCaseId(caseId);
          return;
        }
        setMessage(error?.message || "No se pudo cargar el expediente.");
      } finally {
        if (active) setLoadingCase(false);
      }
    }

    loadCase();
    return () => {
      active = false;
      loadController.abort();
      submitAbortRef.current?.abort();
      submitAbortRef.current = null;
    };
  }, [caseId, checkoutReturned, hasCaseAccess]);

  function setSingleFile(file, setter, label, currentFile) {
    if (file && file.size > MAX_FILE_BYTES) {
      setMessage(`${label} supera el máximo de ${formatBytes(MAX_FILE_BYTES)}.`);
      return;
    }
    if (file && !APPEND_DOCUMENT_EXTENSION.test(file.name || "")) {
      setMessage(`${label} no tiene un formato permitido.`);
      return;
    }
    const currentTotal =
      Number(Boolean(permitFile)) +
      Number(Boolean(taxFile)) +
      otherFiles.length;
    if (file && !currentFile && currentTotal >= MAX_FILES) {
      setMessage(`Máximo ${MAX_FILES} documentos en total.`);
      return;
    }
    setter(file || null);
    setVehicleAuthorizationAccepted(false);
    setAuthorizedPlate("");
    setMessage("");
  }

  function addOtherFiles(fileList) {
    const incoming = Array.from(fileList || []);
    const fixedCount = Number(Boolean(permitFile)) + Number(Boolean(taxFile));
    const available = Math.max(0, MAX_FILES - fixedCount - otherFiles.length);
    const selected = incoming.slice(0, available);
    const oversized = selected.find((file) => file.size > MAX_FILE_BYTES);
    const unsupported = selected.find(
      (file) => !APPEND_DOCUMENT_EXTENSION.test(file.name || "")
    );

    if (oversized) {
      setMessage(`${oversized.name} supera el máximo de ${formatBytes(MAX_FILE_BYTES)}.`);
      return;
    }
    if (unsupported) {
      setMessage(`${unsupported.name} no tiene un formato permitido.`);
      return;
    }

    setOtherFiles((current) => [...current, ...selected]);
    setVehicleAuthorizationAccepted(false);
    setAuthorizedPlate("");
    setMessage(incoming.length > available ? `Máximo ${MAX_FILES} documentos en total.` : "");
  }

  async function submit(event) {
    event.preventDefault();
    setMessage("");

    if (!caseId) return setMessage("No se ha encontrado el número de expediente RTM.");
    if (verifiedCaseId !== caseId || paidCaseId === caseId) {
      return setMessage("El expediente no está autorizado para esta operación.");
    }
    if (!vehicleQuote) {
      return setMessage("No se ha podido verificar el precio de este servicio.");
    }
    if (!normalizedPlate) return setMessage("Indica la matrícula del vehículo.");
    if (!plateIsValid) {
      return setMessage("La matrícula debe tener cuatro cifras y tres letras.");
    }
    if (!vehicleAuthorizationAccepted || authorizedPlate !== normalizedPlate) {
      return setMessage("Debes autorizar expresamente esta gestión del vehículo.");
    }
    const selectedDocuments = [permitFile, taxFile, ...otherFiles].filter(Boolean);
    if (selectedDocuments.length > MAX_FILES) {
      return setMessage(`Máximo ${MAX_FILES} documentos en total.`);
    }
    if (
      selectedDocuments.some(
        (file) =>
          file.size > MAX_FILE_BYTES ||
          !APPEND_DOCUMENT_EXTENSION.test(file.name || "")
      )
    ) {
      return setMessage("Revisa el tamaño y formato de los documentos seleccionados.");
    }
    submitAbortRef.current?.abort();
    const controller = new AbortController();
    const requestCaseId = caseId;
    submitAbortRef.current = controller;
    setLoading(true);

    try {
      const latestQuotePayload = await fetchJsonFallback(
        `/vehicle-removal/quote?case_id=${encodeURIComponent(caseId)}`,
        { method: "GET", signal: controller.signal },
        caseId
      );
      const latestQuote = await verifyVehicleRemovalQuote(
        latestQuotePayload,
        caseId
      );
      if (
        controller.signal.aborted ||
        activeCaseIdRef.current !== requestCaseId
      ) return;
      if (!sameVehicleRemovalQuote(vehicleQuote, latestQuote)) {
        setQuoteState({ caseId, quote: latestQuote });
        setVehicleAuthorizationAccepted(false);
        setAuthorizedPlate("");
        setMessage(
          "La cotización ha cambiado. Revisa el importe y vuelve a autorizar la gestión."
        );
        return;
      }

      const documents = selectedDocuments;
      let verificationNote = "";

      if (permitFile && aiProcessingConsent) {
        const verificationForm = new FormData();
        verificationForm.append("case_id", caseId);
        verificationForm.append("file", permitFile);
        verificationForm.append("plate", normalizedPlate);
        appendAiDocumentConsent(verificationForm, {
          consented: aiProcessingConsent,
          privacyVersion: VEHICLE_REMOVAL_AI_PRIVACY_VERSION,
        });

        const verification = await fetchJsonFallback(
          "/vehicle-removal/verify-registration",
          { method: "POST", body: verificationForm, signal: controller.signal },
          caseId
        );
        if (
          controller.signal.aborted ||
          activeCaseIdRef.current !== requestCaseId
        ) return;
        verificationNote = verification?.can_continue
          ? "Verificación automatizada orientativa completada; pendiente de revisión humana."
          : "Verificación automatizada no concluyente; requiere revisión humana.";
      } else if (permitFile) {
        verificationNote =
          "Permiso de circulación aportado sin autorización para procesamiento con IA; requiere revisión humana.";
      }

      if (documents.length) {
        const fd = new FormData();
        documents.forEach((file) => fd.append("files", file));
        await fetchJsonFallback(
          `/cases/${encodeURIComponent(caseId)}/append-documents`,
          {
            method: "POST",
            body: fd,
            signal: controller.signal,
          },
          caseId
        );
        if (
          controller.signal.aborted ||
          activeCaseIdRef.current !== requestCaseId
        ) return;
      }

      const data = await fetchJsonFallback(
        "/vehicle-removal/create-checkout-session",
        {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            case_id: caseId,
            plate: normalizedPlate,
            city: vehicleLocation.trim(),
            notes: [
              notes.trim(),
              permitFile ? "Permiso de circulación aportado." : "Permiso de circulación pendiente.",
              taxFile ? "Impuesto de circulación aportado." : "Impuesto de circulación pendiente.",
              verificationNote,
            ]
              .filter(Boolean)
              .join("\n"),
            authorization_accepted: vehicleAuthorizationAccepted,
            authorization_version: vehicleQuote.authorizationVersion,
            authorization_sha256: vehicleQuote.authorizationSha256,
          }),
        },
        caseId
      );
      if (
        controller.signal.aborted ||
        activeCaseIdRef.current !== requestCaseId
      ) return;

      const checkout = parseVehicleRemovalCheckout(data, caseId);
      window.location.assign(requireStripeCheckoutUrl(checkout.checkoutUrl));
    } catch (error) {
      if (
        error?.name === "AbortError" ||
        controller.signal.aborted ||
        activeCaseIdRef.current !== requestCaseId
      ) return;
      setMessage(error?.message || "No se pudo continuar con la gestión.");
    } finally {
      if (
        submitAbortRef.current === controller &&
        activeCaseIdRef.current === requestCaseId
      ) {
        submitAbortRef.current = null;
        setLoading(false);
      }
    }
  }

  if (!caseId || !hasCaseAccess || accessRejected) {
    return <Navigate to={VEHICLE_REMOVAL_INTAKE_PATH} replace />;
  }

  if (loadingCase || !caseVerified) {
    return (
      <main style={{ padding: "42px 18px" }}>
        <section style={successCardStyle}>
          <h1 style={{ margin: "0 0 14px", fontSize: 30 }}>
            Comprobando el expediente
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.65, margin: 0 }}>
            {loadingCase
              ? "Estamos verificando el acceso y el estado del pago con RTM."
              : message || "No se pudo verificar el expediente de forma segura."}
          </p>
        </section>
      </main>
    );
  }

  if (paymentConfirmed) {
    return (
      <main style={{ padding: "42px 18px" }}>
        <section style={successCardStyle}>
          <h1 style={{ margin: "0 0 14px", fontSize: 32 }}>✅ Pago realizado correctamente</h1>
          <p style={{ fontSize: 18, lineHeight: 1.65, margin: 0 }}>
            Hemos recibido la solicitud de gestión del vehículo.
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.65, marginTop: 12 }}>
            Revisaremos la documentación y contactaremos contigo si falta algún dato.
          </p>
          {caseId ? <div style={caseBoxStyle}>Expediente RTM: <strong>{caseId}</strong></div> : null}
        </section>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "calc(100vh - 120px)", padding: "44px 18px 70px", background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 56%, #0f766e 100%)" }}>
      <section style={{ maxWidth: 920, margin: "0 auto", padding: "30px 24px", borderRadius: 26, background: "rgba(255,255,255,.98)", boxShadow: "0 24px 70px rgba(15,23,42,.34)" }}>
        {cancelled ? <div style={cancelledStyle}><strong>Pago cancelado.</strong> Puedes volver a intentarlo.</div> : null}

        <header style={{ marginBottom: 24 }}>
          <div style={tagStyle}>🚗 Expediente RTM · Vehículo</div>
          <h1 style={{ margin: "0 0 12px", fontSize: "clamp(34px, 5vw, 50px)", lineHeight: 1.05, letterSpacing: "-.035em" }}>
            Gestión de baja o retirada de vehículo
          </h1>
          <p style={{ margin: 0, maxWidth: 760, color: "#475569", fontSize: 17, lineHeight: 1.6 }}>
            Tus datos personales y la identificación aportada constan en el
            expediente. El consentimiento específico para preparar la retirada
            se solicita por separado y permanece sin aceptar hasta que lo marques.
          </p>
        </header>

        <section style={panelStyle}>
          <InfoRow label="Expediente RTM" value={caseId || "No encontrado"} />
          <div style={statusGridStyle}>
            <Status text="Datos personales recibidos" />
            <Status text="Identidad recibida" />
            <Status text="Acceso al expediente verificado" />
          </div>
        </section>

        <form onSubmit={submit}>
          <section style={panelStyle}>
            <h2 style={sectionTitleStyle}>Datos del vehículo</h2>
            <Field
              label="Matrícula *"
              value={plate}
              onChange={(value) => {
                setPlate(value);
                setVehicleAuthorizationAccepted(false);
                setAuthorizedPlate("");
              }}
              placeholder="Ej. 3148 BSS"
            />
            <Field
              label="Lugar donde se encuentra el vehículo"
              value={vehicleLocation}
              onChange={(value) => {
                setVehicleLocation(value);
                setVehicleAuthorizationAccepted(false);
                setAuthorizedPlate("");
              }}
              placeholder="Opcional"
            />
          </section>

          <section style={panelStyle}>
            <h2 style={sectionTitleStyle}>Documentación disponible</h2>
            <p style={helperStyle}>
              Los documentos son opcionales. Si ahora no dispones de alguno, el expediente continuará y quedará marcado como pendiente.
            </p>

            <UploadBox
              label="Permiso de circulación"
              helper="Foto o PDF. Opcional."
              file={permitFile}
              inputRef={permitRef}
              onChange={(file) => {
                setAiProcessingConsent(false);
                setVehicleAuthorizationAccepted(false);
                setAuthorizedPlate("");
                setSingleFile(file, setPermitFile, "El permiso de circulación", permitFile);
              }}
            />
            <AiDocumentConsent
              id="vehicle-removal-ai-processing-consent"
              checked={aiProcessingConsent}
              onChange={(value) => {
                setAiProcessingConsent(value);
                setVehicleAuthorizationAccepted(false);
                setAuthorizedPlate("");
              }}
              disabled={!permitFile || loading}
              documentLabel="el permiso de circulación seleccionado"
            />
            <p style={{ ...helperStyle, marginTop: 9 }}>
              Es opcional. Si no lo autorizas, el permiso no se enviará al sistema de IA y quedará para revisión humana.
            </p>
            <div style={{ height: 12 }} />
            <UploadBox label="Último impuesto de circulación" helper="Recibo municipal o justificante. Opcional." file={taxFile} inputRef={taxRef} onChange={(file) => setSingleFile(file, setTaxFile, "El impuesto de circulación", taxFile)} />
            <div style={{ height: 12 }} />

            <span style={labelStyle}>Fotografías u otros documentos</span>
            <button type="button" onClick={() => otherRef.current?.click()} style={uploadButtonStyle}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>📎</div>
              <strong>Añadir documentos</strong>
              <div style={uploadHelperStyle}>Hasta {MAX_FILES} documentos en total</div>
            </button>
            <input ref={otherRef} type="file" multiple accept="image/*,.pdf,.docx" onChange={(event) => { addOtherFiles(event.target.files); event.target.value = ""; }} style={{ display: "none" }} />

            {otherFiles.length ? (
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {otherFiles.map((file, index) => (
                  <div key={`${file.name}-${index}`} style={fileRowStyle}>
                    <span style={{ overflowWrap: "anywhere" }}>{file.name} · {formatBytes(file.size)}</span>
                    <button type="button" onClick={() => {
                      setOtherFiles((current) => current.filter((_, i) => i !== index));
                      setVehicleAuthorizationAccepted(false);
                      setAuthorizedPlate("");
                    }} style={removeButtonStyle}>Quitar</button>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section style={panelStyle}>
            <h2 style={sectionTitleStyle}>Observaciones</h2>
            <textarea value={notes} onChange={(event) => {
              setNotes(event.target.value);
              setVehicleAuthorizationAccepted(false);
              setAuthorizedPlate("");
            }} rows={5} maxLength={1500} placeholder="Ej. El vehículo lleva años parado, no dispongo de llaves, está en un taller, tiene embargo…" style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
            <div style={{ marginTop: 6, textAlign: "right", color: "#64748b", fontSize: 13 }}>{notes.length}/1500</div>
          </section>

          {message ? <div role="alert" style={errorStyle}>{message}</div> : null}

          <label style={{ ...panelStyle, display: "flex", alignItems: "flex-start", gap: 11, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={vehicleAuthorizationAccepted && authorizedPlate === normalizedPlate}
              onChange={(event) => {
                const accepted = event.target.checked && plateIsValid;
                setVehicleAuthorizationAccepted(accepted);
                setAuthorizedPlate(accepted ? normalizedPlate : "");
                setMessage("");
              }}
              disabled={loading || !plateIsValid}
              style={{ marginTop: 4, width: 18, height: 18, flexShrink: 0 }}
            />
            <span style={{ color: "#334155", lineHeight: 1.55 }}>
              {vehicleQuote.authorizationText}
              <small style={{ display: "block", marginTop: 5, color: "#64748b" }}>
                Versión de autorización: {vehicleQuote.authorizationVersion}
              </small>
            </span>
          </label>

          <div style={priceBoxStyle}>
            <div>
              <div style={{ fontWeight: 900, color: "#334155" }}>Servicio de gestión</div>
              <div style={{ marginTop: 3, color: "#64748b", fontSize: 13 }}>Pago seguro con Stripe</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 32, fontWeight: 950 }}>
                {formatVehicleRemovalQuote(vehicleQuote)}
              </div>
              <div style={{ color: "#64748b", fontSize: 12 }}>IVA incluido</div>
            </div>
          </div>

          <button type="submit" disabled={loading || loadingCase || !caseId} style={submitStyle(loading || loadingCase || !caseId)}>
            {loading ? "Guardando y preparando pago…" : "Guardar documentación y continuar al pago"}
          </button>
        </form>

        <div style={noticeStyle}>
          Este servicio gestiona la baja o retirada del vehículo. No elimina automáticamente deudas, embargos o sanciones anteriores.
        </div>
      </section>
    </main>
  );
}

function InfoRow({ label, value }) {
  return <div><div style={{ color: "#64748b", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</div><div style={{ marginTop: 3, color: "#0f172a", fontWeight: 950, overflowWrap: "anywhere" }}>{value}</div></div>;
}

function Status({ text }) {
  return <div style={statusStyle}><span style={{ color: "#16a34a" }}>✓</span><span>{text}</span></div>;
}

function Field({ label, value, onChange, placeholder }) {
  return <label style={{ display: "block", marginBottom: 14 }}><span style={labelStyle}>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} style={inputStyle} /></label>;
}

function UploadBox({ label, helper, file, inputRef, onChange }) {
  return <div><span style={labelStyle}>{label}</span><button type="button" onClick={() => inputRef.current?.click()} style={{ ...uploadButtonStyle, background: file ? "#f0fdf4" : "#f8fafc" }}><div style={{ fontSize: 28, marginBottom: 6 }}>{file ? "✅" : "📎"}</div><strong>{file ? file.name : "Seleccionar archivo"}</strong><div style={uploadHelperStyle}>{file ? formatBytes(file.size) : helper}</div></button><input ref={inputRef} type="file" accept="image/*,.pdf" onChange={(event) => onChange(event.target.files?.[0] || null)} style={{ display: "none" }} /></div>;
}

const panelStyle = { marginBottom: 18, padding: 20, border: "1px solid #e2e8f0", borderRadius: 19, background: "#fff" };
const sectionTitleStyle = { margin: "0 0 15px", fontSize: 23, lineHeight: 1.2 };
const tagStyle = { display: "inline-flex", padding: "7px 12px", marginBottom: 14, borderRadius: 999, background: "#dbeafe", color: "#1d4ed8", fontWeight: 950 };
const statusGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 9, marginTop: 17 };
const statusStyle = { display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 12, color: "#334155", fontSize: 14, fontWeight: 800 };
const labelStyle = { display: "block", marginBottom: 7, color: "#0f172a", fontWeight: 850 };
const inputStyle = { width: "100%", boxSizing: "border-box", padding: "12px 13px", border: "1px solid #cbd5e1", borderRadius: 13, background: "#fff", fontSize: 15 };
const helperStyle = { margin: "0 0 14px", color: "#64748b", lineHeight: 1.55 };
const uploadButtonStyle = { width: "100%", minHeight: 112, padding: 16, border: "2px dashed #cbd5e1", borderRadius: 15, background: "#f8fafc", color: "#0f172a", cursor: "pointer", textAlign: "center" };
const uploadHelperStyle = { marginTop: 5, color: "#64748b", fontSize: 13 };
const fileRowStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 11px", borderRadius: 11, background: "#f1f5f9", color: "#334155", fontSize: 13 };
const removeButtonStyle = { flexShrink: 0, border: 0, borderRadius: 8, padding: "6px 9px", background: "#e2e8f0", color: "#0f172a", fontWeight: 800, cursor: "pointer" };
const priceBoxStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, marginBottom: 16, padding: 17, border: "1px solid #e2e8f0", borderRadius: 15, background: "#f8fafc" };
const noticeStyle = { marginTop: 17, padding: 14, borderRadius: 13, border: "1px solid #fed7aa", background: "#fff7ed", color: "#9a3412", fontSize: 13, lineHeight: 1.5 };
const cancelledStyle = { marginBottom: 18, padding: 14, borderRadius: 14, border: "1px solid #fed7aa", background: "#fff7ed", color: "#9a3412" };
const successCardStyle = { maxWidth: 760, margin: "0 auto", padding: "34px 28px", border: "1px solid #bbf7d0", borderRadius: 24, background: "#ecfdf5", color: "#065f46", boxShadow: "0 12px 35px rgba(0,0,0,.08)" };
const caseBoxStyle = { marginTop: 20, padding: 14, border: "1px solid #bbf7d0", borderRadius: 16, background: "rgba(255,255,255,.75)", overflowWrap: "anywhere" };
const errorStyle = { marginBottom: 16, padding: 14, borderRadius: 14, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 800, lineHeight: 1.45, overflowWrap: "anywhere" };
function submitStyle(disabled) { return { width: "100%", minHeight: 56, border: 0, borderRadius: 15, padding: "15px 18px", background: disabled ? "#94a3b8" : "#16a34a", color: "#fff", fontSize: 17, fontWeight: 950, cursor: disabled ? "not-allowed" : "pointer", boxShadow: "0 14px 28px rgba(22,163,74,.24)" }; }
