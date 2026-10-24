import React from "react";
import logo from "/rtm-logo-transparente-recortado.png";

export const RTM_TAGLINE = "Resuelve tus movidas";
export const RTM_BRAND_LABEL = `RTM — ${RTM_TAGLINE}. Ir al inicio`;

export default function RtmBrand({ placement = "header" }) {
  if (placement === "footer") {
    return <div className="rtm-footer-brand">
      <span className="rtm-footer-brand-name">RTM</span>
      <span className="rtm-footer-brand-tagline">{RTM_TAGLINE}</span>
    </div>;
  }
  return <>
    <span className="rtm-navbar-logo-frame" aria-hidden="true">
      <img src={logo} alt="" className="rtm-navbar-logo" />
    </span>
    <span className="rtm-navbar-tagline">{RTM_TAGLINE}</span>
  </>;
}
