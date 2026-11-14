// src/main.jsx
import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.jsx";
import "./index.css";

// Keep existing shared links working while moving routes from #/path to /path.
function normalizeLegacyHashRoute() {
  const hashRoute = window.location.hash;
  if (!hashRoute.startsWith("#/")) return;

  const legacyLocation = hashRoute.slice(1);
  const fragmentIndex = legacyLocation.indexOf("#");
  const fragment = fragmentIndex >= 0 ? legacyLocation.slice(fragmentIndex + 1) : "";
  const routeAndSearch = fragmentIndex >= 0 ? legacyLocation.slice(0, fragmentIndex) : legacyLocation;
  const queryIndex = routeAndSearch.indexOf("?");
  const pathname = queryIndex >= 0 ? routeAndSearch.slice(0, queryIndex) : routeAndSearch;
  const routeSearch = queryIndex >= 0 ? routeAndSearch.slice(queryIndex + 1) : "";
  const searchParams = new URLSearchParams(window.location.search);

  new URLSearchParams(routeSearch).forEach((value, key) => {
    searchParams.set(key, value);
  });

  const search = searchParams.toString();
  const nextUrl = `${pathname || "/"}${search ? `?${search}` : ""}${fragment ? `#${fragment}` : ""}`;
  window.history.replaceState(window.history.state, "", nextUrl);
}

normalizeLegacyHashRoute();

const root = document.getElementById("root");
const renderApp = (
  <React.StrictMode>
    <HelmetProvider>
      <Router>
        <App />
      </Router>
    </HelmetProvider>
  </React.StrictMode>
);

// SPA fallbacks and legacy hash links can serve another route's HTML.
// Hydrate only when that HTML was rendered for the current page.
const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";
if (root.dataset.prerendered === "true" && root.dataset.prerenderedPath === currentPath) {
  hydrateRoot(root, renderApp);
} else {
  createRoot(root).render(renderApp);
}
