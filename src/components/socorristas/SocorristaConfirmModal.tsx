import React, { useEffect, useState } from 'react';
import { ShieldCheck, IdCard, UserCheck, AlertTriangle, X, Loader2, CheckCircle2 } from 'lucide-react';

interface SocorristaConfirmModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  loading?: boolean;
  primerNombre: string;
  segundoNombre?: string;
  primerApellido: string;
  segundoApellido?: string;
  dui: string;
  seccionalNombre?: string;
  cargoInstitucional?: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function SocorristaConfirmModal({
  isOpen,
  mode,
  loading = false,
  primerNombre,
  segundoNombre = '',
  primerApellido,
  segundoApellido = '',
  dui,
  seccionalNombre = '',
  cargoInstitucional = '',
  onClose,
  onConfirm,
}: SocorristaConfirmModalProps) {
  const [checkedDuiMatch, setCheckedDuiMatch] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCheckedDuiMatch(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const fullName = [primerNombre, segundoNombre, primerApellido, segundoApellido]
    .map((p) => (p || '').trim().toUpperCase())
    .filter(Boolean)
    .join(' ');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                {mode === 'create'
                  ? 'Verificación de Seguridad antes de Registrar'
                  : 'Verificación de Seguridad antes de Actualizar'}
              </h3>
              <p className="text-xs text-slate-500">
                Confirma que los datos coinciden exactamente con el DUI o Documento de Identidad
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-950 space-y-1">
              <p className="font-bold">Revisa cuidadosamente antes de guardar</p>
              <p className="text-amber-900 leading-relaxed">
                Los <strong>Nombres, Apellidos</strong> y el número de <strong>DUI / Carnet de Minoridad</strong> deben ingresarse <strong>tal cual aparecen escritos en el documento oficial</strong>, sin abreviaturas ni errores ortográficos, ya que se usarán en carnets, expedientes y certificados.
              </p>
            </div>
          </div>

          {/* Summary Card */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 divide-y divide-slate-200/80 overflow-hidden">
            <div className="p-4 bg-white">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Nombre Completo Registrado
              </span>
              <p className="text-base font-extrabold text-slate-900 mt-0.5 tracking-wide">
                {fullName || 'SIN NOMBRE'}
              </p>
            </div>

            <div className="grid grid-cols-2 divide-x divide-slate-200/80 text-xs">
              <div className="p-3.5">
                <span className="text-[11px] font-semibold text-slate-500 block">Nombres</span>
                <p className="font-bold text-slate-900 mt-0.5 uppercase">
                  {[primerNombre, segundoNombre].filter(Boolean).join(' ') || '—'}
                </p>
              </div>
              <div className="p-3.5">
                <span className="text-[11px] font-semibold text-slate-500 block">Apellidos</span>
                <p className="font-bold text-slate-900 mt-0.5 uppercase">
                  {[primerApellido, segundoApellido].filter(Boolean).join(' ') || '—'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80 text-xs">
              <div className="p-3.5 flex items-center gap-2.5">
                <IdCard className="w-4 h-4 text-emerald-700 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold text-slate-500 block">
                    DUI / Doc. Identidad
                  </span>
                  <p className="font-mono font-bold text-slate-900 text-sm">
                    {(dui || '').trim() || 'No especificado'}
                  </p>
                </div>
              </div>
              <div className="p-3.5 flex items-center gap-2.5">
                <UserCheck className="w-4 h-4 text-slate-500 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold text-slate-500 block">
                    Seccional y Cargo
                  </span>
                  <p className="font-semibold text-slate-800 truncate">
                    {seccionalNombre || 'Seccional'} · {cargoInstitucional || 'Socorrista'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Security Question Checkbox */}
          <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/50 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={checkedDuiMatch}
              onChange={(e) => setCheckedDuiMatch(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-emerald-400 text-emerald-700 focus:ring-emerald-600"
            />
            <span className="text-xs font-semibold text-slate-800 leading-relaxed">
              ¿Los datos del elemento están correctos? Confirmo que los <strong>Nombres, Apellidos y DUI / Documento de Identidad</strong> mostrados arriba son exactos y coinciden con el documento físico.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200/80 flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer disabled:opacity-50"
          >
            Volver a Revisar
          </button>
          <button
            type="button"
            disabled={!checkedDuiMatch || loading}
            onClick={onConfirm}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs disabled:opacity-45 cursor-pointer transition-all"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            {loading
              ? 'Guardando...'
              : mode === 'create'
              ? 'Sí, Datos Correctos — Registrar Elemento'
              : 'Sí, Datos Correctos — Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
