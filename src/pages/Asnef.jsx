import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";

const SITUATIONS = [
  ["✅", "Deuda pagada", "La deuda se abonó, pero la inclusión continúa apareciendo."],
  ["👤", "Datos incorrectos", "El titular, el importe u otros datos no coinciden con la realidad."],
  ["✉️", "Comunicación discutida", "No consta el aviso previo o necesitas revisar cómo se comunicó la deuda."],
  ["❓", "Deuda no reconocida", "No reconoces el origen o mantienes una discrepancia con el acreedor."],
];

export default function Asnef() {
  return (
    <>
      <Seo
        title="ASNEF y ficheros de morosidad · RTM"
        description="Revisamos la anotación, comprobamos si procede y preparamos la solicitud de rectificación o supresión frente al acreedor y al fichero."
        canonical="https://www.recurretumulta.eu/asnef"
      />

      <main className="rtm-asnef-page">
        <section className="rtm-asnef-hero">
          <div className="sr-container rtm-asnef-grid">
            <div>
              <div className="rtm-asnef-badge">Revisión inicial del caso</div>
              <h1>¿Apareces en ASNEF u otro fichero de morosidad?</h1>
              <p>
                Analizamos la anotación, comprobamos si cumple los requisitos legales y,
                cuando procede, preparamos la solicitud de rectificación o supresión en tu nombre.
              </p>

              <div className="rtm-asnef-actions">
                <Link to="/iniciar-expediente/debt/asnef_equifax?family=morosidad" className="rtm-asnef-primary">
                  Comprobar mi situación
                </Link>
                <Link to="/morosidad" className="rtm-asnef-secondary">
                  Ver deudas y morosidad
                </Link>
              </div>
            </div>

            <aside className="rtm-asnef-card">
              <h2>Documentación inicial</h2>
              <ul>
                <li>Documento donde aparece la inclusión.</li>
                <li>DNI o NIE del interesado.</li>
                <li>Comunicaciones del acreedor.</li>
                <li>Justificante de pago, reclamación o discrepancia, si existe.</li>
              </ul>
              <p>
                La baja no puede garantizarse sin revisar previamente el origen,
                exigibilidad y comunicación de la deuda.
              </p>
            </aside>
          </div>
        </section>

        <section className="rtm-asnef-content rtm-asnef-content--situations">
          <div className="sr-container">
            <span className="rtm-asnef-section-kicker">Situaciones habituales</span>
            <h2>¿Qué necesitas comprobar?</h2>
            <p className="rtm-asnef-section-lead">
              La causa concreta se explicará dentro del expediente. El tipo técnico se
              mantiene como ASNEF / Equifax para que el backend lo reciba correctamente.
            </p>
            <div className="rtm-asnef-situations">
              {SITUATIONS.map(([icon, title, text]) => (
                <article key={title}>
                  <span aria-hidden="true">{icon}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="iniciar" className="rtm-asnef-content">
          <div className="sr-container">
            <h2>Cómo trabajamos</h2>
            <div className="rtm-asnef-steps">
              <article>
                <strong>1</strong>
                <h3>Revisamos la inclusión</h3>
                <p>Comprobamos deuda, acreedor, notificación previa y datos publicados.</p>
              </article>
              <article>
                <strong>2</strong>
                <h3>Definimos la vía correcta</h3>
                <p>Pago acreditado, deuda discutida, datos incorrectos, caducidad o falta de requisitos.</p>
              </article>
              <article>
                <strong>3</strong>
                <h3>Preparamos la solicitud</h3>
                <p>Generamos la reclamación y la autorización para actuar en representación del cliente.</p>
              </article>
            </div>

            <div className="rtm-asnef-final">
              <div>
                <span>Primer paso</span>
                <h2>Comprueba la inclusión con la documentación delante</h2>
                <p>
                  Abriremos el expediente ASNEF / Equifax y conservaremos el área
                  Deudas y ASNEF de forma explícita.
                </p>
              </div>
              <Link to="/iniciar-expediente/debt/asnef_equifax?family=morosidad">
                Iniciar revisión
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
