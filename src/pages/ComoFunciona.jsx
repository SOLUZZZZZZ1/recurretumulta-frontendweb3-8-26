import React from "react";

export default function ComoFunciona() {
  return (
    <div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto" }}>
      
      <h1>Cómo funciona</h1>

      <ol style={{ marginTop: "20px", lineHeight: "2" }}>
        <li>
          <strong>Subes tu multa</strong><br />
          Analizamos automáticamente el expediente.
        </li>

        <li>
          <strong>Evaluamos el caso</strong><br />
          Te indicamos si es viable recurrirla.
        </li>

        <li>
          <strong>Eliges cómo continuar</strong><br />
          No presentar recurso o dejar que lo presentemos por ti.
        </li>
      </ol>

      <div
        style={{
          marginTop: "30px",
          background: "#fffbeb",
          border: "1px solid #f59e0b",
          borderRadius: "14px",
          padding: "16px",
          color: "#92400e",
          lineHeight: "1.7",
        }}
      >
        <div style={{ fontWeight: "900", marginBottom: "10px" }}>
          ⚠ IMPORTANTE
        </div>

        <p style={{ margin: 0 }}>
          En la mayoría de multas de tráfico, si decides presentar alegaciones o recursos administrativos perderás el derecho al descuento del 50% por pronto pago.
        </p>

        <p style={{ marginTop: "10px", marginBottom: 0 }}>
          Si pagas la multa con reducción, normalmente renuncias a continuar el procedimiento administrativo de recurso.
        </p>
      </div>



      <h2 style={{ marginTop: "40px" }}>Tú decides</h2>

      <p>
        Puedes dejarlo en nuestras manos.
        Nos encargamos de todo el proceso para que no tengas que preocuparte de nada.
      </p>

    </div>
  );
}