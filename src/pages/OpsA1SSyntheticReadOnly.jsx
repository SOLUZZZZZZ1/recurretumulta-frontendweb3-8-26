import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Helmet } from "react-helmet-async";
import {
  RTM_CONNECT_A1S_F2_QUEUE_MAX_ITEMS,
} from "../lib/rtmConnectA1SF2Contract.js";
import {
  buildRtmConnectA1SF2RuntimeBoundary,
  createRtmConnectA1SF2Session,
} from "../lib/rtmConnectA1SF2Runtime.js";

const STATUS_LABELS = Object.freeze({
  prepared: "Paquete sintético preparado",
  assigned: "Tarea asignada en la simulación",
  reviewing: "Revisión humana simulada en curso",
  ready_for_release: "Lista para liberación en la simulación",
  released: "Liberada en la simulación",
  in_progress: "Simulación en curso",
  awaiting_receipt: "A la espera de recibo sintético",
  outcome_unknown: "Resultado simulado sin confirmar",
  reconciling: "Conciliación humana simulada en curso",
  receipt_submitted: "Recibo sintético registrado",
  verified: "Recibo sintético verificado",
  completed: "Flujo sintético completado",
  manual_review: "Revisión humana requerida en la simulación",
  permanent_failed: "Fallo permanente de la simulación",
});

const STATUS_OPTIONS = Object.freeze(Object.keys(STATUS_LABELS));
const LOCAL_PAGE_SIZE = 25;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SAFETY_ITEMS = Object.freeze([
  "STAGING · SOLO CASOS SINTÉTICOS",
  "COLA Y DETALLE: SOLO LECTURA · SIN EFECTO JURÍDICO",
  "PRODUCCIÓN NO AUTORIZADA",
]);

function formatDate(value) {
  if (!value) return "—";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  }).format(timestamp);
}

function DateTime({ value }) {
  if (!value || Number.isNaN(Date.parse(value))) return "—";
  return <time dateTime={value}>{formatDate(value)} (hora de Madrid)</time>;
}

function shortHash(value) {
  if (!value) return "—";
  return `${String(value).slice(0, 12)}…${String(value).slice(-8)}`;
}

function statusLabel(value) {
  return STATUS_LABELS[value] || "Estado no reconocido";
}

function publicError(error, { login = false } = {}) {
  if (error?.status === 401 && login) {
    return "No se ha podido iniciar sesión. Revisa el correo y la contraseña.";
  }
  if (error?.status === 401) {
    return "Tu sesión ha caducado o ya no es válida. Inicia sesión de nuevo.";
  }
  if (error?.status === 429) {
    return "Acceso temporalmente bloqueado. Inténtalo de nuevo cuando termine el tiempo indicado.";
  }
  if (
    error?.name === "RtmConnectA1SContractError" ||
    error?.name === "RtmConnectA1SF2ContractError"
  ) {
    return "La respuesta no cumple el contrato cerrado de lectura A1-S. Se ha eliminado la sesión local y no se muestra información parcial; aquí no se confirma la revocación remota.";
  }
  const messages = {
    "a1s_f2.login_in_progress": "Ya hay un inicio de sesión en curso.",
    "a1s_f2.auth_status_required":
      "La frontera de autenticación todavía no está verificada.",
    "a1s_f2.request_aborted": "La operación anterior se canceló de forma segura.",
    "a1s.request_aborted": "La lectura anterior se canceló de forma segura.",
    "a1s_f2.transport_failed": "No se puede alcanzar el servicio de staging.",
    "a1s.transport_failed": "No se puede alcanzar el servicio de staging.",
    "a1s_f2.response_contract_invalid":
      "La respuesta no cumple el contrato cerrado de lectura A1-S. Se ha eliminado la sesión local y no se muestra información parcial.",
    "a1s_f2.gate_blocked": "La ruta privada F2 permanece cerrada.",
  };
  return (
    messages[error?.code] ||
    "No se pudo completar la lectura. El resultado es indeterminado y no se mostrará información parcial."
  );
}

function isAbort(error) {
  return error?.code === "a1s.request_aborted" || error?.code === "a1s_f2.request_aborted";
}

