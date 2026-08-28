import assert from "node:assert/strict";
import test from "node:test";

const storage = new Map();
let replacedUrl = "";
globalThis.window = {
  location: {
    href: "https://staging.example/resumen?case=11111111-1111-1111-1111-111111111111",
    search: "?case=11111111-1111-1111-1111-111111111111",
    hash: "",
  },
  history: {
    state: null,
    replaceState(_state, _title, url) {
      replacedUrl = url;
    },
  },
  sessionStorage: {
    getItem(key) {
      return storage.get(key) || null;
    },
    setItem(key, value) {
      storage.set(key, value);
    },
  },
};

const access = await import("../src/lib/caseAccess.js");
const CASE_ID = "11111111-1111-1111-1111-111111111111";
const TOKEN = `v1.${"a".repeat(64)}`;

test("case capability is scoped to session storage and attached as a header", () => {
  assert.equal(access.rememberCaseAccessToken(CASE_ID, TOKEN), TOKEN);
  assert.equal(access.getCaseAccessToken(CASE_ID), TOKEN);
  assert.deepEqual(access.caseAccessHeaders(CASE_ID, { Accept: "application/json" }), {
    Accept: "application/json",
    "X-RTM-Case-Token": TOKEN,
  });
  assert.equal(access.getCaseAccessToken("22222222-2222-2222-2222-222222222222"), "");
});

test("bootstrap captures and removes the capability from the visible URL", () => {
  window.location.href = `https://staging.example/resumen?case=${CASE_ID}&access_token=${TOKEN}`;
  window.location.search = `?case=${CASE_ID}&access_token=${TOKEN}`;
  replacedUrl = "";
  access.bootstrapCaseAccessFromUrl();
  assert.equal(access.getCaseAccessToken(CASE_ID), TOKEN);
  assert.equal(replacedUrl, `/resumen?case=${CASE_ID}`);
  assert.equal(replacedUrl.includes("access_token"), false);
});

test("persistent payloads redact bearer capabilities", () => {
  assert.deepEqual(
    access.redactCaseAccessToken({
      case_id: CASE_ID,
      case_access_token: TOKEN,
      access_token: TOKEN,
      ok: true,
    }),
    { case_id: CASE_ID, ok: true }
  );
});

test("api transport derives the case and attaches the capability", async () => {
  const calls = [];
  globalThis.fetch = async (input, options = {}) => {
    calls.push({ input, options });
    return { ok: true };
  };
  const api = await import("../src/lib/api.js");

  await api.apiFetch(`/api/cases/${CASE_ID}/public-status`, {
    headers: { Accept: "application/json" },
  });
  assert.equal(calls.at(-1).options.headers["X-RTM-Case-Token"], TOKEN);

  await api.apiFetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ case_id: CASE_ID }),
  });
  assert.equal(calls.at(-1).options.headers["X-RTM-Case-Token"], TOKEN);
});
