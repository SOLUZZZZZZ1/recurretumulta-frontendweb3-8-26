(() => {
  "use strict";

  const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
  const count = document.querySelector("#local-count");
  const validationResult = document.querySelector("#validation-result");

  function update() {
    const attached = inputs.filter((input) => input.files?.length === 1).length;
    count.textContent = `${attached}/${inputs.length}`;
    for (const input of inputs) {
      const output = document.querySelector(`[data-output-for="${input.id}"]`);
      output.textContent = input.files?.[0]?.name || "Ningún archivo";
    }
  }

  for (const input of inputs) {
    input.addEventListener("change", update);
  }

  document.querySelector("#validate-only").addEventListener("click", () => {
    const complete = inputs.every(
      (input) =>
        input.files?.length === 1 &&
        input.files[0].type === "application/pdf" &&
        input.files[0].name.toLowerCase().endsWith(".pdf")
    );
    validationResult.textContent = complete
      ? "Validación local completa. No se ha registrado ni enviado nada."
      : "Faltan archivos PDF. No se ha registrado ni enviado nada.";
  });

  update();
})();
