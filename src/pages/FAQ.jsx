import React from "react";

export default function FAQ() {
  return (
    <div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto" }}>
      <h1>Preguntas frecuentes</h1>

      <h3 style={{ marginTop: "30px" }}>
        ¿Todas las multas se pueden recurrir?
      </h3>
      <p>
        No todas, pero muchas sí. Analizamos cada caso para detectar errores o
        puntos de defensa.
      </p>

      <h3>¿Cuánto tarda el análisis?</h3>
      <p>En pocos minutos tendrás una evaluación inicial del caso.</p>

      <h3>¿Qué pasa si el recurso no prospera?</h3>
      <p>
        No podemos garantizar el resultado, pero sí que el recurso estará
        fundamentado con criterios técnicos y jurídicos sólidos.
      </p>

      <h3>¿Tengo que hacer algo?</h3>
      <p>Puedes hacerlo tú mismo o dejar que nos encarguemos de todo.</p>

      <h3>¿Es legal que presentéis el recurso por mí?</h3>
      <p>Sí, siempre con tu autorización previa firmada.</p>
    </div>
  );
}
