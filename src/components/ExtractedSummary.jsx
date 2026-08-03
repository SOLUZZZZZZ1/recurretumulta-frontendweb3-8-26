// src/components/ExtractedSummary.jsx — resumen con flujo manual
import React from "react";
import { Link } from "react-router-dom";

function Row({ label, value }) {
  return (
    <div style={{display:"grid",gridTemplateColumns:"220px 1fr",gap:10,padding:"8px 0",borderBottom:"1px solid #e5e7eb"}}>
      <div className="sr-small" style={{fontWeight:800,color:"#374151"}}>{label}</div>
      <div className="sr-p" style={{margin:0}}>{value ?? <span style={{color:"#6b7280"}}>—</span>}</div>
    </div>
  );
}

function Badge({ children }) {
  return (
    <span style={{padding:"4px 10px",borderRadius:9999,background:"rgba(15,23,42,.08)",fontSize:12,fontWeight:800}}>
      {children}
    </span>
  );
}

export default function ExtractedSummary({ data }) {
  const wrapper = data?.extracted;
  const extracted = wrapper?.extracted;
  const storage = wrapper?.storage;
  const caseId = data?.case_id;

  if (!extracted) return null;

  try { localStorage.setItem("rtm_last_analysis", JSON.stringify(data)); } catch {}

  return (
    <div className="sr-card" style={{marginTop:14}}>
      <div className="flex justify-between items-center mb-3 gap-2 flex-wrap">
        <div>
          <h3 className="sr-h3">Resultado del análisis</h3>
          <div className="sr-small">Expediente interno: <code>{caseId}</code></div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {extracted.organismo && <Badge>{extracted.organismo}</Badge>}
          {extracted.plazo_recurso_sugerido && <Badge>Plazo: {extracted.plazo_recurso_sugerido}</Badge>}
          <Badge>Revisión manual</Badge>
          <Link to={`/resumen?case=${encodeURIComponent(caseId)}`} className="sr-btn-secondary">Continuar</Link>
        </div>
      </div>

      <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:14,padding:12,marginBottom:12}}>
        <div className="sr-small" style={{fontWeight:900}}>🟡 Este expediente pasará a revisión manual</div>
        <div className="sr-small" style={{marginTop:5}}>
          Permitimos continuar aunque la viabilidad no sea alta. Solo se bloqueará automáticamente si el plazo está vencido.
        </div>
      </div>

      <Row label="Organismo" value={extracted.organismo} />
      <Row label="Nº expediente" value={extracted.expediente_ref} />
      <Row label="Importe" value={extracted.importe ? `${extracted.importe} €` : null} />
      <Row label="Fecha notificación" value={extracted.fecha_notificacion || extracted.fecha_documento} />
      <Row label="Tipo detectado" value={extracted.tipo_infraccion || extracted.familia_resuelta} />
      <Row label="Jurisdicción" value={extracted.jurisdiccion} />
      <Row label="Hecho imputado" value={extracted.hecho_para_recurso || extracted.hecho_imputado || extracted.hecho_denunciado_resumido} />
      <Row label="Resultado estratégico" value={extracted.resultado_estrategico} />
      <Row label="Revisión automática" value="No bloqueante: revisión manual antes de presentar" />

      {storage?.key && <Row label="Documento guardado" value={storage.key} />}

      <div className="sr-cta-row" style={{justifyContent:"flex-start",marginTop:14}}>
        <Link to={`/resumen?case=${encodeURIComponent(caseId)}`} className="sr-btn-primary">
          Continuar a autorización y revisión
        </Link>
      </div>
    </div>
  );
}
