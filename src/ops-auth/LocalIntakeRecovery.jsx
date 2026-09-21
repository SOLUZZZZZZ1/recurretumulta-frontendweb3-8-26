import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useOpsAuth } from "./OpsAuthContext.jsx";
import { currentLocalOpsDevelopmentEnabled } from "./opsLocalDevelopment.js";
import { apiFetch, rememberCaseAccessToken, openCaseFile } from "../lib/api.js";
import {
  LOCAL_RTM_AUTHORIZATION_KIND, authorizationRoutes,
  parseLocalAuthorizationIssue, appendLocalAuthorizationBinding,
  parseLocalAuthorizationCandidate,
} from "../lib/intakeAuthorizationFlow.js";

async function responseData(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "No se pudo completar la operación local.");
  return data;
}

export default function LocalIntakeRecovery({ caseId }) {
  const { authFetch, canSupervise } = useOpsAuth();
  const [binding, setBinding] = useState(null);
  const [recovered, setRecovered] = useState(false);
  const [candidate, setCandidate] = useState(null);
  const [received, setReceived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef(null);
  useEffect(() => () => pending.current?.abort(), []);
  if (!currentLocalOpsDevelopmentEnabled() || !canSupervise) return null;
  const routes = authorizationRoutes(caseId, LOCAL_RTM_AUTHORIZATION_KIND);

  async function run(action) {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setMessage("");
    try { await action(controller.signal); }
    catch (error) { if (!controller.signal.aborted) setMessage(error.message || "No se pudo completar la operación."); }
    finally {
      if (!controller.signal.aborted) setBusy(false);
      if (pending.current === controller) pending.current = null;
    }
  }

  function recover() {
    return run(async (signal) => {
      const data = await responseData(await authFetch(`/api/ops/core/cases/${caseId}/recover-local-access`, { method: "POST", signal }));
      if (signal.aborted) return;
      if (data.ok !== true || data.local_only !== true || data.case_id !== caseId ||
          !rememberCaseAccessToken(caseId, data.case_access_token)) throw new Error("El servidor no confirmó el acceso local.");
      setRecovered(true);
      setMessage("Acceso recuperado en este navegador. Puedes continuar el expediente de prueba.");
    });
  }

  function prepare() {
    return run(async (signal) => {
      const data = await responseData(await apiFetch(`/api${routes.issue}`, {
        method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(routes.issueBody),
      }));
      if (signal.aborted) return;
      setBinding(parseLocalAuthorizationIssue(data, caseId).binding);
      setMessage("PDF de prueba preparado para recibir el candidato. No acredita una firma.");
    });
  }

  function upload() {
    return run(async (signal) => {
      if (!candidate || candidate.type !== "application/pdf" || candidate.size > 8 * 1024 * 1024) throw new Error("Selecciona un PDF de prueba de hasta 8 MB.");
      const body = appendLocalAuthorizationBinding(new FormData(), binding, caseId);
      body.append("file", candidate);
      const data = await responseData(await apiFetch(`/api${routes.candidate}`, { method: "POST", body, signal }));
      if (signal.aborted) return;
      parseLocalAuthorizationCandidate(data, caseId);
      setReceived(true);
      setMessage("Candidato recibido y pendiente de revisión. Firma y pago siguen sin acreditar.");
    });
  }

  return <section style={{ marginTop: 16, padding: 16, background: "#fffbeb", borderRadius: 12 }}>
    <h2>Retomar prueba local de Consumo</h2>
    <p>Recupera el acceso en este navegador para continuar un expediente ficticio existente.</p>
    {!recovered && <button type="button" disabled={busy} onClick={recover}>Recuperar acceso local</button>}
    {recovered && <>
      {!binding && <button type="button" disabled={busy} onClick={prepare}>Preparar autorización de prueba existente</button>}
      {binding && <>
        <button type="button" disabled={busy} onClick={() => run(() => openCaseFile(`/api${routes.pdf}`, caseId))}>Descargar PDF de prueba</button>
        {!received && <>
          <label>PDF candidato de prueba, sin firma real<input type="file" accept=".pdf,application/pdf" disabled={busy} onChange={e => setCandidate(e.target.files?.[0] || null)} /></label>
          <button type="button" disabled={busy || !candidate} onClick={upload}>Subir candidato de prueba</button>
        </>}
      </>}
      <p><Link to={`/reclamaciones/documentos?case=${encodeURIComponent(caseId)}`}>Continuar con el documento principal</Link></p>
    </>}
    {message && <p role="status">{message}</p>}
  </section>;
}
