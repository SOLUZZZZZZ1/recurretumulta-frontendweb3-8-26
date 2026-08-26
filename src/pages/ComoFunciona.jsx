import React from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";

const actions = [
  ["📄", "Revisamos", "La información y la documentación disponible."],
  ["🔎", "Analizamos", "La situación y las posibles vías de actuación."],
  ["📁", "Organizamos", "Todo dentro de un único expediente trazable."],
  ["💬", "Te explicamos", "Nuestra valoración y el siguiente paso posible."],
];

const commitments = [
  "Comprender antes de actuar.",
  "Explicar antes de decidir.",
  "Actuar solo cuando tú lo autorices.",
  "Mantenerte informado durante el proceso.",
];

function DocumentsScene() {
  return (
    <div className="cw-scene cw-documents" aria-hidden="true">
      <div className="cw-folder" />
      <div className="cw-sheet cw-sheet-back" />
      <div className="cw-sheet cw-sheet-front">
        <small>EXPEDIENTE</small>
        <strong>Documentación inicial</strong>
        <i />
        <i />
        <i className="short" />
        <span>RECIBIDO</span>
      </div>
      <div className="cw-pen" />
    </div>
  );
}

function DecisionScene() {
  return (
    <div className="cw-scene cw-decision" aria-hidden="true">
      <div className="cw-decision-panel">
        <small>VALORACIÓN INICIAL</small>
        <strong>Tú decides cómo continuar</strong>
        <p>Conocerás la propuesta antes de contratar una actuación posterior.</p>
        <div>
          <span>Continuar</span>
          <span>Guardar expediente</span>
        </div>
      </div>
    </div>
  );
}

function DashboardScene() {
  return (
    <div className="cw-scene cw-dashboard" aria-hidden="true">
      <div className="cw-laptop">
        <div className="cw-screen">
          <header><i /><i /><i /></header>
          <div className="cw-screen-body">
            <aside><b /><b /><b /><b /></aside>
            <main>
              <div className="cw-title-line"><b /><i /></div>
              <span className="cw-status">EXPEDIENTE EN CURSO</span>
              <div className="cw-progress"><i /></div>
              <div className="cw-cards"><b /><b /><b /></div>
            </main>
          </div>
        </div>
        <div className="cw-base" />
      </div>
    </div>
  );
}

