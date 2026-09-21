# Manual del operador

Revisar un expediente, dejar constancia del trabajo y saber cómo continuar.

Revisión: 21/09/2026

**Antes de empezar:** Guía de la versión actual de OPS. La revisión de plazos está habilitada en la multa ficticia local. La regeneración y la aprobación final del recurso siguen pendientes en el panel PRO.

## Índice

- 1. El recorrido de trabajo, de principio a fin
- 2. Entrar y entender tus permisos
- 3. Revisar la autorización firmada
- 4. Revisar y completar los datos del expediente
- 5. Preparar y revisar el borrador del recurso
- 6. Revisar los plazos después de presentar
- 7. Consultar, crear y cerrar seguimientos
- 8. Pasar un expediente a revisión manual
- 9. Qué queda guardado y qué se pierde al salir
- 10. Resolver un bloqueo
- 11. Palabras de la pantalla
- 12. Pedir ayuda con información útil

## 1. El recorrido de trabajo, de principio a fin

**Dónde:** Panel OPS → expediente → Abrir revisión jurídica CORE.

Trabaja siempre sobre el expediente correcto. Completa y comprueba cada paso antes de pasar al siguiente.

1. Localiza el caso por cliente, matrícula, referencia o Case ID. Confirma que la persona y el asunto coinciden con los documentos.
2. Comprueba el estado del pago. En la prueba local, «pago simulado» corresponde a datos ficticios y no acredita un cobro real.
3. Revisa la autorización firmada. Su aprobación corresponde al supervisor y debe hacerse sobre el PDF que abre RTM.
4. Contrasta los hechos con el original y guarda cada corrección que proceda. Comprueba el importe, las fechas y la conducta denunciada.
5. Revisa la familia jurídica y el recurso. Si falta el documento o el control sigue pendiente, deja ese trabajo identificado para supervisión.
6. Comprueba los plazos y el canal previsto. En la prueba presentada, usa «Revisión del cómputo» para registrar las comprobaciones.
7. Consulta «Seguimientos» y deja las tareas necesarias con una descripción clara. La presentación solo puede continuar por el circuito habilitado para ese expediente.

**Cómo sabes que has terminado:** Queda identificado lo que está revisado, lo que falta y cuál es la siguiente actuación. Un expediente con documentos presentes puede seguir pendiente de aprobación.

**Si no puedes continuar:** Si un paso necesario está bloqueado, consulta el mensaje de esa sección y el apartado «Resolver un bloqueo». No marques como terminada una comprobación que no has podido realizar.


## 2. Entrar y entender tus permisos

**Dónde:** Pantalla «Identifica al operador» y cabecera del panel OPS.

1. Entra con tu cuenta individual. Si aparece el cambio de contraseña inicial, complétalo y vuelve a identificarte.
2. Comprueba tu nombre en el panel. La cuenta determina qué expedientes puedes consultar y qué acciones están habilitadas.
3. El operador consulta los expedientes de su alcance. Las correcciones de hechos, decisiones sobre autorizaciones y revisiones de plazos de esta versión requieren supervisión.
4. Antes de cambiar de pantalla, guarda el formulario en el que trabajas. Al terminar, utiliza «Cerrar sesión».

**Cómo sabes que has terminado:** Ves tus expedientes y los controles que corresponden a tu cuenta.

**Si no puedes continuar:** Un botón deshabilitado puede indicar falta de permisos, información pendiente o una función aún no habilitada. Lee el texto que lo acompaña. Si la sesión caduca, entra de nuevo y comprueba qué cambios quedaron guardados antes de repetirlos.


## 3. Revisar la autorización firmada

**Dónde:** Panel PRO → Autoridad de representación → Revisión exacta de autorización firmada.

Esta revisión permite comprobar la representación del cliente. Es distinta de la aprobación del recurso final.

