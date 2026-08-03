import { useState } from "react";

export default function AdminRestaurantes() {
  const [adminToken, setAdminToken] = useState(() => sessionStorage.getItem("admin_token") || "");
  const [adminTokenInput, setAdminTokenInput] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");

  function guardarToken() {
    if (!adminTokenInput.trim()) return;
    sessionStorage.setItem("admin_token", adminTokenInput.trim());
    setAdminToken(adminTokenInput.trim());
    setAdminTokenInput("");
    setMsg("ADMIN_TOKEN guardado ✅");
  }

  function borrarToken() {
    sessionStorage.removeItem("admin_token");
    setAdminToken("");
    setAdminTokenInput("");
    setMsg("ADMIN_TOKEN borrado.");
  }

  async function crearRestaurante() {
    setMsg("");
    if (!adminToken) return setMsg("Falta ADMIN_TOKEN.");
    if (!displayName.trim() || !pin.trim()) return setMsg("Falta nombre o PIN inicial.");

    const r = await fetch("/api/ops/admin/restaurants/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": adminToken,
      },
      body: JSON.stringify({
        display_name: displayName.trim(),
        pin: pin.trim(),
      }),
    });

    const text = await r.text();
    if (!r.ok) {
      setMsg("Error: " + text);
      return;
    }

    try {
      const j = JSON.parse(text);
      setMsg(`Creado ✅ ${j.id} — URL: ${j.url}`);
    } catch {
      setMsg("Creado ✅");
    }

    setDisplayName("");
    setPin("");
  }

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h2>🛠 Mini admin — Restaurantes</h2>

      <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.85)" }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>ADMIN_TOKEN</div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="password"
            placeholder="Pega aquí tu ADMIN_TOKEN"
            value={adminToken ? "••••••••" : adminTokenInput}
            onChange={(e) => setAdminTokenInput(e.target.value)}
            disabled={Boolean(adminToken)}
            style={{ padding: 10, flex: "1 1 360px" }}
          />

          {!adminToken ? (
            <button onClick={guardarToken} style={{ padding: "10px 12px", fontWeight: 900 }}>
              Guardar token
            </button>
          ) : (
            <button onClick={borrarToken} style={{ padding: "10px 12px" }}>
              Borrar token
            </button>
          )}
        </div>
      </div>

      <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.85)" }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Crear restaurante</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            Nombre (visible)
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={{ padding: 10 }} />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            PIN inicial
            <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} style={{ padding: 10 }} />
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button onClick={crearRestaurante} style={{ padding: "10px 12px", fontWeight: 900 }}>
            Crear
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
