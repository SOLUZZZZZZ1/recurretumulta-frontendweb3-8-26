# RTM Presentador — adjunto individual sintético

Prototipo MV3 local para Chrome/Edge. Añade **Adjuntar desde RTM** junto a cada
`input[type=file]` verificado del portal mock y permite elegir, bajo demanda, un
documento suelto del contenedor. No crea paquetes, ZIP, carpetas ni copias
persistentes.

> **STAGING · SYNTHETIC ONLY · SIN EFECTO JURÍDICO**

## Flujo demostrado

1. La sede mock muestra un campo y la extensión valida selector y fingerprint.
2. El operador pulsa **Adjuntar desde RTM** junto a ese campo.
3. El panel muestra los documentos sueltos; solo habilita versiones compatibles.
4. La confirmación enseña campo, nombre, versión y SHA-256 completos.
5. Un ticket de 90 segundos, un solo uso, queda ligado a intención, operador y
   sesión sintéticos, origen, perfil/adaptador, campo y snapshot documental.
6. Solo entonces se genera en memoria el PDF elegido. Se valida y asigna mediante
   `Blob` → `File` → `DataTransfer`, y se emiten `input`/`change`.
7. El portal mock puede cerrarse con una acción humana y mostrar un justificante
   sintético local que distingue `attached_at` de la fecha que declara como
   `claimed_sent_at`; `sent_at` permanece vacío hasta una verificación backend
   que este prototipo no implementa.
8. La sede ofrece un enlace de descarga opcional y la extensión añade
   **Incorporar justificante a RTM**. Esta segunda acción humana copia exactamente
   el JSON a memoria, ligado a pestaña, origen, sesión y adjuntos.

El selector y el fingerprint se validan antes y después del `await` criptográfico.
Un campo ya ocupado jamás se sobrescribe. Después de asignar `input.files`, un
portal puede iniciar la subida inmediatamente; un fallo posterior se trata como
resultado indeterminado y no como rollback seguro.

## Contrato de eventos para integración posterior

| Evento | Momento | Semántica |
|---|---|---|
| `rtm.presenter.portal_attachment_intent.v1` | clic humano junto al campo | petición exacta de campo/origen; aún no entrega bytes |
| `rtm.presenter.portal_document_attached.v1` | asignación verificada a `input.files` | guarda versión, SHA y `attachedAt`; `submissionProven=false` |
| `rtm.presenter.portal_receipt_pending.v1` | acción humana «Incorporar justificante a RTM» | guarda bytes y SHA solo en memoria; conserva `claimedSentAt`, pero `sentAt=null`, `receiptVerified=false` y sin señal de seguimiento |

El DOM de una sede no puede acreditar por sí solo una recepción. Una integración
operativa deberá conciliar evidencia confiable en backend antes de emitir un
evento separado con `receipt_verified`; solo esa verificación podrá alimentar
el seguimiento temporal. Este corte no implementa ese verificador.

## Contrato de recuperación de sesión REG

`lib/reg-session-recovery.js` modela, solo en memoria, la pérdida completa del
formulario de REG por caducidad. La instantánea liga perfil y destino, modo de
representación, manifiesto, origen, campos y valores, documentos, versiones,
orden y SHA-256 a una huella única de tarea RTM.

El paso a `reg_session_expired` conserva esa instantánea, pero declara siempre
`regDraftPersisted=false` y elimina cualquier suposición de sesión reutilizable.
Volver a `rtm_ready` exige una reautenticación REG explícita y la misma huella de
tarea. No abre el portal, no rellena un formulario, no guarda cookies y no
entrega bytes: es el contrato fail-closed que deberá respetar el futuro
adaptador gestionado.

## Seguridad deliberada

- Orígenes exactos: `http://localhost:8765` y `http://127.0.0.1:8765`.
- Sin `downloads`, `storage`, cookies, IndexedDB, `nativeMessaging`,
  `showOpenFilePicker`, carpetas ni red/backend real.
- Sin `click()`, `submit()`, `requestSubmit()`, Cl@ve, AutoFirma, firma, PIN o
  CAPTCHA.
- Solo frame superior y tres fingerprints mock explícitos.
- Bytes sintéticos generados únicamente al canjear la versión confirmada,
  sobrescritos después y limitados a 5 MiB.
- El estado y la traza son volátiles en memoria; reiniciar la extensión los borra.
- El enlace `blob:` del mock permite una descarga manual opcional, pero RTM no lo
  pulsa, no observa descargas globales y no necesita ese archivo local para
  incorporarlo.
- Las puertas remotas/de producción siguen cerradas (`remoteBridgeEnabled=false`).

## Prueba local

```bash
npm test
python -m http.server 8765 --directory mock-portal
```

Después abre <http://localhost:8765>, carga esta carpeta como extensión
descomprimida y abre el panel desde la acción de RTM Presentador.
