// Single source for the in-app manuals and their printable Markdown copies.
export const MANUAL_REVISION = "21/09/2026";

export const OPERATOR_MANUAL = {
  id: "operador", title: "Manual del operador", subtitle: "Revisar un expediente, dejar constancia del trabajo y saber cómo continuar.",
  notice: "Guía de la versión actual de OPS. La revisión de plazos está habilitada en la multa ficticia local. La regeneración y la aprobación final del recurso siguen pendientes en el panel PRO.",
  quick: [["empezar", "Empezar un expediente"], ["bloqueos", "Resolver un bloqueo"], ["guardado", "Saber qué queda guardado"]],
  sections: [
    { id: "empezar", title: "1. El recorrido de trabajo, de principio a fin", where: "Panel OPS → expediente → Abrir revisión jurídica CORE.",
      intro: "Trabaja siempre sobre el expediente correcto. Completa y comprueba cada paso antes de pasar al siguiente.",
      steps: [
        "Localiza el caso por cliente, matrícula, referencia o Case ID. Confirma que la persona y el asunto coinciden con los documentos.",
        "Comprueba el estado del pago. En la prueba local, «pago simulado» corresponde a datos ficticios y no acredita un cobro real.",
        "Revisa la autorización firmada. Su aprobación corresponde al supervisor y debe hacerse sobre el PDF que abre RTM.",
        "Contrasta los hechos con el original y guarda cada corrección que proceda. Comprueba el importe, las fechas y la conducta denunciada.",
        "Revisa la familia jurídica y el recurso. Si falta el documento o el control sigue pendiente, deja ese trabajo identificado para supervisión.",
        "Comprueba los plazos y el canal previsto. En la prueba presentada, usa «Revisión del cómputo» para registrar las comprobaciones.",
        "Consulta «Seguimientos» y deja las tareas necesarias con una descripción clara. La presentación solo puede continuar por el circuito habilitado para ese expediente."
      ],
      outcome: "Queda identificado lo que está revisado, lo que falta y cuál es la siguiente actuación. Un expediente con documentos presentes puede seguir pendiente de aprobación.",
      blocked: "Si un paso necesario está bloqueado, consulta el mensaje de esa sección y el apartado «Resolver un bloqueo». No marques como terminada una comprobación que no has podido realizar." },
    { id: "acceso", title: "2. Entrar y entender tus permisos", where: "Pantalla «Identifica al operador» y cabecera del panel OPS.",
      steps: [
        "Entra con tu cuenta individual. Si aparece el cambio de contraseña inicial, complétalo y vuelve a identificarte.",
        "Comprueba tu nombre en el panel. La cuenta determina qué expedientes puedes consultar y qué acciones están habilitadas.",
        "El operador consulta los expedientes de su alcance. Las correcciones de hechos, decisiones sobre autorizaciones y revisiones de plazos de esta versión requieren supervisión.",
        "Antes de cambiar de pantalla, guarda el formulario en el que trabajas. Al terminar, utiliza «Cerrar sesión»."
      ],
      outcome: "Ves tus expedientes y los controles que corresponden a tu cuenta.",
      blocked: "Un botón deshabilitado puede indicar falta de permisos, información pendiente o una función aún no habilitada. Lee el texto que lo acompaña. Si la sesión caduca, entra de nuevo y comprueba qué cambios quedaron guardados antes de repetirlos." },
    { id: "autorizacion", title: "3. Revisar la autorización firmada", where: "Panel PRO → Autoridad de representación → Revisión exacta de autorización firmada.",
      intro: "Esta revisión permite comprobar la representación del cliente. Es distinta de la aprobación del recurso final.",
      steps: [
        "Comprueba que el documento corresponde al expediente y pulsa «Abrir PDF exacto en ventana protegida».",
        "Lee todas las páginas. Contrasta el firmado con la autorización emitida, la identidad y la presencia de una firma legible.",
        "Marca cada casilla únicamente después de comprobarla. La huella SHA-256 identifica la copia exacta que estás revisando; no necesitas escribirla a mano.",
        "Si el documento es correcto, introduce tu contraseña de supervisor en el campo de esta decisión y pulsa «Aprobar autorización».",
        "Si procede rechazarlo, selecciona el motivo concreto, introduce tu contraseña de supervisor y pulsa «Rechazar candidato».",
        "Espera la respuesta y comprueba el estado al recargar. La ventana de revisión puede caducar; en ese caso vuelve a abrir el PDF desde el panel."
      ],
      outcome: "RTM registra la decisión de supervisión vinculada a esa copia del documento.",
      blocked: "Si aparece «Candidato de firma no verificable», recarga e intenta abrirlo desde su control protegido. Si persiste, comunica el Case ID y el mensaje a soporte. La revisión queda pendiente hasta resolverlo." },
    { id: "hechos", title: "4. Revisar y completar los datos del expediente", where: "Panel PRO → Hechos del expediente → Revisar o Añadir un dato que falta.",
      intro: "El formulario está disponible para borradores de multas cuando el pago del estudio y la autorización firmada están confirmados y la cuenta tiene permisos de supervisión.",
      steps: [
        "Localiza el dato en el documento original. Una fecha del documento y una fecha de notificación pueden ser distintas.",
        "Pulsa «Revisar» en la fila correspondiente e introduce el «Valor contrastado».",
        "Si el dato todavía no aparece, abre «Añadir un dato que falta», elige el dato y pulsa «Incorporar este dato». El formulario empieza vacío y solo permite incorporar campos admitidos que no existan ya en esa versión.",
        "Elige el «Documento original» y escribe la página. La numeración empieza por 1.",
        "Copia el fragmento que respalda el dato y explica el motivo de la corrección. Si el original no permite confirmar el dato, mantenlo pendiente.",
        "En los campos de Sí o No, selecciona una respuesta solo si está respaldada por el original. «No» no significa que falte información. «Multa pagada con reducción» se refiere al pago a la Administración, no al servicio de RTM.",
        "Marca la comprobación personal y pulsa «Guardar nueva versión».",
        "Comprueba el mensaje de guardado, la versión nueva y el dato actualizado. La guía se recarga con los datos confirmados. En la multa ficticia local, los datos adicionales revisados también se incorporan al siguiente borrador y a su PDF; revisa las versiones anteriores si han quedado desactualizadas."
      ],
      outcome: "Cada corrección o incorporación conserva la versión anterior y registra el supervisor, el motivo y la procedencia documental. El contador solo incluye los datos ya incorporados; puede faltar información para preparar el recurso.",
      blocked: "Si el expediente o la versión han cambiado, recarga los hechos y compara el estado antes de volver a guardar. Solo puedes usar originales vinculados a esta versión. Si el dato ya existe, utiliza «Revisar». Actualizar los datos todavía no regenera ni aprueba el recurso final." },
    { id: "recurso", title: "5. Preparar y revisar el borrador del recurso", where: "Panel PRO → Preparar borrador → Borrador de trabajo del recurso. Disponible en la multa ficticia local.",
      steps: [
        "Completa primero la revisión de la autorización firmada y confirma los siete datos del apartado «Hechos del expediente». «Antes de preparar el borrador» muestra exactamente lo que falta.",
        "Pulsa «Preparar borrador» en la cabecera. Comprueba los datos confirmados: se incorporan automáticamente al escrito. Para corregirlos, vuelve a «Hechos del expediente».",
        "Si el hecho confirmado es de estacionamiento, consulta la «Guía de estacionamiento»: muestra ocho comprobaciones, los datos disponibles y enlaces al BOE. «Añadir comprobaciones al borrador» las incorpora a las notas pendientes sin borrar tus textos; debes guardar una versión para conservarlas.",
        "Completa «Motivos propuestos», «Petición propuesta» y «Documentos o comprobaciones pendientes». Puedes guardar trabajo incompleto; lo que dejes vacío figurará como pendiente en el PDF.",
        "Escribe el «Motivo de esta versión», confirma que guardas un borrador pendiente de revisión jurídica y pulsa «Preparar primer borrador y PDF» o «Guardar nueva versión y PDF».",
        "Espera la confirmación. Pulsa «Abrir PDF del borrador guardado» para comprobar la copia exacta. El PDF y el texto conservan la etiqueta de simulación y de revisión pendiente.",
        "Para continuar otro día, recarga y utiliza «Partir del texto de la última versión». Cada guardado conserva el anterior; puedes consultarlo en «Historial de borradores».",
        "Si aparece «Versión anterior», han cambiado los datos o los requisitos. Revisa lo que corresponda, adapta el texto y guarda otra versión. No confundas el borrador de trabajo con el recurso final aprobado.",
        "Comprueba la conducta denunciada y la familia jurídica propuesta: por ejemplo, velocidad, semáforo o uso del móvil.",
        "Comprueba si existe realmente un recurso. Una autorización firmada y la multa original son documentos diferentes del recurso.",
        "Si aparece «No hay resultado IA todavía», registra que falta el análisis. Si aparece «Reanálisis CORE pendiente», ese control aún no inicia un análisis desde esta vista.",
        "Si el contenido del recurso no corresponde al caso o la familia plantea dudas, marca el expediente para revisión manual y deja un seguimiento que describa el problema.",
        "Mantén pendiente la aprobación final mientras su control esté deshabilitado. La lista local de casillas sirve de apoyo, pero no sustituye esa aprobación."
      ],
      outcome: "El borrador de trabajo, su PDF, la fecha, el supervisor y el motivo quedan guardados por versiones. Los motivos y la petición siguen pendientes de revisión jurídica; guardar no aprueba ni presenta el escrito.",
      blocked: "Si falla la respuesta al guardar, recarga antes de repetir. La guía de estacionamiento prepara la revisión: no confirma motivos, plazos ni un resultado favorable. La generación y aprobación final CORE siguen pendientes en esta vista. «Pasar a revisión manual» cambia el estado del caso; la preparación del texto está en «Borrador de trabajo del recurso»." },
    { id: "plazos", title: "6. Revisar los plazos después de presentar", where: "Panel PRO → Plazos tras la presentación → Revisión del cómputo.",
      intro: "En esta versión, el recorrido está habilitado para la presentación simulada de la multa de prueba. Las presentaciones reales aún no están conectadas a este cálculo.",
      steps: [
        "Comprueba la fecha y el registro mostrados. «Desde la presentación» cuenta los días transcurridos; «Fecha de referencia» muestra la fecha obtenida antes de completar las comprobaciones del cómputo.",
        "Lee la regla aplicable y la fecha que inicia el plazo. Contrástalas con el expediente y utiliza los enlaces al BOE como apoyo.",
        "En «Revisión del cómputo», marca la regla como contrastada solo después de verificarla.",
        "En resoluciones, notificaciones, suspensiones y ampliaciones, elige entre «Pendiente de contrastar», «Revisado, sin incidencias que alteren el cómputo» o «Hay incidencias que requieren valoración».",
        "Si has comprobado el calendario completo, marca esa casilla y completa ámbito, órgano o registro, fuente, criterio, cobertura y festivos. En esta prueba, identifica expresamente cualquier calendario inventado.",
        "Escribe qué documentos contrastaste, el resultado y lo que falta. Confirma personalmente lo indicado y pulsa «Guardar revisión».",
        "Comprueba el «Historial de revisiones». Una revisión incompleta queda guardada con el vencimiento pendiente. Con datos completos, aparece separada la fecha calculada con datos revisados."
      ],
      outcome: "Se guardan las comprobaciones, las notas, el supervisor y la fecha. La pantalla permite distinguir el cálculo revisado de la referencia inicial.",
      blocked: "Si hay incidencias que alteran el plazo, hace falta valoración individual. Si cambia el expediente, RTM exige una revisión nueva. Alcanzar una fecha no cierra automáticamente el asunto ni declara un resultado favorable." },
    { id: "seguimientos", title: "7. Consultar, crear y cerrar seguimientos", where: "Panel OPS → Seguimientos. Para crear o cerrar: ficha del expediente → Seguimientos.",
      steps: [
        "Pulsa «Seguimientos» y revisa «Pendientes», «Vencidos» y «Próximos 7 días». Busca por cliente, referencia, matrícula, título o Case ID.",
        "Pulsa «Abrir expediente» en el aviso que quieres atender. Lee su descripción: puede ser una tarea de trabajo o una revisión pendiente.",
        "Con permisos de supervisión, entra en la ficha general del expediente, completa «Título del seguimiento», fecha y hora, y «Descripción / nota». Pulsa «Crear seguimiento».",
        "Usa un título que indique la actuación: por ejemplo, «Revisar fecha de notificación con el original». En la nota explica qué falta y qué documento permitirá resolverlo.",
        "Cuando la actuación esté realizada, utiliza «Marcar resuelto» y comprueba el cambio de estado."
      ],
      outcome: "El aviso queda guardado y aparece en la bandeja. Cerrar un seguimiento deja resuelta esa tarea, no todo el expediente.",
      blocked: "Si la bandeja aparece vacía, pulsa «Actualizar», selecciona todos los estados y cualquier fecha y borra la búsqueda. Si sigue vacía, aún no hay avisos accesibles con esos criterios. El vencimiento de un recordatorio operativo no acredita por sí solo un vencimiento legal." },
    { id: "revision-manual", title: "8. Pasar un expediente a revisión manual", where: "Cabecera del panel PRO → Pasar a revisión manual, junto a Volver.",
      intro: "Usa esta acción cuando haga falta una valoración humana que no puedes cerrar: familia dudosa, recurso incorrecto, prueba insuficiente, plazo incierto o canal sin confirmar.",
      steps: [
        "Identifica el problema concreto y el dato o documento que falta.",
        "Pulsa «Pasar a revisión manual» con tu sesión de supervisor. Espera la confirmación y comprueba el estado del expediente.",
        "Desde la ficha general, crea un seguimiento con el motivo concreto y la actuación pendiente. El botón de revisión manual registra un motivo genérico.",
        "Continúa únicamente cuando se haya resuelto el problema y el siguiente paso esté habilitado."
      ],
      outcome: "El expediente queda marcado para revisión manual. Esta acción no lo asigna automáticamente a otra persona ni envía una comunicación.",
      blocked: "El antiguo botón «Manual» ahora se llama «Pasar a revisión manual». Para consultar instrucciones, usa «Manual del operador»." },
    { id: "guardado", title: "9. Qué queda guardado y qué se pierde al salir", intro: "Antes de salir de un formulario, espera su confirmación de guardado. Si la respuesta falla, recarga para comprobar el resultado antes de repetir la acción.",
      table: { columns: ["Elemento", "Qué ocurre"], rows: [
        ["Decisión de autorización", "Se registra cuando el servidor confirma la aprobación o el rechazo."],
        ["Corrección de hechos", "«Guardar nueva versión» conserva una versión nueva y la anterior."],
        ["Borrador de trabajo del recurso", "El guardado confirmado conserva texto, PDF e historial. Los cambios que todavía no hayas guardado se pierden al salir."],
        ["Revisión del cómputo", "«Guardar revisión» conserva las comprobaciones y el historial en la prueba local."],
        ["Seguimiento creado o resuelto", "Se guarda en el expediente después de confirmar la acción."],
        ["Pasar a revisión manual", "Se guarda el cambio de estado y su evento."],
        ["Envío de recursos: Aplicar envío en esta vista", "La selección de canal es temporal. No registra un envío ni se conserva al salir."],
        ["Checklist local de revisión", "Las casillas son apoyo temporal y se pierden al salir."],
        ["Formulario aún sin guardar", "Lo escrito no se conserva al abandonar o recargar la pantalla."]
      ]}, outcome: "La confirmación del servidor y el estado recargado permiten comprobar que una acción quedó registrada." },
    { id: "bloqueos", title: "10. Resolver un bloqueo", tags: "error firma pago permisos PDF versión botón gris documentos faltan",
      table: { columns: ["Lo que ves", "Qué debes hacer"], rows: [
        ["Candidato de firma no verificable", "Recarga y vuelve a abrir el candidato desde su botón protegido. Si persiste, comunica el caso y el error. Mantén pendiente la decisión."],
        ["Primero revisa y aprueba la autorización", "Un supervisor debe completar la revisión del documento firmado antes de corregir hechos."],
        ["La revisión requiere el pago confirmado", "Contrasta el estado del pago con supervisión. No conviertas un pago simulado en un cobro real."],
        ["No hay borrador o resultado IA", "Falta preparar el análisis o el borrador. Los controles CORE pendientes no lo ejecutan todavía."],
        ["El expediente o su revisión han cambiado", "Recarga, compara la versión actual y revisa de nuevo. No repitas el guardado con datos anteriores."],
        ["No se pudo comprobar el guardado", "Recarga y consulta versión, historial o estado. Verifica primero si la acción llegó a guardarse."],
        ["Botón gris o solo lectura", "Comprueba tu rol, los requisitos de la sección y si indica «pendiente». Solicita a supervisión la actuación necesaria."],
        ["Documentación incompleta", "Identifica cuál falta: recurso, autorización verificada u original. Cada uno cumple una función distinta."],
        ["Presenter no está habilitado", "Consulta el manual del presentador. En el PC local la presentación y firma siguen cerradas."],
        ["El PDF no se abre", "Comprueba si el navegador ha bloqueado la ventana emergente de RTM. Vuelve a abrirla desde el expediente; si falla, comunica el mensaje exacto."],
        ["Un expediente no aparece", "Borra filtros y comprueba la referencia. Si persiste, pide revisar tu acceso o asignación."]
      ]} },
    { id: "glosario", title: "11. Palabras de la pantalla", table: { columns: ["Término", "Significado práctico"], rows: [
      ["Case ID", "Identificador interno del expediente. Úsalo para localizarlo y comunicar incidencias."],
      ["Referencia del expediente", "Número o referencia del organismo; puede ser distinto del Case ID de RTM."],
      ["Familia jurídica", "Grupo de asuntos con tratamiento semejante, como velocidad o semáforo."],
      ["Borrador", "Contenido todavía pendiente de las revisiones y aprobaciones posteriores."],
      ["Candidato de firma", "Documento firmado aportado, pendiente de su comprobación."],
      ["Procedencia documental", "Documento, página y fragmento que respaldan un dato."],
      ["SHA-256 o huella", "Identificador de una copia exacta. Permite detectar si el contenido cambia."],
      ["CORE pendiente", "Función todavía sin habilitar en ese control del panel."],
      ["Simulación / sintético", "Prueba con datos ficticios, sin presentación administrativa ni cobro real."],
      ["Custodiado en RTM", "Documento conservado dentro del sistema. La etiqueta no implica que esté revisado ni habilita su descarga."]
    ]} },
    { id: "soporte", title: "12. Pedir ayuda con información útil", where: "Responsable de supervisión o soporte interno de RTM.",
      steps: ["Anota el Case ID y la referencia, la pantalla y el botón que estabas utilizando.",
        "Copia el mensaje de error exacto e indica la fecha y hora aproximadas.",
        "Explica qué esperabas que ocurriera y qué ves ahora. Indica si ya recargaste y qué estado aparece.",
        "Si afecta a un plazo próximo, señala la urgencia y la fecha que figura en el expediente para que supervisión priorice la revisión."],
      template: "Expediente / Case ID:\nPantalla y acción:\nFecha y hora:\nMensaje exacto:\nResultado esperado:\nEstado al recargar:\nActuación pendiente / urgencia:",
      outcome: "Supervisión dispone de los datos necesarios para localizar el problema. Comparte la incidencia por el canal interno autorizado; las contraseñas y certificados no forman parte del informe." }
  ]
};

