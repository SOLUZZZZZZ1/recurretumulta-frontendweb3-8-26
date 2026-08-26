# RTM Frontend — servicios públicos V1

## Resultado

Este lote convierte el catálogo público en una única fuente de verdad con nueve
familias visibles: Tráfico, Viajes, Deudas y ASNEF, Administración, Bancos,
Energía, Telecomunicaciones, Seguros y Vivienda. La misma definición alimenta la
portada, el megamenú, el pie y el selector de inicio de expediente.

Las cinco familias añadidas tienen landing propia. Bancos, Energía,
Telecomunicaciones y Seguros abren el tipo real `claims/consumer`; Vivienda lleva
a una consulta de encaje y declara expresamente que todavía no crea un expediente automático.
RTM Connect permanece separado y equivalente a la base.

La revisión pública de Bancos, Energía, Telecomunicaciones, Seguros, Vivienda,
Viajes y ASNEF utiliza lenguaje dirigido al usuario, sin exponer detalles de
implementación. La página de precios incorpora el estudio inicial de asuntos de
consumo por 10 €, que se descuenta íntegramente del precio o presupuesto de la
gestión aceptada si el usuario decide continuar.

## Identidad congelada

| Elemento | Identidad exacta |
|---|---|
| Commit base | `e677aeaeda807fc4cee5cf87332c6fc72186de27` |
| SHA-256 del ZIP base | `33dad9d9d7b6d71ea5a4777825a754072373dbe76a5485bdd3583d9cb338d08a` |
| Snapshot interno del ZIP | `b2ee2d7bef950032dc235610e6abeda7b2eaaacfcbb70f3b3c4aa3c419eb94c8` |
| Contrato | `rtm.frontend.public_services.v1` |

## Mapa público y contrato backend

| Familia | Ruta pública | Paso siguiente | Tipo que recibe el backend |
|---|---|---|---|
| Tráfico | `/trafico` | Expediente | `traffic` y sus tipos admitidos |
| Viajes | `/viajes` | Expediente | `claims`: `airline`, `consumer` u `other_claim` |
| Deudas y ASNEF | `/morosidad` y `/asnef` | Expediente | `debt` y sus tipos admitidos |
| Administración | `/administracion` | Expediente | `administration` y sus tipos admitidos |
| Bancos | `/bancos` | Expediente | `claims/consumer` |
| Energía | `/energia` | Expediente | `claims/consumer` |
| Telecomunicaciones | `/telecomunicaciones` | Expediente | `claims/consumer` |
| Seguros | `/seguros` | Expediente | `claims/consumer` |
| Vivienda | `/vivienda` | Consulta de encaje | Ninguno; no crea expediente automático |

La familia elegida viaja en `?family=` y también se añade al comentario enviado
por el formulario. Un departamento, tipo o familia desconocidos bloquean el
inicio con un mensaje seguro: nunca se convierten silenciosamente en Tráfico.
Los antiguos `?issue=` no se muestran porque el backend no conservaba ese dato.

Las rutas públicas son limpias mediante `BrowserRouter` y el fallback SPA ya
presente en `vercel.json`. Los marcadores antiguos `/#/...` se migran de forma
sincrónica para conservar compatibilidad.

## Criterio visual

La portada y el megamenú muestran las nueve familias en una retícula 3 × 3. Las
landings comparten una estructura coherente, pero varían contenido, color y
recorte. Se incorporan tres ilustraciones WebP de 1280 × 853 px, con un peso total
de 119.816 bytes, reutilizadas solo cuando aportan contexto. Todas llevan la
identificación visible `Imagen ilustrativa generada con IA`.

## Allowlist exacta del overlay

Rutas base reemplazadas:

1. `index.html`
2. `public/sitemap.xml`
3. `src/App.jsx`
4. `src/components/Footer.jsx`
5. `src/components/Navbar.jsx`
6. `src/components/Seo.jsx`
7. `src/index.css`
8. `src/main.jsx`
9. `src/pages/AdministracionHome.jsx`
10. `src/pages/Asnef.jsx`
11. `src/pages/Contacto.jsx`
12. `src/pages/IniciarExpedienteRTM.jsx`
13. `src/pages/InicioRTM.jsx`
14. `src/pages/MorosidadHome.jsx`
15. `src/pages/Precios.jsx`
16. `src/pages/Trafico.jsx`
17. `src/pages/ViajesHome.jsx`

