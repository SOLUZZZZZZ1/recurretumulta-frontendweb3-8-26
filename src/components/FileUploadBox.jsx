import { useState } from "react";
import { fileSizeError } from "../lib/clientFiles.js";

export default function FileUploadBox({ label, file, inputRef, onChange, accept = "image/*,application/pdf", disabled = false }) {
  const [error, setError] = useState("");
  function selectFile(event) {
    const selected = event.target.files?.[0];
    if (selected) {
      const problem = fileSizeError(selected);
      setError(problem);
      if (!problem) onChange(selected);
    }
    event.target.value = "";
  }

  return (
    <div style={{ minWidth: 0 }}>
      <span style={{ display: "block", marginBottom: 7, fontWeight: 850, color: "#0f172a" }}>{label}</span>
      <button
        type="button"
        aria-label={`${label}: ${file ? file.name : "Seleccionar archivo"}`}
        onClick={() => !disabled && inputRef.current?.click()}
        disabled={disabled}
        style={{ width: "100%", minHeight: 118, padding: 16, border: "2px dashed #cbd5e1", borderRadius: 16, background: file ? "#f0fdf4" : "#f8fafc", cursor: disabled ? "not-allowed" : "pointer", overflowWrap: "anywhere" }}
      >
        <div aria-hidden="true" style={{ fontSize: 30 }}>{file ? "✅" : "📷"}</div>
        <strong>{file ? file.name : "Seleccionar archivo"}</strong>
        {file && <div style={{ color: "#64748b", fontSize: 13 }}>{file.size < 1024 * 1024 ? `${Math.ceil(file.size / 1024)} KB` : `${(file.size / (1024 * 1024)).toFixed(2)} MB`}</div>}
      </button>
      <input ref={inputRef} aria-label={label} type="file" accept={accept} onChange={selectFile} style={{ display: "none" }} disabled={disabled} />
      <small style={{ display: "block", marginTop: 7, color: "#475569" }}>Imagen o PDF · máximo 12 MB</small>
      {error && <p role="alert" style={{ color: "#991b1b", marginTop: 8 }}>{error}{file ? " Se conserva el archivo anterior." : ""}</p>}
    </div>
  );
}
