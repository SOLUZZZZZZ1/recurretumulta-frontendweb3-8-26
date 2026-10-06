import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useOpsAuth } from "../ops-auth/OpsAuthContext.jsx";
import IniciarExpedienteRTM from "./IniciarExpedienteRTM.jsx";
import MultasDocumentos from "./MultasDocumentos.jsx";
import { REHEARSAL_BASE, REHEARSAL_VERSION, rehearsalJson, rehearsalRequest } from "../lib/stagingRehearsal.js";

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
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (!canSupervise) return undefined;
    const controller = new AbortController();
    async function load() {
      const options = { signal: controller.signal };
      const data = await rehearsalJson(await authFetch(REHEARSAL_BASE + "/profile", options));
      if (data.version !== REHEARSAL_VERSION || data.synthetic_only !== true) throw new Error("No se ha confirmado el perfil del ensayo.");
      const files = await Promise.all(["identity_front", "identity_back"].map(async (kind) => {
        const r = await authFetch(REHEARSAL_BASE + "/fixtures/" + kind, options);
        if (!r.ok || !r.headers.get("content-type")?.includes("application/pdf")) throw new Error("No se pudo preparar la identidad ficticia.");
        return new File([await r.blob()], data.fixtures[kind].filename, { type: "application/pdf" });
      }));
      if (!controller.signal.aborted) setPrepared({ ...data, files });
    }
    void load().catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [authFetch, canSupervise]);

  const rehearsal = useMemo(() => {
    if (!prepared) return null;
    const request = (path, options) => {
      const target = rehearsalRequest(path, options);
      return authFetch(target.url, target.options);
    };
    return {
      profile: prepared.profile, identityFront: prepared.files[0], identityBack: prepared.files[1],
      fetchJson: async (path, options) => rehearsalJson(await request(path, options)),
      openFile: async (path) => {
        const r = await request(path);
        if (!r.ok) { await rehearsalJson(r); return; }
        if (!r.headers.get("content-type")?.includes("application/pdf")) throw new Error("No se recibió un PDF.");
        savePdf(await r.blob(), path.endsWith("candidate-fixture") ? "AUTORIZACION_FICTICIA_CANDIDATO.pdf" : "AUTORIZACION_FICTICIA_EMITIDA.pdf");
      },
      onContinue: setDraft,
    };
  }, [authFetch, prepared]);

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
      {prepared?.existing_case_id ? <p className="mt-3">Ya existe un expediente para este ensayo. Al continuar se recupera la misma referencia. <Link className="underline" to={`/ops/case/${prepared.existing_case_id}`}>Abrir en OPS</Link></p> : null}
      {error ? <p role="alert" className="mt-3 font-bold">{error}</p> : null}
    </aside>
    {rehearsal && !draft ? <IniciarExpedienteRTM rehearsal={rehearsal} /> : null}
    {rehearsal && draft && !complete ? <MultasDocumentos rehearsal={{ ...rehearsal, caseId: draft.caseId, onComplete: () => setComplete(true) }} /> : null}
    {complete ? <main className="mx-auto max-w-3xl p-8">
      <h2 className="text-2xl font-bold">Documentación del ensayo recibida</h2>
      <p className="my-4">La autorización está pendiente de revisión personal. El pago de prueba requiere que el expediente cumpla las comprobaciones habituales.</p>
      <Link className="mr-5 underline" to={`/ops/case/${draft.caseId}`}>Abrir expediente en OPS</Link>
      <Link className="underline" to={`/resumen?case=${draft.caseId}`}>Ver resumen y estado del pago</Link>
    </main> : null}
  </>;
}