1. Comprueba que el documento corresponde al expediente y pulsa «Abrir PDF exacto en ventana protegida».
2. Lee todas las páginas. Contrasta el firmado con la autorización emitida, la identidad y la presencia de una firma legible.
3. Marca cada casilla únicamente después de comprobarla. La huella SHA-256 identifica la copia exacta que estás revisando; no necesitas escribirla a mano.
4. Si el documento es correcto, introduce tu contraseña de supervisor en el campo de esta decisión y pulsa «Aprobar autorización».
5. Si procede rechazarlo, selecciona el motivo concreto, introduce tu contraseña de supervisor y pulsa «Rechazar candidato».
6. Espera la respuesta y comprueba el estado al recargar. La ventana de revisión puede caducar; en ese caso vuelve a abrir el PDF desde el panel.

**Cómo sabes que has terminado:** RTM registra la decisión de supervisión vinculada a esa copia del documento.

**Si no puedes continuar:** Si aparece «Candidato de firma no verificable», recarga e intenta abrirlo desde su control protegido. Si persiste, comunica el Case ID y el mensaje a soporte. La revisión queda pendiente hasta resolverlo.


## 4. Revisar y completar los datos del expediente

**Dónde:** Panel PRO → Hechos del expediente → Revisar o Añadir un dato que falta.

El formulario está disponible para borradores de multas cuando el pago del estudio y la autorización firmada están confirmados y la cuenta tiene permisos de supervisión.

1. Localiza el dato en el documento original. Una fecha del documento y una fecha de notificación pueden ser distintas.
2. Pulsa «Revisar» en la fila correspondiente e introduce el «Valor contrastado».
3. Si el dato todavía no aparece, abre «Añadir un dato que falta», elige el dato y pulsa «Incorporar este dato». El formulario empieza vacío y solo permite incorporar campos admitidos que no existan ya en esa versión.
4. Elige el «Documento original» y escribe la página. La numeración empieza por 1.
5. Copia el fragmento que respalda el dato y explica el motivo de la corrección. Si el original no permite confirmar el dato, mantenlo pendiente.
6. En los campos de Sí o No, selecciona una respuesta solo si está respaldada por el original. «No» no significa que falte información. «Multa pagada con reducción» se refiere al pago a la Administración, no al servicio de RTM.
7. Marca la comprobación personal y pulsa «Guardar nueva versión».
8. Comprueba el mensaje de guardado, la versión nueva y el dato actualizado. La guía se recarga con los datos confirmados. En la multa ficticia local, los datos adicionales revisados también se incorporan al siguiente borrador y a su PDF; revisa las versiones anteriores si han quedado desactualizadas.

**Cómo sabes que has terminado:** Cada corrección o incorporación conserva la versión anterior y registra el supervisor, el motivo y la procedencia documental. El contador solo incluye los datos ya incorporados; puede faltar información para preparar el recurso.

**Si no puedes continuar:** Si el expediente o la versión han cambiado, recarga los hechos y compara el estado antes de volver a guardar. Solo puedes usar originales vinculados a esta versión. Si el dato ya existe, utiliza «Revisar». Actualizar los datos todavía no regenera ni aprueba el recurso final.


## 5. Preparar y revisar el borrador del recurso

**Dónde:** Panel PRO → Preparar borrador → Borrador de trabajo del recurso. Disponible en la multa ficticia local.

