import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOpsAuth } from "../ops-auth/OpsAuthContext.jsx";
import { prepareOpsSummaryAccess } from "../lib/opsSummaryAccess.js";

export default function OpsSummaryAccess({ caseId, className = "sr-btn-primary" }) {
  const { authFetch, session } = useOpsAuth();
  const navigate = useNavigate();
  const requestRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    setBusy(false);
    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [caseId, session?.sessionId]);

  async function openSummary() {
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    setError("");
    try {
      const path = await prepareOpsSummaryAccess({ authFetch, caseId, signal: controller.signal });
      if (!controller.signal.aborted && requestRef.current === controller) navigate(path);
    } catch (problem) {
      if (!controller.signal.aborted && requestRef.current === controller) {
        setError(problem.message || "No se pudo abrir el resumen.");
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setBusy(false);
      }
    }
  }

  return <div>
    <button type="button" className={className} onClick={openSummary} disabled={busy}>
      {busy ? "Preparando acceso al resumen…" : "Ver resumen y estado del pago"}
    </button>
    {error ? <p role="alert" className="mt-3 text-sm font-semibold text-red-800">{error}</p> : null}
  </div>;
}
