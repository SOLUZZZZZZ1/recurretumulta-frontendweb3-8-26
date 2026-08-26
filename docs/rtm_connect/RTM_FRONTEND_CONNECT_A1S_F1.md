# RTM Frontend CONNECT A1-S F1

## Decisión

F1 congela el contrato frontend de lectura para RTM CONNECT A1-S sin publicarlo
ni incorporarlo todavía al grafo de ejecución del frontend.

El resultado es deliberadamente cerrado:

- solo staging sintético;
- solo lectura;
- sin nueva ruta;
- sin interfaz visible;
- sin login incorporado;
- sin llamadas de red al cargar la aplicación;
- sin almacenamiento de Bearer;
- sin mutaciones A1-S;
- sin contacto con proveedor, Administración u OCU;
- sin B2 ni otros efectos externos;
- veredicto live `no_go`.

Este bloque permite que F2 consuma un contrato revisado y verificable, sin
mezclar a la vez autenticación, sesión, interfaz, navegación y flujo operativo.

## Identidad congelada

| Elemento | Identidad |
|---|---|
| Base frontend | `92aeac70f93d7f1df645019b0e7f3d83b230ea4d` |
| ZIP base frontend | `d9e032668f2c1dce22196c3d1a801cf31e90afb289c4c24c7b7b9233870e64d5` |
| Cierre backend A1-S | `eb5ead955ba54bcb829c56ee9afdc5c939ec36da` |
| Contrato backend | `rtm.connect.a1s.human_filing.v1` |
| Contrato frontend F1 | `rtm.connect.frontend.a1s.read.v1` |

El archivo base fue creado con `git archive`. El comentario del ZIP debe ser el
SHA-40 frontend exacto. El hash y el comentario acreditan identidad de entrega,
pero no autoría, firma de cadena de suministro ni ascendencia Git.

## Superficie admitida

F1 reconoce exclusivamente estos recursos same-origin:

| Nombre | Método | Ruta |
|---|---:|---|
| Estado de autenticación | `GET` | `/api/ops/auth/status` |
| Sesión individual | `GET` | `/api/ops/auth/me` |
| Tenants del operador | `GET` | `/api/ops/connect/human-filings/tenants` |
| Contexto tenant | `GET` | `/api/ops/connect/human-filings/context?tenant_id=...` |
| Opciones de preparación | `GET` | `/api/ops/connect/human-filings/preparation-options?tenant_id=...` |
| Cola paginada | `GET` | `/api/ops/connect/human-filings?tenant_id=...` |
| Detalle | `GET` | `/api/ops/connect/human-filings/{task_id}?tenant_id=...` |
| Opciones de recibo | `GET` | `/api/ops/connect/human-filings/{task_id}/receipt-options?tenant_id=...` |

No existe un `request(path)` público. El cliente expone funciones cerradas y
construye internamente cada ruta. Las respuestas se rechazan si contradicen el
aislamiento sintético, cambian de tenant/tarea o incumplen el contrato.
Los recursos backend tipados no incluyen por sí mismos una atestación
`synthetic_only`; por ello el frontend no deduce origen sintético a partir de un
nombre o UUID. La procedencia queda bajo la autoridad del backend congelado, que
filtra tenants, memberships, casos y documentos sintéticos en PostgreSQL.

## Autenticación

El Bearer de A1-S debe proceder de una sesión individual del operador. Nunca
puede reutilizarse el `ops_token` heredado, el PIN compartido, una credencial de
partner ni un token administrativo.

F1 no implementa login ni logout. El cliente recibe un Bearer desde memoria y no
lo persiste. F2 deberá añadir el formulario individual, validar `/auth/me`,
mantener el token únicamente en memoria, abortar solicitudes al cerrar/cambiar de
expediente y limpiar la sesión ante `401`, expiración o respuesta mal formada.
El cliente obliga a validar primero `/auth/me`, elimina correo y permisos globales
de la proyección devuelta, descubre después los tenants de esa misma identidad y
bloquea cualquier lectura sobre un tenant no incluido en ese bootstrap. Esto
demuestra que el backend reconoce la sesión individual; no constituye por sí solo
una atestación criptográfica de audiencia o linaje del token.

