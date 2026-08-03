import Seo from "../components/Seo.jsx";

export default function Cookies() {
  return (
    <>
      <Seo
        title="Cookies · RecurreTuMulta"
        description="Política de cookies del sitio web."
        canonical="https://www.recurretumulta.eu/cookies"
      />

      <main className="sr-container py-12">
        <h1 className="sr-h1 mb-4">Política de cookies</h1>

        <div className="sr-card">
          <p className="sr-p">
            Este sitio web utiliza cookies técnicas necesarias para su correcto funcionamiento.
          </p>

          <p className="sr-p">
            No se utilizan cookies publicitarias ni de seguimiento invasivo.
          </p>
        </div>
      </main>
    </>
  );
}