import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { scanText } from "./scan-secrets.mjs";

const DIST_ROOT = new URL("../dist/", import.meta.url);
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
    throw new Error(
      "Las previews están bloqueadas hasta disponer de backend y datos de staging aislados"
    );
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
  if (mode !== "bundle") assertDeploymentEnvironmentSafe();
  if (mode !== "preflight") await verifyProductionBuild();
}
