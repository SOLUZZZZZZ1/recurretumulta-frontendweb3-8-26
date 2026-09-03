import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { isPaidStatus } from "../lib/opsPayment.js";
import { OPS_PUBLIC_FAMILIES, publicFamilyOf } from "../lib/opsFamilies.js";
import { useOpsAuth } from "../ops-auth/OpsAuthContext.jsx";

const API = "/api";

const FAMILY_COLORS = {
  trafico: ["#eff6ff", "#bfdbfe"], viajes: ["#ecfdf5", "#bbf7d0"],
  morosidad: ["#f5f3ff", "#ddd6fe"], administracion: ["#fff7ed", "#fed7aa"],
  bancos: ["#ecfeff", "#a5f3fc"], energia: ["#fffbeb", "#fde68a"],
  telecomunicaciones: ["#eef2ff", "#c7d2fe"], seguros: ["#f0fdfa", "#99f6e4"],
  vivienda: ["#fff1f2", "#fecdd3"], other: ["#f8fafc", "#e2e8f0"],
};
const FAMILIES = OPS_PUBLIC_FAMILIES.map((family) => {
  const [bg, border] = FAMILY_COLORS[family.key] || FAMILY_COLORS.other;
  return { ...family, bg, border };
});

const TYPE_LABELS = {
  fine:"Multas", vehicle_removal:"Eliminar vehículo",
  asnef_equifax:"ASNEF / Equifax", creditor_claim:"Reclamación a acreedor",
  aeat:"AEAT / Hacienda", social_security:"Seguridad Social", town_hall:"Ayuntamientos",
  flight_cancelled:"Vuelo cancelado", flight_delayed:"Vuelo retrasado",
  baggage:"Equipaje", overbooking:"Overbooking", cruise:"Cruceros",
  travel_agency:"Agencias de viajes", airline:"Aerolíneas, vuelos y equipaje",
  consumer:"Reclamación de consumo", other_claim:"Otra reclamación",
  other_traffic:"Otro trámite de tráfico", other_debt:"Otra cuestión de deuda",
  general_administration:"Otro trámite administrativo", other:"Otros",
};

async function fetchJson(fetchImpl, url, options={}) {
  const r = await fetchImpl(url, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail || `Error HTTP ${r.status}`);
  return data;
}
function fmt(d){ if(!d) return "—"; try{return new Date(d).toLocaleString("es-ES");}catch{return "—";} }
function familyOf(x){return publicFamilyOf(x);}
function typeOf(x){
  if(x?.case_type) return String(x.case_type).toLowerCase();
  return String(x?.category||"").toLowerCase()==="vehicle_removal" ? "vehicle_removal" : "other";
}
function isPaidCase(x){return isPaidStatus(x?.payment_status);}
function isPresented(x){const s=String(x?.status||"").toLowerCase();return s==="submitted"||s.includes("presentado");}
function isClosed(x){return ["closed","archived","resolved","estimado","desestimado","vehicle_removal_completed"].includes(String(x?.status||"").toLowerCase());}
function needsPaidReview(x){return isPaidCase(x)&&!isPresented(x)&&!isClosed(x);}
function isWaiting(x){return !isPaidCase(x)&&["authorization_pending","pending_documents","ready_to_pay","vehicle_removal_pending_payment"].includes(String(x?.status||"").toLowerCase());}
function needsWork(x){return needsPaidReview(x)||(!isPresented(x)&&!isClosed(x)&&!isWaiting(x));}
function statusLabel(s){
  const m={authorization_pending:"Pendiente autorización",uploaded:"Documentación recibida",
    analyzed:"Analizado",generated:"Borrador generado",manual_review:"Revisión manual",
    pending_documents:"Esperando documentación",ready_to_pay:"Pendiente de pago",
    ready_to_submit:"Listo para actuar",final_ready:"Versión final preparada",
    submitted:"Presentado / gestionado",presentado_manual_ayuntamiento:"Presentado manualmente",
    vehicle_removal_pending_payment:"Pendiente de pago",vehicle_removal_paid:"Pagado",
    vehicle_removal_assigned:"Asignado",vehicle_removal_completed:"Completado"};
  return m[String(s||"").toLowerCase()]||s||"Sin estado";
}
function caseLink(x){
  return familyOf(x)==="trafico"&&typeOf(x)==="vehicle_removal"
    ? "/ops/vehicle-removal"
    : `/ops/case/${encodeURIComponent(x.case_id)}`;
}
function Pill({children,tone="default"}){
  const m={default:["#f1f5f9","#475569"],warn:["#fef3c7","#92400e"],success:["#dcfce7","#166534"],
    info:["#dbeafe","#1d4ed8"],danger:["#fee2e2","#991b1b"]};
  const [background,color]=m[tone]||m.default;
  return <span style={{background,color,borderRadius:999,padding:"5px 10px",fontSize:12,fontWeight:800}}>{children}</span>;
}

