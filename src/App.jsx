// src/App.jsx — RecurreTuMulta
import React, { lazy, Suspense } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import ResumenExpediente from "./pages/ResumenExpediente.jsx";
import Autorizar from "./pages/Autorizar.jsx";

import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";

// Páginas
import InicioRTM from "./pages/InicioRTM.jsx";
import InicioMultas from "./pages/Inicio.jsx";
import Trafico from "./pages/Trafico.jsx";
import ComoFunciona from "./pages/ComoFunciona.jsx";
import Precios from "./pages/Precios.jsx";
import FAQ from "./pages/FAQ.jsx";
import Contacto from "./pages/Contacto.jsx";
import Gestorias from "./pages/Gestorias.jsx";
import ReservasRestaurante from "./pages/ReservasRestaurante.jsx";
import AdminRestaurantes from "./pages/AdminRestaurantes.jsx";
import PartnerUpload from "./pages/PartnerUpload";
import PartnerChangePassword from "./pages/PartnerChangePassword.jsx";
import PartnerPanelExpedientes from "./pages/PartnerPanelExpedientes.jsx";
import SolicitarAltaGestoria from "./pages/SolicitarAltaGestoria.jsx";
import AdminCrearAsesoria from "./pages/AdminCrearAsesoria.jsx";
import OPSQueueSmart from "./pages/OPSQueueSmart.jsx";
import OpsVehicleRemoval from "./pages/OpsVehicleRemoval.jsx";
import EliminarCoche from "./pages/EliminarCoche.jsx";
import MorosidadHome from "./pages/MorosidadHome.jsx";
import AdministracionHome from "./pages/AdministracionHome.jsx";
import ViajesHome from "./pages/ViajesHome.jsx";
import Asnef from "./pages/Asnef.jsx";
import BancosHome from "./pages/BancosHome.jsx";
import EnergiaHome from "./pages/EnergiaHome.jsx";
import TelecomunicacionesHome from "./pages/TelecomunicacionesHome.jsx";
import SegurosHome from "./pages/SegurosHome.jsx";
import ViviendaHome from "./pages/ViviendaHome.jsx";
import IniciarExpedienteRTM from "./pages/IniciarExpedienteRTM.jsx";
import DocumentosCore from "./pages/DocumentosCore.jsx";

// Pago (post-pago: datos + autorización)
import PagoOk from "./pages/PagoOk.jsx";
import PagoCancel from "./pages/PagoCancel.jsx";

// Operador
import OpsDashboard from "./pages/OpsDashboard.jsx";
import OpsCaseDetail from "./pages/OpsCaseDetail.jsx";
import OpsCaseDetailPro from "./pages/OpsCaseDetailPro.jsx";
import OpsFollowups from "./pages/OpsFollowups.jsx";

// Legal
import AvisoLegal from "./pages/AvisoLegal.jsx";
import Privacidad from "./pages/Privacidad.jsx";
import Cookies from "./pages/Cookies.jsx";
import a1sF2RouteEnabled, {
  a1sF2PrivateRoute,
} from "./lib/rtmConnectA1SF2Contract.js";

const OpsA1SSyntheticReadOnly = lazy(
  () => import("./pages/OpsA1SSyntheticReadOnly.jsx")
);

function PrivateA1SFallback() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <Helmet>
        <title>RTM CONNECT A1-S · Staging sintético</title>
        <meta name="robots" content="noindex,nofollow,noarchive,nosnippet" />
      </Helmet>
      <div className="border-b border-amber-300 bg-amber-50 px-4 py-3">
        <div className="mx-auto flex max-w-[1500px] flex-wrap gap-2">
          <span className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-black text-amber-950">
            STAGING · SOLO CASOS SINTÉTICOS
          </span>
          <span className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-black text-amber-950">
            PRODUCCIÓN NO AUTORIZADA
          </span>
        </div>
      </div>
      <div className="mx-auto max-w-[1500px] p-6">
        <p role="status">Abriendo la vista privada de lectura sintética…</p>
      </div>
    </main>
  );
}

