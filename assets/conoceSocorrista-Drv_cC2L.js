import{s as S}from"./index-CZiK5Th8.js";const v=["Hijo(a)","Cónyuge / Compañero(a)","Madre","Padre","Hermano(a)","Abuelo(a)","Nieto(a)","Sobrino(a)","Otro familiar"],R=["Soltero(a)","Casado(a)","Acompañado(a) / Unión no matrimonial","Divorciado(a)","Viudo(a)"],P={nit:"",estado_civil:"",nombre_conyuge:"",nombre_dependientes:"",dependientes_detalle:[],nacionalidad:"Salvadoreña",profesion_ocupacion:"",fecha_inicio_relacion_laboral:"",direccion_domicilio:"",cargo_publico_ultimos_5_anios:null,cargo_publico_periodo:"",cargo_publico_posicion:""};function C(i){const o=String(i||"").trim().toLowerCase();return o==="ninguno"||o==="no aplica"||o==="ninguno / no aplica"||o==="n/a"||o==="sin dependientes"}function h(i){const o=(i||[]).map(e=>({nombre:String((e==null?void 0:e.nombre)||"").trim(),parentesco:String((e==null?void 0:e.parentesco)||"").trim()})).filter(e=>e.nombre!=="");return o.length===0?"":o.map(e=>e.parentesco?`${e.nombre} (${e.parentesco})`:e.nombre).join(", ")}function y(i,o){if(Array.isArray(i)&&i.length>0)return i.map(n=>({nombre:String((n==null?void 0:n.nombre)||"").trim(),parentesco:String((n==null?void 0:n.parentesco)||"Hijo(a)").trim()})).filter(n=>n.nombre!=="");if(typeof i=="string"&&i.trim().startsWith("["))try{const n=JSON.parse(i);if(Array.isArray(n))return n.map(c=>({nombre:String((c==null?void 0:c.nombre)||"").trim(),parentesco:String((c==null?void 0:c.parentesco)||"Hijo(a)").trim()})).filter(c=>c.nombre!=="")}catch{}const e=String(o||"").trim();return!e||C(e)?[]:e.split(/[,;\n]+/).map(n=>n.trim()).filter(Boolean).map(n=>{const c=n.match(/^(.*?)\s*\(([^()]+)\)\s*$/);return c?{nombre:c[1].trim(),parentesco:c[2].trim()||"Hijo(a)"}:{nombre:n,parentesco:"Hijo(a)"}}).filter(n=>n.nombre!=="")}function L(i,o){const e=o||{},n=(p,_,d="")=>typeof p=="string"&&p.trim()!==""?p:typeof _=="string"&&_.trim()!==""?_:d;let c=null;typeof(i==null?void 0:i.cargo_publico_ultimos_5_anios)=="boolean"?c=i.cargo_publico_ultimos_5_anios:typeof e.cargo_publico_ultimos_5_anios=="boolean"&&(c=e.cargo_publico_ultimos_5_anios);const s=n(i==null?void 0:i.nombre_dependientes,e.nombre_dependientes,""),t=y((i==null?void 0:i.dependientes_detalle)??e.dependientes_detalle,s);return{nit:n(i==null?void 0:i.nit,e.nit,""),estado_civil:n(i==null?void 0:i.estado_civil,e.estado_civil,""),nombre_conyuge:n(i==null?void 0:i.nombre_conyuge,e.nombre_conyuge,""),nombre_dependientes:s||(t.length>0?h(t):""),dependientes_detalle:t,nacionalidad:n(i==null?void 0:i.nacionalidad,e.nacionalidad,""),profesion_ocupacion:n(i==null?void 0:i.profesion_ocupacion,e.profesion_ocupacion,""),fecha_inicio_relacion_laboral:n(i==null?void 0:i.fecha_inicio_relacion_laboral,e.fecha_inicio_relacion_laboral,""),direccion_domicilio:n(i==null?void 0:i.direccion_domicilio,e.direccion_domicilio,""),cargo_publico_ultimos_5_anios:c,cargo_publico_periodo:n(i==null?void 0:i.cargo_publico_periodo,e.cargo_publico_periodo,""),cargo_publico_posicion:n(i==null?void 0:i.cargo_publico_posicion,e.cargo_publico_posicion,"")}}function D(i){if(Array.isArray(i.dependientes_detalle)&&i.dependientes_detalle.length>0){const o=h(i.dependientes_detalle);if(o)return o}return String(i.nombre_dependientes||"").trim()}function $(i,o){const e={...L(i),...o||{}},n=[];return(!String((i==null?void 0:i.primer_nombre)||"").trim()||!String((i==null?void 0:i.primer_apellido)||"").trim())&&n.push("Nombre completo"),String((i==null?void 0:i.direccion)||(o==null?void 0:o.direccion_override)||"").trim()||n.push("Dirección"),String((i==null?void 0:i.dui)||"").trim()||n.push("DUI"),String(e.estado_civil||"").trim()||n.push("Estado civil"),String((i==null?void 0:i.fecha_nacimiento)||"").trim()||n.push("Fecha de nacimiento"),String((i==null?void 0:i.telefono)||"").trim()||n.push("Teléfono"),String(e.nombre_conyuge||"").trim()||n.push("Nombre de cónyuge"),D(e)?Array.isArray(e.dependientes_detalle)&&e.dependientes_detalle.some(s=>!String(s.nombre||"").trim()||!String(s.parentesco||"").trim())&&n.push("Nombre y parentesco de cada dependiente"):n.push('Dependientes (o marcar "Sin dependientes")'),String(e.nacionalidad||"").trim()||n.push("Nacionalidad"),String(e.profesion_ocupacion||"").trim()||n.push("Profesión u ocupación"),String(e.fecha_inicio_relacion_laboral||"").trim()||n.push("Fecha de inicio laboral / ingreso"),String(e.direccion_domicilio||"").trim()||n.push("Dirección de domicilio"),e.cargo_publico_ultimos_5_anios===null||e.cargo_publico_ultimos_5_anios===void 0?n.push("Cargo público en últimos 5 años (Sí / No)"):e.cargo_publico_ultimos_5_anios===!0&&(String(e.cargo_publico_periodo||"").trim()||n.push("Periodo del cargo público"),String(e.cargo_publico_posicion||"").trim()||n.push("Posición del cargo público")),{isComplete:n.length===0,missingFields:n}}function X(i){const o=[];return String(i.estado_civil||"").trim()||o.push("Estado civil"),String(i.nombre_conyuge||"").trim()||o.push("Nombre de cónyuge"),D(i)?Array.isArray(i.dependientes_detalle)&&i.dependientes_detalle.some(n=>!String(n.nombre||"").trim()||!String(n.parentesco||"").trim())&&o.push("Nombre y parentesco de cada dependiente"):o.push("Dependientes"),String(i.nacionalidad||"").trim()||o.push("Nacionalidad"),String(i.profesion_ocupacion||"").trim()||o.push("Profesión u ocupación"),String(i.fecha_inicio_relacion_laboral||"").trim()||o.push("Fecha de inicio de relación laboral"),String(i.direccion_domicilio||"").trim()||o.push("Dirección de domicilio"),i.cargo_publico_ultimos_5_anios===null||i.cargo_publico_ultimos_5_anios===void 0?o.push("Cargo público en últimos 5 años (Sí / No)"):i.cargo_publico_ultimos_5_anios===!0&&(String(i.cargo_publico_periodo||"").trim()||o.push("Periodo del cargo público"),String(i.cargo_publico_posicion||"").trim()||o.push("Posición del cargo público")),{isComplete:o.length===0,missingFields:o}}async function U(i){try{const{data:o}=await S.from("configuracion").select("valor").eq("clave",`socorrista_kyc_${i}`).maybeSingle();if(o!=null&&o.valor)return typeof o.valor=="string"?JSON.parse(o.valor):o.valor}catch{}return null}async function j(i,o,e){var T,l,b,u,m,N,E,O,a,g;const n=new Date().toISOString(),c=(o.dependientes_detalle||[]).map(r=>({nombre:String((r==null?void 0:r.nombre)||"").trim(),parentesco:String((r==null?void 0:r.parentesco)||"Hijo(a)").trim()})).filter(r=>r.nombre!==""),s=c.length>0?h(c):((T=o.nombre_dependientes)==null?void 0:T.trim())||null,t={...o,dependientes_detalle:c,nombre_dependientes:s||""},p=X(t),_={nit:((l=t.nit)==null?void 0:l.trim())||null,estado_civil:((b=t.estado_civil)==null?void 0:b.trim())||null,nombre_conyuge:((u=t.nombre_conyuge)==null?void 0:u.trim())||null,nombre_dependientes:s,dependientes_detalle:c,nacionalidad:((m=t.nacionalidad)==null?void 0:m.trim())||null,profesion_ocupacion:((N=t.profesion_ocupacion)==null?void 0:N.trim())||null,fecha_inicio_relacion_laboral:((E=t.fecha_inicio_relacion_laboral)==null?void 0:E.trim())||null,direccion_domicilio:((O=t.direccion_domicilio)==null?void 0:O.trim())||null,cargo_publico_ultimos_5_anios:t.cargo_publico_ultimos_5_anios,cargo_publico_periodo:t.cargo_publico_ultimos_5_anios===!0?((a=t.cargo_publico_periodo)==null?void 0:a.trim())||null:t.cargo_publico_ultimos_5_anios===!1?"No aplica":null,cargo_publico_posicion:t.cargo_publico_ultimos_5_anios===!0?((g=t.cargo_publico_posicion)==null?void 0:g.trim())||null:t.cargo_publico_ultimos_5_anios===!1?"No aplica":null,ficha_kyc_completada:p.isComplete,ficha_kyc_actualizada_at:n,...(e==null?void 0:e.email)!==void 0?{email:e.email.trim()}:{},...(e==null?void 0:e.direccion)!==void 0?{direccion:e.direccion.trim()}:{}},d=`socorrista_kyc_${i}`,f=JSON.stringify({...t,cargo_publico_periodo:_.cargo_publico_periodo||"",cargo_publico_posicion:_.cargo_publico_posicion||"",ficha_kyc_completada:p.isComplete,updated_at:n});try{const{data:r}=await S.from("configuracion").select("id").eq("clave",d).maybeSingle();r?await S.from("configuracion").update({valor:f}).eq("id",r.id):await S.from("configuracion").insert([{clave:d,valor:f}])}catch(r){console.warn("Respaldo configuracion KYC omitido:",r)}try{const{error:r}=await S.from("socorristas").update(_).eq("id",i);if(!r)return{savedInTable:!0};if(r.code==="42703"||r.code==="PGRST204"||String(r.message||"").includes("dependientes_detalle")){const{dependientes_detalle:F,...I}=_,{error:A}=await S.from("socorristas").update(I).eq("id",i);if(!A)return{savedInTable:!0}}e&&(e.email!==void 0||e.direccion!==void 0)&&await S.from("socorristas").update({...e.email!==void 0?{email:e.email.trim()}:{},...e.direccion!==void 0?{direccion:e.direccion.trim()}:{}}).eq("id",i)}catch{}return{savedInTable:!1}}function k(i){const o=i.replace(/[^0-9-]/g,""),e=o.replace(/\D/g,"");if(e.length<=9&&!o.includes("--"))return e.length<=8?e:`${e.slice(0,8)}-${e.slice(8,9)}`;const n=e.slice(0,14);return n.length<=4?n:n.length<=10?`${n.slice(0,4)}-${n.slice(4)}`:n.length<=13?`${n.slice(0,4)}-${n.slice(4,10)}-${n.slice(10)}`:`${n.slice(0,4)}-${n.slice(4,10)}-${n.slice(10,13)}-${n.slice(13,14)}`}function G(i,o,e){const n=i.split(",")[1]||"",c=atob(n),s=new Uint8Array(c.length);for(let a=0;a<c.length;a++)s[a]=c.charCodeAt(a);const t=612,p=792,_=new TextEncoder,d=[],f=[0];let T=0;const l=a=>{const g=_.encode(a);d.push(g),T+=g.byteLength},b=a=>{d.push(a),T+=a.byteLength},u=a=>{f[a]=T,l(`${a} 0 obj
`)},m=()=>{l(`
endobj
`)};l(`%PDF-1.4
%ÿÿÿÿ
`),u(1),l("<< /Type /Catalog /Pages 2 0 R >>"),m(),u(2),l("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),m(),u(3),l(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${t} ${p}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`),m(),u(4),l(`<< /Type /XObject /Subtype /Image /Width ${Math.round(o)} /Height ${Math.round(e)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${s.byteLength} >>
stream
`),b(s),l(`
endstream`),m();const N=`q
${t} 0 0 ${p} 0 0 cm
/Im0 Do
Q
`,E=_.encode(N);u(5),l(`<< /Length ${E.byteLength} >>
stream
`),b(E),l("endstream"),m();const O=T;l(`xref
0 6
0000000000 65535 f 
`);for(let a=1;a<=5;a++){const g=String(f[a]).padStart(10,"0");l(`${g} 00000 n 
`)}return l(`trailer
<< /Size 6 /Root 1 0 R >>
startxref
${O}
%%EOF`),new Blob(d,{type:"application/pdf"})}const H=`-- =========================================================================================
-- MIGRACIÓN 48: CAMPOS ADICIONALES PARA FICHA OFICIAL "CONOCE A TU SOCORRISTA" (CVSSOCC/FORM001)
-- =========================================================================================

ALTER TABLE public.socorristas
  ADD COLUMN IF NOT EXISTS nit TEXT,
  ADD COLUMN IF NOT EXISTS estado_civil TEXT,
  ADD COLUMN IF NOT EXISTS nombre_conyuge TEXT,
  ADD COLUMN IF NOT EXISTS nombre_dependientes TEXT,
  ADD COLUMN IF NOT EXISTS dependientes_detalle JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS nacionalidad TEXT,
  ADD COLUMN IF NOT EXISTS profesion_ocupacion TEXT,
  ADD COLUMN IF NOT EXISTS fecha_inicio_relacion_laboral TEXT,
  ADD COLUMN IF NOT EXISTS direccion_domicilio TEXT,
  ADD COLUMN IF NOT EXISTS cargo_publico_ultimos_5_anios BOOLEAN,
  ADD COLUMN IF NOT EXISTS cargo_publico_periodo TEXT,
  ADD COLUMN IF NOT EXISTS cargo_publico_posicion TEXT,
  ADD COLUMN IF NOT EXISTS ficha_kyc_completada BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ficha_kyc_actualizada_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_socorristas_ficha_kyc_completada
  ON public.socorristas (ficha_kyc_completada);

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.socorristas TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.socorristas TO authenticated;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';`,q=`-- =========================================================================================
-- MIGRACIÓN 49: DEPENDIENTES CON PARENTESCO (CVSSOCC/FORM001) Y ESTABILIDAD DE SCHEMA CACHE
-- =========================================================================================

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

ALTER TABLE public.socorristas
  ADD COLUMN IF NOT EXISTS nit TEXT,
  ADD COLUMN IF NOT EXISTS estado_civil TEXT,
  ADD COLUMN IF NOT EXISTS nombre_conyuge TEXT,
  ADD COLUMN IF NOT EXISTS nombre_dependientes TEXT,
  ADD COLUMN IF NOT EXISTS dependientes_detalle JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS nacionalidad TEXT,
  ADD COLUMN IF NOT EXISTS profesion_ocupacion TEXT,
  ADD COLUMN IF NOT EXISTS fecha_inicio_relacion_laboral TEXT,
  ADD COLUMN IF NOT EXISTS direccion_domicilio TEXT,
  ADD COLUMN IF NOT EXISTS cargo_publico_ultimos_5_anios BOOLEAN,
  ADD COLUMN IF NOT EXISTS cargo_publico_periodo TEXT,
  ADD COLUMN IF NOT EXISTS cargo_publico_posicion TEXT,
  ADD COLUMN IF NOT EXISTS ficha_kyc_completada BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ficha_kyc_actualizada_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_socorristas_ficha_kyc_completada
  ON public.socorristas (ficha_kyc_completada);

GRANT SELECT ON TABLE public.socorristas TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.socorristas TO authenticated;
GRANT SELECT ON TABLE public.seccionales TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';`;export{P as E,v as P,H as S,U as a,X as b,k as c,R as d,L as e,h as f,q as g,C as i,G as j,y as p,j as s,$ as v};
