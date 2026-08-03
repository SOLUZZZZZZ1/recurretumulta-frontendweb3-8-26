import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";

export default function Asnef() {
  return (
    <>
      <Seo
        title="Salir de ASNEF y ficheros de morosidad · RecurreTuMulta"
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
                <Link to="/deudas/iniciar" className="rtm-asnef-primary">
                  Comprobar mi situación
                </Link>
                <Link to="/contacto" className="rtm-asnef-secondary">
                  Resolver una duda
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
          </div>
        </section>
      </main>
    </>
  );
}
