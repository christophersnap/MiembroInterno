import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Camera,
  Loader2,
  Send,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import SmartStorageImage from './SmartStorageImage';

export interface CarnetConfirmItem {
  id: number;
  nombre: string;
  carnet?: string | null;
  dui?: string | null;
  fotoUrl?: string | null;
}

interface CarnetSubmitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmFinal: () => void | Promise<void>;
  loading?: boolean;
  isBatch: boolean;
  items: CarnetConfirmItem[];
}

export default function CarnetSubmitConfirmModal({
  isOpen,
  onClose,
  onConfirmFinal,
  loading = false,
  isBatch,
  items,
}: CarnetSubmitConfirmModalProps) {
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="carnet-confirm-title"
    >
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                step === 1
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {step === 1 ? (
                <UserCheck className="w-5 h-5" />
              ) : (
                <Camera className="w-5 h-5" />
              )}
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Confirmación previa · Paso {step} de 2
              </p>
              <h3 id="carnet-confirm-title" className="text-base font-extrabold text-slate-900">
                {step === 1
                  ? 'Verificación de Información, Nombre y DUI'
                  : 'Condición de Fotografía Oficial'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Cerrar confirmación"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-2 gap-2">
            <div
              className={`h-1.5 rounded-full transition-colors ${
                step >= 1 ? 'bg-emerald-600' : 'bg-slate-200'
              }`}
            />
            <div
              className={`h-1.5 rounded-full transition-colors ${
                step === 2 ? 'bg-amber-500' : 'bg-slate-200'
              }`}
            />
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {step === 1 ? (
            <>
              <div className="rounded-2xl bg-emerald-50/80 border border-emerald-200 p-4 space-y-1.5">
                <p className="text-sm font-bold text-emerald-950 leading-snug">
                  {isBatch
                    ? `¿Das por revisada la información, nombre completo y número de DUI de cada uno de los ${items.length} elementos seleccionados?`
                    : '¿Das por revisada la información, nombre completo y número de DUI del elemento para esta solicitud?'}
                </p>
                <p className="text-xs text-emerald-800">
                  Verifica cuidadosamente cómo aparecerán impresos los datos antes de continuar. Si detectas algún error en nombre o DUI, cancela y corrígelo antes de enviar.
                </p>
              </div>

              <div className="max-h-64 overflow-y-auto pr-1 space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80"
                  >
                    <div className="w-11 h-11 rounded-full overflow-hidden bg-white border border-slate-200 shrink-0 flex items-center justify-center">
                      <SmartStorageImage
                        src={item.fotoUrl}
                        alt={item.nombre}
                        className="w-full h-full object-cover"
                        fallback={<ShieldCheck className="w-5 h-5 text-slate-400" />}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-extrabold text-slate-900 truncate">
                        {item.nombre}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-600">
                        <span>
                          <strong className="text-slate-700">Carnet:</strong>{' '}
                          <span className="font-mono">{item.carnet || 'Sin carnet'}</span>
                        </span>
                        <span>
                          <strong className="text-slate-700">DUI:</strong>{' '}
                          <span className="font-mono font-semibold text-slate-900">
                            {item.dui && item.dui.trim() !== ''
                              ? item.dui
                              : 'Menor de edad / No registrado'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="rounded-2xl bg-amber-50 border border-amber-300 p-4 flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <p className="text-sm font-extrabold text-amber-950 leading-snug">
                    {isBatch
                      ? '¿Aceptas que si alguna fotografía de este lote no cumple con los requisitos oficiales, ese carnet no podrá realizarse?'
                      : '¿Aceptas que si la fotografía adjunta o registrada no cumple con los requisitos oficiales, el carnet no podrá realizarse?'}
                  </p>
                  <p className="text-xs text-amber-900 leading-relaxed">
                    Toda fotografía que tenga fondo con objetos o sombras, vestimenta no formal, gorra, lentes oscuros, sonrisa o poca nitidez será rechazada u observada por el área de emisión hasta corregirse.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 flex items-center gap-3 text-xs text-slate-700">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  Paso 1 confirmado: Información, nombre completo y DUI revisados para{' '}
                  <strong>
                    {items.length} {items.length === 1 ? 'elemento' : 'elementos'}
                  </strong>
                  .
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50/90 border-t border-slate-200/80 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5">
          {step === 1 ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2.5 rounded-2xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancelar y Revisar Datos
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Sí, he revisado información, nombre y DUI
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={loading}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Volver atrás
              </button>
              <button
                type="button"
                onClick={() => onConfirmFinal()}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-primary hover:bg-primary-hover text-white text-xs font-extrabold shadow-sm transition-colors disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {loading
                  ? 'Enviando solicitud...'
                  : isBatch
                    ? `Sí, acepto y Enviar Lote (${items.length})`
                    : 'Sí, acepto y Enviar Solicitud'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