export const PRESENTER_MANUAL = {
  id: "presentador", title: "Manual del presentador", subtitle: "Preparar la actuación, coordinar la firma y comprobar el justificante.",
  notice: "En este PC, Presenter y el puesto de firma no están habilitados. El entorno de pruebas permite preparar tareas sintéticas; la apertura y entrega a sedes reales, la firma, el envío y la conciliación de justificantes siguen bloqueados. Esta guía identifica dónde termina el recorrido disponible.",
  quick: [["alcance", "Qué se puede hacer ahora"], ["preparacion", "Preparar una tarea"], ["bloqueos", "Resolver un bloqueo"]],
  sections: [
    { id: "alcance", title: "1. Quién hace cada parte y qué está disponible", intro: "Presenter organiza la preparación documental. El puesto de firma tiene una cuenta y una sesión separadas. Preparar una tarea y presentar ante una Administración son estados distintos.",
      table: { columns: ["Parte del trabajo", "Responsable y situación actual"], rows: [
        ["Revisión del caso y del recurso", "Operador y supervisor en OPS, según sus permisos. El manual del operador explica los controles disponibles."],
        ["Elegir destino, texto y documentos", "Cuenta con permisos Presenter y acceso al caso. Preparación sintética en el entorno de pruebas habilitado."],
        ["Reservar y revisar una tarea de firma", "Cuenta individual de firmante y puesto correspondiente, en el entorno de pruebas preparado."],
        ["Abrir una sede, entregar archivos, firmar y registrar", "Recorrido real pendiente de activación. El botón bloqueado no realiza la presentación."],
        ["Capturar y conciliar el justificante", "Integración pendiente. Un PDF aportado empieza como evidencia candidata."],
        ["Presenter en este PC local", "No disponible. Puedes consultar esta guía y continuar las pruebas de gestión en OPS."]
      ]}, outcome: "Antes de empezar sabes si estás preparando una prueba y hasta qué paso puede llegar esa sesión." },
    { id: "preparacion", title: "2. Preparar una tarea desde el expediente", where: "Ficha del expediente → Preparar presentación, o panel PRO → Preparar en RTM Presenter.",
      steps: ["Comprueba cliente, Case ID, referencia y documentación. Asegúrate de que el escrito que se pretende presentar es el correcto.",
        "Abre Presenter desde ese expediente cuando el acceso esté habilitado. Confirma que sigues dentro del mismo caso.",
        "En «Elige cómo sale el expediente», selecciona «Presentar un escrito o recurso» para sede o portal, o «Enviar una reclamación desde OPS» para Correspondencia.",
        "Sigue los pasos del canal elegido. Para portal: Contenedor → Sede y procedimiento → Completar solicitud → Fijar documentos → Cola de firma.",
        "Al terminar cada etapa, comprueba el estado mostrado en «Qué está acreditado y qué falta»."
      ], outcome: "Hay un canal de preparación elegido para el expediente correcto.",
      blocked: "Si aparece «Presentación y firma no disponibles en local», has llegado al límite de este entorno. Vuelve a OPS. Abrir otra pestaña o usar la cuenta del firmante no habilita Presenter local." },
    { id: "documentos", title: "3. Comprobar e incorporar documentos", where: "Presenter → Documentos disponibles en RTM y alta de documento externo.",
      steps: ["Identifica el escrito principal, la notificación, la autorización y las pruebas que realmente pide el trámite.",
        "Comprueba tipo, versión y estado de cada documento. La lista muestra metadatos de custodia; no ofrece una carpeta o ZIP de descarga.",
        "Si tu cuenta permite incorporar documentación, abre el alta de documento externo, selecciona el archivo y escribe un nombre reconocible y el tipo correcto.",
        "Cuando sustituya un documento anterior, utiliza la opción de nueva versión y elige el documento al que pertenece.",
        "Espera el resultado del ingreso. Un documento recién incorporado permanece pendiente del análisis requerido y puede no ser seleccionable.",
        "Vuelve a comprobar qué versión es elegible. Una versión nueva puede dejar fuera de uso a la anterior, incluso mientras la nueva sigue en revisión."
      ], outcome: "Los documentos quedan identificados y versionados dentro del expediente. Solo las versiones aptas podrán formar parte de la selección.",
      blocked: "Si un documento está en revisión, no lo sustituyas por una copia antigua para superar el bloqueo. Solicita la comprobación pendiente. Los justificantes de presentación se conservan en «Justificantes y acuses», separados de los documentos de salida." },
    { id: "destino", title: "4. Elegir sede, procedimiento y representación", where: "Presenter → Paso 2 · Canal y destino.",
      steps: ["Busca el organismo por nombre, localidad o código cuando proceda. Comprueba el destinatario concreto y el procedimiento requerido.",
        "Distingue «Organismos encontrados» del destino seleccionable de RTM. Que una unidad aparezca en el directorio no significa que tenga un procedimiento habilitado.",
        "Elige únicamente el perfil de destino disponible para la preparación. Revisa nombre, procedimiento y dirección exacta de la sede que muestra la ficha.",
        "Selecciona la condición correcta: «Actúo como interesado» o «Actúo como representante». Si hay representación, vincula la autorización exigida.",
        "Si falta la sede, usa «¿La sede no aparece?» cuando esté disponible para proponerla. La propuesta queda pendiente de comprobación.",
        "En pruebas, utiliza un recorrido identificado expresamente como sintético. No lo interpretes como una sede administrativa real."
      ], outcome: "Quedan identificados el destino, el procedimiento y la condición de quien actúa.",
      blocked: "Si no existe un perfil compatible o falta la autorización, deja pendiente la preparación y pide revisión. Un enlace propuesto no abre ni verifica una sede." },
    { id: "solicitud", title: "5. Completar la solicitud y elegir los adjuntos", where: "Presenter → Deja completa la solicitud para el firmante → Documentos exactos.",
      steps: ["Completa los campos que muestra ese procedimiento. La prueba de escrito general incluye Asunto, Expone y Solicita.",
        "Contrasta identificación, referencia, hechos y petición con el expediente. Revisa los límites de longitud que aparecen junto a cada campo.",
        "En cada requisito documental, usa «Elegir desde RTM» y selecciona la versión correspondiente.",
        "Comprueba en «Ver detalles del documento elegido» el tipo, formato y versión. Atiende a los límites de tamaño y número de archivos de cada requisito.",
        "Comprueba la autorización de representación por separado cuando proceda.",
        "Revisa todos los requisitos marcados como obligatorios y resuelve los avisos antes de fijar la tarea."
      ], outcome: "Texto y documentos están completos para la revisión previa a firma.",
      blocked: "Si falta un campo o no hay un documento compatible, vuelve a la sección correspondiente. El orden mostrado sirve de control interno; cada sede puede pedir sus archivos y pasos en un orden diferente." },
    { id: "fijar", title: "6. Fijar la tarea y dejarla en cola de firma", where: "Presenter → Revisar la tarea antes de enviarla a firma → Dejar la tarea al firmante.",
      steps: ["Revisa las cinco comprobaciones: destino y procedimiento; interesado; representación; texto; documentos y versiones.",
        "Marca cada comprobación realizada y pulsa «Fijar tarea para firma».",
        "Comprueba «SELECCIÓN FIJADA», el número de documentos y la caducidad. Se conservan las versiones concretas de esa selección.",
        "Con el permiso correspondiente, pulsa «Dejar preparado para firma».",
        "Comprueba que aparece «EN COLA · NO PRESENTADO» y que la tarea corresponde al destino esperado.",
        "Si necesitas modificarla, utiliza «Cambiar la selección» y realiza las comprobaciones de la nueva versión. La anterior se conserva."
      ], outcome: "La tarea queda preparada para el firmante con su texto y versiones documentales fijados. Todavía no hay presentación ni justificante.",
      blocked: "Si la selección caduca, cambia la selección y revísala de nuevo. El botón «Abrir para revisar y firmar · puesto local pendiente» sigue bloqueado en esta versión." },
    { id: "firma", title: "7. Trabajo del firmante en su puesto", where: "Puesto local de firma · acceso aparte. Solo para la cuenta de firmante autorizada.",
      intro: "Este apartado describe la reserva y revisión sintéticas disponibles. La apertura de la sede y la firma real todavía no están habilitadas.",
      steps: ["Identifícate con tu cuenta de firmante. Comprueba que la tarea corresponde al expediente y destino esperados.",
        "Si el puesto pide vincularse, selecciona el descriptor local indicado por la instalación. El archivo de descriptor es distinto del certificado de firma.",
        "En una tarea disponible, pulsa «Tomar esta tarea». Si está ocupada, espera o solicita revisar la reserva; no utilices la sesión de otra persona.",
        "Pulsa «Revisar tarea tomada» y contrasta la hoja del trámite y los documentos uno a uno.",
        "Consulta la caducidad de la reserva. Si no vas a continuar, pulsa «Liberar tarea».",
        "Detente en el límite indicado por el puesto. La pantalla actual permite reservar y revisar; todavía no abre la sede ni firma ni genera un justificante real."
      ], outcome: "La tarea está reservada y revisada por la sesión correspondiente, o liberada para que pueda atenderse.",
      blocked: "Un puesto candidato pendiente de comprobación no habilita la firma. El certificado, su clave privada y las credenciales de acceso a la sede deben permanecer bajo el control de su titular." },
    { id: "recuperar", title: "8. Retomar tras caducidad, cierre o interrupción", where: "Puesto de firma → Recuperar borrador o Revisar tarea tomada, según el estado.",
      steps: ["Vuelve a identificarte con la cuenta y el puesto correspondientes.",
        "Comprueba la tarea, el destino y la versión antes de retomarla.",
        "Usa la acción de recuperación que esté habilitada. Si indica que sustituye una reserva anterior del mismo puesto, revisa esa información antes de confirmarla.",
        "Si hay una reserva activa de otro contexto o la recuperación está bloqueada, solicita revisión a supervisión.",
        "Si hubiera un resultado de presentación incierto, comprueba primero la evidencia disponible en el canal autorizado antes de decidir un nuevo intento."
      ], outcome: "Se retoma expresamente el borrador que corresponde. Recuperarlo no acredita firma ni presentación.",
      blocked: "El estado de una sesión de la sede y el borrador RTM son distintos. La recuperación de RTM no conserva ni restaura automáticamente credenciales de una sede." },
    { id: "justificante", title: "9. Presentación y justificante: punto de control", intro: "Las acciones reales de este apartado siguen pendientes de activación. Se explican para que el presentador sepa qué evidencia deberá comprobar cuando el circuito esté habilitado.",
      table: { columns: ["Estado", "Qué acredita"], rows: [
        ["Selección fijada", "Qué versiones se han elegido para esa tarea."],
        ["En cola de firma", "Que la tarea está preparada y pendiente de la actuación del firmante."],
        ["Archivos adjuntados o botón pulsado", "Por sí solos no acreditan un registro administrativo completado."],
        ["Justificante pendiente", "Todavía falta evidencia verificada de la presentación."],
        ["Copia del justificante incorporada", "Evidencia candidata que debe relacionarse con el caso y la actuación exacta."],
        ["Justificante verificado", "Requiere comprobar organismo, fecha y hora, registro, expediente y documentación presentada antes de dar por acreditada la actuación."]
      ]},
      steps: ["Cuando el circuito se habilite, comprueba el resultado explícito de la sede y su justificante.",
        "La pantalla prevé «Incorporar justificante a RTM» desde la sede o «Conciliar copia recibida por correo». Ambas acciones siguen bloqueadas en esta versión.",
        "La copia deberá corresponder al mismo organismo, interesado, registro y relación de documentos. Si hay discrepancias, deja la verificación pendiente.",
        "Una vez acreditada la actuación, revisa el seguimiento y la regla de plazos aplicable al procedimiento. El contador de la multa ficticia local es una prueba separada."
      ], outcome: "Queda diferenciada la preparación de la presentación acreditada. En la versión actual, la preparación sintética termina antes del envío real.",
      blocked: "Si no hay justificante verificable, mantén la actuación pendiente de comprobación y comunica la incidencia. La ausencia de un error en pantalla no basta para marcar un expediente como presentado." },
    { id: "correspondencia", title: "10. Preparar una reclamación por Correspondencia", where: "Presenter → Enviar una reclamación desde OPS → RTM Correspondencia.",
      steps: ["Comprueba la empresa destinataria, su papel en el asunto, el canal indicado y las materias que admite.",
        "Selecciona la dirección verificada por RTM. Si se permite otra dirección, contrástala y realiza la confirmación específica.",
        "Elige los documentos necesarios y pulsa «Fijar adjuntos elegidos».",
        "Revisa remitente, destinatario, asunto, texto, plantilla y versiones de los adjuntos.",
        "Completa las comprobaciones de destinatario, interesado, representación, texto, adjuntos y documentos necesarios.",
        "Pulsa «Guardar borrador auditado» cuando esté habilitado y comprueba «Borrador y evidencia guardados; sin envío externo»."
      ], outcome: "Se conserva un borrador asociado a destinatario, texto y documentos. Esta versión no envía el correo.",
      blocked: "«Revisar y enviar» permanece bloqueado. Un borrador guardado no acredita salida, entrega ni recepción de una reclamación." },
    { id: "bloqueos", title: "11. Resolver un bloqueo de Presenter", tags: "error gris permiso reservado archivo formato tamaño caducado sede directorio firma justificante",
      table: { columns: ["Lo que ves", "Qué debes hacer"], rows: [
        ["Presentación y firma no disponibles en local", "Vuelve a OPS. Presenter requiere el entorno de pruebas preparado; esta pantalla local no lo activa."],
        ["Organismo encontrado sin procedimiento seleccionable", "Pide verificar el procedimiento o presenta una propuesta de destino si está habilitada. El directorio es una referencia."],
        ["Documento pendiente o no elegible", "Comprueba la versión y el análisis pendiente. Solicita su revisión sin recurrir a una versión antigua."],
        ["Falta autorización de representación", "Vincula la autorización que exige el perfil y comprueba su validez para el caso."],
        ["No se puede fijar la tarea", "Revisa campos obligatorios, formatos, tamaños, representación y las cinco comprobaciones del operador."],
        ["La selección ha caducado", "Vuelve a preparar la selección, comprueba las versiones actuales y repite las confirmaciones."],
        ["Sin permiso para preparar tareas", "Solicita a supervisión revisar tu cuenta y asignación. No compartas credenciales."],
        ["Reservada por otra sesión", "Espera o pide revisar la reserva. Usa «Liberar tarea» cuando una tarea propia ya no deba quedar ocupada."],
        ["Puesto local pendiente / puente cerrado", "La integración necesaria aún no está habilitada. Deja la tarea preparada y comunica el bloqueo."],
        ["Resultado incierto tras una interrupción", "Comprueba el estado guardado y la evidencia antes de repetir. Si no puedes determinarlo, solicita revisión."],
        ["Justificante recibido sin verificar", "Comprueba su correspondencia con la actuación. Mantén pendiente la acreditación mientras falte esa verificación."]
      ]} },
    { id: "cierre", title: "12. Antes de dejar la tarea y pedir soporte", steps: [
      "Comprueba en pantalla el estado realmente alcanzado: preparación, selección fijada, cola o revisión de firma.",
      "Anota qué falta y quién debe continuar. Si has reservado una tarea que no vas a atender, libérala.",
      "Para una incidencia, indica Case ID, destino, paso, hora, mensaje exacto y, si existe, identificador de tarea o selección.",
      "Añade si hubo solo preparación o algún intento con resultado incierto. Esa distinción permite evitar duplicidades.",
      "Cierra la sesión al terminar. Los textos o selecciones que no hayas guardado pueden perderse al abandonar la pantalla."
    ], template: "Expediente / Case ID:\nDestino y procedimiento:\nTarea o selección (si existe):\nPaso y estado mostrado:\nFecha y hora:\nMensaje exacto:\nÚltima acción confirmada:\nQué falta / quién debe continuar:",
    outcome: "La siguiente persona puede identificar la tarea y el punto exacto donde se ha detenido. Envía la incidencia por el canal interno autorizado, sin contraseñas ni material de firma." }
  ]
};

export function manualSearchText(section) {
  return [section.title, section.where, section.intro, ...(section.steps || []),
    ...(section.table?.rows.flat() || []), section.outcome, section.blocked, section.tags]
    .filter(Boolean).join(" ").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}
