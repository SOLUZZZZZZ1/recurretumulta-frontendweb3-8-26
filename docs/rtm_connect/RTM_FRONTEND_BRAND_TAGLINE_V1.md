# RTM Frontend — firma de marca «Resuelve tus movidas» V1

## Decisión

RTM adopta **«Resuelve tus movidas»** como firma comercial visible de la marca
paraguas. La expresión amplía el posicionamiento más allá de tráfico y permite
presentar bajo una misma identidad los servicios de viajes, deudas, consumo y
gestiones con la Administración.

Este cambio:

- conserva sin modificar el símbolo gráfico RTM existente;
- presenta el eslogan como texto HTML, no como texto rasterizado dentro de una
  imagen;
- incorpora la firma `RTM · Resuelve tus movidas` en portada, metadatos y pie;
- mantiene `RecurreTuMulta`, el dominio `recurretumulta.eu` y las referencias
  legales o técnicas que siguen identificando el servicio existente;
- elimina la clave `landing` duplicada del grupo Viajes sin cambiar su destino;
- no cambia rutas, formularios, precios, servicios, API ni RTM CONNECT.

## Identidad congelada

| Elemento | Identidad |
|---|---|
| Base frontend | `809a7e21f9453522df8f2728033c1ee3d6583014` |
| ZIP base | `ebe091f9a0f85d52dc8af2eb88b4aab80eae77fd7cc327dc7e035e614d433453` |
| Snapshot base | `954298840c3d7f899c1f798e63075ffb5a4dc5dbcf516629f1dc17e2cdf9e9d9` |
| Rama | `rtm-frontend-staging-2026-08-16` |
| Firma pública exacta | `RTM · Resuelve tus movidas` |
| Eslogan exacto | `Resuelve tus movidas` |

## Criterio visual y accesible

La cabecera mantiene el isotipo original y añade el eslogan mediante texto vivo.
Así conserva nitidez, responde al ancho disponible, se puede seleccionar y no
depende de una nueva imagen de marca. El verde claro `#a7f57a` mantiene el vínculo
visual con la flecha del símbolo y ofrece contraste prudente sobre el azul de la
barra.

El enlace de inicio expone el nombre accesible
`RTM — Resuelve tus movidas. Ir al inicio`; la imagen pasa a ser decorativa dentro
de ese enlace para evitar una lectura duplicada. El foco por teclado permanece
visible y la navegación principal anuncia la página activa. En escritorio el
eslogan se presenta en una línea; en móvil puede ocupar dos líneas, sin ocultarse.

Estas comprobaciones de fuente no sustituyen la revisión en navegador de recorte,
zoom, reflujo ni nombre accesible calculado por una tecnología de asistencia.

## Alcance comercial y jurídico

«Resuelve tus movidas» se adopta como firma publicitaria y no pretende prometer
el éxito ni que todo expediente vaya a resolverse favorablemente; su interpretación
queda sujeta a revisión jurídica. Se conserva el aviso visible de que el servicio
no garantiza resultados. La portada formula su pregunta principal como una petición
de ayuda, sin repetir una promesa de resolver.

Este overlay no acredita disponibilidad registral, titularidad ni protección de
la nueva firma como marca. Una eventual solicitud debe tratarse por separado con
búsqueda de anterioridades y revisión profesional. Este overlay no acredita conformidad legal integral,
ni modifica la identidad del prestador, los textos contractuales,
la política de privacidad o el alcance de la autorización del cliente.

## Allowlist del overlay

Rutas base reemplazadas:

1. `index.html`
2. `src/components/Footer.jsx`
3. `src/components/Navbar.jsx`
4. `src/components/Seo.jsx`
5. `src/index.css`
6. `src/pages/InicioRTM.jsx`

Rutas nuevas:

1. `docs/rtm_connect/RTM_FRONTEND_BRAND_TAGLINE_V1.md`
2. `docs/rtm_connect/RTM_FRONTEND_BRAND_TAGLINE_V1_EVIDENCE.json`
3. `scripts/rtm_frontend_brand_tagline_v1_preflight.py`
4. `tests/test_rtm_frontend_brand_tagline_v1_contract.py`

El resto de la base debe permanecer equivalente. Solo se admite normalización
CRLF/LF en archivos UTF-8 sin NUL ni retornos de carro aislados.

## Verificación

Desde la raíz del frontend, antes del commit:

```text
python -B -m unittest discover -s tests -p "test_rtm_frontend_brand_tagline_v1*.py"
python -B -m unittest discover -s tests -p "test_*.py"
python -I -S -B scripts\rtm_frontend_brand_tagline_v1_preflight.py --archive "C:\rtm\RTM_FRONTEND_BRAND_TAGLINE_BASE_809a7e2.zip" --compact
npm run build
```

Después del despliegue deben revisarse la página de inicio y al menos una página
interior en escritorio, 980 px, 640 px y 380 px, además de navegación por teclado,
zoom al 200 %, menú móvil y nombre accesible calculado del enlace de marca.

En el árbol Windows de destino se ejecutaron 122 pruebas y las 122 finalizaron
correctamente. El contrato específico de marca aprobó además sus 19 pruebas. El
build Vite transformó 81 módulos y finalizó en 8,07 segundos; mantuvo dos avisos
no bloqueantes heredados: la antigüedad de `caniuse-lite` y un chunk minificado
superior a 500 kB. Estos resultados proceden de la salida de consola aportada por
el operador: no están firmados criptográficamente y los artefactos de `dist` no
quedan congelados por hash en este expediente.

## Exclusiones y veredicto

No se rediseña el símbolo RTM y no se crea un nuevo logotipo registral. No se cambia
el activo Open Graph histórico, no se publica una nueva ruta y no se habilita
ninguna actuación A1-S. La actualización de `caniuse-lite` y la división del chunk
principal quedan fuera de alcance.

El build Windows y la suite completa constan como superados mediante informe de
consola del operador. Hasta completar la revisión visual y las revisiones jurídica
o registral que correspondan, el estado es
`blocked_pending_visual_and_legal_review`. RTM CONNECT con datos reales, efectos
externos y producción permanece `no_go`.
