import assert from "node:assert/strict";

import {
  OPS_CORE_CLIENT_VERSION,
  buildCoreActionRequest,
  normalizeReadiness,
  normalizeWorkspacePayload,
  validateCoreWorkspaceAction,
} from "../src/lib/opsCoreApi.js";

function expectThrows(fn, pattern) {
  assert.throws(fn, pattern);
}

assert.equal(OPS_CORE_CLIENT_VERSION, "rtm_ops_core_client_v1_3");

const rawReadiness = {
  ready: false,
  quote: {
    service_code: "administration",
    billing_code: "study_administration",
    amount_cents: 2500,
    currency: "eur",
  },
  blocking_issues: [
    {
      code: "authorization_signed_missing",
      message: "Falta la autorización firmada.",
      blocking: true,
    },
  ],
  warnings: [
    {
      code: "legacy_identity_gap",
      message: "Revisar la identidad de un expediente anterior.",
      blocking: false,
    },
  ],
};

const readiness = normalizeReadiness(rawReadiness);
assert.equal(readiness.ready, false);
assert.equal(readiness.quote.amount_eur, 25);
assert.equal(readiness.quote.code, "study_administration");
assert.equal(readiness.issues.length, 2);
assert.equal(readiness.issues[0].severity, "blocking");
assert.equal(readiness.issues[1].severity, "warning");
assert.equal(rawReadiness.quote.amount_eur, undefined, "La proyección no debe mutar el contrato recibido");

const rawWorkspace = {
  ok: true,
  workspace_version: "rtm_ops_workspace_v1_0",
  case_id: "case-1",
  readiness: rawReadiness,
  next_step: {
    stage: "validated_facts_pending",
    primary_action: "preview_reanalysis_facts",
    actions: [
      {
        code: "preview_reanalysis_facts",
        method: "GET",
        endpoint: "/ops/core/cases/case-1/reanalysis/facts-preview",
      },
    ],
  },
};

const workspace = normalizeWorkspacePayload(rawWorkspace);
assert.equal(workspace.workspace_version, "rtm_ops_workspace_v1_0");
assert.equal(workspace.readiness.quote.amount_eur, 25);
assert.equal(workspace.next_step.primary_action, "preview_reanalysis_facts");
assert.notEqual(workspace.readiness, rawWorkspace.readiness);

const readAction = validateCoreWorkspaceAction({
  code: "preview_reanalysis_facts",
  method: "GET",
  endpoint: "/ops/core/cases/case-1/reanalysis/facts-preview",
});
assert.deepEqual(readAction, {
  code: "preview_reanalysis_facts",
  endpoint: "/ops/core/cases/case-1/reanalysis/facts-preview",
  method: "GET",
  mutating: false,
  requiresReason: false,
});

const approve = buildCoreActionRequest({
  code: "approve_preview",
  method: "POST",
  endpoint: "/ops/core/cases/case-1/legal-previews/preview-1/approve",
});
assert.equal(approve.method, "POST");
assert.equal(approve.mutating, true);
assert.deepEqual(approve.body, {});

const invalidate = buildCoreActionRequest(
  {
    code: "invalidate_validated_facts",
    method: "POST",
    endpoint: "/ops/core/cases/case-1/validated-facts/facts-1/invalidate",
  },
  { reason: "La imagen original contradice la lectura guardada." },
);
assert.deepEqual(invalidate.body, {
  reason: "La imagen original contradice la lectura guardada.",
});

const draft = buildCoreActionRequest(
  {
    code: "create_validated_facts_draft",
    method: "POST",
    endpoint: "/ops/core/cases/case-1/reanalysis/facts-draft",
  },
  { supersedesId: "facts-old" },
);
assert.deepEqual(draft.body, { supersedes_id: "facts-old" });

expectThrows(
  () => buildCoreActionRequest({
    code: "approve_preview",
    method: "POST",
    endpoint: "/ops/core/cases/case-1/legal-previews/preview-1/freeze",
  }),
  /no corresponde a la acción CORE 'approve_preview'/,
);

expectThrows(
  () => validateCoreWorkspaceAction({
    code: "approve_preview",
    method: "GET",
    endpoint: "/ops/core/cases/case-1/legal-previews/preview-1/approve",
  }),
  /Método inesperado/,
);

expectThrows(
  () => validateCoreWorkspaceAction({
    code: "approve_preview",
    method: "POST",
    endpoint: "/ops/core/cases/case-1/../cases/other/legal-previews/preview-1/approve",
  }),
  /ruta OPS válida/,
);

expectThrows(
  () => validateCoreWorkspaceAction({
    code: "approve_preview",
    method: "POST",
    endpoint: "//attacker.invalid/ops/core/cases/case-1/legal-previews/preview-1/approve",
  }),
  /ruta OPS válida/,
);

expectThrows(
  () => validateCoreWorkspaceAction({
    code: "approve_preview",
    method: "POST",
    endpoint: "/ops/core/cases/case-1/legal-previews/preview-1/approve?force=true",
  }),
  /ruta OPS válida/,
);

expectThrows(
  () => validateCoreWorkspaceAction({
    code: "force_generate",
    method: "POST",
    endpoint: "/ops/cases/case-1/force-generate",
  }),
  /no está habilitada/,
);

expectThrows(
  () => buildCoreActionRequest({
    code: "invalidate_family_resolution",
    method: "POST",
    endpoint: "/ops/core/cases/case-1/family-resolutions/family-1/invalidate",
  }),
  /motivo de al menos 3 caracteres/,
);

expectThrows(
  () => validateCoreWorkspaceAction({
    code: "approve_resource_submission",
    method: "POST",
    endpoint: "/ops/cases/case-1/submit",
  }),
  /no corresponde a la acción CORE/,
);

console.log("RTM OPS workspace runtime contract: OK");
