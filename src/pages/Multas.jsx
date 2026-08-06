import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Seo from "../components/Seo.jsx";

const API = "/api";
const DIRECT_BACKEND = "https://recurretumulta-backend.onrender.com";

const API_CANDIDATES = [
  import.meta.env.VITE_API_BASE_URL,
  import.meta.env.VITE_API_URL,
  DIRECT_BACKEND,
  API,
].filter(Boolean);

const HARD_SEND_LIMIT_BYTES = 2.2 * 1024 * 1024;
const TARGET_IMAGE_BYTES = 1.6 * 1024 * 1024;
const IMAGE_MAX_SIDE = 1800;

const REVIEW_ITEMS = [
  {
    icon: "📄",
    title: "La denuncia",
    text: "Comprobamos la información de la notificación y la documentación disponible.",
  },
  {
    icon: "📅",
    title: "Los plazos",
    text: "Verificamos si todavía es posible actuar y qué opciones siguen abiertas.",
  },
  {
    icon: "⚖️",
    title: "La normativa",
    text: "Analizamos el marco jurídico aplicable a la sanción y al procedimiento.",
  },
  {
    icon: "🔎",
    title: "Tu situación",
    text: "Valoramos las circunstancias concretas que pueden influir en el expediente.",
  },
];

const RESULT_ITEMS = [
  "Qué hemos detectado.",
  "Qué alternativas pueden existir.",
  "Qué limitaciones hemos encontrado.",
  "Qué puedes hacer a continuación.",
];

const FAQ_ITEMS = [
  {
    question: "¿Y si no merece la pena recurrir?",
    answer:
      "Te lo diremos con claridad. La revisión sirve precisamente para evitar iniciar actuaciones sin una base razonable.",
  },
  {
    question: "¿Qué documentación necesito?",
    answer:
      "Puedes empezar con la multa o notificación que tengas disponible. Si necesitamos algo más, te lo indicaremos.",
  },
  {
    question: "¿Cuánto tarda la revisión?",
    answer:
      "El plazo depende del expediente y de la documentación recibida. Te informaremos del estado y del siguiente paso.",
  },
  {
    question: "¿Estoy obligado a continuar?",
    answer:
      "No. La decisión de contratar una actuación posterior será siempre tuya.",
  },
];

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getExt(name = "") {
  const match = String(name).match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : "";
}

function isImageFile(file) {
  const ext = getExt(file?.name);
  return (
    file?.type?.startsWith("image/") ||
    ["jpg", "jpeg", "png", "webp"].includes(ext)
  );
}

function isPdfFile(file) {
  return file?.type === "application/pdf" || getExt(file?.name) === "pdf";
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("No se pudo comprimir la imagen."));
        else resolve(blob);
      },
      "image/jpeg",
      quality
    );
  });
}

