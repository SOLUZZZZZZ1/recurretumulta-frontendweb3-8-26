import React, { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useOpsAuth } from "../ops-auth/OpsAuthContext.jsx";

const API = "/api";

function fmt(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return String(d);
  }
}

async function fetchJson(fetchImpl, url, options = {}) {
  const r = await fetchImpl(url, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail || "Error API");
  return data;
}

export default function OpsCaseDetail() {
  const { caseId } = useParams();
  const { authFetch } = useOpsAuth();

  const [docs, setDocs] = useState([]);
  const [events, setEvents] = useState([]);

  const load = useCallback(async () => {
    const [d, e] = await Promise.all([
      fetchJson(authFetch, `${API}/ops/cases/${caseId}/documents`),
      fetchJson(authFetch, `${API}/ops/cases/${caseId}/events`),
    ]);
    setDocs(d.items || []);
    setEvents(e.items || []);
  }, [authFetch, caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="sr-container py-8">
      <Link to="/ops" className="sr-btn-secondary">
        ← Volver al panel
      </Link>

      <h1 className="sr-h2 mt-4">Expediente {caseId}</h1>

      <div className="sr-card mt-4">
        <h3 className="sr-h3">Acciones</h3>
        <p className="mt-3 text-sm text-slate-700">
          Fase de acceso individual: esta vista legacy es solo de consulta. La
          presentación y su justificante se gestionan desde RTM Presenter con
          sesión individual y evidencia ligada al documento.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-6">
        <div className="sr-card">
          <h3 className="sr-h3">Documentos</h3>
          {docs.map((d, i) => (
            <div
              key={i}
              className="block w-full text-left border rounded p-2 mt-2 text-xs"
            >
              <strong>{d.kind}</strong>
              <div>{fmt(d.created_at)}</div>
              <div className="mt-1 font-semibold text-emerald-700">
                Custodiado en RTM · sin descarga de operador
              </div>
            </div>
          ))}
        </div>

        <div className="sr-card">
          <h3 className="sr-h3">Logs</h3>
          {events.map((e, i) => (
            <div key={i} className="border rounded p-2 mt-2 text-xs">
              <strong>{e.type}</strong>
              <div>{fmt(e.created_at)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
