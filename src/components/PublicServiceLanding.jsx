import { Link } from "react-router-dom";
import Seo from "./Seo.jsx";

const PROCESS_STEPS = [
  ["1", "Cuéntanos qué ha ocurrido", "Describe el problema y reúne la documentación que tengas."],
  ["2", "Ordenamos la información", "Identificamos contrato, comunicaciones, importes y fechas relevantes."],
  ["3", "Revisamos el encaje", "Te explicamos qué vía existe y qué información puede faltar."],
  ["4", "Tú decides cómo continuar", "No iniciamos una actuación posterior sin explicarte antes el alcance."],
];

export default function PublicServiceLanding({ family }) {
  const { landing } = family;

  if (!landing) return null;

  const isConsultation = family.entryMode === "consultation";
  const description = `${landing.lead} ${landing.closingText}`;

  return (
    <>
      <Seo
        title={`${family.title} · Revisión de casos · RTM`}
        description={description}
        canonical={`https://www.recurretumulta.eu${family.path}`}
        image={`https://www.recurretumulta.eu${landing.image}`}
      />

      <main className={`rtm-public-family rtm-public-family--${family.id}`}>
        <section className="rtm-public-family-hero">
          <span className="rtm-public-family-orb rtm-public-family-orb--one" aria-hidden="true" />
          <span className="rtm-public-family-orb rtm-public-family-orb--two" aria-hidden="true" />

          <div className="rtm-public-family-container rtm-public-family-hero-grid">
            <div className="rtm-public-family-copy">
              <div className="rtm-public-family-badge">
                <span aria-hidden="true">{family.icon}</span>
                <span>{landing.eyebrow}</span>
              </div>

              <h1>
                {landing.headline} <span>{landing.highlight}</span>
              </h1>

              <p className="rtm-public-family-lead">{landing.lead}</p>

              <div className="rtm-public-family-pills" aria-label="Características del servicio">
                {landing.pills.map((pill) => (
                  <span key={pill}>✓ {pill}</span>
                ))}
              </div>

              <div className="rtm-public-family-actions">
                <Link className="rtm-public-family-primary" to={family.startPath}>
                  {family.startLabel}
                </Link>
                <a className="rtm-public-family-secondary" href="#situaciones">
                  Ver situaciones
                </a>
              </div>
            </div>

            <figure className="rtm-public-family-visual">
              <img
                src={landing.image}
                alt={landing.imageAlt}
                style={{ objectPosition: landing.imagePosition }}
              />
              <figcaption>Imagen ilustrativa generada con IA</figcaption>
              <div className="rtm-public-family-visual-note" aria-hidden="true">
                <span>{family.icon}</span>
                <strong>Primero entendemos el caso</strong>
              </div>
            </figure>
          </div>
        </section>

        <section id="situaciones" className="rtm-public-family-section">
          <div className="rtm-public-family-container">
            <div className="rtm-public-family-heading">
              <span>Situaciones habituales</span>
              <h2>{landing.situationsTitle}</h2>
              <p>
                No necesitas acertar con una etiqueta técnica. Estas situaciones sirven para
                reconocer el problema y preparar mejor la revisión.
              </p>
            </div>

            <div className="rtm-public-family-situations">
              {landing.situations.map(([icon, title, text], index) => (
                <article key={title} style={{ "--card-delay": `${index * 45}ms` }}>
                  <div className="rtm-public-family-situation-icon" aria-hidden="true">
                    {icon}
                  </div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="rtm-public-family-boundary-section">
          <div className="rtm-public-family-container">
            <div
              className={`rtm-public-family-boundary ${
                isConsultation ? "is-consultation" : "is-intake"
              }`}
            >
              <span className="rtm-public-family-boundary-icon" aria-hidden="true">
                {isConsultation ? "🧭" : "✓"}
              </span>
              <div>
                <strong>
                  {isConsultation
                    ? "Consulta de encaje antes de crear un expediente"
                    : "Entrada real por reclamación de consumo"}
                </strong>
                <p>
                  {landing.notice ||
                    "Esta familia abre el tipo de expediente que el backend reconoce actualmente. Los subasuntos orientan la revisión, pero no se presentan como tipos técnicos independientes."}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rtm-public-family-section rtm-public-family-section--soft">
          <div className="rtm-public-family-container rtm-public-family-work-grid">
            <div>
              <div className="rtm-public-family-heading is-left">
                <span>Proceso claro</span>
                <h2>Cómo trabajamos contigo</h2>
                <p>Un recorrido comprensible desde la primera información hasta la decisión.</p>
              </div>

              <div className="rtm-public-family-process">
                {PROCESS_STEPS.map(([number, title, text]) => (
                  <article key={number}>
                    <span>{number}</span>
                    <div>
                      <h3>{title}</h3>
                      <p>{text}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <aside className="rtm-public-family-documents">
              <div className="rtm-public-family-documents-icon" aria-hidden="true">📂</div>
              <span className="rtm-public-family-kicker">Para empezar</span>
              <h2>Documentación útil</h2>
              <ul>
                {landing.documents.map((document) => (
                  <li key={document}>
                    <span aria-hidden="true">✓</span>
                    <span>{document}</span>
                  </li>
                ))}
              </ul>
              <p>No pasa nada si todavía no lo tienes todo. Empieza con el documento principal.</p>
            </aside>
          </div>
        </section>

        <section className="rtm-public-family-final-section">
          <div className="rtm-public-family-container">
            <div className="rtm-public-family-final">
              <div className="rtm-public-family-final-icon" aria-hidden="true">
                {family.icon}
              </div>
              <div>
                <span>{isConsultation ? "Consulta previa" : "Primer paso"}</span>
                <h2>{landing.closingTitle}</h2>
                <p>{landing.closingText}</p>
              </div>
              <Link className="rtm-public-family-primary" to={family.startPath}>
                {family.startLabel}
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
