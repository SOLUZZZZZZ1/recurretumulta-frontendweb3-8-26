import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { clientApiUrl, clientRequest } from "../lib/clientApi.js";
import { fileSizeError } from "../lib/clientFiles.js";
import { intakeDocumentsPath } from "../lib/intakeJourney.js";
import FileUploadBox from "./FileUploadBox.jsx";

export default function IntakeAuthorization({ caseId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadUncertain, setUploadUncertain] = useState(false);
  const [notice, setNotice] = useState("");
  const inputRef = useRef(null);
  const uploadLock = useRef(false);
  const requestRef = useRef(null);
  const alive = useRef(true);
  const casePath = `/cases/${encodeURIComponent(caseId)}`;

  const refresh = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");
    try {
      const status = await clientRequest(`${casePath}/public-status`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (status.case_id !== caseId) throw new Error("No se pudo confirmar el expediente.");
      setData(status);
      if (status.authorized) setUploadUncertain(false);
    } catch {
      if (controller.signal.aborted) return;
      setData(null);
      setError("No hemos podido consultar este expediente. Revisa el número o vuelve a intentarlo.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [caseId, casePath]);

  useEffect(() => {
    alive.current = true;
    refresh();
    return () => { alive.current = false; requestRef.current?.abort(); };
  }, [refresh]);

  async function upload() {
    if (uploadLock.current || uploadUncertain) return;
    const problem = fileSizeError(file);
    if (problem) { setError(problem); return; }
    uploadLock.current = true;
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const result = await clientRequest(`${casePath}/upload-authorization-signed`, { method: "POST", body });
      if (!alive.current) return;
      if (result.authorized !== true || result.case_id !== caseId) {
        setUploadUncertain(true);
        await refresh();
        return;
      }
      setData(current => ({ ...current, authorized: true }));
      setFile(null);
      setNotice("Autorización firmada recibida. Ya puedes continuar con los documentos del caso.");
    } catch (error) {
      if (!alive.current) return;
      setUploadUncertain(Boolean(error.uncertain));
      setError(error.message || "No se pudo subir la autorización.");
    } finally {
      uploadLock.current = false;
      if (alive.current) setUploading(false);
    }
  }

  const authorized = data?.authorized === true;
  const advanced = ["submitted", "resolved", "closed"].includes(data?.status) || ["paid", "succeeded", "complete", "completed"].includes(data?.payment_status);
  const nextPath = advanced ? "/resumen" : intakeDocumentsPath(data);

  return (
    <main className="rtm-intake-page">
      <section className="rtm-intake-panel">
        <h1>Continúa tu expediente</h1>
        <p>Conserva este número. Puedes volver a esta página después de firmar sin crear otro expediente.</p>
        <div className="rtm-intake-reference"><strong>Número de expediente</strong><code>{caseId}</code></div>
        {loading && <p role="status">Comprobando el estado de tu expediente…</p>}
        {error && <p role="alert" className="rtm-intake-error">{error}</p>}
        {notice && <p role="status" className="rtm-intake-success">{notice}</p>}
        {!loading && !data && <button type="button" className="sr-btn-primary" onClick={refresh}>Volver a comprobar</button>}
        {!loading && data && !authorized && !advanced && <>
          <h2>Firma y adjunta la autorización</h2>
          <ol className="rtm-intake-instructions">
            <li>Descarga la autorización de este expediente.</li>
            <li>Fírmala y guarda el archivo firmado o una fotografía legible.</li>
            <li>Vuelve aquí y adjunta el documento firmado.</li>
          </ol>
          <a className="sr-btn-primary" href={clientApiUrl(`${casePath}/rtm-authorization-pdf`)} target="_blank" rel="noopener noreferrer">Descargar autorización RTM</a>
          <p className="rtm-intake-hint">La descarga se abre aparte. Esta página mantiene tu expediente.</p>
          <FileUploadBox label="Autorización firmada" file={file} inputRef={inputRef} onChange={setFile} disabled={uploading || uploadUncertain} />
          <button type="button" className="sr-btn-primary rtm-intake-wide" onClick={upload} disabled={!file || uploading || uploadUncertain}>{uploading ? "Subiendo autorización…" : "Subir autorización firmada"}</button>
          {uploadUncertain && <p role="status">El envío está pendiente de confirmar. Comprueba su estado. Si sigue pendiente, <Link to="/contacto">contacta con RTM</Link> antes de volver a adjuntar el archivo.</p>}
          <button type="button" className="sr-btn-secondary rtm-intake-wide" onClick={refresh} disabled={uploading}>Comprobar si ya está recibida</button>
        </>}
        {!loading && data && (authorized || advanced) && <>
          <h2>{advanced ? "Consulta el estado de tu expediente" : "Autorización recibida"}</h2>
          {!advanced && <p>El siguiente paso es adjuntar los documentos relacionados con tu caso.</p>}
          <Link className="sr-btn-primary rtm-intake-wide" to={`${nextPath}?case=${encodeURIComponent(caseId)}`}>{advanced ? "Ver resumen del expediente" : "Continuar y subir documentación del caso"}</Link>
        </>}
        <p className="rtm-intake-hint">También puedes recuperar el expediente desde el inicio utilizando este número.</p>
        <Link to="/">Volver al inicio</Link>
      </section>
    </main>
  );
}
