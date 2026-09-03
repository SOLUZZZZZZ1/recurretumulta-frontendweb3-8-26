import assert from "node:assert/strict";
import test from "node:test";

import {
  legacyHashRouteTarget,
  migrateLegacyHashRoute,
} from "../src/lib/legacyHashRoute.js";

test("legacy hash routes migrate only to canonical root-relative application paths", () => {
  assert.equal(
    legacyHashRouteTarget({ pathname: "/", hash: "#/resumen?case=abc" }),
    "/resumen?case=abc"
  );
  for (const hash of [
    "#//evil.example/path",
    "#/\\evil.example/path",
    "#/%2f%2fevil.example/path",
    "#/%2e%2e/ops",
    "#/ops//case",
    "#/ops/../case",
    "#/ops\u0000/case",
  ]) {
    assert.equal(legacyHashRouteTarget({ pathname: "/", hash }), "", hash);
  }
  assert.equal(
    legacyHashRouteTarget({ pathname: "/already-clean", hash: "#/resumen" }),
    ""
  );
});

test("a rejected or browser-blocked migration never throws during startup", () => {
  let calls = 0;
  assert.equal(
    migrateLegacyHashRoute({
      location: { pathname: "/", hash: "#//evil.example" },
      history: { replaceState: () => { calls += 1; } },
    }),
    false
  );
  assert.equal(calls, 0);
  assert.equal(
    migrateLegacyHashRoute({
      location: { pathname: "/", hash: "#/resumen" },
      history: { replaceState: () => { throw new DOMException("blocked", "SecurityError"); } },
    }),
    false
  );
});
