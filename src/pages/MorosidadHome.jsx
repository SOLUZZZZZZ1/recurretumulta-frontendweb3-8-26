import { useNavigate } from "react-router-dom";

export default function MorosidadHome() {
  const navigate = useNavigate();

  const iniciarRevision = () => {
    navigate("/iniciar-expediente/debt/asnef_equifax");
  };

  return (
    <main
      style={{
        minHeight: "calc(100vh - 120px)",
        padding: "48px 18px 72px",
        background:
          "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #0f766e 100%)",
      }}
    >
      <section
        style={{
          maxWidth: 1040,
          margin: "0 auto",
          padding: "34px 26px",
          borderRadius: 28,
          background: "rgba(255,255,255,.98)",
          boxShadow: "0 24px 70px rgba(15,23,42,.35)",
        }}
      >
        <header style={{ maxWidth: 820, marginBottom: 30 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 13px",
              marginBottom: 16,
              borderRadius: 999,
              background: "#dbeafe",
              color: "#1d4ed8",
              fontWeight: 900,
            }}
          >
            💳 Deudas y morosidad
          </div>

          <h1
            style={{
              margin: "0 0 16px",
              fontSize: "clamp(36px, 5vw, 54px)",
              lineHeight: 1.04,
              letterSpacing: "-.04em",
              color: "#0f172a",
            }}
          >
            Revisamos tu situación antes de actuar
          </h1>

          <p
            style={{
              margin: 0,
              color: "#475569",
              fontSize: 18,
              lineHeight: 1.7,
            }}
          >
            Estudiaremos la documentación que nos facilites para comprobar si
            la inclusión en un fichero de morosidad cumple los requisitos
            legales y valorar las posibilidades reales de actuación.
          </p>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: 16,
            marginBottom: 26,
          }}
        >
          <InfoCard
            icon="🔎"
            title="Analizamos el caso"
            text="Revisamos la anotación, la deuda, las comunicaciones recibidas y la documentación disponible."
          />
          <InfoCard
            icon="⚖️"
            title="Te explicamos las opciones"
            text="Te informamos con claridad sobre la viabilidad, los riesgos y las posibles actuaciones."
          />
          <InfoCard
            icon="🧾"
            title="Presupuesto previo"
            text="Cuando la gestión sea viable, recibirás una propuesta antes de iniciar cualquier actuación."
          />
        </section>

        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>¿Qué situaciones revisamos?</h2>

          <div style={twoColumnsStyle}>
            <CheckItem text="Inclusiones en ASNEF, Equifax, BADEXCUG o Experian." />
            <CheckItem text="Deudas ya pagadas que continúan apareciendo." />
            <CheckItem text="Errores de identidad o datos incorrectos." />
            <CheckItem text="Falta de comunicación o requerimiento previo." />
            <CheckItem text="Importes discutidos o no reconocidos." />
            <CheckItem text="Anotaciones que pueden incumplir los requisitos legales." />
            <CheckItem text="Reclamaciones frente a acreedores o entidades." />
            <CheckItem text="Solicitudes de acceso, rectificación o supresión." />
          </div>
        </section>

        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>¿Cómo trabajamos?</h2>

          <div style={{ display: "grid", gap: 12 }}>
            <Step
              number="1"
              title="Abrimos tu expediente RTM"
              text="Recogemos tus datos y la documentación disponible."
            />
            <Step
              number="2"
              title="Estudiamos la situación"
              text="Revisamos el origen de la deuda, la anotación y las comunicaciones recibidas."
            />
            <Step
              number="3"
              title="Te informamos con claridad"
              text="Te explicamos si existe una vía razonable de actuación y qué documentación puede faltar."
            />
            <Step
              number="4"
              title="Recibes una propuesta"
              text="Cuando proceda, recibirás un presupuesto detallado y sin compromiso."
            />
            <Step
              number="5"
              title="Solo actuamos si lo aceptas"
              text="La gestión comienza únicamente después de tu aceptación expresa."
            />
          </div>
        </section>

        <section
          style={{
            marginBottom: 22,
            padding: 20,
            border: "1px solid #bbf7d0",
            borderRadius: 18,
            background: "#f0fdf4",
            color: "#166534",
          }}
        >
          <div style={{ fontWeight: 950, fontSize: 18, marginBottom: 8 }}>
            Puedes enviarnos el caso con tranquilidad
          </div>

          <p style={{ margin: 0, lineHeight: 1.65 }}>
            El envío de la documentación no implica la contratación del
            servicio. Antes de realizar cualquier actuación te informaremos de
            las posibilidades del caso y, cuando corresponda, del presupuesto.
          </p>
        </section>

        <section
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
            padding: 22,
            borderRadius: 20,
            background: "#0f172a",
            color: "#fff",
          }}
        >
          <div style={{ maxWidth: 650 }}>
            <h2 style={{ margin: "0 0 7px", fontSize: 25 }}>
              Solicita una revisión inicial de tu caso
            </h2>
            <p style={{ margin: 0, color: "#cbd5e1", lineHeight: 1.55 }}>
              Abriremos el expediente, recibiremos la documentación y te
              indicaremos los siguientes pasos.
            </p>
          </div>

          <div style={{ textAlign: "center" }}>
            <button
              type="button"
              onClick={iniciarRevision}
              style={{
                minHeight: 54,
                padding: "14px 22px",
                border: 0,
                borderRadius: 14,
                background: "#22c55e",
                color: "#fff",
                fontSize: 16,
                fontWeight: 950,
                cursor: "pointer",
                boxShadow: "0 12px 26px rgba(34,197,94,.25)",
              }}
            >
              Solicitar revisión de mi caso
            </button>

            <div
              style={{
                marginTop: 8,
                color: "#cbd5e1",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Sin compromiso
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function InfoCard({ icon, title, text }) {
  return (
    <article
      style={{
        padding: 20,
        border: "1px solid #e2e8f0",
        borderRadius: 18,
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 30, marginBottom: 10 }}>{icon}</div>
      <h3 style={{ margin: "0 0 8px", fontSize: 19, color: "#0f172a" }}>
        {title}
      </h3>
      <p style={{ margin: 0, color: "#64748b", lineHeight: 1.55 }}>{text}</p>
    </article>
  );
}

function CheckItem({ text }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        padding: "11px 12px",
        borderRadius: 13,
        background: "#f8fafc",
        color: "#334155",
        lineHeight: 1.5,
      }}
    >
      <span style={{ color: "#16a34a", fontWeight: 950 }}>✓</span>
      <span>{text}</span>
    </div>
  );
}

function Step({ number, title, text }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "44px minmax(0, 1fr)",
        gap: 14,
        alignItems: "start",
        padding: 14,
        border: "1px solid #e2e8f0",
        borderRadius: 15,
        background: "#fff",
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          display: "grid",
          placeItems: "center",
          borderRadius: "50%",
          background: "#dbeafe",
          color: "#1d4ed8",
          fontWeight: 950,
        }}
      >
        {number}
      </div>

      <div>
        <div style={{ fontWeight: 950, color: "#0f172a", marginBottom: 4 }}>
          {title}
        </div>
        <div style={{ color: "#64748b", lineHeight: 1.5 }}>{text}</div>
      </div>
    </div>
  );
}

const panelStyle = {
  marginBottom: 22,
  padding: 22,
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  background: "#fff",
};

const sectionTitleStyle = {
  margin: "0 0 16px",
  fontSize: 25,
  color: "#0f172a",
};

const twoColumnsStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 10,
};
