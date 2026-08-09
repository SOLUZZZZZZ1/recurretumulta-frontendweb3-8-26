import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireContains(text, marker, label) {
  if (!text.includes(marker)) {
    throw new Error(`Falta ${label}: ${marker}`);
  }
}

function requireAbsent(text, marker, label) {
  if (text.includes(marker)) {
    throw new Error(`Se ha reintroducido ${label}: ${marker}`);
  }
}

const app = read("src/App.jsx");
const workspace = read("src/pages/OpsCoreWorkspace.jsx");
const client = read("src/lib/opsCoreApi.js");

requireContains(app, 'import OpsCoreWorkspace from "./pages/OpsCoreWorkspace.jsx"', "la ficha CORE montada");
for (const route of [
  "/ops/case/:caseId",
  "/ops/review/:caseId",
  "/ops/case/:caseId/review",
  "/ops/pro/:caseId",
]) {
  requireContains(app, `path="${route}" element={<OpsCoreWorkspace />}`, `la ruta protegida ${route}`);
}

requireAbsent(app, "OpsCaseDetailPro", "el panel PRO legacy montado");
requireAbsent(app, "OpsCaseDetail from", "la ficha legacy montada");

requireContains(workspace, "loadCoreWorkspace", "el consumo de workspace autoritativo");
requireContains(workspace, "workspace?.next_step", "la acción siguiente decidida por backend");
requireContains(workspace, "ValidatedFacts", "la explicación de hechos validados");
requireContains(workspace, "Previa Jurídica", "la sección de Previa Jurídica");
requireContains(workspace, "Generate solo transforma", "el límite de Generate");
requireContains(workspace, "Esta actuación se realiza fuera del automatismo CORE", "la separación de actuaciones externas");

for (const forbidden of [
  "/ai/expediente/run",
  "save-ai-overrides",
  "override-family",
  "rewrite-hecho",
  "/generate/dgt",
  "/ops/cases/${encodeURIComponent(caseId)}/submit",
  "submitForce",
  "FAMILY_OPTIONS",
  "familiaEdit",
  "hechoEdit",
  "force-generate",
  "lab-force-paid",
  "lab-force-authorize",
]) {
  requireAbsent(workspace, forbidden, "una autoridad legacy en la ficha CORE");
  requireAbsent(client, forbidden, "una autoridad legacy en el cliente CORE");
}

requireContains(client, "/ops/core/cases/", "el endpoint único del workspace");
requireContains(client, "MUTATING_ACTIONS", "la lista cerrada de mutaciones");
requireContains(client, "READ_ONLY_ACTIONS", "la lista cerrada de lecturas");
requireContains(client, "ACTIONS_WITH_REASON", "el control de motivos obligatorios");

console.log("RTM OPS CORE UI containment: OK");
