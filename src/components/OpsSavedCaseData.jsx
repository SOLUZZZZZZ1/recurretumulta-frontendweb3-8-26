import React from "react";
import { savedCaseData, savedPublicFamilyLabel } from "../lib/opsSavedCaseData.js";

const valueStyle = { margin: "4px 0 12px", whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: "#475569" };
const shown = value => value === null ? "No consta" : value;

function Fields({ rows }) {
  return <dl style={{ margin: 0 }}>{rows.map(([label, value]) => <div key={label}>
    <dt style={{ fontWeight: 700 }}>{label}</dt><dd style={valueStyle}>{shown(value)}</dd>
  </div>)}</dl>;
}

export default function OpsSavedCaseData({ workspace, caseId }) {
  const data = savedCaseData(workspace, caseId);
  return <section aria-labelledby="ops-saved-case-data-title">
    <h2 id="ops-saved-case-data-title" className="sr-h3" style={{ marginTop: 0 }}>Datos guardados del expediente</h2>
    {!data ? <p role="alert">Datos no disponibles: la lectura de los datos guardados está incompleta o no es válida. Actualiza el expediente.</p> : <>
      <p className="sr-p">Datos actuales recuperados del expediente. Pueden haberse editado después del alta; no acreditan identidad documental verificada.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 18 }}>
        <section aria-label="Persona interesada">
          <h3>Persona interesada</h3>
          <Fields rows={[["Nombre y apellidos", data.interested.full_name], ["DNI / NIE / Pasaporte", data.interested.dni_nie],
            ["Domicilio de notificaciones guardado", data.interested.address],
            ...[["Calle", "street"], ["Número", "street_number"], ["Piso", "floor"], ["Puerta", "door"],
              ["Código postal", "postal_code"], ["Población", "city"], ["Provincia", "province"]]
              .map(([label, key]) => [label, data.interested.address_parts[key]])]} />
        </section>
        <section aria-label="Contacto para esta gestión">
          <h3>Contacto para esta gestión</h3>
          <Fields rows={[["Nombre de contacto registrado", data.contact.name], ["Email de contacto", data.contact.email],
            ["Teléfono de contacto", data.contact.phone], ["Canal preferido",
              ({ email: "Email", phone: "Teléfono", whatsapp: "WhatsApp" })[data.contact.preferred_contact]
              || data.contact.preferred_contact]]} />
          <p className="sr-p">El contacto puede ser distinto del interesado. Estos datos no identifican al conductor, titular, pagador ni representante.</p>
        </section>
      </div>
      <Fields rows={[["Área pública guardada", savedPublicFamilyLabel(data.public_service_family)], ["Relato guardado", data.customer_comment]]} />
      <p className="sr-p">El área elegida es una orientación inicial, no una clasificación jurídica aprobada.</p>
      <p className="sr-p">Guardar o consultar estos datos no equivale a autorizar, verificar identidad, pagar ni presentar. Pueden consultarse aunque la autorización esté pendiente.</p>
    </>}
  </section>;
}
