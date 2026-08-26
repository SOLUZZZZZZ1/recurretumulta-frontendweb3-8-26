import PublicServiceLanding from "../components/PublicServiceLanding.jsx";
import { getPublicService } from "../data/publicServices.js";

export default function SegurosHome() {
  return <PublicServiceLanding family={getPublicService("seguros")} />;
}
