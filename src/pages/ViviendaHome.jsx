import PublicServiceLanding from "../components/PublicServiceLanding.jsx";
import { getPublicService } from "../data/publicServices.js";

export default function ViviendaHome() {
  return <PublicServiceLanding family={getPublicService("vivienda")} />;
}
