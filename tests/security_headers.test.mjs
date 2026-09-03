import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function directives(value) {
  return new Map(
    value
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...tokens] = part.split(/\s+/);
        return [name, tokens];
      })
  );
}

test("Vercel applies the defensive header set to every path", async () => {
  const config = JSON.parse(await read("vercel.json"));
  assert.equal(config.$schema, "https://openapi.vercel.sh/vercel.json");

  const globalRule = config.headers.find((rule) => rule.source === "/:path*");
  assert.ok(globalRule, "missing global Vercel header rule");
  const headers = new Map(
    globalRule.headers.map(({ key, value }) => [key.toLowerCase(), value])
  );

  assert.equal(headers.get("referrer-policy"), "no-referrer");
  assert.equal(headers.get("x-content-type-options"), "nosniff");
  assert.equal(headers.get("x-frame-options"), "DENY");
  assert.equal(headers.get("strict-transport-security"), "max-age=31536000");
  assert.equal(headers.get("x-permitted-cross-domain-policies"), "none");

  const permissions = headers.get("permissions-policy") || "";
  for (const feature of ["camera", "microphone", "geolocation", "payment", "usb"] ) {
    assert.match(permissions, new RegExp(`(?:^|, )${feature}=\\(\\)(?:,|$)`));
  }
});

test("CSP blocks injection and limits API egress to the exact public rooms origin", async () => {
  const config = JSON.parse(await read("vercel.json"));
  const globalRule = config.headers.find((rule) => rule.source === "/:path*");
  const csp = globalRule.headers.find(
    ({ key }) => key.toLowerCase() === "content-security-policy"
  )?.value;
  assert.ok(csp, "missing Content-Security-Policy");

  const policy = directives(csp);
  assert.deepEqual(policy.get("default-src"), ["'self'"]);
  assert.deepEqual(policy.get("base-uri"), ["'none'"]);
  assert.deepEqual(policy.get("connect-src"), [
    "'self'",
    "https://backend-spainroom.onrender.com",
  ]);
  assert.deepEqual(policy.get("frame-ancestors"), ["'none'"]);
  assert.deepEqual(policy.get("frame-src"), ["'none'"]);
  assert.deepEqual(policy.get("object-src"), ["'none'"]);
  assert.deepEqual(policy.get("script-src"), ["'self'"]);
  assert.deepEqual(policy.get("script-src-attr"), ["'none'"]);
  assert.deepEqual(policy.get("worker-src"), ["'none'"]);
  assert.ok(policy.has("upgrade-insecure-requests"));
  assert.doesNotMatch(csp, /unsafe-eval/i);
  const externalSources = [...policy.values()]
    .flat()
    .filter((token) => /^https?:\/\//i.test(token));
  assert.deepEqual(externalSources, ["https://backend-spainroom.onrender.com"]);

  const inlineDirectives = [...policy.entries()]
    .filter(([, tokens]) => tokens.includes("'unsafe-inline'"))
    .map(([name]) => name)
    .sort();
  assert.deepEqual(inlineDirectives, ["style-src-attr", "style-src-elem"]);
});

test("the Vite entrypoint contains no inline script requiring a CSP exception", async () => {
  const html = await read("index.html");
  const scripts = html.match(/<script\b[^>]*>/gi) || [];
  assert.ok(scripts.length > 0);
  for (const script of scripts) assert.match(script, /\ssrc=/i);
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
});

test("authenticated and case-scoped pages are never cached or indexed", async () => {
  const config = JSON.parse(await read("vercel.json"));
  for (const source of [
    "/ops",
    "/ops/:path*",
    "/partner/:path*",
    "/gestorias",
    "/__reservas-restaurante",
    "/__admin-restaurantes",
    "/eliminar-coche",
    "/resumen",
    "/autorizar",
    "/pago-ok",
    "/pago-cancel",
    "/gestorias/alta",
    "/multas/documentos",
    "/deudas/documentos",
    "/administracion/documentos",
    "/reclamaciones/documentos",
    "/otros/documentos",
  ]) {
    const rule = config.headers.find((candidate) => candidate.source === source);
    assert.ok(rule, `missing sensitive header rule for ${source}`);
    const headers = new Map(
      rule.headers.map(({ key, value }) => [key.toLowerCase(), value])
    );
    assert.equal(headers.get("cache-control"), "no-store, max-age=0");
    assert.equal(
      headers.get("x-robots-tag"),
      "noindex, nofollow, noarchive"
    );
  }
});

test("Trusted Types remains an explicit staged hardening decision", async () => {
  const [config, rationale] = await Promise.all([
    read("vercel.json"),
    read("docs/security-headers.md"),
  ]);
  assert.doesNotMatch(config, /require-trusted-types-for/i);
  assert.match(rationale, /Trusted Types/);
  assert.match(rationale, /staging con reporte de violaciones/i);
});
