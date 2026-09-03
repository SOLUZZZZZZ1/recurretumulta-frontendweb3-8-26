import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  scanRepository,
  scanRepositoryHistory,
  scanText,
} from "../scripts/scan-secrets.mjs";

function git(root, args) {
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
}

test("secret scanner detects high-confidence credentials without returning values", () => {
  const token = "gh" + "p_" + "Ab1".repeat(12);
  const findings = scanText(`credential=${token}`, "sample.txt");
  assert.deepEqual(findings, [
    { path: "sample.txt", line: 1, kind: "github_token" },
  ]);
  assert.equal(JSON.stringify(findings).includes(token), false);
});

test("secret scanner includes non-ignored untracked files", async () => {
  const root = await mkdtemp(join(tmpdir(), "rtm-frontend-secret-scan-"));
  const init = spawnSync("git", ["init", "--quiet", root]);
  assert.equal(init.status, 0);
  const token = "sk-" + "Ab9_".repeat(8);
  await writeFile(join(root, "untracked.txt"), token, "utf8");
  const findings = scanRepository(root);
  assert.equal(findings.some((finding) => finding.path === "untracked.txt"), true);
  assert.equal(JSON.stringify(findings).includes(token), false);
});

test("synthetic URL credentials are allowlisted only by exact path and digest", () => {
  const value = "https" + "://user:secret@checkout.stripe.com";
  assert.deepEqual(scanText(value, "tests/safe_navigation.test.mjs"), []);
  assert.equal(scanText(value, "another.test.mjs")[0].kind, "url_with_userinfo");
});

test("secret scanner detects key-aware high-entropy assignments", () => {
  const secret = ["aB7!qZ2@", "mN9#vK4$", "rT6%wX8&", "cD3*pL5?"].join("");
  const samples = [
    `const clientSecret = "${secret}";`,
    `{"access_token":"${secret}"}`,
    `const operatorSessionToken = "${secret}";`,
    `STRIPE_SECRET_KEY="${secret}"`,
    `API_KEY=${secret.replaceAll("!", "A").replaceAll("@", "B").replaceAll("#", "C").replaceAll("$", "D").replaceAll("%", "E").replaceAll("&", "F").replaceAll("*", "G").replaceAll("?", "H")}`,
  ];

  for (const [index, sample] of samples.entries()) {
    const findings = scanText(sample, `sample-${index}.txt`);
    assert.equal(findings.some((finding) => finding.kind === "high_entropy_secret_assignment"), true);
    assert.equal(JSON.stringify(findings).includes(secret), false);
  }
});

test("key-aware entropy rule ignores placeholders and unrelated digests", () => {
  assert.deepEqual(scanText('apiKey = "replace_me_with_your_api_key"'), []);
  assert.deepEqual(scanText('token = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"'), []);
  assert.deepEqual(
    scanText('sha256 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"'),
    []
  );
  assert.deepEqual(scanText("clientSecret = process.env.CLIENT_SECRET"), []);
});

test("scanner covers backend-style secret keys and authorization formats", () => {
  const opaque = ["A7bC9dEf", "G2hJ4kLm", "N6pQ8rSt", "U1vW3xYz", "B5cD7eFg"].join("");
  const jwt = ["eyJ", "hbGciOiJIUzI1NiJ9", ".", "ZXlKcFpDSTZJakV5TXlKOS", ".", opaque].join("");
  const cases = [
    [`B2_APPLICATION_KEY=${opaque}`, "high_entropy_secret_assignment"],
    [`OPERATOR_TOKEN=${opaque}`, "high_entropy_secret_assignment"],
    [`ADMIN_TOKEN=${opaque}`, "high_entropy_secret_assignment"],
    [`AWS_SECRET_ACCESS_KEY=${opaque}`, "aws_secret_access_key_assignment"],
    [`Authorization: Bearer ${opaque}`, "bearer_credential"],
    [`Authorization: Basic ${opaque}`, "basic_authorization"],
    [jwt, "jwt_token"],
  ];
  for (const [source, expectedKind] of cases) {
    const findings = scanText(source, "backend-style.env");
    assert.equal(
      findings.some((finding) => finding.kind === expectedKind),
      true,
      expectedKind
    );
    assert.equal(JSON.stringify(findings).includes(opaque), false);
  }
});

