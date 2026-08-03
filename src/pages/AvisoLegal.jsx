import Seo from "../components/Seo.jsx";

export default function AvisoLegal() {
  return (
    <>
      <Seo
        title="Aviso legal · RecurreTuMulta"
        description="Aviso legal del sitio web RecurreTuMulta."
        canonical="https://www.recurretumulta.eu/aviso-legal"
      />

      <main className="sr-container py-12">
        <h1 className="sr-h1 mb-4">Aviso legal</h1>

        <div className="sr-card">
          <p className="sr-p">
            En cumplimiento de la Ley 34/2002 (LSSI-CE), se informa de que el sitio web
            <b> recurretumulta.eu</b> es titularidad de:
          </p>

          <ul className="sr-p list-disc pl-5">
            <li><b>Titular:</b> LA TALAMANQUINA, S.L.</li>
            <li><b>NIF:</b> B75440115</li>
            <li><b>Domicilio social:</b> Calle Velázquez, 15 – 28001 Madrid (España)</li>
            <li><b>Correo electrónico:</b> info@recurretumulta.eu</li>
          </ul>

          <p className="sr-p mt-4">
            RecurreTuMulta opera como plataforma tecnológica de asistencia administrativa y
            no sustituye el asesoramiento jurídico individualizado.
          </p>
        </div>
      </main>
    </>
  );
}