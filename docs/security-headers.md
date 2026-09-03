# Cabeceras de seguridad del frontend

El frontend de producción es un build estático de Vite servido por Vercel. La
API de RTM pasa por el rewrite de mismo origen `/api`. La única conexión directa
externa admitida es la lectura pública de habitaciones en el origen HTTPS exacto
`https://backend-spainroom.onrender.com`.

## Decisiones de compatibilidad

- Los scripts solo pueden cargarse desde el propio origen. No se permiten
  scripts inline, manejadores inline ni `unsafe-eval`.
- Stripe se abre mediante una navegación superior a
  `https://checkout.stripe.com`; no se carga como script, frame ni conexión
  `fetch`, por lo que no necesita una excepción en esas directivas.
- Spainroom debe mantener CORS limitado al origen web RTM y no admitir
  credenciales. El cliente fuerza `credentials: omit`, `mode: cors`,
  `redirect: error`, `cache: no-store` y `Referrer-Policy: no-referrer`; además
  valida identificadores, rutas, MIME y tamaños. No se debe sustituir este flujo
  por un rewrite externo, porque una navegación directa podría reenviar cookies
  first-party de RTM al backend de habitaciones.
- React usa atributos `style` y varios componentes crean elementos `<style>` en
  tiempo de ejecución. `unsafe-inline` queda limitado a `style-src-attr` y
  `style-src-elem`; no aparece en `script-src`.
- HSTS se aplica durante un año al host HTTPS que entrega este `vercel.json`.
  No se habilitan todavía `includeSubDomains` ni `preload`, porque antes debe
  confirmarse que todos los subdominios presentes y futuros sirven HTTPS.

## Trusted Types

No se activa todavía `require-trusted-types-for 'script'`. El repositorio no usa
`dangerouslySetInnerHTML`, `innerHTML`, `eval` ni `new Function`, pero no existe
aún una prueba de navegador con CSP real que garantice la compatibilidad de
React 18, `react-helmet-async` y todos los flujos dinámicos. Antes de imponerlo
se debe ensayar una política en staging con reporte de violaciones, recorrer los
flujos públicos, partner y OPS, y solo entonces pasarla a modo obligatorio.
