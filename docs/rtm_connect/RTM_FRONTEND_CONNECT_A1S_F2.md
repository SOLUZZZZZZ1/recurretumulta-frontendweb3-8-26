# RTM Frontend CONNECT A1-S F2

## Decisión

F2 incorpora al código una vista privada y *lazy* de lectura para el flujo humano
A1-S, pero la deja cerrada por defecto. El objetivo de esta entrega es poder
revisar y probar el ciclo de autenticación individual y la consulta sintética sin
abrir una superficie operativa de actuaciones.

El resultado separa dos clases de cambios:

- `POST` de sesión: login y logout crean o revocan estado de seguridad;
- dominio A1-S: exclusivamente `GET`, sin comando, carga, asignación, aprobación,
  liberación, ejecución, presentación, recibo ni conciliación.

La presencia del código no publica la ruta. El gate exacto, las variables del
despliegue y la autorización del backend deben coincidir antes de renderizarla.
F2 no autoriza datos reales de casos o clientes, efectos externos ni producción;
el veredicto live permanece `no_go`. Los datos de identidad, cuenta, sesión y
conexión del operador sí son datos reales y quedan sujetos al aviso específico.

## Identidades congeladas

| Elemento | Identidad |
|---|---|
| Base frontend F2 | `47fbb165c16f93217b0f0e445631258fbfbe3f18` |
| ZIP base F2 | `4a1c42178e00429c914b04c4498bcc13987ef1b4f6b62e3d47c7ca422a32abe8` |
| Base contractual F1 | `92aeac70f93d7f1df645019b0e7f3d83b230ea4d` |
| Cierre backend A1-S | `eb5ead955ba54bcb829c56ee9afdc5c939ec36da` |
| Contrato backend | `rtm.connect.a1s.human_filing.v1` |
| Contrato frontend F2 | `rtm.connect.frontend.a1s.synthetic_read_session.v1` |

El hash y el comentario del `git archive` congelan la identidad de entrega. No
prueban ascendencia Git, autoría, firma de cadena de suministro ni que el proxy
same-origin termine en el backend aislado declarado.

## Ruta privada y carga diferida

La única ruta nueva es `#/ops/connect/a1s`.

- no aparece en Navbar, Footer, sitemap ni páginas públicas;
- usa `React.lazy` y `Suspense`;
- oculta el chrome público cuando el gate está abierto;
- incluye `noindex,nofollow,noarchive,nosnippet`;
- no reutiliza las páginas OPS heredadas, el PIN compartido ni `ops_token`;
- cuando el gate falla, el elemento `<Route>` ni siquiera se incorpora al árbol.

Que una ruta no esté enlazada no constituye control de acceso. La seguridad
efectiva del acceso depende de la sesión individual backend, sus permisos y la
protección del entorno de staging.

## Superficie HTTP alcanzable

| Orden | Método | Recurso | Finalidad |
|---:|---:|---|---|
| 1 | `GET` | `/api/ops/auth/status` | Confirmar autenticación individual de staging |
| 2 | `POST` | `/api/ops/auth/login` | Crear sesión individual |
| 3 | `GET` | `/api/ops/auth/me` | Vincular sesión y operador |
| 4 | `GET` | `/api/ops/connect/human-filings/tenants` | Descubrir tenants autorizados |
| 5 | `GET` | `/api/ops/connect/human-filings/context?tenant_id=...` | Confirmar contexto tenant |
| 6 | `GET` | `/api/ops/connect/human-filings?tenant_id=...` | Recorrer la cola paginada |
| 7 | `GET` | `/api/ops/connect/human-filings/{task_id}?tenant_id=...` | Leer detalle sanitizado |
| 8 | `POST` | `/api/ops/auth/logout` | Revocar sesión individual |

F2 no alcanza heartbeat, opciones de preparación, opciones de recibo, endpoints
de provisión ni comandos A1-S. No exporta un `request(path)` genérico. Todos los
recursos son relativos same-origin y usan `cache: no-store`,
`credentials: same-origin`, `redirect: error` y `referrerPolicy: same-origin`.

