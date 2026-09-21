# OPS en el PC de desarrollo

El perfil local utiliza cuentas individuales y sesiones reales en la base local.
No acepta el acceso compartido de OPS. El backend debe implementar y anunciar
`auth_environment=development`, `auth_profile=local_development`, `local_only=true`,
`staging_only=false` y `shared_ops_login_accepted=false`, con configuración válida.

El frontend solo acepta ese contrato cuando Vite está en desarrollo, se ha fijado
`VITE_RTM_LOCAL_OPERATOR_AUTH=1` y se visita exactamente `http://127.0.0.1:5173`.
El permiso del contrato local se concede exclusivamente desde el proveedor de OPS.
El lector compartido de estado sigue rechazando local por defecto.

En un CMD nuevo, con el backend local ya arrancado:

```bat
cd /d D:\rtm\RTM_FRONTEND_STAGING
set "VITE_RTM_LOCAL_OPERATOR_AUTH=1"
set "RTM_DEV_API_PROXY_TARGET=http://127.0.0.1:8000"
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

El proxy elimina únicamente el prefijo `/api`; conserva la ruta y consulta que
necesita el backend. Las peticiones autenticadas continúan restringidas al mismo
origen y a `/api/ops/`. Las sesiones solo viven en memoria; no se guardan credenciales
en el navegador. Los controles de roles, permisos, caducidad y cierre siguen activos.

La presentación y el puesto de firma están cerrados en el origen local y muestran
un mensaje explicativo. Este perfil no adapta esos flujos ni sus efectos externos.

La variable local debe quedar sin definir o valer `0` antes de producir un build.
El preflight rechaza cualquier otro valor. Un build de producción tampoco cumple
el requisito `import.meta.env.DEV`, incluso si alguna configuración define la bandera.
Los contratos de despliegue existentes permanecen vigentes.