export default function App() {
  const location = useLocation();
  const intakeRouteKey = `${location.pathname}${location.search}`;
  const privateA1SEnabled = a1sF2RouteEnabled();
  const isA1SF2Route = location.pathname === a1sF2PrivateRoute;

  const hideChrome =
    location.pathname === "/__reservas-restaurante" ||
    location.pathname === "/__admin-restaurantes" ||
    (privateA1SEnabled && isA1SF2Route);

  return (
    <div
      className="min-h-screen text-zinc-900"
      style={{
        backgroundImage: "url('/marmol.jpg')",
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
        backgroundPosition: "center center",
      }}
    >
      {!hideChrome && <Navbar />}

      <Routes>
        <Route path="/" element={<InicioRTM />} />
        <Route path="/trafico" element={<Trafico />} />
        <Route path="/iniciar-expediente/:department/:caseType" element={<IniciarExpedienteRTM key={intakeRouteKey} />} />
        <Route path="/iniciar-expediente/:department" element={<IniciarExpedienteRTM key={intakeRouteKey} />} />
        <Route path="/iniciar-expediente" element={<IniciarExpedienteRTM key={intakeRouteKey} />} />
        <Route path="/multas" element={<InicioMultas />} />

        <Route path="/multas/documentos" element={<DocumentosCore />} />
        <Route path="/deudas/documentos" element={<DocumentosCore />} />
        <Route path="/administracion/documentos" element={<DocumentosCore />} />
        <Route path="/reclamaciones/documentos" element={<DocumentosCore />} />
        <Route path="/otros/documentos" element={<DocumentosCore />} />
        <Route path="/como-funciona" element={<ComoFunciona />} />
        <Route path="/precios" element={<Precios />} />
        <Route path="/eliminar-coche" element={<EliminarCoche />} />

        <Route path="/morosidad" element={<MorosidadHome />} />
        <Route path="/asnef" element={<Asnef />} />
        <Route path="/deudas" element={<Navigate to="/morosidad" replace />} />
        <Route path="/deudas/asnef" element={<Navigate to="/asnef" replace />} />
        <Route path="/morosidad/asnef" element={<Navigate to="/asnef" replace />} />
        <Route
          path="/deudas/iniciar"
          element={<Navigate to="/iniciar-expediente/debt/asnef_equifax?family=morosidad" replace />}
        />
        <Route path="/otros-procedimientos" element={<Navigate to="/administracion" replace />} />

        <Route path="/administracion" element={<AdministracionHome />} />
        <Route path="/viajes" element={<ViajesHome />} />
        <Route path="/bancos" element={<BancosHome />} />
        <Route path="/energia" element={<EnergiaHome />} />
        <Route path="/telecomunicaciones" element={<TelecomunicacionesHome />} />
        <Route path="/seguros" element={<SegurosHome />} />
        <Route path="/vivienda" element={<ViviendaHome />} />

        
        <Route path="/faq" element={<FAQ />} />
        <Route path="/contacto" element={<Contacto />} />
        <Route path="/gestorias" element={<Gestorias />} />
        <Route path="/resumen" element={<ResumenExpediente />} />
        <Route path="/autorizar" element={<Autorizar />} />
        <Route path="/partner/upload" element={<PartnerUpload />} />
        <Route path="/partner/change-password" element={<PartnerChangePassword />} />
        <Route path="/partner/panel" element={<PartnerPanelExpedientes />} />
        <Route path="/gestorias/alta" element={<SolicitarAltaGestoria />} />
        <Route path="/admin/crear-asesoria" element={<AdminCrearAsesoria />} />
        <Route path="/ops/queue-smart" element={<OPSQueueSmart />} />
        <Route path="/ops/vehicle-removal" element={<OpsVehicleRemoval />} />

        <Route path="/pago-ok" element={<PagoOk />} />
        <Route path="/pago-cancel" element={<PagoCancel />} />

        <Route path="/ops" element={<OpsDashboard />} />
        <Route path="/ops/followups" element={<OpsFollowups />} />
        <Route path="/ops/case/:caseId" element={<OpsCaseDetail />} />
        <Route path="/ops/review/:caseId" element={<OpsCaseDetailPro />} />
        <Route path="/ops/case/:caseId/review" element={<OpsCaseDetailPro />} />
        <Route path="/ops/pro/:caseId" element={<OpsCaseDetailPro />} />

        <Route path="/__reservas-restaurante" element={<ReservasRestaurante />} />
        <Route path="/__admin-restaurantes" element={<AdminRestaurantes />} />

        <Route path="/aviso-legal" element={<AvisoLegal />} />
        <Route path="/privacidad" element={<Privacidad />} />
        <Route path="/cookies" element={<Cookies />} />

        {privateA1SEnabled ? (
          <Route
            path={a1sF2PrivateRoute}
            caseSensitive
            element={
              isA1SF2Route ? (
                <Suspense fallback={<PrivateA1SFallback />}>
                  <OpsA1SSyntheticReadOnly />
                </Suspense>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
        ) : null}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {!hideChrome && <Footer />}
    </div>
  );
}
