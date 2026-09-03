import { useRef, useState } from "react";
import { useOpsAuth } from "../ops-auth/OpsAuthContext.jsx";

export default function AdminRestaurantes() {
  const { authFetch, canSupervise, session, logout } = useOpsAuth();
  const createLockRef = useRef(false);
  const [displayName, setDisplayName] = useState("");
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");
  const [creating, setCreating] = useState(false);

  async function crearRestaurante() {
    if (!canSupervise || createLockRef.current) return;
    setMsg("");
    if (!displayName.trim() || !pin.trim()) return setMsg("Falta nombre o PIN inicial.");
    createLockRef.current = true;
    setCreating(true);
    try {
      const response = await authFetch("/api/ops/admin/restaurants/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim(),
          pin: pin.trim(),
        }),
      });
      const text = await response.text();
      if (!response.ok) {
        setMsg("No se pudo crear el restaurante.");
        return;
      }

      try {
        const payload = JSON.parse(text);
        setMsg(`Creado ✅ ${payload.id} — URL: ${payload.url}`);
      } catch {
        setMsg("Creado ✅");
      }

      setDisplayName("");
      setPin("");
    } catch {
      setMsg("No se pudo completar la operación. Comprueba la sesión e inténtalo de nuevo.");
    } finally {
      createLockRef.current = false;
      setCreating(false);
    }
  }

  if (!canSupervise) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950">
        <section className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-white p-6 shadow-xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-red-700">
            RTM OPS · acceso restringido
          </p>
          <h1 className="mt-2 text-2xl font-black">Permiso de supervisión necesario</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            La cuenta individual actual no puede administrar restaurantes.
          </p>
          <button onClick={logout} className="mt-5 rounded-xl border border-slate-300 px-4 py-2 font-bold">
            Cerrar sesión
          </button>
        </section>
      </main>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h2>🛠 Mini admin — Restaurantes</h2>

      <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.85)" }}>
        <div style={{ fontWeight: 800 }}>Sesión individual de supervisor</div>
        <div style={{ marginTop: 6, opacity: 0.8 }}>
          {session?.operator?.displayName || session?.operator?.email}
        </div>
      </div>

      <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.85)" }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Crear restaurante</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            Nombre (visible)
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={creating} style={{ padding: 10 }} />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            PIN inicial
            <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} disabled={creating} style={{ padding: 10 }} />
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button disabled={creating} onClick={crearRestaurante} style={{ padding: "10px 12px", fontWeight: 900 }}>
            {creating ? "Creando…" : "Crear"}
          </button>
        </div>

        {msg ? (
          <div style={{ marginTop: 10, fontWeight: 800 }}>
            {msg}
            {msg.includes("URL:") ? (
              <div style={{ marginTop: 6, opacity: 0.85 }}>
                Copia esa URL, abrela y entra con el PIN inicial.
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
