function pdfEscape(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

export function buildSyntheticPdf(title) {
  const safeTitle = pdfEscape(String(title || "RTM SYNTHETIC").replace(/[^\x20-\x7e]/g, ""));
  const stream = `BT /F1 12 Tf 72 720 Td (${safeTitle}) Tj 0 -22 Td (SIN EFECTO JURIDICO) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let output = "%PDF-1.4\n%RTM-SYNTHETIC-ONLY\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(output.length);
    output += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = output.length;
  output += `xref\n0 ${objects.length + 1}\n`;
  output += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    output += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  output += `startxref\n${xrefOffset}\n%%EOF\n`;
  return new TextEncoder().encode(output);
}

const FIELD_DEFINITIONS = Object.freeze([
  Object.freeze({
    order: 1,
    slotId: "fine",
    title: "Multa original",
    required: true,
    filename: "01_MULTA_SINTETICA.pdf",
    documentTitle: "MULTA SINTETICA",
    selector: 'input[type="file"][data-rtm-slot="fine"]',
    fingerprint: Object.freeze({
      tagName: "INPUT",
      type: "file",
      id: "fine-file",
      name: "fine_document",
      accept: "application/pdf",
      multiple: false,
      slot: "fine",
      labelText: "Añadir multa",
    }),
  }),
  Object.freeze({
    order: 2,
    slotId: "appeal",
    title: "Recurso revisado",
    required: true,
    filename: "02_RECURSO_SINTETICO.pdf",
    documentTitle: "RECURSO SINTETICO REVISADO",
    selector: 'input[type="file"][data-rtm-slot="appeal"]',
    fingerprint: Object.freeze({
      tagName: "INPUT",
      type: "file",
      id: "appeal-file",
      name: "appeal_document",
      accept: "application/pdf",
      multiple: false,
      slot: "appeal",
      labelText: "Añadir recurso",
    }),
  }),
  Object.freeze({
    order: 3,
    slotId: "authorization",
    title: "Autorización de representación",
    required: true,
    filename: "03_AUTORIZACION_SINTETICA.pdf",
    documentTitle: "AUTORIZACION SINTETICA",
    selector: 'input[type="file"][data-rtm-slot="authorization"]',
    fingerprint: Object.freeze({
      tagName: "INPUT",
      type: "file",
      id: "authorization-file",
      name: "authorization_document",
      accept: "application/pdf",
      multiple: false,
      slot: "authorization",
      labelText: "Añadir autorización",
    }),
  }),
]);

export function syntheticPackageDefinition(targetOrigin) {
  return {
    environment: "staging",
    syntheticOnly: true,
    legalEffect: false,
    caseId: "SYN-CASE-0001",
    packageId: "SYN-PKG-0001",
    targetOrigin,
    portalName: "Portal municipal sintético local",
    fields: FIELD_DEFINITIONS.map((field) => ({
      ...field,
      fingerprint: { ...field.fingerprint },
      bytes: buildSyntheticPdf(field.documentTitle),
    })),
  };
}
