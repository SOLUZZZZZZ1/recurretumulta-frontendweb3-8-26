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
    removeItem(key) {
      storage.delete(key);
    },
  },
};

const access = await import("../src/lib/caseAccess.js");
const CASE_ID = "11111111-1111-1111-1111-111111111111";
const TOKEN = `v2.1735689600.${"b".repeat(32)}.${"a".repeat(64)}`;
const LEGACY_V1_TOKEN = `v1.${"c".repeat(64)}`;

test("case capability is scoped to session storage and attached as a header", () => {
  assert.equal(access.rememberCaseAccessToken(CASE_ID, TOKEN), TOKEN);
  assert.equal(access.getCaseAccessToken(CASE_ID), TOKEN);
  assert.deepEqual(access.caseAccessHeaders(CASE_ID, { Accept: "application/json" }), {
    Accept: "application/json",
    "X-RTM-Case-Token": TOKEN,
  });
  assert.deepEqual(
    access.caseAccessHeaders(CASE_ID, { "x-rtm-case-token": "attacker-value" }),
    { "X-RTM-Case-Token": TOKEN }
  );
  assert.deepEqual(
    access.caseAccessHeaders("22222222-2222-2222-2222-222222222222", {
      "X-RTM-Case-Token": "attacker-value",
    }),
    {}
  );
  assert.equal(access.getCaseAccessToken("22222222-2222-2222-2222-222222222222"), "");
});

test("case capability accepts exact v2 and grace v1 shapes only", () => {
  const legacyCase = "55555555-5555-5555-5555-555555555555";
  assert.equal(access.rememberCaseAccessToken(legacyCase, LEGACY_V1_TOKEN), LEGACY_V1_TOKEN);
  for (const invalid of [
    `v2.12345678.${"b".repeat(32)}.${"a".repeat(64)}`,
    `v2.1735689600.${"b".repeat(31)}.${"a".repeat(64)}`,
    `v2.1735689600.${"b".repeat(32)}.${"a".repeat(63)}`,
    `v2.1735689600.${"g".repeat(32)}.${"a".repeat(64)}`,
    `v2.1735689600.${"b".repeat(32)}.${"a".repeat(64)}.extra`,
  ]) {
    assert.equal(access.rememberCaseAccessToken(CASE_ID, invalid), "", invalid);
  }
  assert.equal(access.rememberCaseAccessToken("../../case", TOKEN), "");
});

test("storage failures fail closed without exposing a usable capability", () => {
  const healthyStorage = window.sessionStorage;
  const blockedCase = "99999999-9999-9999-9999-999999999999";
  window.sessionStorage = {
    getItem() {
      throw new Error("storage blocked");
    },
    setItem() {
      throw new Error("storage blocked");
    },
  };

  try {
    assert.equal(access.rememberCaseAccessToken(CASE_ID, TOKEN), "");
    assert.equal(access.getCaseAccessToken(CASE_ID), "");
    assert.deepEqual(access.caseAccessHeaders(CASE_ID), {});

    window.location.href =
      `https://staging.example/#/resumen?case=${blockedCase}&access_token=${TOKEN}`;
    window.location.search = "";
    window.location.hash = `#/resumen?case=${blockedCase}&access_token=${TOKEN}`;
    replacedUrl = "";
    access.bootstrapCaseAccessFromUrl();
    assert.equal(replacedUrl, `/#/resumen?case=${blockedCase}`);
    assert.equal(replacedUrl.includes(TOKEN), false);
  } finally {
    window.sessionStorage = healthyStorage;
  }
});

test("bootstrap scrubs but never accepts a capability from the real query", () => {
  const queryOnlyCase = "77777777-7777-7777-7777-777777777777";
  window.location.href = `https://staging.example/resumen?case=${queryOnlyCase}&access_token=${TOKEN}`;
  window.location.search = `?case=${queryOnlyCase}&access_token=${TOKEN}`;
  replacedUrl = "";
  access.bootstrapCaseAccessFromUrl();
  assert.equal(access.getCaseAccessToken(queryOnlyCase), "");
  assert.equal(replacedUrl, `/resumen?case=${queryOnlyCase}`);
  assert.equal(replacedUrl.includes("access_token"), false);
});

