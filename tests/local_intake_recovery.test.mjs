import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

test("recovery panel compiles and is only exposed to local supervisors", async () => {
  for (const [local, supervisor] of [[false, true], [true, false], [true, true]]) {
    const server = await createServer({
      root: fileURLToPath(new URL("../", import.meta.url)),
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: "custom", logLevel: "silent",
      plugins: [{ name: "recovery-test-context", enforce: "pre", transform(source, id) {
        if (!id.endsWith("/src/ops-auth/LocalIntakeRecovery.jsx")) return;
        return source
          .replace('import { useOpsAuth } from "./OpsAuthContext.jsx";', `const useOpsAuth = () => ({ canSupervise: ${supervisor}, authFetch: () => { throw Error('No request during render'); } });`)
          .replace('import { currentLocalOpsDevelopmentEnabled } from "./opsLocalDevelopment.js";', `const currentLocalOpsDevelopmentEnabled = () => ${local};`);
      } }],
    });
    try {
      const { default: Panel } = await server.ssrLoadModule("/src/ops-auth/LocalIntakeRecovery.jsx");
      const html = renderToString(React.createElement(StaticRouter, { location: "/ops" },
        React.createElement(Panel, { caseId: "35567a72-bb37-40e3-9456-8bc8fb9cb4f9" })));
      if (local && supervisor) assert.match(html, /Recuperar acceso local/);
      else assert.equal(html, "");
      assert.doesNotMatch(html, /case_access_token|access_token=|type="password"/);
    } finally { await server.close(); }
  }
});
