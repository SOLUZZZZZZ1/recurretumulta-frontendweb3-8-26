import assert from "node:assert/strict";
import test from "node:test";

import {
  bindPartnerCookieSession,
  buildPartnerRequest,
  clearPartnerCookieSessionBinding,
  partnerFetch,
  readJsonResponseLimited,
  readPartnerCsrfToken,
  requirePartnerApiPath,
} from "../src/lib/partnerApi.js";

const CSRF = "a".repeat(64);

function browser({ cookie = "" } = {}) {
  clearPartnerCookieSessionBinding();
  globalThis.window = { location: { origin: "https://rtm.example" } };
  globalThis.document = { cookie };
}

test("partner API accepts only same-origin partner paths", () => {
  browser();
  assert.equal(
    requirePartnerApiPath("/api/partner/cases?q=uno"),
    "/api/partner/cases?q=uno"
  );

  for (const unsafe of [
    "https://evil.example/api/partner/cases",
    "//evil.example/api/partner/cases",
    "/api/partner/../ops/queue",
    "/api/partner/%2e%2e/ops/queue",
    "/api/partner/%252e%252e/ops/queue",
    "/api/partner//cases",
    "/api/partner/cases#secret",
  ]) {
    assert.throws(() => requirePartnerApiPath(unsafe), /API partner|URL/i, unsafe);
  }
});

test("cookie session requests force a hardened same-origin transport", () => {
  browser({ cookie: `other=1; __Host-rtm_partner_csrf=${CSRF}` });
  bindPartnerCookieSession();
  const request = buildPartnerRequest(
    "/api/partner/cases",
    { method: "post", headers: { "X-CSRF-Token": "caller-controlled" } },
    { requireCsrf: true }
  );

  assert.equal(request.url, "/api/partner/cases");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.credentials, "same-origin");
  assert.equal(request.options.mode, "same-origin");
  assert.equal(request.options.redirect, "error");
  assert.equal(request.options.cache, "no-store");
  assert.equal(request.options.referrerPolicy, "no-referrer");
  assert.equal(request.options.headers.get("X-CSRF-Token"), CSRF);
  assert.equal(request.options.headers.get("Authorization"), null);
});

test("bearer injection and missing or ambiguous CSRF fail before fetch", async () => {
  browser();
  assert.throws(
    () => buildPartnerRequest("/api/partner/cases", {
      headers: { Authorization: "Bearer attacker" },
    }),
    /no admite credenciales Bearer/i
  );
  assert.throws(
    () => buildPartnerRequest(
      "/api/partner/logout",
      { method: "POST" },
      { requireCsrf: true }
    ),
    /protección de sesión/i
  );
  assert.equal(
    readPartnerCsrfToken(
      `__Host-rtm_partner_csrf=${CSRF}; __Host-rtm_partner_csrf=${"b".repeat(64)}`
    ),
    ""
  );

  let called = false;
  await assert.rejects(
    partnerFetch(
      "/api/partner/logout",
      { method: "POST" },
      {
        requireCsrf: true,
        fetchImpl: async () => {
          called = true;
          return {};
        },
      }
    ),
    /protección de sesión/i
  );
  assert.equal(called, false);
});

test("authenticated mutations require CSRF by default but public credential routes do not", () => {
  browser();
  assert.throws(
    () => buildPartnerRequest("/api/partner/cases", { method: "POST" }),
    /protección de sesión/i
  );
  assert.doesNotThrow(() =>
    buildPartnerRequest("/api/partner/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
  );
  assert.doesNotThrow(() =>
    buildPartnerRequest("/api/partner/change-password", { method: "POST" })
  );
  assert.doesNotThrow(() =>
    buildPartnerRequest("/api/partner/signup", { method: "POST" })
  );
});

test("partnerFetch sends cookie-only requests with cookie-derived CSRF", async () => {
  browser({ cookie: `__Host-rtm_partner_csrf=${CSRF}` });
  bindPartnerCookieSession();
  const calls = [];
  const response = { ok: true, status: 200 };

  const result = await partnerFetch(
    "/api/partner/logout",
    { method: "POST" },
    {
      requireCsrf: true,
      fetchImpl: async (...args) => {
        calls.push(args);
        return response;
      },
    }
  );

  assert.equal(result, response);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "/api/partner/logout");
  assert.equal(calls[0][1].credentials, "same-origin");
  assert.equal(calls[0][1].headers.get("X-CSRF-Token"), CSRF);
  assert.equal(calls[0][1].headers.get("Authorization"), null);
});

test("a cookie changed by another tab invalidates protected reads and mutations before fetch", async () => {
  browser({ cookie: `__Host-rtm_partner_csrf=${CSRF}` });
  bindPartnerCookieSession();
  document.cookie = `__Host-rtm_partner_csrf=${"b".repeat(64)}`;

  assert.throws(
    () => buildPartnerRequest("/api/partner/cases", { method: "GET" }),
    /otra ventana/i
  );
  let called = false;
  await assert.rejects(
    partnerFetch(
      "/api/partner/cases",
      { method: "POST", body: new FormData() },
      { fetchImpl: async () => { called = true; } }
    ),
    /otra ventana/i
  );
  assert.equal(called, false);
  assert.doesNotThrow(() =>
    buildPartnerRequest("/api/partner/session", { method: "GET" })
  );
});

test("partner JSON reader rejects a response before it can grow without bound", async () => {
  const parsed = await readJsonResponseLimited(
    new Response('{"ok":true}', {
      headers: { "Content-Type": "application/json" },
    }),
    64
  );
  assert.deepEqual(parsed, { ok: true });

  await assert.rejects(
    readJsonResponseLimited(
      new Response(`{"value":"${"x".repeat(128)}"}`),
      64
    ),
    /límite seguro/i
  );
  await assert.rejects(
    readJsonResponseLimited(
      new Response("{}", { headers: { "Content-Length": "1024" } }),
      64
    ),
    /límite seguro/i
  );
});