## Gate fail-closed

La función pura `evaluateA1SFrontendGate` solo admite la combinación exacta:

- hostname exacto `recurretumulta-frontend-staging.vercel.app`;
- protocolo `https:` y puerto vacío; no se admite desarrollo local;
- `buildTarget === "a1s-synthetic-read"`;
- `environment === "staging"`;
- `uiEnabled === "1"`;
- `operatorAuthEnabled === "1"`;
- base frontend, commit backend y versión de contrato exactamente congelados;
- `documentInputPolicy === "synthetic_only"`;
- datos reales, efectos externos, proveedor, Administración, OCU, B2 y
  autorización de producción con valor exacto `"0"`.

El constructor del cliente GET aplica este gate y, cuando existe `location`,
contrasta además hostname, protocolo y puerto reales del navegador. El cliente
no está importado desde `App.jsx`, `main.jsx`, `OpsCaseDetail.jsx` ni desde ninguna
ruta en este overlay. La ausencia de cableado de aplicación forma parte del cierre F1.

## Validación defensiva

El consumidor valida, entre otros:

- UUID canónicos y SHA-256 en minúsculas;
- los catorce estados A1-S admitidos;
- identidad exacta de tenant y tarea;
- paginación acotada (`limit <= 200`);
- `read_only === true` en catálogos que lo declaran;
- `allowed_actions_authoritative === false` y
  `commands_revalidate === true` en detalle;
- recibos sintéticos JSON de hasta 64 KiB;
- ausencia de cualquier afirmación de producción, datos reales, red de
  Administración/proveedor, B2 o efectos externos.

La validación frontend es una validación de esquema y de vínculos de identidad,
no una prueba autónoma de que el contenido sea sintético. Antes de F2 se exige un
smoke autenticado contra el backend exacto y debe valorarse añadir una atestación
explícita de dataset sintético a sus respuestas. Si el backend o el contrato
cambian, el gate debe bloquear.

Todas las solicitudes usan `GET`, ruta relativa same-origin, `cache: no-store`,
`credentials: same-origin` y `redirect: error`.

## Exclusiones de F1

F1 no incorpora:

- `POST /api/ops/auth/login` ni `POST /api/ops/auth/logout`;
- heartbeat o renovación de sesión;
- preparación, asignación, revisión, liberación, ejecución, recibo,
  reconciliación o cierre de tareas;
- botones de actuación;
- filtrado por expediente sobre una cola incompleta;
- código lazy, panel, modal o nueva ruta;
- cambios en `App.jsx`, `main.jsx`, `vercel.json`, páginas OPS o CSS global;
- cambios de diseño público;
- la nueva familia pública Bancos;
- cualquier contacto real o presentación legal.

La cola backend todavía no expone filtro `case_id`. F2 no debe declarar “sin
tareas” a partir de una página parcial. Debe paginar completamente con límite
defensivo y devolver estado indeterminado si una página falla o se supera el
límite; la solución estable es añadir posteriormente un filtro backend exacto.

## Requisito transversal: Reglamento de IA y protección de datos

La transparencia legal no se considera un detalle visual. F2 y cualquier
posterior refresh público deben pasar una revisión específica frente al
Reglamento (UE) 2024/1689, RGPD, LOPDGDD, normativa de consumo y deberes
profesionales aplicables. Este apartado congela requisitos internos de diseño;
no determina el rol jurídico de RTM, no certifica conformidad y no autoriza una
interfaz, datos reales ni producción.

### Clasificación y matriz de roles pendientes

No debe copiarse al frontend una clasificación simplificada de “riesgo bajo,
medio y alto”. Las obligaciones dependen del rol de RTM, finalidad prevista,
personas afectadas y uso concreto. Antes de cualquier runtime, un abogado y el
DPD, cuando corresponda, deben validar esta matriz:

