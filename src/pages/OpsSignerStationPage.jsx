import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  loginOpsOperator,
  logoutOpsOperator,
  readOpsAuthStatus,
} from "../ops-auth/opsAuthApi.js";
import {
  bindOpsSessionLifecycle,
  scheduleOpsSessionExpiry,
} from "../ops-auth/opsSessionLifecycle.js";
import {
  createRtmSignerStationClient,
  newSignerCommandKey,
  parseRtmSignerStationDescriptorText,
} from "../rtm-presenter/rtmSignerStationApi.js";

const REQUIRED_ROLE = "rtm.signer";
const REQUIRED_PERMISSIONS = Object.freeze([
  "ops.view",
  "presenter.signing.queue",
  "presenter.signing.claim",
]);

function isExactSignerOperator(operator) {
  const permissions = Array.isArray(operator?.permissions)
    ? operator.permissions
    : [];
  return (
    operator?.roleCode === REQUIRED_ROLE &&
    permissions.length === REQUIRED_PERMISSIONS.length &&
    new Set(permissions).size === permissions.length &&
    REQUIRED_PERMISSIONS.every((permission) => permissions.includes(permission)) &&
    operator?.mustChangePassword === false &&
    operator?.mfaRequired === false
  );
}

function shortHash(value) {
  const text = String(value || "");
  return text.length >= 16 ? `${text.slice(0, 12)}…${text.slice(-6)}` : text;
}

