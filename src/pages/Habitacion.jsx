// src/pages/HabitacionDetalle_PRO_Tabs.jsx — ficha sola (alto contraste), enlaces arriba y reservar
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

// BASE de HABITACIONES (backend API principal)
const ROOMS_BASE =
  (import.meta.env?.VITE_ROOMS_BASE?.trim?.() || "https://backend-spainroom.onrender.com");

// helper imágenes servidas por backend de rooms (/instance/*)
const isAbs = (u) => /^https?:\/\//i.test(u || "");
const withBase = (u) =>
  (u && !isAbs(u) && u.startsWith("/instance/")) ? `${ROOMS_BASE}${u}` : u;

// Meta demo por defecto para no dejar la vista vacía si la API viene incompleta
const DEMO_META = {
  cama: "135x200",
  ventana: true,
  cerradura: true,
  escritorio: true,
  enchufes: "2",
  bano_privado: false,
  superficie_m2: 18,
  precio: 400,
  estado: "Libre",
  fecha_disponibilidad: "2025-11-01",
  barrio: "Centro",
  orientacion: "exterior",
  planta: "3",
  metro: "L1",
  consumos_incluidos: true,
  normas: "No fumar. No fiestas.",
  otros: "Incluye WiFi y limpieza de zonas comunes.",
  descripcion: "Habitación luminosa con cama 135x200, escritorio y armario."
};

