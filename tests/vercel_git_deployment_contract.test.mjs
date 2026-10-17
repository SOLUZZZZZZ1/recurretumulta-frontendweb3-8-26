import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Git deployment exclusion is confined to the authorized integration branch", async () => {
  const config = JSON.parse(
    await readFile(new URL("../vercel.json", import.meta.url), "utf8")
  );

  // An overlapping true rule can override a false rule in Vercel. An exact
  // allowlist of configuration keys also prevents a global deployment ban
  // or an unintended change to main, staging production, or review branches.
  assert.deepEqual(config.git, {
    deploymentEnabled: {
      "rtm-ai-security-hardening-2026-09-03": false,
    },
  });
});