function SignerLoginCard({
  authStatus,
  email,
  password,
  busy,
  error,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}) {
  return (
    <section className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
        RTM Presenter · puesto local
      </p>
      <h1 className="mt-2 text-3xl font-black">Identifica al firmante</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Usa la cuenta separada <strong>rtm.signer</strong>. Esta sesión solo
        consulta y reserva tareas asignadas; no obtiene documentos, certificado
        ni sesión de una sede.
      </p>

      {authStatus && !authStatus.individualLoginEnabled ? (
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          La autenticación individual de staging está cerrada en este despliegue.
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-bold text-slate-800">
          Email del firmante
          <input
            type="email"
            value={email}
            onChange={onEmailChange}
            autoComplete="username"
            required
            className="min-h-11 rounded-xl border border-slate-300 px-3 font-normal"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-800">
          Contraseña
          <input
            type="password"
            value={password}
            onChange={onPasswordChange}
            autoComplete="current-password"
            required
            maxLength={256}
            className="min-h-11 rounded-xl border border-slate-300 px-3 font-normal"
          />
        </label>
        <button
          type="submit"
          disabled={busy || authStatus?.individualLoginEnabled !== true}
          className="min-h-11 rounded-xl bg-blue-800 px-5 font-black text-white disabled:bg-slate-400"
        >
          {busy
            ? "Validando…"
            : authStatus
              ? "Entrar en el puesto local"
              : "Comprobando acceso…"}
        </button>
      </form>
      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}

function QueueTaskCard({ task, busy, onClaim, onReview }) {
  const isOwn = task.claim_status === "claimed_by_you";
  const isBusy = task.claim_status === "busy";
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
            {task.representation_mode === "representative"
              ? "Actuación como representante"
              : "Actuación como interesado"}
          </p>
          <h3 className="mt-1 text-lg font-black text-slate-950">
            {task.destination_display_name}
          </h3>
          <p className="mt-1 break-all text-xs text-slate-500">
            {task.portal_origin}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-black uppercase ${
            isOwn
              ? "bg-emerald-100 text-emerald-900"
              : isBusy
                ? "bg-slate-200 text-slate-700"
                : "bg-blue-100 text-blue-900"
          }`}
        >
          {isOwn ? "Tomada por esta sesión" : isBusy ? "Ocupada" : "Disponible"}
        </span>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="font-bold text-slate-600">Documentos</dt>
          <dd>{task.document_count}</dd>
        </div>
        <div>
          <dt className="font-bold text-slate-600">Preparada</dt>
          <dd>{String(task.prepared_at || "—")}</dd>
        </div>
        <div>
          <dt className="font-bold text-slate-600">Huella de tarea</dt>
          <dd title={task.task_fingerprint_sha256}>
            {shortHash(task.task_fingerprint_sha256)}
          </dd>
        </div>
      </dl>
      <div className="mt-5">
        {isOwn ? (
          <button
            type="button"
            onClick={() => onReview(task.delivery_id)}
            disabled={busy}
            className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white disabled:bg-slate-400"
          >
            Revisar tarea tomada
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onClaim(task.delivery_id)}
            disabled={busy || isBusy || task.claim_available !== true}
            className="rounded-xl bg-blue-800 px-4 py-2 text-sm font-black text-white disabled:bg-slate-400"
          >
            {isBusy ? "Reservada por otra sesión" : "Tomar esta tarea"}
          </button>
        )}
      </div>
    </article>
  );
}

function StationCandidateCard({ station, busy, onDescriptorSelected }) {
  const installation = station?.installation || null;
  return (
    <section className="mb-5 rounded-3xl border border-blue-200 bg-blue-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-800">
            Cliente Windows · candidato local
          </p>
          <h2 className="mt-2 text-xl font-black">
            {installation ? installation.station_label : "Vincula el descriptor de este PC"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-blue-950">
            Selecciona el archivo <strong>station-candidate.json</strong> creado
            por el cliente local. Solo contiene una identidad pública sintética;
            no contiene contraseñas, certificado ni datos de expedientes.
          </p>
          <p className="mt-1 break-all text-xs font-semibold text-blue-900">
            Ruta habitual: %LOCALAPPDATA%\RTM\SignerStation\station-candidate.json
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-black uppercase ${
            installation
              ? "bg-amber-100 text-amber-900"
              : "bg-slate-200 text-slate-700"
          }`}
        >
          {installation ? "Candidato registrado" : "Sin vincular"}
        </span>
      </div>

      {installation ? (
        <dl className="mt-4 grid gap-3 rounded-2xl border border-blue-200 bg-white p-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="font-bold text-slate-600">Versión</dt>
            <dd>{installation.client_version}</dd>
          </div>
          <div>
            <dt className="font-bold text-slate-600">Estado</dt>
            <dd>{installation.status}</dd>
          </div>
          <div>
            <dt className="font-bold text-slate-600">Huella pública</dt>
            <dd title={installation.client_binding_sha256}>
              {shortHash(installation.client_binding_sha256)}
            </dd>
          </div>
        </dl>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-xl bg-blue-800 px-4 py-2 text-sm font-black text-white">
          {busy
            ? "Registrando candidato…"
            : installation
              ? "Comprobar el mismo descriptor"
              : "Seleccionar descriptor local"}
          <input
            type="file"
            accept="application/json,.json"
            disabled={busy}
            onChange={onDescriptorSelected}
            className="sr-only"
          />
        </label>
        <p className="text-xs font-semibold text-blue-950">
          La atestación gestionada sigue pendiente: este candidato no puede abrir
          REG ni recibir documentos.
        </p>
      </div>
    </section>
  );
}

function WorkspaceRecoveryCard({
  station,
  recoveries,
  loading,
  busyWorkspaceId,
  onRefresh,
  onRecover,
}) {
  if (!station?.installation) return null;
  const statusCopy = {
    current_session: "Disponible en esta sesión",
    adoptable: "Reserva anterior finalizada",
    adoptable_supersession: "Reserva anterior del mismo puesto",
    blocked_active_claim: "Bloqueado por otra reserva activa",
    blocked_session_rollback: "Sesión anterior sustituida",
  };
  return (
    <section className="mb-5 rounded-3xl border border-violet-200 bg-violet-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-800">
            Recuperación durable · sin storage de recuperación
          </p>
          <h2 className="mt-2 text-xl font-black">
            Borradores guardados en RTM para este PC
          </h2>
          <p className="mt-2 text-sm leading-6 text-violet-950">
            Al volver a entrar, selecciona el mismo descriptor local. RTM busca
            el borrador por firmante, dispositivo, instalación y huella; el
            flujo no escribe almacenamiento web de recuperación ni guarda
            bearer, contraseña, documentos o certificado.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading || Boolean(busyWorkspaceId)}
          className="rounded-xl border border-violet-300 bg-white px-4 py-2 text-sm font-black text-violet-900 disabled:opacity-50"
        >
          {loading ? "Buscando…" : "Buscar borradores"}
        </button>
      </div>

      {recoveries === null ? (
        <p className="mt-4 text-sm text-violet-950">
          La búsqueda se ejecutará al comprobar el descriptor de este puesto.
        </p>
      ) : recoveries.length ? (
        <div className="mt-4 grid gap-3">
          {recoveries.map((recovery) => {
            const blocked =
              recovery.recovery_status === "blocked_active_claim" ||
              recovery.recovery_status === "blocked_session_rollback";
            const rollbackBlocked =
              recovery.recovery_status === "blocked_session_rollback";
            const supersedes =
              recovery.recovery_status === "adoptable_supersession";
            const current = recovery.recovery_status === "current_session";
            return (
              <article
                key={recovery.workspace_id}
                className="rounded-2xl border border-violet-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-slate-950">
                      {recovery.destination_display_name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-600">
                      Intento {recovery.attempt_number} · {recovery.document_count}{" "}
                      {recovery.document_count === 1 ? "documento" : "documentos"}
                    </p>
                    <p
                      className="mt-1 text-xs text-slate-500"
                      title={recovery.task_fingerprint_sha256}
                    >
                      Huella: {shortHash(recovery.task_fingerprint_sha256)}
                    </p>
                  </div>
                  <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-900">
                    {statusCopy[recovery.recovery_status]}
                  </span>
                </div>
                {supersedes ? (
                  <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-950">
                    La reserva anterior pertenece al mismo firmante y a este
                    mismo puesto. Recuperarla la sustituirá de forma auditada.
                  </p>
                ) : null}
                {blocked ? (
                  <p className="mt-3 text-sm font-semibold text-red-800">
                    {rollbackBlocked
                      ? "Esta sesión ya fue sustituida por una recuperación posterior. Inicia una sesión nueva para continuar sin retroceder el historial."
                      : "RTM no permite adoptar este borrador mientras exista una reserva activa de otro contexto."}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => onRecover(recovery)}
                  disabled={blocked || loading || Boolean(busyWorkspaceId)}
                  className="mt-4 rounded-xl bg-violet-800 px-4 py-2 text-sm font-black text-white disabled:bg-slate-400"
                >
                  {busyWorkspaceId === recovery.workspace_id
                    ? "Recuperando…"
                    : blocked
                      ? "Recuperación bloqueada"
                      : current
                        ? "Reabrir borrador"
                        : supersedes
                          ? "Recuperar y sustituir reserva anterior"
                          : "Recuperar borrador"}
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-violet-200 bg-white p-4 text-sm text-violet-950">
          No hay borradores recuperables para este firmante y este puesto.
        </p>
      )}
    </section>
  );
}

function ClaimReview({
  claim,
  workspace,
  station,
  busy,
  onRelease,
  onPrepareWorkspace,
  onMarkExpired,
  onResumeWorkspace,
}) {
  const task = workspace?.task || claim.task || {};
  const fields = task.portal_preparation?.fields || [];
  const items = task.items || [];
  return (
    <section className="rounded-3xl border-2 border-emerald-300 bg-white p-6 shadow-xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
            Toma exclusiva activa
          </p>
          <h2 className="mt-2 text-2xl font-black">
            {task.destination_display_name}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Caduca {String(claim.expires_at || "—")}. Si no continúas, libérala
            para que no bloquee la cola.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRelease(task.delivery_id, claim.claim_id)}
          disabled={busy}
          className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-black text-red-800 disabled:opacity-50"
        >
          Liberar tarea
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
        <strong>Estado real:</strong> la tarea está reservada y revisable. El
        navegador de sede todavía no se abre porque falta instalar y atestar el
        cliente local. No se ha firmado, enviado ni creado justificante.
      </div>

      <section className="mt-6">
        <h3 className="text-lg font-black">1. Hoja preparada del trámite</h3>
        <div className="mt-3 grid gap-3">
          {fields.map((field) => (
            <div
              key={field.field_code}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <p className="text-sm font-black text-slate-800">
                {field.step_order}. {field.label}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {field.value || "—"}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h3 className="text-lg font-black">2. Documentos, uno a uno</h3>
        <p className="mt-1 text-sm text-slate-600">
          Este es el orden interno de control. La sede seguirá pidiendo cada
          archivo por separado; no existe ZIP ni paquete descargable.
        </p>
        <ol className="mt-3 grid gap-3">
          {items.map((item) => (
            <li
              key={item.package_item_id}
              className="rounded-2xl border border-slate-200 p-4"
            >
              <p className="font-black">
                {item.item_order}. {item.portal_filename}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Campo: {item.field_code} · {item.media_type} · {item.size_bytes} bytes
              </p>
              <p
                className="mt-1 break-all text-xs text-slate-500"
                title={item.document_sha256}
              >
                SHA-256: {shortHash(item.document_sha256)}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-5">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-800">
          Borrador recuperable
        </p>
        {!workspace ? (
          <>
            <h3 className="mt-2 text-lg font-black">Guarda primero la tarea en RTM</h3>
            <p className="mt-2 text-sm leading-6 text-violet-950">
              RTM conservará destino, textos, versiones, huellas y orden. REG no
              guarda el formulario: si su sesión caduca, habrá que autenticarse
              otra vez y reconstruirlo desde esta copia exacta.
            </p>
            <button
              type="button"
              onClick={() => onPrepareWorkspace(task.delivery_id, claim.claim_id)}
              disabled={busy || !station}
              className="mt-4 rounded-xl bg-violet-800 px-4 py-2 text-sm font-black text-white disabled:bg-slate-400"
            >
              {station
                ? "Preparar borrador recuperable en RTM"
                : "Vincula antes el candidato Windows"}
            </button>
          </>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-black">
                {workspace.state === "reg_session_expired"
                  ? "Sesión REG caducada · el trabajo sigue en RTM"
                  : "Borrador RTM listo para reconstrucción"}
              </h3>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-violet-900">
                Intento {workspace.attempt_number}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-violet-950">
              Borrador RTM: <strong>guardado</strong> · borrador REG:{" "}
              <strong>no existe</strong>. No se ha abierto la sede, entregado
              documentos, firmado ni presentado.
            </p>
            {workspace.state === "reg_session_expired" ? (
              <button
                type="button"
                onClick={() => onResumeWorkspace(task.delivery_id, claim.claim_id, workspace)}
                disabled={busy}
                className="mt-4 rounded-xl bg-violet-800 px-4 py-2 text-sm font-black text-white disabled:bg-slate-400"
              >
                Preparar recuperación desde RTM
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onMarkExpired(task.delivery_id, claim.claim_id, workspace)}
                disabled={busy}
                className="mt-4 rounded-xl border border-violet-400 bg-white px-4 py-2 text-sm font-black text-violet-900 disabled:opacity-50"
              >
                Registrar prueba sintética de caducidad REG
              </button>
            )}
          </>
        )}
      </section>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="min-h-12 rounded-xl bg-slate-300 px-5 font-black text-slate-600"
        >
          Abrir sede · activación local pendiente
        </button>
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
          El certificado nunca saldrá de este PC. Se elegirá y la firma final se
          confirmará aquí cuando exista un cliente gestionado y atestado.
        </div>
      </div>
    </section>
  );
}

export default function OpsSignerStationPage() {
  const bearerRef = useRef("");
  const activeSessionIdRef = useRef("");
  const loginLockRef = useRef(false);
  const loginAbortRef = useRef(null);
  const statusAbortRef = useRef(null);
  const sessionAbortRef = useRef(null);
  const recoveryAbortRef = useRef(null);
  const mountedRef = useRef(true);
  const commandKeysRef = useRef(new Map());
  const sensitiveRootRef = useRef(null);
  const [authStatus, setAuthStatus] = useState(null);
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [queueBusy, setQueueBusy] = useState(false);
  const [stationBusy, setStationBusy] = useState(false);
  const [recoveriesBusy, setRecoveriesBusy] = useState(false);
  const [recoveryBusyWorkspaceId, setRecoveryBusyWorkspaceId] = useState("");
  const [busyDeliveryId, setBusyDeliveryId] = useState("");
  const [error, setError] = useState("");
  const [queue, setQueue] = useState([]);
  const [claims, setClaims] = useState({});
  const [station, setStation] = useState(null);
  const [workspaces, setWorkspaces] = useState({});
  const [workspaceRecoveries, setWorkspaceRecoveries] = useState(null);
  const [activeDeliveryId, setActiveDeliveryId] = useState("");
  const [viewVisible, setViewVisible] = useState(true);
  const [viewEpoch, setViewEpoch] = useState(0);
  const [statusEpoch, setStatusEpoch] = useState(0);

  const getAuthHeaders = useCallback(() => {
    const token = bearerRef.current;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const clearSignerSession = useCallback((message = "") => {
    loginAbortRef.current?.abort();
    loginAbortRef.current = null;
    loginLockRef.current = false;
    sessionAbortRef.current?.abort();
    sessionAbortRef.current = null;
    bearerRef.current = "";
    activeSessionIdRef.current = "";
    recoveryAbortRef.current?.abort();
    recoveryAbortRef.current = null;
    commandKeysRef.current.clear();
    setEmail("");
    setPassword("");
    setSession(null);
    setQueue([]);
    setClaims({});
    setStation(null);
    setWorkspaces({});
    setWorkspaceRecoveries(null);
    setQueueBusy(false);
    setStationBusy(false);
    setRecoveriesBusy(false);
    setRecoveryBusyWorkspaceId("");
    setBusyDeliveryId("");
    setActiveDeliveryId("");
    setLoginBusy(false);
    setError(message);
    setViewEpoch((current) => current + 1);
  }, []);

  const invalidateSession = useCallback(
    (expectedSessionId = "") => {
      if (
        expectedSessionId &&
        activeSessionIdRef.current !== expectedSessionId
      ) {
        return;
      }
      sensitiveRootRef.current?.setAttribute("hidden", "");
      clearSignerSession(
        "La sesión individual ha caducado. Vuelve a identificarte."
      );
    },
    [clearSignerSession]
  );

  const sessionId = session?.sessionId || "";
  const signerUnauthorized = useCallback(() => {
    invalidateSession(sessionId);
  }, [invalidateSession, sessionId]);

  const client = useMemo(
    () =>
      createRtmSignerStationClient({
        getAuthHeaders,
        onUnauthorized: signerUnauthorized,
        environment: "staging",
        syntheticOnly: true,
      }),
    [getAuthHeaders, signerUnauthorized]
  );

  useEffect(() => {
    const controller = new AbortController();
    statusAbortRef.current = controller;
    void readOpsAuthStatus({ signal: controller.signal })
      .then(setAuthStatus)
      .catch((statusError) => {
        if (!controller.signal.aborted) setError(statusError.message);
      })
      .finally(() => {
        if (statusAbortRef.current === controller) statusAbortRef.current = null;
      });
    return () => {
      controller.abort();
      if (statusAbortRef.current === controller) statusAbortRef.current = null;
    };
  }, [statusEpoch]);

  useEffect(
    () =>
      bindOpsSessionLifecycle(window, {
        invalidate: () => {
          sensitiveRootRef.current?.setAttribute("hidden", "");
          setViewVisible(false);
          const token = bearerRef.current;
          statusAbortRef.current?.abort();
          statusAbortRef.current = null;
          clearSignerSession(
            "La vista protegida se cerró. Vuelve a identificarte."
          );
          if (token) {
            void logoutOpsOperator({ bearerToken: token, keepalive: true }).catch(
              () => {}
            );
          }
        },
        restore: () => {
          statusAbortRef.current?.abort();
          statusAbortRef.current = null;
          clearSignerSession(
            "La página se restauró de forma segura. Vuelve a identificarte."
          );
          setAuthStatus(null);
          setStatusEpoch((current) => current + 1);
          setViewVisible(true);
        },
      }),
    [clearSignerSession]
  );

  useEffect(() => {
    if (!session) return undefined;
    const expectedSessionId = session.sessionId;
    return scheduleOpsSessionExpiry(session.expiresAt, () => {
      invalidateSession(expectedSessionId);
    });
  }, [invalidateSession, session]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      statusAbortRef.current?.abort();
      loginAbortRef.current?.abort();
      sessionAbortRef.current?.abort();
      recoveryAbortRef.current?.abort();
      const token = bearerRef.current;
      bearerRef.current = "";
      activeSessionIdRef.current = "";
      commandKeysRef.current.clear();
      if (token) {
        void logoutOpsOperator({ bearerToken: token, keepalive: true }).catch(() => {});
      }
    };
  }, []);

  const loadQueue = useCallback(
    async ({ signal = sessionAbortRef.current?.signal || null } = {}) => {
      const expectedSessionId = activeSessionIdRef.current;
      if (!expectedSessionId) return;
      setQueueBusy(true);
      setError("");
      try {
        const payload = await client.loadQueue({ signal, limit: 50 });
        const entries = Array.isArray(payload?.station_queue?.items)
          ? payload.station_queue.items
          : [];
        const ownEntries = entries.filter(
          (entry) => entry.claim_status === "claimed_by_you"
        );
        const recovered = await Promise.allSettled(
          ownEntries.map((entry) =>
            client.loadCurrentClaim(entry.delivery_id, { signal })
          )
        );
        const nextClaims = {};
        recovered.forEach((result) => {
          if (result.status === "fulfilled" && result.value?.claim?.task?.delivery_id) {
            nextClaims[result.value.claim.task.delivery_id] = result.value.claim;
          }
        });
        if (
          signal?.aborted ||
          activeSessionIdRef.current !== expectedSessionId
        ) {
          return;
        }
        setQueue(entries);
        setClaims(nextClaims);
        setWorkspaces((current) =>
          Object.fromEntries(
            Object.entries(current).filter(
              ([deliveryId, workspace]) =>
                nextClaims[deliveryId]?.claim_id === workspace?.claim_id
            )
          )
        );
        setActiveDeliveryId((current) =>
          nextClaims[current]
            ? current
            : Object.keys(nextClaims)[0] || ""
        );
        return nextClaims;
      } catch (loadError) {
        if (
          !signal?.aborted &&
          activeSessionIdRef.current === expectedSessionId
        ) {
          setError(loadError.message || "No se pudo cargar la cola de firma.");
        }
        return null;
      } finally {
        if (
          !signal?.aborted &&
          activeSessionIdRef.current === expectedSessionId
        ) {
          setQueueBusy(false);
        }
      }
    },
    [client]
  );

  const loadWorkspaceRecoveries = useCallback(
    async (
      installationId,
      { signal = sessionAbortRef.current?.signal || null } = {}
    ) => {
      const expectedSessionId = activeSessionIdRef.current;
      if (!expectedSessionId || !installationId) return;
      setRecoveriesBusy(true);
      setError("");
      try {
        const payload = await client.discoverWorkspaceRecoveries(
          installationId,
          { signal, limit: 20 }
        );
        if (
          signal?.aborted ||
          activeSessionIdRef.current !== expectedSessionId
        ) {
          return;
        }
        setWorkspaceRecoveries(payload.workspace_recoveries.items);
      } catch (recoveryError) {
        if (
          !signal?.aborted &&
          activeSessionIdRef.current === expectedSessionId
        ) {
          setWorkspaceRecoveries(null);
          setError(
            recoveryError.message ||
              "No se pudieron buscar los borradores recuperables de este PC."
          );
        }
      } finally {
        if (
          !signal?.aborted &&
          activeSessionIdRef.current === expectedSessionId
        ) {
          setRecoveriesBusy(false);
        }
      }
    },
    [client]
  );

  useEffect(() => {
    if (!sessionId) return undefined;
    const signal = sessionAbortRef.current?.signal || null;
    void loadQueue({ signal });
    return undefined;
  }, [loadQueue, sessionId]);

  async function login(event) {
    event.preventDefault();
    if (authStatus?.individualLoginEnabled !== true || loginLockRef.current) {
      setPassword("");
      if (authStatus?.individualLoginEnabled !== true) {
        setError("La autenticación individual del puesto local no está habilitada.");
      }
      return;
    }
    loginLockRef.current = true;
    const controller = new AbortController();
    loginAbortRef.current = controller;
    setLoginBusy(true);
    setError("");
    const submittedPassword = password;
    setPassword("");
    try {
      const authenticated = await loginOpsOperator({
        email,
        password: submittedPassword,
        signal: controller.signal,
      });
      if (!isExactSignerOperator(authenticated.operator)) {
        await logoutOpsOperator({
          bearerToken: authenticated.bearerToken,
        }).catch(() => {});
        throw new Error(
          "Esta pantalla exige la cuenta separada rtm.signer con sus tres permisos exactos."
        );
      }
      if (controller.signal.aborted || !mountedRef.current) {
        await logoutOpsOperator({
          bearerToken: authenticated.bearerToken,
        }).catch(() => {});
        return;
      }
      sessionAbortRef.current?.abort();
      sessionAbortRef.current = new AbortController();
      bearerRef.current = authenticated.bearerToken;
      activeSessionIdRef.current = authenticated.sessionId;
      commandKeysRef.current.clear();
      setEmail("");
      setStation(null);
      setWorkspaces({});
      setWorkspaceRecoveries(null);
      setSession({
        sessionId: authenticated.sessionId,
        expiresAt: authenticated.expiresAt,
        operator: authenticated.operator,
      });
    } catch (loginError) {
      bearerRef.current = "";
      activeSessionIdRef.current = "";
      if (!controller.signal.aborted && mountedRef.current) {
        setSession(null);
        setError(loginError.message || "No se pudo iniciar sesión.");
      }
    } finally {
      if (loginAbortRef.current === controller) {
        loginAbortRef.current = null;
        loginLockRef.current = false;
      }
      if (mountedRef.current) setLoginBusy(false);
    }
  }

  async function logout() {
    const token = bearerRef.current;
    clearSignerSession();
    if (!token) return;
    await logoutOpsOperator({ bearerToken: token }).catch(() => {});
  }

  function retainedCommandKey(scope, prefix) {
    const existing = commandKeysRef.current.get(scope);
    if (existing) return existing;
    const created = newSignerCommandKey(prefix);
    commandKeysRef.current.set(scope, created);
    return created;
  }

  function forgetCommandKey(scope) {
    commandKeysRef.current.delete(scope);
  }

  async function claimTask(deliveryId) {
    const expectedSessionId = activeSessionIdRef.current;
    if (!expectedSessionId) return;
    setBusyDeliveryId(deliveryId);
    setError("");
    const commandScope = `claim:${deliveryId}`;
    try {
      const payload = await client.claimTask(deliveryId, {
        idempotencyKey: retainedCommandKey(commandScope, "signer-claim"),
        signal: sessionAbortRef.current?.signal || null,
      });
      if (activeSessionIdRef.current !== expectedSessionId) return;
      forgetCommandKey(commandScope);
      setClaims((current) => ({
        ...current,
        [deliveryId]: payload.claim,
      }));
      setActiveDeliveryId(deliveryId);
      await loadQueue();
    } catch (claimError) {
      if (activeSessionIdRef.current !== expectedSessionId) return;
      setError(claimError.message || "No se pudo tomar la tarea.");
    } finally {
      if (activeSessionIdRef.current === expectedSessionId) {
        setBusyDeliveryId("");
      }
    }
  }

  async function releaseTask(deliveryId, claimId) {
    const expectedSessionId = activeSessionIdRef.current;
    if (!expectedSessionId) return;
    setBusyDeliveryId(deliveryId);
    setError("");
    const commandScope = `release:${claimId}`;
    try {
      await client.releaseTask(deliveryId, claimId, {
        idempotencyKey: retainedCommandKey(commandScope, "signer-release"),
        signal: sessionAbortRef.current?.signal || null,
      });
      if (activeSessionIdRef.current !== expectedSessionId) return;
      forgetCommandKey(commandScope);
      setClaims((current) => {
        const next = { ...current };
        delete next[deliveryId];
        return next;
      });
      setWorkspaces((current) => {
        const next = { ...current };
        delete next[deliveryId];
        return next;
      });
      setActiveDeliveryId("");
      await loadQueue();
    } catch (releaseError) {
      if (activeSessionIdRef.current !== expectedSessionId) return;
      setError(releaseError.message || "No se pudo liberar la tarea.");
    } finally {
      if (activeSessionIdRef.current === expectedSessionId) {
        setBusyDeliveryId("");
      }
    }
  }

  async function registerStationDescriptor(event) {
    const input = event.currentTarget;
    const file = input.files?.[0] || null;
    input.value = "";
    if (!file || stationBusy) return;
    const expectedSessionId = activeSessionIdRef.current;
    if (!expectedSessionId) return;
    setStationBusy(true);
    setError("");
    try {
      if (file.size > 16_384) {
        throw new Error("El descriptor del puesto supera 16 KB.");
      }
      const descriptor = parseRtmSignerStationDescriptorText(await file.text());
      if (activeSessionIdRef.current !== expectedSessionId) return;
      if (
        station?.installation &&
        (station.installation.client_instance_id !== descriptor.clientInstanceId ||
          station.installation.client_binding_sha256 !==
            descriptor.clientBindingSha256)
      ) {
        throw new Error(
          "Esta sesión ya está vinculada a otro candidato. Cierra la sesión antes de cambiar de PC."
        );
      }
      const payload = await client.registerInstallation(
        {
          clientInstanceId: descriptor.clientInstanceId,
          clientBindingSha256: descriptor.clientBindingSha256,
          stationLabel: descriptor.stationLabel,
          platform: descriptor.platform,
          clientVersion: descriptor.clientVersion,
        },
        { signal: sessionAbortRef.current?.signal || null }
      );
      if (activeSessionIdRef.current !== expectedSessionId) return;
      setStation(payload.station);
      setWorkspaceRecoveries(null);
      await loadWorkspaceRecoveries(
        payload.station.installation.installation_id
      );
    } catch (stationError) {
      if (activeSessionIdRef.current !== expectedSessionId) return;
      if (!station) {
        setStation(null);
        setWorkspaces({});
        setWorkspaceRecoveries(null);
      }
      setError(
        stationError.message || "No se pudo registrar el candidato de este PC."
      );
    } finally {
      if (activeSessionIdRef.current === expectedSessionId) {
        setStationBusy(false);
      }
    }
  }

  async function recoverDurableWorkspace(recovery) {
    const installationId = station?.installation?.installation_id || "";
    if (!installationId) {
      setError("Vincula primero el descriptor candidato de este PC.");
      return;
    }
    if (
      recovery?.recovery_status !== "current_session" &&
      recovery?.adoption_available !== true
    ) {
      setError(
        "Este borrador mantiene una reserva activa que RTM no permite sustituir."
      );
      return;
    }
    const expectedSessionId = activeSessionIdRef.current;
    if (!expectedSessionId || recoveryAbortRef.current) return;
    const controller = new AbortController();
    recoveryAbortRef.current = controller;
    const deliveryId = recovery.delivery_id;
    const sourceWorkspaceId = recovery.workspace_id;
    const fingerprint = recovery.task_fingerprint_sha256;
    const commandScope = `recover:${sourceWorkspaceId}:${fingerprint}`;
    setRecoveryBusyWorkspaceId(sourceWorkspaceId);
    setBusyDeliveryId(deliveryId);
    setError("");
    try {
      const payload = await client.recoverWorkspace(
        deliveryId,
        installationId,
        sourceWorkspaceId,
        fingerprint,
        {
          sourceClaimId: recovery.claim_id,
          sourceAttemptNumber: recovery.attempt_number,
          signal: controller.signal,
          idempotencyKey: retainedCommandKey(
            commandScope,
            "workspace-adopt"
          ),
        }
      );
      if (activeSessionIdRef.current !== expectedSessionId) return;
      const claimPayload = await client.loadCurrentClaim(deliveryId, {
        signal: controller.signal,
      });
      if (activeSessionIdRef.current !== expectedSessionId) return;
      const recoveredWorkspace = payload.workspace;
      const recoveredClaim = claimPayload.claim;
      if (
        recoveredClaim.claim_id !== recoveredWorkspace.claim_id ||
        recoveredClaim.task?.delivery_id !== deliveryId ||
        recoveredClaim.task?.task_fingerprint_sha256 !== fingerprint ||
        recoveredWorkspace.task?.task_fingerprint_sha256 !== fingerprint
      ) {
        throw new Error(
          "La reserva recuperada no coincide con el borrador durable solicitado."
        );
      }
      const refreshedClaims = await loadQueue({ signal: controller.signal });
      if (activeSessionIdRef.current !== expectedSessionId) return;
      if (
        !refreshedClaims ||
        refreshedClaims[deliveryId]?.claim_id !== recoveredClaim.claim_id
      ) {
        throw new Error(
          "La cola no confirmó la reserva recuperada; vuelve a intentarlo antes de continuar."
        );
      }
      setClaims((current) => ({
        ...current,
        [deliveryId]: recoveredClaim,
      }));
      setWorkspaces((current) => ({
        ...current,
        [deliveryId]: recoveredWorkspace,
      }));
      setActiveDeliveryId(deliveryId);
      forgetCommandKey(commandScope);
      if (activeSessionIdRef.current === expectedSessionId) {
        await loadWorkspaceRecoveries(installationId, {
          signal: controller.signal,
        });
      }
    } catch (recoveryError) {
      if (activeSessionIdRef.current !== expectedSessionId) return;
      setError(
        recoveryError.message ||
          "No se pudo adoptar el borrador durable en esta sesión."
      );
    } finally {
      if (recoveryAbortRef.current === controller) {
        recoveryAbortRef.current = null;
      }
      if (activeSessionIdRef.current === expectedSessionId) {
        setRecoveryBusyWorkspaceId("");
        setBusyDeliveryId("");
      }
    }
  }

  async function prepareWorkspace(deliveryId, claimId) {
    const installationId = station?.installation?.installation_id || "";
    if (!installationId) {
      setError("Vincula primero el descriptor candidato de este PC.");
      return;
    }
    const expectedSessionId = activeSessionIdRef.current;
    if (!expectedSessionId) return;
    setBusyDeliveryId(deliveryId);
    setError("");
    const commandScope = `prepare:${claimId}:${installationId}`;
    try {
      const payload = await client.prepareWorkspace(
        deliveryId,
        claimId,
        installationId,
        {
          idempotencyKey: retainedCommandKey(
            commandScope,
            "workspace-prepare"
          ),
          signal: sessionAbortRef.current?.signal || null,
        }
      );
      if (activeSessionIdRef.current !== expectedSessionId) return;
      forgetCommandKey(commandScope);
      setWorkspaces((current) => ({
        ...current,
        [deliveryId]: payload.workspace,
      }));
    } catch (workspaceError) {
      if (activeSessionIdRef.current !== expectedSessionId) return;
      setError(
        workspaceError.message || "No se pudo preparar el borrador recuperable."
      );
    } finally {
      if (activeSessionIdRef.current === expectedSessionId) {
        setBusyDeliveryId("");
      }
    }
  }

  async function transitionWorkspace(deliveryId, claimId, workspace, action) {
    const installationId = station?.installation?.installation_id || "";
    if (!installationId || !workspace?.workspace_id) {
      setError("La tarea recuperable no está ligada a este candidato Windows.");
      return;
    }
    const expectedSessionId = activeSessionIdRef.current;
    if (!expectedSessionId) return;
    setBusyDeliveryId(deliveryId);
    setError("");
    const commandScope =
      `workspace:${workspace.workspace_id}:${action}:` +
      `${workspace.attempt_number}`;
    try {
      const command =
        action === "expire"
          ? client.markRegSessionExpired.bind(client)
          : client.resumeWorkspace.bind(client);
      const payload = await command(
        deliveryId,
        claimId,
        workspace.workspace_id,
        installationId,
        {
          idempotencyKey: retainedCommandKey(
            commandScope,
            action === "expire" ? "workspace-expired" : "workspace-resume"
          ),
          signal: sessionAbortRef.current?.signal || null,
        }
      );
      if (activeSessionIdRef.current !== expectedSessionId) return;
      forgetCommandKey(commandScope);
      setWorkspaces((current) => ({
        ...current,
        [deliveryId]: payload.workspace,
      }));
    } catch (workspaceError) {
      if (activeSessionIdRef.current !== expectedSessionId) return;
      setError(
        workspaceError.message || "No se pudo actualizar la recuperación de REG."
      );
    } finally {
      if (activeSessionIdRef.current === expectedSessionId) {
        setBusyDeliveryId("");
      }
    }
  }

  const activeClaim = activeDeliveryId ? claims[activeDeliveryId] : null;
  const activeWorkspace = activeDeliveryId
    ? workspaces[activeDeliveryId] || null
    : null;

  return (
    <main
      key={viewEpoch}
      ref={sensitiveRootRef}
      hidden={!viewVisible}
      className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950"
    >
      <Helmet>
        <title>Puesto local de firma · RTM Presenter</title>
        <meta name="robots" content="noindex,nofollow,noarchive,nosnippet" />
      </Helmet>
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/ops"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700"
          >
            ← Volver a OPS
          </Link>
          <span className="rounded-full bg-amber-100 px-4 py-2 text-xs font-black uppercase tracking-wide text-amber-900">
            Staging · synthetic only · sin efecto jurídico
          </span>
        </div>

        {!session ? (
          <SignerLoginCard
            authStatus={authStatus}
            email={email}
            password={password}
            busy={loginBusy}
            error={error}
            onEmailChange={(event) => setEmail(event.target.value)}
            onPasswordChange={(event) => setPassword(event.target.value)}
            onSubmit={login}
          />
        ) : (
          <>
            <header className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-slate-950 p-5 text-white shadow-xl">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
                  Puesto local · sesión individual en memoria
                </p>
                <h1 className="mt-1 text-2xl font-black">
                  {session.operator.displayName || session.operator.email}
                </h1>
                <p className="mt-1 text-xs text-slate-400">
                  {session.operator.roleCode} · caduca {String(session.expiresAt || "—")}
                </p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-bold"
              >
                Cerrar sesión
              </button>
            </header>

            <section className="mb-5 rounded-3xl border border-amber-300 bg-amber-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-900">
                Corte v1.1 · recuperación RTM · frontera cerrada
              </p>
              <h2 className="mt-2 text-xl font-black">
                Cola, reserva y borrador recuperable; todavía sin abrir la sede
              </h2>
              <p className="mt-2 text-sm leading-6 text-amber-950">
                Esta versión registra un candidato Windows y conserva en RTM una
                copia exacta para reconstruir el formulario si REG cierra la sesión
                por inactividad. No afirma que REG guarde borradores y aún no abre la
                sede ni entrega documentos.
              </p>
            </section>

            <StationCandidateCard
              station={station}
              busy={stationBusy}
              onDescriptorSelected={registerStationDescriptor}
            />

            <WorkspaceRecoveryCard
              station={station}
              recoveries={workspaceRecoveries}
              loading={recoveriesBusy}
              busyWorkspaceId={recoveryBusyWorkspaceId}
              onRefresh={() =>
                loadWorkspaceRecoveries(
                  station?.installation?.installation_id || ""
                )
              }
              onRecover={recoverDurableWorkspace}
            />

            {error ? (
              <p
                role="alert"
                className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800"
              >
                {error}
              </p>
            ) : null}

            <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                    Cola de firma asignada
                  </p>
                  <h2 className="mt-1 text-2xl font-black">
                    {queue.length} {queue.length === 1 ? "tarea" : "tareas"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => loadQueue()}
                  disabled={queueBusy || Boolean(busyDeliveryId)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black disabled:opacity-50"
                >
                  {queueBusy ? "Actualizando…" : "Actualizar cola"}
                </button>
              </div>
              {queueBusy && !queue.length ? (
                <p className="mt-5" role="status">Cargando tareas asignadas…</p>
              ) : queue.length ? (
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {queue.map((task) => (
                    <QueueTaskCard
                      key={task.delivery_id}
                      task={task}
                      busy={busyDeliveryId === task.delivery_id}
                      onClaim={claimTask}
                      onReview={setActiveDeliveryId}
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
                  No hay tareas de firma asignadas a esta cuenta. Esto no significa
                  que la cola global esté vacía.
                </p>
              )}
            </section>

            {activeClaim ? (
              <div className="mt-6" id="signer-active-claim">
                <ClaimReview
                  claim={activeClaim}
                  workspace={activeWorkspace}
                  station={station}
                  busy={busyDeliveryId === activeDeliveryId || stationBusy}
                  onRelease={releaseTask}
                  onPrepareWorkspace={prepareWorkspace}
                  onMarkExpired={(deliveryId, claimId, workspace) =>
                    transitionWorkspace(deliveryId, claimId, workspace, "expire")
                  }
                  onResumeWorkspace={(deliveryId, claimId, workspace) =>
                    transitionWorkspace(deliveryId, claimId, workspace, "resume")
                  }
                />
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
