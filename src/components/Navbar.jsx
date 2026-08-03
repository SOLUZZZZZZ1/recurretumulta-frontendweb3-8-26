import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import logo from "/rtm-logo-transparente-recortado.png";

const LINKS = [
  { to: "/", label: "Inicio" },
  { to: "/como-funciona", label: "Cómo trabajamos" },
  { to: "/morosidad", label: "Morosidad" },
  { to: "/administracion", label: "Administración" },
  { to: "/precios", label: "Precios" },
  { to: "/gestorias", label: "Asesorías" },
  { to: "/faq", label: "FAQ" },
  { to: "/contacto", label: "Contacto" },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="rtm-navbar">
      <div className="rtm-navbar-inner">
        <Link to="/" className="rtm-navbar-brand" aria-label="Ir al inicio">
          <img
            src={logo}
            alt="RecurreTuMulta"
            className="rtm-navbar-logo"
          />
        </Link>

        <button
          type="button"
          className="rtm-menu-button"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          aria-controls="rtm-main-menu"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="rtm-menu-icon" aria-hidden="true">
            {open ? "✕" : "☰"}
          </span>
          <span>Menú</span>
        </button>

        <nav
          id="rtm-main-menu"
          className={`rtm-navbar-links ${open ? "is-open" : ""}`}
          aria-label="Navegación principal"
        >
          {LINKS.map(({ to, label }) => {
            const active =
              to === "/"
                ? pathname === "/"
                : pathname === to || pathname.startsWith(`${to}/`);

            return (
              <Link
                key={to}
                to={to}
                className={`rtm-navbar-link ${active ? "is-active" : ""}`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
