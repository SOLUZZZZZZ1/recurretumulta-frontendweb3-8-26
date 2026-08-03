import Seo from "../components/Seo.jsx";

export default function Privacidad() {
  return (
    <>
      <Seo
        title="Privacidad · RecurreTuMulta"
        description="Política de privacidad conforme al RGPD."
        canonical="https://www.recurretumulta.eu/privacidad"
      />

      <main className="sr-container py-12">
        <h1 className="sr-h1 mb-4">Política de privacidad</h1>

        <div className="sr-card">
          <p className="sr-p">
            El responsable del tratamiento de los datos es <b>LA TALAMANQUINA, S.L.</b>.
          </p>

          <p className="sr-p">
            Los datos personales se tratan únicamente para la prestación del servicio
            solicitado y las comunicaciones relacionadas con el expediente.
          </p>

          <p className="sr-p">
            Puedes ejercer tus derechos escribiendo a
            <a href="mailto:info@recurretumulta.eu"> info@recurretumulta.eu</a>.
          </p>
        </div>
      </main>
    </>
  );
}