// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.jsx";
import { bootstrapCaseAccessFromUrl } from "./lib/caseAccess.js";
import { purgeLegacyCaseLocalStorage } from "./lib/caseSession.js";
import { migratePartnerSession } from "./lib/partnerSession.js";
import { purgeLegacyRestaurantPinStorage } from "./lib/restaurantPin.js";
import { migrateLegacyHashRoute } from "./lib/legacyHashRoute.js";
import "./index.css";

/*
 * Compatibilidad con los enlaces históricos de HashRouter.
 *
 * Vercel ya entrega index.html para cualquier ruta pública. Antes de montar
 * BrowserRouter trasladamos /#/ruta a /ruta sin recargar, de modo que los
 * enlaces guardados siguen funcionando y las nuevas landings tienen una URL
 * pública limpia, compartible e indexable.
 */
purgeLegacyRestaurantPinStorage();
bootstrapCaseAccessFromUrl();
migrateLegacyHashRoute(window);
purgeLegacyCaseLocalStorage();
migratePartnerSession();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HelmetProvider>
      <Router>
        <App />
      </Router>
    </HelmetProvider>
  </React.StrictMode>
);
