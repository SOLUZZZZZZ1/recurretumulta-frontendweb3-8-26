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
      "portal-bridge.js",
      "sidepanel.js",
      "lib/policy.js",
      "lib/synthetic-package.js",
      "lib/ticket-client.js",
      "lib/portal-attach.js",
      "lib/synthetic-audit.js",
      "lib/reg-session-recovery.js",
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

test("mock portal contains no form action and only local human controls", async () => {
  const html = await source("mock-portal/index.html");
  const script = await source("mock-portal/app.js");
  assert.ok(!/<form\b/i.test(html));
  assert.ok(!/type=["']submit["']/i.test(html));
  assert.ok(!/\bfetch\s*\(/.test(script));
  assert.ok(!/XMLHttpRequest/.test(script));
  assert.match(html, /id="validate-only" type="button"/);
  assert.match(html, /id="close-simulation" type="button"/);
});

test("operator copy is honest that attachment may upload before registration", async () => {
  const html = await source("sidepanel.html");
  const panel = await source("sidepanel.js");
  const readme = await source("README.md");

  assert.match(html, /puede iniciar una subida/i);
  assert.match(panel, /pudo quedar asignado o empezar a subirse/i);
  assert.match(readme, /puede iniciar la subida inmediatamente/i);
  assert.ok(!panel.includes("no se ha enviado nada"));
});

test("an incorporated portal receipt remains pending without verified sent_at", async () => {
  const audit = await source("lib/synthetic-audit.js");
  assert.match(audit, /sentAt:\s*null/);
  assert.match(audit, /receiptVerified:\s*false/);
  assert.match(audit, /followUpSignal:\s*null/);
  assert.match(audit, /unverified_portal_document/);
  assert.match(audit, /status:\s*"receipt_pending"/);
  assert.ok(!audit.includes('followUpSignal: "receipt_verified"'));
});

test("receipt incorporation is explicit, in-memory and independent of downloads", async () => {
  const html = await source("mock-portal/index.html");
  const mock = await source("mock-portal/app.js");
  const bridge = await source("portal-bridge.js");
  const background = await source("background.js");
  assert.match(html, /id="receipt-download"/);
  assert.match(mock, /URL\.createObjectURL/);
  assert.match(mock, /receiptDownload\.download = filename/);
  assert.match(bridge, /Incorporar justificante a RTM/);
  assert.match(bridge, /clickEvent\.isTrusted/);
  assert.match(bridge, /portal\.receipt\.incorporate\.v1/);
  assert.match(background, /pendingReceiptBytes/);
  assert.match(background, /status:\s*"receipt_pending"/);
  assert.match(background, /receiptVerified:\s*false/);
  assert.match(background, /sentAt:\s*null/);
  assert.ok(!background.includes("chrome.downloads"));
  assert.ok(!bridge.includes("chrome.downloads"));
  assert.ok(!/downloads\.on/i.test(background));
});
