import React from 'react';
import { Clock, X, ArrowRight, Building2, FileText } from 'lucide-react';
import { SolicitudQuotaResult, TipoSolicitudLimite } from '../../utils/solicitudLimite';
import { formatFechaSV } from '../../utils/dateUtils';

interface SolicitudEnProcesoModalProps {
  open: boolean;
  tipo: TipoSolicitudLimite;
  seccionalNombre: string;
  quota: SolicitudQuotaResult;
  canViewHistorial?: boolean;
  onGoToHistorial?: () => void;
  onClose: () => void;
}

export default function SolicitudEnProcesoModal({
  open,
  tipo,
  seccionalNombre,
  quota,
  canViewHistorial = false,
  onGoToHistorial,
  onClose,
}: SolicitudEnProcesoModalProps) {
  if (!open) return null;

  const tipoLabel = tipo === 'combustible' ? 'combustible' : 'compra';
  const isSingleRule = quota.extraAllowed === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#F2F2F7] rounded-[28px] border border-slate-200/80 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header estilo iOS */}
        <div className="bg-white px-5 pt-5 pb-4 border-b border-slate-200/70 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/12 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Solicitud en proceso
              </h3>
              <p className="text-xs text-slate-500 truncate">
                Solicitud de {tipoLabel} · {seccionalNombre || 'Seccional'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar aviso"
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo con tarjetas agrupadas estilo iOS */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-2 shadow-2xs">
            <p className="text-sm font-semibold text-slate-900 leading-snug">
              {isSingleRule
                ? 'Tiene una solicitud en proceso.'
                : `Ha alcanzado el límite de ${quota.maxAllowed} solicitudes en proceso.`}
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              {isSingleRule
                ? `La seccional ${seccionalNombre || 'asignada'} ya cuenta con una solicitud de ${tipoLabel} activa. Podrá realizar otra hasta que finalice la solicitud anterior.`
                : `La seccional ${seccionalNombre || 'asignada'} tiene actualmente ${quota.activeCount} solicitudes de ${tipoLabel} en proceso (cupo máximo permitido: ${quota.maxAllowed}). Podrá realizar otra hasta que finalice alguna solicitud anterior.`}
            </p>
          </div>

          {/* Resumen de estado */}
          <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden shadow-2xs">
            <div className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                Seccional
              </span>
              <span className="font-semibold text-slate-900 truncate max-w-[60%]">
                {seccionalNombre || 'Asignada'}
              </span>
            </div>
            <div className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                En proceso
              </span>
              <span className="font-semibold text-amber-700 tabular-nums">
                {quota.activeCount} de {quota.maxAllowed ?? 1}
              </span>
            </div>
          </div>

          {/* Lista de folios activos */}
          {quota.activeItems.length > 0 && (
            <div className="space-y-1.5">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {quota.activeItems.length === 1 ? 'Solicitud activa' : 'Solicitudes activas'}
              </p>
              <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden shadow-2xs">
                {quota.activeItems.slice(0, 5).map((item) => (
                  <div
                    key={`${item.id}-${item.folio}`}
                    className="px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 font-mono truncate">
                        {item.folio}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {item.solicitante}
                        {item.fecha ? ` · ${formatFechaSV(item.fecha)}` : ''}
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 rounded-lg whitespace-nowrap shrink-0">
                      {item.estado}
                    </span>
                  </div>
                ))}
                {quota.activeItems.length > 5 && (
                  <div className="px-4 py-2 text-[11px] text-slate-500 text-center bg-slate-50/70">
                    +{quota.activeItems.length - 5} solicitudes adicionales en proceso
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer de acciones estilo iOS */}
        <div className="bg-white px-5 py-3.5 border-t border-slate-200/70 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
          {canViewHistorial && onGoToHistorial && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onGoToHistorial();
              }}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Ver historial</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
