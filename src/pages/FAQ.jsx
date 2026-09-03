import React, { useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";

const FAQ_GROUPS = [
  {
    title: "Revisión inicial",
    icon: "🔎",
    items: [
      {
        q: "¿Qué es la Revisión Inicial del Expediente?",
        a: "Es el primer servicio de RTM. Revisamos la información y la documentación disponibles para determinar si apreciamos una vía razonable de actuación y cuál debería ser el siguiente paso.",
      },
      {
        q: "¿La revisión inicial significa que ya habéis iniciado una reclamación o un recurso?",
        a: "No. La revisión inicial y la gestión posterior son servicios distintos. No presentamos escritos, recursos ni reclamaciones hasta que exista una propuesta de actuación y la aceptes expresamente.",
      },
      {
        q: "¿Qué recibiré al terminar la revisión?",
        a: "Podrás consultar la Revisión Inicial de tu Expediente, donde te indicaremos la situación apreciada con la información disponible, si necesitamos documentación adicional y cuál es el siguiente paso recomendado.",
      },
      {
        q: "¿La revisión inicial tiene vigencia?",
        a: "Sí. Se realiza con la documentación, las circunstancias y los plazos existentes en una fecha concreta. Su periodo de vigencia se mostrará en el expediente. Si se supera y quieres continuar, será necesario iniciar una nueva revisión.",
      },
    ],
  },
  {
    title: "Precios y pagos",
    icon: "💶",
    items: [
      {
        q: "¿Cuánto cuesta empezar?",
        a: "El importe vigente se muestra dentro de cada expediente mediante una cotización del servidor, antes de iniciar cualquier pago.",
      },
      {
        q: "¿Se descuenta el importe de la revisión inicial?",
        a: "Sí. Si posteriormente contratas la gestión correspondiente, el importe abonado por la Revisión Inicial del Expediente se descontará íntegramente del precio del servicio contratado.",
      },
      {
        q: "¿Todos los servicios tienen un precio fijo?",
        a: "No. Algunas actuaciones tienen una tarifa publicada. Los procedimientos complejos, judiciales o que requieran un estudio específico se realizan mediante presupuesto previo.",
      },
      {
        q: "¿Pagar la revisión inicial me obliga a continuar?",
        a: "No. Una vez recibida la revisión podrás decidir si deseas continuar. La gestión posterior solo comienza con tu aceptación expresa.",
      },
    ],
  },
  {
    title: "Expediente y documentación",
    icon: "📁",
    items: [
      {
        q: "¿Se guardan los datos que voy introduciendo?",
        a: "Sí. La información queda vinculada al expediente para que puedas continuar sin volver a rellenar desde cero los datos ya registrados.",
      },
      {
        q: "¿Cómo continúo un expediente que ya había empezado?",
        a: "Puedes utilizar la opción Continuar expediente e introducir el número de expediente o el código interno. El sistema te llevará al punto correspondiente del proceso.",
      },
      {
        q: "¿Qué ocurre si falta documentación?",
        a: "El expediente quedará pendiente de documentación y te indicaremos qué archivo o información necesitamos para continuar.",
      },
      {
        q: "¿Puedo añadir documentos nuevos más adelante?",
        a: "Sí. Los nuevos documentos se incorporarán al historial del expediente. Si cambian la situación analizada, podrá ser necesaria una nueva revisión.",
      },
    ],
  },
  {
    title: "Gestión, autorización y plazos",
    icon: "🗓️",
    items: [
      {
        q: "¿Podéis presentar una actuación en mi nombre?",
        a: "Sí, cuando el servicio contratado lo incluya y exista una autorización válida para actuar en tu nombre.",
      },
      {
        q: "¿Garantizáis que el recurso o la reclamación se resolverá a mi favor?",
        a: "No. RTM analiza la información disponible y propone una vía razonable de actuación, pero el resultado puede depender de administraciones, organismos, empresas o tribunales.",
      },
      {
        q: "¿Cómo se controlan los plazos?",
        a: "Los plazos y las próximas actuaciones quedan asociados al expediente. Cuando necesitemos una acción por tu parte, aparecerá indicada en el estado del expediente.",
      },
      {
        q: "¿Qué ocurre mientras esperamos una respuesta externa?",
        a: "El expediente permanecerá en espera de la resolución o respuesta correspondiente. El historial conservará las actuaciones realizadas y el siguiente paso previsto.",
      },
    ],
  },
];

function Question({ item, isOpen, onToggle }) {
  return (
    <article
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 16,
        background: "#fff",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        style={{
          width: "100%",
          minHeight: 58,
          padding: "16px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          border: 0,
          background: "#fff",
          color: "#0f172a",
          textAlign: "left",
          font: "inherit",
          fontSize: 17,
          fontWeight: 850,
          cursor: "pointer",
        }}
      >
        <span>{item.q}</span>
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0,
            color: "#0b4aa2",
            fontSize: 22,
            lineHeight: 1,
          }}
        >
          {isOpen ? "−" : "+"}
        </span>
      </button>

      {isOpen ? (
        <div
          style={{
            padding: "0 18px 18px",
            color: "#64748b",
            lineHeight: 1.65,
          }}
        >
          {item.a}
        </div>
      ) : null}
    </article>
  );
}