## Gate fail-closed

La ruta exige simultáneamente:

- hostname exacto `recurretumulta-frontend-staging.vercel.app`;
- HTTPS y puerto vacío;
- entorno `staging`, target `a1s-synthetic-read` y política
  `synthetic_only`;
- UI F2 y autenticación individual activadas;
- identidades F1, F2 y backend exactas;
- revisión jurídica, revisión del DPD y smoke autenticado con estados exactos
  `approved`, `approved` y `passed`;
- aviso específico de privacidad del operador `published`, protección de acceso
  del despliegue `verified` y auditoría del proxy backend `passed`;
- ocho fronteras con valor literal `0`: datos reales de caso, efectos externos,
  proveedor, Administración, OCU, B2, producción y mutaciones A1-S.

La evaluación no acepta localhost, dominios próximos, HTTP, otro puerto, valores
booleanos ni omisiones. Un gate bloqueado no construye la sesión ni ejecuta
`fetch`. Los literales de revisión, publicación y auditoría son condiciones
fail-closed de despliegue, no pruebas criptográficas de que esos trabajos se hayan
realizado ni sustitutos de sus evidencias versionadas. La ruta debe permanecer
cerrada mientras el aviso específico no sea accesible para el operador. No debe
marcarse `VITE_RTM_CONNECT_A1S_OPERATOR_PRIVACY_NOTICE=published` hasta que el DPD
haya validado el contenido por capas, su versión y el enlace visible que debe
incorporarse a la pantalla.

## Sesión solo en memoria

El frontend conserva el Bearer en una clausura JavaScript y lo transmite solo en
la cabecera `Authorization` de las solicitudes permitidas. El código F2 no lo
copia a getters, props, estado React, URL, errores, almacenamiento persistente ni
logs deliberados. La política de logs del navegador, proxy y backend debe
auditarse aparte. Tampoco se usa `localStorage`, `sessionStorage`, IndexedDB,
cookies de aplicación, Cache API, service worker, `window.name`,
`BroadcastChannel` o telemetría para persistirlo.

El login requiere que el estado de autenticación se haya validado antes y
suprime intentos concurrentes. Después valida `/auth/me` y los tenants. Cada
operación de lectura registra un controlador interno enlazado al `AbortSignal`
del caller, crea un cliente F1 y repite el vínculo sesión-operador-tenant. Logout,
clear, dispose, un `401` o una contradicción contractual abortan los controladores
activos y borran el estado local de la sesión. El contexto tenant se valida antes de iniciar la
paginación; no se ejecutan ambos como tareas hermanas.

Tras validar la identidad, el runtime minimiza lo que entrega a React: solo nombre
visible y rol del operador, caducidad, y por tenant su identificador, nombre y rol.
No coloca en estado React el Bearer, `session_id`, identificadores internos del
operador, permisos, principals, memberships ni el contexto tenant no renderizado.

F2 no implementa cambio de contraseña ni segundo factor: bloquea las cuentas que
indiquen `must_change_password` o `mfa_required`. La activación no puede rebajar
la política del backend; si staging exige MFA, F2 permanece cerrado hasta contar
con un flujo aprobado que lo soporte.

Logout borra primero el estado local y luego intenta la revocación remota. Si la
red falla, la vista permanece cerrada y comunica que la sesión remota queda
sujeta a caducidad. El cierre de pestaña solo puede limpiar memoria; no se afirma
que pueda garantizar una revocación HTTP.

El `device_token` devuelto por el backend se valida como parte del sobre exacto,
pero F2 no lo persiste, no lo expone y no lo reenvía. En consecuencia, F2 no
afirma que pueda reconocer el mismo dispositivo en un login posterior: ese ciclo
debe verificarse en el smoke autenticado y cualquier política backend que exija
reutilización bloquea la activación hasta disponer de un diseño aprobado.