export default function OpsDashboard(){
  const { session, authFetch, logout, canSupervise } = useOpsAuth();
  const [items,setItems]=useState([]);
  const [due,setDue]=useState([]);
  const [family,setFamily]=useState("all");
  const [type,setType]=useState("all");
  const [state,setState]=useState("work");
  const [search,setSearch]=useState("");
  const [loading,setLoading]=useState(false);
  const [tickLoading,setTickLoading]=useState(false);
  const [error,setError]=useState("");
  const tickLockRef=useRef(false);
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const [q,f]=await Promise.all([
        fetchJson(authFetch, `${API}/ops/queue?status=all&limit=500`),
        fetchJson(authFetch, `${API}/ops/followups/due?days=7&limit=500`).catch(()=>({items:[]}))
      ]);
      setItems(q.items||[]);setDue(f.items||[]);
    }catch(e){setError(e.message||"No se pudo cargar OPS CORE");}
    finally{setLoading(false);}
  },[authFetch]);
  async function runTick(){
    if(!canSupervise||tickLockRef.current)return;
    tickLockRef.current=true;
    setTickLoading(true);setError("");
    try{await fetchJson(authFetch, `${API}/ops/automation/tick?limit=25`,{method:"POST"});await load();}
    catch(e){setError(e.message||"No se pudo ejecutar automatización");}
    finally{tickLockRef.current=false;setTickLoading(false);}
  }
  useEffect(()=>{void load();},[load]);

  const urgentIds=useMemo(()=>new Set(due.map(x=>String(x.case_id))),[due]);
  const paidPendingCount=useMemo(()=>items.filter(needsPaidReview).length,[items]);
  const stats=useMemo(()=>{
    const r={};
    FAMILIES.forEach(f=>{
      const a=items.filter(x=>familyOf(x)===f.key);
      r[f.key]={total:a.length,work:a.filter(needsWork).length,
        paid:a.filter(needsPaidReview).length,
        urgent:a.filter(x=>urgentIds.has(String(x.case_id))).length,waiting:a.filter(isWaiting).length};
    });
    return r;
  },[items,urgentIds]);

  const types=useMemo(()=>{
    const base=family==="all"?items:items.filter(x=>familyOf(x)===family);
    const c={};base.forEach(x=>{const t=typeOf(x);c[t]=(c[t]||0)+1;});
    return Object.entries(c).sort((a,b)=>b[1]-a[1]);
  },[items,family]);

  const filtered=useMemo(()=>{
    const q=search.trim().toLowerCase();
    return items.filter(x=>{
      if(family!=="all"&&familyOf(x)!==family)return false;
      if(type!=="all"&&typeOf(x)!==type)return false;
      if(state==="work"&&!needsWork(x))return false;
      if(state==="paid"&&!needsPaidReview(x))return false;
      if(state==="urgent"&&!urgentIds.has(String(x.case_id)))return false;
      if(state==="waiting"&&!isWaiting(x))return false;
      if(state==="presented"&&!isPresented(x))return false;
      if(state==="closed"&&!isClosed(x))return false;
      if(!q)return true;
      return [x.contact_name,x.contact_email,x.case_id,x.expediente_ref,x.organismo,x.matricula,x.public_service_family,
        x.customer_comment,x.department,x.case_type,x.status,x.payment_status].filter(Boolean).join(" ").toLowerCase().includes(q);
    }).sort((a,b)=>{
      const paidPriority=Number(needsPaidReview(b))-Number(needsPaidReview(a));
      if(paidPriority)return paidPriority;
      const urgentPriority=Number(urgentIds.has(String(b.case_id)))-Number(urgentIds.has(String(a.case_id)));
      if(urgentPriority)return urgentPriority;
      return new Date(b.updated_at||0).getTime()-new Date(a.updated_at||0).getTime();
    });
  },[items,family,type,state,search,urgentIds]);

  return <main className="min-h-screen bg-slate-50 p-4 md:p-6"><div className="mx-auto max-w-[1500px]">
    <header className="rounded-[28px] bg-slate-950 p-5 text-white shadow-xl">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div><div className="text-[10px] uppercase tracking-[.35em] text-slate-400">RTM · Centro de operaciones</div>
          <h1 className="mt-1 text-3xl font-bold">OPS CORE</h1>
          <p className="mt-2 text-sm text-slate-300">Familia → tipo de caso → estado → expediente.</p>
          <p className="mt-1 text-xs text-slate-400">{session.operator.displayName || session.operator.email} · sesión individual</p></div>
        <div className="flex flex-wrap gap-2">
          <button onClick={load} className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900">{loading?"Cargando…":"↻ Refrescar"}</button>
          <button onClick={()=>{setFamily("all");setType("all");setState("paid");}} className="rounded-xl bg-lime-300 px-4 py-2.5 text-sm font-bold text-slate-950">💶 {paidPendingCount} pagados por revisar</button>
          {canSupervise?<button onClick={runTick} disabled={tickLoading} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold disabled:opacity-60">{tickLoading?"Ejecutando…":"▶ Automatización"}</button>:null}
          <Link to="/ops/followups" className="rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950">⏰ Seguimientos{due.length?` (${due.length})`:""}</Link>
          <Link to="/ops/queue-smart" className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold">Cola técnica</Link>
          <button onClick={logout} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold">Cerrar sesión</button>
        </div>
      </div>
    </header>

    {error?<div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>:null}

    <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {FAMILIES.map(f=>{const s=stats[f.key]||{};return <button key={f.key}
        onClick={()=>{setFamily(f.key);setType("all");setState("work");}}
        className="text-left rounded-3xl p-5 shadow-sm transition hover:-translate-y-0.5"
        style={{background:f.bg,border:`1px solid ${f.border}`}}>
        <div className="text-4xl">{f.icon}</div><div className="mt-3 text-lg font-bold text-slate-900">{f.label}</div>
        <div className="mt-4 flex flex-wrap gap-2"><Pill tone="info">{s.total||0} total</Pill>
          {f.entryMode==="consultation"?<Pill>consulta previa</Pill>:null}
          <Pill tone="warn">{s.work||0} pendientes</Pill>{s.urgent?<Pill tone="danger">{s.urgent} urgentes</Pill>:null}
          {s.paid?<Pill tone="success">{s.paid} pagados por revisar</Pill>:null}
          {s.waiting?<Pill>{s.waiting} esperando cliente</Pill>:null}</div>
      </button>})}
    </section>

    <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[1.4fr_repeat(3,minmax(150px,.6fr))]">
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Buscar nombre, email, matrícula, organismo, referencia o Case ID…"
          className="rounded-xl border border-slate-200 px-4 py-3"/>
        <select value={family} onChange={e=>{setFamily(e.target.value);setType("all");}} className="rounded-xl border px-3">
          <option value="all">Todas las familias</option>{FAMILIES.map(f=><option key={f.key} value={f.key}>{f.icon} {f.label}</option>)}
        </select>
        <select value={type} onChange={e=>setType(e.target.value)} className="rounded-xl border px-3">
          <option value="all">Todos los tipos</option>{types.map(([t,n])=><option key={t} value={t}>{TYPE_LABELS[t]||t} ({n})</option>)}
        </select>
        <select value={state} onChange={e=>setState(e.target.value)} className="rounded-xl border px-3">
          <option value="work">Pendientes de trabajo</option><option value="paid">Pagados pendientes de revisión</option><option value="urgent">Urgentes / próximos 7 días</option>
          <option value="waiting">Esperando cliente</option><option value="presented">Presentados / gestionados</option>
          <option value="closed">Cerrados</option><option value="all">Todos</option>
        </select>
      </div>
    </section>

    <section className="mt-5 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b p-4">
        <div><h2 className="text-xl font-bold text-slate-900">Expedientes</h2>
          <div className="text-sm text-slate-500">{filtered.length} visibles · {items.length} cargados</div></div>
        {due.length?<Link to="/ops/followups?scope=due" className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-800 hover:bg-rose-100">⏰ {due.length} seguimientos vencidos/próximos · Ver</Link>:null}
      </div>
      <div className="p-4 space-y-3">
        {!filtered.length?<div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">No hay expedientes con estos filtros.</div>:
        filtered.map(x=>{const fam=FAMILIES.find(f=>f.key===familyOf(x));const urgent=urgentIds.has(String(x.case_id));
          return <article key={x.case_id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><span className="text-xl">{fam?.icon||"📂"}</span>
                  <strong className="text-lg text-slate-900">{x.contact_name||x.contact_email||"Cliente sin nombre"}</strong>
                  {urgent?<Pill tone="danger">URGENTE</Pill>:null}</div>
                <div className="mt-2 text-sm font-semibold text-slate-700">{fam?.label||"Otros"} → {TYPE_LABELS[typeOf(x)]||typeOf(x)}</div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  {x.expediente_ref?<span>Ref: <b>{x.expediente_ref}</b></span>:null}
                  {x.organismo?<span>Organismo: <b>{x.organismo}</b></span>:null}
                  {x.matricula?<span>Matrícula: <b>{x.matricula}</b></span>:null}
                  <span>Actualizado: {fmt(x.updated_at)}</span>
                </div>
                <div className="mt-2 text-[11px] text-slate-400 break-all">Case ID: {x.case_id}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <Pill tone={isPaidCase(x)?"success":"default"}>{isPaidCase(x)?"Pago confirmado":"Sin pago confirmado"}</Pill>
                <Pill tone={isPresented(x)?"success":isWaiting(x)?"default":urgent?"danger":"warn"}>{statusLabel(x.status)}</Pill>
                <Link to={caseLink(x)} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white">Abrir expediente</Link>
              </div>
            </div>
          </article>})}
      </div>
    </section>
  </div></main>;
}
