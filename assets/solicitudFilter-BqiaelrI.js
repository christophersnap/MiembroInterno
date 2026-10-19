import{c as h}from"./index-BES8vKJf.js";/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _=[["path",{d:"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2",key:"143wyd"}],["path",{d:"M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6",key:"1itne7"}],["rect",{x:"6",y:"14",width:"12",height:"8",rx:"1",key:"1ue0tg"}]],p=h("printer",_);function y(e,r,m){if(!r&&!m)return!1;const t=((r==null?void 0:r.email)||"").toLowerCase().trim(),a=(m||"").toLowerCase().trim(),f=((e==null?void 0:e.correo_electronico)||(e==null?void 0:e.user_email)||"").toLowerCase().trim(),n=((e==null?void 0:e.nombre_solicitante)||(e==null?void 0:e.solicitante)||(e==null?void 0:e.user_nombre)||"").toLowerCase().trim();return!!(t&&f&&t===f||a&&n&&(a.includes(n)||n.includes(a))||e!=null&&e.user_id&&(r!=null&&r.id)&&String(e.user_id)===String(r.id))}export{p as P,y as i};
