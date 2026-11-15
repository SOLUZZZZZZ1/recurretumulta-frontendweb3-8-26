import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import { FINE_OFFER } from "../lib/fineOffer.js";
import "./RevisionMulta.css";

const intakePath = "/iniciar-expediente/traffic/fine";
const documents = [
  ["La notificación de la multa", "Una copia completa y legible, con todas sus páginas. Indica cuándo y cómo la recibiste y cualquier fecha límite que figure en ella."],
  ["Tus datos y documento de identidad", "El alta solicita tus datos de contacto, domicilio y las dos caras del documento de identidad."],
  ["La autorización RTM firmada", "Se genera al crear el expediente. La descargas, la firmas y la adjuntas para continuar."],
  ["Lo que ayude a entender tu caso", "Si tienes justificantes, fotografías, comunicaciones o alegaciones anteriores, podrás añadirlos al expediente."],
];

const steps = [
  ["Abre tu expediente", "Completa el alta guiada con tus datos y documento de identidad. Revisa la información antes de enviarla."],
  ["Firma y adjunta", "Descarga y firma la autorización. Después añade la notificación y los documentos del caso."],
  ["Paga la revisión inicial", "El pago de 10 € aparece después de aportar la autorización y la documentación. Una persona del equipo revisará el expediente."],
  ["Conoce tus opciones", "Te explicamos la valoración. Si se propone una actuación posterior, recibirás su alcance y presupuesto antes de decidir."],
];

function StartReview({ children = "Iniciar revisión por 10 €" }) {
  return <Link className="fine-landing-cta" to={intakePath}>{children}<span aria-hidden="true">→</span></Link>;
}

