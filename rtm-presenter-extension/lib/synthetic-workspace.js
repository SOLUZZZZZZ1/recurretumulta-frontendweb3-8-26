function pdfEscape(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

export function buildSyntheticPdf(title) {
  const safeTitle = pdfEscape(
    String(title || "RTM SYNTHETIC").replace(/[^\x20-\x7e]/g, "")
  );
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

export const SYNTHETIC_PORTAL_FIELDS = Object.freeze([
  Object.freeze({
    order: 1,
    slotId: "fine",
    title: "Multa original solicitada por la sede",
    required: true,
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
    title: "Recurso solicitado por la sede",
    required: true,
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
    title: "Autorización solicitada por la sede",
    required: true,
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

export const SYNTHETIC_BRIDGE_IDENTITY = Object.freeze({
  caseId: "SYN-CASE-0001",
  containerId: "SYN-CONTAINER-0001",
  operatorId: "SYN-OPERATOR-LOCAL",
  sessionId: "SYN-SESSION-LOCAL-0001",
  profileId: "synthetic.municipal-portal.v1",
  adapterVersion: "mock-file-input-v1",
});

const SYNTHETIC_DOCUMENTS = Object.freeze([
  Object.freeze({
    documentId: "syn-doc-fine",
    title: "Multa original",
    purpose: "fine",
    version: 3,
    filename: "MULTA_ORIGINAL_SINTETICA_v3.pdf",
    compatibleSlots: Object.freeze(["fine"]),
    documentTitle: "MULTA ORIGINAL SINTETICA VERSION 3",
  }),
  Object.freeze({
    documentId: "syn-doc-appeal",
    title: "Recurso revisado",
    purpose: "appeal",
    version: 7,
    filename: "RECURSO_REVISADO_SINTETICO_v7.pdf",
    compatibleSlots: Object.freeze(["appeal"]),
    documentTitle: "RECURSO REVISADO SINTETICO VERSION 7",
  }),
  Object.freeze({
    documentId: "syn-doc-authorization",
    title: "Autorización de representación",
    purpose: "authorization",
    version: 2,
    filename: "AUTORIZACION_SINTETICA_v2.pdf",
    compatibleSlots: Object.freeze(["authorization"]),
    documentTitle: "AUTORIZACION SINTETICA VERSION 2",
  }),
  Object.freeze({
    documentId: "syn-doc-identity",
    title: "Documento de identidad",
    purpose: "identity",
    version: 4,
    filename: "IDENTIDAD_SINTETICA_v4.pdf",
    compatibleSlots: Object.freeze([]),
    documentTitle: "IDENTIDAD SINTETICA VERSION 4",
  }),
]);

export function syntheticPortalField(slotId) {
  const field = SYNTHETIC_PORTAL_FIELDS.find((candidate) => candidate.slotId === slotId);
  return field
    ? { ...field, fingerprint: { ...field.fingerprint } }
    : null;
}

export function syntheticWorkspaceDefinition(targetOrigin) {
  return {
    environment: "staging",
    syntheticOnly: true,
    legalEffect: false,
    remoteBridgeEnabled: false,
    ...SYNTHETIC_BRIDGE_IDENTITY,
    targetOrigin,
    portalName: "Portal municipal sintético local",
    portalFields: SYNTHETIC_PORTAL_FIELDS.map((field) => ({
      ...field,
      fingerprint: { ...field.fingerprint },
    })),
    documents: SYNTHETIC_DOCUMENTS.map((document) => ({
      ...document,
      compatibleSlots: [...document.compatibleSlots],
      loadBytes: () => buildSyntheticPdf(document.documentTitle),
    })),
  };
}
