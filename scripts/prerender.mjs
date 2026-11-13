import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";

const routes = [
  "/",
  "/trafico",
  "/como-funciona",
  "/precios",
  "/morosidad",
  "/administracion",
  "/viajes",
  "/faq",
  "/contacto",
  "/aviso-legal",
  "/privacidad",
  "/cookies",
];

const vite = await createServer({
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
});

try {
  const { renderPublicRoute } = await vite.ssrLoadModule("/src/prerender.jsx");
  const shellPath = path.resolve("dist/index.html");
  const shell = await readFile(shellPath, "utf8");

  for (const route of routes) {
    const { markup, head } = renderPublicRoute(route);
    let html = shell;
    const titleStart = html.indexOf("<title>");
    const titleEnd = html.indexOf("</title>", titleStart);
    if (titleStart >= 0 && titleEnd >= 0) {
      html = html.slice(0, titleStart) + html.slice(titleEnd + "</title>".length);
    }

    const descriptionPosition = html.indexOf('name="description"');
    if (descriptionPosition >= 0) {
      const tagStart = html.lastIndexOf("<meta", descriptionPosition);
      const tagEnd = html.indexOf("/>", descriptionPosition);
      if (tagStart >= 0 && tagEnd >= 0) {
        html = html.slice(0, tagStart) + html.slice(tagEnd + 2);
      }
    }

    if (!html.includes('<div id="root"></div>')) {
      throw new Error("No se encuentra el contenedor vacío de React en dist/index.html");
    }

    html = html
      .replace("</head>", head + "\n  </head>")
      .replace(
        '<div id="root"></div>',
        '<div id="root" data-prerendered="true">' + markup + "</div>"
      );

    const outputPath = route === "/"
      ? shellPath
      : path.resolve("dist", route.slice(1), "index.html");
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, html, "utf8");
  }

  console.log("Prerendered " + routes.length + " public RTM routes.");
} finally {
  await vite.close();
}