export default function ComoFunciona() {
  return (
    <>
      <Seo
        title="Cómo trabajamos · RTM"
        description="Conoce el proceso de RTM: revisión inicial, valoración, decisión y seguimiento organizado de tu expediente."
      />

      <style>{`
        .cw-page{--navy:#0c2f61;--blue:#0b65d8;--soft:#eaf3ff;--green:#2bb673;--ink:#142033;--muted:#64748b;--line:#dce7f4;min-height:100vh;overflow:hidden;color:var(--ink);background:radial-gradient(circle at 12% 0%,rgba(11,101,216,.07),transparent 28%),linear-gradient(180deg,#fff 0%,#f8fbff 45%,#fff 100%)}
        .cw-container{width:min(1180px,calc(100% - 40px));margin:0 auto}
        .cw-hero{padding:70px 0 64px}.cw-hero-grid{display:grid;grid-template-columns:minmax(0,.92fr) minmax(470px,1.08fr);gap:58px;align-items:center}
        .cw-kicker{display:inline-flex;align-items:center;gap:10px;margin-bottom:18px;color:var(--blue);font-size:13px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.cw-kicker:before{content:"";width:34px;height:3px;border-radius:999px;background:var(--blue)}
        .cw-hero h1{max-width:660px;margin:0;color:var(--navy);font-size:clamp(48px,6.2vw,78px);font-weight:950;line-height:.98;letter-spacing:-.058em}.cw-lead{max-width:650px;margin:25px 0 0;color:#35445a;font-size:clamp(18px,2vw,22px);line-height:1.62}.cw-lead strong{color:var(--navy)}
        .cw-actions{display:flex;flex-wrap:wrap;gap:18px;align-items:center;margin-top:30px}.cw-primary,.cw-secondary{min-height:52px;display:inline-flex;align-items:center;justify-content:center;border-radius:14px;text-decoration:none;font-weight:900}.cw-primary{padding:14px 23px;color:#fff;background:var(--green);box-shadow:0 14px 30px rgba(43,182,115,.22)}.cw-secondary{padding:14px 4px;color:var(--navy)}
        .cw-hero-visual{position:relative;min-height:495px;overflow:hidden;border-radius:32px;background:linear-gradient(180deg,transparent 52%,rgba(7,25,49,.72) 100%),url("/hero-como-trabajamos.png") center/cover no-repeat,#e7edf3;box-shadow:0 30px 74px rgba(15,23,42,.20)}
        .cw-ai-label{position:absolute;top:18px;right:18px;max-width:calc(100% - 36px);padding:9px 12px;border:1px solid rgba(255,255,255,.58);border-radius:999px;color:#fff;background:rgba(8,34,67,.74);backdrop-filter:blur(10px);font-size:12px;font-weight:850;line-height:1.25;letter-spacing:.01em;box-shadow:0 8px 22px rgba(8,34,67,.18)}
        .cw-caption{position:absolute;right:24px;bottom:24px;left:24px;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:18px 20px;border:1px solid rgba(255,255,255,.22);border-radius:18px;color:#fff;background:rgba(8,34,67,.68);backdrop-filter:blur(12px)}.cw-caption strong{display:block;margin-bottom:3px;font-size:17px}.cw-caption span{color:rgba(255,255,255,.77);font-size:14px}.cw-caption b{display:grid;width:46px;height:46px;place-items:center;border-radius:14px;background:var(--blue);font-size:21px}
        .cw-strip{padding:28px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:rgba(255,255,255,.82)}.cw-strip-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}.cw-strip-item{display:flex;gap:13px;align-items:flex-start;padding:8px 12px}.cw-strip-icon{display:grid;flex:0 0 auto;width:42px;height:42px;place-items:center;border-radius:13px;background:var(--soft);font-size:21px}.cw-strip-item strong{display:block;margin-bottom:4px;color:var(--navy);font-size:16px}.cw-strip-item span{color:var(--muted);font-size:14px;line-height:1.45}
        .cw-story{padding:94px 0}.cw-block{display:grid;grid-template-columns:1fr 1fr;gap:72px;align-items:center;margin-bottom:108px}.cw-block:last-child{margin-bottom:0}.cw-block.reverse .cw-copy{order:2}.cw-block.reverse .cw-visual{order:1}
        .cw-label{display:inline-flex;align-items:center;gap:11px;margin-bottom:17px;color:var(--blue);font-size:13px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.cw-number{display:grid;width:40px;height:40px;place-items:center;border-radius:13px;color:#fff;background:var(--navy);letter-spacing:0}.cw-copy h2{max-width:570px;margin:0;color:var(--navy);font-size:clamp(34px,4vw,52px);line-height:1.05;letter-spacing:-.04em;font-weight:950}.cw-copy>p{max-width:590px;margin:21px 0 0;color:#475569;font-size:18px;line-height:1.72}.cw-note{max-width:590px;display:flex;gap:12px;align-items:flex-start;margin-top:22px;padding:16px 18px;border-left:4px solid var(--blue);border-radius:0 14px 14px 0;background:var(--soft)}.cw-note b{color:var(--blue);font-size:20px}.cw-note p{margin:0;color:#39506e;font-size:15px;line-height:1.55}
        .cw-scene{position:relative;min-height:420px;overflow:hidden;border:1px solid #dbe7f3;border-radius:30px;background:radial-gradient(circle at 18% 14%,rgba(255,255,255,.92),transparent 32%),linear-gradient(145deg,#edf5ff,#f9fbfd 46%,#e5edf5);box-shadow:0 24px 60px rgba(15,23,42,.13)}
        .cw-documents{display:grid;place-items:center}.cw-folder{position:absolute;width:72%;height:62%;border-radius:18px;background:#d4a76d;transform:rotate(-5deg) translate(-18px,18px);box-shadow:0 18px 30px rgba(99,61,22,.18)}.cw-sheet{position:absolute;width:64%;height:68%;border-radius:10px;background:#fff;box-shadow:0 16px 35px rgba(15,23,42,.16)}.cw-sheet-back{transform:rotate(4deg) translate(18px,-4px);opacity:.92}.cw-sheet-front{display:flex;flex-direction:column;padding:34px;transform:rotate(-1.5deg)}.cw-sheet-front small{color:var(--blue);font-weight:950;letter-spacing:.15em}.cw-sheet-front strong{margin:12px 0 28px;color:var(--navy);font-size:24px}.cw-sheet-front i{height:8px;margin-bottom:13px;border-radius:999px;background:#dbe7f3}.cw-sheet-front i.short{width:58%}.cw-sheet-front span{position:absolute;right:28px;bottom:26px;padding:8px 12px;border:2px solid #2bb673;border-radius:9px;color:#168a52;font-size:12px;font-weight:950;transform:rotate(-7deg)}.cw-pen{position:absolute;width:52%;height:10px;border-radius:999px;background:linear-gradient(90deg,#0c2f61,#2e5f9f 72%,#d7dde5);transform:rotate(-28deg) translate(40px,130px);box-shadow:0 7px 13px rgba(15,23,42,.18)}
        .cw-review-band{padding:80px 0;background:var(--navy);color:#fff}.cw-review-head{max-width:760px;margin:0 auto 34px;text-align:center}.cw-review-head span{color:#8cc2ff;font-size:13px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.cw-review-head h2{margin:12px 0 13px;font-size:clamp(36px,5vw,58px);line-height:1.04;letter-spacing:-.04em}.cw-review-head p{margin:0;color:rgba(255,255,255,.72);font-size:18px;line-height:1.6}.cw-action-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.cw-action{padding:24px 21px;border:1px solid rgba(255,255,255,.12);border-radius:20px;background:rgba(255,255,255,.07)}.cw-action em{display:grid;width:48px;height:48px;place-items:center;margin-bottom:17px;border-radius:14px;background:rgba(255,255,255,.11);font-style:normal;font-size:23px}.cw-action strong{display:block;margin-bottom:8px;font-size:19px}.cw-action p{margin:0;color:rgba(255,255,255,.69);font-size:14px;line-height:1.52}
        .cw-decision{display:grid;place-items:center;background:radial-gradient(circle at 80% 20%,rgba(11,101,216,.18),transparent 30%),linear-gradient(145deg,#f9fbff,#edf4fc)}.cw-decision-panel{width:72%;padding:34px;border:1px solid #d6e4f2;border-radius:24px;background:#fff;box-shadow:0 24px 55px rgba(15,23,42,.14)}.cw-decision-panel small{color:var(--blue);font-weight:950;letter-spacing:.13em}.cw-decision-panel strong{display:block;margin:13px 0 10px;color:var(--navy);font-size:30px;line-height:1.08}.cw-decision-panel p{margin:0;color:var(--muted);line-height:1.55}.cw-decision-panel>div{display:flex;gap:10px;margin-top:24px}.cw-decision-panel>div span{padding:11px 14px;border-radius:11px;font-size:13px;font-weight:900}.cw-decision-panel>div span:first-child{color:#fff;background:var(--green)}.cw-decision-panel>div span:last-child{color:var(--navy);background:var(--soft)}
        .cw-dashboard{display:grid;place-items:center;background:linear-gradient(145deg,#edf5ff,#f8fbff)}.cw-laptop{width:79%}.cw-screen{overflow:hidden;border:10px solid #172033;border-radius:18px 18px 10px 10px;background:#fff;box-shadow:0 28px 45px rgba(15,23,42,.22)}.cw-screen header{display:flex;gap:6px;padding:10px;background:#eef3f8}.cw-screen header i{width:7px;height:7px;border-radius:50%;background:#9fb0c2}.cw-screen-body{display:grid;grid-template-columns:68px 1fr;min-height:250px}.cw-screen-body aside{display:flex;flex-direction:column;gap:14px;padding:22px 15px;background:var(--navy)}.cw-screen-body aside b{height:8px;border-radius:999px;background:rgba(255,255,255,.34)}.cw-screen-body main{padding:24px}.cw-title-line{display:flex;justify-content:space-between;align-items:center}.cw-title-line b{width:42%;height:14px;border-radius:999px;background:#234f83}.cw-title-line i{width:25%;height:9px;border-radius:999px;background:#dbe7f3}.cw-status{display:inline-block;margin-top:24px;padding:7px 10px;border-radius:999px;color:#167e4c;background:#dff7eb;font-size:10px;font-weight:950}.cw-progress{height:9px;margin-top:17px;overflow:hidden;border-radius:999px;background:#e8eef5}.cw-progress i{display:block;width:66%;height:100%;background:var(--blue)}.cw-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:24px}.cw-cards b{height:68px;border:1px solid #dbe7f3;border-radius:10px;background:#f8fbff}.cw-base{width:114%;height:16px;margin-left:-7%;border-radius:0 0 26px 26px;background:linear-gradient(180deg,#cfd7df,#9aa8b7)}
        .cw-commitment{padding:84px 0;background:#f7faff}.cw-commitment-card{display:grid;grid-template-columns:.86fr 1.14fr;gap:46px;align-items:center;padding:44px;border:1px solid var(--line);border-radius:30px;background:#fff;box-shadow:0 24px 60px rgba(15,23,42,.08)}.cw-commitment-card h2{margin:0;color:var(--navy);font-size:clamp(36px,4vw,54px);line-height:1.04;letter-spacing:-.04em}.cw-commitment-card p{margin:18px 0 0;color:var(--muted);font-size:17px;line-height:1.65}.cw-commitment-list{display:grid;grid-template-columns:1fr 1fr;gap:14px}.cw-commitment-list div{display:flex;gap:11px;align-items:flex-start;padding:17px;border-radius:16px;background:var(--soft);color:#314a68;font-weight:800;line-height:1.45}.cw-commitment-list b{color:var(--green);font-size:19px}
        .cw-final{padding:90px 0 100px;text-align:center}.cw-final h2{max-width:850px;margin:0 auto;color:var(--navy);font-size:clamp(40px,5vw,66px);line-height:1.02;letter-spacing:-.05em}.cw-final p{max-width:700px;margin:22px auto 0;color:var(--muted);font-size:18px;line-height:1.65}.cw-final .cw-primary{margin-top:28px}
        @media(max-width:980px){.cw-hero-grid,.cw-block,.cw-commitment-card{grid-template-columns:1fr}.cw-hero-grid{gap:38px}.cw-hero-visual{min-height:430px}.cw-block{gap:34px;margin-bottom:76px}.cw-block.reverse .cw-copy,.cw-block.reverse .cw-visual{order:initial}.cw-strip-grid{grid-template-columns:1fr}.cw-action-grid{grid-template-columns:1fr 1fr}.cw-commitment-card{gap:30px}}
        @media(max-width:640px){.cw-container{width:min(100% - 28px,1180px)}.cw-hero{padding:46px 0}.cw-hero h1{font-size:46px}.cw-hero-visual{min-height:340px;border-radius:23px}.cw-ai-label{top:12px;right:12px;max-width:calc(100% - 24px);font-size:11px}.cw-caption{right:14px;bottom:14px;left:14px;padding:15px}.cw-caption b{display:none}.cw-story{padding:64px 0}.cw-copy h2{font-size:36px}.cw-copy>p{font-size:17px}.cw-scene{min-height:330px;border-radius:23px}.cw-paper-front{padding:24px}.cw-paper-front strong{font-size:19px}.cw-action-grid,.cw-commitment-list{grid-template-columns:1fr}.cw-review-band{padding:62px 0}.cw-decision-panel{width:82%;padding:25px}.cw-decision-panel strong{font-size:25px}.cw-decision-panel>div{flex-direction:column}.cw-screen-body{grid-template-columns:48px 1fr}.cw-screen-body main{padding:17px}.cw-cards b{height:48px}.cw-commitment{padding:62px 0}.cw-commitment-card{padding:27px;border-radius:23px}.cw-final{padding:68px 0 78px}.cw-final h2{font-size:42px}}
      `}</style>

      <main className="cw-page">
        <section className="cw-hero">
          <div className="cw-container cw-hero-grid">
            <div>
              <span className="cw-kicker">Cómo trabajamos</span>
              <h1>Resolver un problema empieza por comprenderlo.</h1>
              <p className="cw-lead">
                Antes de iniciar cualquier actuación realizamos una <strong>Revisión Inicial del Expediente</strong> para entender tu situación, revisar la documentación disponible y ayudarte a decidir el siguiente paso.
              </p>
              <div className="cw-actions">
                <Link className="cw-primary" to="/iniciar-expediente">Iniciar una Revisión Inicial</Link>
                <Link className="cw-secondary" to="/precios">Consultar precios →</Link>
              </div>
            </div>
            <div className="cw-hero-visual" role="img" aria-label="Imagen ilustrativa generada con inteligencia artificial de un expediente y su documentación organizados; no representa personas, hechos ni expedientes reales">
              <span className="cw-ai-label">Imagen ilustrativa generada con IA</span>
              <div className="cw-caption"><div><strong>Un proceso ordenado y trazable</strong><span>Desde la revisión inicial hasta el cierre.</span></div><b>✓</b></div>
            </div>
          </div>
        </section>

        <section className="cw-strip">
          <div className="cw-container cw-strip-grid">
            <div className="cw-strip-item"><span className="cw-strip-icon">🔐</span><div><strong>Información protegida</strong><span>Tratamos la documentación con confidencialidad.</span></div></div>
            <div className="cw-strip-item"><span className="cw-strip-icon">🧭</span><div><strong>Siempre sabrás qué ocurre</strong><span>Te indicaremos el estado y el siguiente paso.</span></div></div>
            <div className="cw-strip-item"><span className="cw-strip-icon">🤝</span><div><strong>La decisión es tuya</strong><span>No iniciamos actuaciones posteriores sin tu aceptación.</span></div></div>
          </div>
        </section>

        <section className="cw-story"><div className="cw-container">
          <article className="cw-block">
            <div className="cw-copy"><span className="cw-label"><b className="cw-number">01</b> Comprender</span><h2>Cada problema tiene una historia.</h2><p>Antes de proponer una actuación necesitamos comprender qué ha ocurrido y revisar la documentación disponible. No trabajamos con respuestas estándar: cada expediente parte de una situación diferente.</p><div className="cw-note"><b>→</b><p>No es necesario que tengas todo preparado. Empezaremos con la información de la que dispongas.</p></div></div>
            <div className="cw-visual"><DocumentsScene /></div>
          </article>
        </div></section>

        <section className="cw-review-band"><div className="cw-container">
          <div className="cw-review-head"><span>02 · Revisión Inicial del Expediente</span><h2>Analizamos antes de actuar.</h2><p>La revisión inicial es el corazón de RTM. Nos permite ordenar la información y valorar el siguiente paso antes de iniciar cualquier actuación posterior.</p></div>
          <div className="cw-action-grid">{actions.map(([icon,title,text])=><article className="cw-action" key={title}><em>{icon}</em><strong>{title}</strong><p>{text}</p></article>)}</div>
        </div></section>

        <section className="cw-story"><div className="cw-container">
          <article className="cw-block reverse">
            <div className="cw-copy"><span className="cw-label"><b className="cw-number">03</b> Decidir</span><h2>Con toda la información, tú decides.</h2><p>Cuando finalice la revisión te explicaremos nuestra valoración, las limitaciones apreciadas y cuál consideramos que puede ser el siguiente paso.</p><div className="cw-note"><b>→</b><p>La decisión de continuar será siempre tuya. No iniciamos actuaciones posteriores sin tu aceptación.</p></div></div>
            <div className="cw-visual"><DecisionScene /></div>
          </article>

          <article className="cw-block">
            <div className="cw-copy"><span className="cw-label"><b className="cw-number">04</b> Acompañar</span><h2>Tu expediente permanece organizado.</h2><p>Si decides continuar, la documentación, las actuaciones y el historial quedarán reunidos dentro del mismo expediente para que nunca pierdas el contexto de lo que está ocurriendo.</p><div className="cw-note"><b>→</b><p>Podrás conocer el estado del asunto y el siguiente paso previsto durante todo el proceso.</p></div></div>
            <div className="cw-visual"><DashboardScene /></div>
          </article>
        </div></section>

        <section className="cw-commitment"><div className="cw-container"><div className="cw-commitment-card">
          <div><span className="cw-kicker">Nuestro compromiso</span><h2>Claridad en cada paso.</h2><p>Queremos que comprendas qué estamos haciendo, por qué lo hacemos y qué decisión debes tomar a continuación.</p></div>
          <div className="cw-commitment-list">{commitments.map(item=><div key={item}><b>✓</b><span>{item}</span></div>)}</div>
        </div></div></section>

        <section className="cw-final"><div className="cw-container"><h2>Cuando comprendes un problema, ya has dado el primer paso para resolverlo.</h2><p>Selecciona el servicio correspondiente e inicia la Revisión Inicial de tu Expediente.</p><Link className="cw-primary" to="/iniciar-expediente">Iniciar una Revisión Inicial</Link></div></section>
      </main>
    </>
  );
}