export default function RevisionMulta() {
  return (
    <>
      <Seo title="Revisión de multas por 10 € · Resuelve tus movidas" description="Una persona de Resuelve tus movidas revisa tu multa y documentación por 10 €. Conoce qué incluye y qué necesitas. Los recursos se presupuestan aparte." canonical="https://www.resuelvetusmovidas.es/revision-multa" />
      <main className="fine-landing">
        <section className="fine-landing-hero" aria-labelledby="fine-title">
          <div className="fine-landing-container fine-landing-hero-grid">
            <div>
              <p className="fine-landing-eyebrow">RTM · Revisión documental de multas</p>
              <h1 id="fine-title">Has recibido una multa.<br /><span>Entiende tus opciones antes de decidir.</span></h1>
              <p className="fine-landing-lead">Revisamos la notificación y la documentación que aportes para explicarte qué opciones y limitaciones apreciamos en tu caso.</p>
              <div className="fine-landing-hero-action"><StartReview /><p>Estudio inicial. La redacción y presentación de recursos se presupuestan aparte.</p></div>
              <ul className="fine-landing-benefits">
                <li>Revisión por una persona del equipo</li>
                <li>Documentos reunidos en un expediente</li>
                <li>Presupuesto previo para cualquier actuación posterior</li>
              </ul>
              <a className="fine-landing-text-link" href="#documentacion">Ver qué documentación necesitas <span aria-hidden="true">↓</span></a>
            </div>
            <aside className="fine-landing-offer" aria-label="Precio y alcance de la revisión inicial">
              <p className="fine-landing-offer-label">Revisión inicial del expediente</p>
              <p className="fine-landing-price">10 <span>€</span></p>
              <p className="fine-landing-offer-description">Estudio documental para valorar el siguiente paso.</p>
              <ul>
                <li>Estudio de la documentación aportada</li>
                <li>Organización del expediente</li>
                <li>Explicación de opciones y limitaciones</li>
              </ul>
              <p className="fine-landing-offer-boundary"><strong>Redactar o presentar un recurso se presupuesta aparte.</strong></p>
              <StartReview />
              <p className="fine-landing-offer-note">Primero completarás el alta y aportarás la documentación. El pago se realiza después.</p>
            </aside>
          </div>
        </section>

        <section className="fine-landing-section" aria-labelledby="scope-title">
          <div className="fine-landing-container">
            <p className="fine-landing-eyebrow">El alcance, claro desde el principio</p>
            <h2 id="scope-title">Qué cubren los 10 €</h2>
            <div className="fine-landing-scope-grid">
              <div>
                <h3>El estudio inicial de tu caso</h3>
                <p>Estudiamos tus documentos, organizamos el expediente y valoramos la fase en la que se encuentra el asunto. Después te explicamos nuestra valoración y el siguiente paso posible, con las limitaciones que apreciamos.</p>
              </div>
              <div className="fine-landing-scope-separate">
                <h3>Las actuaciones posteriores, aparte</h3>
                <p>{FINE_OFFER.exclusions}</p>
              </div>
            </div>
            <p className="fine-landing-credit"><strong>Si decides continuar:</strong> los 10 € de la revisión se descuentan íntegramente del presupuesto que aceptes. Cualquier actuación posterior comienza después de tu aceptación.</p>
          </div>
        </section>

        <section className="fine-landing-team" aria-labelledby="team-title">
          <div className="fine-landing-container fine-landing-team-grid">
            <div>
              <p className="fine-landing-eyebrow">Personas y tecnología</p>
              <h2 id="team-title">Una persona del equipo RTM revisa tu expediente.</h2>
            </div>
            <div>
              <p>Las herramientas de inteligencia artificial ayudan a ordenar la documentación y localizar datos relevantes. Una persona del equipo revisa esa información, valora el caso y te explica las opciones y limitaciones que aprecia.</p>
              <p className="fine-landing-identity">RTM es un servicio de <strong>LA TALAMANQUINA, S.L.</strong> · NIF B75440115.</p>
              <div className="fine-landing-inline-links"><Link to="/como-funciona">Cómo trabajamos</Link><Link to="/aviso-legal">Datos del titular</Link></div>
            </div>
          </div>
        </section>

        <section id="documentacion" className="fine-landing-section" aria-labelledby="documents-title">
          <div className="fine-landing-container">
            <p className="fine-landing-eyebrow">Antes de empezar</p>
            <h2 id="documents-title">Prepara estos documentos</h2>
            <p className="fine-landing-section-intro">El alta te irá indicando qué aportar en cada paso.</p>
            <ul className="fine-landing-documents">
              {documents.map(([title, description], index) => <li key={title}><span className="fine-landing-document-number" aria-hidden="true">0{index + 1}</span><div><h3>{title}</h3><p>{description}</p></div></li>)}
            </ul>
          </div>
        </section>

        <section className="fine-landing-process" aria-labelledby="process-title">
          <div className="fine-landing-container">
            <p className="fine-landing-eyebrow">Cómo continúa tu expediente</p>
            <h2 id="process-title">Un paso cada vez.</h2>
            <ol className="fine-landing-steps">
              {steps.map(([title, description], index) => <li key={title}><span aria-hidden="true">{index + 1}</span><h3>{title}</h3><p>{description}</p></li>)}
            </ol>
          </div>
        </section>

        <section className="fine-landing-section" aria-labelledby="questions-title">
          <div className="fine-landing-container fine-landing-questions">
            <h2 id="questions-title">Antes de decidir</h2>
            <details><summary>¿La revisión garantiza que se anule la multa?</summary><p>No. El estudio permite valorar la documentación y las opciones disponibles. El resultado de una actuación posterior no puede garantizarse.</p></details>
            <details><summary>¿Tengo que contratar después un recurso?</summary><p>No. Recibirás primero nuestra valoración. Si se propone una gestión posterior, conocerás su alcance y presupuesto y decidirás si quieres aceptarlos.</p></details>
            <details><summary>¿Puedo volver después de firmar la autorización?</summary><p>Sí. Una vez creado el expediente, puedes volver a su página o recuperarlo desde el inicio con su número. Así continúas en el mismo expediente.</p></details>
            <details><summary>¿Dónde puedo preguntar antes de empezar?</summary><p>Escríbenos a <a href="mailto:info@resuelvetusmovidas.es">info@resuelvetusmovidas.es</a> para consultar cómo funciona el servicio.</p></details>
          </div>
        </section>

        <section className="fine-landing-final" aria-labelledby="start-title">
          <div className="fine-landing-container fine-landing-final-inner">
            <div><h2 id="start-title">Empieza por una revisión de 10 €.</h2><p>Abre tu expediente y aporta la documentación. Conocerás la valoración antes de decidir sobre cualquier actuación posterior.</p></div>
            <StartReview />
          </div>
        </section>
      </main>
    </>
  );
}