1. Completa primero la revisión de la autorización firmada y confirma los siete datos del apartado «Hechos del expediente». «Antes de preparar el borrador» muestra exactamente lo que falta.
2. Pulsa «Preparar borrador» en la cabecera. Comprueba los datos confirmados: se incorporan automáticamente al escrito. Para corregirlos, vuelve a «Hechos del expediente».
3. Si el hecho confirmado es de estacionamiento, consulta la «Guía de estacionamiento»: muestra ocho comprobaciones, los datos disponibles y enlaces al BOE. «Añadir comprobaciones al borrador» las incorpora a las notas pendientes sin borrar tus textos; debes guardar una versión para conservarlas.
4. Completa «Motivos propuestos», «Petición propuesta» y «Documentos o comprobaciones pendientes». Puedes guardar trabajo incompleto; lo que dejes vacío figurará como pendiente en el PDF.
5. Escribe el «Motivo de esta versión», confirma que guardas un borrador pendiente de revisión jurídica y pulsa «Preparar primer borrador y PDF» o «Guardar nueva versión y PDF».
6. Espera la confirmación. Pulsa «Abrir PDF del borrador guardado» para comprobar la copia exacta. El PDF y el texto conservan la etiqueta de simulación y de revisión pendiente.
7. Para continuar otro día, recarga y utiliza «Partir del texto de la última versión». Cada guardado conserva el anterior; puedes consultarlo en «Historial de borradores».
8. Si aparece «Versión anterior», han cambiado los datos o los requisitos. Revisa lo que corresponda, adapta el texto y guarda otra versión. No confundas el borrador de trabajo con el recurso final aprobado.
9. Comprueba la conducta denunciada y la familia jurídica propuesta: por ejemplo, velocidad, semáforo o uso del móvil.
10. Comprueba si existe realmente un recurso. Una autorización firmada y la multa original son documentos diferentes del recurso.
11. Si aparece «No hay resultado IA todavía», registra que falta el análisis. Si aparece «Reanálisis CORE pendiente», ese control aún no inicia un análisis desde esta vista.
12. Si el contenido del recurso no corresponde al caso o la familia plantea dudas, marca el expediente para revisión manual y deja un seguimiento que describa el problema.
13. Mantén pendiente la aprobación final mientras su control esté deshabilitado. La lista local de casillas sirve de apoyo, pero no sustituye esa aprobación.

**Cómo sabes que has terminado:** El borrador de trabajo, su PDF, la fecha, el supervisor y el motivo quedan guardados por versiones. Los motivos y la petición siguen pendientes de revisión jurídica; guardar no aprueba ni presenta el escrito.

**Si no puedes continuar:** Si falla la respuesta al guardar, recarga antes de repetir. La guía de estacionamiento prepara la revisión: no confirma motivos, plazos ni un resultado favorable. La generación y aprobación final CORE siguen pendientes en esta vista. «Pasar a revisión manual» cambia el estado del caso; la preparación del texto está en «Borrador de trabajo del recurso».


## 6. Revisar los plazos después de presentar

**Dónde:** Panel PRO → Plazos tras la presentación → Revisión del cómputo.

En esta versión, el recorrido está habilitado para la presentación simulada de la multa de prueba. Las presentaciones reales aún no están conectadas a este cálculo.

1. Comprueba la fecha y el registro mostrados. «Desde la presentación» cuenta los días transcurridos; «Fecha de referencia» muestra la fecha obtenida antes de completar las comprobaciones del cómputo.
2. Lee la regla aplicable y la fecha que inicia el plazo. Contrástalas con el expediente y utiliza los enlaces al BOE como apoyo.
3. En «Revisión del cómputo», marca la regla como contrastada solo después de verificarla.
4. En resoluciones, notificaciones, suspensiones y ampliaciones, elige entre «Pendiente de contrastar», «Revisado, sin incidencias que alteren el cómputo» o «Hay incidencias que requieren valoración».
5. Si has comprobado el calendario completo, marca esa casilla y completa ámbito, órgano o registro, fuente, criterio, cobertura y festivos. En esta prueba, identifica expresamente cualquier calendario inventado.
6. Escribe qué documentos contrastaste, el resultado y lo que falta. Confirma personalmente lo indicado y pulsa «Guardar revisión».
7. Comprueba el «Historial de revisiones». Una revisión incompleta queda guardada con el vencimiento pendiente. Con datos completos, aparece separada la fecha calculada con datos revisados.

**Cómo sabes que has terminado:** Se guardan las comprobaciones, las notas, el supervisor y la fecha. La pantalla permite distinguir el cálculo revisado de la referencia inicial.

