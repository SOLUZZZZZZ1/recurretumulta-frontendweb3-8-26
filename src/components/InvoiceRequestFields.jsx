import React from 'react';

const inputStyle={display:'block',width:'100%',padding:'10px 12px',border:'1px solid #cbd5e1',borderRadius:10,marginTop:5};
const labelStyle={display:'block',fontWeight:700,marginTop:12};

export const emptyInvoiceData={legal_name:'',tax_id:'',address:'',postal_code:'',city:'',province:'',country:'ES'};

export function validInvoiceData(data){
  return ['legal_name','tax_id','address','postal_code','city','province','country']
    .every(key=>String(data?.[key]||'').trim().length>0);
}

export default function InvoiceRequestFields({requested,onRequestedChange,data,onDataChange,disabled=false}){
  function change(key,value){onDataChange(current=>({...current,[key]:value}));}
  return <section style={{margin:'18px 0',padding:16,border:'1px solid #dbe3ec',borderRadius:14,background:'#f8fafc'}}>
    <label style={{display:'flex',alignItems:'center',gap:9,fontWeight:800}}>
      <input type="checkbox" checked={requested} disabled={disabled} onChange={event=>onRequestedChange(event.target.checked)}/>
      ¿Necesitas factura?
    </label>
    {requested&&<div aria-live="polite">
      <p style={{margin:'10px 0',color:'#475569'}}>Tras confirmar el pago, tramitaremos la factura y la enviaremos al correo del expediente. El importe pagado incluye el IVA del 21 % cuando se aplica el tipo general; otros tratamientos fiscales requieren revisión.</p>
      <label style={labelStyle}>Nombre o razón social<input style={inputStyle} autoComplete="organization" maxLength={200} required value={data.legal_name} disabled={disabled} onChange={event=>change('legal_name',event.target.value)}/></label>
      <label style={labelStyle}>NIF / CIF / VAT ID<input style={inputStyle} autoComplete="off" maxLength={40} required value={data.tax_id} disabled={disabled} onChange={event=>change('tax_id',event.target.value)}/></label>
      <label style={labelStyle}>Domicilio fiscal<input style={inputStyle} autoComplete="billing street-address" maxLength={240} required value={data.address} disabled={disabled} onChange={event=>change('address',event.target.value)}/></label>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10}}>
        <label style={labelStyle}>Código postal<input style={inputStyle} autoComplete="billing postal-code" maxLength={20} required value={data.postal_code} disabled={disabled} onChange={event=>change('postal_code',event.target.value)}/></label>
        <label style={labelStyle}>Localidad<input style={inputStyle} autoComplete="billing address-level2" maxLength={120} required value={data.city} disabled={disabled} onChange={event=>change('city',event.target.value)}/></label>
        <label style={labelStyle}>Provincia / región<input style={inputStyle} autoComplete="billing address-level1" maxLength={120} required value={data.province} disabled={disabled} onChange={event=>change('province',event.target.value)}/></label>
        <label style={labelStyle}>País (código de 2 letras, p. ej. ES)<input style={inputStyle} autoComplete="billing country" maxLength={2} required value={data.country} disabled={disabled} onChange={event=>change('country',event.target.value)}/></label>
      </div>
    </div>}
  </section>;
}
