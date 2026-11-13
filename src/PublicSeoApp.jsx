import React from "react";
import { Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import InicioRTM from "./pages/InicioRTM.jsx";
import Trafico from "./pages/Trafico.jsx";
import ComoFunciona from "./pages/ComoFunciona.jsx";
import Precios from "./pages/Precios.jsx";
import MorosidadHome from "./pages/MorosidadHome.jsx";
import AdministracionHome from "./pages/AdministracionHome.jsx";
import ViajesHome from "./pages/ViajesHome.jsx";
import FAQ from "./pages/FAQ.jsx";
import Contacto from "./pages/Contacto.jsx";
import AvisoLegal from "./pages/AvisoLegal.jsx";
import Privacidad from "./pages/Privacidad.jsx";
import Cookies from "./pages/Cookies.jsx";

export default function PublicSeoApp() {
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
      <Navbar />
      <Routes>
        <Route path="/" element={<InicioRTM />} />
        <Route path="/trafico" element={<Trafico />} />
        <Route path="/como-funciona" element={<ComoFunciona />} />
        <Route path="/precios" element={<Precios />} />
        <Route path="/morosidad" element={<MorosidadHome />} />
        <Route path="/administracion" element={<AdministracionHome />} />
        <Route path="/viajes" element={<ViajesHome />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/contacto" element={<Contacto />} />
        <Route path="/aviso-legal" element={<AvisoLegal />} />
        <Route path="/privacidad" element={<Privacidad />} />
        <Route path="/cookies" element={<Cookies />} />
      </Routes>
      <Footer />
    </div>
  );
}
