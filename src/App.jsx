// src/App.jsx — RecurreTuMulta
import React from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
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
import OpsCoreQueue from "./pages/OpsCoreQueue.jsx";
import OpsVehicleRemoval from "./pages/OpsVehicleRemoval.jsx";
import EliminarCoche from "./pages/EliminarCoche.jsx";
import MorosidadHome from "./pages/MorosidadHome.jsx";
import AdministracionHome from "./pages/AdministracionHome.jsx";
import ViajesHome from "./pages/ViajesHome.jsx";
import IniciarExpedienteRTM from "./pages/IniciarExpedienteRTM.jsx";
import DocumentosCore from "./pages/DocumentosCore.jsx";

// Pago (post-pago: datos + autorización)
import PagoOk from "./pages/PagoOk.jsx";
import PagoCancel from "./pages/PagoCancel.jsx";

// Operador
import OpsDashboard from "./pages/OpsDashboard.jsx";
import OpsCoreWorkspace from "./pages/OpsCoreWorkspace.jsx";

// Legal
import AvisoLegal from "./pages/AvisoLegal.jsx";
import Privacidad from "./pages/Privacidad.jsx";
import Cookies from "./pages/Cookies.jsx";

export default function App() {
  const location = useLocation();

  const hideChrome =
    location.pathname === "/__reservas-restaurante" ||
    location.pathname === "/__admin-restaurantes";

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
        <Route path="/iniciar-expediente/:department/:caseType" element={<IniciarExpedienteRTM />} />
        <Route path="/iniciar-expediente/:department" element={<IniciarExpedienteRTM />} />
        <Route path="/iniciar-expediente" element={<IniciarExpedienteRTM />} />
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
        <Route path="/administracion" element={<AdministracionHome />} />
        <Route path="/viajes" element={<ViajesHome />} />

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
        <Route path="/ops/queue-smart" element={<OpsCoreQueue />} />
        <Route path="/ops/vehicle-removal" element={<OpsVehicleRemoval />} />

        <Route path="/pago-ok" element={<PagoOk />} />
        <Route path="/pago-cancel" element={<PagoCancel />} />

        <Route path="/ops" element={<OpsDashboard />} />
        <Route path="/ops/case/:caseId" element={<OpsCoreWorkspace />} />
        <Route path="/ops/review/:caseId" element={<OpsCoreWorkspace />} />
        <Route path="/ops/case/:caseId/review" element={<OpsCoreWorkspace />} />
        <Route path="/ops/pro/:caseId" element={<OpsCoreWorkspace />} />

        <Route path="/__reservas-restaurante" element={<ReservasRestaurante />} />
        <Route path="/__admin-restaurantes" element={<AdminRestaurantes />} />

        <Route path="/aviso-legal" element={<AvisoLegal />} />
        <Route path="/privacidad" element={<Privacidad />} />
        <Route path="/cookies" element={<Cookies />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {!hideChrome && <Footer />}
    </div>
  );
}
