import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Outlet } from "react-router-dom";
import { changeTemporaryOperatorPassword } from "../rtm-presenter/rtmOperatorOnboardingApi.js";
import {
  buildOpsAuthenticatedRequest,
  OpsAuthError,
  loginOpsOperator,
  logoutOpsOperator,
  readOpsAuthStatus,
} from "./opsAuthApi.js";
import {
  canAccessOpsWorkspace,
  canSuperviseOpsWorkspace,
} from "./opsAuthorization.js";

const OpsAuthContext = createContext(null);

function clearSensitiveInput(setters) {
  setters.forEach((setter) => setter(""));
}

function LoginCard({ auth }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function submit(event) {
    event.preventDefault();
    const submittedPassword = password;
    setPassword("");
    await auth.login(email, submittedPassword);
  }

  return (
    <section className="mx-auto w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
        RTM OPS · acceso individual
      </p>
      <h1 className="mt-2 text-3xl font-black text-slate-950">Identifica al operador</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Usa tu cuenta personal de RTM. La sesión permanece únicamente en la memoria de esta
        pestaña y queda vinculada al operador y a este dispositivo.
      </p>
      {auth.status && !auth.status.individualLoginEnabled ? (
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          La autenticación individual de OPS está cerrada en este despliegue.
        </p>
      ) : null}
      {auth.notice ? (
        <p role="status" className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          {auth.notice}
        </p>
      ) : null}
      <form onSubmit={submit} className="mt-5 grid gap-4">
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
            maxLength={256}
            className="min-h-11 rounded-xl border border-slate-300 px-3 font-normal"
          />
        </label>
        <button
          type="submit"
          disabled={auth.busy || auth.status?.individualLoginEnabled !== true}
          className="min-h-11 rounded-xl bg-slate-950 px-5 font-black text-white disabled:bg-slate-400"
        >
          {auth.busy ? "Validando…" : auth.status ? "Entrar en OPS" : "Comprobando acceso…"}
        </button>
      </form>
      {auth.error ? (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
          {auth.error}
        </p>
      ) : null}
    </section>
  );
}

function InitialPasswordCard({ auth }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  async function submit(event) {
    event.preventDefault();
    const current = currentPassword;
    const next = newPassword;
    const repeated = confirmation;
    clearSensitiveInput([setCurrentPassword, setNewPassword, setConfirmation]);
    await auth.completeInitialPasswordChange(current, next, repeated);
  }

  return (
    <section className="mx-auto w-full max-w-xl rounded-3xl border border-blue-200 bg-white p-6 shadow-xl">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
        RTM OPS · primera entrada
      </p>
      <h1 className="mt-2 text-3xl font-black text-slate-950">Cambia la contraseña temporal</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        La cuenta <strong>{auth.onboardingOperator?.email || "de operador"}</strong> está
        activa, pero no puede abrir expedientes hasta elegir una contraseña propia.
      </p>
      <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-950">
        RTM no guardará estas contraseñas en el navegador. Después del cambio tendrás que
        identificarte de nuevo con la contraseña nueva.
      </p>
      <form onSubmit={submit} className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-bold text-slate-800">
          Contraseña temporal
          <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" maxLength={256} required className="min-h-11 rounded-xl border border-slate-300 px-3 font-normal" />
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-800">
          Nueva contraseña
          <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={256} required className="min-h-11 rounded-xl border border-slate-300 px-3 font-normal" />
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-800">
          Repite la nueva contraseña
          <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={12} maxLength={256} required className="min-h-11 rounded-xl border border-slate-300 px-3 font-normal" />
        </label>
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={auth.busy} className="min-h-11 flex-1 rounded-xl bg-blue-800 px-5 font-black text-white disabled:bg-slate-400">
            {auth.busy ? "Cambiando…" : "Guardar contraseña nueva"}
          </button>
          <button type="button" onClick={auth.logout} disabled={auth.busy} className="min-h-11 rounded-xl border border-slate-300 px-5 font-bold text-slate-700 disabled:text-slate-400">
            Cancelar
          </button>
        </div>
      </form>
      {auth.error ? (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
          {auth.error}
        </p>
      ) : null}
    </section>
  );
}

