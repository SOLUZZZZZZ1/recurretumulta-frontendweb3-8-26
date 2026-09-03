import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { purgeLegacyRestaurantPinStorage } from "../lib/restaurantPin.js";
import { bindRestaurantSessionLifecycle } from "../lib/restaurantSessionLifecycle.js";

const DEFAULT_RESTAURANT_ID = "rest_001";
const RESTAURANT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

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

function normalizedRestaurantId(values) {
  if (values.length !== 1) return "";
  const value = String(values[0] || "").trim();
  return RESTAURANT_ID_PATTERN.test(value) ? value : "";
}

function getRestaurantIdFromLocation(location = window.location) {
  const search = new URLSearchParams(location.search || "");
  if (search.has("r")) return normalizedRestaurantId(search.getAll("r"));

  const hash = location.hash || "";
  const queryIndex = hash.indexOf("?");
  if (queryIndex >= 0) {
    const hashParams = new URLSearchParams(hash.slice(queryIndex + 1));
    if (hashParams.has("r")) {
      return normalizedRestaurantId(hashParams.getAll("r"));
    }
  }
  return DEFAULT_RESTAURANT_ID;
}

function reservationsListUrl(date, shift, restaurantId) {
  const params = new URLSearchParams({
    date,
    shift,
    restaurant_id: restaurantId,
  });
  return `/api/ops/restaurant-reservations?${params.toString()}`;
}

function reservationActionUrl(reservationId, action, restaurantId) {
  const id = encodeURIComponent(String(reservationId || ""));
  const params = new URLSearchParams({ restaurant_id: restaurantId });
  return `/api/ops/restaurant-reservations/${id}${action}?${params.toString()}`;
}

async function restaurantFetch(path, pin, options = {}) {
  if (!String(path || "").startsWith("/api/ops/")) {
    throw new TypeError("Ruta de reservas no permitida");
  }
  const headers = new Headers(options.headers || {});
  headers.delete("x-reservas-pin");
  if (pin) headers.set("x-reservas-pin", pin);
  return fetch(path, {
    ...options,
    headers,
    credentials: "same-origin",
    mode: "same-origin",
    redirect: "error",
    cache: "no-store",
    referrerPolicy: "no-referrer",
  });
}

function normalizeItems(json) {
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.items)) return json.items;
  if (json && Array.isArray(json.data)) return json.data;
  if (json && Array.isArray(json.rows)) return json.rows;
  if (json && Array.isArray(json.results)) return json.results;
  return [];
}

function pinByteLength(value) {
  return new TextEncoder().encode(String(value || "")).length;
}

