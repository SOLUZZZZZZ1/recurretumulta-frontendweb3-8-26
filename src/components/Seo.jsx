import { Helmet } from "react-helmet-async";

export default function Seo({
  title = "RTM · Resuelve tus movidas",
  description = "RTM ayuda a comprender y gestionar problemas de tráfico, viajes, deudas y trámites con la Administración.",
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
      <meta property="og:site_name" content="RTM · Resuelve tus movidas" />
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
