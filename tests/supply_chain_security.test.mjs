import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("CI and package metadata require a supported Node 24 toolchain", async () => {
  const [manifest, lock, signerManifest, workflow] = await Promise.all([
    read("package.json").then(JSON.parse),
    read("package-lock.json").then(JSON.parse),
    read("rtm-signer-station-client/package.json").then(JSON.parse),
    read(".github/workflows/rtm-frontend-ci.yml"),
  ]);

  assert.equal(manifest.engines?.node, "24.x");
  assert.equal(lock.packages?.[""]?.engines?.node, "24.x");
  assert.equal(signerManifest.engines?.node, "24.x");
  assert.match(workflow, /node-version: "24[.]20[.]0"/);

  const build = manifest.scripts?.build || "";
  const preflight = "verify-production-build.mjs preflight";
  const compiler = "node_modules/vite/bin/vite.js build";
  const bundle = "verify-production-build.mjs bundle";
  assert.ok(build.indexOf(preflight) < build.indexOf(compiler));
  assert.ok(build.indexOf(compiler) < build.indexOf(bundle));
});

test("CI pins actions, drops credentials and disables dependency lifecycle scripts", async () => {
  const [workflow, npmConfiguration] = await Promise.all([
    read(".github/workflows/rtm-frontend-ci.yml"),
    read(".npmrc"),
  ]);
  const actionReferences = [...workflow.matchAll(/uses:\s+[^@\s]+@([^\s#]+)/g)].map(
    (match) => match[1]
  );

  assert.ok(actionReferences.length >= 3);
  assert.ok(actionReferences.every((reference) => /^[0-9a-f]{40}$/.test(reference)));
  assert.match(
    workflow,
    /actions\/setup-python@5fda3b95a4ea91299a34e894583c3862153e4b97/
  );
  assert.match(workflow, /python-version: "3[.]12"/);
  assert.match(
    workflow,
    /python -m unittest discover -s tests -p "test_\*\.py" -v/
  );
  assert.match(workflow, /persist-credentials:\s+false/);
  assert.match(workflow, /runs-on:\s+ubuntu-24[.]04/);
  assert.doesNotMatch(workflow, /ubuntu-latest/);
  assert.match(workflow, /npm run security:secrets -- --history/);
  assert.ok(workflow.indexOf("security:secrets") < workflow.indexOf("npm ci"));
  assert.match(workflow, /npm ci --ignore-scripts/);
  assert.match(workflow, /npm audit --audit-level=high/);
  assert.match(npmConfiguration, /^ignore-scripts=true$/m);
});
