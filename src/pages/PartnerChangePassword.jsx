import React, { useEffect, useRef, useState } from "react";
import Seo from "../components/Seo.jsx";
import { useNavigate } from "react-router-dom";
import {
  clearPartnerSession,
  getPartnerSessionValue,
  setPartnerSessionValue,
} from "../lib/partnerSession.js";
import { partnerFetch } from "../lib/partnerApi.js";
import { bindPartnerViewLifecycle } from "../lib/partnerViewLifecycle.js";

const API = "/api";

async function fetchJson(url, options = {}) {
  const r = await partnerFetch(url, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail || `Error HTTP ${r.status}`);
  return data;
}

export default function PartnerChangePassword() {
  const nav = useNavigate();

  const [email, setEmail] = useState(() => getPartnerSessionValue("partner_email"));
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [viewVisible, setViewVisible] = useState(true);
  const [revealEpoch, setRevealEpoch] = useState(0);
  const sensitiveRootRef = useRef(null);
  const emailInputRef = useRef(null);
  const oldPasswordInputRef = useRef(null);
  const newPasswordInputRef = useRef(null);
  const confirmPasswordInputRef = useRef(null);
  const requestAbortRef = useRef(null);
  const requestPendingRef = useRef(false);
  const navigationTimerRef = useRef(null);

  function clearSensitiveDom() {
    for (const ref of [
      emailInputRef,
      oldPasswordInputRef,
      newPasswordInputRef,
      confirmPasswordInputRef,
    ]) {
      if (ref.current) ref.current.value = "";
    }
  }

  function stopSensitiveWork() {
    sensitiveRootRef.current?.setAttribute("hidden", "");
    clearSensitiveDom();
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    requestPendingRef.current = false;
    if (navigationTimerRef.current) {
      window.clearTimeout(navigationTimerRef.current);
      navigationTimerRef.current = null;
    }
  }

  function clearSensitiveView() {
    stopSensitiveWork();
    setViewVisible(false);
    setEmail("");
    setOldPassword("");
    setNewPassword("");
    setNewPassword2("");
    setLoading(false);
    setErr("");
    setMsg("");
  }

  function revealCleanView() {
    if (document.visibilityState === "hidden") return;
    stopSensitiveWork();
    setViewVisible(false);
    setEmail(getPartnerSessionValue("partner_email"));
    setOldPassword("");
    setNewPassword("");
    setNewPassword2("");
    setLoading(false);
    setErr("");
    setMsg("");
    setRevealEpoch((value) => value + 1);
  }

  useEffect(() => {
    const unbind = bindPartnerViewLifecycle(window, document, {
      invalidate: clearSensitiveView,
      revalidate: revealCleanView,
    });
    return () => {
      unbind();
      stopSensitiveWork();
    };
    // The lifecycle binding is intentionally stable; all sensitive values are
    // cleared through state setters and the live DOM refs above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (revealEpoch > 0) {
      setViewVisible(true);
      sensitiveRootRef.current?.removeAttribute("hidden");
    }
  }, [revealEpoch]);

  async function submit() {
    if (requestPendingRef.current) return;
    setErr("");
    setMsg("");

    if (!email.trim()) return setErr("Email obligatorio.");
    if (!oldPassword.trim()) return setErr("Contraseña temporal obligatoria.");
    if (newPassword.trim().length < 12) return setErr("La nueva contraseña debe tener al menos 12 caracteres.");
    if (newPassword.trim() !== newPassword2.trim()) return setErr("Las nuevas contraseñas no coinciden.");

    const controller = new AbortController();
    requestPendingRef.current = true;
    requestAbortRef.current = controller;
    setLoading(true);
    try {
      await fetchJson(`${API}/partner/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          email: email.trim(),
          old_password: oldPassword.trim(),
          new_password: newPassword.trim(),
        }),
      });
      if (controller.signal.aborted) return;

      clearPartnerSession();
      setPartnerSessionValue("partner_email", email.trim().toLowerCase());
      setPartnerSessionValue("partner_must_change", "0");
      setMsg("✅ Contraseña actualizada. Ya puedes entrar al portal.");
      setOldPassword("");
      setNewPassword("");
      setNewPassword2("");

      // Volver a gestorías para login normal
      navigationTimerRef.current = window.setTimeout(() => nav("/gestorias"), 800);
    } catch (e) {
      if (e?.name === "AbortError" || controller.signal.aborted) return;
      setErr(e.message || "No se pudo cambiar la contraseña.");
    } finally {
      if (requestAbortRef.current === controller) {
        requestAbortRef.current = null;
        requestPendingRef.current = false;
        setLoading(false);
      }
    }
  }

  return (
    <>
      <Seo title="Cambiar contraseña · Asesorías" description="Cambio obligatorio de contraseña para partners." />
      <main
        ref={sensitiveRootRef}
        hidden={!viewVisible}
        className="sr-container py-12"
        style={{ minHeight: "calc(100vh - 160px)" }}
      >
        <h1 className="sr-h1 mb-4">Cambiar contraseña</h1>

        <div className="sr-card" style={{ maxWidth: 560 }}>
          <p className="sr-p" style={{ marginTop: 0 }}>
            Por seguridad, debes cambiar la contraseña temporal antes de usar el portal.
          </p>

          <div style={{ display: "grid", gap: 10 }}>
            <input
              ref={emailInputRef}
              name="partner-change-email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              style={{ padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 12 }}
            />

            <input
              ref={oldPasswordInputRef}
              name="partner-temporary-password"
              autoComplete="off"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Contraseña temporal"
              type="password"
              style={{ padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 12 }}
            />

            <input
              ref={newPasswordInputRef}
              name="partner-new-password"
              autoComplete="off"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nueva contraseña (mín. 12 caracteres)"
              type="password"
              minLength={12}
              style={{ padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 12 }}
            />

            <input
              ref={confirmPasswordInputRef}
              name="partner-new-password-confirmation"
              autoComplete="off"
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
              placeholder="Repite la nueva contraseña"
              type="password"
              minLength={12}
              style={{ padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 12 }}
            />

            {err && <div className="sr-small" style={{ color: "#991b1b" }}>❌ {err}</div>}
            {msg && <div className="sr-small" style={{ color: "#166534" }}>{msg}</div>}

            <button className="sr-btn-primary" onClick={submit} disabled={loading}>
              {loading ? "Guardando…" : "Guardar nueva contraseña"}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
