import PublicServiceLanding from "../components/PublicServiceLanding.jsx";
import { getPublicService } from "../data/publicServices.js";

export default function TelecomunicacionesHome() {
  return <PublicServiceLanding family={getPublicService("telecomunicaciones")} />;
}
