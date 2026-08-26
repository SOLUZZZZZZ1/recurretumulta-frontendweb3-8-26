# RTM Frontend — corrección visual «Cómo trabajamos» V1

## Decisión

La página `/como-funciona` declaraba como fondo del contenedor superior derecho
el recurso absoluto `/hero-como-trabajamos.png`, pero el commit base no contenía
ese archivo en `public/`. El navegador mostraba correctamente el color de reserva,
el degradado inferior y el pie superpuesto, mientras descartaba la capa de imagen
que respondía con un recurso inexistente o con el fallback HTML de la SPA.

Este overlay corrige únicamente esa incoherencia visual:

- incorpora `public/hero-como-trabajamos.png`;
- conserva la URL, el encuadre `center/cover` y el contenido del pie existentes;
- añade una divulgación visible y accesible de que la imagen es ilustrativa y ha
  sido generada con IA;
- no cambia rutas, navegación, formularios, precios, servicios, API ni RTM CONNECT.

## Identidad congelada

| Elemento | Identidad |
|---|---|
| Base frontend | `8a86815aea0b9406b00320cd367edebe0624d4f1` |
| ZIP base | `1d302d802a95e039c41a9391725c73dbff5e6533f80a17362c052b2ff647ae4e` |
| Rama | `rtm-frontend-staging-2026-08-16` |
| Asset | PNG RGB, `1536 × 1024` |

## Origen y límites de la imagen

La imagen se generó como fotografía editorial de un espacio profesional de
revisión: carpeta de expediente, documentos organizados, ordenador con un panel
abstracto y manos no identificables. No representa personas, hechos, documentos
ni expedientes reales. No contiene logos, firmas, nombres, números de identidad
ni otros datos personales intencionados.

La etiqueta visible es una política prudencial de RTM. Esta ilustración no se
califica como *deepfake* y la etiqueta, por sí sola, no acredita conformidad con
el Reglamento de IA, RGPD u otra norma. Tampoco sustituye el marcado técnico que
pudiera corresponder al proveedor de un sistema generador cuando resulte
aplicable.

## Allowlist del overlay

1. `docs/rtm_connect/RTM_FRONTEND_COMO_FUNCIONA_HERO_V1.md`
2. `public/hero-como-trabajamos.png`
3. `scripts/rtm_frontend_como_funciona_hero_v1_preflight.py`
4. `src/pages/ComoFunciona.jsx`
5. `tests/test_rtm_frontend_como_funciona_hero_v1_contract.py`

El resto de la base debe permanecer equivalente, admitiendo únicamente la
normalización CRLF/LF para archivos de texto.

## Verificación

Desde la raíz del frontend, antes del commit:

```text
python -B -m unittest discover -s tests -p "test_rtm_frontend_como_funciona_hero_v1*.py"
python -I -S -B scripts\rtm_frontend_como_funciona_hero_v1_preflight.py --archive "C:\rtm\RTM_FRONTEND_CONNECT_A1S_F2_BASE_8a86815.zip" --compact
npm run build
```

Después del despliegue deben verificarse:

- `GET /hero-como-trabajamos.png` responde `200` y `Content-Type: image/png`;
- `/como-funciona` no genera un 404 para el recurso;
- la imagen conserva un recorte útil en escritorio y móvil;
- el pie y la etiqueta siguen siendo legibles.

## Exclusiones y veredicto

No se corrige en este overlay la clave `landing` duplicada del objeto de viajes
en `Navbar.jsx`, la antigüedad de `caniuse-lite` ni la división de chunks. Esas
advertencias de la base se tratarán por separado para no ampliar el cambio.

El overlay solo puede declararse cerrado después de pruebas, preflight y build
Windows satisfactorios. No autoriza datos reales, actuaciones externas, RTM
CONNECT runtime ni producción A1-S. El veredicto live de RTM CONNECT permanece
`no_go`.
