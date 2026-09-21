import assert from "node:assert/strict";
import test from "node:test";
import viteConfig from "../vite.config.js";

test("the development proxy strips only the API prefix and preserves query data", () => {
  const config = viteConfig({ command: "serve" });
  const rewrite = config.server.proxy["/api"].rewrite;
  for (const [input, expected] of [
    ["/api/health", "/health"],
    ["/api/ops/auth/status", "/ops/auth/status"],
    ["/api/ops/queue?status=all&limit=500", "/ops/queue?status=all&limit=500"],
    ["/api", "/"], ["/api/", "/"], ["/api?x=1", "/?x=1"],
    ["/apiary", "/apiary"], ["/ops/api/health", "/ops/api/health"],
  ]) assert.equal(rewrite(input), expected);
  assert.equal(viteConfig({ command: "build" }).server, undefined);
});
