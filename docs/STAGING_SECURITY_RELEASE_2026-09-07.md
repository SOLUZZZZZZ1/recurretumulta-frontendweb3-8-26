# Entrega de seguridad limitada a RTM staging — 7 de septiembre de 2026

Base: `06836c8c1215e9ab3114db3a52aa9da7d721307f`. Preparación local del código, sin despliegue ni cambios de variables o dominios.

## Destino exacto

La API de Vercel identifica el mismo alias para los deployments fallidos de `b5a7690` y `06836c8`:

`https://recurretumulta-frontendweb3-8-26-git-r-cbbb3a-soluzzzs-projects.vercel.app`

Proyecto: `prj_mOgYzD9oofcJMmla5hFmVVpmuKxV`. Repositorio: `SOLUZZZZZZ1/recurretumulta-frontendweb3-8-26`. Rama: `rtm-ai-security-hardening-2026-09-03`.

El destino `/api` previsto es el servicio Render staging verificado: `https://recurretumulta-backend-1.onrender.com`. Su backend Live al revisar continúa en `a203da35c03b5cd055ccc5243f1262284fe4eee5`; aún no ejecuta el refuerzo de seguridad publicado. El alias asociado a una Preview fallida no demuestra que esa versión funcione.

## Contrato cerrado por defecto

El build solo admite esta Preview cuando coinciden simultáneamente los datos del sistema y la confirmación de entrega revisada. Publicar el código por sí solo no habilita la Preview.

| Variable | Valor exigido para esta entrega |
|---|---|
| `VERCEL` | `1` |
| `VERCEL_ENV` | `preview` |
| `VERCEL_TARGET_ENV` | `preview` |
| `VERCEL_PROJECT_ID` | `prj_mOgYzD9oofcJMmla5hFmVVpmuKxV` |
| `VERCEL_GIT_PROVIDER` | `github` |
| `VERCEL_GIT_REPO_OWNER` | `SOLUZZZZZZ1` (valor exacto del repositorio verificado) |
| `VERCEL_GIT_REPO_SLUG` | `recurretumulta-frontendweb3-8-26` |
| `VERCEL_GIT_COMMIT_REF` | `rtm-ai-security-hardening-2026-09-03` |
| `VERCEL_BRANCH_URL` | `recurretumulta-frontendweb3-8-26-git-r-cbbb3a-soluzzzs-projects.vercel.app` |
| `VERCEL_GIT_PULL_REQUEST_ID` | Vacío o ausente |
| `RTM_STAGING_FRONTEND_ORIGIN` | Origen HTTPS exacto indicado arriba |
| `RTM_STAGING_BACKEND_ORIGIN` | `https://recurretumulta-backend-1.onrender.com` |
| `RTM_STAGING_RELEASE_CONFIRMATION` | `RTM_STAGING_ISOLATED_REVIEWED` |

No configurar ni falsear las variables `VERCEL_*` para hacer pasar la validación: deben reflejar el contexto real suministrado por Vercel. Las tres variables `RTM_STAGING_*` son marcadores de configuración no secretos y solo se aplicarían al alcance de esta rama Preview después de verificar el aislamiento y autorizar la entrega. No son prueba criptográfica de aislamiento ni sustituyen las restricciones de cuenta, proyecto o backend.

El preflight verifica también el `vercel.json` efectivo antes de ejecutar Vite. Un cambio del rewrite, su orden o sus condiciones debe revisarse expresamente. Un build de producción con el destino staging queda bloqueado; esta entrega no conoce ni modifica el destino autorizado de producción.

Los controles de procedencia de producción/main, el bloqueo de otras previews y los escaneos del bundle permanecen activos. El `npm run build` habitual conserva sus fases de preflight, compilación e inspección del resultado.

## Orden de entrega pendiente de aprobación

1. Publicar los commits concretos revisados en la rama de seguridad, manteniendo ausente la confirmación de entrega. Los intentos automáticos de Preview seguirán bloqueados en ese estado.
2. Validar el candidato backend y la separación de datos. Resolver hosts, CORS, origen frontend y tratamiento de proxies en Render.
3. Verificar que el alias y la protección de Vercel corresponden a esta rama; aplicar las tres variables de entrega únicamente con autorización específica.
4. Desplegar los commits aprobados y comprobar raíz, OPS, proxy `/api`, salud, autenticación y cookies en el origen exacto. No interpretar una redirección a login Vercel como respuesta correcta de la aplicación.

La última Preview READY observada es `3def8233658a00ee887adc23cf96c2e821ced5a2`, de la rama individual anterior. Es una referencia de continuidad; este documento no cambia su alias ni la retira.

## F1/F2 y evidencias

El hostname y los controles históricos A1S F1/F2 no se modifican en este parche. La ruta A1S mantiene sus condiciones de revisión, privacidad y habilitación. Ni un build correcto ni la nueva confirmación de despliegue renuevan autorizaciones o evidencias A1S. La alineación futura de ese subsistema debe conservar los hashes históricos y añadir pruebas nuevas con su procedencia real.
