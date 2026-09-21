import React from "react";
import { Link } from "react-router-dom";

export default function LocalOpsPresenterUnavailable() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950">
      <section className="mx-auto max-w-xl rounded-3xl border border-amber-200 bg-white p-6 shadow-xl">
        <h1 className="text-2xl font-black">Presentación y firma no disponibles en local</h1>
        <p role="status" className="mt-4 text-sm leading-6 text-slate-700">
          Este entorno permite probar la gestión de OPS. La presentación y el puesto
          de firma todavía requieren el entorno de staging preparado para esos flujos.
        </p>
        <Link to="/ops/manual-presentador" className="mt-5 block font-bold text-blue-800">Consultar el manual del presentador</Link>
        <Link to="/ops" className="mt-5 inline-block font-bold text-blue-800">
          Volver a OPS
        </Link>
      </section>
    </main>
  );
}
