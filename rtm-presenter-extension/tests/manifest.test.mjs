import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifest = JSON.parse(
  await readFile(new URL("../manifest.json", import.meta.url), "utf8")
);

test("manifest MV3 exposes only the required extension permissions", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual([...manifest.permissions].sort(), [
    "scripting",
    "sidePanel",
  ]);
  for (const forbidden of [
    "downloads",
    "activeTab",
    "debugger",
    "cookies",
    "storage",
    "tabs",
    "webRequest",
    "webRequestBlocking",
  ]) {
    assert.ok(!manifest.permissions.includes(forbidden), forbidden);
  }
  assert.equal(manifest.content_scripts, undefined);
});

test("host permissions are limited to the synthetic local portal", () => {
  assert.deepEqual(manifest.host_permissions, [
    "http://localhost:8765/*",
    "http://127.0.0.1:8765/*",
  ]);
  assert.ok(manifest.host_permissions.every((entry) => !entry.includes("<all_urls>")));
  assert.ok(manifest.host_permissions.every((entry) => !entry.startsWith("*://")));
});

test("the panel and restrictive extension CSP are declared", () => {
  assert.equal(manifest.side_panel.default_path, "sidepanel.html");
  assert.equal(manifest.background.type, "module");
  assert.match(manifest.content_security_policy.extension_pages, /script-src 'self'/);
  assert.match(manifest.content_security_policy.extension_pages, /object-src 'none'/);
  assert.ok(!manifest.content_security_policy.extension_pages.includes("'unsafe-eval'"));
  assert.ok(!manifest.content_security_policy.extension_pages.includes("'unsafe-inline'"));
});
