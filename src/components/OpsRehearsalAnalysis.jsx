import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useOpsAuth } from "../ops-auth/OpsAuthContext.jsx";
import { runRehearsalAnalysis } from "../lib/rehearsalAnalysis.js";

export default function OpsRehearsalAnalysis({ caseId }) {
  const { authFetch, session } = useOpsAuth();
  const requestRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setBusy(false); setResult(null); setError("");
    return () => { requestRef.current?.abort(); requestRef.current = null; };
  }, [caseId, session?.sessionId]);

  async function analyze() {
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true); setError("");
    try {
      const completed = await runRehearsalAnalysis({ authFetch, caseId, signal: controller.signal });
      if (!controller.signal.aborted && requestRef.current === controller) setResult(completed);
    } catch (problem) {
      if (!controller.signal.aborted && requestRef.current === controller) setError(problem.message || "No se pudo comprobar la lectura.");
    } finally {
      if (requestRef.current === controller) { requestRef.current = null; setBusy(false); }
    }
  }

  return <section className="mt-6 rounded-xl border border-slate-300 p-5" aria-labelledby="rehearsal-analysis-title">
    <h2 id="rehearsal-analysis-title" className="text-xl font-bold">Lectura IA de la notificación ficticia</h2>
    <p className="my-3">Tras confirmar el pago de prueba, RTM puede leer la notificación preparada. El resultado necesita revisión de los hechos antes de continuar.</p>
    {!result ? <button type="button" className="sr-btn-primary" onClick={analyze} disabled={busy}>
      {busy ? "Leyendo la notificación…" : error ? "Comprobar o recuperar lectura" : "Analizar notificación ficticia"}
    </button> : <div role="status">
      <p>{result.reused ? "Lectura guardada recuperada." : "Lectura guardada."} Revisa el resultado en OPS.</p>
      <Link className="sr-btn-primary mt-3 inline-flex" to={`/ops/review/${encodeURIComponent(caseId)}`}>Revisar lectura y hechos en OPS</Link>
    </div>}
    {busy ? <p role="status" className="mt-3">La lectura puede tardar unos minutos. Conserva esta pestaña abierta.</p> : null}
    {error ? <p role="alert" className="mt-3 text-red-800">{error}</p> : null}
  </section>;
}
