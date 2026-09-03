import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("vehicle verification binds its document and capability to the same case", async () => {
  const source = await read("src/pages/EliminarCoche.jsx");
  assert.match(source, /verificationForm\.append\("case_id", caseId\)/);
  assert.match(source, /verificationForm\.append\("plate", normalizedPlate\)/);
  assert.doesNotMatch(source, /verificationForm\.append\("(?:full_name|dni_nie|email|phone)"/);
  assert.match(
    source,
    /"\/vehicle-removal\/verify-registration",\s*\{ method: "POST", body: verificationForm, signal: controller\.signal \},\s*caseId/
  );
});

test("vehicle checkout uses required case access for the case in its JSON body", async () => {
  const source = await read("src/pages/EliminarCoche.jsx");
  assert.match(
    source,
    /requiredCaseAccessFetch\(\s*url,\s*requiredCaseId,\s*options\s*\)/
  );
  assert.match(
    source,
    /"\/vehicle-removal\/create-checkout-session"[\s\S]*?body: JSON\.stringify\(\{[\s\S]*?case_id: caseId[\s\S]*?\}\),\s*\},\s*caseId\s*\)/
  );
  assert.match(source, /parseVehicleRemovalCheckout\(data, caseId\)/);
  assert.match(
    source,
    /requireStripeCheckoutUrl\(checkout\.checkoutUrl\)/
  );
  assert.doesNotMatch(source, /data\?\.(?:url|redirect)/);
  for (const forbiddenKey of ["name", "full_name", "dni_nie", "phone", "email"]) {
    assert.doesNotMatch(
      source,
      new RegExp(`body: JSON\\.stringify\\(\\{[\\s\\S]*?\\b${forbiddenKey}:`)
    );
  }
});

test("public vehicle links create a case before entering the vehicle workflow", async () => {
  const [catalog, traffic] = await Promise.all([
    read("src/data/publicServices.js"),
    read("src/pages/Trafico.jsx"),
  ]);

  assert.match(
    catalog,
    /export const VEHICLE_REMOVAL_INTAKE_PATH = withFamily\(\s*"\/iniciar-expediente\/traffic\/vehicle_removal",\s*"trafico"\s*\)/
  );
  assert.match(catalog, /\{ to: VEHICLE_REMOVAL_INTAKE_PATH, label: "Eliminación de vehículos" \}/);
  assert.match(traffic, /to: VEHICLE_REMOVAL_INTAKE_PATH/);
  assert.doesNotMatch(catalog, /to:\s*"\/eliminar-coche"/);
  assert.doesNotMatch(traffic, /to:\s*"\/eliminar-coche"/);
});

test("vehicle removal cases derive their fixed destination with only the case id", async () => {
  const source = await read("src/pages/IniciarExpedienteRTM.jsx");

  assert.match(
    source,
    /department === "traffic" && caseType === "vehicle_removal"[\s\S]*?return VEHICLE_REMOVAL_PATH/
  );
  assert.match(source, /allowedPathnames: \[fallbackNextPath\]/);
  assert.match(
    source,
    /navigate\(`\$\{draftCase\.nextPath\}\$\{separator\}case=\$\{encodeURIComponent\(draftCase\.caseId\)\}`\)/
  );
  assert.doesNotMatch(source, /access_token=.*draftCase/);
  assert.doesNotMatch(source, /case_access_token=.*draftCase/);
});

