import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

test("local Presenter and signer render a closed boundary before mounting staging clients", async () => {
  const previousLocation = globalThis.location;
  const previousFetch = globalThis.fetch;
  const previousFlag = process.env.VITE_RTM_LOCAL_OPERATOR_AUTH;
  let requests = 0;
  globalThis.location = { origin: "http://127.0.0.1:5173" };
  process.env.VITE_RTM_LOCAL_OPERATOR_AUTH = "1";
  globalThis.fetch = () => {
    requests += 1;
    throw new Error("No local presentation request is permitted");
  };
  const server = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: "custom",
    logLevel: "silent",
    plugins: [{
      // This client application uses a named CJS import accepted by Vite's client
      // bundler. Supply the equivalent interop for this server-only render test.
      name: "test-helmet-cjs-interop",
      enforce: "pre",
      transform(source, id) {
        if (!id.endsWith("/src/pages/OpsSignerStationPage.jsx")) return;
        return source.replace(
          'import { Helmet } from "react-helmet-async";',
          'import helmetPackage from "react-helmet-async"; const { Helmet } = helmetPackage;'
        );
      },
    }],
  });
  try {
    const { readOpsAuthStatus } = await server.ssrLoadModule("/src/ops-auth/opsAuthApi.js");
    const localStatusResponse = async () => ({
      ok: true, status: 200, text: async () => JSON.stringify({
        ok: true, individual_login_enabled: true, configuration_valid: true,
        auth_environment: "development", auth_profile: "local_development",
        local_only: true, staging_only: false, shared_ops_login_accepted: false,
      }),
    });
    await assert.rejects(readOpsAuthStatus({ fetchImpl: localStatusResponse }),
      (error) => error.code === "ops_auth.status_contract_invalid");
    const status = await readOpsAuthStatus({ fetchImpl: localStatusResponse, allowLocalDevelopment: true });
    assert.equal(status.authProfile, "local_development");
    const { OpsAuthProvider } = await server.ssrLoadModule("/src/ops-auth/OpsAuthContext.jsx");
    for (const modulePath of ["/src/pages/OpsPresenterPage.jsx", "/src/pages/OpsSignerStationPage.jsx"]) {
      const { default: Page } = await server.ssrLoadModule(modulePath);
      // There is deliberately no operator session. Mounting the staging Presenter
      // would access session.sessionId; mounting signer would expose its login.
      const html = renderToString(React.createElement(StaticRouter, { location: "/ops" },
        React.createElement(OpsAuthProvider, null, React.createElement(Page))));
      assert.match(html, /Presentación y firma no disponibles en local/);
      assert.doesNotMatch(html, /Identifica al firmante|type="password"|Staging · synthetic only/);
    }
    assert.equal(requests, 0);
  } finally {
    await server.close();
    if (previousLocation === undefined) delete globalThis.location;
    else globalThis.location = previousLocation;
    globalThis.fetch = previousFetch;
    if (previousFlag === undefined) delete process.env.VITE_RTM_LOCAL_OPERATOR_AUTH;
    else process.env.VITE_RTM_LOCAL_OPERATOR_AUTH = previousFlag;
  }
});
