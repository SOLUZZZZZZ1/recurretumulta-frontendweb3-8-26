import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("operator and portal display the synthetic no-legal-effect banner", async () => {
  const banner = "STAGING · SYNTHETIC ONLY · SIN EFECTO JURÍDICO";
  assert.match(await source("sidepanel.html"), new RegExp(banner));
  assert.match(await source("mock-portal/index.html"), new RegExp(banner));
});

test("extension code has no persistent storage or browser submission automation", async () => {
  const code = (
    await Promise.all([
      "background.js",
      "sidepanel.js",
      "lib/policy.js",
      "lib/synthetic-package.js",
      "lib/ticket-client.js",
      "lib/portal-attach.js",
    ].map(source))
  ).join("\n");

  for (const forbidden of [
    "chrome.storage",
    "localStorage",
    "sessionStorage",
    "indexedDB",
    "chrome.downloads",
    "chrome.debugger",
    "document.cookie",
    ".submit(",
    ".requestSubmit(",
  ]) {
    assert.ok(!code.includes(forbidden), forbidden);
  }
  assert.ok(!/\.click\s*\(/.test(code));
});

test("mock portal contains no form action and its only action is local validation", async () => {
  const html = await source("mock-portal/index.html");
  const script = await source("mock-portal/app.js");
  assert.ok(!/<form\b/i.test(html));
  assert.ok(!/type=["']submit["']/i.test(html));
  assert.ok(!/\bfetch\s*\(/.test(script));
  assert.ok(!/XMLHttpRequest/.test(script));
  assert.match(html, /id="validate-only" type="button"/);
});

test("operator copy is honest that attachment may upload before registration", async () => {
  const html = await source("sidepanel.html");
  const panel = await source("sidepanel.js");
  const readme = await source("README.md");

  assert.match(html, /pueden\s+subirlo en ese momento/i);
  assert.match(panel, /Puede haberse subido/);
  assert.match(readme, /puede iniciar la subida inmediatamente/i);
  assert.ok(!panel.includes("no se ha enviado nada"));
});