export default function HabitacionDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);

  useEffect(() => {
    let live = true;

    // Si es DEMO, no llamamos a la API
    if (id === "DEMO") {
      setRoom({ code: "DEMO", ciudad: "—", provincia: "—", images: { meta: { ...DEMO_META } } });
      return () => {};
    }

    (async () => {
      try {
        const r = await fetch(`${ROOMS_BASE}/api/rooms/${id}`);
        const j = await r.json();
        const imgs = j?.images || j?.images_json || {};
        const meta = { ...DEMO_META, ...(imgs.meta || {}) };
        if (!live) return;
        setRoom({ ...(j || {}), images: { ...imgs, meta } });
      } catch {
        if (!live) return;
        // Fallback demo
        setRoom({ code: id, ciudad: "—", provincia: "—", images: { meta: { ...DEMO_META } } });
      }
    })();

    return () => { live = false; };
  }, [id]);

  const images = room?.images || room?.images_json || {};
  const meta = images.meta || {};
  const precioToShow = meta.precio;

  const val = (x, suffix = "") => {
    if (x === true) return "Sí";
    if (x === false) return "No";
    if (x === 0) return `0${suffix}`.trim();
    if (x === null || x === undefined || x === "") return "—";
    return `${x}${suffix}`.trim();
  };

  // Colores con alto contraste (inline para ganar a cualquier CSS global)
  const colorText = "#0b1220";
  const colorMuted = "#475569";
  const dtStyle = { color: colorMuted };
  const ddStyle = { margin: 0, fontWeight: 800, color: colorText };

  return (
    <main className="min-h-screen" style={{ background: "#f8fafc", padding: "16px 0", color: colorText }}>
      {/* Asegura contraste en cualquier heredado */}
      <style>{`
        .sr-room-card, .sr-room-card * { color: ${colorText} !important; }
        .sr-room-muted { color: ${colorMuted} !important; }
        .sr-room-card dl dt { color: ${colorMuted} !important; }
        .sr-room-card dl dd { color: ${colorText} !important; }
      `}</style>

      <section className="container" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 16px" }}>
        {/* Enlaces arriba */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => navigate("/habitaciones")} className="sr-btn sr-btn--ghost">← Volver a Habitaciones</button>
            <div style={{ fontWeight: 900 }}>Habitación · {room?.code || id}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <a href={`/habitaciones/${room?.code || id}/fotos`} target="_blank" rel="noreferrer" className="sr-btn sr-btn--ghost">Ver fotos</a>
            <a href={`/habitaciones/${room?.code || id}/reservar`} target="_blank" rel="noreferrer" className="sr-btn sr-btn--primary">Reservar habitación</a>
          </div>
        </div>

        {/* FICHA */}
        <div className="sr-room-card" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, boxShadow: "0 8px 18px rgba(0,0,0,.08)" }}>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <h1 style={{ margin: 0 }}>{room?.direccion || ("Habitación " + (room?.code || id))}</h1>
            <div style={{ fontWeight: 900, color: "var(--sr-blue, #0b65d8)" }}>
              {typeof precioToShow === "number" ? `${precioToShow} €` : val(precioToShow)}
              <span style={{ color: "#64748b", marginLeft: 4, fontSize: 12 }}>/mes</span>
            </div>
          </header>

          {/* Línea alineada */}
          <div className="sr-room-muted" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline", margin: "6px 0 10px" }}>
            <span>{(room?.ciudad || "—")}{room?.provincia ? `, ${room.provincia}` : ""}</span>
            <span>· {val(meta.superficie_m2, " m²")}</span>
            <span>· {val(meta.estado)}</span>
          </div>

          {/* Equipamiento (texto claro) */}
          <div style={{ margin: "12px 0 0" }}>
            <h3 style={{ fontSize: 16, margin: "0 0 8px" }}>Equipamiento</h3>
            <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px", margin: 0 }}>
              <dt style={dtStyle}>Cama</dt><dd style={ddStyle}>{val(meta.cama)}</dd>
              <dt style={dtStyle}>Ventana</dt><dd style={ddStyle}>{val(meta.ventana)}</dd>
              <dt style={dtStyle}>Cerradura</dt><dd style={ddStyle}>{val(meta.cerradura)}</dd>
              <dt style={dtStyle}>Escritorio</dt><dd style={ddStyle}>{val(meta.escritorio)}</dd>
              <dt style={dtStyle}>Enchufes</dt><dd style={ddStyle}>{val(meta.enchufes)}</dd>
              <dt style={dtStyle}>Baño privado</dt><dd style={ddStyle}>{val(meta.bano_privado)}</dd>
            </dl>
          </div>

          {/* Especificaciones */}
          <div style={{ marginTop: 12 }}>
            <h3 style={{ fontSize: 16, margin: "0 0 8px" }}>Especificaciones</h3>
            <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px", margin: 0 }}>
              <dt style={dtStyle}>Disponible desde</dt><dd style={ddStyle}>{val(meta.fecha_disponibilidad)}</dd>
              <dt style={dtStyle}>Barrio</dt><dd style={ddStyle}>{val(meta.barrio)}</dd>
              <dt style={dtStyle}>Orientación</dt><dd style={ddStyle}>{val(meta.orientacion)}</dd>
              <dt style={dtStyle}>Planta</dt><dd style={ddStyle}>{val(meta.planta)}</dd>
              <dt style={dtStyle}>Metro / línea</dt><dd style={ddStyle}>{val(meta.metro)}</dd>
              <dt style={dtStyle}>Consumos incluidos</dt><dd style={ddStyle}>{val(meta.consumos_incluidos)}</dd>
            </dl>
          </div>

          {/* Descripción / Normas / Otros */}
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Descripción</div>
              <div style={{ color: colorText }}>{val(meta.descripcion)}</div>
            </div>
            <div>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Normas</div>
              <div style={{ color: colorText }}>{val(meta.normas)}</div>
            </div>
            {meta.otros ? (
              <div>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Otros</div>
                <div style={{ color: colorText }}>{val(meta.otros)}</div>
              </div>
            ) : null}
          </div>

          {/* Ficha subida / descargar */}
          {images?.sheet?.url && (
            <div style={{ marginTop: 12 }}>
              <a className="sr-btn sr-btn--ghost" href={withBase(images.sheet.url)} target="_blank" rel="noreferrer">
                Descargar última ficha
              </a>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
