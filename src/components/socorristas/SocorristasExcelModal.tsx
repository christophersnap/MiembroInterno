import React, { useState } from 'react';
import { X, Check, Download } from 'lucide-react';

export type ExcelExportPreset =
  | 'filtro_actual'
  | 'todos'
  | 'activos'
  | 'inactivos'
  | 'con_carnet'
  | 'sin_carnet'
  | 'con_foto'
  | 'sin_foto'
  | 'motoristas'
  | 'ficha_completa'
  | 'ficha_pendiente';

interface SocorristasExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  counts: Record<ExcelExportPreset, number>;
  activeFilterSummary: string;
  exporting: boolean;
  onConfirmExport: (preset: ExcelExportPreset, includeExtendedFields: boolean) => void;
}

export default function SocorristasExcelModal({
  isOpen,
  onClose,
  counts,
  activeFilterSummary,
  exporting,
  onConfirmExport,
}: SocorristasExcelModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<ExcelExportPreset>('filtro_actual');
  const [includeExtendedFields, setIncludeExtendedFields] = useState<boolean>(true);

  if (!isOpen) return null;

  const groups: {
    heading: string;
    items: { id: ExcelExportPreset; label: string; hint?: string }[];
  }[] = [
    {
      heading: 'Vista general',
      items: [
        {
          id: 'filtro_actual',
          label: 'Según filtro inteligente actual',
          hint: activeFilterSummary,
        },
        { id: 'todos', label: 'Todos los elementos' },
      ],
    },
    {
      heading: 'Estado y carnet',
      items: [
        { id: 'activos', label: 'Solo activos' },
        { id: 'inactivos', label: 'Solo inactivos' },
        { id: 'con_carnet', label: 'Con carnet generado' },
        { id: 'sin_carnet', label: 'Sin carnet generado' },
      ],
    },
    {
      heading: 'Expediente y funciones',
      items: [
        { id: 'con_foto', label: 'Con fotografía' },
        { id: 'sin_foto', label: 'Sin fotografía' },
        { id: 'motoristas', label: 'Motoristas autorizados' },
        { id: 'ficha_completa', label: 'Ficha Conoce a tu Socorrista completa' },
        { id: 'ficha_pendiente', label: 'Ficha Conoce a tu Socorrista pendiente' },
      ],
    },
  ];

  const selectedCount = counts[selectedPreset] || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 backdrop-blur-sm p-4">
      <div className="w-full max-w-md max-h-[88vh] bg-[#F2F2F7] rounded-3xl shadow-2xl border border-white/60 flex flex-col overflow-hidden">
        {/* Header limpio estilo iOS */}
        <div className="shrink-0 bg-white/95 backdrop-blur px-6 py-4 border-b border-slate-200/80 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Descargar Excel</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Lista agrupada estilo iOS con scroll suave */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4 custom-scrollbar">
          {groups.map((group) => (
            <div key={group.heading} className="space-y-1.5">
              <span className="px-1 text-xs font-semibold text-slate-500 block">
                {group.heading}
              </span>
              <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
                {group.items.map((item) => {
                  const isSelected = selectedPreset === item.id;
                  const count = counts[item.id] || 0;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedPreset(item.id)}
                      className={`w-full px-4 py-3 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                        isSelected ? 'bg-emerald-50/60' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="min-w-0">
                        <span
                          className={`text-sm block truncate ${
                            isSelected ? 'font-semibold text-emerald-950' : 'font-medium text-slate-800'
                          }`}
                        >
                          {item.label}
                        </span>
                        {item.hint && (
                          <span className="text-xs text-slate-400 block truncate mt-0.5">
                            {item.hint}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span
                          className={`text-xs font-mono tabular-nums ${
                            isSelected ? 'font-bold text-emerald-700' : 'text-slate-400'
                          }`}
                        >
                          {count}
                        </span>
                        <div className="w-5 h-5 flex items-center justify-center">
                          {isSelected && <Check className="w-4 h-4 text-emerald-600 stroke-[2.5]" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Switch estilo iOS para columnas ampliadas */}
          <div className="bg-white rounded-2xl border border-slate-200/80 px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-slate-800">
              Incluir expediente completo
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={includeExtendedFields}
              onClick={() => setIncludeExtendedFields((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${
                includeExtendedFields ? 'bg-emerald-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow-xs transition-transform mt-0.5 ${
                  includeExtendedFields ? 'translate-x-5.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer fijo */}
        <div className="shrink-0 bg-white px-5 py-3.5 border-t border-slate-200/80 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors whitespace-nowrap cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={exporting || selectedCount === 0}
            onClick={() => onConfirmExport(selectedPreset, includeExtendedFields)}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs transition-colors disabled:opacity-40 whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="tabular-nums">
              {exporting ? 'Descargando...' : `Descargar (${selectedCount})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
