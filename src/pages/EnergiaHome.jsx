import PublicServiceLanding from "../components/PublicServiceLanding.jsx";
import { getPublicService } from "../data/publicServices.js";

export default function EnergiaHome() {
  return <PublicServiceLanding family={getPublicService("energia")} />;
}