| Rol posible de RTM | Estado F1 | Consecuencia que debe evaluarse |
|---|---|---|
| Proveedor | No determinado | Si RTM desarrolla o manda desarrollar y ofrece o pone en servicio el sistema bajo su nombre o marca, le corresponden, cuando apliquen, el aviso de interacción directa y el marcado técnico de salidas. |
| Desplegador | Probable al usar profesionalmente un sistema de un tercero, pero no cerrado | Debe evaluar, entre otras, la divulgación de *deepfakes* y de determinados textos de interés público. |
| Proveedor descendente (`downstream provider`) | Posible si integra un modelo en un sistema propio; no determinado | La integración y presentación bajo marca propia pueden activar obligaciones de proveedor adicionales a las del proveedor del modelo. |

La conclusión preliminar —no una calificación jurídica definitiva— es que una
herramienta privada que prepara información y borradores para revisión humana no
entra automáticamente en el supuesto del anexo III destinado a asistir a una
autoridad judicial o, con efectos jurídicos para las partes, a un organismo de
resolución alternativa. La evaluación debe reabrirse antes de cualquier cambio de
finalidad, autonomía, destinatario, marca, integración o canal. Tras el Reglamento
(UE) 2026/1744, las obligaciones para los sistemas de alto riesgo del anexo III se
aplican desde el 2 de diciembre de 2027; esa fecha no elimina la necesidad de
clasificar correctamente el sistema antes de desplegarlo.

### Obligaciones legales cuando concurra su supuesto

Estas obligaciones no se presentan como universales. Debe acreditarse para cada
una el rol, sistema, contenido, tratamiento y contexto que activan su aplicación:

- desde el 2 de febrero de 2025, proveedores y desplegadores deben adoptar
  medidas proporcionadas para asegurar un nivel suficiente de alfabetización en
  IA de las personas que operen o usen el sistema en su nombre;
- desde el 2 de agosto de 2026, si el sistema está concebido para un intercambio
  genuino, directo y bidireccional entre la propia IA y una persona, el proveedor
  debe diseñarlo para informarle inequívocamente desde el inicio de la primera
  interacción, salvo que resulte obvio en el contexto. La obligación no nace por
  contenido estático, trabajo en segundo plano ni comunicación mediante una
  persona intermediaria;
- el proveedor de un sistema que genere audio, imagen, vídeo o texto sintético
  debe incorporar a la salida un marcado legible por máquina y detectable,
  efectivo, interoperable, robusto y fiable en la medida técnicamente posible. Una
  etiqueta visual no sustituye este marcado técnico. La excepción transitoria
  hasta el 2 de diciembre de 2026 solo alcanza al artículo 50.2 para sistemas ya
  comercializados o puestos en servicio antes del 2 de agosto de 2026;
- el desplegador debe divulgar, de forma clara, distinguible y accesible no más
  tarde de la primera exposición, que una imagen, audio o vídeo constitutivo de
  *deepfake* ha sido generado o manipulado mediante IA. No toda ilustración
  generada es un *deepfake*;
- el desplegador debe divulgar el origen artificial del texto publicado para
  informar al público sobre asuntos de interés público, salvo que haya existido
  revisión humana sustantiva o control editorial real y una persona física o
  jurídica asuma la responsabilidad editorial de la publicación. Una revisión
  ortográfica o formal no basta. Si falta cualquiera de esas condiciones, debe
  mostrarse la divulgación en la primera exposición;
- cuando se traten datos personales, el aviso de IA no sustituye la información
  RGPD. Antes de recogerlos debe existir información por capas, clara y accesible,
  sobre responsable, fines, base jurídica, destinatarios y proveedor del modelo,
  transferencias, conservación, derechos y, cuando proceda, decisiones
  automatizadas, lógica significativa, importancia y consecuencias;
- las decisiones exclusivamente automatizadas basadas en datos personales que
  produzcan efectos jurídicos o similares significativos requieren encaje y
  garantías específicas conforme al artículo 22 RGPD. Una firma rutinaria no
  convierte el proceso en humano;
