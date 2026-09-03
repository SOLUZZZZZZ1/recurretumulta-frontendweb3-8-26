import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useOpsAuth } from "../ops-auth/OpsAuthContext.jsx";
import {
  createRtmPresenterClient,
  RtmPresenterWorkspace,
} from "../rtm-presenter/index.js";

const EXACT_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function OpsPresenterPage() {
  const { caseId } = useParams();
  const { session, authFetch, invalidateSession, logout } = useOpsAuth();
  const [activeCaseId, setActiveCaseId] = useState(caseId || "");

  useEffect(() => {
    setActiveCaseId(caseId || "");
  }, [caseId]);

  const openPresenterCase = useCallback((nextCaseId) => {
    const exact = String(nextCaseId || "").trim();
    if (!EXACT_UUID_PATTERN.test(exact)) return;
    setActiveCaseId(exact);
    globalThis.scrollTo?.({ top: 0, behavior: "smooth" });
  }, []);

  const presenterUnauthorized = useCallback(() => {
    invalidateSession(session.sessionId);
  }, [invalidateSession, session.sessionId]);

  const presenterClient = useMemo(
    () =>
      createRtmPresenterClient({
        fetchImpl: authFetch,
        onUnauthorized: presenterUnauthorized,
        environment: "staging",
        syntheticOnly: true,
      }),
    [authFetch, presenterUnauthorized]
  );

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            to={`/ops/case/${encodeURIComponent(activeCaseId || "")}`}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700"
          >
            ← Volver al expediente
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/ops/presenter/signer"
              title="La estación de firma utiliza una cuenta y una sesión separadas."
              className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-black text-blue-900"
            >
              Puesto local de firma · acceso aparte
            </Link>
            <span className="rounded-full bg-amber-100 px-4 py-2 text-xs font-black uppercase tracking-wide text-amber-900">
              Staging · synthetic only · sin efecto jurídico
            </span>
          </div>
        </div>

        <header className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-slate-950 p-5 text-white shadow-xl">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
              Sesión individual en memoria
            </p>
            <h1 className="mt-1 text-2xl font-black">
              {session.operator.displayName || session.operator.email}
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              {session.operator.roleCode || "sin rol"} · dispositivo vinculado · caduca{" "}
              {String(session.expiresAt || "—")}
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
          key={`${session.sessionId}:${activeCaseId || ""}`}
          caseId={activeCaseId}
          onOpenCase={openPresenterCase}
          apiClient={presenterClient}
          operatorCapabilities={session.operator.permissions}
          environment="staging"
          syntheticOnly
        />
      </div>
    </main>
  );
}
