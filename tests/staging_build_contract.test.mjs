import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import {
  assertDeploymentEnvironmentSafe,
  assertDeploymentRoutingSafe,
  verifyDeploymentPreflight,
} from "../scripts/verify-production-build.mjs";

const ROOT = new URL("../", import.meta.url);
const run = promisify(execFile);
const STAGING = Object.freeze({
  RTM_STAGING_RELEASE_CONFIRMATION: "RTM_STAGING_ISOLATED_REVIEWED",
  VERCEL: "1",
  VERCEL_ENV: "preview",
  VERCEL_TARGET_ENV: "preview",
  VERCEL_PROJECT_ID: "prj_mOgYzD9oofcJMmla5hFmVVpmuKxV",
  VERCEL_GIT_PROVIDER: "github",
  VERCEL_GIT_REPO_OWNER: "SOLUZZZZZZ1",
  VERCEL_GIT_REPO_SLUG: "recurretumulta-frontendweb3-8-26",
  VERCEL_GIT_COMMIT_REF: "rtm-ai-security-hardening-2026-09-03",
  VERCEL_BRANCH_URL:
    "recurretumulta-frontendweb3-8-26-git-r-cbbb3a-soluzzzs-projects.vercel.app",
  RTM_STAGING_FRONTEND_ORIGIN:
    "https://recurretumulta-frontendweb3-8-26-git-r-cbbb3a-soluzzzs-projects.vercel.app",
  RTM_STAGING_BACKEND_ORIGIN: "https://recurretumulta-backend-1.onrender.com",
});
const PRODUCTION = Object.freeze({
  VERCEL: "1",
  VERCEL_ENV: "production",
  VERCEL_GIT_PROVIDER: "github",
  VERCEL_GIT_REPO_OWNER: "SOLUZZZZZZ1",
  VERCEL_GIT_REPO_SLUG: "recurretumulta-frontendweb3-8-26",
  VERCEL_GIT_COMMIT_REF: "main",
});
const config = JSON.parse(await readFile(new URL("vercel.json", ROOT), "utf8"));
const cleanEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !/^(VERCEL|RTM_STAGING_)/.test(key))
);

test("reviewed staging contract passes against the actual Vercel rewrite before Vite", async () => {
  await assert.doesNotReject(verifyDeploymentPreflight(STAGING));
  await run(process.execPath, ["scripts/verify-production-build.mjs", "preflight"], {
    cwd: ROOT,
    env: { ...cleanEnvironment, ...STAGING },
  });
  const packageJson = JSON.parse(await readFile(new URL("package.json", ROOT), "utf8"));
  assert.match(
    packageJson.scripts.build,
    /^node scripts\/verify-production-build\.mjs preflight && node node_modules\/vite\/bin\/vite\.js build && node scripts\/verify-production-build\.mjs bundle$/
  );
});

test("every missing or altered staging contract field fails closed", () => {
  for (const [key, expected] of Object.entries(STAGING)) {
    const missing = { ...STAGING };
    delete missing[key];
    // A missing VERCEL_ENV still has VERCEL=1, so the production source guard rejects it.
    assert.throws(() => assertDeploymentEnvironmentSafe(missing), undefined, `missing ${key}`);
    for (const value of ["", `${expected}-altered`, ` ${expected}`, `${expected} `]) {
      assert.throws(
        () => assertDeploymentEnvironmentSafe({ ...STAGING, [key]: value }),
        undefined,
        `altered ${key}`
      );
    }
  }
});

test("generic previews, release confirmation alone and unauthorized delivery identities fail", () => {
  for (const environment of [
    { VERCEL_ENV: "preview" },
    { VERCEL: "1", VERCEL_ENV: "preview", RTM_STAGING_RELEASE_CONFIRMATION: STAGING.RTM_STAGING_RELEASE_CONFIRMATION },
    { ...STAGING, VERCEL_ENV: "production" },
    { ...STAGING, VERCEL_TARGET_ENV: "production" },
    { ...STAGING, VERCEL_TARGET_ENV: "custom-staging" },
    { ...STAGING, VERCEL_GIT_COMMIT_REF: "main" },
    { ...STAGING, VERCEL_GIT_COMMIT_REF: "feature/example" },
    { ...STAGING, VERCEL_GIT_PROVIDER: "gitlab" },
    { ...STAGING, VERCEL_GIT_REPO_OWNER: "fork-owner" },
    { ...STAGING, VERCEL_PROJECT_ID: "prj_unreviewed" },
    { ...STAGING, VERCEL_GIT_PULL_REQUEST_ID: "123" },
  ]) {
    assert.throws(() => assertDeploymentEnvironmentSafe(environment));
  }
});

test("branch URL and origins require exact HTTPS staging values", () => {
  const host = STAGING.VERCEL_BRANCH_URL;
  for (const value of [
    `${host}.attacker.test`, `https://${host}`, `${host}/`, `${host}:443`,
    "recurretumulta-frontend-staging.vercel.app", "recurretumulta.eu",
  ]) {
    assert.throws(() => assertDeploymentEnvironmentSafe({ ...STAGING, VERCEL_BRANCH_URL: value }));
  }
  for (const key of ["RTM_STAGING_FRONTEND_ORIGIN", "RTM_STAGING_BACKEND_ORIGIN"]) {
    for (const value of [
      STAGING[key].replace("https:", "http:"), `${STAGING[key]}/`,
      `${STAGING[key]}:443`, `${STAGING[key]}.attacker.test`, `${STAGING[key]}/api`,
      `${STAGING[key]}?target=other`, `${STAGING[key]}#other`,
      STAGING[key].replace("https://", "https://user@"),
    ]) {
      assert.throws(() => assertDeploymentEnvironmentSafe({ ...STAGING, [key]: value }));
    }
  }
});

