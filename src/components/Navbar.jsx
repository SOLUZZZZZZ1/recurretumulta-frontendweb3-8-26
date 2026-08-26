import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import logo from "/rtm-logo-transparente-recortado.png";
import {
  PUBLIC_SERVICE_FAMILIES,
  PUBLIC_SERVICE_PATHS,
} from "../data/publicServices.js";

const MAIN_LINKS = [
  { to: "/", label: "Inicio" },
  { to: "/como-funciona", label: "Cómo trabajamos" },
  { to: "/precios", label: "Precios" },
  { to: "/faq", label: "FAQ" },
  { to: "/contacto", label: "Contacto" },
];

const SERVICE_GROUPS = PUBLIC_SERVICE_FAMILIES.map((family) => ({
  id: family.id,
  title: family.menuTitle,
  icon: family.icon,
  landing: family.path,
  landingLabel: family.action,
  links: family.menuLinks,
}));

const SERVICE_LINK_COUNTS = SERVICE_GROUPS.flatMap((group) => group.links).reduce(
  (counts, { to }) => counts.set(to, (counts.get(to) || 0) + 1),
  new Map()
);


export default function Navbar() {
  const { pathname, search } = useLocation();
  const currentLocation = `${pathname}${search}`;
  const [open, setOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const servicesRef = useRef(null);

  const servicesActive =
    PUBLIC_SERVICE_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    ) ||
    pathname.startsWith("/iniciar-expediente") ||
    pathname === "/asnef" ||
    pathname === "/eliminar-coche";

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
          width: min(1120px, calc(100vw - 28px));
          max-height: min(72vh, 720px);
          overflow-y: auto;
          padding: 18px;
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

        .rtm-services-grid {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .rtm-service-group {
          min-width: 0;
          padding: 10px;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          background: #f8fafc;
          transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
        }

        .rtm-service-group:nth-child(3n + 1) {
          background: linear-gradient(145deg, #f8fafc, #eff6ff);
        }

        .rtm-service-group:nth-child(3n + 2) {
          background: linear-gradient(145deg, #f8fafc, #f0fdf4);
        }

        .rtm-service-group:nth-child(3n) {
          background: linear-gradient(145deg, #f8fafc, #fff7ed);
        }

        .rtm-service-group:hover {
          transform: translateY(-2px);
          border-color: #bfdbfe;
          box-shadow: 0 10px 24px rgba(15, 23, 42, .08);
        }

        .rtm-service-group-title {
          display: flex;
          gap: 8px;
          align-items: center;
          margin-bottom: 8px;
          color: #0f172a;
          font-size: 14px;
          font-weight: 900;
        }

        .rtm-service-option {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 4px;
          align-items: center;
          padding: 9px 10px;
          color: #0f172a;
          text-decoration: none;
          border-radius: 13px;
        }

        .rtm-service-option:hover,
        .rtm-service-option.is-active {
          background: #eff6ff;
        }

        @media (max-width: 1180px) and (min-width: 981px) {
          .rtm-services-dropdown {
            left: auto;
            right: -310px;
            transform: none;
          }

          .rtm-services-dropdown::before {
            left: calc(50% - 16px);
          }
        }

        .rtm-service-option-icon { display: none; }

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

          .rtm-services-grid {
            grid-template-columns: minmax(0, 1fr);
          }

          .rtm-service-group {
            background: rgba(255,255,255,.96);
          }
        }
      `}</style>

      <header className="rtm-navbar">
        <div className="rtm-navbar-inner">
          <Link
            to="/"
            className="rtm-navbar-brand"
            aria-label="RTM — Resuelve tus movidas. Ir al inicio"
          >
            <span className="rtm-navbar-logo-frame" aria-hidden="true">
              <img src={logo} alt="" className="rtm-navbar-logo" />
            </span>
            <span className="rtm-navbar-tagline">Resuelve tus movidas</span>
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
              aria-current={pathname === "/" ? "page" : undefined}
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
                aria-current={servicesActive ? "true" : undefined}
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
                  <div className="rtm-services-grid">
                    {SERVICE_GROUPS.map((group) => (
                      <section className="rtm-service-group" key={group.id}>
                        {group.landing ? (
                          <Link
                            to={group.landing}
                            className="rtm-service-group-title"
                            aria-current={
                              pathname === group.landing ? "page" : undefined
                            }
                            style={{ textDecoration: "none" }}
                          >
                            <span aria-hidden="true">{group.icon}</span>
                            <span>{group.title}</span>
                          </Link>
                        ) : (
                          <div className="rtm-service-group-title">
                            <span aria-hidden="true">{group.icon}</span>
                            <span>{group.title}</span>
                          </div>
                        )}

                        {group.landing ? (
                          <Link
                            to={group.landing}
                            role="menuitem"
                            className={`rtm-service-option ${
                              pathname === group.landing ? "is-active" : ""
                            }`}
                            aria-current={
                              pathname === group.landing ? "page" : undefined
                            }
                            style={{ marginBottom: 4 }}
                          >
                            <strong>{group.landingLabel}</strong>
                          </Link>
                        ) : null}

                        {group.links.map(({ to, label }) => {
                          const cleanTo = to.split("?")[0];
                          const uniqueDestination = SERVICE_LINK_COUNTS.get(to) === 1;
                          const active =
                            uniqueDestination &&
                            (to.includes("?")
                              ? currentLocation === to
                              : pathname === cleanTo || pathname.startsWith(`${cleanTo}/`));

                          return (
                            <Link
                              key={to}
                              to={to}
                              role="menuitem"
                              className={`rtm-service-option ${active ? "is-active" : ""}`}
                              aria-current={active ? "page" : undefined}
                            >
                              <strong>{label}</strong>
                            </Link>
                          );
                        })}
                      </section>
                    ))}
                  </div>
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
                  aria-current={active ? "page" : undefined}
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
