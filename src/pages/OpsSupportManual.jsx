import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { MANUAL_REVISION, OPERATOR_MANUAL, PRESENTER_MANUAL, manualSearchText } from "../lib/opsManuals.js";
import "../styles/opsManual.css";

const CASE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function OpsSupportManual({ kind = "operador" }) {
  const guide = kind === "presentador" ? PRESENTER_MANUAL : OPERATOR_MANUAL;
  const [query, setQuery] = useState("");
  const [params] = useSearchParams();
  const { hash } = useLocation();
  const caseId = CASE_ID.test(params.get("caseId") || "") ? params.get("caseId") : "";
  const suffix = caseId ? `?caseId=${encodeURIComponent(caseId)}` : "";
  const normalizedQuery = query.trim().normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const index = useMemo(() => guide.sections.map(section => ({ section, text: manualSearchText(section) })), [guide]);
  const matches = index.filter(({ text }) => normalizedQuery.split(/\s+/).every(word => text.includes(word)));
  const matchedIds = new Set(matches.map(({ section }) => section.id));

  useEffect(() => {
    if (!hash || !guide.sections.some(section => hash === `#${section.id}`)) return;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(hash.slice(1));
      target?.scrollIntoView({ block: "start" });
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [hash, guide]);

  function jump(event, id) {
    event.preventDefault(); setQuery("");
    requestAnimationFrame(() => {
      const target = document.getElementById(id);
      target?.scrollIntoView({ block: "start", behavior: "smooth" });
      target?.focus({ preventScroll: true });
    });
  }

  return <main className="rtm-manual" id="manual-inicio">
    <div className="manual-wrap">
      <nav className="manual-toolbar manual-controls" aria-label="Navegación de soporte">
        <Link to="/ops">← Volver al panel</Link>
        {caseId ? <Link to={`/ops/review/${encodeURIComponent(caseId)}`}>Volver al expediente</Link> : null}
        <Link to="/ops/followups">Seguimientos</Link>
      </nav>
      <header className="manual-hero">
        <p className="manual-eyebrow">RTM · Soporte al trabajo diario</p>
        <h1>{guide.title}</h1>
        <p className="manual-subtitle">{guide.subtitle}</p>
        <p className="manual-version">Versión revisada el {MANUAL_REVISION} · {guide.sections.length} apartados</p>
        <nav className="manual-tabs manual-controls" aria-label="Elegir manual">
          <Link to={`/ops/manual${suffix}`} aria-current={kind === "operador" ? "page" : undefined}>Operador</Link>
          <Link to={`/ops/manual-presentador${suffix}`} aria-current={kind === "presentador" ? "page" : undefined}>Presentador</Link>
          <button type="button" onClick={() => window.print()}>Imprimir / guardar PDF</button>
        </nav>
      </header>

      <aside className="manual-notice" aria-label="Disponibilidad de las funciones"><strong>Antes de empezar</strong><p>{guide.notice}</p></aside>
      <section className="manual-start manual-controls" aria-label="Ayuda rápida">
        {guide.quick.map(([id, label], i) => <a key={id} href={`#${id}`} onClick={event => jump(event, id)}><span aria-hidden="true">0{i + 1}</span><strong>{label}</strong><span aria-hidden="true">→</span></a>)}
      </section>
      <div className="manual-search manual-controls">
        <label htmlFor="manual-search">Buscar en este manual</label>
        <div><input id="manual-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Por ejemplo: autorización, justificante, no se guarda…"/><button type="button" onClick={() => setQuery("")} disabled={!query}>Limpiar búsqueda</button></div>
        <p role="status">{normalizedQuery ? `${matches.length} de ${guide.sections.length} apartados coinciden con la búsqueda.` : "Elige una tarea en el índice o busca el mensaje que ves en pantalla."} La impresión incluye el manual completo.</p>
      </div>

      <div className="manual-layout">
        <nav className="manual-index manual-controls" aria-label="Índice del manual">
          <h2>En este manual</h2>
          <ol>{guide.sections.map(section => <li key={section.id}><a href={`#${section.id}`} onClick={event => jump(event, section.id)}>{section.title}</a></li>)}</ol>
          <p>Guarda cada formulario antes de cambiar de pantalla. Las casillas de apoyo temporal se pierden al salir.</p>
        </nav>
        <div className="manual-content">
          {!matches.length ? <div className="manual-empty manual-controls"><h2>No encontramos esa expresión</h2><p>Prueba con una palabra más corta, como «firma», «plazo» o «documento», o usa el índice para ver una tarea completa.</p><button type="button" onClick={() => setQuery("")}>Ver el manual completo</button></div> : null}
          {guide.sections.map(section => <article className="manual-section" id={section.id} tabIndex={-1} key={section.id} hidden={!matchedIds.has(section.id)}>
            <h2>{section.title}</h2>
            {section.where ? <p className="manual-where"><strong>Dónde:</strong> {section.where}</p> : null}
            {section.intro ? <p>{section.intro}</p> : null}
            {section.table ? <div className="manual-table-wrap" tabIndex={0} role="region" aria-label={`Tabla: ${section.title}`}><table><thead><tr>{section.table.columns.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead><tbody>{section.table.rows.map(([label, text]) => <tr key={label}><th scope="row">{label}</th><td>{text}</td></tr>)}</tbody></table></div> : null}
            {section.steps ? <ol className="manual-steps">{section.steps.map(step => <li key={step}>{step}</li>)}</ol> : null}
            {section.outcome ? <div className="manual-outcome"><h3>Cómo sabes que has terminado</h3><p>{section.outcome}</p></div> : null}
            {section.blocked ? <div className="manual-blocked"><h3>Si no puedes continuar</h3><p>{section.blocked}</p></div> : null}
            {section.template ? <div className="manual-template"><h3>Plantilla para comunicar la incidencia</h3><p>Selecciona y copia este texto; complétalo con la información del caso.</p><pre>{section.template}</pre></div> : null}
            <a className="manual-top manual-controls" href="#manual-inicio">↑ Volver al inicio del manual</a>
          </article>)}
          <p className="manual-footer">{guide.title} · RTM · Revisión {MANUAL_REVISION}. Si una pantalla muestra un bloqueo o un requisito adicional, compruébalo con supervisión antes de continuar.</p>
        </div>
      </div>
    </div>
  </main>;
}
