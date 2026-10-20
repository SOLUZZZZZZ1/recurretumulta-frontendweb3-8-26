import React from "react";
import { Link } from "react-router-dom";

function value(field, mask = false) {
  if (!field || field.status === "schema_unavailable") return "Lectura no disponible: campo no disponible en el esquema.";
  if (field.status === "not_recorded") return "No consta";
  if (mask && typeof field.value === "string") return "…" + field.value.slice(-4);
  return typeof field.value === "boolean" ? (field.value ? "Sí (valor guardado)" : "No (valor guardado)") : String(field.value);
}
function Fields({ title, fields, labels }) {
  return <section className="sr-card mt-4"><h2 className="sr-h3">{title}</h2>
    <dl>{labels.map(([key, label]) => <div key={key} className="py-2">
      <dt><strong>{label}</strong></dt>
      <dd>{value(fields?.[key], key === "dni_nie")}</dd>
      {fields?.[key]?.source && <dd className="text-xs text-slate-500">Origen: {fields[key].source}</dd>}
    </div>)}</dl></section>;
}
function Collection({ title, section, keys }) {
  return <section className="sr-card mt-4"><h2 className="sr-h3">{title}</h2>
    {section.status === "schema_unavailable"
      ? <p>Lectura no disponible: falta la tabla o una columna necesaria. No se acredita ausencia de registros.</p>
      : <><p>{section.status === "empty" ? "Sin registros en la lectura completada." : `${section.items.length} registros leídos.`}</p>
        {section.status === "partial" && <p>Listado parcial: se alcanzó el límite de lectura.</p>}
        {section.missing_columns.length > 0 && <p>Campos no disponibles: {section.missing_columns.join(", ")}.</p>}
        <ul>{section.items.map(item => <li key={item.id} className="border rounded p-3 mt-2">
          {keys.map(([key, label]) => <div key={key}><strong>{label}: </strong>
            {section.missing_columns.includes(key) ? "Lectura no disponible" : (item[key] == null || item[key] === "" ? "No consta" : String(item[key]))}
          </div>)}
        </li>)}</ul></>}
  </section>;
}
export default function OpsWorkspaceRead({ workspace, onRefresh }) {
  const { fields, identities } = workspace.case;
  return <main className="sr-container py-8" data-testid="workspace-read">
    <Link to="/ops" className="sr-btn-secondary">← Volver a OPS</Link>{" "}
    <button onClick={onRefresh} className="sr-btn-secondary">Actualizar lectura</button>
    <h1 className="sr-h2 mt-4">Expediente {workspace.case_id}</h1>
    <p role="status">Consulta de datos guardados · Solo lectura</p>
    <p>Esta consulta no acredita pago, firma ni representación y no autoriza ninguna actuación.</p>
    <Fields title="Datos del expediente" fields={fields} labels={[
      ["status","Estado guardado"],["payment_status","Estado de pago guardado"],
      ["department","Departamento"],["case_type","Tipo"],["category","Categoría"],
      ["organismo","Organismo / contraparte"],["expediente_ref","Referencia"],
      ["customer_comment","Relato guardado"],["notified_at","Notificación guardada"],
      ["deadline_main","Plazo guardado (no calculado ni validado)"],
      ["authorized","Indicador de autorización guardado"],["created_at","Creación"],["updated_at","Actualización"],
    ]}/>
    <Fields title="Interesado" fields={identities.interested} labels={[
      ["full_name","Nombre"],["dni_nie","Identificación (parcial)"],["address","Domicilio"],
      ["email","Email del interesado"],["phone","Teléfono del interesado"],
    ]}/>
    <Fields title="Contacto" fields={identities.contact} labels={[["full_name","Nombre del contacto"],["email","Email del contacto"]]}/>
    <section className="sr-card mt-4"><h2 className="sr-h3">Conductor, titular y representante</h2>
      <p>Lectura no disponible en este contrato. No se deducen del interesado ni del contacto.</p></section>
    <Collection title="Documentos · metadatos" section={workspace.sections.documents} keys={[
      ["id","ID"],["kind","Tipo"],["mime","Formato"],["size_bytes","Bytes"],["sha256","SHA-256 registrado"],["created_at","Fecha"],
    ]}/>
    <p>Se muestran metadatos registrados; no se han leído ni verificado los archivos. Exportación no disponible en esta vista.</p>
    <Collection title="Eventos · resumen" section={workspace.sections.timeline} keys={[["type","Tipo"],["created_at","Fecha"]]}/>
    <Collection title="Seguimientos guardados" section={workspace.sections.followups} keys={[
      ["title","Título"],["status","Estado"],["description","Descripción"],["due_at","Fecha guardada"],["resolved_at","Resolución guardada"],
    ]}/>
    <section className="sr-card mt-4"><h2 className="sr-h3">Evaluación jurídica no disponible</h2>
      <p>Hechos validados, familia jurídica, previa, generación y presentación no se han evaluado con esta lectura.
      No se habilitan aprobaciones, cobros, comunicaciones, descargas ni presentación.</p></section>
  </main>;
}
