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

const SERVICE_GROUPS = [
  {
    title: "Tráfico y vehículos",
    icon: "🚗",
    links: [
      { to: "/trafico", label: "Multas y sanciones" },
      { to: "/iniciar-expediente/traffic/vehicle_removal", label: "Eliminación de vehículos" },
      { to: "/iniciar-expediente/traffic/other_traffic", label: "Otros trámites de tráfico" },
    ],
  },
  {
    title: "Viajes",
    icon: "✈️",
    landing: "/viajes",
    links: [
      { to: "/iniciar-expediente/claims/airline?issue=cancelled_flight", label: "Vuelo cancelado" },
      { to: "/iniciar-expediente/claims/airline?issue=flight_delay", label: "Vuelo retrasado" },
      { to: "/iniciar-expediente/claims/airline?issue=lost_baggage", label: "Equipaje perdido" },
      { to: "/iniciar-expediente/claims/airline?issue=damaged_baggage", label: "Equipaje dañado" },
      { to: "/iniciar-expediente/claims/airline?issue=overbooking", label: "Overbooking" },
      { to: "/iniciar-expediente/claims/consumer?issue=cruise", label: "Problemas con cruceros" },
      { to: "/iniciar-expediente/claims/consumer?issue=travel_agency", label: "Agencias de viajes" },
    ],
  },
  {
    title: "Deudas y morosidad",
    icon: "💳",
    links: [
      { to: "/morosidad", label: "ASNEF / Equifax" },
      { to: "/iniciar-expediente/debt/asnef_equifax", label: "Salir de ficheros de morosidad" },
      { to: "/iniciar-expediente/debt/creditor_claim", label: "Reclamación frente al acreedor" },
    ],
  },
  {
    title: "Administración pública",
    icon: "🏛️",
    links: [
      { to: "/iniciar-expediente/administration/aeat", label: "Hacienda / AEAT" },
      { to: "/iniciar-expediente/administration/social_security", label: "Seguridad Social" },
      { to: "/iniciar-expediente/administration/town_hall", label: "Ayuntamientos" },
      { to: "/administracion", label: "Otros organismos públicos" },
    ],
  },
];

const SERVICE_LINKS = SERVICE_GROUPS.flatMap((group) => group.links);


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
          width: min(920px, calc(100vw - 28px));
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
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .rtm-service-group {
          min-width: 0;
          padding: 10px;
          border-radius: 14px;
          background: #f8fafc;
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
                  <div className="rtm-services-grid">
                    {SERVICE_GROUPS.map((group) => (
                      <section className="rtm-service-group" key={group.title}>
                        {group.landing ? (
                          <Link
                            to={group.landing}
                            className="rtm-service-group-title"
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
                            style={{ marginBottom: 4 }}
                          >
                            <strong>Ver todos los servicios de viajes</strong>
                          </Link>
                        ) : null}

                        {group.links.map(({ to, label }) => {
                          const cleanTo = to.split("?")[0];
                          const active =
                            pathname === cleanTo || pathname.startsWith(`${cleanTo}/`);

                          return (
                            <Link
                              key={to}
                              to={to}
                              role="menuitem"
                              className={`rtm-service-option ${active ? "is-active" : ""}`}
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
