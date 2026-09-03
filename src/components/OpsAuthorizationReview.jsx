import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AUTHORIZATION_VIEW_WINDOW_MS,
  OpsAuthorizationReviewError,
  buildAuthorizationReviewBody,
  fetchVerifiedAuthorizationCandidatePdf,
  isAuthorizationViewFresh,
  reauthenticateAuthorizationReviewer,
  resolvePendingAuthorizationCandidates,
  submitAuthorizationReview,
} from "../lib/opsAuthorizationReview.js";

const REJECTION_OPTIONS = Object.freeze([
  ["document_mismatch", "El firmado no coincide con el documento emitido"],
  ["identity_mismatch", "La identidad no coincide"],
  ["signature_missing", "Falta la firma"],
  ["illegible", "El documento o la firma no son legibles"],
  ["suspected_tampering", "Hay indicios de manipulación"],
]);

function emptyChecks() {
  return {
    reviewedEntireDocument: false,
    generatedDocumentMatches: false,
    identityMatches: false,
    signaturePresent: false,
  };
}

function shortId(value) {
  const text = String(value || "");
  return text.length > 16 ? `${text.slice(0, 8)}…${text.slice(-8)}` : text;
}

function formatDate(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString("es-ES") : "—";
}

export default function OpsAuthorizationReview({
  authFetch,
  caseId,
  documents,
  events,
  loading = false,
  onReviewed,
  sessionId,
}) {
  const discovery = useMemo(() => {
    try {
      return {
        candidates: resolvePendingAuthorizationCandidates({
          caseId,
          documents,
          events,
        }),
        error: "",
      };
    } catch (error) {
      return {
        candidates: [],
        error:
          error?.message ||
          "No se pudo vincular el candidato con su atestación exacta.",
      };
    }
  }, [caseId, documents, events]);

  const [selectedKey, setSelectedKey] = useState("");
  const [checks, setChecks] = useState(emptyChecks);
  const [reasonCode, setReasonCode] = useState("");
  const [password, setPassword] = useState("");
  const [viewReceipt, setViewReceipt] = useState(null);
  const [busyView, setBusyView] = useState(false);
  const [busyDecision, setBusyDecision] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const viewAbortRef = useRef(null);
  const decisionAbortRef = useRef(null);
  const viewerWindowRef = useRef(null);
  const blobUrlRef = useRef("");
  const candidateKeyRef = useRef("");
  const decisionLockRef = useRef(false);
  const passwordInputRef = useRef(null);

  const selectedCandidate =
    discovery.candidates.find((candidate) => candidate.key === selectedKey) ||
    discovery.candidates[0] ||
    null;
  const activeCandidateKey = selectedCandidate?.key || "";
  candidateKeyRef.current = activeCandidateKey;

  const disposeViewer = useCallback(() => {
    viewAbortRef.current?.abort();
    viewAbortRef.current = null;
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = "";
    }
    try {
      if (viewerWindowRef.current && !viewerWindowRef.current.closed) {
        viewerWindowRef.current.close();
      }
    } catch {
      // The PDF window is best-effort cleanup; all review state still closes.
    }
    viewerWindowRef.current = null;
  }, []);

  useEffect(() => {
    if (!discovery.candidates.length) {
      if (selectedKey) setSelectedKey("");
      return;
    }
    if (!discovery.candidates.some((candidate) => candidate.key === selectedKey)) {
      setSelectedKey(discovery.candidates[0].key);
    }
  }, [discovery.candidates, selectedKey]);

  useEffect(() => {
    decisionAbortRef.current?.abort();
    decisionAbortRef.current = null;
    decisionLockRef.current = false;
    disposeViewer();
    setChecks(emptyChecks());
    setReasonCode("");
    setPassword("");
    setViewReceipt(null);
    setBusyView(false);
    setBusyDecision(false);
    setError("");
    setMessage("");
  }, [activeCandidateKey, caseId, disposeViewer]);

  useEffect(() => {
    const closeSensitiveViewer = () => {
      decisionAbortRef.current?.abort();
      decisionAbortRef.current = null;
      decisionLockRef.current = false;
      if (passwordInputRef.current) passwordInputRef.current.value = "";
      setPassword("");
      setViewReceipt(null);
      setChecks(emptyChecks());
      setReasonCode("");
      setBusyView(false);
      setBusyDecision(false);
      setError("");
      setMessage("");
      disposeViewer();
    };
    const restoreSensitiveViewer = (event) => {
      if (event?.persisted === true) closeSensitiveViewer();
    };
    window.addEventListener("pagehide", closeSensitiveViewer);
    window.addEventListener("pageshow", restoreSensitiveViewer);
    return () => {
      window.removeEventListener("pagehide", closeSensitiveViewer);
      window.removeEventListener("pageshow", restoreSensitiveViewer);
      decisionAbortRef.current?.abort();
      disposeViewer();
    };
  }, [disposeViewer]);

  useEffect(() => {
    if (!viewReceipt || !selectedCandidate) return undefined;
    const remaining =
      viewReceipt.viewedAt + AUTHORIZATION_VIEW_WINDOW_MS - Date.now();
    if (remaining <= 0) {
      disposeViewer();
      setViewReceipt(null);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      disposeViewer();
      setViewReceipt(null);
      setMessage("");
      setError("La vista segura ha caducado. Abre de nuevo el PDF exacto.");
    }, remaining + 25);
    return () => window.clearTimeout(timer);
  }, [disposeViewer, selectedCandidate, viewReceipt]);

  const viewIsFresh = isAuthorizationViewFresh(
    viewReceipt,
    selectedCandidate
  );
  const controlsDisabled =
    loading || busyView || busyDecision || !selectedCandidate || !sessionId;
  const approveDisabled =
    controlsDisabled ||
    !viewIsFresh ||
    !password ||
    !checks.reviewedEntireDocument ||
    !checks.generatedDocumentMatches ||
    !checks.identityMatches ||
    !checks.signaturePresent;
  const rejectDisabled =
    controlsDisabled ||
    !viewIsFresh ||
    !password ||
    !checks.reviewedEntireDocument ||
    !reasonCode;

  function setCheck(name, value) {
    setChecks((current) => ({ ...current, [name]: value }));
    setMessage("");
  }

  async function openExactCandidate() {
    const candidate = selectedCandidate;
    if (!candidate || controlsDisabled) return;
    disposeViewer();
    setViewReceipt(null);
    setChecks(emptyChecks());
    setReasonCode("");
    setPassword("");
    setError("");
    setMessage("");

    let viewer = null;
    try {
      viewer = window.open("about:blank", "_blank", "popup");
      if (!viewer) {
        throw new OpsAuthorizationReviewError(
          "authorization_review.popup_blocked",
          "El navegador bloqueó la ventana protegida. Permítela y vuelve a intentarlo."
        );
      }
      viewer.opener = null;
      viewer.document.title = "RTM · autorización protegida";
      viewer.document.body.textContent =
        "RTM está verificando el PDF exacto antes de mostrarlo…";
      viewerWindowRef.current = viewer;
    } catch (openError) {
      try {
        viewer?.close();
      } catch {
        // Nothing sensitive was loaded if the blank window could not be prepared.
      }
      viewerWindowRef.current = null;
      setError(openError?.message || "No se pudo preparar la ventana protegida.");
      return;
    }

    const controller = new AbortController();
    viewAbortRef.current = controller;
    const expectedKey = candidate.key;
    setBusyView(true);
    try {
      const verified = await fetchVerifiedAuthorizationCandidatePdf({
        authFetch,
        candidate,
        signal: controller.signal,
      });
      if (
        controller.signal.aborted ||
        candidateKeyRef.current !== expectedKey ||
        viewer.closed
      ) {
        throw new OpsAuthorizationReviewError(
          "authorization_review.view_cancelled",
          "La vista protegida se cerró antes de completar la verificación."
        );
      }
      const objectUrl = URL.createObjectURL(
        new Blob([verified.bytes], { type: verified.mime })
      );
      blobUrlRef.current = objectUrl;
      viewer.location.replace(objectUrl);
      setViewReceipt({
        candidateKey: expectedKey,
        viewedAt: verified.fetchedAt,
      });
      setMessage(
        "PDF exacto verificado y abierto. Revisa todas sus páginas antes de decidir."
      );
    } catch (viewError) {
      if (!controller.signal.aborted) {
        setError(viewError?.message || "No se pudo verificar el PDF candidato.");
      }
      disposeViewer();
      setViewReceipt(null);
    } finally {
      if (viewAbortRef.current === controller) viewAbortRef.current = null;
      if (candidateKeyRef.current === expectedKey) setBusyView(false);
    }
  }

  async function decide(decision) {
    const candidate = selectedCandidate;
    if (!candidate || decisionLockRef.current) return;
    if (!isAuthorizationViewFresh(viewReceipt, candidate)) {
      setError("La vista segura no está vigente. Abre de nuevo el PDF exacto.");
      return;
    }

    let submittedPassword = password;
    const submittedChecks = { ...checks };
    const submittedReason = decision === "approve" ? null : reasonCode;
    try {
      buildAuthorizationReviewBody({
        decision,
        candidate,
        checks: submittedChecks,
        reasonCode: submittedReason,
      });
    } catch (validationError) {
      setError(validationError?.message || "La revisión no está completa.");
      return;
    }

    setPassword("");
    if (passwordInputRef.current) passwordInputRef.current.value = "";
    setError("");
    setMessage("");
    decisionLockRef.current = true;
    decisionAbortRef.current?.abort();
    const controller = new AbortController();
    decisionAbortRef.current = controller;
    const expectedKey = candidate.key;
    setBusyDecision(true);
    try {
      await reauthenticateAuthorizationReviewer({
        authFetch,
        password: submittedPassword,
        expectedSessionId: sessionId,
        signal: controller.signal,
      });
      submittedPassword = "";
      if (
        controller.signal.aborted ||
        candidateKeyRef.current !== expectedKey ||
        !isAuthorizationViewFresh(viewReceipt, candidate)
      ) {
        throw new OpsAuthorizationReviewError(
          "authorization_review.view_expired",
          "La vista segura caducó durante la reautenticación."
        );
      }
      const result = await submitAuthorizationReview({
        authFetch,
        caseId,
        candidate,
        decision,
        checks: submittedChecks,
        reasonCode: submittedReason,
        signal: controller.signal,
      });
      if (controller.signal.aborted || candidateKeyRef.current !== expectedKey) return;

      disposeViewer();
      setViewReceipt(null);
      setChecks(emptyChecks());
      setReasonCode("");
      setMessage(
        result.signedAuthorityVerified
          ? "Autorización firmada aprobada y verificada."
          : "Candidato rechazado y retirado de la revisión pendiente."
      );
      if (typeof onReviewed === "function") await onReviewed();
    } catch (decisionError) {
      if (!controller.signal.aborted) {
        setError(
          decisionError?.message || "No se pudo registrar la decisión exacta."
        );
        if (
          decisionError?.status === 409 ||
          decisionError?.code === "authorization_review.review_contract_invalid" ||
          decisionError?.code === "authorization_review.review_transport_failed" ||
          decisionError?.code === "authorization_review.view_expired"
        ) {
          disposeViewer();
          setViewReceipt(null);
          setChecks(emptyChecks());
          if (typeof onReviewed === "function") await onReviewed();
        }
      }
    } finally {
      submittedPassword = "";
      if (decisionAbortRef.current === controller) {
        decisionAbortRef.current = null;
        decisionLockRef.current = false;
        setBusyDecision(false);
      }
    }
  }

  return (
    <section className="mt-5 rounded-3xl border border-indigo-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 px-4 py-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-700">
            Autoridad de representación
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            Revisión exacta de autorización firmada
          </h2>
        </div>
        <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-800">
          Supervisor individual
        </span>
      </div>

      <div className="p-4">
        {discovery.error ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            Revisión bloqueada: {discovery.error}
          </div>
        ) : !selectedCandidate ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            No hay ninguna autorización firmada pendiente de revisión exacta.
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
              {discovery.candidates.length > 1 ? (
                <label className="grid gap-2 text-sm font-bold text-slate-800">
                  Candidato pendiente
                  <select
                    value={selectedCandidate.key}
                    onChange={(event) => setSelectedKey(event.target.value)}
                    disabled={busyView || busyDecision}
                    className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 font-normal"
                  >
                    {discovery.candidates.map((candidate) => (
                      <option key={candidate.key} value={candidate.key}>
                        {shortId(candidate.documentId)} · {formatDate(candidate.uploadedAt)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                <div><b>Documento:</b> <span className="break-all">{selectedCandidate.documentId}</span></div>
                <div className="mt-2"><b>Tamaño:</b> {selectedCandidate.sizeBytes.toLocaleString("es-ES")} bytes</div>
                <div className="mt-2"><b>Subido:</b> {formatDate(selectedCandidate.uploadedAt)}</div>
                <div className="mt-2"><b>SHA-256 del PDF:</b></div>
                <code className="mt-1 block break-all rounded-lg bg-white p-2 text-[10px]">{selectedCandidate.documentSha256}</code>
                <div className="mt-2"><b>SHA-256 de atestación:</b></div>
                <code className="mt-1 block break-all rounded-lg bg-white p-2 text-[10px]">{selectedCandidate.attestationSha256}</code>
              </div>

              <button
                type="button"
                onClick={openExactCandidate}
                disabled={controlsDisabled}
                className="w-full rounded-xl bg-indigo-700 px-4 py-3 text-sm font-black text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {busyView ? "Verificando PDF exacto…" : viewIsFresh ? "Volver a abrir PDF exacto" : "Abrir PDF exacto en ventana protegida"}
              </button>
              <p className="text-xs leading-5 text-slate-600">
                RTM descarga únicamente este candidato mediante la sesión individual,
                comprueba su atestación, tamaño y SHA-256 y lo abre fuera de marcos
                embebidos. La ventana y el blob se eliminan al salir o al caducar la vista.
              </p>
              {viewIsFresh ? (
                <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
                  Vista exacta vigente. La decisión debe completarse en menos de 15 minutos.
                </p>
              ) : null}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-bold text-slate-900">Checklist auditado</p>
              {[
                ["reviewedEntireDocument", "He revisado todas las páginas del documento"],
                ["generatedDocumentMatches", "El firmado coincide con la autorización emitida"],
                ["identityMatches", "La identidad coincide con el expediente"],
                ["signaturePresent", "La firma está presente y es legible"],
              ].map(([name, label]) => (
                <label key={name} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    checked={checks[name]}
                    onChange={(event) => setCheck(name, event.target.checked)}
                    disabled={!viewIsFresh || busyDecision}
                    className="mt-0.5"
                  />
                  <span>{label}</span>
                </label>
              ))}

              <label className="grid gap-2 text-sm font-bold text-slate-800">
                Motivo estructurado si se rechaza
                <select
                  value={reasonCode}
                  onChange={(event) => setReasonCode(event.target.value)}
                  disabled={!viewIsFresh || busyDecision}
                  className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 font-normal"
                >
                  <option value="">Selecciona un motivo</option>
                  {REJECTION_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-bold text-slate-800">
                Contraseña del supervisor para esta decisión
                <input
                  ref={passwordInputRef}
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  maxLength={256}
                  disabled={!viewIsFresh || busyDecision}
                  className="min-h-11 rounded-xl border border-slate-300 px-3 font-normal"
                />
              </label>
              <p className="text-xs leading-5 text-slate-600">
                La contraseña se borra antes de enviar. El servidor exige una
                reautenticación individual de menos de cinco minutos y la decisión se
                envía inmediatamente después.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => decide("approve")}
                  disabled={approveDisabled}
                  className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {busyDecision ? "Registrando…" : "Aprobar autorización"}
                </button>
                <button
                  type="button"
                  onClick={() => decide("reject")}
                  disabled={rejectDisabled}
                  className="rounded-xl bg-red-700 px-4 py-3 text-sm font-black text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {busyDecision ? "Registrando…" : "Rechazar candidato"}
                </button>
              </div>
            </div>
          </div>
        )}

        {error ? (
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
