import assert from "node:assert/strict";
import test from "node:test";

import {
  CASE_SESSION_STORAGE_PREFIX,
  getCaseScopedData,
  projectCaseScopedData,
  purgeLegacyCaseLocalStorage,
  rememberCaseScopedData,
} from "../src/lib/caseSession.js";

function memoryStorage(entries = []) {
  const values = new Map(entries);
  return {
    get length() {
      return values.size;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

const FIRST_CASE = "11111111-1111-1111-1111-111111111111";
const SECOND_CASE = "22222222-2222-2222-2222-222222222222";

test("legacy persistent PII is purged without touching unrelated preferences", () => {
  const localStorage = memoryStorage([
    ["rtm_last_analysis", JSON.stringify({ dni: "12345678Z" })],
    ["rtm_last_intake", JSON.stringify({ email: "person@example.test" })],
    [`rtm_client_${FIRST_CASE}`, JSON.stringify({ full_name: "Persona" })],
    ["theme", "dark"],
  ]);
  globalThis.window = { localStorage, sessionStorage: memoryStorage() };

  purgeLegacyCaseLocalStorage();

  assert.equal(localStorage.getItem("rtm_last_analysis"), null);
  assert.equal(localStorage.getItem("rtm_last_intake"), null);
  assert.equal(localStorage.getItem(`rtm_client_${FIRST_CASE}`), null);
  assert.equal(localStorage.getItem("theme"), "dark");
});

test("case data is allowlisted, tab scoped and isolated by case id", () => {
  const localStorage = memoryStorage();
  const sessionStorage = memoryStorage();
  globalThis.window = { localStorage, sessionStorage };

  const result = rememberCaseScopedData(FIRST_CASE, {
    case_access_token: `v1.${"a".repeat(64)}`,
    b2_bucket: "private-bucket",
    raw_text: "unbounded model output",
    client_data: {
      full_name: "Nombre Apellidos",
      dni_nie: "12345678Z",
      email: "person@example.test",
    },
  });

  assert.equal(result.case_id, FIRST_CASE);
  assert.deepEqual(getCaseScopedData(FIRST_CASE)?.case_data, {
    full_name: "Nombre Apellidos",
    dni_nie: "12345678Z",
    email: "person@example.test",
  });
  assert.equal(getCaseScopedData(SECOND_CASE), null);

  const raw = sessionStorage.getItem(`${CASE_SESSION_STORAGE_PREFIX}${FIRST_CASE}`);
  assert.equal(raw.includes("case_access_token"), false);
  assert.equal(raw.includes("private-bucket"), false);
  assert.equal(raw.includes("unbounded model output"), false);
});

test("stored case id must match the requested case", () => {
  const sessionStorage = memoryStorage([
    [
      `${CASE_SESSION_STORAGE_PREFIX}${FIRST_CASE}`,
      JSON.stringify({
        version: 1,
        case_id: SECOND_CASE,
        case_data: { full_name: "Cross Case" },
      }),
    ],
  ]);
  globalThis.window = { localStorage: memoryStorage(), sessionStorage };

  assert.equal(getCaseScopedData(FIRST_CASE), null);
  assert.equal(
    projectCaseScopedData(FIRST_CASE, {
      case_id: SECOND_CASE,
      full_name: "Cross Case",
    }),
    null
  );
});

test("projection rejects non-canonical case identifiers and bounds fields", () => {
  assert.equal(projectCaseScopedData("../../other", { full_name: "x" }), null);
  const projected = projectCaseScopedData(FIRST_CASE, {
    full_name: `  ${"x".repeat(300)}\u0000  `,
  });
  assert.equal(projected.case_data.full_name.length, 160);
  assert.equal(projected.case_data.full_name.includes("\u0000"), false);
});
