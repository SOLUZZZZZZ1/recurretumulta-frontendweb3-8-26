import React from "react";
import { renderToString } from "react-dom/server";
import { HelmetProvider } from "react-helmet-async";
import { StaticRouter } from "react-router-dom/server";
import PublicSeoApp from "./PublicSeoApp.jsx";

export function renderPublicRoute(location) {
  const helmetContext = {};
  const markup = renderToString(
    <HelmetProvider context={helmetContext}>
      <StaticRouter location={location}>
        <PublicSeoApp />
      </StaticRouter>
    </HelmetProvider>
  );
  const helmet = helmetContext.helmet;
  const head = [
    helmet.title.toString(),
    helmet.meta.toString(),
    helmet.link.toString(),
    helmet.script.toString(),
  ].filter(Boolean).join("\n");
  return { markup, head };
}