## Recorrido paginado verificado o estado indeterminado

F2 solicita páginas exactas de 200 elementos y admite como máximo 2.000 tareas.
Exige en cada página:

- `limit` y `offset` exactos;
- `total` estable;
- identificadores de tarea únicos;
- ausencia de página vacía o corta antes de completar el total;
- suma exacta de elementos y total.

Si una página falla, cambia el total, repite una tarea, contradice el offset o
supera el límite, se descarta el resultado parcial. La UI muestra
`indeterminado` y nunca afirma que no existan tareas.

Incluso un recorrido que satisface esas comprobaciones no demuestra una
instantánea: el backend congelado pagina mediante offset y no entrega cursor,
snapshot o versión global. Por ello el runtime declara
`snapshotGuaranteed === false`; la UI habla de “paginación verificada para estos
filtros”. Si el total devuelto es cero, solo se informa de que esa lectura
paginada devolvió cero tareas, no de que la cola esté globalmente vacía.

El backend no ofrece filtro exacto por `case_id`. Por eso F2 solo habilita ese
filtro local después de verificar el recorrido paginado y exige un UUID completo.

## Proyección de detalle

El runtime devuelve una proyección cerrada de identidad sintética, estado,
fechas, hashes, aprobaciones, artefactos, recibo sintético y eventos. Elimina las
ayudas `allowed_actions`, no devuelve el payload backend sin filtrar y fija
`workflowActions` como lista vacía. El recibo visible se describe como fixture
sintético, nunca como justificante oficial.

## Transparencia, privacidad y revisión humana

F2 aplica controles prudenciales; no certifica conformidad jurídica ni asigna
definitivamente a RTM un rol bajo el Reglamento de IA.

La pantalla:

- distingue staging, casos sintéticos, solo lectura y falta de efectos jurídicos;
- aclara que esta revisión solo muestra metadatos de una simulación y no presenta
  borradores ni una interacción directa con IA;
- exige revisión humana sustantiva por una persona competente, autorizada y con
  capacidad real de corregir, rechazar o detener;
- informa antes del login de que LA TALAMANQUINA, S.L. trata los datos de cuenta
  y puede generar registros técnicos y de seguridad para autenticar y proteger
  el entorno;
- prohíbe introducir datos reales de clientes o casos;
- condiciona la apertura a revisión jurídica y del DPD.

Si en una fase posterior se muestra un borrador realmente asistido por IA, deberá
etiquetarse junto al contenido y reabrirse la revisión de finalidad, roles,
transparencia y protección de datos. F2 no anticipa que ese supuesto ya exista.

Una eventual información de transparencia sobre IA no sustituiría la información
de protección de datos. Antes de habilitar la ruta, aunque los casos sean
sintéticos, deben validarse responsable, finalidades, base jurídica,
destinatarios, transferencias, conservación, derechos, contratos, evaluación de
impacto cuando corresponda y el texto completo por capas. El acceso de operadores
sí puede tratar datos personales de cuenta y sesión aunque los casos sean
sintéticos; por ello F2 solo afirma ausencia de datos reales de caso/cliente.
La segunda capa validada por el DPD deberá describir además cualquier regla
automatizada de seguridad del acceso —por ejemplo, señales de riesgo o bloqueo
temporal tras intentos fallidos— y su efecto, sin confundirla con una decisión
jurídica A1-S.

