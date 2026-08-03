import { Helmet } from "react-helmet-async";

export default function Seo({
  title = "RecurreTuMulta | Asistencia administrativa para recurrir sanciones",
  description = "Recurrimos sanciones administrativas de forma clara y eficiente. Tráfico, ayuntamientos, hacienda y más. Análisis rápido y tramitación completa.",
  canonical = "https://www.recurretumulta.eu/",
  image = "https://www.recurretumulta.eu/og-recurretumulta.png?v=2",
  noindex = false,
}) {
  return (
    <Helmet>
      {/* Básico */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      {/* Robots */}
      {noindex && <meta name="robots" content="noindex,nofollow" />}

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="RecurreTuMulta" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={image} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
}