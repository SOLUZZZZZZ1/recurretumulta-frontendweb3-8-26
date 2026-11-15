import { Helmet } from "react-helmet-async";
import { publicOrigin, publicUrl } from '../lib/publicSite.js';

export default function Seo({
  title = "Resuelve tus movidas | Multas y trámites administrativos",
  description = "Resuelve tus movidas: revisión de multas, deudas y trámites administrativos. Estudiamos tus documentos y te explicamos las opciones antes de continuar.",
  canonical = "https://www.resuelvetusmovidas.es/",
  image = "https://www.resuelvetusmovidas.es/og-cover.jpg",
  noindex = false,
}) {
  canonical = publicUrl(canonical);
  image = publicUrl(image);
  const origin = publicOrigin();
  const organizationId = `${origin}/#organization`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: "LA TALAMANQUINA, S.L.",
        legalName: "LA TALAMANQUINA, S.L.",
        alternateName: ["Resuelve tus movidas", "RTM"],
        url: `${origin}/`,
        logo: `${origin}/rtm-logo-transparente-recortado.png`,
        taxID: "B75440115",
        email: "info@resuelvetusmovidas.es",
        address: {
          "@type": "PostalAddress",
          streetAddress: "Calle Velázquez, 15",
          postalCode: "28001",
          addressLocality: "Madrid",
          addressCountry: "ES",
        },
        contactPoint: [
          {
            "@type": "ContactPoint",
            contactType: "consultas generales",
            email: "info@resuelvetusmovidas.es",
            availableLanguage: "Spanish",
          },
          {
            "@type": "ContactPoint",
            contactType: "soporte técnico",
            email: "soporte@resuelvetusmovidas.es",
            availableLanguage: "Spanish",
          },
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        url: `${origin}/`,
        name: "Resuelve tus movidas",
        alternateName: ["RTM", "resuelvetusmovidas.es"],
        inLanguage: "es-ES",
        publisher: { "@id": organizationId },
      },
      {
        "@type": "WebPage",
        "@id": `${canonical}#webpage`,
        url: canonical,
        name: title,
        description,
        inLanguage: "es-ES",
        isPartOf: { "@id": `${origin}/#website` },
        about: { "@id": organizationId },
      },
    ],
  };
  return (
    <Helmet>
      {/* Básico */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {!noindex && <script type="application/ld+json">{JSON.stringify(structuredData)}</script>}

      {/* Robots */}
      {noindex && <meta name="robots" content="noindex,nofollow" />}

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Resuelve tus movidas" />
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