export function OpsAuthProvider({ children }) {
  const bearerRef = useRef("");
  const activeSessionIdRef = useRef("");
  const mountedRef = useRef(true);
  const requestAbortRef = useRef(null);
  const requestLockRef = useRef(false);
  const [status, setStatus] = useState(null);
  const [session, setSession] = useState(null);
  const [onboardingOperator, setOnboardingOperator] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const clearSession = useCallback((message = "") => {
    bearerRef.current = "";
    activeSessionIdRef.current = "";
    setSession(null);
    setOnboardingOperator(null);
    setNotice("");
    setError(message);
  }, []);

  const invalidateSession = useCallback(
    (expectedSessionId = "") => {
      if (expectedSessionId && activeSessionIdRef.current !== expectedSessionId) return;
      requestAbortRef.current?.abort();
      requestAbortRef.current = null;
      requestLockRef.current = false;
      clearSession("La sesión individual ha caducado. Vuelve a identificarte.");
    },
    [clearSession]
  );

  useEffect(() => {
    const controller = new AbortController();
    void readOpsAuthStatus({ signal: controller.signal })
      .then((nextStatus) => {
        if (!controller.signal.aborted) setStatus(nextStatus);
      })
      .catch((statusError) => {
        if (!controller.signal.aborted) setError(statusError.message);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestAbortRef.current?.abort();
      const token = bearerRef.current;
      bearerRef.current = "";
      activeSessionIdRef.current = "";
      if (token) {
        void logoutOpsOperator({ bearerToken: token, keepalive: true }).catch(() => {});
      }
    };
  }, []);

  const login = useCallback(
    async (email, password) => {
      if (status?.individualLoginEnabled !== true) {
        setError("La autenticación individual de OPS no está habilitada.");
        return;
      }
      if (requestLockRef.current) return;
      requestLockRef.current = true;
      const controller = new AbortController();
      requestAbortRef.current = controller;
      setBusy(true);
      setError("");
      setNotice("");
      try {
        const authenticated = await loginOpsOperator({ email, password, signal: controller.signal });
        if (controller.signal.aborted || !mountedRef.current) {
          await logoutOpsOperator({ bearerToken: authenticated.bearerToken }).catch(() => {});
          return;
        }
        bearerRef.current = authenticated.bearerToken;
        activeSessionIdRef.current = authenticated.sessionId;
        if (!canAccessOpsWorkspace(authenticated.operator)) {
          await logoutOpsOperator({ bearerToken: authenticated.bearerToken }).catch(() => {});
          clearSession("Esta cuenta no tiene permiso para acceder a OPS.");
          return;
        }
        if (authenticated.operator.mustChangePassword) {
          setSession(null);
          setOnboardingOperator({ email: authenticated.operator.email });
          return;
        }
        setOnboardingOperator(null);
        setSession({
          sessionId: authenticated.sessionId,
          expiresAt: authenticated.expiresAt,
          operator: authenticated.operator,
        });
      } catch (loginError) {
        bearerRef.current = "";
        activeSessionIdRef.current = "";
        if (!controller.signal.aborted && mountedRef.current) {
          clearSession(loginError.message || "No se pudo iniciar sesión.");
        }
      } finally {
        if (requestAbortRef.current === controller) {
          requestAbortRef.current = null;
          requestLockRef.current = false;
        }
        if (mountedRef.current) setBusy(false);
      }
    },
    [clearSession, status]
  );

  const completeInitialPasswordChange = useCallback(
    async (currentPassword, newPassword, confirmation) => {
      if (requestLockRef.current) return;
      if (newPassword !== confirmation) {
        setError("Las dos copias de la contraseña nueva no coinciden.");
        return;
      }
      const token = bearerRef.current;
      const expectedSessionId = activeSessionIdRef.current;
      if (!token || !expectedSessionId) {
        invalidateSession(expectedSessionId);
        return;
      }
      requestLockRef.current = true;
      const controller = new AbortController();
      requestAbortRef.current = controller;
      setBusy(true);
      setError("");
      setNotice("");
      try {
        await changeTemporaryOperatorPassword({
          bearerToken: token,
          currentPassword,
          newPassword,
          signal: controller.signal,
        });
        if (
          controller.signal.aborted ||
          !mountedRef.current ||
          activeSessionIdRef.current !== expectedSessionId
        ) {
          return;
        }
        bearerRef.current = "";
        activeSessionIdRef.current = "";
        setOnboardingOperator(null);
        setSession(null);
        setNotice("Contraseña actualizada. Identifícate de nuevo con la contraseña nueva.");
      } catch (changeError) {
        if (!controller.signal.aborted && mountedRef.current) {
          if (changeError?.status === 401) clearSession();
          setError(changeError?.message || "No se pudo cambiar la contraseña temporal.");
        }
      } finally {
        if (requestAbortRef.current === controller) {
          requestAbortRef.current = null;
          requestLockRef.current = false;
        }
        if (mountedRef.current) setBusy(false);
      }
    },
    [clearSession, invalidateSession]
  );

  const logout = useCallback(async () => {
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    requestLockRef.current = false;
    const token = bearerRef.current;
    clearSession();
    if (!token) return;
    await logoutOpsOperator({ bearerToken: token }).catch(() => {});
  }, [clearSession]);

  const authFetch = useCallback(
    async (url, options = {}) => {
      const token = bearerRef.current;
      const expectedSessionId = activeSessionIdRef.current;
      if (!token || !expectedSessionId) {
        invalidateSession(expectedSessionId);
        throw new OpsAuthError("ops_auth.session_required", "La sesión individual ha caducado.", 401);
      }
      const request = buildOpsAuthenticatedRequest({
        url,
        bearerToken: token,
        options,
      });
      const response = await fetch(request.url, request.options);
      if (response.status === 401) invalidateSession(expectedSessionId);
      return response;
    },
    [invalidateSession]
  );

  const value = useMemo(
    () => ({
      status,
      session,
      onboardingOperator,
      busy,
      error,
      notice,
      login,
      logout,
      completeInitialPasswordChange,
      authFetch,
      invalidateSession,
      canSupervise: canSuperviseOpsWorkspace(session?.operator),
    }),
    [
      status,
      session,
      onboardingOperator,
      busy,
      error,
      notice,
      login,
      logout,
      completeInitialPasswordChange,
      authFetch,
      invalidateSession,
    ]
  );

  return <OpsAuthContext.Provider value={value}>{children}</OpsAuthContext.Provider>;
}

export function useOpsAuth() {
  const context = useContext(OpsAuthContext);
  if (!context) throw new Error("useOpsAuth debe usarse dentro de OpsAuthProvider.");
  return context;
}

function OpsAuthBoundary({ children }) {
  const auth = useOpsAuth();
  if (auth.onboardingOperator) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950">
        <InitialPasswordCard auth={auth} />
      </main>
    );
  }
  if (!auth.session) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950">
        <LoginCard auth={auth} />
      </main>
    );
  }
  return children;
}

export function OpsWorkspaceRoute() {
  return (
    <OpsAuthProvider>
      <OpsAuthBoundary>
        <Outlet />
      </OpsAuthBoundary>
    </OpsAuthProvider>
  );
}
