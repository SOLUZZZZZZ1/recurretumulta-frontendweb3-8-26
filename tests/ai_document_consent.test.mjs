import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  appendAiDocumentConsent,
  DOCUMENT_ANALYSIS_PRIVACY_VERSION,
  VEHICLE_REMOVAL_AI_PRIVACY_VERSION,
} from "../src/lib/aiDocumentConsent.js";

const projectRoot = new URL("../", import.meta.url);

async function collectSourceFiles(directory) {
  const entries = await readdir(new URL(directory, projectRoot), {
    withFileTypes: true,
  });
  const files = [];

  for (const entry of entries) {
    const relative = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(`${relative}/`)));
    } else if (/\.(?:js|jsx)$/.test(entry.name)) {
      files.push(relative);
    }
  }

  return files;
}

test("AI consent metadata is impossible to append without an explicit opt-in", () => {
  const form = new FormData();

  assert.throws(
    () =>
      appendAiDocumentConsent(form, {
        consented: false,
        privacyVersion: DOCUMENT_ANALYSIS_PRIVACY_VERSION,
      }),
    /consentimiento explícito/i
  );
  assert.equal(form.has("ai_processing_consent"), false);
  assert.equal(form.has("privacy_version"), false);

  assert.throws(
    () =>
      appendAiDocumentConsent(form, {
        consented: true,
        privacyVersion: "unknown-policy",
      }),
    /versión de privacidad/i
  );
  assert.equal(form.has("ai_processing_consent"), false);
  assert.equal(form.has("privacy_version"), false);
});

test("AI consent metadata uses an allowlisted, versioned contract", () => {
  for (const privacyVersion of [
    DOCUMENT_ANALYSIS_PRIVACY_VERSION,
    VEHICLE_REMOVAL_AI_PRIVACY_VERSION,
  ]) {
    const form = new FormData();
    appendAiDocumentConsent(form, { consented: true, privacyVersion });

    assert.equal(form.get("ai_processing_consent"), "true");
    assert.equal(form.get("privacy_version"), privacyVersion);
  }
});

test("every frontend caller of the public analyze routes uses the consent gate", async () => {
  const sourceFiles = await collectSourceFiles("src/");
  const callers = [];

  for (const relative of sourceFiles) {
    const source = await readFile(new URL(relative, projectRoot), "utf8");
    if (/\/analyze(?:\/expediente)?['"`]/.test(source)) {
      callers.push(relative);
      assert.match(source, /appendAiDocumentConsent\(/, relative);
      assert.match(source, /<AiDocumentConsent\b/, relative);
      assert.match(source, /useState\(false\)/, relative);
      assert.match(source, /DOCUMENT_ANALYSIS_PRIVACY_VERSION/, relative);
    }
  }

  assert.deepEqual(callers.sort(), [
    "src/components/UploadDocumento.jsx",
    "src/components/UploadExpediente.jsx",
    "src/components/UploadMulta.jsx",
    "src/pages/Multas.jsx",
  ]);
});

test("vehicle registration verification is optional and explicitly consented", async () => {
  const source = await readFile(
    new URL("src/pages/EliminarCoche.jsx", projectRoot),
    "utf8"
  );

  assert.match(source, /['"]\/vehicle-removal\/verify-registration['"]/);
  assert.match(source, /if \(permitFile && aiProcessingConsent\)/);
  assert.match(source, /appendAiDocumentConsent\(verificationForm/);
  assert.match(source, /VEHICLE_REMOVAL_AI_PRIVACY_VERSION/);
  assert.match(source, /<AiDocumentConsent\b/);
  assert.match(source, /useState\(false\)/);
  assert.match(source, /sin autorización para procesamiento con IA/);
});

test("the consent control is a controlled, accessible checkbox", async () => {
  const source = await readFile(
    new URL("src/components/AiDocumentConsent.jsx", projectRoot),
    "utf8"
  );

  assert.match(source, /htmlFor=\{id\}/);
  assert.match(source, /type="checkbox"/);
  assert.match(source, /checked=\{checked\}/);
  assert.match(source, /onChange=\{\(event\) => onChange\(event\.target\.checked\)\}/);
  assert.match(source, /desmarcada por defecto/i);
  assert.match(source, /revisión humana/i);
});