test("bootstrap also scrubs legacy hash capabilities before storing them", () => {
  const hashCase = "33333333-3333-3333-3333-333333333333";
  const hashToken = `v2.1735689601.${"d".repeat(32)}.${"b".repeat(64)}`;
  window.location.href = `https://staging.example/#/resumen?case=${hashCase}&access_token=${hashToken}`;
  window.location.search = "";
  window.location.hash = `#/resumen?case=${hashCase}&access_token=${hashToken}`;
  replacedUrl = "";

  access.bootstrapCaseAccessFromUrl();

  assert.equal(access.getCaseAccessToken(hashCase), hashToken);
  assert.equal(replacedUrl, `/#/resumen?case=${hashCase}`);
  assert.equal(replacedUrl.includes(hashToken), false);
});

test("a fragment bearer can be paired with a query case without reaching the server", () => {
  const fragmentCase = "66666666-6666-6666-6666-666666666666";
  const fragmentToken = `v2.1735689602.${"e".repeat(32)}.${"f".repeat(64)}`;
  window.location.href =
    `https://staging.example/resumen?case=${fragmentCase}#access_token=${fragmentToken}`;
  window.location.search = `?case=${fragmentCase}`;
  window.location.hash = `#access_token=${fragmentToken}`;
  replacedUrl = "";

  access.bootstrapCaseAccessFromUrl();

  assert.equal(access.getCaseAccessToken(fragmentCase), fragmentToken);
  assert.equal(replacedUrl, `/resumen?case=${fragmentCase}`);
  assert.equal(replacedUrl.includes(fragmentToken), false);
});

test("bootstrap fails closed without crashing when history cannot scrub the fragment", () => {
  const blockedCase = "67676767-6767-4767-8767-676767676767";
  const blockedToken = `v2.1735689603.${"1".repeat(32)}.${"2".repeat(64)}`;
  const healthyReplaceState = window.history.replaceState;
  access.forgetCaseAccessToken(blockedCase);
  window.location.href =
    `https://staging.example/resumen?case=${blockedCase}#access_token=${blockedToken}`;
  window.location.search = `?case=${blockedCase}`;
  window.location.hash = `#access_token=${blockedToken}`;
  window.history.replaceState = () => {
    throw new Error("history denied");
  };

  try {
    assert.doesNotThrow(() => access.bootstrapCaseAccessFromUrl());
    assert.equal(access.getCaseAccessToken(blockedCase), "");
  } finally {
    window.history.replaceState = healthyReplaceState;
  }
});

test("invalid or orphan URL secrets are scrubbed and never recovered later", () => {
  const unusedCase = "44444444-4444-4444-4444-444444444444";
  window.location.href =
    "https://staging.example/resumen?access_token=not-a-valid-capability#section";
  window.location.search = "?access_token=not-a-valid-capability";
  window.location.hash = "#section";
  replacedUrl = "";

  access.bootstrapCaseAccessFromUrl();

  assert.equal(replacedUrl, "/resumen#section");
  assert.equal(
    access.getCaseAccessToken(unusedCase, `?access_token=${TOKEN}`),
    ""
  );
});

test("fragment compatibility accepts only the explicit access_token parameter", () => {
  const strictCase = "88888888-8888-8888-8888-888888888888";
  window.location.href =
    `https://staging.example/resumen?case=${strictCase}#token=${TOKEN}`;
  window.location.search = `?case=${strictCase}`;
  window.location.hash = `#token=${TOKEN}`;
  replacedUrl = "";

  access.bootstrapCaseAccessFromUrl();

  assert.equal(access.getCaseAccessToken(strictCase), "");
  assert.equal(replacedUrl.includes(TOKEN), false);
});

test("bearer-shaped text is removed from arbitrary query and fragment positions", () => {
  const strictCase = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  window.location.href =
    `https://staging.example/?case=${strictCase}&next=${encodeURIComponent(`/continue/${TOKEN}`)}` +
    `#/resumen/${TOKEN}?case=${strictCase}&keep=1`;
  window.location.search =
    `?case=${strictCase}&next=${encodeURIComponent(`/continue/${TOKEN}`)}`;
  window.location.hash = `#/resumen/${TOKEN}?case=${strictCase}&keep=1`;
  replacedUrl = "";

  access.bootstrapCaseAccessFromUrl();

  assert.equal(access.getCaseAccessToken(strictCase), "");
  assert.equal(replacedUrl.includes(TOKEN), false);
  assert.equal(replacedUrl.includes("next="), false);
  assert.equal(replacedUrl, `/?case=${strictCase}#/resumen/?case=${strictCase}&keep=1`);
});

