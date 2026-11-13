// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
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

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HelmetProvider>
      <Router>
        <App />
      </Router>
    </HelmetProvider>
  </React.StrictMode>
);
