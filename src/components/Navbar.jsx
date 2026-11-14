import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "./Navbar.css";
import RtmBrand, { RTM_BRAND_LABEL } from "./RtmBrand.jsx";

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
    landing: "/trafico",
    landingLabel: "Ver todos los servicios de tráfico",
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
    landingLabel: "Ver todos los servicios de viajes",
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
    landing: "/morosidad",
    landingLabel: "Ver todos los servicios de deudas",
    links: [
      { to: "/morosidad", label: "ASNEF / Equifax" },
      { to: "/iniciar-expediente/debt/asnef_equifax", label: "Salir de ficheros de morosidad" },
      { to: "/iniciar-expediente/debt/creditor_claim", label: "Reclamación frente al acreedor" },
    ],
  },
  {
    title: "Administración pública",
    icon: "🏛️",
    landing: "/administracion",
    landingLabel: "Ver todos los servicios de Administración",
    links: [
      { to: "/iniciar-expediente/administration/aeat", label: "Hacienda / AEAT" },
      { to: "/iniciar-expediente/administration/social_security", label: "Seguridad Social" },
      { to: "/iniciar-expediente/administration/town_hall", label: "Ayuntamientos" },
      { to: "/administracion", label: "Otros organismos públicos" },
    ],
  },
];

const SERVICE_LINKS = SERVICE_GROUPS.flatMap((group) => [
  ...(group.landing ? [{ to: group.landing }] : []),
  ...group.links,
]);


export default function Navbar() {
  const { pathname, search } = useLocation();
  const [open, setOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const servicesRef = useRef(null);

  const servicesActive = SERVICE_LINKS.some(
    ({ to }) => pathname === to || pathname.startsWith(`${to}/`)
  );

  useEffect(() => {
    setOpen(false);
    setServicesOpen(false);
  }, [pathname, search]);

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

      <header className="rtm-navbar">
        <div className="rtm-navbar-inner">
          <Link
            to="/"
            className="rtm-navbar-brand"
            aria-label={RTM_BRAND_LABEL}
          >
            <RtmBrand />
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
                            <strong>{group.landingLabel}</strong>
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
