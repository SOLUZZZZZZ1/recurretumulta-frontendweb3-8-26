import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { RtmPresenterWorkspace } from "../rtm-presenter/index.js";

const API = "/api";

async function readJson(response) {
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

export default function OpsPresenterPage() {
  const { caseId } = useParams();
  const bearerRef = useRef("");
  const activeSessionIdRef = useRef("");
  const loginLockRef = useRef(false);
  const loginAbortRef = useRef(null);
  const mountedRef = useRef(true);
  const [authStatus, setAuthStatus] = useState(null);
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
    setEmail("");
    setSession(null);
    setError("La sesión individual ha caducado. Vuelve a identificarte.");
  }, []);

  const sessionIdForCallbacks = session?.sessionId || "";
  const presenterUnauthorized = useCallback(() => {
    invalidateSession(sessionIdForCallbacks);
  }, [invalidateSession, sessionIdForCallbacks]);

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
      .then(readJson)
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

  async function login(event) {
    event.preventDefault();
    if (authStatus?.individual_login_enabled !== true) {
      setPassword("");
      setError("La autenticación individual de RTM Presenter no está habilitada.");
      return;
    }
    if (loginLockRef.current) return;
    loginLockRef.current = true;
    const controller = new AbortController();
    loginAbortRef.current = controller;
    setBusy(true);
    setError("");
    const submittedPassword = password;
    setPassword("");
    try {
      const payload = await readJson(
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
      if (typeof payload?.token !== "string" || payload.token.length < 32) {
        throw new Error("El backend no devolvió una sesión individual válida.");
      }
      if (
        typeof payload?.session_id !== "string" ||
        !payload.session_id.trim()
      ) {
        throw new Error("El backend no identificó la sesión individual.");
      }
      if (
        payload?.operator?.must_change_password !== false ||
        payload?.operator?.mfa_required !== false
      ) {
        await fetch(`${API}/ops/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${payload.token}` },
          cache: "no-store",
          credentials: "same-origin",
          redirect: "error",
          referrerPolicy: "same-origin",
        }).catch(() => {});
        throw new Error(
          "Completa los controles de identidad antes de usar RTM Presenter."
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
        operator: payload.operator || {},
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
      if (mountedRef.current) setBusy(false);
    }
  }

  async function logout() {
    const token = bearerRef.current;
    bearerRef.current = "";
    activeSessionIdRef.current = "";
    setEmail("");
    setSession(null);
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

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            to={`/ops/case/${encodeURIComponent(caseId || "")}`}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700"
          >
            ← Volver al expediente
          </Link>
          <span className="rounded-full bg-amber-100 px-4 py-2 text-xs font-black uppercase tracking-wide text-amber-900">
            Staging · synthetic only · sin efecto jurídico
          </span>
        </div>

        {!session ? (
          <section className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
              RTM Presenter · acceso individual
            </p>
            <h1 className="mt-2 text-3xl font-black">Identifica al presentador</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              El PIN compartido de OPS no sirve aquí. La sesión vive solo en
              memoria y vincula cada paquete y cada adjunto al operador real.
            </p>

            {authStatus && !authStatus.individual_login_enabled ? (
              <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                La autenticación individual de staging está cerrada en este despliegue.
              </p>
            ) : null}

            <form onSubmit={login} className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-bold text-slate-800">
                Email de operador
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
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
                  onChange={(event) => setPassword(event.target.value)}
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
                    ? "Entrar en RTM Presenter"
                    : "Comprobando acceso…"}
              </button>
            </form>
            {error ? (
              <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
                {error}
              </p>
            ) : null}
          </section>
        ) : (
          <>
            <header className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-slate-950 p-5 text-white shadow-xl">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
                  Sesión individual en memoria
                </p>
                <h1 className="mt-1 text-2xl font-black">{session.operator.display_name || session.operator.email}</h1>
                <p className="mt-1 text-xs text-slate-400">
                  {session.operator.role_code || "sin rol"} · caduca {String(session.expiresAt || "—")}
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
            <RtmPresenterWorkspace
              key={`${session.sessionId}:${caseId || ""}`}
              caseId={caseId}
              getAuthHeaders={getAuthHeaders}
              onUnauthorized={presenterUnauthorized}
              operatorCapabilities={session.operator.permissions || []}
              environment="staging"
              syntheticOnly
            />
          </>
        )}
      </div>
    </main>
  );
}