test("double and triple encoded bearer text is scrubbed before another decoder can recover it", () => {
  const strictCase = "abababab-abab-4bab-8bab-abababababab";
  const twice = encodeURIComponent(encodeURIComponent(TOKEN));
  const thrice = encodeURIComponent(twice);

  window.location.href =
    `https://staging.example/resumen?case=${strictCase}&next=${twice}` +
    `#/resume-${thrice}?keep=1`;
  window.location.search = `?case=${strictCase}&next=${twice}`;
  window.location.hash = `#/resume-${thrice}?keep=1`;
  replacedUrl = "";

  access.bootstrapCaseAccessFromUrl();

  assert.equal(access.getCaseAccessToken(strictCase), "");
  assert.equal(replacedUrl, `/resumen?case=${strictCase}#/resume-?keep=1`);
  assert.equal(decodeURIComponent(decodeURIComponent(replacedUrl)).includes(TOKEN), false);
});

test("encoded secret parameter names and malformed neighbors fail closed", () => {
  const strictCase = "acacacac-acac-4cac-8cac-acacacacacac";
  const encodedName = encodeURIComponent(encodeURIComponent("access_token"));
  window.location.href =
    `https://staging.example/resumen?case=${strictCase}&${encodedName}=${TOKEN}&keep=%E0%A4%A`;
  window.location.search = `?case=${strictCase}&${encodedName}=${TOKEN}&keep=%E0%A4%A`;
  window.location.hash = "";
  replacedUrl = "";

  access.bootstrapCaseAccessFromUrl();

  assert.equal(access.getCaseAccessToken(strictCase), "");
  assert.equal(replacedUrl.includes("access"), false);
  assert.equal(replacedUrl.includes(TOKEN), false);
  assert.equal(replacedUrl.includes("keep="), true);
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
    redirect: "follow",
    mode: "cors",
    credentials: "include",
    cache: "force-cache",
    referrerPolicy: "unsafe-url",
  });
  const protectedCall = calls.at(-1);
  assert.equal(protectedCall.options.headers["X-RTM-Case-Token"], TOKEN);
  assert.equal(protectedCall.options.redirect, "error");
  assert.equal(protectedCall.options.mode, "same-origin");
  assert.equal(protectedCall.options.credentials, "same-origin");
  assert.equal(protectedCall.options.cache, "no-store");
  assert.equal(protectedCall.options.referrerPolicy, "no-referrer");

  await api.apiFetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ case_id: CASE_ID }),
  });
  assert.equal(calls.at(-1).options.headers["X-RTM-Case-Token"], TOKEN);
});

test("api transport requires capability and body/path binding for protected routes", async () => {
  const calls = [];
  globalThis.fetch = async (input, options = {}) => {
    calls.push({ input, options });
    return { ok: true };
  };
  const api = await import("../src/lib/api.js");
  const otherCase = "12121212-1212-1212-1212-121212121212";

  access.forgetCaseAccessToken(otherCase);
  await assert.rejects(
    api.apiFetch(`/api/cases/${otherCase}/public-status`),
    /acceso válido/i
  );
  await assert.rejects(
    api.apiFetch(`/api/cases/${CASE_ID}/details`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case_id: otherCase }),
    }),
    /cuerpo no coincide/i
  );
  assert.equal(calls.length, 0);
});

test("explicit public bootstrap routes remain token-free", async () => {
  const calls = [];
  globalThis.fetch = async (input, options = {}) => {
    calls.push({ input, options });
    return { ok: true };
  };
  const api = await import("../src/lib/api.js");

  await api.apiFetch("/api/cases/intake-draft", {
    method: "POST",
    body: new FormData(),
  });
  await api.apiFetch("/api/cases/continue-lookup?q=public-reference", {
    method: "GET",
  });
  assert.equal(calls.length, 2);
  assert.equal(new Headers(calls[0].options.headers).has("X-RTM-Case-Token"), false);
  assert.equal(new Headers(calls[1].options.headers).has("X-RTM-Case-Token"), false);
});