test("vehicle removal bypasses generic DGT issuance and resumes only in its specific flow", async () => {
  const [intake, home, legacyHome, authorize, summary] = await Promise.all([
    read("src/pages/IniciarExpedienteRTM.jsx"),
    read("src/pages/InicioRTM.jsx"),
    read("src/pages/Inicio.jsx"),
    read("src/pages/Autorizar.jsx"),
    read("src/pages/ResumenExpediente.jsx"),
  ]);

  const vehicleExit = intake.indexOf("if (isVehicleRemoval)");
  const genericIssue = intake.indexOf("`/cases/${caseId}/authorize`");
  assert.ok(vehicleExit > 0 && genericIssue > vehicleExit);
  assert.match(intake, /isVehicleRemoval \? false : form\.representation_confirmed/);
  assert.match(intake, /Esta alta no genera ni solicita una autorización DGT genérica/);
  assert.match(
    intake,
    /navigate\(`\$\{nextPath\}\?case=\$\{encodeURIComponent\(caseId\)\}`\);\s*return;/
  );

  for (const source of [home, legacyHome]) {
    assert.match(source, /if \(isVehicleRemovalCase\(data\)\) return "vehicle_removal"/);
    assert.match(source, /navigate\(`\/eliminar-coche\?case=/);
  }
  assert.match(authorize, /if \(isVehicleRemovalCase\(status\)\)[\s\S]*?\/eliminar-coche\?case=/);
  assert.match(summary, /<Navigate[\s\S]*?\/eliminar-coche\?case=/);
});

test("direct vehicle entry without the matching local capability is redirected", async () => {
  const source = await read("src/pages/EliminarCoche.jsx");

  assert.doesNotMatch(source, /\bapiFetch\b/);
  assert.match(
    source,
    /if \(!requiredCaseId\) \{\s*throw new Error\("Falta el expediente autorizado para esta operación\."\);\s*\}/
  );
  assert.match(source, /Boolean\(caseId && getCaseAccessToken\(caseId\)\)/);
  assert.match(
    source,
    /if \(!caseId \|\| !hasCaseAccess \|\| accessRejected\) \{\s*return <Navigate to=\{VEHICLE_REMOVAL_INTAKE_PATH\} replace \/>;\s*\}/
  );
  assert.match(
    source,
    /`\/cases\/\$\{encodeURIComponent\(caseId\)\}\/public-status`,\s*\{ method: "GET", signal: loadController\.signal \},\s*caseId/
  );
  assert.match(
    source,
    /`\/cases\/\$\{encodeURIComponent\(caseId\)\}\/append-documents`[\s\S]*?\},\s*caseId\s*\)/
  );
  assert.match(source, /isExpectedVehicleCaseStatus\(publicStatus, caseId\)/);
  assert.match(source, /vehicleCaseAllowsMutation\(publicStatus, caseId\)/);
  assert.match(source, /verifiedCaseId !== caseId \|\| paidCaseId === caseId/);
});

test("vehicle UI state is keyed and reset when the authorized case changes", async () => {
  const source = await read("src/pages/EliminarCoche.jsx");
  assert.match(source, /verifiedCaseId === caseId/);
  assert.match(source, /paidCaseId === caseId/);
  assert.match(source, /rejectedCaseId === caseId/);
  assert.match(source, /setPlate\(""\)[\s\S]*?setPermitFile\(null\)[\s\S]*?setOtherFiles\(\[\]\)/);
  assert.match(source, /messageState\.caseId === caseId/);
  assert.match(source, /submitAbortRef\.current\?\.abort\(\)/);
  assert.match(source, /activeCaseIdRef\.current !== requestCaseId/);
  assert.match(source, /setVehicleAuthorizationAccepted\(false\)/);
});

test("vehicle authorization is explicit, versioned and never preselected", async () => {
  const source = await read("src/pages/EliminarCoche.jsx");
  assert.match(source, /const \[vehicleAuthorizationAccepted, setVehicleAuthorizationAccepted\] = useState\(false\)/);
  assert.match(source, /checked=\{vehicleAuthorizationAccepted && authorizedPlate === normalizedPlate\}/);
  assert.match(source, /if \(!vehicleAuthorizationAccepted \|\| authorizedPlate !== normalizedPlate\)/);
  assert.match(source, /authorization_accepted: vehicleAuthorizationAccepted/);
  assert.match(source, /authorization_version: vehicleQuote\.authorizationVersion/);
  assert.match(source, /authorization_sha256: vehicleQuote\.authorizationSha256/);
  assert.match(source, /\{vehicleQuote\.authorizationText\}/);
  assert.match(source, /Versión de autorización: \{vehicleQuote\.authorizationVersion\}/);
  assert.doesNotMatch(source, /authorization_accepted:\s*true/);
  assert.match(source, /disabled=\{loading \|\| !plateIsValid\}/);
  assert.match(source, /setAuthorizedPlate\(""\)/);
  assert.doesNotMatch(source, /Autorización recibida/);
  assert.ok(
    source.indexOf("if (!vehicleAuthorizationAccepted)") <
      source.indexOf("setLoading(true)"),
    "authorization must be checked before the first network-capable stage"
  );
});

test("vehicle price comes from a fresh exact capability-bound quote", async () => {
  const source = await read("src/pages/EliminarCoche.jsx");
  assert.match(source, /`\/vehicle-removal\/quote\?case_id=\$\{encodeURIComponent\(caseId\)\}`/);
  assert.match(source, /verifyVehicleRemovalQuote\(quotePayload, caseId\)/);
  assert.match(source, /sameVehicleRemovalQuote\(vehicleQuote, latestQuote\)/);
  assert.match(source, /setVehicleAuthorizationAccepted\(false\)/);
  assert.match(source, /formatVehicleRemovalQuote\(vehicleQuote\)/);
  assert.doesNotMatch(source, />39 €</);
});

test("vehicle files follow the conservative CORE append contract", async () => {
  const source = await read("src/pages/EliminarCoche.jsx");
  assert.match(source, /const MAX_FILE_BYTES = 2 \* 1024 \* 1024/);
  assert.match(source, /const MAX_FILES = 5/);
  assert.match(source, /selectedDocuments\.length > MAX_FILES/);
  assert.match(source, /APPEND_DOCUMENT_EXTENSION\.test\(file\.name \|\| ""\)/);
  assert.doesNotMatch(source, /accept="[^"]*\.doc(?:,|\")/);
  assert.ok(
    source.indexOf("/^\\d{4}[A-Z]{3}$/.test(normalizedPlate)") <
      source.indexOf("setLoading(true)"),
    "plate shape must be rejected before any mutation"
  );
});

test("vehicle return never treats query parameters as proof of payment", async () => {
  const source = await read("src/pages/EliminarCoche.jsx");

  assert.doesNotMatch(source, /success\) === "1"|paidOk/);
  assert.match(source, /vehicleCheckoutSignal\(location\.search\)/);
  assert.match(
    source,
    /`\/billing\/status\/\$\{encodeURIComponent\(caseId\)\}`[\s\S]*?\{ method: "GET", signal: loadController\.signal \},\s*caseId/
  );
  assert.match(source, /paid = isVehiclePaymentConfirmed\(billing\)/);
  assert.doesNotMatch(source, /data\?\.payment_status === "paid"/);
  assert.match(source, /if \(paymentConfirmed\) \{/);
  assert.doesNotMatch(source, /if \(checkoutReturned\) \{\s*return \(/);
});

test("vehicle entry accepts one canonical case parameter and rejects legacy aliases", async () => {
  const [source, policy] = await Promise.all([
    read("src/pages/EliminarCoche.jsx"),
    read("src/lib/vehicleRemovalAccess.js"),
  ]);

  assert.match(source, /vehicleCaseIdFromSearch\(location\.search\)/);
  assert.match(policy, /if \(params\.has\("case_id"\) \|\| params\.has\("id"\)\) return "";/);
  assert.match(policy, /const values = params\.getAll\("case"\)/);
  assert.match(policy, /values\.length === 1 \? normalizeCaseId\(values\[0\]\) : ""/);
  assert.match(source, /forgetCaseAccessToken\(caseId\)/);
});
