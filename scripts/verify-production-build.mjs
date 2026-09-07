import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { scanText } from "./scan-secrets.mjs";

const DIST_ROOT = new URL("../dist/", import.meta.url);
const VERCEL_CONFIG = new URL("../vercel.json", import.meta.url);
const STAGING_BACKEND_ORIGIN = "https://recurretumulta-backend-1.onrender.com";
// This nonsecret acknowledgement must be set separately in Vercel after review.
// Publishing this code must never authorize a preview by itself.
const EXPECTED_STAGING_ENVIRONMENT = Object.freeze({
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
  RTM_STAGING_BACKEND_ORIGIN: STAGING_BACKEND_ORIGIN,
});
const EXPECTED_VERCEL_SOURCE = Object.freeze({
  provider: "github",
  owner: "soluzzzzzz1",
  repository: "recurretumulta-frontendweb3-8-26",
  branch: "main",
});
export const FORBIDDEN_MARKERS = Object.freeze([
  "rtm_dev_mode",
  "rtm_mock_case_",
  "Autorizar_sandbox_pruebas",
  "ResumenExpediente_sandbox_pruebas",
  "AdminCrearAsesoria",
  "/admin/crear-asesoria",
  "x-admin-token",
]);
export const FORBIDDEN_PUBLIC_ARTIFACTS = Object.freeze(["Mod.24-ES.pdf"]);
const TEXT_EXTENSIONS = new Set([".css", ".html", ".js", ".json", ".map"]);

export function assertDeploymentEnvironmentSafe(environment = process.env) {
  const vercelEnvironment = String(environment.VERCEL_ENV || "").trim().toLowerCase();
  if (vercelEnvironment === "preview") {
    for (const [key, expected] of Object.entries(EXPECTED_STAGING_ENVIRONMENT)) {
      if (environment[key] !== expected) {
        throw new Error(
          `Las previews están bloqueadas: falta el contrato exacto de staging revisado (${key})`
        );
      }
    }
    if (environment.VERCEL_GIT_PULL_REQUEST_ID) {
      throw new Error("Las previews están bloqueadas para entregas de pull requests");
    }
    return;
  }
  if (String(environment.VERCEL || "").trim() !== "1") return;

  const source = {
    provider: String(environment.VERCEL_GIT_PROVIDER || "").trim().toLowerCase(),
    owner: String(environment.VERCEL_GIT_REPO_OWNER || "").trim().toLowerCase(),
    repository: String(environment.VERCEL_GIT_REPO_SLUG || "").trim().toLowerCase(),
    branch: String(environment.VERCEL_GIT_COMMIT_REF || "").trim(),
  };
  if (
    vercelEnvironment !== "production" ||
    source.provider !== EXPECTED_VERCEL_SOURCE.provider ||
    source.owner !== EXPECTED_VERCEL_SOURCE.owner ||
    source.repository !== EXPECTED_VERCEL_SOURCE.repository ||
    source.branch !== EXPECTED_VERCEL_SOURCE.branch
  ) {
    throw new Error(
      "El despliegue Vercel no coincide con el entorno, repositorio y rama de producción autorizados"
    );
  }
}

function referencesStagingBackend(value) {
  const stagingHost = new URL(STAGING_BACKEND_ORIGIN).hostname;
  if (typeof value === "string") {
    if (value.toLowerCase().includes(stagingHost)) return true;
    try {
      // URL parsing also catches encoded hostname dots and protocol-relative URLs.
      return new URL(value, "https://routing.invalid").hostname.replace(/\.$/, "") === stagingHost;
    } catch {
      return false;
    }
  }
  return value && typeof value === "object"
    ? Object.values(value).some(referencesStagingBackend)
    : false;
}

export function assertDeploymentRoutingSafe(environment, config) {
  const vercelEnvironment = String(environment.VERCEL_ENV || "").trim().toLowerCase();
  if (vercelEnvironment === "preview") {
    const expectedRewrites = [
      { source: "/api/:path*", destination: `${STAGING_BACKEND_ORIGIN}/:path*` },
      { source: "/:path*", destination: "/index.html" },
    ];
    const exactRewrites =
      Array.isArray(config?.rewrites) &&
      config.rewrites.length === expectedRewrites.length &&
      config.rewrites.every((rule, index) =>
        rule &&
        Object.keys(rule).length === 2 &&
        rule.source === expectedRewrites[index].source &&
        rule.destination === expectedRewrites[index].destination
      );
    if (!exactRewrites || config.routes || config.redirects?.length) {
      throw new Error(
        "El routing de vercel.json no coincide con el proxy /api de staging revisado"
      );
    }
  }
  if (
    vercelEnvironment === "production" &&
    referencesStagingBackend({
      rewrites: config?.rewrites,
      routes: config?.routes,
      redirects: config?.redirects,
    })
  ) {
    throw new Error(
      "Producción está bloqueada: vercel.json contiene el backend de staging"
    );
  }
}

export async function verifyDeploymentPreflight(
  environment = process.env,
  configPath = VERCEL_CONFIG
) {
  assertDeploymentEnvironmentSafe(environment);
  const config = JSON.parse(await readFile(configPath, "utf8"));
  assertDeploymentRoutingSafe(environment, config);
}

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = new URL(entry.name, directory);
    if (entry.isDirectory()) {
      files.push(...(await filesBelow(new URL(`${entry.name}/`, directory))));
    } else if (entry.isFile() && TEXT_EXTENSIONS.has(extname(entry.name))) {
      files.push(target);
    }
  }
  return files;
}

export async function verifyProductionBuild(directory = DIST_ROOT) {
  for (const artifact of FORBIDDEN_PUBLIC_ARTIFACTS) {
    try {
      await stat(new URL(artifact, directory));
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    throw new Error(`El build contiene un artefacto público retirado (${artifact})`);
  }
  for (const file of await filesBelow(directory)) {
    const source = await readFile(file, "utf8");
    if (scanText(source, "generated-production-bundle").length > 0) {
      throw new Error(
        "El build de producción contiene una posible credencial y ha sido bloqueado"
      );
    }
    const normalizedSource = source.toLowerCase();
    for (const marker of FORBIDDEN_MARKERS) {
      if (normalizedSource.includes(marker.toLowerCase())) {
        throw new Error(
          `El build contiene una superficie prohibida (${marker}) en ${join("dist", file.pathname.split("/dist/")[1] || "")}`
        );
      }
    }
  }
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (invokedPath === import.meta.url) {
  const mode = String(process.argv[2] || "all").trim().toLowerCase();
  if (!new Set(["all", "preflight", "bundle"]).has(mode)) {
    throw new Error("Modo de verificación de build no reconocido");
  }
  if (mode !== "bundle") await verifyDeploymentPreflight();
  if (mode !== "preflight") await verifyProductionBuild();
}
