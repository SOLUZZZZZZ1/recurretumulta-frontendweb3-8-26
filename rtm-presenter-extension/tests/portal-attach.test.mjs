import assert from "node:assert/strict";
import test from "node:test";

import { attachFileToVerifiedInput } from "../lib/portal-attach.js";
import { sha256Hex } from "../lib/policy.js";
import { buildSyntheticPdf } from "../lib/synthetic-workspace.js";

class FakeDataTransfer {
  constructor() {
    const files = [];
    this.items = {
      add(file) {
        files.push(file);
      },
    };
    this.files = files;
  }
}

function installPortalEnvironment({ origin = "http://localhost:8765", fingerprint } = {}) {
  let currentFiles = [];
  const events = [];
  const input = {
    tagName: "INPUT",
    type: "file",
    id: "fine-file",
    name: "fine_document",
    accept: "application/pdf",
    multiple: false,
    dataset: { rtmSlot: "fine" },
    labels: [{ textContent: " Añadir   multa " }],
    isConnected: true,
    disabled: false,
    readOnly: false,
    get files() {
      return currentFiles;
    },
    set files(value) {
      currentFiles = Array.from(value || []);
    },
    dispatchEvent(event) {
      events.push(event.type);
      return true;
    },
  };
  if (fingerprint) Object.assign(input, fingerprint);

  const original = {
    location: globalThis.location,
    document: globalThis.document,
    DataTransfer: globalThis.DataTransfer,
  };
  Object.defineProperty(globalThis, "location", {
    value: { origin },
    configurable: true,
  });
  globalThis.document = {
    querySelectorAll(selector) {
      return selector === 'input[type="file"][data-rtm-slot="fine"]'
        ? [input]
        : [];
    },
  };
  globalThis.DataTransfer = FakeDataTransfer;

  return {
    input,
    events,
    restore() {
      if (original.location === undefined) delete globalThis.location;
      else {
        Object.defineProperty(globalThis, "location", {
          value: original.location,
          configurable: true,
        });
      }
      if (original.document === undefined) delete globalThis.document;
      else globalThis.document = original.document;
      if (original.DataTransfer === undefined) delete globalThis.DataTransfer;
      else globalThis.DataTransfer = original.DataTransfer;
    },
  };
}

async function validPayload() {
  const bytes = buildSyntheticPdf("ATTACH TEST");
  return {
    expectedOrigin: "http://localhost:8765",
    selector: 'input[type="file"][data-rtm-slot="fine"]',
    fingerprint: {
      tagName: "INPUT",
      type: "file",
      id: "fine-file",
      name: "fine_document",
      accept: "application/pdf",
      multiple: false,
      slot: "fine",
      labelText: "Añadir multa",
    },
    file: {
      documentId: "syn-doc-fine",
      filename: "01_MULTA_SINTETICA.pdf",
      version: 3,
      mimeType: "application/pdf",
      size: bytes.byteLength,
      sha256: await sha256Hex(bytes),
    },
    intentId: `syn_intent_${"a".repeat(32)}`,
    attachedAt: "2026-08-29T18:00:00.000Z",
    bytes: Array.from(bytes),
  };
}

test("verified synthetic PDF is assigned and emits input/change", async () => {
  const environment = installPortalEnvironment();
  try {
    const result = await attachFileToVerifiedInput(await validPayload());
    assert.deepEqual(result, {
      ok: true,
      code: "assigned_to_input",
      slot: "fine",
      intentId: `syn_intent_${"a".repeat(32)}`,
      documentId: "syn-doc-fine",
      filename: "01_MULTA_SINTETICA.pdf",
      version: 3,
      sha256: result.sha256,
      attachedAt: "2026-08-29T18:00:00.000Z",
      size: environment.input.files[0].size,
      mimeType: "application/pdf",
      submissionProven: false,
    });
    assert.equal(environment.input.files.length, 1);
    assert.deepEqual(environment.events, ["input", "change"]);
  } finally {
    environment.restore();
  }
});

test("an occupied input is never overwritten", async () => {
  const environment = installPortalEnvironment();
  try {
    environment.input.files = [new Blob(["manual"], { type: "application/pdf" })];
    const before = environment.input.files[0];
    const result = await attachFileToVerifiedInput(await validPayload());
    assert.deepEqual(result, { ok: false, code: "input_already_has_file" });
    assert.equal(environment.input.files[0], before);
    assert.deepEqual(environment.events, []);
  } finally {
    environment.restore();
  }
});

test("a field occupied during async hash verification is not overwritten", async () => {
  const environment = installPortalEnvironment();
  try {
    const operation = attachFileToVerifiedInput(await validPayload());
    const manual = new Blob(["manual"], { type: "application/pdf" });
    environment.input.files = [manual];
    const result = await operation;
    assert.deepEqual(result, {
      ok: false,
      code: "field_changed_during_verification",
    });
    assert.equal(environment.input.files[0], manual);
    assert.deepEqual(environment.events, []);
  } finally {
    environment.restore();
  }
});

test("wrong origin fails before touching the input", async () => {
  const environment = installPortalEnvironment({ origin: "https://example.com" });
  try {
    const result = await attachFileToVerifiedInput(await validPayload());
    assert.deepEqual(result, { ok: false, code: "origin_mismatch" });
    assert.equal(environment.input.files.length, 0);
    assert.deepEqual(environment.events, []);
  } finally {
    environment.restore();
  }
});

test("fingerprint change fails closed", async () => {
  const environment = installPortalEnvironment({
    fingerprint: { name: "changed_by_portal" },
  });
  try {
    const result = await attachFileToVerifiedInput(await validPayload());
    assert.deepEqual(result, { ok: false, code: "fingerprint_mismatch" });
    assert.equal(environment.input.files.length, 0);
    assert.deepEqual(environment.events, []);
  } finally {
    environment.restore();
  }
});

test("hash mismatch fails closed and clears transferred byte array", async () => {
  const environment = installPortalEnvironment();
  try {
    const payload = await validPayload();
    payload.file.sha256 = "0".repeat(64);
    const result = await attachFileToVerifiedInput(payload);
    assert.deepEqual(result, { ok: false, code: "hash_mismatch" });
    assert.equal(environment.input.files.length, 0);
    assert.ok(payload.bytes.every((byte) => byte === 0));
  } finally {
    environment.restore();
  }
});
