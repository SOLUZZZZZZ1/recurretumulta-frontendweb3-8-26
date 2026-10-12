import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter, Routes, Route } from "react-router-dom";
import * as helmetAsync from "react-helmet-async";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import { saveIntakeDraft } from "../src/lib/intakeAuthorizationFlow.js";

// Render the actual screen and routing, not a replacement fixture component.
// SSR proves controls/copy/compilation only. It does NOT prove browser clicks,
// HTTP intake, database/B2 persistence, OPS readback or legal authorization.
const HelmetProvider = helmetAsync.HelmetProvider || helmetAsync.default?.HelmetProvider;
let server;
let Intake;
let ClientSummary;
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
  ClientSummary = (await server.ssrLoadModule("/src/components/IntakeClientSummary.jsx")).default;
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

const CONTACT_NOTICE = "La persona de contacto puede ser distinta de la persona interesada. Utilizaremos estos datos para las comunicaciones relacionadas con el expediente.";

function assertContactNotice(html) {
  // One paragraph in the contact group, independent of traffic-specific copy.
  const paragraph = html.match(/<h3[^>]*>Contacto para esta gestión<\/h3><dl[\s\S]*?<\/dl><p[^>]*>([^<]*)<\/p>/);
  assert.ok(paragraph, "the notice stays directly below the contact details");
  assert.equal(paragraph[1], CONTACT_NOTICE);
  assert.equal(html.split(CONTACT_NOTICE).length - 1, 1);
  assert.doesNotMatch(html, /El contacto puede ser distinto del interesado|No determina quién conducía ni quién figura en la documentación/);
}

const INTERESTED_NOTICE = "Nombre y documento de la persona a cuyo nombre se tramitará el asunto. No se sustituyen por los datos de quien inicia sesión, paga o ayuda a completar el formulario.";

function assertInterestedNotice(html) {
  // Inspect the real full form: the summary alone missed this residual notice.
  const paragraph = html.match(/>2\. Persona interesada y contacto<\/h[1-6]>\s*<p[^>]*>([^<]*)<\/p>/);
  assert.ok(paragraph, "one paragraph immediately below the interested/contact heading");
  assert.equal(paragraph[1], INTERESTED_NOTICE);
  assert.equal(html.split(INTERESTED_NOTICE).length - 1, 1);
  assert.doesNotMatch(html, /Tampoco determinan por sí solos quién conducía\./);
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
    assertContactNotice(html);
    assertInterestedNotice(html);
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
  test(`${family} summary retains the neutral notice after a simulated save`, async () => {
    const service = catalog.find(item => item.id === family);
    let saved = null;
    await saveIntakeDraft({
      createDraft: async () => ({ caseId: "11111111-1111-4111-8111-111111111111", blockedMessage: "" }),
      persistDraft: draft => { saved = draft; },
    });
    // This checks the summary's saved state, not HTTP or real persistence.
    const html = renderToString(React.createElement(ClientSummary, {
      fields: {
        full_name: "PERSONA INTERESADA FICTICIA", dni_nie: "RTMTEST001",
        domicilio_notif: "Calle Ficticia 1", email: "contacto@example.com",
        telefono: "600000000", preferred_contact: "email",
      },
      familyTitle: service.title, caseTypeLabel: "Tipo de prueba",
      hasCase: Boolean(saved) && !saved.blockedMessage,
    }));
    assertContactNotice(html);
    assert.match(html, /Datos utilizados en la solicitud de alta/);
    assert.doesNotMatch(html, /Todavía no se han enviado/);
    assert.match(html, /PERSONA INTERESADA FICTICIA/);
    assert.match(html, /contacto@example.com/);
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