**Si no puedes continuar:** Si hay incidencias que alteran el plazo, hace falta valoración individual. Si cambia el expediente, RTM exige una revisión nueva. Alcanzar una fecha no cierra automáticamente el asunto ni declara un resultado favorable.


## 7. Consultar, crear y cerrar seguimientos

**Dónde:** Panel OPS → Seguimientos. Para crear o cerrar: ficha del expediente → Seguimientos.

1. Pulsa «Seguimientos» y revisa «Pendientes», «Vencidos» y «Próximos 7 días». Busca por cliente, referencia, matrícula, título o Case ID.
2. Pulsa «Abrir expediente» en el aviso que quieres atender. Lee su descripción: puede ser una tarea de trabajo o una revisión pendiente.
3. Con permisos de supervisión, entra en la ficha general del expediente, completa «Título del seguimiento», fecha y hora, y «Descripción / nota». Pulsa «Crear seguimiento».
4. Usa un título que indique la actuación: por ejemplo, «Revisar fecha de notificación con el original». En la nota explica qué falta y qué documento permitirá resolverlo.
5. Cuando la actuación esté realizada, utiliza «Marcar resuelto» y comprueba el cambio de estado.

**Cómo sabes que has terminado:** El aviso queda guardado y aparece en la bandeja. Cerrar un seguimiento deja resuelta esa tarea, no todo el expediente.

**Si no puedes continuar:** Si la bandeja aparece vacía, pulsa «Actualizar», selecciona todos los estados y cualquier fecha y borra la búsqueda. Si sigue vacía, aún no hay avisos accesibles con esos criterios. El vencimiento de un recordatorio operativo no acredita por sí solo un vencimiento legal.


## 8. Pasar un expediente a revisión manual

**Dónde:** Cabecera del panel PRO → Pasar a revisión manual, junto a Volver.

Usa esta acción cuando haga falta una valoración humana que no puedes cerrar: familia dudosa, recurso incorrecto, prueba insuficiente, plazo incierto o canal sin confirmar.

1. Identifica el problema concreto y el dato o documento que falta.
2. Pulsa «Pasar a revisión manual» con tu sesión de supervisor. Espera la confirmación y comprueba el estado del expediente.
3. Desde la ficha general, crea un seguimiento con el motivo concreto y la actuación pendiente. El botón de revisión manual registra un motivo genérico.
4. Continúa únicamente cuando se haya resuelto el problema y el siguiente paso esté habilitado.

**Cómo sabes que has terminado:** El expediente queda marcado para revisión manual. Esta acción no lo asigna automáticamente a otra persona ni envía una comunicación.

**Si no puedes continuar:** El antiguo botón «Manual» ahora se llama «Pasar a revisión manual». Para consultar instrucciones, usa «Manual del operador».


## 9. Qué queda guardado y qué se pierde al salir

Antes de salir de un formulario, espera su confirmación de guardado. Si la respuesta falla, recarga para comprobar el resultado antes de repetir la acción.

| Elemento | Qué ocurre |
| --- | --- |
| Decisión de autorización | Se registra cuando el servidor confirma la aprobación o el rechazo. |
| Corrección de hechos | «Guardar nueva versión» conserva una versión nueva y la anterior. |
| Borrador de trabajo del recurso | El guardado confirmado conserva texto, PDF e historial. Los cambios que todavía no hayas guardado se pierden al salir. |
| Revisión del cómputo | «Guardar revisión» conserva las comprobaciones y el historial en la prueba local. |
| Seguimiento creado o resuelto | Se guarda en el expediente después de confirmar la acción. |
| Pasar a revisión manual | Se guarda el cambio de estado y su evento. |
| Envío de recursos: Aplicar envío en esta vista | La selección de canal es temporal. No registra un envío ni se conserva al salir. |
| Checklist local de revisión | Las casillas son apoyo temporal y se pierden al salir. |
| Formulario aún sin guardar | Lo escrito no se conserva al abandonar o recargar la pantalla. |