export default function FAQ() {
  const [openKey, setOpenKey] = useState("0-0");

  return (
    <>
      <Seo
        title="Preguntas frecuentes · RTM"
        description="Respuestas sobre la revisión inicial, precios, expediente, documentación, autorizaciones y plazos en RTM."
      />

      <main
        style={{
          minHeight: "calc(100vh - 120px)",
          padding: "54px 20px 72px",
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <div style={{ width: "100%", maxWidth: 980, margin: "0 auto" }}>
          <header
            style={{
              maxWidth: 760,
              margin: "0 auto 34px",
              textAlign: "center",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                marginBottom: 15,
                padding: "7px 12px",
                borderRadius: 999,
                background: "#dbeafe",
                color: "#1d4ed8",
                fontSize: 14,
                fontWeight: 850,
              }}
            >
              Ayuda
            </span>

            <h1
              style={{
                margin: "0 0 14px",
                fontSize: "clamp(36px, 5vw, 56px)",
                lineHeight: 1.04,
                letterSpacing: "-.04em",
                fontWeight: 950,
              }}
            >
              Preguntas frecuentes
            </h1>

            <p
              style={{
                margin: 0,
                color: "#64748b",
                fontSize: "clamp(17px, 2vw, 20px)",
                lineHeight: 1.6,
              }}
            >
              Lo esencial para saber cómo empieza, continúa y termina un
              expediente en RTM.
            </p>
          </header>

          <div style={{ display: "grid", gap: 24 }}>
            {FAQ_GROUPS.map((group, groupIndex) => (
              <section key={group.title}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 11,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 42,
                      height: 42,
                      display: "grid",
                      placeItems: "center",
                      borderRadius: 13,
                      background: "#dbeafe",
                      fontSize: 21,
                    }}
                  >
                    {group.icon}
                  </span>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 25,
                      fontWeight: 950,
                    }}
                  >
                    {group.title}
                  </h2>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  {group.items.map((item, itemIndex) => {
                    const key = `${groupIndex}-${itemIndex}`;
                    return (
                      <Question
                        key={item.q}
                        item={item}
                        isOpen={openKey === key}
                        onToggle={() =>
                          setOpenKey((current) => (current === key ? "" : key))
                        }
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <section
            style={{
              marginTop: 30,
              padding: 25,
              borderRadius: 22,
              background: "#0f172a",
              color: "#fff",
              textAlign: "center",
            }}
          >
            <h2 style={{ margin: "0 0 9px", fontSize: 25, fontWeight: 950 }}>
              ¿Tu pregunta no aparece aquí?
            </h2>
            <p
              style={{
                margin: "0 0 18px",
                color: "rgba(255,255,255,.76)",
                lineHeight: 1.55,
              }}
            >
              Escríbenos y explícanos qué necesitas.
            </p>
            <Link
              to="/contacto"
              style={{
                minHeight: 48,
                padding: "13px 19px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 13,
                background: "#2bb673",
                color: "#fff",
                textDecoration: "none",
                fontWeight: 900,
              }}
            >
              Ir a Contacto
            </Link>
          </section>
        </div>
      </main>
    </>
  );
}
