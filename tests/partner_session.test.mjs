import assert from "node:assert/strict";
import test from "node:test";

import {
  clearPartnerSession,
  getPartnerSessionValue,
  hasPartnerSessionHint,
  migratePartnerSession,
  parsePartnerLoginEnvelope,
  parsePartnerSessionEnvelope,
  partnerSessionRemainingMs,
  PARTNER_SESSION_KEYS,
  setPartnerSessionValue,
} from "../src/lib/partnerSession.js";

const NOW = Date.parse("2026-09-03T12:00:00.000Z");
const EXPIRES = "2026-09-03T20:00:00.000Z";

function memoryStorage(entries = []) {
  const values = new Map(entries);
  return {
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

test("legacy partner bearers are destroyed while harmless metadata migrates", () => {
  const localStorage = memoryStorage([
    ["partner_token", "legacy-bearer"],
    ["partner_name", "Asesoría RTM"],
    ["partner_email", "asesoria@example.com"],
    ["partner_must_change", "1"],
  ]);
  const sessionStorage = memoryStorage([["partner_token", "tab-bearer"]]);
  globalThis.window = { localStorage, sessionStorage };

  migratePartnerSession();

  assert.equal(localStorage.getItem("partner_token"), null);
  assert.equal(sessionStorage.getItem("partner_token"), null);
  assert.equal(getPartnerSessionValue("partner_name"), "Asesoría RTM");
  assert.equal(getPartnerSessionValue("partner_email"), "asesoria@example.com");
  for (const key of PARTNER_SESSION_KEYS) {
    assert.equal(localStorage.getItem(key), null, key);
  }
});

test("only non-secret tab metadata can describe an unexpired cookie session", () => {
  const localStorage = memoryStorage();
  const sessionStorage = memoryStorage();
  globalThis.window = { localStorage, sessionStorage };

  setPartnerSessionValue("partner_authenticated", "1");
  setPartnerSessionValue("partner_expires_at", "2999-01-01T00:00:00.000Z");
  setPartnerSessionValue("partner_name", "Asesoría RTM");

  assert.equal(hasPartnerSessionHint(), true);
  assert.equal(sessionStorage.getItem("partner_name"), "Asesoría RTM");
  assert.equal(localStorage.getItem("partner_name"), null);
  assert.throws(
    () => setPartnerSessionValue("partner_token", "forbidden-bearer"),
    /no permitida/i
  );
});

test("expired metadata cannot keep the partner UI authenticated", () => {
  globalThis.window = {
    localStorage: memoryStorage(),
    sessionStorage: memoryStorage([
      ["partner_authenticated", "1"],
      ["partner_expires_at", "2000-01-01T00:00:00.000Z"],
    ]),
  };
  assert.equal(hasPartnerSessionHint(), false);
  assert.equal(partnerSessionRemainingMs(), 0);
});

test("partner expiry exposes only a bounded remaining lifetime", () => {
  globalThis.window = {
    localStorage: memoryStorage(),
    sessionStorage: memoryStorage([
      ["partner_authenticated", "1"],
      ["partner_expires_at", "2030-01-01T00:00:10.000Z"],
    ]),
  };
  assert.equal(
    partnerSessionRemainingMs(Date.parse("2030-01-01T00:00:00.000Z")),
    10_000
  );
});

test("clearing a partner session also purges every legacy bearer", () => {
  const localStorage = memoryStorage([["partner_token", "legacy"]]);
  const sessionStorage = memoryStorage([
    ["partner_token", "tab-legacy"],
    ["partner_authenticated", "1"],
  ]);
  globalThis.window = { localStorage, sessionStorage };

  clearPartnerSession();

  assert.equal(localStorage.getItem("partner_token"), null);
  assert.equal(sessionStorage.getItem("partner_token"), null);
  for (const key of PARTNER_SESSION_KEYS) {
    assert.equal(sessionStorage.getItem(key), null, key);
    assert.equal(localStorage.getItem(key), null, key);
  }
});

test("partner session endpoint accepts only the exact bounded authenticated envelope", () => {
  assert.deepEqual(
    parsePartnerSessionEnvelope(
      {
        ok: true,
        authenticated: true,
        partner_name: "Asesoría RTM",
        expires_at: EXPIRES,
      },
      NOW
    ),
    { partnerName: "Asesoría RTM", expiresAt: EXPIRES }
  );

  for (const payload of [
    { ok: true, authenticated: false, partner_name: "Asesoría", expires_at: EXPIRES },
    { ok: true, authenticated: true, partner_name: "Asesoría", expires_at: EXPIRES, token: "secret" },
    { ok: true, authenticated: true, partner_name: "Asesoría\u0000", expires_at: EXPIRES },
    { ok: true, authenticated: true, partner_name: "Asesoría", expires_at: "2026-09-03T11:59:59Z" },
    { ok: true, authenticated: true, partner_name: "Asesoría", expires_at: "2026-09-10T12:00:01Z" },
  ]) {
    assert.throws(() => parsePartnerSessionEnvelope(payload, NOW));
  }

  assert.equal(
    parsePartnerSessionEnvelope(
      {
        ok: true,
        authenticated: true,
        partner_name: "Asesoría",
        expires_at: "2026-09-10T12:00:00Z",
      },
      NOW
    ).expiresAt,
    "2026-09-10T12:00:00Z"
  );
});

test("partner login accepts normal and forced-password-change contracts without bearers", () => {
  assert.deepEqual(
    parsePartnerLoginEnvelope(
      {
        ok: true,
        authenticated: true,
        partner_name: "Asesoría RTM",
        must_change_password: false,
        expires_at: EXPIRES,
        token_returned: false,
      },
      NOW
    ),
    { mustChangePassword: false, partnerName: "Asesoría RTM", expiresAt: EXPIRES }
  );
  assert.deepEqual(
    parsePartnerLoginEnvelope({
      ok: true,
      partner_name: "Asesoría RTM",
      must_change_password: true,
      token_returned: false,
    }),
    { mustChangePassword: true, partnerName: "Asesoría RTM", expiresAt: "" }
  );
  assert.throws(() =>
    parsePartnerLoginEnvelope(
      {
        ok: true,
        authenticated: true,
        partner_name: "Asesoría RTM",
        must_change_password: false,
        expires_at: EXPIRES,
        token_returned: true,
      },
      NOW
    )
  );
});