- la EIPD debe realizarse antes de iniciar el tratamiento cuando sea probable un
  alto riesgo para derechos y libertades. Si el riesgo residual alto no puede
  mitigarse, debe evaluarse la consulta previa del artículo 36 RGPD.

### Controles prudenciales de producto

F1 congela los controles siguientes aunque, fuera de los supuestos anteriores,
puedan ir más allá del mínimo legal:

- identificar toda salida asistida por IA que todavía sea un borrador y no
  presentarla como decisión profesional cerrada;
- mantener revisión humana real, competente y con autoridad para corregir,
  rechazar o detener, además de información, tiempo, medios e independencia para
  revisar el fondo. Cualquier afirmación de que la IA no decide o no presenta un
  escrito debe corresponder exactamente al comportamiento técnico;
- ofrecer un canal operativo para solicitar revisión humana, expresar el punto de
  vista e impugnar un resultado cuando corresponda;
- etiquetar también las imágenes decorativas generadas, aunque no sean
  *deepfakes*, y preservar cualquier marca técnica o dato de procedencia recibido
  del proveedor;
- someter los textos públicos a revisión sustantiva, comprobación de hechos y
  fuentes, aprobación por una persona con autoridad para modificar o rechazar el
  texto y asignación documentada de responsabilidad editorial;
- mantener trazabilidad minimizada: sistema o modelo, versión, proveedor,
  finalidad, identificador de operación, revisión, correcciones, decisión humana e
  incidencias. No deben guardarse indiscriminadamente prompts, entradas, salidas
  ni expedientes completos. Su contenido bruto solo podrá conservarse si existe
  necesidad, finalidad, base jurídica, plazo, control de acceso y medidas de
  seguridad documentados;
- documentar las medidas de alfabetización en IA como evidencia prudencial de su
  adecuación al conocimiento, experiencia, contexto y personas afectadas;
- aplicar antes de datos reales licitud, limitación de finalidad, minimización,
  exactitud, protección desde el diseño, categorías especiales o datos de
  infracciones, conservación, contratos con encargados, transferencias y seguridad;
- no afirmar “cumplimiento legal” por la existencia de un aviso, una etiqueta o
  una revisión interna.

### Revisión obligatoria por abogado y DPD antes de runtime

Permanecen pendientes la asignación de roles de la matriz, la calificación final
del caso de uso y de cualquier ADR, el encaje del artículo 22 RGPD, las bases de
licitud y condiciones para datos especiales o de infracciones, los contratos y
transferencias del proveedor, la suficiencia de la revisión editorial, la
calificación de cada contenido como *deepfake* o texto de interés público y las
obligaciones de consumo y profesionales. También deben validarse las afirmaciones
de la interfaz frente al flujo técnico final.

### Textos de trabajo para una interfaz futura

Solo cuando exista interacción directa con la IA, y sujeto a revisión jurídica y
a que las afirmaciones sean técnicamente ciertas:

> Estás interactuando con un sistema de inteligencia artificial de RTM. Puede
> ayudarte a ordenar información y preparar un borrador. La IA no decide por sí
> sola ni presenta escritos automáticamente. Las actuaciones relevantes requieren
> revisión humana. Puedes solicitar revisión humana y consultar la información de
> privacidad.

Para una salida individual todavía no revisada:

> Borrador preparado con asistencia de IA. No es una decisión ni un escrito
> aprobado. Requiere revisión humana.

Como política prudencial para imágenes decorativas generadas:

> Imagen ilustrativa generada con inteligencia artificial. No representa hechos
> ni personas reales.

Si un texto de interés público no cumple la excepción de revisión y
responsabilidad editorial:

> Texto generado o manipulado mediante inteligencia artificial.

Referencias oficiales vigentes para esta decisión:

- [Reglamento (UE) 2024/1689, texto consolidado](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02024R1689-20260727)
- [Artículo 4 — alfabetización en IA](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-4)
- [Artículo 50 — transparencia](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50)
- [Anexo III — administración de justicia y ADR](https://ai-act-service-desk.ec.europa.eu/en/ai-act/annex-3)
- [Comisión Europea — directrices finales sobre el artículo 50](https://digital-strategy.ec.europa.eu/en/library/guidelines-transparency-obligations-providers-and-deployers-ai-systems)
- [Comisión Europea — preguntas y respuestas sobre el artículo 50](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act)
- [Comisión Europea — Reglamento Ómnibus de IA y calendario actualizado](https://digital-strategy.ec.europa.eu/en/news/ai-omnibus-enters-force)
- [AEPD — auditorías de tratamientos que incluyan IA](https://www.aepd.es/recurso-multimedia/requisitos-para-auditorias-de-tratamientos-que-incluyan-ia)
- [AEPD — intervención humana en decisiones automatizadas](https://www.aepd.es/prensa-y-comunicacion/blog/evaluacion-de-la-intervencion-humana-en-las-decisiones-automatizadas)
- [AEPD — derecho de información por capas](https://www.aepd.es/derechos-y-deberes/conoce-tus-derechos/derecho-de-informacion)
- [AEPD — evaluaciones de impacto](https://www.aepd.es/derechos-y-deberes/cumple-tus-deberes/medidas-de-cumplimiento/realizacion-de-evaluaciones-de)

Este apartado fija requisitos de producto y auditoría; no sustituye un dictamen
jurídico ni una evaluación del DPD sobre la configuración final desplegada. Para
fechas y modificaciones prevalece el texto consolidado; las páginas del Service
Desk facilitan la navegación, pero pueden mostrar avisos de actualización pendiente
respecto del Reglamento Ómnibus.

## Secuencia prevista

1. **F1 — contrato offline:** gate puro, validadores, cliente GET y evidencia.
2. **F2 — acceso sintético privado:** login individual en memoria y vista
   read-only, cerrada por defecto, sin mutaciones.
3. **F3 — flujo asistido:** comandos por estado, idempotencia, ETag y separación
   de personas, únicamente tras auditoría específica.
4. **Producción:** permanece bloqueada hasta una autorización independiente.

La familia pública **Bancos y servicios financieros** se desarrollará en un
overlay visual/SEO independiente. Reutilizará los códigos backend `banca` y
`claims.banking`; no altera el contrato A1-S.

## Reproducción local

Desde la raíz del frontend y con el overlay sin confirmar, el cierre previsto es:

```text
python -B -m unittest discover -s tests -p "test_rtm_frontend_connect_a1s_f1*.py"
python -I -S -B scripts\rtm_frontend_connect_a1s_f1_preflight.py --archive "C:\rtm\RTM_FRONTEND_CONNECT_A1S_BASE_92aeac7.zip" --compact
npm run build
```

El preflight es offline, no importa los módulos runtime, no extrae el ZIP, no
toca base de datos y no usa red. La revisión cerró las 44 pruebas con resultado
`OK` y el preflight exacto contra el ZIP base con `ok: true`. El build no pudo
ejecutarse en el workspace Linux porque la entrega disponible contenía binarios
de Node para Windows, pero la verificación local obligatoria se completó después
en Windows: 75 módulos transformados y `✓ built in 12.76s`. Este resultado procede
de la salida de consola aportada por el operador; no se recibió un log firmado o
hash-congelado.

El build mantuvo tres avisos no bloqueantes de la base: datos `caniuse-lite`
desactualizados, la clave `landing` duplicada en el objeto de viajes de
`src/components/Navbar.jsx` y un chunk minificado de 501,65 kB. F1 no modifica
ninguno de esos archivos ni actualiza dependencias; su corrección queda separada
del overlay contractual.

## Veredicto

F1 queda en `passed_offline_contract` para su alcance exclusivamente estático y
offline. Este resultado no publica A1-S, no implementa una interfaz, no determina
cumplimiento legal y no autoriza staging runtime ni producción. Las pruebas, el
preflight exacto y el build local Windows están cerrados; el veredicto legal y
operativo live permanece `no_go`.