function SafetyBanner() {
  return (
    <section
      aria-label="Frontera de seguridad"
      className="border-b border-amber-300 bg-amber-50 px-4 py-3"
    >
      <div className="mx-auto flex max-w-[1500px] flex-wrap gap-2">
        {SAFETY_ITEMS.map((item) => (
          <span
            key={item}
            className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-black tracking-wide text-amber-950"
          >
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

function Notice({ tone = "info", children, role = null }) {
  const styles = {
    info: "border-blue-200 bg-blue-50 text-blue-950",
    warning: "border-amber-300 bg-amber-50 text-amber-950",
    error: "border-rose-300 bg-rose-50 text-rose-950",
    success: "border-emerald-300 bg-emerald-50 text-emerald-950",
  };
  return (
    <div
      className={`rounded-2xl border p-4 text-sm leading-6 ${styles[tone] || styles.info}`}
      role={role || undefined}
      aria-atomic={role ? "true" : undefined}
    >
      {children}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-black text-slate-950">{value}</div>
    </div>
  );
}

function LoginPanel({ authReady, busy, error, onSubmit, headingRef }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function submit(event) {
    event.preventDefault();
    const submittedPassword = password;
    setPassword("");
    onSubmit({ email, password: submittedPassword });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40">
        <div className="text-xs font-black uppercase tracking-[0.25em] text-blue-700">
          Acceso privado F2
        </div>
        <h1 ref={headingRef} tabIndex={-1} className="mt-3 text-3xl font-black tracking-tight text-slate-950 outline-none">
          Sesión individual de operador
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Usa exclusivamente tu cuenta individual de staging. El inicio y el cierre
          de sesión gestionan el acceso; no autorizan, ejecutan ni presentan ninguna
          actuación.
        </p>

        <div id="a1s-privacy-before-login" className="mt-5">
          <Notice tone="warning">
            <strong>Información previa al acceso:</strong> no envíes tus credenciales
            si no has recibido y podido consultar la información de privacidad
            específica y versionada para operadores. Este recordatorio no la
            sustituye.
          </Notice>
        </div>

        <form
          className="mt-6 space-y-4"
          onSubmit={submit}
          aria-describedby="a1s-privacy-before-login"
        >
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-800" htmlFor="a1s-email">
              Correo del operador
            </label>
            <input
              id="a1s-email"
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={320}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-800" htmlFor="a1s-password">
              Contraseña
            </label>
            <div className="flex gap-2">
              <input
                id="a1s-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                maxLength={256}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
              <button
                type="button"
                className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 outline-none hover:bg-slate-50 focus:ring-4 focus:ring-blue-100"
                aria-pressed={showPassword}
                aria-controls="a1s-password"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={!authReady || busy || !email.trim() || !password}
            className="min-h-11 w-full rounded-xl bg-slate-950 px-5 py-3 font-black text-white outline-none transition hover:bg-blue-800 focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {busy ? "Verificando identidad…" : "Entrar en lectura sintética"}
          </button>
        </form>

        <div className="mt-4">
          {!authReady && !error ? (
            <Notice>Verificando la frontera de autenticación individual…</Notice>
          ) : null}
          {error ? <Notice tone="error" role="alert">{error}</Notice> : null}
        </div>
      </section>

      <aside className="space-y-4">
        <Notice tone="warning">
          <strong>Antes de identificarte:</strong> esta pantalla admite únicamente
          casos sintéticos. No introduzcas nombres de clientes, documentos reales,
          números de expediente reales ni otros datos de casos reales.
        </Notice>
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">Privacidad del acceso</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Para autenticarte y proteger este entorno, LA TALAMANQUINA, S.L. trata
            los datos de tu cuenta y registros técnicos de acceso, incluidos
            identificadores de sesión y dispositivo, navegador, dirección IP y,
            cuando esté disponible, ubicación aproximada derivada de la conexión.
            Antes de usar este acceso debes haber recibido la información de
            privacidad específica para operadores, con finalidades, base jurídica,
            conservación, destinatarios, transferencias, derechos y contacto del DPD
            cuando corresponda. Si no la has recibido, no continúes y solicita esa
            información al responsable.
          </p>
        </section>
        <section className="rounded-3xl border border-blue-200 bg-blue-950 p-6 text-white shadow-sm">
          <h2 className="text-xl font-black">Revisión humana obligatoria</h2>
          <p className="mt-3 text-sm leading-6 text-blue-100">
            Esta vista muestra únicamente metadatos de una simulación. No adopta ni
            ejecuta decisiones con efectos jurídicos, no presenta escritos y no
            muestra borradores generados por IA ni una interacción directa con un
            sistema de IA. Los estados visibles no son instrucciones ni
            autorizaciones para actuar.
          </p>
          <p className="mt-3 text-sm leading-6 text-blue-100">
            Cualquier futura actuación real basada en esta información requerirá
            una revisión sustantiva por una persona competente y autorizada, con
            capacidad real para corregir, rechazar o detener la actuación.
          </p>
        </section>
      </aside>
    </div>
  );
}

function QueueTable({ items, onOpenTask }) {
  return (
    <div
      className="overflow-x-auto rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-blue-100"
      tabIndex={0}
      role="region"
      aria-label="Tabla desplazable de tareas sintéticas"
    >
      <table className="min-w-full border-collapse text-left text-sm">
        <caption className="sr-only">Tareas sintéticas obtenidas en la lectura paginada verificada y filtradas localmente</caption>
        <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
          <tr>
            <th className="px-4 py-3" scope="col">Tarea</th>
            <th className="px-4 py-3" scope="col">Case ID sintético</th>
            <th className="px-4 py-3" scope="col">Estado</th>
            <th className="px-4 py-3" scope="col">Vencimiento simulado</th>
            <th className="px-4 py-3" scope="col">Lectura</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {items.map((item) => (
            <tr key={item.task_id} className="align-top hover:bg-blue-50/50">
              <th className="px-4 py-4 font-mono text-xs text-slate-800" scope="row">
                {item.task_code}
              </th>
              <td className="px-4 py-4 font-mono text-xs text-slate-600">{item.case_id}</td>
              <td className="px-4 py-4">
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-900">
                  {statusLabel(item.status)}
                </span>
              </td>
              <td className="px-4 py-4 text-slate-700"><DateTime value={item.due_at} /></td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={(event) => onOpenTask(item.task_id, event.currentTarget)}
                  className="min-h-11 rounded-xl border border-blue-300 bg-white px-4 font-bold text-blue-800 outline-none hover:bg-blue-50 focus:ring-4 focus:ring-blue-100"
                >
                  Ver detalle
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskDetail({ detail, loading, error, onClose, headingRef }) {
  return (
    <section
      aria-labelledby="a1s-detail-title"
      ref={headingRef}
      tabIndex={-1}
      className="rounded-3xl border border-slate-300 bg-white p-5 shadow-xl outline-none focus:ring-4 focus:ring-blue-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
            Detalle estrictamente de lectura
          </div>
          <h2 id="a1s-detail-title" className="mt-2 text-2xl font-black text-slate-950">
            {detail?.taskCode || "Cargando tarea…"}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-xl border border-slate-300 px-4 font-bold text-slate-700 outline-none hover:bg-slate-50 focus:ring-4 focus:ring-blue-100"
        >
          Cerrar detalle
        </button>
      </div>

      {loading ? <p className="mt-5 text-sm text-slate-600" role="status">Cargando detalle…</p> : null}
      {error ? <div className="mt-5"><Notice tone="error" role="alert">{error}</Notice></div> : null}
      {detail ? (
        <div className="mt-5 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Estado" value={statusLabel(detail.status)} />
            <Metric label="Vencimiento simulado" value={<DateTime value={detail.dueAt} />} />
            <Metric label="Artefactos visibles" value={detail.artifacts.length} />
            <Metric label="Eventos visibles" value={detail.events.length} />
          </div>
          <dl className="grid gap-x-6 gap-y-3 rounded-2xl bg-slate-50 p-4 text-sm md:grid-cols-2">
            <div><dt className="font-bold text-slate-500">Task ID</dt><dd className="mt-1 break-all font-mono text-xs">{detail.taskId}</dd></div>
            <div><dt className="font-bold text-slate-500">Case ID sintético</dt><dd className="mt-1 break-all font-mono text-xs">{detail.caseId}</dd></div>
            <div><dt className="font-bold text-slate-500">Hash del paquete</dt><dd className="mt-1 break-all font-mono text-xs">{detail.packageSha256}</dd></div>
            <div><dt className="font-bold text-slate-500">Actualizado</dt><dd className="mt-1"><DateTime value={detail.updatedAt} /></dd></div>
          </dl>

          <section>
            <h3 className="text-lg font-black text-slate-950">Recibo sintético</h3>
            {detail.receipt ? (
              <Notice tone="info">
                Referencia <span className="font-mono text-xs">{detail.receipt.externalReference}</span>
                {" · "}huella {shortHash(detail.receipt.documentSha256)}. Es un registro
                sintético de prueba; no es un justificante oficial y no acredita una
                presentación real.
              </Notice>
            ) : (
              <p className="mt-2 text-sm text-slate-600">No consta recibo sintético en este estado.</p>
            )}
          </section>

          <section>
            <h3 className="text-lg font-black text-slate-950">Aprobaciones registradas en la simulación</h3>
            {detail.approvals.length ? (
              <ul className="mt-3 grid gap-2 md:grid-cols-2">
                {detail.approvals.map((approval) => (
                  <li key={approval.attestationSha256} className="rounded-xl border border-slate-200 p-3 text-sm">
                    <strong>{approval.approvalType}</strong>
                    <div className="mt-1 text-slate-600">{approval.decision} · <DateTime value={approval.approvedAt} /></div>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-slate-600">No hay aprobaciones visibles en este detalle.</p>}
            <p className="mt-2 text-xs font-bold text-amber-800">
              Estas aprobaciones pertenecen a la simulación y no constituyen una aprobación jurídica.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-black text-slate-950">Artefactos visibles</h3>
            {detail.artifacts.length ? (
              <ul className="mt-3 grid gap-2 md:grid-cols-2">
                {detail.artifacts.map((artifact) => (
                  <li key={artifact.sha256} className="rounded-xl border border-slate-200 p-3 text-sm">
                    <strong>{artifact.kind}</strong>
                    <div className="mt-1 font-mono text-xs text-slate-600">{artifact.artifactCode}</div>
                    <div className="mt-1 break-all font-mono text-xs text-slate-500">{artifact.sha256}</div>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-slate-600">No hay artefactos visibles en este detalle.</p>}
            {detail.artifactsTruncated ? (
              <p className="mt-3 text-sm font-bold text-amber-800">La lista de artefactos está truncada; el recuento mostrado no es total.</p>
            ) : null}
          </section>

          <section>
            <h3 className="text-lg font-black text-slate-950">Eventos visibles de la simulación</h3>
            <ol className="mt-3 space-y-2">
              {detail.events.map((event) => (
                <li key={`${event.sequenceNumber}-${event.payloadSha256}`} className="rounded-xl border border-slate-200 p-3 text-sm">
                  <span className="font-bold">#{event.sequenceNumber} · {event.eventType}</span>
                  <span className="ml-2 text-slate-600">
                    {event.fromStatus ? statusLabel(event.fromStatus) : "Inicio"} → {event.toStatus ? statusLabel(event.toStatus) : "Sin cambio"}
                    {" · "}{event.actorType} · {event.reasonCode} · <DateTime value={event.createdAt} />
                  </span>
                </li>
              ))}
            </ol>
            {!detail.events.length ? <p className="mt-2 text-sm text-slate-600">No hay eventos visibles en este detalle.</p> : null}
            {detail.eventsTruncated ? (
              <p className="mt-3 text-sm font-bold text-amber-800">La cronología está truncada; no se presenta como completa.</p>
            ) : null}
          </section>

          <Notice tone="warning">
            No hay botones de asignación, aprobación, liberación, ejecución,
            presentación, recibo ni conciliación. Cualquier actuación queda fuera de F2.
          </Notice>
        </div>
      ) : null}
    </section>
  );
}

function OperatorWorkspace({ auth, session, onSessionClosed, headingRef }) {
  const [tenantId, setTenantId] = useState("");
  const [status, setStatus] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [overview, setOverview] = useState(null);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [queueError, setQueueError] = useState("");
  const [caseFilter, setCaseFilter] = useState("");
  const [localPage, setLocalPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const queueAbortRef = useRef(null);
  const detailAbortRef = useRef(null);
  const detailHeadingRef = useRef(null);
  const detailTriggerRef = useRef(null);

  const closeForAuthFailure = useCallback((error) => {
    if (error?.status === 401 || !session.hasSession()) {
      onSessionClosed(
        "Se ha cerrado el acceso en este navegador; aquí no se confirma la revocación remota."
      );
      return true;
    }
    return false;
  }, [onSessionClosed, session]);

  useEffect(() => () => {
    queueAbortRef.current?.abort();
    detailAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    setOverview(null);
    setQueueError("");
    setCaseFilter("");
    setLocalPage(1);
    setDetail(null);
    setDetailOpen(false);
    setLoadingQueue(false);
    setDetailLoading(false);
    queueAbortRef.current?.abort();
    detailAbortRef.current?.abort();
  }, [tenantId, status, overdueOnly]);

  async function loadQueue() {
    queueAbortRef.current?.abort();
    detailAbortRef.current?.abort();
    const controller = new AbortController();
    queueAbortRef.current = controller;
    setLoadingQueue(true);
    setQueueError("");
    setOverview(null);
    setDetail(null);
    setDetailOpen(false);
    try {
      const next = await session.tenantOverview(
        tenantId,
        { status: status || null, overdueOnly },
        controller.signal
      );
      if (!controller.signal.aborted) setOverview(next);
    } catch (error) {
      if (isAbort(error)) return;
      if (!closeForAuthFailure(error)) setQueueError(publicError(error));
    } finally {
      if (!controller.signal.aborted) setLoadingQueue(false);
    }
  }

  async function openTask(taskId, trigger) {
    detailTriggerRef.current = trigger;
    detailAbortRef.current?.abort();
    const controller = new AbortController();
    detailAbortRef.current = controller;
    setDetailOpen(true);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      const next = await session.taskDetail(tenantId, taskId, controller.signal);
      if (!controller.signal.aborted) setDetail(next);
    } catch (error) {
      if (isAbort(error)) return;
      if (!closeForAuthFailure(error)) setDetailError(publicError(error));
    } finally {
      if (!controller.signal.aborted) setDetailLoading(false);
    }
  }

  function closeDetail() {
    detailAbortRef.current?.abort();
    setDetailOpen(false);
    setDetail(null);
    setDetailError("");
    window.requestAnimationFrame(() => detailTriggerRef.current?.focus());
  }

  const paginationVerified = overview?.queue?.paginationVerified === true;
  const normalizedCaseFilter = caseFilter.trim().toLowerCase();
  const caseFilterValid = !normalizedCaseFilter || UUID_PATTERN.test(normalizedCaseFilter);
  const filteredItems = useMemo(() => {
    if (!paginationVerified) return [];
    if (!normalizedCaseFilter) return overview.queue.items;
    if (!caseFilterValid) return [];
    return overview.queue.items.filter(
      (item) => item.case_id.toLowerCase() === normalizedCaseFilter
    );
  }, [caseFilterValid, normalizedCaseFilter, overview, paginationVerified]);
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / LOCAL_PAGE_SIZE));
  const visibleItems = useMemo(() => {
    const safePage = Math.min(localPage, pageCount);
    const start = (safePage - 1) * LOCAL_PAGE_SIZE;
    return filteredItems.slice(start, start + LOCAL_PAGE_SIZE);
  }, [filteredItems, localPage, pageCount]);

  useEffect(() => {
    if (localPage > pageCount) setLocalPage(pageCount);
  }, [localPage, pageCount]);

  useEffect(() => {
    if (detailOpen) window.requestAnimationFrame(() => detailHeadingRef.current?.focus());
  }, [detailOpen]);

  return (
    <div className="space-y-5">
      <header className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300">
              RTM CONNECT · A1-S · F2
            </div>
            <h1 ref={headingRef} tabIndex={-1} className="mt-2 text-3xl font-black outline-none">Cola sintética A1-S</h1>
            <p className="mt-2 text-sm text-slate-300">
              Operador: {auth.operator.display_name} · Rol: {auth.operator.role_code || "sin rol global"}
            </p>
            <p className="mt-1 text-xs text-slate-400">La sesión caduca: <DateTime value={auth.expiresAt} /></p>
          </div>
          <button
            type="button"
            onClick={() => onSessionClosed("Sesión cerrada en este navegador.", true)}
            className="min-h-11 rounded-xl border border-slate-600 px-5 font-bold text-white outline-none hover:bg-slate-800 focus:ring-4 focus:ring-blue-400"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="Tenants autorizados" value={auth.tenants.length} />
        <Metric label="Política de datos de caso" value="Solo sintéticos" />
        <Metric label="Acciones sobre tareas" value="0" />
      </div>

      {auth.tenantsTruncated ? (
        <Notice tone="error" role="alert">
          La lista de tenants está truncada. F2 se bloquea porque no puede acreditar
          el alcance completo de la sesión.
        </Notice>
      ) : null}
      {!auth.tenants.length ? (
        <Notice tone="warning">
          Tu sesión no tiene acceso de lectura a ninguna organización sintética.
        </Notice>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black text-slate-950">1. Alcance y filtros backend</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.6fr_auto]">
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-800" htmlFor="a1s-tenant">Tenant sintético</label>
            <select
              id="a1s-tenant"
              value={tenantId}
              disabled={auth.tenantsTruncated}
              onChange={(event) => setTenantId(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
            >
              <option value="">Selecciona un tenant</option>
              {auth.tenants.map((tenant) => (
                <option key={tenant.tenant_id} value={tenant.tenant_id}>
                  {tenant.display_name} · {tenant.role}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-800" htmlFor="a1s-status">Estado</label>
            <select
              id="a1s-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:ring-4 focus:ring-blue-100"
            >
              <option value="">Todos los estados</option>
              {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{STATUS_LABELS[item]}</option>)}
            </select>
          </div>
          <label className="flex min-h-11 items-center gap-3 self-end rounded-xl border border-slate-300 px-4 font-bold text-slate-700">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(event) => setOverdueOnly(event.target.checked)}
              className="h-5 w-5"
            />
            Solo con plazo simulado vencido
          </label>
          <button
            type="button"
            disabled={!tenantId || loadingQueue || auth.tenantsTruncated}
            onClick={loadQueue}
            className="min-h-11 self-end rounded-xl bg-blue-800 px-5 font-black text-white outline-none hover:bg-blue-900 focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {loadingQueue ? "Leyendo…" : "Cargar recorrido paginado"}
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" aria-busy={loadingQueue}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-950">2. Resultado de la cola</h2>
            <p className="mt-1 text-sm text-slate-600">
              F2 solo muestra resultados cuando termina el recorrido paginado (máximo {RTM_CONNECT_A1S_F2_QUEUE_MAX_ITEMS}). El backend no ofrece cursor ni una instantánea consistente, por lo que no se afirma una instantánea transaccional.
            </p>
          </div>
          {paginationVerified ? (
            <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-900">
              PAGINACIÓN VERIFICADA PARA ESTOS FILTROS · {overview.queue.reportedTotal}
            </span>
          ) : null}
        </div>

        {loadingQueue ? <p className="mt-5 text-sm text-slate-600" role="status">Leyendo páginas hasta el total declarado…</p> : null}
        {queueError ? <div className="mt-5"><Notice tone="error" role="alert">{queueError}</Notice></div> : null}
        {overview && !paginationVerified ? (
          <div className="mt-5">
            <Notice tone="warning" role="alert">
              No se ha podido verificar el recorrido paginado. El resultado es indeterminado;
              se han descartado todos los datos parciales y no puede afirmarse que no
              existan tareas.
            </Notice>
          </div>
        ) : null}

        {paginationVerified ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-800" htmlFor="a1s-case-filter">
                  Filtro local por Case ID sintético exacto
                </label>
                <input
                  id="a1s-case-filter"
                  type="text"
                  value={caseFilter}
                  onChange={(event) => { setCaseFilter(event.target.value); setLocalPage(1); }}
                  placeholder="UUID completo (opcional)"
                  className="min-h-11 w-full rounded-xl border border-slate-300 px-4 font-mono text-sm outline-none focus:ring-4 focus:ring-blue-100"
                  aria-invalid={!caseFilterValid}
                  aria-describedby={caseFilterValid
                    ? "a1s-case-filter-help"
                    : "a1s-case-filter-help a1s-case-filter-error"}
                />
                <p id="a1s-case-filter-help" className="mt-1 text-xs text-slate-500">
                  Se aplica únicamente en memoria después de verificar el recorrido paginado; no convierte la lectura en una instantánea consistente.
                </p>
                {!caseFilterValid ? <p id="a1s-case-filter-error" className="mt-1 text-sm font-bold text-rose-700">Introduce un UUID completo o deja el campo vacío.</p> : null}
              </div>
              <div className="self-end text-sm font-bold text-slate-700">
                {filteredItems.length} tareas visibles
              </div>
            </div>

            {filteredItems.length ? (
              <>
                <QueueTable items={visibleItems} onOpenTask={openTask} />
                <nav className="flex items-center justify-end gap-3" aria-label="Paginación local de la cola">
                  <button
                    type="button"
                    disabled={localPage <= 1}
                    onClick={() => setLocalPage((value) => Math.max(1, value - 1))}
                    className="min-h-11 rounded-xl border border-slate-300 px-4 font-bold disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <span className="text-sm font-bold">Página {localPage} de {pageCount}</span>
                  <button
                    type="button"
                    disabled={localPage >= pageCount}
                    onClick={() => setLocalPage((value) => Math.min(pageCount, value + 1))}
                    className="min-h-11 rounded-xl border border-slate-300 px-4 font-bold disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </nav>
              </>
            ) : (
              <Notice tone="info">
                {normalizedCaseFilter
                  ? "La lectura paginada verificada no contiene esa coincidencia exacta."
                  : "La lectura paginada verificada para estos filtros devolvió cero tareas sintéticas; no constituye una garantía de instantánea consistente."}
              </Notice>
            )}
          </div>
        ) : null}
      </section>

      {detailOpen ? (
        <TaskDetail
          detail={detail}
          loading={detailLoading}
          error={detailError}
          headingRef={detailHeadingRef}
          onClose={closeDetail}
        />
      ) : null}

      <Notice tone="warning">
        Esta vista solo muestra metadatos de una simulación. No adopta ni ejecuta
        decisiones, no presenta escritos y no contacta con la Administración,
        proveedores ni OCU. Cualquier futura actuación real basada en esta
        información exige revisión humana sustantiva.
      </Notice>
    </div>
  );
}

export default function OpsA1SSyntheticReadOnly() {
  const runtimeBoundary = useMemo(() => buildRtmConnectA1SF2RuntimeBoundary(), []);
  const sessionRef = useRef(null);
  if (sessionRef.current === null) {
    sessionRef.current = createRtmConnectA1SF2Session({
      fetchImpl: window.fetch.bind(window),
      runtimeBoundary,
    });
  }
  const session = sessionRef.current;
  const [authReady, setAuthReady] = useState(false);
  const [auth, setAuth] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const statusAbortRef = useRef(null);
  const loginAbortRef = useRef(null);
  const statusGenerationRef = useRef(0);
  const loginGenerationRef = useRef(0);
  const loginPendingRef = useRef(false);
  const mountedRef = useRef(false);
  const loginHeadingRef = useRef(null);
  const workspaceHeadingRef = useRef(null);

  const verifyAuthStatus = useCallback(async ({ clearError = true } = {}) => {
    const generation = ++statusGenerationRef.current;
    statusAbortRef.current?.abort();
    const controller = new AbortController();
    statusAbortRef.current = controller;
    if (mountedRef.current) {
      setAuthReady(false);
      if (clearError) setError("");
    }
    try {
      await session.authStatus(controller.signal);
      if (
        mountedRef.current &&
        generation === statusGenerationRef.current &&
        !controller.signal.aborted
      ) {
        setAuthReady(true);
        return true;
      }
    } catch (statusError) {
      if (
        mountedRef.current &&
        generation === statusGenerationRef.current &&
        !isAbort(statusError) &&
        !controller.signal.aborted
      ) {
        setError(publicError(statusError));
      }
    } finally {
      if (statusAbortRef.current === controller) statusAbortRef.current = null;
    }
    return false;
  }, [session]);

  useEffect(() => {
    mountedRef.current = true;
    void verifyAuthStatus();
    return () => {
      mountedRef.current = false;
      statusGenerationRef.current += 1;
      loginGenerationRef.current += 1;
      loginPendingRef.current = false;
      statusAbortRef.current?.abort();
      loginAbortRef.current?.abort();
      session.dispose();
    };
  }, [session, verifyAuthStatus]);

  useEffect(() => {
    if (!auth?.expiresAt) return undefined;
    const remaining = Math.max(0, Date.parse(auth.expiresAt) - Date.now());
    const timer = window.setTimeout(() => {
      loginGenerationRef.current += 1;
      loginPendingRef.current = false;
      loginAbortRef.current?.abort();
      session.clear();
      setAuthReady(false);
      setAuth(null);
      setBusy(false);
      setNotice("La sesión ha caducado y sus credenciales se han eliminado de memoria.");
      void verifyAuthStatus({ clearError: false });
      window.requestAnimationFrame(() => loginHeadingRef.current?.focus());
    }, Math.min(remaining, 2_147_000_000));
    return () => window.clearTimeout(timer);
  }, [auth?.expiresAt, session, verifyAuthStatus]);

  async function login(credentials) {
    if (loginPendingRef.current) return;
    loginPendingRef.current = true;
    const generation = ++loginGenerationRef.current;
    loginAbortRef.current?.abort();
    const controller = new AbortController();
    loginAbortRef.current = controller;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await session.login({ ...credentials, signal: controller.signal });
      if (
        mountedRef.current &&
        generation === loginGenerationRef.current &&
        !controller.signal.aborted
      ) {
        setAuth(next);
        window.requestAnimationFrame(() => workspaceHeadingRef.current?.focus());
      }
    } catch (loginError) {
      if (
        mountedRef.current &&
        generation === loginGenerationRef.current &&
        !isAbort(loginError)
      ) {
        setError(publicError(loginError, { login: true }));
        await verifyAuthStatus({ clearError: false });
      }
    } finally {
      if (generation === loginGenerationRef.current) {
        loginPendingRef.current = false;
        loginAbortRef.current = null;
        if (mountedRef.current) setBusy(false);
      }
    }
  }

  const closeSession = useCallback(async (message, remote = false) => {
    loginGenerationRef.current += 1;
    loginPendingRef.current = false;
    loginAbortRef.current?.abort();
    statusGenerationRef.current += 1;
    statusAbortRef.current?.abort();
    setAuthReady(false);
    setAuth(null);
    setBusy(false);
    setError("");
    setNotice(message);
    window.requestAnimationFrame(() => loginHeadingRef.current?.focus());
    if (remote) {
      try {
        await session.logout();
      } catch {
        setNotice(
          "La sesión se eliminó de este navegador, pero no pudo confirmarse el cierre remoto; quedará sujeta a caducidad."
        );
      }
    } else {
      session.clear();
    }
    await verifyAuthStatus({ clearError: false });
  }, [session, verifyAuthStatus]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <Helmet>
        <title>RTM CONNECT A1-S · Staging sintético</title>
        <meta name="robots" content="noindex,nofollow,noarchive,nosnippet" />
      </Helmet>
      <SafetyBanner />
      <div className="mx-auto max-w-[1500px] px-4 py-6 md:px-6 md:py-8">
        {notice ? <div className="mb-5"><Notice tone="warning" role="status">{notice}</Notice></div> : null}
        {auth ? (
          <OperatorWorkspace
            auth={auth}
            session={session}
            onSessionClosed={closeSession}
            headingRef={workspaceHeadingRef}
          />
        ) : (
          <LoginPanel
            authReady={authReady}
            busy={busy}
            error={error}
            onSubmit={login}
            headingRef={loginHeadingRef}
          />
        )}
      </div>
    </main>
  );
}
