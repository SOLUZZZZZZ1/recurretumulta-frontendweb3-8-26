# OPS: revisión de estacionamiento y nueva documentación

El estudio permite incorporar un PDF adicional o abrir una nueva revisión de hechos, y revisar las ocho comprobaciones de una previa de estacionamiento.

## API
- POST /ops/core/cases/{case_id}/study/actions: action=reopen_facts, reason (10–2000 caracteres), confirmed=true, expected_state_sha256.
- POST /ops/core/cases/{case_id}/study/documents: multipart metadata (reason, confirmed=true, expected_state_sha256) y file. Un PDF de hasta 4 MiB, validado en aislamiento. No envía Content-Type manual desde el navegador.
- POST /ops/core/cases/{case_id}/study/check-reviews: check_id, result (reviewed/needs_information), notes (10–2000), confirmed=true, expected_state_sha256.
- GET study incorpora documents, can_add_document, can_reopen_facts, available_actions y parking_review.

Se exige supervisor individual, alcance, autorización firmada y estado de expediente admitido. La identidad procede de la sesión. Cada escritura bloquea el expediente y compara el estado completo. Una respuesta perdida requiere recargar; no hay reintento automático.

## Versiones y persistencia
El nuevo PDF se añade como original sin borrar los anteriores. Crea una revisión editable que conserva los valores y añade la nueva fuente; no extrae ni confirma hechos automáticamente. La revisión anterior conserva su payload cerrado. Su clasificación y previa quedan invalidadas en la misma transacción. No se permite sustituir previas aprobadas, congeladas o en revisión final.

Cada comprobación guardada crea una previa draft sucesora con un recibo HMAC en events. El recibo liga expediente, hechos, clasificación, originales y digest de la previa; conserva las revisiones previas. Solo se permite reviewed cuando todos los campos exigidos tienen hechos contrastados y fuentes, incluidos valores booleanos false. needs_information conserva o repone el bloqueo. Los bloqueos ajenos a estas ocho comprobaciones se conservan.

Si la transacción documental falla, solo se elimina un objeto cuya falta de referencia se haya confirmado mediante otra conexión. Ante un COMMIT ambiguo o base de datos no disponible se conserva el objeto.

## Alcance
No requiere migración ni cambia los contratos históricos. No genera argumentos, peticiones, plazos calculados, aprobaciones ni presentaciones. La descarga excepcional de originales continúa sujeta al circuito existente. Las confirmaciones personales nunca aparecen marcadas de antemano.

## Verificación
Pruebas de control de acceso, estado obsoleto, firmas, fuentes, booleanos false, compensación documental y preservación de versiones. La suite PostgreSQL usa exclusivamente la base desechable de CI y prueba ocho guardados, reversión transaccional y documentación adicional. Las pruebas de navegador emplean datos ficticios locales; no registran decisiones en expedientes remotos.

## Dependencias y compilación
La auditoría del 05/10/2026 identificó avisos en pypdf 6.16.2 y en la cadena braces/brace-expansion del compilador Tailwind 3. El backend fija pypdf 6.19.0. El frontend utiliza Tailwind y @tailwindcss/postcss 4.3.3, sin la cadena vulnerable ni excepciones en la auditoría.

La paleta anterior queda expresada en src/tailwind-compat.css; se adaptan los nombres de sombras, desenfoque y outline según la guía oficial. Las fuentes se limitan a index.html y src. tailwind.config.js se conserva como referencia histórica y no se carga en la compilación v4. La compatibilidad de navegador pasa a los mínimos de Tailwind 4: Safari 16.4+, Chrome 111+ y Firefox 128+.

Fuentes:
- https://github.com/py-pdf/pypdf/releases/tag/6.19.0
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://tailwindcss.com/docs/upgrade-guide

La paleta procede de Tailwind CSS 3.4.19 (MIT, Tailwind Labs). Se conserva su licencia en src/tailwind-compat.css. La verificación local incluyó comparación visual de OPS, portada y navegación a Tráfico en móvil, sin desbordamiento horizontal.