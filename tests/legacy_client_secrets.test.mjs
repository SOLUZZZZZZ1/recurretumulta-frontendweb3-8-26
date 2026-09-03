import assert from "node:assert/strict";
import { mkdtemp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const { purgeLegacyRestaurantPinStorage } = await import(
  "../src/lib/restaurantPin.js"
);
const { bindRestaurantSessionLifecycle } = await import(
  "../src/lib/restaurantSessionLifecycle.js"
);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = new URL(entry.name, directory);
    if (entry.isDirectory()) {
      files.push(...(await sourceFiles(new URL(`${entry.name}/`, directory))));
    } else if (entry.isFile() && /\.(?:js|jsx)$/.test(entry.name)) {
      files.push(target);
    }
  }
  return files;
}

test("restaurant PIN stays in memory and legacy browser storage is purged", async () => {
  const [source, main, purgeSource] = await Promise.all([
    read("src/pages/ReservasRestaurante.jsx"),
    read("src/main.jsx"),
    read("src/lib/restaurantPin.js"),
  ]);

  assert.match(source, /const \[pin, setPin\] = useState\(\(\) => \{\s*purgeLegacyRestaurantPinStorage\(\);\s*return "";/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
  assert.match(purgeSource, /browserWindow\?\.\[storageName\]\?\.removeItem\(LEGACY_PIN_STORAGE_KEY\)/);
  assert.ok(
    main.indexOf("purgeLegacyRestaurantPinStorage();") < main.indexOf("createRoot("),
    "legacy restaurant PIN must be purged before React mounts"
  );
  assert.match(source, /bindRestaurantSessionLifecycle\(window, \(\) => bloquear\(\)\)/);
  assert.match(source, /function confirmarPin\(\)[\s\S]*?purgeLegacyRestaurantPinStorage\(\)[\s\S]*?setPin\(v\)/);
  assert.match(source, /function bloquear\(reason = ""\)[\s\S]*?purgeLegacyRestaurantPinStorage\(\)[\s\S]*?setPin\(""\)/);
  assert.equal((source.match(/\bfetch\(/g) || []).length, 1);
  assert.match(source, /credentials: "same-origin"/);
  assert.match(source, /redirect: "error"/);
  assert.match(
    source,
    /const search = new URLSearchParams\(location\.search \|\| ""\)[\s\S]*?if \(search\.has\("r"\)\)/
  );
  assert.match(source, /RESTAURANT_ID_PATTERN\.test\(value\)/);
  assert.match(
    source,
    /if \(restaurantId !== previousRestaurantIdRef\.current\) \{\s*bloquear\(\);\s*previousRestaurantIdRef\.current = restaurantId/
  );
  assert.match(
    source,
    /const response = await restaurantFetch[\s\S]*?if \(!response\.ok\)[\s\S]*?setPin\(v\)/
  );
  assert.match(source, /response\.status === 401 \|\| response\.status === 403[\s\S]*?bloquear\(/);
  assert.match(source, /pin && pinRestaurantId === restaurantId/);
  assert.match(source, /pinRestaurantId !== requestedRestaurantId/);
  assert.match(source, /requestIsCurrent\(request\)/);
  assert.match(source, /pinRef\.current = ""/);
  assert.match(source, /setForm\(emptyForm\(turno\)\)/);
  assert.match(source, /function closePinPanel\(\)[\s\S]*?setPinCurrent\(""\)[\s\S]*?setPinNew2\(""\)/);
  assert.match(source, /sensitiveRootRef\.current\?\.setAttribute\("hidden", ""\)/);
  assert.match(source, /hidden=\{!sensitiveViewVisible\}/);
  assert.match(source, /const safeReason = typeof reason === "string" \? reason : ""/);
  assert.match(source, /onClick=\{\(\) => bloquear\(\)\}/);
  assert.doesNotMatch(source, /onClick=\{bloquear\}/);
  assert.match(source, /La aplicación no almacena el PIN/);
  assert.equal((source.match(/type="password"/g) || []).length, 4);
  assert.equal((source.match(/autoComplete="off"/g) || []).length, 4);
  assert.match(source, /actionPendingRef\.current/);
  assert.match(source, /actionAbortRef\.current\?\.abort\(\)/);
  assert.match(source, /"Idempotency-Key": idempotencyKey/);
  assert.match(source, /reservationIdempotencyKeyRef\.current/);
  assert.match(source, /disabled=\{Boolean\(pendingAction\)\}/);
});

test("restaurant memory session is invalidated on exit and bfcache restore", () => {
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
  const reasons = [];
  const unbind = bindRestaurantSessionLifecycle(browserWindow, (reason) =>
    reasons.push(reason)
  );

  listeners.get("pagehide")({ persisted: true });
  listeners.get("pageshow")({ persisted: false });
  listeners.get("pageshow")({ persisted: true });
  assert.deepEqual(reasons, ["pagehide", "pageshow-persisted"]);

  unbind();
  assert.deepEqual(
    removed.map(([type]) => type),
    ["pagehide", "pageshow"]
  );
});

test("legacy restaurant PIN purge removes both stores and tolerates blocked storage", () => {
  const removed = [];
  purgeLegacyRestaurantPinStorage({
    sessionStorage: { removeItem: (key) => removed.push(["session", key]) },
    localStorage: { removeItem: (key) => removed.push(["local", key]) },
  });
  assert.deepEqual(removed, [
    ["session", "reservas_pin"],
    ["local", "reservas_pin"],
  ]);

  assert.doesNotThrow(() =>
    purgeLegacyRestaurantPinStorage({
      get sessionStorage() {
        throw new Error("blocked");
      },
      get localStorage() {
        throw new Error("blocked");
      },
    })
  );
});

test("unrouted PII sandbox pages and their production markers are absent", async () => {
  for (const path of [
    "src/pages/Autorizar_sandbox_pruebas.jsx",
    "src/pages/ResumenExpediente_sandbox_pruebas.jsx",
  ]) {
    await assert.rejects(stat(new URL(path, root)), { code: "ENOENT" });
  }

  const files = await sourceFiles(new URL("src/", root));
  const combined = (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
  assert.doesNotMatch(combined, /rtm_dev_mode|rtm_mock_case_|sandbox_pruebas/);

  const packageJson = JSON.parse(await read("package.json"));
  assert.match(packageJson.scripts.build, /verify-production-build\.mjs/);
});

test("production verifier rejects retired admin and laboratory surfaces", async () => {
  const {
    FORBIDDEN_MARKERS,
    FORBIDDEN_PUBLIC_ARTIFACTS,
    assertDeploymentEnvironmentSafe,
    verifyProductionBuild,
  } = await import(
    "../scripts/verify-production-build.mjs"
  );
  assert.throws(
    () => assertDeploymentEnvironmentSafe({ VERCEL_ENV: "preview" }),
    /previews están bloqueadas/i
  );
  assert.doesNotThrow(() =>
    assertDeploymentEnvironmentSafe({ VERCEL_ENV: "production" })
  );
  const authorizedVercelProduction = {
    VERCEL: "1",
    VERCEL_ENV: "production",
    VERCEL_GIT_PROVIDER: "github",
    VERCEL_GIT_REPO_OWNER: "SOLUZZZZZZ1",
    VERCEL_GIT_REPO_SLUG: "recurretumulta-frontendweb3-8-26",
    VERCEL_GIT_COMMIT_REF: "main",
  };
  assert.doesNotThrow(() =>
    assertDeploymentEnvironmentSafe(authorizedVercelProduction)
  );
  for (const patch of [
    { VERCEL_ENV: "development" },
    { VERCEL_GIT_COMMIT_REF: "attacker-branch" },
    { VERCEL_GIT_REPO_OWNER: "attacker" },
    { VERCEL_GIT_REPO_SLUG: "lookalike-repository" },
    { VERCEL_GIT_PROVIDER: "" },
  ]) {
    assert.throws(
      () =>
        assertDeploymentEnvironmentSafe({
          ...authorizedVercelProduction,
          ...patch,
        }),
      /despliegue Vercel no coincide/i
    );
  }
  const directory = await mkdtemp(join(tmpdir(), "rtm-build-verifier-"));
  try {
    await mkdir(join(directory, "assets"));
    await writeFile(join(directory, "assets", "clean.js"), "console.log('rtm');");
    await assert.doesNotReject(
      verifyProductionBuild(new URL(`file://${directory}/`))
    );

    for (const artifact of FORBIDDEN_PUBLIC_ARTIFACTS) {
      await writeFile(join(directory, artifact), "retired");
      await assert.rejects(
        verifyProductionBuild(new URL(`file://${directory}/`)),
        /artefacto público retirado/i
      );
      await rm(join(directory, artifact));
    }

    const injectedCredential = "gh" + "p_" + "Q8m".repeat(12);
    await writeFile(
      join(directory, "assets", "credential.js"),
      `const credential=${JSON.stringify(injectedCredential)};`
    );
    await assert.rejects(
      verifyProductionBuild(new URL(`file://${directory}/`)),
      (error) => {
        assert.match(String(error?.message), /posible credencial/i);
        assert.doesNotMatch(String(error?.message), new RegExp(injectedCredential));
        return true;
      }
    );
    await rm(join(directory, "assets", "credential.js"));

    for (const marker of FORBIDDEN_MARKERS) {
      await writeFile(join(directory, "assets", "probe.js"), `const probe=${JSON.stringify(marker)};`);
      await assert.rejects(
        verifyProductionBuild(new URL(`file://${directory}/`)),
        new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      );
    }
    await writeFile(
      join(directory, "assets", "probe.js"),
      "const retiredHeader = 'X-Admin-Token';"
    );
    await assert.rejects(
      verifyProductionBuild(new URL(`file://${directory}/`)),
      /x-admin-token/i
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
