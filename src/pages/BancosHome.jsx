import PublicServiceLanding from "../components/PublicServiceLanding.jsx";
import { getPublicService } from "../data/publicServices.js";

export default function BancosHome() {
  return <PublicServiceLanding family={getPublicService("bancos")} />;
}
