import React from "react";
import logo from "/rtm-logo-transparente-recortado.png";

export const RTM_TAGLINE = "Resuelve tus “movidas”";
export const RTM_BRAND_LABEL = `RTM — ${RTM_TAGLINE}. Ir al inicio`;

function Tagline({ className }) {
  return <span className={className}>
    <span className="rtm-tagline-lead"><strong className="rtm-tagline-verb">Resuelve</strong>{" tus"}</span>{" "}
    <span className="rtm-tagline-word">“movidas”</span>
  </span>;
}

export default function RtmBrand({ placement = "header" }) {
  if (placement === "footer") {
    return <div className="rtm-footer-brand">
      <span className="rtm-footer-brand-name">RTM</span>
      <Tagline className="rtm-footer-brand-tagline" />
    </div>;
  }
  return <>
    <span className="rtm-navbar-logo-frame" aria-hidden="true">
      <img src={logo} alt="" className="rtm-navbar-logo" />
    </span>
    <Tagline className="rtm-navbar-tagline" />
  </>;
}
