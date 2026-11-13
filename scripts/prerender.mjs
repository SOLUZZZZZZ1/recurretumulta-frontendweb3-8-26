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
    let html = shell
      .replace(/<title>[\\s\\S]*?<\\/title>\\s*/i, "")
      .replace(/<meta\\s+name="description"[\\s\\S]*?\\/>\\s*/i, "");

    if (!html.includes('<div id="root"></div>')) {
      throw new Error("No se encuentra el contenedor vacío de React en dist/index.html");
    }

    html = html
      .replace("</head>", `${head}\\n  </head>`)
      .replace(
        '<div id="root"></div>',
        `<div id="root" data-prerendered="true">${markup}</div>`
      );

    const outputPath = route === "/"
      ? shellPath
      : path.resolve("dist", route.slice(1), "index.html");
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, html, "utf8");
  }

  console.log(`Prerendered ${routes.length} public RTM routes.`);
} finally {
  await vite.close();
}
