import React from 'react';

const missing = value => value || 'Pendiente de completar';
const groupStyle = { border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, minWidth: 0 };
const valueStyle = { margin: '5px 0 12px', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' };

/** Display the same field projection used by the existing intake POST.
 * No inferred identity, approval checkbox, account data or storage side effect.
 */
export default function IntakeClientSummary({ fields, familyTitle, caseTypeLabel, hasCase = false }) {
  return <section aria-labelledby="intake-client-summary-title" style={{ marginBottom: 22, padding: 22,
    border: '1px solid #bfdbfe', borderRadius: 20, background: '#f8fbff', color: '#0f172a' }}>
    <h2 id="intake-client-summary-title" style={{ margin: '0 0 10px', fontSize: 23 }}>Resumen de los datos del formulario</h2>
    <p style={{ marginTop: 0, color: '#475569', lineHeight: 1.6 }}>
      {hasCase
        ? 'Datos utilizados en la solicitud de alta. Este resumen no es una nueva lectura del servidor.'
        : 'Estos son los datos preparados para el alta. Todavía no se han enviado; puedes corregirlos en los campos anteriores.'}
    </p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
      <div style={groupStyle}>
        <h3 style={{ marginTop: 0 }}>Persona interesada</h3>
        <dl style={{ margin: 0 }}>
          <dt>Nombre y apellidos</dt><dd style={valueStyle}>{missing(fields.full_name)}</dd>
          <dt>DNI / NIE / Pasaporte</dt><dd style={valueStyle}>{missing(fields.dni_nie)}</dd>
          <dt>Domicilio de notificaciones declarado</dt><dd style={valueStyle}>{missing(fields.domicilio_notif)}</dd>
        </dl>
      </div>
      <div style={groupStyle}>
        <h3 style={{ marginTop: 0 }}>Contacto para esta gestión</h3>
        <dl style={{ margin: 0 }}>
          <dt>Email</dt><dd style={valueStyle}>{missing(fields.email)}</dd>
          <dt>Teléfono</dt><dd style={valueStyle}>{missing(fields.telefono)}</dd>
          <dt>Canal preferido</dt><dd style={valueStyle}>{({ email: 'Email', phone: 'Teléfono', whatsapp: 'WhatsApp' })[fields.preferred_contact] || 'Pendiente de seleccionar'}</dd>
        </dl>
        <p style={{ marginBottom: 0, fontSize: 14 }}>La persona de contacto puede ser distinta de la persona interesada. Utilizaremos estos datos para las comunicaciones relacionadas con el expediente.</p>
      </div>
    </div>
    <p style={{ marginBottom: 8 }}><strong>Área elegida:</strong> {familyTitle} · {caseTypeLabel}</p>
    <p style={{ marginTop: 0, color: '#475569', fontSize: 14 }}>Es una orientación inicial aportada en el formulario, no una clasificación jurídica confirmada. Se contrastará con los documentos.</p>
    <p style={{ marginBottom: 0, color: '#475569', fontSize: 14 }}><strong>Representación RTM:</strong> su alcance se comprobará en la autorización correspondiente. Completar o enviar estos datos no equivale a tenerla firmada o verificada.</p>
  </section>;
}
