import { useNavigate } from "react-router-dom";

export default function AdministracionHome() {
  const navigate = useNavigate();

  return (
    <main style={{minHeight:"100vh",padding:"48px 20px",background:"#f8fafc"}}>
      <div style={{maxWidth:1000,margin:"0 auto",background:"#fff",padding:32,borderRadius:24,boxShadow:"0 10px 30px rgba(0,0,0,.08)"}}>
        <div style={{display:"inline-block",padding:"8px 14px",borderRadius:999,background:"#dbeafe",color:"#1d4ed8",fontWeight:800}}>
          🏛 Administración y organismos públicos
        </div>

        <h1 style={{fontSize:46,margin:"20px 0 16px"}}>Revisamos su expediente antes de actuar</h1>

        <p style={{fontSize:18,lineHeight:1.7,color:"#475569"}}>
          Cada procedimiento administrativo es diferente. Antes de iniciar cualquier actuación
          estudiaremos la documentación para valorar las posibilidades reales del caso y, cuando
          proceda, le presentaremos un presupuesto detallado y sin compromiso.
        </p>

        <h2>¿Qué asuntos revisamos?</h2>

        <ul style={{lineHeight:2}}>
          <li>Agencia Tributaria (AEAT).</li>
          <li>Seguridad Social.</li>
          <li>Ayuntamientos.</li>
          <li>Comunidades Autónomas.</li>
          <li>Transportes.</li>
          <li>Consumo.</li>
          <li>Sanciones y procedimientos administrativos.</li>
          <li>Otros organismos públicos.</li>
        </ul>

        <h2>¿Cómo trabajamos?</h2>

        <ol style={{lineHeight:2}}>
          <li>Abrimos su expediente RTM.</li>
          <li>Revisamos la documentación.</li>
          <li>Le explicamos las opciones disponibles.</li>
          <li>Si la actuación es viable, recibirá un presupuesto previo.</li>
          <li>Solo comenzaremos la gestión cuando usted lo acepte.</li>
        </ol>

        <div style={{margin:"26px 0",padding:18,borderRadius:16,background:"#ecfdf5",border:"1px solid #bbf7d0"}}>
          <strong>Tranquilidad.</strong><br/>
          El envío de la documentación no implica la contratación del servicio.
          Primero estudiaremos el expediente y le informaremos con claridad.
        </div>

        <button
          onClick={() => navigate("/iniciar-expediente/administration/general_administration")}
          style={{
            background:"#16a34a",
            color:"#fff",
            border:0,
            borderRadius:14,
            padding:"16px 24px",
            fontWeight:800,
            fontSize:17,
            cursor:"pointer"
          }}
        >
          Solicitar revisión del expediente
        </button>

        <div style={{marginTop:10,color:"#64748b"}}>Sin compromiso.</div>
      </div>
    </main>
  );
}
