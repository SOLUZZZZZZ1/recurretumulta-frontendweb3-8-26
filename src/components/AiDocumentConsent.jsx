export default function AiDocumentConsent({
  checked,
  onChange,
  disabled = false,
  id,
  documentLabel = "la documentación seleccionada",
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      style={{
        marginTop: 14,
        padding: 14,
        border: "1px solid #cbd5e1",
        borderRadius: 12,
        background: "#f8fafc",
        color: "#0f172a",
      }}
    >
      <div id={`${id}-title`} style={{ marginBottom: 9, fontWeight: 900 }}>
        Procesamiento documental con IA
      </div>

      <label
        htmlFor={id}
        style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: disabled ? "not-allowed" : "pointer" }}
      >
        <input
          id={id}
          name="ai_processing_consent"
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          style={{ width: 18, height: 18, marginTop: 2, flex: "0 0 auto" }}
        />
        <span style={{ fontSize: 14, lineHeight: 1.5 }}>
          Autorizo expresamente el procesamiento automatizado de {documentLabel},
          que puede implicar su envío a un proveedor externo de inteligencia artificial,
          para extraer y contrastar información del expediente.
        </span>
      </label>

      <p style={{ margin: "9px 0 0 28px", color: "#475569", fontSize: 12, lineHeight: 1.5 }}>
        La casilla está desmarcada por defecto. La IA no toma la decisión final:
        sus resultados quedan sujetos a revisión humana.
      </p>
    </section>
  );
}