Las fuentes oficiales de referencia para la revisión son el
[texto consolidado del Reglamento (UE) 2024/1689 a 27 de julio de 2026](https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:02024R1689-20260727),
el [Reglamento (UE) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj/spa),
la distinción de la AEPD entre
[transparencia de IA y transparencia RGPD](https://www.aepd.es/prensa-y-comunicacion/blog/inteligencia-artificial-transparencia)
y sus criterios sobre
[intervención humana significativa](https://www.aepd.es/prensa-y-comunicacion/blog/evaluacion-de-la-intervencion-humana-en-las-decisiones-automatizadas)
y la
[información por capas cuando los datos se obtienen del afectado](https://www.aepd.es/preguntas-frecuentes/2-tus-obligaciones-como-responsable-del-tratamiento/6-el-deber-de-informacion/FAQ-0217-que-informacion-debe-facilitarse-cuando-los-datos-se-obtengan-directamente-del-afectado).
Prevalece siempre el texto oficial consolidado vigente.

### Erratum normativo respecto de F1

F1 conserva en su fotografía base la redacción anterior del artículo 4 sobre
alfabetización en IA. Para F2 se sustituye esa referencia: desde el 2 de febrero
de 2025, y con la redacción aplicable desde el 27 de julio de 2026, proveedores y
desplegadores deben adoptar medidas para apoyar el desarrollo de la alfabetización
en IA de su personal y de otras personas que operen o utilicen sistemas en su
nombre, atendiendo a sus conocimientos, experiencia, formación y al contexto. No
se afirma que deban garantizar un nivel individual concreto. Esta corrección
documental no modifica silenciosamente el artefacto F1 congelado.

## Accesibilidad y UX

- labels visibles y `autocomplete=username/current-password`;
- anuncios con `role=status` o `role=alert`;
- controles de al menos 44 px y foco visible;
- tabla con caption, cabeceras y scopes;
- estados no comunicados únicamente por color;
- paginación local y detalle con cierre explícito;
- contraseña eliminada del estado del formulario al enviar;
- ninguna acción jurídica disponible.

## Validación de esta entrega

La entrega incluye pruebas de contrato y un preflight offline que:

- verifica hash, comentario, CRC, seguridad y snapshot del ZIP base;
- compara 99 archivos base sin cambios mediante igualdad raw o equivalencia
  estrecha CRLF/LF;
- limita el overlay a ocho rutas, con `src/App.jsx` como único reemplazo;
- comprueba hashes del manifiesto de evidencia;
- analiza el cierre estático sin importar JavaScript ni ejecutar runtime;
- confirma que no hay almacenamiento persistente, token legado, origen absoluto,
  transporte alternativo ni comandos A1-S;
- registra que el runtime está cableado en fuente, pero no ejecutado ni accesible
  mediante la ruta mientras el gate falla. El chunk cliente no se considera un
  secreto ni un control de acceso.

El build de Vite se ejecutó en Windows sobre la revisión aplicada. La consola del
operador informó `vite v5.4.21`, 81 módulos transformados y
`built in 10.83s`. Ese informe no está firmado ni hash-congelado y los artefactos
generados en `dist` no forman parte del overlay; se registra como evidencia
operativa no criptográfica, no como atestación de cadena de suministro.

El build terminó correctamente con tres avisos heredados y no bloqueantes: datos
Browserslist desactualizados, la clave duplicada `landing` del menú Viajes y el
chunk principal superior a 500 kB. F2 conserva esos avisos fuera de su allowlist
funcional. La página A1-S se generó como chunk *lazy* separado; la limpieza del
Navbar y la optimización general del bundle se difieren a overlays propios, sin
ocultar el aviso elevando artificialmente su umbral.

## Bloqueos y siguientes pasos

Antes de habilitar la ruta deben cerrarse de forma independiente:

1. revisión jurídica y del DPD, incluida información por capas;
2. verificación de que `/api` apunta al backend exacto de staging sintético;
3. smoke autenticado en navegador contra ese despliegue;
4. protección de acceso al despliegue, además de la ruta no enlazada;
5. prueba de expiración, 401, logout remoto y ausencia de residuos;
6. revisión visual responsiva (el build Windows ya fue superado según el informe
   de consola del operador, no hash-atestado);
7. decisión separada sobre frontend público, familia Bancos y cualquier flujo
   posterior de actuaciones.

F2 no habilita datos reales de casos o clientes, presentación humana real, OCU,
Administración, proveedor, B2, pagos, email, workers ni producción. El acceso de
operadores no queda fuera de las obligaciones de protección de datos.
