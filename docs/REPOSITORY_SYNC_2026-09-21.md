# Sincronización del entorno local — 21/09/2026

Rama de entrega: `rtm-ai-security-hardening-2026-09-03`, en frontend y backend.
Esta entrega incorpora el trabajo del PC y no modifica ni mezcla `main`.

Incluye acceso individual de OPS en desarrollo local, entrada y recuperación de
expedientes sintéticos, precios públicos, estado documental del expediente,
revisión e incorporación de hechos, borradores con historial y PDF, guía de
estacionamiento, plazos tras presentación simulada y manuales de operador y
presentador. Los datos Sí/No conservan la diferencia entre «No» y un dato pendiente.

Se mantienen los límites de los perfiles local y desplegado. Los controles de
presentación y firma continúan cerrados en local, y un build exige que la bandera
de autenticación local esté desactivada. La nueva revisión conserva los controles
de rol, sesión, expediente y autorización verificada.

## Comprobaciones de esta entrega

- 228 contratos Python y 296 pruebas JavaScript correctos.
- Compilación de producción e inspección del paquete correctas.
- Análisis de secretos del árbol e historial de Git correcto.
- Backend compañero: 2.177 pruebas ejecutadas sin fallos ni errores (19 omisiones
  de plataforma/integración) y seis integraciones PostgreSQL aisladas correctas.
- El recorrido de datos adicionales ya se comprobó en navegador de escritorio
  y móvil con datos sintéticos; también se verificó el acceso del servidor activo.

Los informes operativos se conservan en
`C:\Users\soluz\rtm-work\2026-09-21-repo-sync\reports`. El instalador histórico
del frontend queda ignorado por Git; la configuración del proxy está incorporada
directamente en `vite.config.js`.
