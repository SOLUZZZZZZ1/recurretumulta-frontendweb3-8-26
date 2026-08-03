import React, { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import Seo from "../components/Seo.jsx";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function PagoCancel() {
  const q = useQuery();
  const caseId = q.get("case") || "";

  return (
    <>
      <Seo
        title="Pago cancelado · RecurreTuMulta"
        description="El pago se ha cancelado."
        canonical="https://www.recurretumulta.eu/pago-cancel"
      />

      <main className="sr-container py-12" style={{ minHeight: "calc(100vh - 160px)" }}>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h1 className="sr-h1">Pago cancelado</h1>
          <Link to="/" className="sr-btn-secondary">← Inicio</Link>
        </div>

        <div className="sr-card">
          <div className="sr-p">No se ha completado el pago.</div>

          {caseId && (
            <div style={{ marginTop: 10 }}>
              <div className="sr-small" style={{ color: "#6b7280" }}>Expediente interno</div>
              <div className="sr-small" style={{ fontFamily: "ui-monospace, Menlo, Monaco, Consolas, monospace" }}>
                {caseId}
              </div>
            </div>
          )}

          <div className="sr-cta-row" style={{ justifyContent: "flex-start", marginTop: 14 }}>
            {caseId ? (
              <Link to={`/resumen?case=${encodeURIComponent(caseId)}`} className="sr-btn-primary">
                Volver al expediente
              </Link>
            ) : (
              <Link to="/" className="sr-btn-primary">
                Volver al inicio
              </Link>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
