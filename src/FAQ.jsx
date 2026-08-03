// src/pages/FAQ.jsx — RecurreTuMulta
import React from "react";
import Seo from "../components/Seo.jsx";
import { Link } from "react-router-dom";

function Item({ q, children }) {
  return (
    <div className="sr-card" style={{ marginBottom: 12 }}>
      <h2 className="sr-h3" style={{ marginBottom: 8 }}>
        {q}
      </h2>
      <div className="sr-p" style={{ color: "#111827" }}>
        {children}
      </div>
    </div>
  );
}

export default function FAQ() {
  return (
    <>
      <Seo
        title="FAQ · RecurreTuMulta"
        description="Preguntas frecuentes sobre cómo recurrir multas administrativas con RecurreTuMulta."
        canonical="https://www.recurretumulta.eu/faq"
      />

      <main className="sr-container py-12" style={{ minHeight: "calc(100vh - 160px)" }}>
        <h1 className="sr-h1 mb-3">Preguntas frecuentes</h1>
        <p className="sr-p mb-6" style={{ maxWidth: 900 }}>
          Resolvemos las dudas más comunes. Si no encuentras lo que necesitas, escríbenos desde{" "}
          <Link to="/contacto" className="text-sky-700 underline">
            Contacto
          </Link>.
        </p>

        <Item q="¿Es legal recurrir una multa así?">
          Sí. Recurrir es un derecho del ciudadano en vía administrativa. RecurreTuMulta te asiste
          en la preparación y tramitación del escrito, con control de plazos.
        </Item>

        <Item q="¿Sois abogados? ¿Dáis asesoramiento jurídico?">
          No. RecurreTuMulta es una plataforma tecnológica de asistencia administrativa. No
          prestamos asesoramiento jurídico individualizado ni garantizamos resultados.
        </Item>

        <Item q="¿Qué tipo de multas puedo recurrir?">
          Multas y sanciones administrativas (por ejemplo, tráfico, sanciones municipales y, en
          determinados casos, procedimientos vinculados a Hacienda o Seguridad Social). Si el documento
          no es recurrible o faltan datos esenciales, te lo indicaremos.
        </Item>

        <Item q="¿Qué necesito para empezar?">
          Una foto, escaneo o PDF de la multa/resolución. Si hay varias páginas, súbelas en un solo PDF
          (o empieza por la página principal).
        </Item>

        <Item q="¿Cómo calculáis los plazos?">
          Extraemos la fecha de notificación y el tipo de acto del documento y aplicamos reglas del
          procedimiento administrativo. Si la fecha no se ve con claridad, te pediremos confirmación.
        </Item>

        <Item q="¿Y si ya he pagado la multa?">
          Depende del procedimiento. En algunas sanciones, el pago con reducción puede implicar renuncia
          al recurso. Sube el documento y lo revisamos: te diremos qué opciones quedan.
        </Item>

        <Item q="¿Qué pasa si el recurso es desestimado o hay silencio?">
          Si eliges un plan con seguimiento, te avisamos del siguiente paso posible. En caso de silencio
          administrativo o desestimación, puede proceder un recurso posterior o, en su caso, la vía judicial.
        </Item>

        <Item q="¿Presentáis el recurso por mí?">
          Si , podemos  presentarlo en tu nombre
          (con justificante) si eliges la opción correspondiente y se cumplen los requisitos de representación.
        </Item>

        <Item q="¿Mis datos están protegidos?">
          Tratamos los datos con medidas razonables de seguridad. Te recomendamos no incluir información
          innecesaria. Para más detalle, consulta{" "}
          <Link to="/privacidad" className="text-sky-700 underline">
            Privacidad
          </Link>{" "}
          y{" "}
          <Link to="/cookies" className="text-sky-700 underline">
            Cookies
          </Link>.
        </Item>

        <div className="sr-card" style={{ marginTop: 16, textAlign: "center" }}>
          <h2 className="sr-h2" style={{ marginBottom: 8 }}>
            ¿Listo para empezar?
          </h2>
          <p className="sr-p" style={{ marginBottom: 14 }}>
            Sube tu multa y obtén un análisis inicial en minutos.
          </p>
          <div className="sr-cta-row" style={{ justifyContent: "center", marginTop: 0 }}>
            <Link to="/" className="sr-btn-primary">
              Subir mi multa
            </Link>
            <Link to="/precios" className="sr-btn-secondary">
              Ver precios
            </Link>
          </div>
          <p className="sr-p" style={{ marginTop: 14, fontSize: 13 }}>
            Nota: RecurreTuMulta no presta asesoramiento jurídico ni garantiza resultados.
          </p>
        </div>
      </main>
    </>
  );
}