Rutas nuevas:

1. `docs/rtm_connect/RTM_FRONTEND_PUBLIC_SERVICES_V1.md`
2. `docs/rtm_connect/RTM_FRONTEND_PUBLIC_SERVICES_V1_EVIDENCE.json`
3. `public/servicios-finanzas.webp`
4. `public/servicios-hogar-suministros.webp`
5. `public/servicios-proteccion-conectividad.webp`
6. `scripts/rtm_frontend_public_services_v1_preflight.py`
7. `src/components/PublicServiceLanding.jsx`
8. `src/data/publicServices.js`
9. `src/pages/BancosHome.jsx`
10. `src/pages/EnergiaHome.jsx`
11. `src/pages/SegurosHome.jsx`
12. `src/pages/TelecomunicacionesHome.jsx`
13. `src/pages/ViviendaHome.jsx`
14. `tests/test_rtm_frontend_public_services_v1_contract.py`

El preflight exige este conjunto exacto, comprueba todos los archivos restantes
contra el ZIP base y admite únicamente equivalencia CRLF/LF para texto UTF-8. Esa
comparación global incluye los módulos, páginas, pruebas y evidencias de RTM
Connect.

## Aplicación y verificación en Windows

Conservar primero el ZIP base. Después, desde PowerShell:

```powershell
Expand-Archive -LiteralPath "C:\rtm\RTM_FRONTEND_PUBLIC_SERVICES_V1_OVERLAY_e677aea.zip" -DestinationPath "C:\rtm\RTM_FRONTEND_STAGING" -Force
Set-Location "C:\rtm\RTM_FRONTEND_STAGING"
py -3 -I -S -B scripts\rtm_frontend_public_services_v1_preflight.py --archive "C:\rtm\RTM_FRONTEND_PUBLIC_SERVICES_BASE_e677aea.zip" --compact
py -3 -B -m unittest discover -s tests -p "test_rtm_frontend_public_services_v1_contract.py" -v
npm run build
```

El resultado esperado del preflight es JSON con `"status":"ok"`. Después del
build conviene revisar `/`, las cinco landings nuevas, `/asnef`, el selector sin
parámetros y una ruta deliberadamente inválida. No debe haber desplazamiento
horizontal ni errores de consola; Vivienda debe terminar en
`/contacto?area=vivienda`.

## Verificación realizada

- contrato específico: 31 pruebas superadas al congelar la evidencia;
- build Vite de producción: correcto, 89 módulos transformados;
- navegación real: rutas limpias, enlaces heredados, selector y consulta de
  Vivienda comprobados en escritorio y móvil;
- consola, errores de página, peticiones fallidas e imágenes rotas: cero;
- auditoría automática WCAG 2 A/AA de portada, selector, ASNEF y las cinco
  landings nuevas: cero infracciones detectadas;
- avisos de build no bloqueantes heredados: datos de `caniuse-lite` antiguos y
  chunk principal superior a 500 kB.

La suite completa ejecutó 151 pruebas: 146 pasaron y 5 contratos históricos
fallaron. Cuatro comparan hashes binarios de documentos anteriores sin canonizar
CRLF/LF; el quinto exige el literal del antiguo megamenú hardcodeado, sustituido
deliberadamente por la fuente única de nueve familias. No son fallos de build ni
de ejecución del catálogo actual. Por ello esos contratos históricos no se usan
como criterio de aceptación de este overlay; el contrato V1 y el preflight sí son
los criterios actuales y quedan congelados por hash.

## Reversión y límites

Para una reversión limpia no se debe extraer la base encima del árbol modificado,
porque quedarían las rutas nuevas. Se conserva el árbol fallido con otro nombre y
se reconstruye `RTM_FRONTEND_STAGING` en una carpeta vacía desde el ZIP base
congelado.

Este lote no despliega, no cambia backend, no ejecuta expedientes reales, no usa
datos personales y no autoriza producción. Tampoco acredita revisión jurídica ni
garantiza el resultado de una reclamación. La validación visual realizada es
técnica; la publicación final y la revisión comercial siguen siendo decisiones
del operador.