test("staging routing rejects missing, competing, conditional and changed rewrites", () => {
  const [api, fallback] = config.rewrites;
  for (const candidate of [
    {}, { rewrites: null }, { rewrites: {} }, { rewrites: [null, fallback] },
    { rewrites: [fallback] }, { rewrites: [api] },
    { rewrites: [fallback, api] }, { rewrites: [api, api, fallback] },
    { rewrites: [{ ...api, source: "/api/other/:path*" }, fallback] },
    { rewrites: [{ ...api, destination: "https://unreviewed.example/:path*" }, fallback] },
    { rewrites: [{ ...api, destination: "http://recurretumulta-backend-1.onrender.com/:path*" }, fallback] },
    { rewrites: [{ ...api, destination: `${STAGING.RTM_STAGING_BACKEND_ORIGIN}/api/:path*` }, fallback] },
    { rewrites: [{ ...api, destination: `${api.destination}?mode=other` }, fallback] },
    { rewrites: [{ ...api, has: [{ type: "header", key: "x-stage" }] }, fallback] },
    { rewrites: [{ ...api, missing: [] }, fallback] },
    { rewrites: [api, { ...fallback, destination: "https://unreviewed.example" }] },
    { ...config, routes: [{ src: "/api/(.*)", dest: "https://unreviewed.example/$1" }] },
    { ...config, redirects: [{ source: "/api/:path*", destination: "https://unreviewed.example/:path*", permanent: false }] },
  ]) {
    assert.throws(() => assertDeploymentRoutingSafe(STAGING, candidate), /routing de vercel.json/i);
  }
});

test("preflight reads the config file rather than trusting environment declarations", async () => {
  const directory = await mkdtemp(join(fileURLToPath(ROOT), ".staging-contract-"));
  const configPath = join(directory, "vercel.json");
  try {
    await assert.rejects(verifyDeploymentPreflight(STAGING, configPath), { code: "ENOENT" });
    await writeFile(configPath, "{");
    await assert.rejects(verifyDeploymentPreflight(STAGING, configPath), SyntaxError);
    await writeFile(configPath, JSON.stringify({ rewrites: [] }));
    await assert.rejects(verifyDeploymentPreflight(STAGING, configPath), /routing de vercel.json/i);
    await writeFile(configPath, JSON.stringify(config));
    await assert.doesNotReject(verifyDeploymentPreflight(STAGING, configPath));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("production main source validation remains independent and cannot use the staging rewrite", async () => {
  assert.doesNotThrow(() => assertDeploymentEnvironmentSafe(PRODUCTION));
  // Routing without a staging backend reference does not invent a production backend.
  assert.doesNotThrow(() => assertDeploymentRoutingSafe(PRODUCTION, { rewrites: [] }));
  for (const routing of [
    { routes: [{ src: "/api/(.*)", dest: `${STAGING.RTM_STAGING_BACKEND_ORIGIN}/$1` }] },
    { redirects: [{ source: "/api/:path*", destination: `${STAGING.RTM_STAGING_BACKEND_ORIGIN}/:path*`, permanent: false }] },
    { rewrites: [{ source: "/api/:path*", destination: "https://recurretumulta-backend-1%2eonrender.com/:path*" }] },
    { routes: [{ src: "/api/(.*)", dest: "//recurretumulta-backend-1%2eonrender.com./$1" }] },
    { redirects: [{ source: "/api/:path*", destination: "https://recurretumulta-backend-1%2eonrender.com/:path*", permanent: false }] },
  ]) {
    assert.throws(() => assertDeploymentRoutingSafe(PRODUCTION, routing), /Producción está bloqueada/i);
  }
  await assert.rejects(verifyDeploymentPreflight(PRODUCTION), /Producción está bloqueada/i);
  await assert.rejects(
    run(process.execPath, ["scripts/verify-production-build.mjs", "preflight"], {
      cwd: ROOT, env: { ...cleanEnvironment, ...PRODUCTION },
    }),
    (error) => error.code === 1 && /Producción está bloqueada/i.test(error.stderr)
  );
  for (const patch of [
    { VERCEL_ENV: "development" }, { VERCEL_GIT_PROVIDER: "" },
    { VERCEL_GIT_REPO_OWNER: "fork-owner" }, { VERCEL_GIT_REPO_SLUG: "other-repository" },
    { VERCEL_GIT_COMMIT_REF: STAGING.VERCEL_GIT_COMMIT_REF },
  ]) {
    assert.throws(() => assertDeploymentEnvironmentSafe({ ...PRODUCTION, ...patch }));
  }
});

test("the real build command fails closed before Vite without the separate confirmation", async () => {
  const environment = { ...cleanEnvironment, ...STAGING };
  delete environment.RTM_STAGING_RELEASE_CONFIRMATION;
  const options = { cwd: ROOT, env: environment };
  const build = process.platform === "win32"
    ? run("cmd.exe", ["/d", "/s", "/c", "npm run build"], options)
    : run("npm", ["run", "build"], options);
  await assert.rejects(build, (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /RTM_STAGING_RELEASE_CONFIRMATION/);
    assert.doesNotMatch(error.stdout, /transforming|modules transformed|built in/);
    return true;
  });
});
