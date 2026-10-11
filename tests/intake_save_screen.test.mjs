import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter, Routes, Route } from "react-router-dom";
import * as helmetAsync from "react-helmet-async";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

// Render the actual screen and routing, not a replacement fixture component.
// SSR proves controls/copy/compilation only. It does NOT prove browser clicks,
// HTTP intake, database/B2 persistence, OPS readback or legal authorization.
const HelmetProvider = helmetAsync.HelmetProvider || helmetAsync.default?.HelmetProvider;
let server;
let Intake;
let catalog;
before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: "custom", logLevel: "silent",
    plugins: [{
      // Node SSR requires default-import interop for this CommonJS package.
      // Keep the real Helmet implementation/provider; do not replace the form,
      // transport, validation, route selection or metadata with mock components.
      name: "intake-test-helmet-cjs-interop", enforce: "pre",
      transform(source, id) {
        if (!id.endsWith("/src/components/Seo.jsx")) return;
        const before = 'import { Helmet } from "react-helmet-async";';
        assert.ok(source.includes(before), "review the SSR compatibility adapter if Seo changes");
        return source.replace(before, 'import helmetPackage from "react-helmet-async";\nconst { Helmet } = helmetPackage;');
      },
    }],
  });
  Intake = (await server.ssrLoadModule("/src/pages/IniciarExpedienteRTM.jsx")).default;
  catalog = (await server.ssrLoadModule("/src/data/publicServices.js")).PUBLIC_SERVICE_FAMILIES;
});
after(async () => { await server?.close(); });

function render(location, rehearsal = null) {
  const element = React.createElement(Intake, { rehearsal });
  return renderToString(React.createElement(HelmetProvider, { context: {} },
    React.createElement(StaticRouter, { location },
      React.createElement(Routes, null,
        React.createElement(Route, { path: "/iniciar-expediente/:department?/:caseType?", element }),
        React.createElement(Route, { path: "/ops/ensayo/radar", element }),
      ),
    ),
  ));
}

for (const family of ["trafico", "viajes", "morosidad", "administracion", "bancos", "energia", "telecomunicaciones", "seguros"]) {
  test(`actual ${family} form renders save-first without requiring representation`, () => {
    const service = catalog.find(item => item.id === family);
    assert.ok(service?.intake, "use the existing catalogue route");
    const html = render(service.startPath);
    assert.equal((html.match(/<form\b/g) || []).length, 1);
    assert.match(html, /Guardar datos del expediente/);
    assert.match(html, /Resumen de los datos del formulario/);
    assert.match(html, /Contacto para esta gestión/);
    assert.match(html, /Todavía no se han enviado/);
    const submit = html.match(/<button\b[^>]*type="submit"[^>]*>/)?.[0];
    assert.ok(submit, "there must be a submit control");
    assert.doesNotMatch(submit, /disabled/);
    for (const field of ["full_name", "dni_nie", "email", "telefono", "street", "street_number", "floor", "door", "postal_code", "city", "province"]) {
      assert.match(html, new RegExp(`name="${field}"`));
    }
    assert.doesNotMatch(html, /Autorizo expresamente a RTM|Preparar autorización de este expediente/);
    assert.doesNotMatch(html, /checked=""|case_access_token|access_token=/);
    if (["bancos", "energia", "telecomunicaciones", "seguros", "morosidad", "viajes", "administracion"].includes(family)) {
      assert.match(html, /La autorización de este servicio todavía no está disponible/);
      assert.doesNotMatch(html, /Crear expediente y descargar autorización/);
    }
  });
}

test("unknown or crossed family routes never render a replacement traffic form", () => {
  for (const path of [
    "/iniciar-expediente/debt/asnef_equifax?family=bancos",
    "/iniciar-expediente/claims/consumer?family=vivienda",
    "/iniciar-expediente/unknown?family=trafico",
    "/iniciar-expediente/traffic/not_a_type?family=trafico",
  ]) {
    const html = render(path);
    assert.match(html, /No hemos abierto un expediente equivocado/);
    assert.doesNotMatch(html, /<form\b|Guardar datos del expediente/);
  }
});

test("the selector still renders nine choices and housing stays consultation-only", () => {
  const html = render("/iniciar-expediente");
  assert.equal(catalog.length, 9);
  assert.equal((html.match(/class="rtm-intake-family-card"/g) || []).length, 9);
  assert.equal(catalog.find(item => item.id === "vivienda").entryMode, "consultation");
  assert.match(html, /Consulta de encaje/);
  assert.doesNotMatch(html, /<form\b/);
});

test("the existing radar rehearsal retains its explicit fictional confirmation and combined action", () => {
  const rehearsal = { profile: { full_name: "PERSONA DE PRUEBA RTM", dni_nie: "RTMTEST001", email: "ensayo.radar@example.com" } };
  const html = render("/ops/ensayo/radar", rehearsal);
  assert.match(html, /Crear expediente y descargar autorización/);
  assert.match(html, /Confirmo que este ensayo utiliza únicamente datos ficticios/);
  assert.doesNotMatch(html, /Guardar datos del expediente|checked=""/);
  const renewal = render("/ops/ensayo/radar", { ...rehearsal, renewal: true });
  assert.match(renewal, /Renovar autorización de prueba/);
});

test("vehicle removal retains its own consent and continuation without a DGT checkbox", () => {
  const html = render("/iniciar-expediente/traffic/vehicle_removal?family=trafico");
  assert.match(html, /Crear expediente y continuar/);
  assert.match(html, /Esta alta no genera ni solicita una autorización DGT genérica/);
  assert.doesNotMatch(html, /Autorizo expresamente a RTM|Crear expediente y descargar autorización|checked=""/);
});