function newReservationIdempotencyKey() {
  try {
    return `reservation:${globalThis.crypto.randomUUID()}`;
  } catch {
    return `reservation:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  }
}

export default function ReservasRestaurante() {
  const location = useLocation();
  const [reservas, setReservas] = useState([]);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [turno, setTurno] = useState("comida");
  const [showCanceladas, setShowCanceladas] = useState(false);

  const restaurantId = useMemo(
    () => getRestaurantIdFromLocation(location),
    [location.hash, location.search]
  );
  const restaurantIdRef = useRef(restaurantId);
  restaurantIdRef.current = restaurantId;
  const previousRestaurantIdRef = useRef(restaurantId);
  const loadGenerationRef = useRef(0);
  const loadAbortRef = useRef(null);
  const actionAbortRef = useRef(null);
  const actionPendingRef = useRef("");
  const validationAbortRef = useRef(null);
  const validationPendingRef = useRef(false);
  const sensitiveRootRef = useRef(null);
  const pinInputDomRef = useRef(null);
  const pinCurrentDomRef = useRef(null);
  const pinNewDomRef = useRef(null);
  const pinNew2DomRef = useRef(null);
  const [sensitiveViewVisible, setSensitiveViewVisible] = useState(true);
  const [loginRevealEpoch, setLoginRevealEpoch] = useState(0);
  const [pendingAction, setPendingAction] = useState("");

  const [pin, setPin] = useState(() => {
    purgeLegacyRestaurantPinStorage();
    return "";
  });
  const [pinInput, setPinInput] = useState("");
  const [pinRestaurantId, setPinRestaurantId] = useState("");
  const [pinError, setPinError] = useState("");
  const [validatingPin, setValidatingPin] = useState(false);
  const pinRef = useRef(pin);
  const pinRestaurantIdRef = useRef(pinRestaurantId);
  pinRef.current = pin;
  pinRestaurantIdRef.current = pinRestaurantId;

  // Modal crear/editar
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm("comida"));
  const reservationIdempotencyKeyRef = useRef("");

  // Panel cambiar PIN
  const [showPinPanel, setShowPinPanel] = useState(false);
  const [pinCurrent, setPinCurrent] = useState("");
  const [pinNew, setPinNew] = useState("");
  const [pinNew2, setPinNew2] = useState("");
  const [pinMsg, setPinMsg] = useState("");

  const autorizado = Boolean(pin && pinRestaurantId === restaurantId);

  useEffect(() => {
    if (!autorizado) {
      setSensitiveViewVisible(true);
      sensitiveRootRef.current?.removeAttribute("hidden");
    }
  }, [autorizado, loginRevealEpoch]);

  useEffect(() => {
    purgeLegacyRestaurantPinStorage();
    const unbind = bindRestaurantSessionLifecycle(window, () => bloquear());
    return () => {
      unbind();
      bloquear();
    };
    // Lifecycle binding is intentionally installed once; bloquear reads no
    // long-lived credential and synchronously invalidates the credential refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (restaurantId !== previousRestaurantIdRef.current) {
      bloquear();
      previousRestaurantIdRef.current = restaurantId;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  function beginAuthorizedRequest() {
    const requestedRestaurantId = restaurantId;
    const requestedPin = pin;
    if (
      !requestedPin ||
      pinRestaurantId !== requestedRestaurantId ||
      requestedRestaurantId !== restaurantIdRef.current ||
      requestedPin !== pinRef.current ||
      pinRestaurantId !== pinRestaurantIdRef.current
    ) {
      return null;
    }
    return {
      generation: ++loadGenerationRef.current,
      restaurantId: requestedRestaurantId,
      pin: requestedPin,
    };
  }

  function requestIsCurrent(request) {
    return Boolean(
      request &&
        request.generation === loadGenerationRef.current &&
        request.restaurantId === restaurantIdRef.current &&
        request.restaurantId === pinRestaurantIdRef.current &&
        request.pin === pinRef.current
    );
  }

  async function cargarReservas() {
    const request = beginAuthorizedRequest();
    if (!request) return;
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;

    try {
      const r = await restaurantFetch(
        reservationsListUrl(fecha, turno, request.restaurantId),
        request.pin,
        { signal: controller.signal }
      );

      if (!requestIsCurrent(request) || controller.signal.aborted) return;
      if (!r.ok) {
        setReservas([]);
        if (r.status === 401 || r.status === 403) {
          bloquear("El PIN no es válido o ha dejado de estar autorizado.");
        }
        return;
      }

      const json = await r.json();
      if (!requestIsCurrent(request) || controller.signal.aborted) return;
      setReservas(normalizeItems(json));
    } catch (error) {
      if (error?.name !== "AbortError" && requestIsCurrent(request)) {
        setReservas([]);
      }
    } finally {
      if (loadAbortRef.current === controller) loadAbortRef.current = null;
    }
  }

  useEffect(() => {
    cargarReservas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, turno, restaurantId, pin]);

  async function confirmarPin() {
    const v = (pinInput || "").trim();
    if (!v || !restaurantId || validationPendingRef.current) return;
    if (pinByteLength(v) > 72) {
      setPinError("PIN no válido.");
      return;
    }
    purgeLegacyRestaurantPinStorage();
    setPinError("");
    validationAbortRef.current?.abort();
    const controller = new AbortController();
    validationAbortRef.current = controller;
    validationPendingRef.current = true;
    setValidatingPin(true);
    const requestedRestaurantId = restaurantId;
    const generation = ++loadGenerationRef.current;
    try {
      const response = await restaurantFetch(
        reservationsListUrl(fecha, turno, requestedRestaurantId),
        v,
        { signal: controller.signal }
      );
      if (
        generation !== loadGenerationRef.current ||
        requestedRestaurantId !== restaurantIdRef.current
      ) return;
      if (!response.ok) {
        setPinError(
          response.status === 401 || response.status === 403
            ? "PIN no válido."
            : "No se pudo comprobar el acceso."
        );
        return;
      }
      const json = await response.json();
      if (
        generation !== loadGenerationRef.current ||
        requestedRestaurantId !== restaurantIdRef.current
      ) return;
      setReservas(normalizeItems(json));
      setPin(v);
      setPinRestaurantId(requestedRestaurantId);
      setPinInput("");
    } catch (error) {
      if (error?.name === "AbortError") return;
      if (
        generation === loadGenerationRef.current &&
        requestedRestaurantId === restaurantIdRef.current
      ) {
        setPinError("No se pudo comprobar el acceso.");
      }
    } finally {
      if (validationAbortRef.current === controller) {
        validationAbortRef.current = null;
        validationPendingRef.current = false;
        setValidatingPin(false);
      }
    }
  }

  function bloquear(reason = "") {
    const safeReason = typeof reason === "string" ? reason : "";
    sensitiveRootRef.current?.setAttribute("hidden", "");
    setSensitiveViewVisible(false);
    setLoginRevealEpoch((current) => current + 1);
    loadGenerationRef.current += 1;
    loadAbortRef.current?.abort();
    loadAbortRef.current = null;
    actionAbortRef.current?.abort();
    actionAbortRef.current = null;
    actionPendingRef.current = "";
    validationAbortRef.current?.abort();
    validationAbortRef.current = null;
    validationPendingRef.current = false;
    pinRef.current = "";
    pinRestaurantIdRef.current = "";
    purgeLegacyRestaurantPinStorage();
    setPin("");
    setPinRestaurantId("");
    setPinInput("");
    setPinCurrent("");
    setPinNew("");
    setPinNew2("");
    setReservas([]);
    setModalOpen(false);
    setEditId(null);
    setForm(emptyForm(turno));
    reservationIdempotencyKeyRef.current = "";
    setShowPinPanel(false);
    setPinMsg("");
    setPinError(safeReason);
    setValidatingPin(false);
    setPendingAction("");
    for (const ref of [pinInputDomRef, pinCurrentDomRef, pinNewDomRef, pinNew2DomRef]) {
      if (ref.current) ref.current.value = "";
    }
  }

  function beginMutation(label) {
    if (actionPendingRef.current) return null;
    const request = beginAuthorizedRequest();
    if (!request) {
      bloquear("El acceso ya no corresponde a este restaurante.");
      return null;
    }
    const controller = new AbortController();
    actionAbortRef.current = controller;
    actionPendingRef.current = label;
    setPendingAction(label);
    return { ...request, controller, label };
  }

  function finishMutation(request) {
    if (actionAbortRef.current !== request?.controller) return;
    actionAbortRef.current = null;
    actionPendingRef.current = "";
    setPendingAction("");
  }

  // ====== Acciones ======
  async function runReservationAction(id, action) {
    const request = beginMutation(`reservation-action:${id}`);
    if (!request) return;
    try {
      const response = await restaurantFetch(reservationActionUrl(id, action, request.restaurantId), request.pin, {
        method: "POST",
        signal: request.controller.signal,
      });
      if (!requestIsCurrent(request) || request.controller.signal.aborted) return;
      if (!response.ok) return handleAuthorizedFailure(response, request);
      await cargarReservas();
    } catch (error) {
      if (error?.name !== "AbortError" && requestIsCurrent(request)) {
        window.alert("No se pudo completar la operación.");
      }
    } finally {
      finishMutation(request);
    }
  }

  async function marcarLlegada(id) {
    return runReservationAction(id, "/arrived");
  }

  async function marcarNoShow(id) {
    return runReservationAction(id, "/no-show");
  }

  async function cancelarReserva(id) {
    if (!window.confirm("¿Cancelar esta reserva?")) return;
    return runReservationAction(id, "/cancel");
  }

  function handleAuthorizedFailure(response, request) {
    if (!requestIsCurrent(request)) return;
    if (response.status === 401 || response.status === 403) {
      bloquear("El PIN no es válido o ha dejado de estar autorizado.");
      return;
    }
    window.alert("No se pudo completar la operación.");
  }

  function closePinPanel() {
    setShowPinPanel(false);
    setPinCurrent("");
    setPinNew("");
    setPinNew2("");
    setPinMsg("");
  }

  function togglePinPanel() {
    if (actionPendingRef.current) return;
    if (showPinPanel) return closePinPanel();
    setShowPinPanel(true);
  }

  // ====== Crear / Editar ======
  function abrirNueva() {
    if (actionPendingRef.current) return;
    setEditId(null);
    setForm(emptyForm(turno));
    reservationIdempotencyKeyRef.current = newReservationIdempotencyKey();
    setModalOpen(true);
  }

  function abrirEditar(r) {
    if (actionPendingRef.current) return;
    setEditId(r.id);
    reservationIdempotencyKeyRef.current = "";
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

  function updateReservationForm(patch) {
    setForm((current) => ({ ...current, ...patch }));
    if (!editId) {
      reservationIdempotencyKeyRef.current = newReservationIdempotencyKey();
    }
  }

  async function guardarReserva() {
    const name = (form.customer_name || "").trim();
    const pax = Number(form.party_size);

    if (!name) return alert("Falta el nombre.");
    if (!pax || pax < 1) return alert("Pax inválidos.");
    const request = beginMutation(editId ? `reservation-edit:${editId}` : "reservation-create");
    if (!request) return;

    try {
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

        const r = await restaurantFetch(reservationActionUrl(editId, "", request.restaurantId), request.pin, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: request.controller.signal,
      });

        if (!requestIsCurrent(request) || request.controller.signal.aborted) return;
        if (!r.ok) return handleAuthorizedFailure(r, request);
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

        const idempotencyKey =
          reservationIdempotencyKeyRef.current || newReservationIdempotencyKey();
        reservationIdempotencyKeyRef.current = idempotencyKey;
        const query = new URLSearchParams({ restaurant_id: request.restaurantId });
        const r = await restaurantFetch(`/api/ops/restaurant-reservations?${query.toString()}`, request.pin, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(payload),
          signal: request.controller.signal,
        });

        if (!requestIsCurrent(request) || request.controller.signal.aborted) return;
        if (!r.ok) return handleAuthorizedFailure(r, request);
      }

      setModalOpen(false);
      setEditId(null);
      setForm(emptyForm(turno));
      reservationIdempotencyKeyRef.current = "";
      await cargarReservas();
    } catch (error) {
      if (error?.name !== "AbortError" && requestIsCurrent(request)) {
        window.alert("No se pudo guardar la reserva.");
      }
    } finally {
      finishMutation(request);
    }
  }

  // ====== Cambiar PIN ======
  async function cambiarPin() {
    setPinMsg("");
    if (!pinCurrent || !pinNew || !pinNew2) return setPinMsg("Rellena los 3 campos.");
    if (pinNew !== pinNew2) return setPinMsg("Los nuevos PIN no coinciden.");
    if (pinNew.length < 8 || pinNew.length > 64 || pinByteLength(pinNew) > 72) {
      return setPinMsg("El PIN nuevo debe tener entre 8 y 64 caracteres.");
    }
    const request = beginMutation("pin-change");
    if (!request) return;

    try {
      const r = await restaurantFetch("/api/ops/restaurants/change-pin", "", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: request.restaurantId,
          current_pin: pinCurrent,
          new_pin: pinNew,
        }),
        signal: request.controller.signal,
      });

      if (!requestIsCurrent(request) || request.controller.signal.aborted) return;
      if (!r.ok) return setPinMsg("No se pudo cambiar el PIN.");

      // El PIN renovado sigue solo en memoria y desaparece al salir o recargar.
      purgeLegacyRestaurantPinStorage();
      pinRef.current = pinNew;
      setPin(pinNew);

      setPinCurrent("");
      setPinNew("");
      setPinNew2("");
      setPinMsg("PIN cambiado ✅");
    } catch (error) {
      if (error?.name !== "AbortError" && requestIsCurrent(request)) {
        setPinMsg("No se pudo cambiar el PIN.");
      }
    } finally {
      finishMutation(request);
    }
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
  if (!restaurantId) {
    return (
      <div style={{ padding: 40, maxWidth: 520, margin: "0 auto" }}>
        <h2>Enlace de restaurante no válido</h2>
        <p>No se abrirá ningún panel hasta recibir un identificador de restaurante válido.</p>
      </div>
    );
  }

  if (!autorizado) {
    return (
      <div ref={sensitiveRootRef} hidden={!sensitiveViewVisible} style={{ padding: 40, maxWidth: 420, margin: "0 auto" }}>
      <style>{`
        @media print {
          button, input, select { display: none !important; }
          table { width: 100% !important; }
          body { background: white !important; }
        }
      `}</style>

        <h2>Acceso reservas</h2>
        <p style={{ marginTop: 8, opacity: 0.85 }}>
          Restaurante: <b>{restaurantId}</b> · La aplicación no almacena el PIN; se borra de esta vista al salir o recargar.
        </p>
        <input
          ref={pinInputDomRef}
          type="password"
          name="restaurant-access-code"
          autoComplete="off"
          placeholder="PIN"
          maxLength={72}
          value={pinInput}
          onChange={(e) => setPinInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && confirmarPin()}
          style={{ width: "100%", padding: 10, fontSize: 16, marginTop: 8 }}
        />
        <button disabled={validatingPin} onClick={confirmarPin} style={{ marginTop: 10, width: "100%", padding: 12, fontSize: 16 }}>
          {validatingPin ? "Comprobando…" : "Entrar"}
        </button>
        {pinError ? <p role="alert" style={{ color: "#991b1b" }}>{pinError}</p> : null}
      </div>
    );
  }

  // ====== UI PRINCIPAL ======
  return (
    <div ref={sensitiveRootRef} hidden={!sensitiveViewVisible} style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Reservas</h2>
          <div style={{ opacity: 0.85, marginTop: 4 }}>
            Restaurante: <b>{restaurantId}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button disabled={Boolean(pendingAction)} onClick={abrirNueva} style={{ padding: "10px 12px", fontWeight: 800 }}>
            ➕ Añadir reserva
          </button>
          <button onClick={() => bloquear()} style={{ padding: "10px 12px" }}>
            🔒 Bloquear
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "12px 0" }}>
        <input disabled={Boolean(pendingAction)} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        <select disabled={Boolean(pendingAction)} value={turno} onChange={(e) => setTurno(e.target.value)}>
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
                <button disabled={Boolean(pendingAction)} onClick={() => marcarLlegada(r.id)} title="Llegó">✅</button>
                <button disabled={Boolean(pendingAction)} onClick={() => marcarNoShow(r.id)} title="No show">❌</button>
                <button disabled={Boolean(pendingAction)} onClick={() => cancelarReserva(r.id)} title="Cancelar">🚫</button>
                <button disabled={Boolean(pendingAction)} onClick={() => abrirEditar(r)} title="Editar">✏️</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Cambiar PIN (desplegable) */}
      <div style={{ marginTop: 14 }}>
        <button disabled={Boolean(pendingAction)} onClick={togglePinPanel} style={{ padding: "10px 12px", fontWeight: 800 }}>
          🔑 Cambiar PIN
        </button>

        {showPinPanel && (
          <div style={{ marginTop: 10, background: "rgba(255,255,255,0.78)", borderRadius: 10, padding: 12, maxWidth: 520 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                PIN actual
                <input ref={pinCurrentDomRef} name="restaurant-current-code" autoComplete="off" disabled={Boolean(pendingAction)} type="password" maxLength={72} value={pinCurrent} onChange={(e) => setPinCurrent(e.target.value)} />
              </label>
              <div />
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                Nuevo PIN
                <input ref={pinNewDomRef} name="restaurant-new-code" autoComplete="off" disabled={Boolean(pendingAction)} type="password" maxLength={64} value={pinNew} onChange={(e) => setPinNew(e.target.value)} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                Repetir nuevo PIN
                <input ref={pinNew2DomRef} name="restaurant-new-code-confirmation" autoComplete="off" disabled={Boolean(pendingAction)} type="password" maxLength={64} value={pinNew2} onChange={(e) => setPinNew2(e.target.value)} />
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
              <button disabled={Boolean(pendingAction)} onClick={closePinPanel} style={{ padding: "10px 12px" }}>
                Cerrar
              </button>
              <button disabled={Boolean(pendingAction)} onClick={cambiarPin} style={{ padding: "10px 12px", fontWeight: 900 }}>
                {pendingAction === "pin-change" ? "Cambiando…" : "Cambiar PIN"}
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
          onClick={() => { if (!pendingAction) setModalOpen(false); }}
        >
          <div
            style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 520, padding: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <h3 style={{ margin: 0 }}>{editId ? "Editar reserva" : "Añadir reserva"}</h3>
              <button disabled={Boolean(pendingAction)} onClick={() => setModalOpen(false)} aria-label="Cerrar">✖️</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                Hora
                <input disabled={Boolean(pendingAction)} value={form.reservation_time} onChange={(e) => updateReservationForm({ reservation_time: e.target.value })} />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                Pax
                <input
                  type="number"
                  min="1"
                  disabled={Boolean(pendingAction)}
                  value={form.party_size}
                  onChange={(e) => updateReservationForm({ party_size: e.target.value })}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                Mesa
                <input disabled={Boolean(pendingAction)} value={form.table_name} onChange={(e) => updateReservationForm({ table_name: e.target.value })} placeholder="Ej: 6 / T3 / Barra 2" />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                Teléfono
                <input disabled={Boolean(pendingAction)} value={form.phone} onChange={(e) => updateReservationForm({ phone: e.target.value })} placeholder="Opcional" />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
                Nombre
                <input disabled={Boolean(pendingAction)} value={form.customer_name} onChange={(e) => updateReservationForm({ customer_name: e.target.value })} placeholder="Obligatorio" />
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input disabled={Boolean(pendingAction)} type="checkbox" checked={form.extras_dog} onChange={(e) => updateReservationForm({ extras_dog: e.target.checked })} />
                Perro
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input disabled={Boolean(pendingAction)} type="checkbox" checked={form.extras_celiac} onChange={(e) => updateReservationForm({ extras_celiac: e.target.checked })} />
                Celíaco
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
                Notas / extras
                <input disabled={Boolean(pendingAction)} value={form.extras_notes} onChange={(e) => updateReservationForm({ extras_notes: e.target.value })} placeholder="Trona, terraza, cumpleaños..." />
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
              <button disabled={Boolean(pendingAction)} onClick={() => setModalOpen(false)} style={{ padding: "10px 12px" }}>
                Cancelar
              </button>
              <button disabled={Boolean(pendingAction)} onClick={guardarReserva} style={{ padding: "10px 12px", fontWeight: 900 }}>
                {pendingAction.startsWith("reservation-") ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