test("history mode detects a removed credential without returning its value", async () => {
  const root = await mkdtemp(join(tmpdir(), "rtm-frontend-secret-history-"));
  git(root, ["init", "--quiet"]);
  const secret = ["R7aQ9bC2", "dE4fG6hJ", "kL8mN1pS", "tU3vW5xZ"].join("");
  const path = join(root, "retired.env");
  await writeFile(path, `OPERATOR_TOKEN=${secret}\n`, "utf8");
  git(root, ["add", "retired.env"]);
  git(root, [
    "-c",
    "user.name=RTM Security Test",
    "-c",
    "user.email=security-test@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "fixture with retired credential",
  ]);

  await writeFile(path, "OPERATOR_TOKEN=replace_me\n", "utf8");
  git(root, ["add", "retired.env"]);
  git(root, [
    "-c",
    "user.name=RTM Security Test",
    "-c",
    "user.email=security-test@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "retire fixture credential",
  ]);

  assert.deepEqual(scanRepository(root), []);
  const findings = scanRepositoryHistory(root);
  assert.equal(
    findings.some(
      (finding) =>
        finding.path === "history:retired.env" &&
        finding.kind === "high_entropy_secret_assignment"
    ),
    true
  );
  assert.equal(JSON.stringify(findings).includes(secret), false);
});

test("history mode scans commit messages without returning credential values", async () => {
  const root = await mkdtemp(join(tmpdir(), "rtm-frontend-secret-commit-message-"));
  git(root, ["init", "--quiet"]);
  const secret = ["J7kL9mN2", "pQ4rS6tU", "vW8xY1zB", "cD3eF5gH"].join("");
  await writeFile(join(root, "safe.txt"), "safe\n", "utf8");
  git(root, ["add", "safe.txt"]);
  git(root, [
    "-c",
    "user.name=RTM Security Test",
    "-c",
    "user.email=security-test@example.invalid",
    "commit",
    "--quiet",
    "-m",
    `fixture metadata\n\nOPERATOR_TOKEN=${secret}`,
  ]);

  assert.deepEqual(scanRepository(root), []);
  const findings = scanRepositoryHistory(root);
  assert.equal(
    findings.some(
      (finding) =>
        /^history:commit-message-[0-9a-f]{12}$/u.test(finding.path) &&
        finding.kind === "high_entropy_secret_assignment"
    ),
    true
  );
  assert.equal(JSON.stringify(findings).includes(secret), false);
});

test("history mode fails closed for a binary-looking commit message", async () => {
  const root = await mkdtemp(join(tmpdir(), "rtm-frontend-binary-commit-message-"));
  git(root, ["init", "--quiet"]);
  await writeFile(join(root, "safe.txt"), "safe\n", "utf8");
  git(root, ["add", "safe.txt"]);
  git(root, [
    "-c",
    "user.name=RTM Security Test",
    "-c",
    "user.email=security-test@example.invalid",
    "commit",
    "--quiet",
    "-m",
    `binary metadata fixture\n\n${String.fromCharCode(1).repeat(80)}`,
  ]);

  const findings = scanRepositoryHistory(root);
  assert.equal(
    findings.some(
      (finding) =>
        /^history:commit-message-[0-9a-f]{12}$/u.test(finding.path) &&
        finding.kind === "binary_repository_history_message"
    ),
    true
  );
});

test("history mode scans annotated tag messages without returning credential values", async () => {
  const root = await mkdtemp(join(tmpdir(), "rtm-frontend-secret-tag-message-"));
  git(root, ["init", "--quiet"]);
  await writeFile(join(root, "safe.txt"), "safe\n", "utf8");
  git(root, ["add", "safe.txt"]);
  git(root, [
    "-c",
    "user.name=RTM Security Test",
    "-c",
    "user.email=security-test@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "safe fixture commit",
  ]);

  const secret = ["Z8yX6wV4", "uT2sR9qP", "nM7kJ5hG", "fD3cB1aE"].join("");
  git(root, [
    "-c",
    "user.name=RTM Security Test",
    "-c",
    "user.email=security-test@example.invalid",
    "tag",
    "-a",
    "security-fixture",
    "-m",
    `ADMIN_TOKEN=${secret}`,
  ]);

  assert.deepEqual(scanRepository(root), []);
  const findings = scanRepositoryHistory(root);
  assert.equal(
    findings.some(
      (finding) =>
        /^history:tag-message-[0-9a-f]{12}$/u.test(finding.path) &&
        finding.kind === "high_entropy_secret_assignment"
    ),
    true
  );
  assert.equal(JSON.stringify(findings).includes(secret), false);
});
