import assert from "node:assert/strict";
import test from "node:test";

import {
  bindOpsSessionLifecycle,
  scheduleOpsSessionExpiry,
} from "../src/ops-auth/opsSessionLifecycle.js";

test("OPS memory sessions are invalidated on pagehide and restored signed out from BFCache", () => {
  const listeners = new Map();
  const removed = [];
  const browserWindow = {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      removed.push([type, listener]);
    },
  };
  const events = [];
  const unbind = bindOpsSessionLifecycle(browserWindow, {
    invalidate: (reason) => events.push(["invalidate", reason]),
    restore: (reason) => events.push(["restore", reason]),
  });

  listeners.get("pagehide")({ persisted: true });
  listeners.get("pageshow")({ persisted: false });
  listeners.get("pageshow")({ persisted: true });

  assert.deepEqual(events, [
    ["invalidate", "pagehide"],
    ["restore", "pageshow-persisted"],
  ]);
  unbind();
  assert.deepEqual(
    removed.map(([type]) => type),
    ["pagehide", "pageshow"]
  );
});

test("OPS expiry fires immediately for missing, invalid or elapsed deadlines", () => {
  for (const expiresAt of ["", "not-a-date", "2026-09-03T10:00:00Z"]) {
    const reasons = [];
    const cancel = scheduleOpsSessionExpiry(expiresAt, (reason) => reasons.push(reason), {
      now: () => Date.parse("2026-09-03T10:00:01Z"),
      setTimer: () => assert.fail("an invalid deadline must not create a timer"),
    });
    assert.deepEqual(reasons, ["session-expired"]);
    assert.doesNotThrow(cancel);
  }
});

test("OPS expiry re-arms long deadlines and cancellation clears the active timer", () => {
  let now = 0;
  let nextId = 0;
  const scheduled = new Map();
  const cleared = [];
  const reasons = [];
  const cancel = scheduleOpsSessionExpiry(
    "2099-01-01T00:00:00.000Z",
    (reason) => reasons.push(reason),
    {
      now: () => now,
      setTimer(callback, delay) {
        nextId += 1;
        scheduled.set(nextId, { callback, delay });
        return nextId;
      },
      clearTimer(timer) {
        cleared.push(timer);
      },
    }
  );

  const first = scheduled.get(1);
  assert.equal(first.delay, 2_147_000_000);
  now = Date.parse("2099-01-01T00:00:00.000Z");
  first.callback();
  assert.deepEqual(reasons, ["session-expired"]);
  cancel();
  assert.deepEqual(cleared, [1]);
});
