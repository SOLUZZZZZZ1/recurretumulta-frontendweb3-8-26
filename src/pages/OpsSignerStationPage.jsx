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
  createRtmSignerStationClient,
  newSignerCommandKey,
} from "../rtm-presenter/rtmSignerStationApi.js";

const API = "/api";
const REQUIRED_ROLE = "rtm.signer";
const REQUIRED_PERMISSIONS = Object.freeze([
  "ops.view",
  "presenter.signing.queue",
  "presenter.signing.claim",
]);

async function readAuthJson(response) {
  const text = await response.text().catch(() => "");
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }
  if (!response.ok) {
    const detail =
      payload?.detail?.error?.message ||
      payload?.detail?.message ||
      payload?.detail;
    throw new Error(
      typeof detail === "string" && detail.trim()
        ? detail
        : "No se pudo validar la sesión individual."
    );
  }
  return payload;
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

      {authStatus && !authStatus.individual_login_enabled ? (
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
            className="min-h-11 rounded-xl border border-slate-300 px-3 font-normal"
          />
        </label>
        <button
          type="submit"
          disabled={busy || authStatus?.individual_login_enabled !== true}
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

function ClaimReview({ claim, busy, onRelease }) {
  const task = claim.task || {};
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
          El certificado se elegirá y la firma final se confirmará únicamente
          en este PC cuando el cliente local esté disponible.
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
  const mountedRef = useRef(true);
  const [authStatus, setAuthStatus] = useState(null);
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [queueBusy, setQueueBusy] = useState(false);
  const [busyDeliveryId, setBusyDeliveryId] = useState("");
  const [error, setError] = useState("");
  const [queue, setQueue] = useState([]);
  const [claims, setClaims] = useState({});
  const [activeDeliveryId, setActiveDeliveryId] = useState("");

  const getAuthHeaders = useCallback(() => {
    const token = bearerRef.current;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const invalidateSession = useCallback((expectedSessionId = "") => {
    if (
      expectedSessionId &&
      activeSessionIdRef.current !== expectedSessionId
    ) {
      return;
    }
    bearerRef.current = "";
    activeSessionIdRef.current = "";
    setSession(null);
    setQueue([]);
    setClaims({});
    setActiveDeliveryId("");
    setError("La sesión individual ha caducado. Vuelve a identificarte.");
  }, []);

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
    void fetch(`${API}/ops/auth/status`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "same-origin",
      redirect: "error",
      referrerPolicy: "same-origin",
      signal: controller.signal,
    })
      .then(readAuthJson)
      .then(setAuthStatus)
      .catch((statusError) => {
        if (!controller.signal.aborted) setError(statusError.message);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      loginAbortRef.current?.abort();
      const token = bearerRef.current;
      bearerRef.current = "";
      activeSessionIdRef.current = "";
      if (token) {
        void fetch(`${API}/ops/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          credentials: "same-origin",
          redirect: "error",
          referrerPolicy: "same-origin",
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, []);

  const loadQueue = useCallback(
    async ({ signal = null } = {}) => {
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
        if (signal?.aborted) return;
        setQueue(entries);
        setClaims(nextClaims);
        setActiveDeliveryId((current) =>
          nextClaims[current]
            ? current
            : Object.keys(nextClaims)[0] || ""
        );
      } catch (loadError) {
        if (!signal?.aborted) {
          setError(loadError.message || "No se pudo cargar la cola de firma.");
        }
      } finally {
        if (!signal?.aborted) setQueueBusy(false);
      }
    },
    [client]
  );

  useEffect(() => {
    if (!sessionId) return undefined;
    const controller = new AbortController();
    void loadQueue({ signal: controller.signal });
    return () => controller.abort();
  }, [loadQueue, sessionId]);

  async function login(event) {
    event.preventDefault();
    if (authStatus?.individual_login_enabled !== true || loginLockRef.current) {
      setPassword("");
      if (authStatus?.individual_login_enabled !== true) {
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
      const payload = await readAuthJson(
        await fetch(`${API}/ops/auth/login`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: email.trim(), password: submittedPassword }),
          cache: "no-store",
          credentials: "same-origin",
          redirect: "error",
          referrerPolicy: "same-origin",
          signal: controller.signal,
        })
      );
      const permissions = Array.isArray(payload?.operator?.permissions)
        ? payload.operator.permissions
        : [];
      const authorized =
        payload?.operator?.role_code === REQUIRED_ROLE &&
        permissions.length === REQUIRED_PERMISSIONS.length &&
        REQUIRED_PERMISSIONS.every((permission) => permissions.includes(permission));
      if (
        typeof payload?.token !== "string" ||
        payload.token.length < 32 ||
        typeof payload?.session_id !== "string" ||
        !payload.session_id.trim() ||
        payload?.operator?.must_change_password !== false ||
        payload?.operator?.mfa_required !== false ||
        !authorized
      ) {
        if (typeof payload?.token === "string") {
          await fetch(`${API}/ops/auth/logout`, {
            method: "POST",
            headers: { Authorization: `Bearer ${payload.token}` },
            cache: "no-store",
            credentials: "same-origin",
            redirect: "error",
            referrerPolicy: "same-origin",
          }).catch(() => {});
        }
        throw new Error(
          "Esta pantalla exige la cuenta separada rtm.signer con sus dos permisos mínimos."
        );
      }
      if (controller.signal.aborted || !mountedRef.current) {
        await fetch(`${API}/ops/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${payload.token}` },
          cache: "no-store",
          credentials: "same-origin",
          redirect: "error",
          referrerPolicy: "same-origin",
        }).catch(() => {});
        return;
      }
      bearerRef.current = payload.token;
      activeSessionIdRef.current = payload.session_id;
      setEmail("");
      setSession({
        sessionId: payload.session_id,
        expiresAt: payload.expires_at,
        operator: payload.operator,
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
    bearerRef.current = "";
    activeSessionIdRef.current = "";
    setEmail("");
    setSession(null);
    setQueue([]);
    setClaims({});
    setActiveDeliveryId("");
    setError("");
    if (!token) return;
    await fetch(`${API}/ops/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      credentials: "same-origin",
      redirect: "error",
      referrerPolicy: "same-origin",
    }).catch(() => {});
  }

  async function claimTask(deliveryId) {
    setBusyDeliveryId(deliveryId);
    setError("");
    try {
      const payload = await client.claimTask(deliveryId, {
        idempotencyKey: newSignerCommandKey("signer-claim"),
      });
      setClaims((current) => ({
        ...current,
        [deliveryId]: payload.claim,
      }));
      setActiveDeliveryId(deliveryId);
      await loadQueue();
    } catch (claimError) {
      setError(claimError.message || "No se pudo tomar la tarea.");
    } finally {
      setBusyDeliveryId("");
    }
  }

  async function releaseTask(deliveryId, claimId) {
    setBusyDeliveryId(deliveryId);
    setError("");
    try {
      await client.releaseTask(deliveryId, claimId, {
        idempotencyKey: newSignerCommandKey("signer-release"),
      });
      setClaims((current) => {
        const next = { ...current };
        delete next[deliveryId];
        return next;
      });
      setActiveDeliveryId("");
      await loadQueue();
    } catch (releaseError) {
      setError(releaseError.message || "No se pudo liberar la tarea.");
    } finally {
      setBusyDeliveryId("");
    }
  }

  const activeClaim = activeDeliveryId ? claims[activeDeliveryId] : null;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950">
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
                  {session.operator.display_name || session.operator.email}
                </h1>
                <p className="mt-1 text-xs text-slate-400">
                  {session.operator.role_code} · caduca {String(session.expiresAt || "—")}
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
                Corte v1 · frontera cerrada
              </p>
              <h2 className="mt-2 text-xl font-black">Cola y reserva, todavía sin abrir la sede</h2>
              <p className="mt-2 text-sm leading-6 text-amber-950">
                Esta versión prueba identidad separada, asignación y toma exclusiva.
                El siguiente corte instalará el cliente local que abre REG y entrega
                cada documento cuando la sede lo pide. El certificado nunca saldrá de
                este PC.
              </p>
            </section>

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
                  busy={busyDeliveryId === activeDeliveryId}
                  onRelease={releaseTask}
                />
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
