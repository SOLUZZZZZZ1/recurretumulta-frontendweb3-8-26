import { useEffect, useMemo, useState } from "react";

const emptyForm = (turno = "comida") => ({
  reservation_time: turno === "desayuno" ? "09:00" : turno === "cena" ? "21:00" : "14:00",
  table_name: "",
  party_size: 2,
  customer_name: "",
  phone: "",
  extras_dog: false,
  extras_celiac: false,
  extras_notes: "",
});

function getRestaurantIdFromHash() {
  const hash = window.location.hash || "";
  const qs = hash.includes("?") ? hash.split("?")[1] : "";
  const params = new URLSearchParams(qs);
  return params.get("r") || "rest_001";
}

function normalizeItems(json) {
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.items)) return json.items;
  if (json && Array.isArray(json.data)) return json.data;
  if (json && Array.isArray(json.rows)) return json.rows;
  if (json && Array.isArray(json.results)) return json.results;
  return [];
}

export default function ReservasRestaurante() {
  const [reservas, setReservas] = useState([]);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [turno, setTurno] = useState("comida");
  const [showCanceladas, setShowCanceladas] = useState(false);

  const [restaurantId, setRestaurantId] = useState(getRestaurantIdFromHash());

  const [pin, setPin] = useState(() => sessionStorage.getItem("reservas_pin") || "");
  const [pinInput, setPinInput] = useState("");

  // Modal crear/editar
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm("comida"));

  // Panel cambiar PIN
  const [showPinPanel, setShowPinPanel] = useState(false);
  const [pinCurrent, setPinCurrent] = useState("");
  const [pinNew, setPinNew] = useState("");
  const [pinNew2, setPinNew2] = useState("");
  const [pinMsg, setPinMsg] = useState("");

  const autorizado = Boolean(pin);

  useEffect(() => {
    const onHash = () => setRestaurantId(getRestaurantIdFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  async function cargarReservas() {
    if (!pin) return;

    const r = await fetch(
      `/api/ops/restaurant-reservations?date=${fecha}&shift=${turno}&restaurant_id=${restaurantId}`,
      { headers: { "x-reservas-pin": pin } }
    );

    if (!r.ok) {
      setReservas([]);
      return;
    }

    const json = await r.json();
    setReservas(normalizeItems(json));
  }

  useEffect(() => {
    cargarReservas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, turno, restaurantId, pin]);

  function confirmarPin() {
    const v = (pinInput || "").trim();
    if (!v) return;
    sessionStorage.setItem("reservas_pin", v);
    setPin(v);
    setPinInput("");
  }

  function bloquear() {
    sessionStorage.removeItem("reservas_pin");
    setPin("");
    setReservas([]);
    setModalOpen(false);
    setEditId(null);
    setShowPinPanel(false);
    setPinMsg("");
  }

  // ====== Acciones ======
  async function marcarLlegada(id) {
    await fetch(`/api/ops/restaurant-reservations/${id}/arrived?restaurant_id=${restaurantId}`, {
      method: "POST",
      headers: { "x-reservas-pin": pin },
    });
    cargarReservas();
  }

  async function marcarNoShow(id) {
    await fetch(`/api/ops/restaurant-reservations/${id}/no-show?restaurant_id=${restaurantId}`, {
      method: "POST",
      headers: { "x-reservas-pin": pin },
    });
    cargarReservas();
  }

  async function cancelarReserva(id) {
    if (!window.confirm("¿Cancelar esta reserva?")) return;
    await fetch(`/api/ops/restaurant-reservations/${id}/cancel?restaurant_id=${restaurantId}`, {
      method: "POST",
      headers: { "x-reservas-pin": pin },
    });
    cargarReservas();
  }

  // ====== Crear / Editar ======
  function abrirNueva() {
    setEditId(null);
    setForm(emptyForm(turno));
    setModalOpen(true);
  }

  function abrirEditar(r) {
    setEditId(r.id);
    setForm({
      reservation_time: (r.reservation_time || "14:00").slice(0, 5),
      table_name: r.table_name || "",
      party_size: Number(r.party_size) || 1,
      customer_name: r.customer_name || "",
      phone: r.phone || "",
      extras_dog: Boolean(r.extras_dog),
      extras_celiac: Boolean(r.extras_celiac),
      extras_notes: r.extras_notes || "",
    });
    setModalOpen(true);
  }

  async function guardarReserva() {
    const name = (form.customer_name || "").trim();
    const pax = Number(form.party_size);

    if (!name) return alert("Falta el nombre.");
    if (!pax || pax < 1) return alert("Pax inválidos.");

    if (editId) {
      // EDIT
      const payload = {
        reservation_time: form.reservation_time,
        table_name: form.table_name,
        party_size: pax,
        customer_name: name,
        phone: form.phone || "",
        extras_dog: !!form.extras_dog,
        extras_celiac: !!form.extras_celiac,
        extras_notes: form.extras_notes || "",
      };

      const r = await fetch(`/api/ops/restaurant-reservations/${editId}?restaurant_id=${restaurantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-reservas-pin": pin },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const t = await r.text();
        return alert("Error al guardar: " + t);
      }
    } else {
      // CREATE
      const payload = {
        reservation_date: fecha,
        reservation_time: form.reservation_time,
        shift: turno,
        table_name: form.table_name || "",
        party_size: pax,
        customer_name: name,
        phone: form.phone || "",
        extras_dog: !!form.extras_dog,
        extras_celiac: !!form.extras_celiac,
        extras_notes: form.extras_notes || "",
        created_by: "SALA",
      };

      const r = await fetch(`/api/ops/restaurant-reservations?restaurant_id=${restaurantId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-reservas-pin": pin },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const t = await r.text();
        return alert("Error al crear: " + t);
      }
    }

    setModalOpen(false);
    setEditId(null);
    cargarReservas();
  }

  // ====== Cambiar PIN ======
  async function cambiarPin() {
    setPinMsg("");
    if (!pinCurrent || !pinNew || !pinNew2) return setPinMsg("Rellena los 3 campos.");
    if (pinNew !== pinNew2) return setPinMsg("Los nuevos PIN no coinciden.");

    const r = await fetch("/api/ops/restaurants/change-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurant_id: restaurantId,
        current_pin: pinCurrent,
        new_pin: pinNew,
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      return setPinMsg("Error: " + t);
    }

    // Actualiza PIN de sesión al nuevo (para no cortar la sesión)
    sessionStorage.setItem("reservas_pin", pinNew);
    setPin(pinNew);

    setPinCurrent("");
    setPinNew("");
    setPinNew2("");
    setPinMsg("PIN cambiado ✅");
  }

  // ====== Derivados (una sola fuente de verdad: 'visibles') ======
  const visibles = useMemo(() => {
    return showCanceladas ? reservas : reservas.filter((r) => r.status !== "cancelada");
  }, [reservas, showCanceladas]);

  const totalPax = useMemo(() => {
    return visibles.reduce((acc, r) => acc + (Number(r.party_size) || 0), 0);
  }, [visibles]);

  const contadores = useMemo(() => {
    return {
      pendientes: reservas.filter((r) => r.status === "pendiente").length,
      llegaron: reservas.filter((r) => r.status === "llego").length,
      no_show: reservas.filter((r) => r.status === "no_show").length,
      canceladas: reservas.filter((r) => r.status === "cancelada").length,
    };
  }, [reservas]);

  // ====== LOGIN ======
  if (!autorizado) {
    return (
      <div style={{ padding: 40, maxWidth: 420, margin: "0 auto" }}>
      <style>{`
        @media print {
          button, input, select { display: none !important; }
          table { width: 100% !important; }
          body { background: white !important; }
        }
      `}</style>

        <h2>Acceso reservas</h2>
        <p style={{ marginTop: 8, opacity: 0.85 }}>
          Restaurante: <b>{restaurantId}</b> · PIN se guarda solo durante esta sesión.
        </p>
        <input
          type="password"
          placeholder="PIN"
          value={pinInput}
          onChange={(e) => setPinInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && confirmarPin()}
          style={{ width: "100%", padding: 10, fontSize: 16, marginTop: 8 }}
        />
        <button onClick={confirmarPin} style={{ marginTop: 10, width: "100%", padding: 12, fontSize: 16 }}>
          Entrar
        </button>
      </div>
    );
  }

  // ====== UI PRINCIPAL ======
  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Reservas</h2>
          <div style={{ opacity: 0.85, marginTop: 4 }}>
            Restaurante: <b>{restaurantId}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button onClick={abrirNueva} style={{ padding: "10px 12px", fontWeight: 800 }}>
            ➕ Añadir reserva
          </button>
          <button onClick={bloquear} style={{ padding: "10px 12px" }}>
            🔒 Bloquear
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "12px 0" }}>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        <select value={turno} onChange={(e) => setTurno(e.target.value)}>
          <option value="desayuno">Desayuno</option>
          <option value="comida">Comida</option>
          <option value="cena">Cena</option>
        </select>
        <button onClick={() => window.print()} style={{ padding: "10px 12px" }}>🖨️ Imprimir</button>
        <button onClick={() => setShowCanceladas((v) => !v)}>
          {showCanceladas ? "Ocultar canceladas" : "Mostrar canceladas"}
        </button>
      </div>

      <div style={{ marginBottom: 10 }}>
        <strong>Pax totales visibles:</strong> {totalPax} &nbsp; | &nbsp;
        Pendientes: {contadores.pendientes} · Llegaron: {contadores.llegaron} · No show: {contadores.no_show} · Canceladas:{" "}
        {contadores.canceladas}
      </div>

      <table width="100%" cellPadding="6" style={{ background: "rgba(255,255,255,0.78)", borderRadius: 10 }}>
        <thead>
          <tr>
            <th align="left">Hora</th>
            <th align="left">Mesa</th>
            <th align="left">Pax</th>
            <th align="left">Nombre</th>
            <th align="left">Tel</th>
            <th align="left">Extras</th>
            <th align="left">Estado</th>
            <th align="left">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((r) => (
            <tr key={r.id} style={{ opacity: r.status === "cancelada" ? 0.45 : 1 }}>
              <td>{(r.reservation_time || "").slice(0, 5)}</td>
              <td>{r.table_name}</td>
              <td>{r.party_size}</td>
              <td>{r.customer_name}</td>
              <td>{r.phone}</td>
              <td style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {r.extras_dog ? <span title="Perro">🐶</span> : null}
                {r.extras_celiac ? <span title="Celíaco">🌾</span> : null}
                {r.extras_notes ? <span title={r.extras_notes}>📝</span> : null}
              </td>
              <td>{r.status}</td>
              <td style={{ display: "flex", gap: 6 }}>
                <button onClick={() => marcarLlegada(r.id)} title="Llegó">✅</button>
                <button onClick={() => marcarNoShow(r.id)} title="No show">❌</button>
                <button onClick={() => cancelarReserva(r.id)} title="Cancelar">🚫</button>
                <button onClick={() => abrirEditar(r)} title="Editar">✏️</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Cambiar PIN (desplegable) */}
      <div style={{ marginTop: 14 }}>
        <button onClick={() => setShowPinPanel((v) => !v)} style={{ padding: "10px 12px", fontWeight: 800 }}>
          🔑 Cambiar PIN
        </button>

        {showPinPanel && (
          <div style={{ marginTop: 10, background: "rgba(255,255,255,0.78)", borderRadius: 10, padding: 12, maxWidth: 520 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                PIN actual
                <input type="password" value={pinCurrent} onChange={(e) => setPinCurrent(e.target.value)} />
              </label>
              <div />
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                Nuevo PIN
                <input type="password" value={pinNew} onChange={(e) => setPinNew(e.target.value)} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                Repetir nuevo PIN
                <input type="password" value={pinNew2} onChange={(e) => setPinNew2(e.target.value)} />
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={() => { setShowPinPanel(false); setPinMsg(""); }} style={{ padding: "10px 12px" }}>
                Cerrar
              </button>
              <button onClick={cambiarPin} style={{ padding: "10px 12px", fontWeight: 900 }}>
                Cambiar PIN
              </button>
            </div>

            {pinMsg ? <div style={{ marginTop: 10, fontWeight: 800 }}>{pinMsg}</div> : null}
          </div>
        )}
      </div>

      {/* Modal crear/editar */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setModalOpen(false)}
        >
          <div
            style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 520, padding: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <h3 style={{ margin: 0 }}>{editId ? "Editar reserva" : "Añadir reserva"}</h3>
              <button onClick={() => setModalOpen(false)} aria-label="Cerrar">✖️</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                Hora
                <input value={form.reservation_time} onChange={(e) => setForm({ ...form, reservation_time: e.target.value })} />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                Pax
                <input
                  type="number"
                  min="1"
                  value={form.party_size}
                  onChange={(e) => setForm({ ...form, party_size: e.target.value })}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                Mesa
                <input value={form.table_name} onChange={(e) => setForm({ ...form, table_name: e.target.value })} placeholder="Ej: 6 / T3 / Barra 2" />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                Teléfono
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Opcional" />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
                Nombre
                <input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Obligatorio" />
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={form.extras_dog} onChange={(e) => setForm({ ...form, extras_dog: e.target.checked })} />
                Perro
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={form.extras_celiac} onChange={(e) => setForm({ ...form, extras_celiac: e.target.checked })} />
                Celíaco
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
                Notas / extras
                <input value={form.extras_notes} onChange={(e) => setForm({ ...form, extras_notes: e.target.value })} placeholder="Trona, terraza, cumpleaños..." />
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
              <button onClick={() => setModalOpen(false)} style={{ padding: "10px 12px" }}>
                Cancelar
              </button>
              <button onClick={guardarReserva} style={{ padding: "10px 12px", fontWeight: 900 }}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
