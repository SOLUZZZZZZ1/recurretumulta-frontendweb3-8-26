import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";

function retireLegacyPartnerTemplate() {
  let retiredOutput = "";
  return {
    name: "rtm-retire-legacy-partner-template",
    apply: "build",
    configResolved(config) {
      retiredOutput = resolve(
        config.root,
        config.build.outDir,
        "Mod.24-ES.pdf"
      );
    },
    async closeBundle() {
      if (!retiredOutput) {
        throw new Error("No se pudo resolver el PDF partner retirado.");
      }
      await rm(retiredOutput, { force: true });
    },
  };
}

function developmentProxyTarget() {
  const configured = String(
    process.env.RTM_DEV_API_PROXY_TARGET || "http://127.0.0.1:8000"
  ).trim();
  let target;
  try {
    target = new URL(configured);
  } catch {
    throw new Error("RTM_DEV_API_PROXY_TARGET debe ser un origen HTTP(S) válido.");
  }
  if (
    !["http:", "https:"].includes(target.protocol) ||
    target.username ||
    target.password ||
    target.pathname !== "/" ||
    target.search ||
    target.hash
  ) {
    throw new Error("RTM_DEV_API_PROXY_TARGET debe contener solo un origen HTTP(S).");
  }
  return target.origin;
}

export default defineConfig(({ command }) => ({
  plugins: [react(), retireLegacyPartnerTemplate()],
  server:
    command === "serve"
      ? {
          proxy: {
            "/api": {
              target: developmentProxyTarget(),
              changeOrigin: true,
            },
          },
        }
      : undefined,
}));