test("case-token URLs are constrained to the same-origin /api namespace", async () => {
  window.location.href = `https://staging.example/resumen?case=${CASE_ID}`;

  assert.equal(
    access.requireSameOriginApiUrl(`/api/cases/${CASE_ID}/public-status?view=1#ignored`),
    `/api/cases/${CASE_ID}/public-status?view=1`
  );
  assert.equal(
    access.requireSameOriginApiUrl(
      `https://staging.example/api/cases/${CASE_ID}/public-status`
    ),
    `/api/cases/${CASE_ID}/public-status`
  );

  for (const unsafe of [
    `https://attacker.example/api/cases/${CASE_ID}`,
    `//attacker.example/api/cases/${CASE_ID}`,
    `/cases/${CASE_ID}/public-status`,
    `/apiary/cases/${CASE_ID}`,
    `/api/../cases/${CASE_ID}`,
    `/api/c%61ses/${CASE_ID}/public-status`,
    `/api/cases%2F${CASE_ID}/public-status`,
    `/api//cases/${CASE_ID}/public-status`,
    `/api/cases/${CASE_ID}/../other`,
  ]) {
    assert.throws(
      () => access.requireSameOriginApiUrl(unsafe),
      /API|origen|URL/
    );
  }
});

test("apiFetch never sends an inferred or explicit case token off-origin", async () => {
  const calls = [];
  globalThis.fetch = async (input, options = {}) => {
    calls.push({ input, options });
    return { ok: true };
  };
  const api = await import("../src/lib/api.js");

  await assert.rejects(
    api.apiFetch(`https://attacker.example/api/cases/${CASE_ID}/public-status`),
    /API|origen|URL/
  );
  await assert.rejects(
    api.apiFetch("https://attacker.example/collect", {
      headers: { "x-rtm-case-token": TOKEN },
    }),
    /acceso de expediente/
  );
  await assert.rejects(
    access.openCaseFile(
      `https://attacker.example/api/cases/${CASE_ID}/authorization.pdf`,
      CASE_ID
    ),
    /API|origen|URL/
  );
  assert.equal(calls.length, 0);
});

test("required case transport blocks absent, crossed and off-origin capabilities", async () => {
  window.location.href = `https://staging.example/eliminar-coche?case=${CASE_ID}`;
  access.rememberCaseAccessToken(CASE_ID, TOKEN);
  const calls = [];
  globalThis.fetch = async (input, options = {}) => {
    calls.push({ input, options });
    return { ok: true };
  };

  await access.requiredCaseAccessFetch(
    "/api/vehicle-removal/create-checkout-session",
    CASE_ID,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case_id: CASE_ID }),
    }
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input, "/api/vehicle-removal/create-checkout-session");
  assert.equal(calls[0].options.headers["X-RTM-Case-Token"], TOKEN);
  assert.equal(calls[0].options.credentials, "same-origin");
  assert.equal(calls[0].options.mode, "same-origin");
  assert.equal(calls[0].options.redirect, "error");

  const otherCase = "12121212-1212-1212-1212-121212121212";
  await assert.rejects(
    access.requiredCaseAccessFetch(
      "/api/vehicle-removal/create-checkout-session",
      CASE_ID,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: otherCase }),
      }
    ),
    /cuerpo no coincide/i
  );
  const crossedForm = new FormData();
  crossedForm.append("case_id", otherCase);
  await assert.rejects(
    access.requiredCaseAccessFetch(
      "/api/vehicle-removal/verify-registration",
      CASE_ID,
      { method: "POST", body: crossedForm }
    ),
    /cuerpo no coincide/i
  );
  await assert.rejects(
    access.requiredCaseAccessFetch(
      `/api/cases/${otherCase}/public-status`,
      CASE_ID,
      { method: "GET" }
    ),
    /ruta no coincide/i
  );
  await assert.rejects(
    access.requiredCaseAccessFetch(
      "/api/vehicle-removal/verify-registration",
      CASE_ID,
      { method: "POST", body: new FormData() }
    ),
    /requiere un único expediente/i
  );
  const unavailableCaseForm = new FormData();
  unavailableCaseForm.append("case_id", otherCase);
  await assert.rejects(
    access.requiredCaseAccessFetch(
      "/api/vehicle-removal/verify-registration",
      otherCase,
      {
        method: "POST",
        headers: { "X-RTM-Case-Token": TOKEN },
        body: unavailableCaseForm,
      }
    ),
    /acceso válido para este expediente/i
  );
  await assert.rejects(
    access.requiredCaseAccessFetch(
      "https://attacker.example/api/vehicle-removal/verify-registration",
      CASE_ID,
      { method: "POST", body: new FormData() }
    ),
    /API|origen|URL/
  );
  assert.equal(calls.length, 1);
});
