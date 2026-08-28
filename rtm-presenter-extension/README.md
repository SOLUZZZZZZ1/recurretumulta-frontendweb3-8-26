# RTM Presentador — prototipo MV3 sintético

Prototipo local para Chrome y Microsoft Edge que demuestra cómo un operador
puede elegir documentos de un paquete RTM y adjuntarlos, uno a uno, a campos
`input[type=file]` de una sede. Esta entrega solo funciona contra el portal
sintético incluido y no produce efectos jurídicos.

> **STAGING · SYNTHETIC ONLY · SIN EFECTO JURÍDICO**

## Qué demuestra

- panel lateral con caso, paquete y campos ordenados;
- ticket de un solo uso ligado a origen y slot;
- documento PDF mantenido como `Blob`/`File` solo en memoria;
- selección exacta del campo y comprobación de su fingerprint;
- asignación con `DataTransfer` y emisión de `input` y `change`;
- cierre seguro ante cambios de origen, selector, campo, archivo o hash;
- control humano por documento: cada clic puede entregar o subir el archivo a la
  sede, pero la extensión no identifica, firma ni registra el trámite.

El paquete, los tickets y los bytes sintéticos se generan en memoria cada vez que
se abre el panel. No se usan `localStorage`, `sessionStorage`, IndexedDB,
`chrome.storage`, cookies, Cache API, service workers de documentos ni descargas.

## Carga local

1. Desde esta carpeta, ejecuta las pruebas:

   ```bash
   npm test
   ```

2. Inicia el portal sintético sin cambiar el puerto:

   ```bash
   python -m http.server 8765 --directory mock-portal
   ```

3. Abre <http://localhost:8765>.
4. Abre `chrome://extensions` o `edge://extensions`.
5. Activa **Modo desarrollador**, elige **Cargar descomprimida** y selecciona la
   carpeta `rtm-presenter-extension`.
6. En la pestaña del portal sintético, pulsa la acción **RTM Presentador** para
   abrir el panel lateral.
7. Usa **Adjuntar desde RTM** en el orden mostrado y comprueba los nombres en el
   portal. El botón del portal solo valida localmente.

También se admite exactamente `http://127.0.0.1:8765`; cada sesión queda ligada
al origen con el que se abrió y no permite cambiar entre ambos a mitad del flujo.

## Permisos mínimos

| Permiso | Uso |
|---|---|
| `scripting` | Ejecutar únicamente la función de adjunción verificada |
| `sidePanel` | Mostrar el paquete y sus campos sin alterar la aplicación RTM |
| host local `:8765` | Portal sintético explícito |

No hay permisos `downloads`, `debugger`, `cookies`, `storage`, `tabs`,
`webRequest`, `<all_urls>` ni content script permanente. El prototipo no inyecta
nada fuera del host local autorizado y el operador inicia cada adjunción.

## Ticket y frontera de red

La UI actual usa `createSyntheticTicketBroker`: emite y canjea tickets dentro de
la memoria del panel, caducan a los 90 segundos, son de un solo uso y sus bytes
se sobrescriben al canjear, caducar o cerrar el broker. No realiza ninguna
petición de red. El manifiesto no concede
acceso al backend y no existe cliente de canje remoto en esta entrega.

El puente remoto queda cerrado hasta disponer de atestación criptográfica de una
extensión gestionada, sesión individual, auditoría y un contrato común aprobado.
Un identificador o encabezado declarativo de extensión no es prueba suficiente
y no debe autorizar la entrega de bytes.

## Límites deliberados

- No abre ni controla Cl@ve, certificado, AutoFirma, PIN o CAPTCHA.
- No pulsa botones de enviar, registrar, firmar o confirmar.
- Al disparar `input` y `change`, una sede puede iniciar la subida inmediatamente;
  por eso cada clic se trata como una comunicación externa y exige revisar antes
  destino, campo y documento.
- No afirma compatibilidad con sedes reales.
- Solo actúa en el frame superior y en los tres fingerprints sintéticos.
- Widgets propios, iframes, Shadow DOM o cambios del portal se bloquean.
- El transporte de bytes de este prototipo usa argumentos en memoria de
  `chrome.scripting.executeScript` y está limitado a 5 MiB.
- `DataTransfer` no sustituye el selector nativo de Windows por una unidad RTM;
  ofrece la acción equivalente desde el panel lateral.
- Ver un archivo adjunto no acredita una presentación. Una versión operativa
  necesitará snapshot inmutable, registro y justificante conciliado.

Para añadir una sede en el futuro deberá existir un perfil versionado con origen,
selector y fingerprint revisados, pruebas del portal, permisos de host opcionales
y un fallback manual. Nunca debe ampliarse el manifiesto con un comodín global.
