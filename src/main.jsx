// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.jsx";
import "./index.css";

/*
 * Cortafuegos de entorno RTM.
 *
 * Cualquier llamada antigua que todavía apunte directamente a un backend
 * de Render se transforma en una llamada al proxy /api del entorno actual.
 *
 * Producción:
 *   /api → backend de producción
 *
 * Staging:
 *   /api → backend aislado de staging
 */
const KNOWN_BACKEND_ORIGINS = [
  "https://recurretumulta-backend.onrender.com",
  "https://recurretumulta-backend-1.onrender.com",
];

function toEnvironmentApiUrl(value) {
  const text = value instanceof URL ? value.toString() : value;

  if (typeof text !== "string") {
    return value;
  }

  const matchesKnownBackend = KNOWN_BACKEND_ORIGINS.some(
    (origin) => text === origin || text.startsWith(`${origin}/`)
  );

  if (!matchesKnownBackend) {
    return value;
  }

  const target = new URL(text);

  const pathname =
    target.pathname === "/api" || target.pathname.startsWith("/api/")
      ? target.pathname
      : `/api${
          target.pathname.startsWith("/")
            ? target.pathname
            : `/${target.pathname}`
        }`;

  return `${pathname}${target.search}${target.hash}`;
}

function installEnvironmentApiGuard() {
  const nativeFetch = window.fetch.bind(window);

  window.fetch = (input, init) => {
    if (typeof input === "string" || input instanceof URL) {
      return nativeFetch(toEnvironmentApiUrl(input), init);
    }

    return nativeFetch(input, init);
  };

  const nativeOpen = window.open.bind(window);

  window.open = (url, ...args) =>
    nativeOpen(toEnvironmentApiUrl(url), ...args);

  const nativeXhrOpen = XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.open = function open(method, url, ...args) {
    return nativeXhrOpen.call(
      this,
      method,
      toEnvironmentApiUrl(url),
      ...args
    );
  };
}

installEnvironmentApiGuard();

/*
 * Compatibilidad con los enlaces históricos de HashRouter.
 *
 * Vercel ya entrega index.html para cualquier ruta pública. Antes de montar
 * BrowserRouter trasladamos /#/ruta a /ruta sin recargar, de modo que los
 * enlaces guardados siguen funcionando y las nuevas landings tienen una URL
 * pública limpia, compartible e indexable.
 */
function migrateLegacyHashRoute() {
  const { hash, pathname } = window.location;

  if (pathname === "/" && hash.startsWith("#/")) {
    window.history.replaceState(null, "", hash.slice(1));
  }
}

migrateLegacyHashRoute();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HelmetProvider>
      <Router>
        <App />
      </Router>
    </HelmetProvider>
  </React.StrictMode>
);
