#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  lstatSync,
  readFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_LINE_BYTES = 2 * 1024 * 1024;
const BINARY_SAMPLE_BYTES = 8192;
const MAX_HISTORY_LIST_BYTES = 128 * 1024 * 1024;
const HISTORY_BATCH_BYTES = 16 * 1024 * 1024;
const HISTORY_BATCH_OVERHEAD_BYTES = 2 * 1024 * 1024;

const RULES = Object.freeze([
  ["pem_private_key", /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g],
  ["github_token", /\b(?:gh[pousr]_[A-Za-z0-9_]{20,255}|github_pat_[A-Za-z0-9_]{22,255})\b/g],
  ["openai_api_key", /\bsk-(?:(?:proj|svcacct)-)?[A-Za-z0-9_-]{20,}\b/g],
  ["stripe_secret_key", /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g],
  ["aws_access_key_id", /\b(?:AKIA|ASIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA)[A-Z0-9]{16}\b/g],
  ["slack_token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g],
  ["sendgrid_api_key", /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g],
  ["google_api_key", /\bAIza[0-9A-Za-z_-]{35}\b/g],
  [
    "jwt_token",
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{16,}\b/g,
  ],
  [
    "bearer_credential",
    /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/gi,
  ],
  [
    "basic_authorization",
    /\bBasic\s+[A-Za-z0-9+/]{20,}={0,2}/gi,
  ],
  [
    "aws_secret_access_key_assignment",
    /\bAWS_SECRET_ACCESS_KEY\s*(?:=|:)\s*["']?[A-Za-z0-9/+=]{32,128}/gi,
  ],
  [
    "url_with_userinfo",
    /\b[A-Za-z][A-Za-z0-9+.-]*:\/\/[^/\s:@<>"']+:[^/@\s<>"']+@[A-Za-z0-9.-]+(?::[0-9]{1,5})?/gi,
  ],
]);

const ASSIGNMENT_KEY_SOURCE = "[A-Za-z][A-Za-z0-9_-]{1,79}";
const QUOTED_SECRET_ASSIGNMENT = new RegExp(
  "(?:^|[,;{\\s])(?:const\\s+|let\\s+|var\\s+)?[\\\"']?(" +
    ASSIGNMENT_KEY_SOURCE +
    ")[\\\"']?\\s*(?:=|:)\\s*([\\\"'`])([^\\\"'`\\r\\n]{24,4096})\\2",
  "gi"
);
const ENV_SECRET_ASSIGNMENT = new RegExp(
  "^\\s*(?:export\\s+)?(" +
    ASSIGNMENT_KEY_SOURCE +
    ")\\s*=\\s*([A-Za-z0-9+/=_-]{24,4096})\\s*(?:#.*)?$",
  "i"
);
const PLACEHOLDER_MARKERS = /(?:example|sample|dummy|fake|placeholder|change(?:me|_me)|replace(?:me|_me)|redacted|not[_-]?a[_-]?secret|your[_-]?|x{5,}|<[^>]+>|\$\{|process\.env|import\.meta)/i;

const SYNTHETIC_URL_FINGERPRINTS = new Map([
  [
    "tests/rtm_presenter_model.test.mjs",
    new Set(["79a2adc70b4f63416775ba28ee0290184ec17c4ddab87a6af9569e74c545c0c7"]),
  ],
  [
    "tests/safe_navigation.test.mjs",
    new Set(["b40840c2a55ac834d46185e306e93ee028de772e8d81fc9de3e390ae10cfe3d1"]),
  ],
]);

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function allowlisted(path, kind, value) {
  const repositoryPath = String(path).startsWith("history:")
    ? String(path).slice("history:".length)
    : path;
  return (
    kind === "url_with_userinfo" &&
    SYNTHETIC_URL_FINGERPRINTS.get(repositoryPath)?.has(sha256(value)) === true
  );
}

function shannonEntropy(value) {
  const frequencies = new Map();
  for (const character of value) {
    frequencies.set(character, (frequencies.get(character) || 0) + 1);
  }
  let entropy = 0;
  for (const count of frequencies.values()) {
    const probability = count / value.length;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}

function looksLikeHighEntropySecret(value) {
  if (
    typeof value !== "string" ||
    value.length < 24 ||
    value.length > 4096 ||
    PLACEHOLDER_MARKERS.test(value) ||
    /\s/.test(value)
  ) {
    return false;
  }
  const uniqueCharacters = new Set(value).size;
  return uniqueCharacters >= 10 && shannonEntropy(value) >= 3.5;
}

function looksLikeSensitiveKey(value) {
  const parts = String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/[_-]+/)
    .filter(Boolean);
  const finalPart = parts.at(-1) || "";
  if (["password", "passwd", "secret", "token", "credential"].includes(finalPart)) {
    return true;
  }
  return (
    finalPart === "key" &&
    parts.some((part) =>
      [
        "api",
        "access",
        "private",
        "signing",
        "encryption",
        "stripe",
        "openai",
        "aws",
        "webhook",
        "application",
        "b2",
      ].includes(part)
    )
  );
}

function hasHighEntropySecretAssignment(line) {
  QUOTED_SECRET_ASSIGNMENT.lastIndex = 0;
  for (const match of line.matchAll(QUOTED_SECRET_ASSIGNMENT)) {
    if (
      looksLikeSensitiveKey(match[1]) &&
      looksLikeHighEntropySecret(match[3])
    ) {
      return true;
    }
  }
  ENV_SECRET_ASSIGNMENT.lastIndex = 0;
  const envMatch = ENV_SECRET_ASSIGNMENT.exec(line);
  return Boolean(
    envMatch &&
      looksLikeSensitiveKey(envMatch[1]) &&
      looksLikeHighEntropySecret(envMatch[2])
  );
}

export function scanText(text, path = "input") {
  const findings = [];
  const seen = new Set();
  const lines = text.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (Buffer.byteLength(line, "utf8") > MAX_LINE_BYTES) {
      findings.push({ path, line: index + 1, kind: "oversized_text_line" });
      continue;
    }
    for (const [kind, pattern] of RULES) {
      pattern.lastIndex = 0;
      for (const match of line.matchAll(pattern)) {
        if (allowlisted(path, kind, match[0])) continue;
        const identity = `${index + 1}:${kind}`;
        if (!seen.has(identity)) {
          findings.push({ path, line: index + 1, kind });
          seen.add(identity);
        }
      }
    }
    if (hasHighEntropySecretAssignment(line)) {
      const kind = "high_entropy_secret_assignment";
      const identity = `${index + 1}:${kind}`;
      if (!seen.has(identity)) {
        findings.push({ path, line: index + 1, kind });
        seen.add(identity);
      }
    }
  }
  return findings;
}

function looksBinary(buffer) {
  const sample = buffer.subarray(0, BINARY_SAMPLE_BYTES);
  if (sample.includes(0)) return true;
  if (sample.length === 0) return false;
  let controls = 0;
  for (const byte of sample) {
    if (byte < 9 || (byte > 13 && byte < 32)) controls += 1;
  }
  return controls / sample.length > 0.2;
}

export function repositoryPaths(root) {
  const result = spawnSync(
    "git",
    ["-C", root, "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { encoding: null, maxBuffer: 32 * 1024 * 1024 }
  );
  if (result.error || result.status !== 0) {
    throw new Error("repository_files_unavailable");
  }
  return result.stdout
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
}

export function scanRepository(root) {
  const findings = [];
  for (const relativePath of repositoryPaths(root)) {
    const absolutePath = resolve(root, relativePath);
    let stat;
    try {
      stat = lstatSync(absolutePath);
    } catch {
      continue;
    }
    if (stat.isSymbolicLink() || !stat.isFile()) continue;
    if (stat.size > MAX_FILE_BYTES) {
      findings.push({ path: relativePath, line: 0, kind: "oversized_repository_file" });
      continue;
    }
    let bytes;
    try {
      bytes = readFileSync(absolutePath);
    } catch {
      findings.push({ path: relativePath, line: 0, kind: "unreadable_file" });
      continue;
    }
    if (!looksBinary(bytes)) {
      findings.push(...scanText(bytes.toString("utf8"), relativePath));
    }
  }
  return findings;
}

function runGit(root, args, options = {}) {
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding: null,
    maxBuffer: options.maxBuffer || MAX_HISTORY_LIST_BYTES,
    input: options.input,
  });
  if (
    result.error ||
    result.status !== 0 ||
    !Buffer.isBuffer(result.stdout)
  ) {
    throw new Error("repository_history_unavailable");
  }
  return result.stdout;
}

function historyObjectNames(root) {
  const output = runGit(root, ["rev-list", "--objects", "--all", "-z"]);
  const records = output.toString("utf8").split("\0");
  const objects = [];
  const byHash = new Map();
  let current = null;

  for (const record of records) {
    if (!record) continue;
    if (/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/u.test(record)) {
      current = byHash.get(record);
      if (!current) {
        current = { hash: record, path: "" };
        byHash.set(record, current);
        objects.push(current);
      }
      continue;
    }
    if (record.startsWith("path=") && current) {
      if (!current.path) current.path = record.slice("path=".length);
      continue;
    }
    throw new Error("repository_history_invalid_object_list");
  }

  if (objects.length === 0) {
    throw new Error("repository_history_empty");
  }
  return objects;
}

function historyObjectMetadata(root) {
  const objects = historyObjectNames(root);
  const input = Buffer.from(
    `${objects.map(({ hash }) => hash).join("\n")}\n`,
    "ascii"
  );
  const output = runGit(
    root,
    ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"],
    { input }
  );
  const lines = output.toString("ascii").trimEnd().split("\n");
  if (lines.length !== objects.length) {
    throw new Error("repository_history_invalid_metadata");
  }

  return objects.map((object, index) => {
    const match = lines[index].match(
      /^([0-9a-f]{40}(?:[0-9a-f]{24})?) ([a-z]+) ([0-9]+)$/u
    );
    if (!match || match[1] !== object.hash) {
      throw new Error("repository_history_invalid_metadata");
    }
    const size = Number(match[3]);
    if (!Number.isSafeInteger(size) || size < 0) {
      throw new Error("repository_history_invalid_object_size");
    }
    return { ...object, type: match[2], size };
  });
}

function historyFindingPath(blob) {
  return `history:${blob.path || `object-${blob.hash.slice(0, 12)}`}`;
}

function historyMessageFindingPath(object) {
  return `history:${object.type}-message-${object.hash.slice(0, 12)}`;
}

function scanHistoryBatch(root, blobs) {
  const input = Buffer.from(
    `${blobs.map(({ hash }) => hash).join("\n")}\n`,
    "ascii"
  );
  const contentBytes = blobs.reduce((total, blob) => total + blob.size, 0);
  const output = runGit(root, ["cat-file", "--batch"], {
    input,
    maxBuffer: contentBytes + HISTORY_BATCH_OVERHEAD_BYTES,
  });
  const findings = [];
  let offset = 0;

  for (const blob of blobs) {
    const headerEnd = output.indexOf(10, offset);
    if (headerEnd < 0) {
      throw new Error("repository_history_invalid_blob_header");
    }
    const header = output.subarray(offset, headerEnd).toString("ascii");
    const match = header.match(
      /^([0-9a-f]{40}(?:[0-9a-f]{24})?) blob ([0-9]+)$/u
    );
    if (
      !match ||
      match[1] !== blob.hash ||
      Number(match[2]) !== blob.size
    ) {
      throw new Error("repository_history_invalid_blob_header");
    }
    const contentStart = headerEnd + 1;
    const contentEnd = contentStart + blob.size;
    if (contentEnd >= output.length || output[contentEnd] !== 10) {
      throw new Error("repository_history_truncated_blob");
    }
    const bytes = output.subarray(contentStart, contentEnd);
    if (!looksBinary(bytes)) {
      findings.push(
        ...scanText(bytes.toString("utf8"), historyFindingPath(blob))
      );
    }
    offset = contentEnd + 1;
  }

  if (offset !== output.length) {
    throw new Error("repository_history_unexpected_blob_data");
  }
  return findings;
}

function scanHistoryMessageBatch(root, objects) {
  const input = Buffer.from(
    `${objects.map(({ hash }) => hash).join("\n")}\n`,
    "ascii"
  );
  const contentBytes = objects.reduce((total, object) => total + object.size, 0);
  const output = runGit(root, ["cat-file", "--batch"], {
    input,
    maxBuffer: contentBytes + HISTORY_BATCH_OVERHEAD_BYTES,
  });
  const findings = [];
  let offset = 0;

  for (const object of objects) {
    const headerEnd = output.indexOf(10, offset);
    if (headerEnd < 0) {
      throw new Error("repository_history_invalid_message_header");
    }
    const header = output.subarray(offset, headerEnd).toString("ascii");
    const match = header.match(
      /^([0-9a-f]{40}(?:[0-9a-f]{24})?) (commit|tag) ([0-9]+)$/u
    );
    if (
      !match ||
      match[1] !== object.hash ||
      match[2] !== object.type ||
      Number(match[3]) !== object.size
    ) {
      throw new Error("repository_history_invalid_message_header");
    }
    const contentStart = headerEnd + 1;
    const contentEnd = contentStart + object.size;
    if (contentEnd >= output.length || output[contentEnd] !== 10) {
      throw new Error("repository_history_truncated_message_object");
    }
    const bytes = output.subarray(contentStart, contentEnd);
    const messageStart = bytes.indexOf(Buffer.from("\n\n", "ascii"));
    if (messageStart < 0) {
      throw new Error("repository_history_invalid_message_object");
    }
    const message = bytes.subarray(messageStart + 2);
    const findingPath = historyMessageFindingPath(object);
    if (looksBinary(message)) {
      findings.push({
        path: findingPath,
        line: 0,
        kind: "binary_repository_history_message",
      });
    } else {
      let text;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(message);
      } catch {
        findings.push({
          path: findingPath,
          line: 0,
          kind: "invalid_utf8_repository_history_message",
        });
        offset = contentEnd + 1;
        continue;
      }
      findings.push(
        ...scanText(text, findingPath)
      );
    }
    offset = contentEnd + 1;
  }

  if (offset !== output.length) {
    throw new Error("repository_history_unexpected_message_data");
  }
  return findings;
}

export function scanRepositoryHistory(root) {
  const findings = [];
  const eligibleBlobs = [];
  const eligibleMessages = [];
  for (const object of historyObjectMetadata(root)) {
    if (!["blob", "commit", "tag"].includes(object.type)) continue;
    const isMessage = object.type === "commit" || object.type === "tag";
    const findingPath = isMessage
      ? historyMessageFindingPath(object)
      : historyFindingPath(object);
    if (object.size > MAX_FILE_BYTES) {
      findings.push({
        path: findingPath,
        line: 0,
        kind: isMessage
          ? "oversized_repository_history_message"
          : "oversized_repository_history_blob",
      });
    } else if (isMessage) {
      eligibleMessages.push(object);
    } else {
      eligibleBlobs.push(object);
    }
  }

  const scanBatches = (objects, scanBatch) => {
    let batch = [];
    let batchBytes = 0;
    const flush = () => {
      if (batch.length > 0) findings.push(...scanBatch(root, batch));
      batch = [];
      batchBytes = 0;
    };
    for (const object of objects) {
      if (
        batch.length > 0 &&
        batchBytes + object.size > HISTORY_BATCH_BYTES
      ) {
        flush();
      }
      batch.push(object);
      batchBytes += object.size;
    }
    flush();
  };
  scanBatches(eligibleBlobs, scanHistoryBatch);
  scanBatches(eligibleMessages, scanHistoryMessageBatch);
  return findings;
}

function safePath(path) {
  return [...String(path)]
    .map((character) => (/^[\x20-\x7e]$/u.test(character) ? character : "?"))
    .join("");
}

export function main(
  root = resolve(fileURLToPath(new URL("..", import.meta.url))),
  { history = false } = {}
) {
  let findings;
  try {
    findings = scanRepository(root);
    if (history) findings.push(...scanRepositoryHistory(root));
  } catch {
    console.error(
      "Secret scan failed: repository files or reachable Git history could not be read safely."
    );
    return 2;
  }
  if (findings.length > 0) {
    console.error("Secret scan failed: potential credentials were found.");
    for (const finding of findings) {
      console.error(`${safePath(finding.path)}:${finding.line}:${finding.kind}`);
    }
    console.error(`Findings: ${findings.length}`);
    return 1;
  }
  console.log(
    history
      ? "Secret scan passed: no credential signatures or suspicious secret assignments found in repository files or reachable Git history."
      : "Secret scan passed: no credential signatures or suspicious secret assignments found in tracked or non-ignored untracked text files."
  );
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((argument) => argument !== "--history")) {
    console.error("Usage: node scripts/scan-secrets.mjs [--history]");
    process.exitCode = 2;
  } else {
    process.exitCode = main(undefined, { history: args.includes("--history") });
  }
}
