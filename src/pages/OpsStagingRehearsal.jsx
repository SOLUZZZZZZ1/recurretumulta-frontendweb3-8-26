import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useOpsAuth } from "../ops-auth/OpsAuthContext.jsx";
import IniciarExpedienteRTM from "./IniciarExpedienteRTM.jsx";
import MultasDocumentos from "./MultasDocumentos.jsx";
import OpsSummaryAccess from "../components/OpsSummaryAccess.jsx";
import { REHEARSAL_BASE, rehearsalJson, rehearsalRequest, parseRehearsalProgress } from "../lib/stagingRehearsal.js";

function savePdf(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export default function OpsStagingRehearsal() {
  const { authFetch, canSupervise } = useOpsAuth();
  const [prepared, setPrepared] = useState(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(null);
  const [phase, setPhase] = useState("preparing");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!canSupervise) return undefined;
    const controller = new AbortController();
    async function load() {
      const options = { signal: controller.signal };
      const data = await rehearsalJson(await authFetch(REHEARSAL_BASE + "/profile", options));
      const progress = parseRehearsalProgress(data);
      const files = await Promise.all(["identity_front", "identity_back"].map(async (kind) => {
        const r = await authFetch(REHEARSAL_BASE + "/fixtures/" + kind, options);
        if (!r.ok || !r.headers.get("content-type")?.includes("application/pdf")) throw new Error("No se pudo preparar la identidad ficticia.");
        return new File([await r.blob()], data.fixtures[kind].filename, { type: "application/pdf" });
      }));
      if (!controller.signal.aborted) {
        setPrepared({ ...data, files, progress });
        setPhase(progress.step);
      }
    }
    void load().catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [authFetch, canSupervise]);

  async function advance(saved) {
    if (checking) return;
    setDraft(saved);
    setPhase("checking");
    setChecking(true);
    setError("");
    try {
      const data = await rehearsalJson(await authFetch(REHEARSAL_BASE + "/profile"));
      const progress = parseRehearsalProgress(data, saved.caseId);
      setPrepared(current => ({ ...current, ...data, files: current.files, progress }));
      setPhase(progress.mainDocumentReceived ? progress.step : "documents");
    } catch (e) {
      setError(e.message);
    } finally {
      setChecking(false);
    }
  }

  const rehearsal = useMemo(() => {
    if (!prepared) return null;
    const request = (path, options) => {
      const target = rehearsalRequest(path, options);
      return authFetch(target.url, target.options);
    };
    return {
      profile: prepared.profile, identityFront: prepared.files[0], identityBack: prepared.files[1],
      renewal: phase === "renewal",
      fetchJson: async (path, options) => rehearsalJson(await request(path, options)),
      openFile: async (path) => {
        const r = await request(path);
        if (!r.ok) { await rehearsalJson(r); return; }
        if (!r.headers.get("content-type")?.includes("application/pdf")) throw new Error("No se recibió un PDF.");
        savePdf(await r.blob(), path.endsWith("candidate-fixture") ? (phase === "renewal" ? "AUTORIZACION_FICTICIA_RENOVADA.pdf" : "AUTORIZACION_FICTICIA_CANDIDATO.pdf") : "AUTORIZACION_FICTICIA_EMITIDA.pdf");
      },
      onContinue: advance,
    };
  }, [authFetch, prepared, phase, checking]);

  async function downloadRadar() {
    setError("");
    try {
      const r = await authFetch(REHEARSAL_BASE + "/fixtures/radar");
      if (!r.ok) { await rehearsalJson(r); return; }
      savePdf(await r.blob(), prepared.fixtures.radar.filename);
    } catch (e) { setError(e.message); }
  }

  if (!canSupervise) return <main className="p-6"><h1>Ensayo de radar</h1><p>Se necesita una sesión de supervisor.</p><Link to="/ops">Volver a OPS</Link></main>;
  return <>
    <aside className="border-b border-amber-300 bg-amber-50 p-5 text-amber-950">
      <Link to="/ops" className="underline">Volver a OPS</Link>
      <h1 className="mt-3 text-2xl font-bold">Ensayo de radar · solo datos ficticios</h1>
      <p className="mt-2">Documento de prueba fechado el 05/10/2026. Es una petición de identificación del conductor; todavía no consta importe ni fecha de recepción.</p>
      <p>Conserva los datos preparados y utiliza únicamente los PDF descargados desde este ensayo. La autorización y su firma son ficticias y no acreditan representación real. Las casillas requieren tu confirmación.</p>
      {prepared ? <button type="button" onClick={downloadRadar} className="mt-3 rounded-lg border border-amber-700 px-4 py-2">Descargar notificación ficticia para el paso de documentación</button> : <p role="status">{error ? "No se ha podido abrir el ensayo." : "Preparando el ensayo…"}</p>}
      {prepared?.existing_case_id ? <p className="mt-3">Continuamos con el mismo expediente: {prepared.existing_case_id}. <Link className="underline" to={`/ops/case/${prepared.existing_case_id}`}>Abrir en OPS</Link></p> : null}
      {error ? <p role="alert" className="mt-3 font-bold">{error}</p> : null}
    </aside>
    {rehearsal && ["intake", "renewal"].includes(phase) ? <IniciarExpedienteRTM key={phase} rehearsal={rehearsal} /> : null}
    {rehearsal && phase === "documents" ? <MultasDocumentos rehearsal={{ ...rehearsal, caseId: draft.caseId, onComplete: () => advance(draft) }} /> : null}
    {phase === "checking" ? <main className="mx-auto max-w-3xl p-8">
      <p role="status">{checking ? "Comprobando el siguiente paso del expediente…" : "La documentación está guardada. Falta comprobar el siguiente paso."}</p>
      {!checking ? <button type="button" className="sr-btn-primary mt-4" onClick={() => advance(draft)}>Comprobar estado del ensayo</button> : null}
    </main> : null}
    {phase === "review" ? <main className="mx-auto max-w-3xl p-8">
      <h2 className="text-2xl font-bold">Documentación del ensayo recibida</h2>
      <p className="my-4">{prepared.progress.authorizationStatus === "verified"
        ? "La autorización está verificada. Puedes continuar al resumen para comprobar el pago de prueba."
        : "La autorización vigente está pendiente de revisión personal. Abre su revisión en OPS antes de continuar al pago de prueba."}</p>
      <Link className="mr-5 underline" to={`/ops/authorization/${prepared.progress.caseId}`}>Revisar autorización en OPS</Link>
      <OpsSummaryAccess key={prepared.progress.caseId} caseId={prepared.progress.caseId} className="underline mt-3" />
    </main> : null}
  </>;
}
