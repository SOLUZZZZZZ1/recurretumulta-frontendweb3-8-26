import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import logo from "/rtm-logo-transparente-recortado.png";

const MAIN_LINKS = [
  { to: "/", label: "Inicio" },
  { to: "/como-funciona", label: "Cómo trabajamos" },
  { to: "/precios", label: "Precios" },
  { to: "/faq", label: "FAQ" },
  { to: "/contacto", label: "Contacto" },
];

const SERVICE_LINKS = [
  {
    to: "/trafico",
    icon: "🚗",
    title: "Multas y vehículos",
    text: "Multas, sanciones y trámites relacionados con vehículos.",
  },
  {
    to: "/morosidad",
    icon: "💳",
    title: "Deudas y morosidad",
    text: "ASNEF, ficheros de morosidad y problemas relacionados con deudas.",
  },
  {
    to: "/administracion",
    icon: "🏛️",
    title: "Administración pública",
    text: "Hacienda, Seguridad Social, ayuntamientos y otros organismos.",
  },
  {
    to: "/otros-procedimientos",
    icon: "📂",
    title: "Otros procedimientos",
    text: "Cuéntanos tu caso si no aparece entre los servicios anteriores.",
  },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const servicesRef = useRef(null);

  const servicesActive = SERVICE_LINKS.some(
    ({ to }) => pathname === to || pathname.startsWith(`${to}/`)
  );

  useEffect(() => {
    setOpen(false);
    setServicesOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (
        servicesRef.current &&
        !servicesRef.current.contains(event.target)
      ) {
        setServicesOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <>
      <style>{`
        .rtm-services-wrap {
          position: relative;
        }

        .rtm-services-trigger {
          border: 0;
          font-family: inherit;
          cursor: pointer;
        }

        .rtm-services-chevron {
          margin-left: 7px;
          font-size: 12px;
          transition: transform .18s ease;
        }

        .rtm-services-chevron.is-open {
          transform: rotate(180deg);
        }

        .rtm-services-dropdown {
          position: absolute;
          top: calc(100% + 10px);
          left: 50%;
          z-index: 1200;
          width: min(430px, calc(100vw - 28px));
          padding: 10px;
          border: 1px solid #dbeafe;
          border-radius: 18px;
          background: #ffffff;
          box-shadow: 0 24px 60px rgba(15, 23, 42, .24);
          transform: translateX(-50%);
        }

        .rtm-services-dropdown::before {
          content: "";
          position: absolute;
          top: -7px;
          left: 50%;
          width: 14px;
          height: 14px;
          border-top: 1px solid #dbeafe;
          border-left: 1px solid #dbeafe;
          background: #ffffff;
          transform: translateX(-50%) rotate(45deg);
        }

        .rtm-service-option {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 42px minmax(0, 1fr);
          gap: 11px;
          align-items: center;
          padding: 12px;
          color: #0f172a;
          text-decoration: none;
          border-radius: 13px;
        }

        .rtm-service-option:hover,
        .rtm-service-option.is-active {
          background: #eff6ff;
        }

        .rtm-service-option-icon {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: #dbeafe;
          font-size: 22px;
        }

        .rtm-service-option strong {
          display: block;
          margin-bottom: 3px;
          font-size: 15px;
          line-height: 1.2;
        }

        .rtm-service-option small {
          display: block;
          color: #64748b;
          font-size: 12px;
          line-height: 1.35;
        }

        @media (max-width: 980px) {
          .rtm-services-wrap {
            width: 100%;
          }

          .rtm-services-trigger {
            justify-content: space-between;
          }

          .rtm-services-dropdown {
            position: static;
            width: 100%;
            margin-top: 4px;
            padding: 7px;
            border-radius: 14px;
            box-shadow: none;
            transform: none;
          }

          .rtm-services-dropdown::before {
            display: none;
          }
        }
      `}</style>

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
            <Link
              to="/"
              className={`rtm-navbar-link ${pathname === "/" ? "is-active" : ""}`}
            >
              Inicio
            </Link>

            <div className="rtm-services-wrap" ref={servicesRef}>
              <button
                type="button"
                className={`rtm-navbar-link rtm-services-trigger ${
                  servicesActive ? "is-active" : ""
                }`}
                aria-haspopup="true"
                aria-expanded={servicesOpen}
                onClick={() => setServicesOpen((value) => !value)}
              >
                Servicios
                <span
                  className={`rtm-services-chevron ${
                    servicesOpen ? "is-open" : ""
                  }`}
                  aria-hidden="true"
                >
                  ▼
                </span>
              </button>

              {servicesOpen ? (
                <div className="rtm-services-dropdown" role="menu">
                  {SERVICE_LINKS.map(({ to, icon, title, text }) => {
                    const active =
                      pathname === to || pathname.startsWith(`${to}/`);

                    return (
                      <Link
                        key={to}
                        to={to}
                        role="menuitem"
                        className={`rtm-service-option ${
                          active ? "is-active" : ""
                        }`}
                      >
                        <span
                          className="rtm-service-option-icon"
                          aria-hidden="true"
                        >
                          {icon}
                        </span>
                        <span>
                          <strong>{title}</strong>
                          <small>{text}</small>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {MAIN_LINKS.slice(1).map(({ to, label }) => {
              const active =
                pathname === to || pathname.startsWith(`${to}/`);

              return (
                <Link
                  key={to}
                  to={to}
                  className={`rtm-navbar-link ${
                    active ? "is-active" : ""
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
    </>
  );
}