async function loadImage(file) {
  const url = URL.createObjectURL(file);

  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(
          new Error(
            "No se pudo leer la imagen. Si el móvil la guardó como HEIC, haz una captura de pantalla y sube esa captura."
          )
        );
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function compressImageForUpload(file) {
  const image = await loadImage(file);
  const originalWidth = image.naturalWidth || image.width;
  const originalHeight = image.naturalHeight || image.height;

  if (!originalWidth || !originalHeight) {
    throw new Error("No se pudo leer el tamaño de la imagen.");
  }

  let bestBlob = null;
  let bestWidth = 0;
  let bestHeight = 0;

  for (const maxSide of [IMAGE_MAX_SIDE, 1600, 1400, 1100, 900]) {
    let width = originalWidth;
    let height = originalHeight;

    const longest = Math.max(width, height);

    if (longest > maxSide) {
      const ratio = maxSide / longest;
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { alpha: false });

    if (!ctx) {
      throw new Error("No se pudo preparar la compresión.");
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    for (const quality of [0.78, 0.68, 0.58, 0.48, 0.38, 0.3, 0.22]) {
      const blob = await canvasToBlob(canvas, quality);

      if (!bestBlob || blob.size < bestBlob.size) {
        bestBlob = blob;
        bestWidth = width;
        bestHeight = height;
      }

      if (blob.size <= TARGET_IMAGE_BYTES) {
        bestBlob = blob;
        bestWidth = width;
        bestHeight = height;
        break;
      }
    }

    if (bestBlob && bestBlob.size <= TARGET_IMAGE_BYTES) break;
  }

  if (!bestBlob) {
    throw new Error("No se pudo optimizar la imagen.");
  }

  if (bestBlob.size > HARD_SEND_LIMIT_BYTES) {
    throw new Error(
      `La imagen sigue pesando ${formatBytes(
        bestBlob.size
      )} tras prepararla. Haz una captura más simple del documento.`
    );
  }

  const base = String(file.name || "documento").replace(/\.[^.]+$/, "");
  const optimizedFile = new File([bestBlob], `${base}-preparado.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });

  return {
    file: optimizedFile,
    originalSize: file.size,
    finalSize: optimizedFile.size,
    width: bestWidth,
    height: bestHeight,
    optimized: true,
  };
}

async function prepareUploadFile(file) {
  if (!file) throw new Error("Archivo no válido.");

  if (isImageFile(file)) {
    return compressImageForUpload(file);
  }

  if (isPdfFile(file)) {
    if (file.size > HARD_SEND_LIMIT_BYTES) {
      throw new Error(
        `El PDF pesa ${formatBytes(
          file.size
        )}. Para evitar un error de subida, sube una foto o captura clara del documento.`
      );
    }

    return {
      file,
      originalSize: file.size,
      finalSize: file.size,
      optimized: false,
    };
  }

  if (file.size > HARD_SEND_LIMIT_BYTES) {
    throw new Error(
      `El archivo pesa ${formatBytes(
        file.size
      )}. Sube una foto o captura para que el sistema la prepare automáticamente.`
    );
  }

  return {
    file,
    originalSize: file.size,
    finalSize: file.size,
    optimized: false,
  };
}

async function parseResponse(response) {
  const text = await response.text().catch(() => "");
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    const detail =
      data?.detail ||
      data?.message ||
      data?.error ||
      text ||
      `HTTP ${response.status}`;

    throw new Error(
      typeof detail === "string"
        ? `HTTP ${response.status}: ${detail}`
        : `HTTP ${response.status}`
    );
  }

  return data;
}

async function requestWithFallback(path, options = {}) {
  const errors = [];

  for (const base of API_CANDIDATES) {
    const cleanBase = String(base).replace(/\/$/, "");
    const url = `${cleanBase}${path}`;

    try {
      const response = await fetch(url, options);
      return await parseResponse(response);
    } catch (error) {
      errors.push(`${url} → ${error?.message || "error"}`);
    }
  }

  throw new Error(`No se pudo completar la operación. ${errors.join(" | ")}`);
}

function looksLikeUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
}

function getCasePhase(data) {
  const authorized = Boolean(data?.authorized);
  const paymentStatus = String(data?.payment_status || "").toLowerCase();
  const status = String(data?.status || "").toLowerCase();

  if (!authorized) return "authorize";
  if (paymentStatus !== "paid") return "pay";

  if (
    status.includes("presentado") ||
    status === "submitted" ||
    status === "closed" ||
    status === "resolved"
  ) {
    return "status";
  }

  return "summary";
}

function HeroDocumentScene() {
  return (
    <div className="mt-scene" aria-hidden="true">
      <div className="mt-window">
        <span />
        <span />
      </div>

      <div className="mt-laptop">
        <div className="mt-laptop-screen">
          <small>RTM · EXPEDIENTE</small>
          <strong>Revisión inicial</strong>
          <i />
          <i />
          <i className="short" />
          <b>DOCUMENTACIÓN RECIBIDA</b>
        </div>
        <div className="mt-laptop-base" />
      </div>

      <div className="mt-ticket">
        <small>NOTIFICACIÓN</small>
        <strong>EXPEDIENTE SANCIONADOR</strong>
        <i />
        <i />
        <i className="short" />
        <span>PLAZO EN REVISIÓN</span>
      </div>

      <div className="mt-notebook">
        <i />
        <i />
        <i />
      </div>

      <div className="mt-cup">☕</div>
    </div>
  );
}

export default function Multas() {
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [uploadInfo, setUploadInfo] = useState(null);
  const [caseId, setCaseId] = useState("");
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [message, setMessage] = useState("");

  async function handleFileChange(selectedFile) {
    setMessage("");
    setUploadInfo(null);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    setPreparing(true);

    try {
      const prepared = await prepareUploadFile(selectedFile);
      setFile(prepared.file);
      setUploadInfo(prepared);

      if (prepared.optimized) {
        setMessage(
          `Imagen preparada correctamente: ${formatBytes(
            prepared.originalSize
          )} → ${formatBytes(prepared.finalSize)}`
        );
      }
    } catch (error) {
      setFile(null);
      setUploadInfo(null);
      setMessage(error?.message || "No se pudo preparar el archivo.");
    } finally {
      setPreparing(false);
    }
  }

  async function handleUpload() {
    setMessage("");

    if (!file) {
      setMessage(
        "Selecciona primero la multa o notificación que quieres revisar."
      );
      return;
    }

    if (file.size > HARD_SEND_LIMIT_BYTES) {
      setMessage(
        `El archivo preparado pesa ${formatBytes(
          file.size
        )} y no se enviará para evitar un error de subida.`
      );
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const data = await requestWithFallback("/analyze", {
        method: "POST",
        body: formData,
      });

      localStorage.setItem("rtm_last_analysis", JSON.stringify(data));

      const newCaseId =
        data?.case_id ||
        data?.caseId ||
        data?.id ||
        data?.extracted?.case_id ||
        data?.extracted?.id;

      if (!newCaseId) {
        throw new Error(
          "El análisis se completó, pero no se recibió número de expediente."
        );
      }

      navigate(`/resumen?case=${encodeURIComponent(newCaseId)}`);
    } catch (error) {
      setMessage(error?.message || "Error al subir el documento.");
    } finally {
      setLoading(false);
    }
  }

  async function continueCase() {
    const clean = caseId.trim();

    if (!clean) {
      setMessage(
        "Introduce el número de expediente o el código interno para continuar."
      );
      return;
    }

    setMessage("");
    setLoading(true);

    try {
      const data = looksLikeUuid(clean)
        ? await requestWithFallback(
            `/cases/${encodeURIComponent(clean)}/public-status`,
            { method: "GET" }
          )
        : await requestWithFallback(
            `/cases/continue-lookup?q=${encodeURIComponent(clean)}`,
            { method: "GET" }
          );

      const caseKey = data?.case_id || data?.id || clean;
      const phase = getCasePhase(data);

      if (phase === "authorize") {
        navigate(`/autorizar?case=${encodeURIComponent(caseKey)}`);
        return;
      }

      if (phase === "status") {
        navigate(`/estado-expediente?case=${encodeURIComponent(caseKey)}`);
        return;
      }

      navigate(`/resumen?case=${encodeURIComponent(caseKey)}`);
    } catch (error) {
      setMessage(error?.message || "No se pudo recuperar el expediente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Seo
        title="Multas y vehículos · RTM"
        description="Inicia la Revisión Inicial de tu expediente sancionador. Revisamos la documentación, los plazos y las posibles vías antes de que decidas cómo continuar."
        canonical="https://www.recurretumulta.eu/trafico"
      />

      <style>{`
        .mt-page{
          --navy:#0c2f61;
          --blue:#0b65d8;
          --green:#2bb673;
          --ink:#142033;
          --muted:#64748b;
          --soft:#eaf3ff;
          --line:#dce7f4;
          min-height:100vh;
          overflow:hidden;
          color:var(--ink);
          background:
            radial-gradient(circle at 12% 0%,rgba(11,101,216,.08),transparent 28%),
            linear-gradient(180deg,#fff 0%,#f8fbff 50%,#fff 100%);
        }

        .mt-container{
          width:min(1180px,calc(100% - 40px));
          margin:0 auto;
        }

        .mt-hero{
          padding:72px 0 68px;
        }

        .mt-hero-grid{
          display:grid;
          grid-template-columns:minmax(0,.92fr) minmax(470px,1.08fr);
          gap:58px;
          align-items:center;
        }

        .mt-kicker{
          display:inline-flex;
          align-items:center;
          gap:10px;
          margin-bottom:18px;
          color:var(--blue);
          font-size:13px;
          font-weight:950;
          letter-spacing:.14em;
          text-transform:uppercase;
        }

        .mt-kicker:before{
          content:"";
          width:34px;
          height:3px;
          border-radius:999px;
          background:var(--blue);
        }

        .mt-hero h1{
          max-width:660px;
          margin:0;
          color:var(--navy);
          font-size:clamp(48px,6.2vw,78px);
          font-weight:950;
          line-height:.98;
          letter-spacing:-.058em;
        }

        .mt-lead{
          max-width:660px;
          margin:25px 0 0;
          color:#35445a;
          font-size:clamp(18px,2vw,22px);
          line-height:1.62;
        }

        .mt-lead strong{
          color:var(--navy);
        }

        .mt-actions{
          display:flex;
          flex-wrap:wrap;
          gap:18px;
          align-items:center;
          margin-top:30px;
        }

        .mt-primary,
        .mt-secondary{
          min-height:52px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          border-radius:14px;
          border:0;
          text-decoration:none;
          font:inherit;
          font-weight:900;
          cursor:pointer;
        }

        .mt-primary{
          padding:14px 23px;
          color:#fff;
          background:var(--green);
          box-shadow:0 14px 30px rgba(43,182,115,.22);
        }

        .mt-primary:disabled{
          opacity:.62;
          cursor:not-allowed;
        }

        .mt-secondary{
          padding:14px 4px;
          color:var(--navy);
          background:transparent;
        }

        .mt-trust{
          display:flex;
          flex-wrap:wrap;
          gap:14px 20px;
          margin-top:24px;
          color:#516176;
          font-size:14px;
          font-weight:800;
        }

        .mt-trust span:before{
          content:"✓";
          margin-right:7px;
          color:var(--green);
          font-weight:950;
        }

        .mt-scene{
          position:relative;
          min-height:510px;
          overflow:hidden;
          border:1px solid #dbe7f3;
          border-radius:32px;
          background:
            radial-gradient(circle at 18% 14%,rgba(255,255,255,.92),transparent 32%),
            linear-gradient(145deg,#eaf3ff,#f9fbfd 48%,#e6edf4);
          box-shadow:0 30px 74px rgba(15,23,42,.18);
        }

        .mt-window{
          position:absolute;
          top:0;
          right:0;
          width:42%;
          height:58%;
          border-left:10px solid rgba(255,255,255,.78);
          border-bottom:10px solid rgba(255,255,255,.78);
          background:linear-gradient(150deg,#d7ecff,#f5fbff);
          opacity:.78;
        }

        .mt-window span:first-child{
          position:absolute;
          left:50%;
          width:9px;
          height:100%;
          background:rgba(255,255,255,.82);
        }

        .mt-window span:last-child{
          position:absolute;
          top:50%;
          width:100%;
          height:9px;
          background:rgba(255,255,255,.82);
        }

        .mt-laptop{
          position:absolute;
          top:118px;
          right:34px;
          width:49%;
        }

        .mt-laptop-screen{
          min-height:230px;
          padding:28px;
          border:10px solid #172033;
          border-radius:20px 20px 10px 10px;
          background:#fff;
          box-shadow:0 25px 45px rgba(15,23,42,.22);
        }

        .mt-laptop-screen small{
          color:var(--blue);
          font-size:11px;
          font-weight:950;
          letter-spacing:.12em;
        }

        .mt-laptop-screen strong{
          display:block;
          margin:12px 0 25px;
          color:var(--navy);
          font-size:24px;
        }

        .mt-laptop-screen i{
          display:block;
          height:8px;
          margin-bottom:12px;
          border-radius:999px;
          background:#dbe7f3;
        }

        .mt-laptop-screen i.short{
          width:58%;
        }

        .mt-laptop-screen b{
          display:inline-flex;
          margin-top:17px;
          padding:7px 10px;
          border-radius:999px;
          color:#167e4c;
          background:#dff7eb;
          font-size:10px;
          letter-spacing:.05em;
        }

        .mt-laptop-base{
          width:116%;
          height:17px;
          margin-left:-8%;
          border-radius:0 0 25px 25px;
          background:linear-gradient(180deg,#cfd7df,#98a7b7);
        }

        .mt-ticket{
          position:absolute;
          left:42px;
          bottom:54px;
          width:52%;
          min-height:260px;
          padding:34px;
          transform:rotate(-4deg);
          border-radius:14px;
          background:#fff;
          box-shadow:0 24px 45px rgba(15,23,42,.18);
        }

        .mt-ticket:before{
          content:"";
          position:absolute;
          top:-19px;
          left:22px;
          width:64%;
          height:36px;
          border-radius:8px 8px 0 0;
          background:#d2a167;
          z-index:-1;
        }

        .mt-ticket small{
          color:#cc3b3b;
          font-weight:950;
          letter-spacing:.14em;
        }

        .mt-ticket strong{
          display:block;
          margin:13px 0 28px;
          color:var(--navy);
          font-size:22px;
          line-height:1.15;
        }

        .mt-ticket i{
          display:block;
          height:8px;
          margin-bottom:13px;
          border-radius:999px;
          background:#dbe7f3;
        }

        .mt-ticket i.short{
          width:60%;
        }

        .mt-ticket span{
          position:absolute;
          right:24px;
          bottom:23px;
          padding:8px 11px;
          transform:rotate(-6deg);
          border:2px solid var(--blue);
          border-radius:9px;
          color:var(--blue);
          font-size:11px;
          font-weight:950;
        }

        .mt-notebook{
          position:absolute;
          right:75px;
          bottom:36px;
          width:28%;
          height:112px;
          padding:22px;
          transform:rotate(8deg);
          border-radius:8px;
          background:#f7dd72;
          box-shadow:0 16px 26px rgba(15,23,42,.14);
        }

        .mt-notebook i{
          display:block;
          height:6px;
          margin-bottom:11px;
          border-radius:999px;
          background:rgba(91,76,20,.28);
        }

        .mt-cup{
          position:absolute;
          top:38px;
          left:42px;
          display:grid;
          width:74px;
          height:74px;
          place-items:center;
          border-radius:50%;
          background:#fff;
          box-shadow:0 14px 24px rgba(15,23,42,.13);
          font-size:31px;
        }

        .mt-upload-band{
          padding:36px 0;
          border-top:1px solid var(--line);
          border-bottom:1px solid var(--line);
          background:rgba(255,255,255,.88);
        }

        .mt-upload-card{
          display:grid;
          grid-template-columns:1.05fr .95fr;
          gap:32px;
          align-items:center;
          padding:30px;
          border:1px solid var(--line);
          border-radius:26px;
          background:#fff;
          box-shadow:0 18px 50px rgba(15,23,42,.08);
        }

        .mt-upload-copy h2{
          margin:0;
          color:var(--navy);
          font-size:clamp(29px,3.2vw,42px);
          line-height:1.06;
          letter-spacing:-.035em;
        }

        .mt-upload-copy p{
          margin:15px 0 0;
          color:var(--muted);
          font-size:17px;
          line-height:1.62;
        }

        .mt-upload-box{
          padding:22px;
          border:1px solid #cfe0f3;
          border-radius:20px;
          background:#f7fbff;
        }

        .mt-file-label{
          min-height:58px;
          display:flex;
          align-items:center;
          justify-content:center;
          padding:14px 18px;
          border:2px dashed #8eb8e8;
          border-radius:15px;
          color:var(--navy);
          background:#fff;
          font-weight:900;
          text-align:center;
          cursor:pointer;
        }

        .mt-file-label input{
          display:none;
        }

        .mt-file-name{
          margin:12px 0 0;
          color:#506179;
          font-size:13px;
          line-height:1.45;
          word-break:break-word;
        }

        .mt-upload-box .mt-primary{
          width:100%;
          margin-top:15px;
        }

        .mt-message{
          margin:13px 0 0;
          padding:11px 12px;
          border-radius:11px;
          color:#334155;
          background:#eaf3ff;
          font-size:13px;
          line-height:1.45;
        }

        .mt-story{
          padding:94px 0;
        }

        .mt-section-head{
          max-width:780px;
          margin:0 auto 42px;
          text-align:center;
        }

        .mt-section-head span{
          color:var(--blue);
          font-size:13px;
          font-weight:950;
          letter-spacing:.14em;
          text-transform:uppercase;
        }

        .mt-section-head h2{
          margin:12px 0 14px;
          color:var(--navy);
          font-size:clamp(36px,5vw,58px);
          line-height:1.04;
          letter-spacing:-.045em;
        }

        .mt-section-head p{
          margin:0;
          color:var(--muted);
          font-size:18px;
          line-height:1.65;
        }

        .mt-review-grid{
          display:grid;
          grid-template-columns:repeat(4,minmax(0,1fr));
          gap:17px;
        }

        .mt-review-card{
          min-height:245px;
          padding:25px 22px;
          border:1px solid var(--line);
          border-radius:21px;
          background:#fff;
          box-shadow:0 16px 40px rgba(15,23,42,.07);
        }

        .mt-review-card em{
          display:grid;
          width:50px;
          height:50px;
          place-items:center;
          margin-bottom:18px;
          border-radius:15px;
          background:var(--soft);
          font-style:normal;
          font-size:25px;
        }

        .mt-review-card h3{
          margin:0 0 10px;
          color:var(--navy);
          font-size:21px;
        }

        .mt-review-card p{
          margin:0;
          color:var(--muted);
          line-height:1.57;
        }

        .mt-result-band{
          padding:86px 0;
          color:#fff;
          background:var(--navy);
        }

        .mt-result-grid{
          display:grid;
          grid-template-columns:.86fr 1.14fr;
          gap:56px;
          align-items:center;
        }

        .mt-result-copy span{
          color:#8cc2ff;
          font-size:13px;
          font-weight:950;
          letter-spacing:.14em;
          text-transform:uppercase;
        }

        .mt-result-copy h2{
          margin:13px 0 17px;
          font-size:clamp(37px,4.8vw,58px);
          line-height:1.03;
          letter-spacing:-.045em;
        }

        .mt-result-copy p{
          margin:0;
          color:rgba(255,255,255,.72);
          font-size:18px;
          line-height:1.66;
        }

        .mt-result-list{
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:14px;
        }

        .mt-result-item{
          display:flex;
          gap:12px;
          align-items:flex-start;
          min-height:116px;
          padding:20px;
          border:1px solid rgba(255,255,255,.12);
          border-radius:18px;
          background:rgba(255,255,255,.07);
          font-weight:850;
          line-height:1.45;
        }

        .mt-result-item b{
          display:grid;
          flex:0 0 auto;
          width:30px;
          height:30px;
          place-items:center;
          border-radius:10px;
          color:#fff;
          background:var(--green);
        }

        .mt-price{
          padding:94px 0;
        }

        .mt-price-card{
          display:grid;
          grid-template-columns:1fr .7fr;
          gap:38px;
          align-items:center;
          max-width:980px;
          margin:0 auto;
          padding:42px;
          border:1px solid #bfdbfe;
          border-radius:30px;
          background:#fff;
          box-shadow:0 24px 60px rgba(15,23,42,.10);
        }

        .mt-price-label{
          color:var(--blue);
          font-size:13px;
          font-weight:950;
          letter-spacing:.13em;
          text-transform:uppercase;
        }

        .mt-price-card h2{
          margin:13px 0 18px;
          color:var(--navy);
          font-size:clamp(34px,4.4vw,52px);
          line-height:1.04;
          letter-spacing:-.04em;
        }

        .mt-price-list{
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:12px;
          margin-top:25px;
        }

        .mt-price-list div{
          display:flex;
          gap:9px;
          align-items:flex-start;
          color:#41536a;
          font-weight:800;
        }

        .mt-price-list b{
          color:var(--green);
        }

        .mt-price-side{
          padding:28px;
          border-radius:23px;
          background:#f1f7ff;
          text-align:center;
        }

        .mt-price-value{
          display:block;
          color:var(--navy);
          font-size:64px;
          line-height:1;
          font-weight:950;
          letter-spacing:-.06em;
        }

        .mt-price-side small{
          display:block;
          margin:10px 0 19px;
          color:var(--muted);
          font-weight:800;
        }

        .mt-price-side .mt-primary{
          width:100%;
        }

        .mt-discount{
          max-width:980px;
          margin:20px auto 0;
          padding:20px 23px;
          border-left:4px solid var(--blue);
          border-radius:0 16px 16px 0;
          color:#314a68;
          background:var(--soft);
          font-size:16px;
          line-height:1.58;
        }

        .mt-discount strong{
          color:var(--navy);
        }

        .mt-faq{
          padding:84px 0;
          background:#f7faff;
        }

        .mt-faq-list{
          max-width:900px;
          margin:0 auto;
          display:grid;
          gap:13px;
        }

        .mt-faq details{
          padding:20px 22px;
          border:1px solid var(--line);
          border-radius:17px;
          background:#fff;
        }

        .mt-faq summary{
          cursor:pointer;
          color:var(--navy);
          font-size:18px;
          font-weight:900;
        }

        .mt-faq details p{
          margin:14px 0 0;
          color:var(--muted);
          line-height:1.62;
        }

        .mt-continue{
          padding:70px 0;
        }

        .mt-continue-card{
          max-width:900px;
          margin:0 auto;
          padding:34px;
          border:1px solid var(--line);
          border-radius:25px;
          background:#fff;
          text-align:center;
          box-shadow:0 18px 50px rgba(15,23,42,.07);
        }

        .mt-continue-card h2{
          margin:0;
          color:var(--navy);
          font-size:31px;
        }

        .mt-continue-card p{
          margin:13px auto 20px;
          color:var(--muted);
          line-height:1.58;
        }

        .mt-continue-form{
          display:flex;
          gap:11px;
          max-width:650px;
          margin:0 auto;
        }

        .mt-continue-form input{
          min-width:0;
          flex:1;
          min-height:52px;
          padding:13px 15px;
          border:1px solid #cbd8e7;
          border-radius:13px;
          color:var(--ink);
          background:#fff;
          font:inherit;
        }

        .mt-final{
          padding:94px 0 105px;
          text-align:center;
        }

        .mt-final h2{
          max-width:850px;
          margin:0 auto;
          color:var(--navy);
          font-size:clamp(40px,5vw,66px);
          line-height:1.02;
          letter-spacing:-.05em;
        }

        .mt-final p{
          max-width:700px;
          margin:22px auto 0;
          color:var(--muted);
          font-size:18px;
          line-height:1.65;
        }

        .mt-final .mt-primary{
          margin-top:28px;
        }

        @media(max-width:980px){
          .mt-hero-grid,
          .mt-upload-card,
          .mt-result-grid,
          .mt-price-card{
            grid-template-columns:1fr;
          }

          .mt-hero-grid{
            gap:38px;
          }

          .mt-review-grid{
            grid-template-columns:1fr 1fr;
          }

          .mt-result-grid{
            gap:34px;
          }

          .mt-price-side{
            max-width:420px;
          }
        }

        @media(max-width:640px){
          .mt-container{
            width:min(100% - 28px,1180px);
          }

          .mt-hero{
            padding:48px 0;
          }

          .mt-hero h1{
            font-size:47px;
          }

          .mt-scene{
            min-height:390px;
            border-radius:24px;
          }

          .mt-laptop{
            top:95px;
            right:18px;
            width:55%;
          }

          .mt-laptop-screen{
            min-height:176px;
            padding:18px;
            border-width:7px;
          }

          .mt-laptop-screen strong{
            font-size:17px;
          }

          .mt-ticket{
            left:18px;
            bottom:36px;
            width:58%;
            min-height:205px;
            padding:24px;
          }

          .mt-ticket strong{
            font-size:17px;
          }

          .mt-notebook,
          .mt-cup{
            display:none;
          }

          .mt-upload-card{
            padding:22px;
          }

          .mt-story,
          .mt-price{
            padding:68px 0;
          }

          .mt-review-grid,
          .mt-result-list,
          .mt-price-list{
            grid-template-columns:1fr;
          }

          .mt-result-band,
          .mt-faq{
            padding:64px 0;
          }

          .mt-price-card{
            padding:27px;
            border-radius:23px;
          }

          .mt-price-value{
            font-size:56px;
          }

          .mt-continue-form{
            flex-direction:column;
          }

          .mt-final{
            padding:70px 0 80px;
          }

          .mt-final h2{
            font-size:42px;
          }
        }
      `}</style>

      <main className="mt-page">
        <section className="mt-hero">
          <div className="mt-container mt-hero-grid">
            <div>
              <span className="mt-kicker">Multas y vehículos</span>

              <h1>¿Has recibido una multa?</h1>

              <p className="mt-lead">
                Antes de tomar una decisión, realizamos una{" "}
                <strong>Revisión Inicial del Expediente</strong> para analizar la
                documentación, comprobar los plazos y ayudarte a valorar el
                siguiente paso.
              </p>

              <div className="mt-actions">
                <a className="mt-primary" href="#iniciar-revision">
                  Iniciar Revisión Inicial
                </a>

                <Link className="mt-secondary" to="/como-funciona">
                  Cómo trabajamos →
                </Link>
              </div>

              <div className="mt-trust">
                <span>Proceso claro</span>
                <span>Sin actuaciones posteriores automáticas</span>
                <span>La decisión es tuya</span>
              </div>
            </div>

            <HeroDocumentScene />
          </div>
        </section>

        <section className="mt-upload-band" id="iniciar-revision">
          <div className="mt-container">
            <div className="mt-upload-card">
              <div className="mt-upload-copy">
                <span className="mt-kicker">Primer paso</span>

                <h2>Sube la multa o notificación que has recibido.</h2>

                <p>
                  Puedes enviar una fotografía clara o un PDF. Prepararemos la
                  imagen automáticamente cuando sea necesario y crearemos tu
                  expediente para iniciar la revisión.
                </p>
              </div>

              <div className="mt-upload-box">
                <label className="mt-file-label">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
                    onChange={(event) =>
                      handleFileChange(event.target.files?.[0] || null)
                    }
                    disabled={preparing || loading}
                  />

                  {preparing
                    ? "Preparando documento…"
                    : file
                    ? "Cambiar documento"
                    : "Seleccionar multa o notificación"}
                </label>

                {file && (
                  <p className="mt-file-name">
                    <strong>{file.name}</strong>
                    {uploadInfo?.finalSize
                      ? ` · ${formatBytes(uploadInfo.finalSize)}`
                      : ""}
                  </p>
                )}

                <button
                  className="mt-primary"
                  type="button"
                  onClick={handleUpload}
                  disabled={preparing || loading || !file}
                >
                  {loading ? "Creando expediente…" : "Iniciar la revisión"}
                </button>

                {message && <p className="mt-message">{message}</p>}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-story">
          <div className="mt-container">
            <header className="mt-section-head">
              <span>Qué revisamos</span>
              <h2>Antes de actuar, revisamos lo importante.</h2>
              <p>
                Cada expediente parte de una situación distinta. Por eso no
                trabajamos con respuestas automáticas ni conclusiones estándar.
              </p>
            </header>

            <div className="mt-review-grid">
              {REVIEW_ITEMS.map((item) => (
                <article className="mt-review-card" key={item.title}>
                  <em aria-hidden="true">{item.icon}</em>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-result-band">
          <div className="mt-container mt-result-grid">
            <div className="mt-result-copy">
              <span>Al finalizar la revisión</span>
              <h2>Tendrás una visión clara de tu situación.</h2>
              <p>
                Nuestro trabajo no es decidir por ti. Es darte la información
                necesaria para que puedas decidir con mayor criterio y conocer
                previamente el posible siguiente paso.
              </p>
            </div>

            <div className="mt-result-list">
              {RESULT_ITEMS.map((item) => (
                <div className="mt-result-item" key={item}>
                  <b>✓</b>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-price">
          <div className="mt-container">
            <div className="mt-price-card">
              <div>
                <span className="mt-price-label">
                  Revisión Inicial del Expediente
                </span>

                <h2>Primero comprendemos la multa. Después, tú decides.</h2>

                <div className="mt-price-list">
                  <div>
                    <b>✓</b>
                    <span>Revisión documental</span>
                  </div>
                  <div>
                    <b>✓</b>
                    <span>Comprobación de plazos</span>
                  </div>
                  <div>
                    <b>✓</b>
                    <span>Análisis inicial</span>
                  </div>
                  <div>
                    <b>✓</b>
                    <span>Explicación del siguiente paso</span>
                  </div>
                </div>
              </div>

              <div className="mt-price-side">
                <strong className="mt-price-value">10 €</strong>
                <small>Revisión Inicial del Expediente</small>

                <a className="mt-primary" href="#iniciar-revision">
                  Iniciar revisión
                </a>
              </div>
            </div>

            <div className="mt-discount">
              <strong>Si decides continuar:</strong> el recurso administrativo
              de multa tiene una tarifa de 39 €. Los 10 € abonados por la
              Revisión Inicial se descuentan íntegramente, por lo que quedarían
              29 € pendientes.
            </div>
          </div>
        </section>

        <section className="mt-faq">
          <div className="mt-container">
            <header className="mt-section-head">
              <span>Preguntas frecuentes</span>
              <h2>Lo importante, explicado con claridad.</h2>
            </header>

            <div className="mt-faq-list">
              {FAQ_ITEMS.map((item) => (
                <details key={item.question}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-continue">
          <div className="mt-container">
            <div className="mt-continue-card">
              <h2>¿Ya tienes un expediente abierto?</h2>
              <p>
                Introduce el número de expediente administrativo o el código
                interno recibido para continuar desde el punto correspondiente.
              </p>

              <div className="mt-continue-form">
                <input
                  type="text"
                  value={caseId}
                  onChange={(event) => setCaseId(event.target.value)}
                  placeholder="Número o código de expediente"
                  aria-label="Número o código de expediente"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") continueCase();
                  }}
                />

                <button
                  className="mt-primary"
                  type="button"
                  onClick={continueCase}
                  disabled={loading}
                >
                  {loading ? "Consultando…" : "Continuar expediente"}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-final">
          <div className="mt-container">
            <h2>Una buena decisión empieza con una buena revisión.</h2>

            <p>
              Conocer tu situación antes de actuar puede ayudarte a tomar una
              decisión con mayor seguridad.
            </p>

            <a className="mt-primary" href="#iniciar-revision">
              Iniciar Revisión Inicial
            </a>
          </div>
        </section>
      </main>
    </>
  );
}