**Cómo sabes que has terminado:** La confirmación del servidor y el estado recargado permiten comprobar que una acción quedó registrada.


## 10. Resolver un bloqueo

| Lo que ves | Qué debes hacer |
| --- | --- |
| Candidato de firma no verificable | Recarga y vuelve a abrir el candidato desde su botón protegido. Si persiste, comunica el caso y el error. Mantén pendiente la decisión. |
| Primero revisa y aprueba la autorización | Un supervisor debe completar la revisión del documento firmado antes de corregir hechos. |
| La revisión requiere el pago confirmado | Contrasta el estado del pago con supervisión. No conviertas un pago simulado en un cobro real. |
| No hay borrador o resultado IA | Falta preparar el análisis o el borrador. Los controles CORE pendientes no lo ejecutan todavía. |
| El expediente o su revisión han cambiado | Recarga, compara la versión actual y revisa de nuevo. No repitas el guardado con datos anteriores. |
| No se pudo comprobar el guardado | Recarga y consulta versión, historial o estado. Verifica primero si la acción llegó a guardarse. |
| Botón gris o solo lectura | Comprueba tu rol, los requisitos de la sección y si indica «pendiente». Solicita a supervisión la actuación necesaria. |
| Documentación incompleta | Identifica cuál falta: recurso, autorización verificada u original. Cada uno cumple una función distinta. |
| Presenter no está habilitado | Consulta el manual del presentador. En el PC local la presentación y firma siguen cerradas. |
| El PDF no se abre | Comprueba si el navegador ha bloqueado la ventana emergente de RTM. Vuelve a abrirla desde el expediente; si falla, comunica el mensaje exacto. |
| Un expediente no aparece | Borra filtros y comprueba la referencia. Si persiste, pide revisar tu acceso o asignación. |


## 11. Palabras de la pantalla

| Término | Significado práctico |
| --- | --- |
| Case ID | Identificador interno del expediente. Úsalo para localizarlo y comunicar incidencias. |
| Referencia del expediente | Número o referencia del organismo; puede ser distinto del Case ID de RTM. |
| Familia jurídica | Grupo de asuntos con tratamiento semejante, como velocidad o semáforo. |
| Borrador | Contenido todavía pendiente de las revisiones y aprobaciones posteriores. |
| Candidato de firma | Documento firmado aportado, pendiente de su comprobación. |
| Procedencia documental | Documento, página y fragmento que respaldan un dato. |
| SHA-256 o huella | Identificador de una copia exacta. Permite detectar si el contenido cambia. |
| CORE pendiente | Función todavía sin habilitar en ese control del panel. |
| Simulación / sintético | Prueba con datos ficticios, sin presentación administrativa ni cobro real. |
| Custodiado en RTM | Documento conservado dentro del sistema. La etiqueta no implica que esté revisado ni habilita su descarga. |


## 12. Pedir ayuda con información útil

**Dónde:** Responsable de supervisión o soporte interno de RTM.

1. Anota el Case ID y la referencia, la pantalla y el botón que estabas utilizando.
2. Copia el mensaje de error exacto e indica la fecha y hora aproximadas.
3. Explica qué esperabas que ocurriera y qué ves ahora. Indica si ya recargaste y qué estado aparece.
4. Si afecta a un plazo próximo, señala la urgencia y la fecha que figura en el expediente para que supervisión priorice la revisión.

**Cómo sabes que has terminado:** Supervisión dispone de los datos necesarios para localizar el problema. Comparte la incidencia por el canal interno autorizado; las contraseñas y certificados no forman parte del informe.

### Plantilla para comunicar la incidencia

```text
Expediente / Case ID:
Pantalla y acción:
Fecha y hora:
Mensaje exacto:
Resultado esperado:
Estado al recargar:
Actuación pendiente / urgencia:
```
