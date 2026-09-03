import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("server-provided navigation crosses an explicit trust boundary", async () => {
  const flows = await Promise.all([
    read("src/pages/ResumenExpediente.jsx"),
    read("src/pages/EliminarCoche.jsx"),
  ]);

  for (const source of flows) {
    assert.match(source, /requireStripeCheckoutUrl\(/);
    assert.doesNotMatch(source, /window\.location\.href\s*=/);
  }

  const intake = await read("src/pages/IniciarExpedienteRTM.jsx");
  assert.match(intake, /safeInternalPath\(data\?\.next_path/);

  const partnerIntake = await read("src/pages/PartnerAltaExpediente.jsx");
  assert.match(partnerIntake, /safeInternalPath\(result\?\.resume_url/);
});

test("legacy room sheet never accepts an arbitrary absolute URL", async () => {
  const [source, access, config] = await Promise.all([
    read("src/pages/Habitacion.jsx"),
    read("src/lib/roomAccess.js"),
    read("vercel.json"),
  ]);
  assert.match(source, /fetchRoomRecord\(roomId/);
  assert.match(source, /fetchRoomSheet\(/);
  assert.match(source, /normalizeRoomId\(id\)/);
  assert.doesNotMatch(source, /backend-spainroom|VITE_ROOMS_BASE/);
  assert.doesNotMatch(source, /href=\{(?:safe)?Sheet/);
  assert.match(access, /credentials:\s*"omit"/);
  assert.match(access, /mode:\s*"cors"/);
  assert.match(access, /safeRoomSheetUrl/);
  assert.match(access, /https:\/\/backend-spainroom\.onrender\.com/);
  assert.doesNotMatch(access, /VITE_ROOMS_BASE/);

  const rewrites = JSON.parse(config).rewrites;
  assert.equal(
    rewrites.some(({ source, destination }) =>
      /rooms-(?:api|instance)|backend-spainroom/.test(`${source} ${destination}`)
    ),
    false
  );
});

test("generic final checkout is retired until a server-approved quote exists", async () => {
  const [component, billing] = await Promise.all([
    read("src/components/PagarPresentar.jsx"),
    read("src/lib/apiBilling.js"),
  ]);
  assert.doesNotMatch(component, /payment_stage:\s*["']final["']/);
  assert.doesNotMatch(component, /\/billing\/checkout/);
  assert.match(component, /cotización aprobada/);
  assert.match(component, /authorization_evidence_status === "verified"/);
  assert.match(component, /signed_authority_verified === true/);
  assert.doesNotMatch(component, /msg\.includes\(|authorization_signed \|\|/);
  assert.doesNotMatch(billing, /apiFetch|\/billing\/checkout|payment_stage/);
  assert.match(billing, /cotización aprobada/);
});

test("review checkout renders and accepts only the exact server quote", async () => {
  const source = await read("src/pages/ResumenExpediente.jsx");
  assert.match(source, /\/billing\/review-context\/\$\{encodeURIComponent\(caseId\)\}/);
  assert.match(source, /parseReviewCheckoutContext\(contextPayload, caseId\)/);
  assert.match(source, /sameReviewQuote\(reviewContext\.quote, latestContext\.quote\)/);
  assert.match(source, /parseReviewCheckoutEnvelope\(/);
  assert.match(source, /formatReviewQuote\(reviewQuote\)/);
  assert.doesNotMatch(source, /amount:\s*(?:10|25)|getReviewInfo/);
});

test("public pages do not publish duplicated transactional prices", async () => {
  const paths = [
    "src/pages/Precios.jsx",
    "src/pages/Multas.jsx",
    "src/pages/MorosidadHome.jsx",
    "src/pages/AdministracionHome.jsx",
    "src/pages/FAQ.jsx",
    "src/FAQ.jsx",
  ];
  const sources = await Promise.all(paths.map(read));
  for (const [index, source] of sources.entries()) {
    assert.doesNotMatch(source, /\b(?:10|25|29|39)\s*€/, paths[index]);
  }
  assert.match(sources[0], /Cotización en tu expediente/);
});

test("document and payment copy never invents authorization or payment evidence", async () => {
  const documentPaths = [
    "src/pages/AdministracionDocumentos.jsx",
    "src/pages/DeudasDocumentos.jsx",
    "src/pages/DocumentosCore.jsx",
    "src/pages/MultasDocumentos.jsx",
    "src/pages/OtrosDocumentos.jsx",
    "src/pages/ReclamacionesDocumentos.jsx",
  ];
  const sources = await Promise.all(documentPaths.map(read));
  for (const [index, source] of sources.entries()) {
    assert.doesNotMatch(source, /Autorización firmada recibida/, documentPaths[index]);
    assert.match(source, /Autorización: pendiente de comprobación/);
  }
  const payment = await read("src/pages/PagoOk.jsx");
  assert.match(payment, /=== "paid"/);
  assert.doesNotMatch(payment, /v === "succeeded"|Pago recibido/);
});

test("partner case creation UI is visibly closed while its contract is retired", async () => {
  const source = await read("src/pages/Gestorias.jsx");
  assert.match(source, /Alta de expedientes temporalmente no disponible/);
  assert.match(source, /Esta pantalla no enviará datos ni archivos/);
  assert.doesNotMatch(source, />\s*Descargar autorización\s*</);
  assert.doesNotMatch(source, />\s*Enviar expediente\s*</);
});

test("partner web uses cookie-only auth and never accepts or sends a bearer", async () => {
  const sources = await Promise.all([
    read("src/pages/Gestorias.jsx"),
    read("src/pages/PartnerPanelExpedientes.jsx"),
    read("src/pages/PartnerUpload.jsx"),
    read("src/pages/PartnerChangePassword.jsx"),
    read("src/pages/PartnerAltaExpediente.jsx"),
    read("src/pages/SolicitarAltaGestoria.jsx"),
  ]);

  for (const source of sources) {
    assert.doesNotMatch(source, /partner_token|Authorization\s*:|Bearer\s+\$?\{/i);
  }

  const [api, session] = await Promise.all([
    read("src/lib/partnerApi.js"),
    read("src/lib/partnerSession.js"),
  ]);
  assert.match(api, /credentials:\s*["']same-origin["']/);
  assert.match(api, /X-CSRF-Token/);
  assert.match(api, /__Host-rtm_partner_csrf/);
  assert.match(api, /no admite credenciales Bearer/);
  assert.doesNotMatch(
    session.match(/PARTNER_SESSION_KEYS[\s\S]*?\]\);/)?.[0] || "",
    /partner_token/
  );

  const panel = sources[1];
  assert.match(panel, /partnerSessionRemainingMs\(\)/);
  assert.match(panel, /bindPartnerViewLifecycle\(window, document/);
  assert.match(panel, /invalidateSensitiveView/);
  assert.match(panel, /hideUntilVerified: true/);
  assert.match(panel, /params\.set\("limit", String\(PARTNER_CASE_PAGE_LIMIT\)\)/);
  assert.match(panel, /parsePartnerCasesEnvelope\(data\)/);
  assert.match(panel, /readJsonResponseLimited/);
  assert.match(panel, /bindPartnerCookieSession\(csrfBefore\)/);
  assert.match(panel, /bindPartnerCrossTabSession\(window, endExpiredSession\)/);
  assert.match(panel, /params\.set\("cursor", cursor\)/);
  assert.match(panel, /loadNextPage/);
  assert.match(panel, /loadPreviousPage/);
  assert.match(panel, /En esta página/);
  assert.match(panel, /async function logout\(\) \{\s*invalidateSensitiveView\(\)/);

  const portal = sources[0];
  assert.match(portal, /\/partner\/session/);
  assert.doesNotMatch(portal, /__rtm_session_probe/);
  assert.match(portal, /parsePartnerSessionEnvelope/);
  assert.match(portal, /parsePartnerLoginEnvelope/);
  assert.match(portal, /bindPartnerCookieSession\(\)/);
  assert.match(portal, /bindPartnerCrossTabSession\(window/);
  assert.match(portal, /announcePartnerSessionChange\(\)/);

  const passwordChange = sources[3];
  assert.match(passwordChange, /bindPartnerViewLifecycle\(window, document/);
  assert.match(passwordChange, /sensitiveRootRef\.current\?\.setAttribute\("hidden", ""\)/);
  assert.match(passwordChange, /requestAbortRef\.current\?\.abort\(\)/);
  assert.match(passwordChange, /navigationTimerRef\.current/);
  assert.match(passwordChange, /ref=\{oldPasswordInputRef\}/);
  assert.match(passwordChange, /ref=\{newPasswordInputRef\}/);
  assert.match(passwordChange, /ref=\{confirmPasswordInputRef\}/);
  assert.match(passwordChange, /hidden=\{!viewVisible\}/);
});

test("partner PII view invalidates on hide and revalidates after restoration", async () => {
  const { bindPartnerViewLifecycle } = await import(
    "../src/lib/partnerViewLifecycle.js"
  );
  const windowListeners = new Map();
  const documentListeners = new Map();
  const browserWindow = {
    addEventListener: (type, fn) => windowListeners.set(type, fn),
    removeEventListener: (type) => windowListeners.delete(type),
  };
  const browserDocument = {
    visibilityState: "visible",
    addEventListener: (type, fn) => documentListeners.set(type, fn),
    removeEventListener: (type) => documentListeners.delete(type),
  };
  const events = [];
  const unbind = bindPartnerViewLifecycle(browserWindow, browserDocument, {
    invalidate: (reason) => events.push(["invalidate", reason]),
    revalidate: (reason) => events.push(["revalidate", reason]),
  });

  browserDocument.visibilityState = "hidden";
  documentListeners.get("visibilitychange")();
  windowListeners.get("pagehide")();
  windowListeners.get("pageshow")({ persisted: false });
  windowListeners.get("pageshow")({ persisted: true });
  windowListeners.get("focus")();
  browserDocument.visibilityState = "visible";
  documentListeners.get("visibilitychange")();

  assert.deepEqual(events, [
    ["invalidate", "hidden"],
    ["invalidate", "pagehide"],
    ["revalidate", "pageshow-persisted"],
    ["revalidate", "focus"],
    ["revalidate", "visible"],
  ]);
  unbind();
  assert.equal(windowListeners.size, 0);
  assert.equal(documentListeners.size, 0);
});

test("legacy shared-secret partner administration is absent", async () => {
  const app = await read("src/App.jsx");
  assert.doesNotMatch(app, /AdminCrearAsesoria|\/admin\/crear-asesoria|x-admin-token/i);
});

test("direct dependencies use immutable version declarations", async () => {
  const packageJson = JSON.parse(await read("package.json"));
  for (const section of [packageJson.dependencies, packageJson.devDependencies]) {
    for (const [name, version] of Object.entries(section)) {
      assert.match(version, /^\d+\.\d+\.\d+$/, `${name}: ${version}`);
    }
  }
});

test("legacy partner upload is retired and consent never defaults to accepted", async () => {
  const [app, partnerUpload, activePartnerPortal] = await Promise.all([
    read("src/App.jsx"),
    read("src/pages/PartnerUpload.jsx"),
    read("src/pages/Gestorias.jsx"),
  ]);

  assert.doesNotMatch(app, /import PartnerUpload/);
  assert.match(
    app,
    /path="\/partner\/upload" element={<Navigate to="\/gestorias" replace \/>}/
  );
  assert.match(partnerUpload, /<Navigate to="\/gestorias" replace \/>/);
  assert.doesNotMatch(partnerUpload, /token|Authorization|Bearer/i);
  assert.match(activePartnerPortal, /const \[confirm, setConfirm\] = useState\(false\)/);
  assert.match(activePartnerPortal, /function updateSubmissionField/);
  assert.match(activePartnerPortal, /setFiles\(arr\);\s*setConfirm\(false\)/);
  for (const setter of [
    "setClientEmail",
    "setClientName",
    "setNombre",
    "setDni",
    "setDomicilio",
    "setLocalidad",
    "setNote",
  ]) {
    assert.match(activePartnerPortal, new RegExp(`${setter}\\(\"\"\\)`));
  }
  assert.match(activePartnerPortal, /bindPartnerViewLifecycle\(window, document/);
  assert.match(activePartnerPortal, /partnerSessionRemainingMs\(\)/);
  assert.match(activePartnerPortal, /authenticated && sessionValidated/);
  assert.match(activePartnerPortal, /submissionAbortRef\.current\?\.abort\(\)/);
  assert.match(activePartnerPortal, /sensitiveViewRef\.current\.hidden = true/);
  assert.match(activePartnerPortal, /hidden=\{!viewVisible\}/);
  assert.match(activePartnerPortal, /setPassword\(""\)/);
});

test("PII compatibility storage is purged and no flow writes global case data", async () => {
  const paths = [
    "src/components/UploadDocumento.jsx",
    "src/components/UploadExpediente.jsx",
    "src/components/ExtractedSummary.jsx",
    "src/pages/Multas.jsx",
    "src/pages/Autorizar.jsx",
    "src/pages/Deudas.jsx",
  ];
  const sources = await Promise.all(paths.map(read));
  for (const [index, source] of sources.entries()) {
    assert.doesNotMatch(source, /localStorage/, paths[index]);
    assert.doesNotMatch(source, /rtm_last_analysis|rtm_last_intake|rtm_client_/, paths[index]);
  }

  const [main, caseSession] = await Promise.all([
    read("src/main.jsx"),
    read("src/lib/caseSession.js"),
  ]);
  assert.match(main, /purgeLegacyCaseLocalStorage\(\)/);
  assert.match(main, /migratePartnerSession\(\)/);
  assert.match(caseSession, /rtm_case_data:v1:/);
  assert.match(caseSession, /sessionStorage/);
});

test("authorization UI is fail-closed across case changes and stale requests", async () => {
  const source = await read("src/pages/Autorizar.jsx");
  assert.match(source, /createCaseRequestGuard\(\)/);
  assert.match(source, /mutationAbortRef\.current\?\.abort\(\)/);
  assert.match(source, /currentCaseIdRef\.current !== targetCaseId/);
  assert.match(source, /caseStateIsCurrent \? form : EMPTY_AUTHORIZATION_FORM/);
  assert.match(source, /function invalidateGeneratedArtifact\(\)[\s\S]*?setGenerated\(false\)[\s\S]*?setAuthorizationBinding\(null\)[\s\S]*?setSignedFile\(null\)/);
  assert.match(source, /function resetAcceptanceAndGeneratedArtifact\(\)[\s\S]*?setChecks\(\{ autorizo_gestion: false, acepto_responsabilidad: false \}\)[\s\S]*?invalidateGeneratedArtifact\(\)/);
  assert.match(source, /setChecks\(\(prev\) => \(\{ \.\.\.prev, autorizo_gestion: value \}\)\)/);
  assert.match(source, /setChecks\(\(prev\) => \(\{ \.\.\.prev, acepto_responsabilidad: value \}\)\)/);
  assert.ok(
    (source.match(/invalidateGeneratedArtifact\(\)/g) || []).length >= 4,
    "fields and both consent checks must invalidate the issued artifact"
  );
  assert.match(source, /if \(!visibleGenerated\)/);
  assert.match(source, /appendAuthorizationDocumentBinding\(fd, visibleAuthorizationBinding\)/);
  assert.match(source, /parseAuthorizationCandidateEnvelope\(result, targetCaseId\)/);
  assert.match(source, /pendiente de revisión humana/);
  assert.doesNotMatch(source, /Ya puedes continuar con la gestión/);
  assert.doesNotMatch(source, /prev\.full_name|prev\.dni_nie|prev\.matricula/);
});

test("OPS never treats vehicle preparation consent or an unreviewed PDF as representation", async () => {
  const [queue, detail, detailPro] = await Promise.all([
    read("src/pages/OPSQueueSmart.jsx"),
    read("src/pages/OpsCaseDetail.jsx"),
    read("src/pages/OpsCaseDetailPro.jsx"),
  ]);

  assert.match(queue, /isLegalRepresentationVerified\(item\)/);
  assert.match(queue, /if \(isVehicleRemovalCase\(item\)\) return "MANUAL"/);
  assert.match(queue, /Revisión humana requerida/);
  assert.match(queue, /Consentimiento de preparación/);
  assert.doesNotMatch(queue, /ok=\{!!item\.authorized\}/);
  assert.doesNotMatch(queue, /function hasAuthorizationEvidence/);
  assert.match(queue, /vehicle_removal_completed/);
  assert.match(queue, /vehicle_removal_cancelled/);

  assert.match(detail, /const representationVerified = isLegalRepresentationVerified\(caseData\)/);
  assert.match(detail, /authorization: representationVerified/);
  assert.match(detail, /Candidato de autorización · pendiente de revisión/);
  assert.match(detail, /Candidato de autorización · rechazado/);
  assert.doesNotMatch(detail, /Boolean\(caseData\.authorized\)/);
  assert.doesNotMatch(detail, /caseData\.authorized\s*\?/);

  assert.match(detailPro, /const hasAutorizacion = isLegalRepresentationVerified\(caseRecord\)/);
  assert.match(detailPro, /kind === "authorization_signed_verified"/);
  assert.doesNotMatch(detailPro, /const hasAutorizacion = lowerKinds\.some/);
});

test("vehicle assignment requires a canonical consent snapshot and explicit human review", async () => {
  const source = await read("src/pages/OpsVehicleRemoval.jsx");
  assert.match(source, /item\?\.status !== "vehicle_removal_paid"/);
  assert.match(source, /item\?\.payment_status !== "paid"/);
  assert.match(source, /item\?\.vehicle_preparation_consent !== true/);
  assert.match(source, /canonicalVehicleAuthorizationSnapshot\(item\)/);
  assert.match(source, /human_review_attested: true/);
  assert.match(source, /authorization_version: authorization\.authorizationVersion/);
  assert.match(source, /authorization_sha256: authorization\.authorizationSha256/);
  assert.match(source, /Confirmo que he revisado íntegramente el expediente/);
  assert.match(source, /no acredita representación ni ejecuta la retirada/);
  assert.match(source, /disabled=\{!canManageLegacy \|\| mutationBusy \|\| !isReviewAttestedFor\(item\)\}/);
  assert.match(source, /item\.status === "vehicle_removal_assigned" && item\.payment_status === "paid"/);
  assert.doesNotMatch(source, /item\.status !== "vehicle_removal_completed"/);
});
