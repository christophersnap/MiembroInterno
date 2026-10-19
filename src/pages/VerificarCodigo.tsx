import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Search, QrCode, ArrowRight } from 'lucide-react';

export default function VerificarCodigo() {
  const [codigo, setCodigo] = useState('');
  const navigate = useNavigate();

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = codigo.trim();
    if (!clean) return;
    navigate(`/v/${encodeURIComponent(clean)}`);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100">
        <div className="bg-emerald-700 p-8 text-center text-white relative">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mx-auto mb-4 border border-white/30 shadow-inner">
            <ShieldCheck className="w-9 h-9 text-emerald-200" />
          </div>
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-800 text-emerald-100 mb-2">
            Cruz Verde Salvadoreña
          </span>
          <h1 className="text-2xl font-black tracking-tight">Verificación de Credenciales</h1>
          <p className="text-xs text-emerald-100 mt-1">
            Valida la autenticidad del personal socorrista oficial
          </p>
        </div>

        <form onSubmit={handleVerify} className="p-8 space-y-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Ingresa el Código de Verificación o Token del QR
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Ej. 004d10fe8cb7603f o escanea el QR"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition"
              />
              <QrCode className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
            <p className="text-2xs text-slate-500 mt-2 leading-relaxed">
              Para máxima seguridad, los carnets físicos cuentan con un código QR que genera un enlace temporal con token de seguridad.
            </p>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-sm rounded-xl shadow-md transition cursor-pointer"
          >
            <span>Consultar Credencial</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="pt-4 border-t border-slate-100 text-center">
            <p className="text-2xs text-slate-400">
              Sistema Oficial de Identificación Institucional • Cruz Verde Salvadoreña
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
