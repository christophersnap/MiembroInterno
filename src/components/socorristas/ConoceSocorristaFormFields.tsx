import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import DateInput from '../DateInput';
import {
  ConoceSocorristaExtraData,
  DependienteItem,
  ESTADOS_CIVILES_OPTIONS,
  PARENTESCOS_DEPENDIENTES_OPTIONS,
  formatDependientesDetalleToText,
  formatNitOrDuiInput,
  isNoDependentsText,
} from '../../utils/conoceSocorrista';

interface ConoceSocorristaFormFieldsProps {
  value: ConoceSocorristaExtraData;
  onChange: (next: ConoceSocorristaExtraData) => void;
  dui?: string;
  direccionBase?: string;
  fechaIngresoBase?: string;
  compact?: boolean;
  disabled?: boolean;
}

export default function ConoceSocorristaFormFields({
  value,
  onChange,
  dui = '',
  direccionBase = '',
  fechaIngresoBase = '',
  disabled = false,
}: ConoceSocorristaFormFieldsProps) {
  const cleanDui = dui.trim();
  const canCopyDui = Boolean(cleanDui && cleanDui.toLowerCase() !== 'menor de edad');

  const updateField = <K extends keyof ConoceSocorristaExtraData>(
    field: K,
    fieldValue: ConoceSocorristaExtraData[K]
  ) => {
    onChange({
      ...value,
      [field]: fieldValue,
    });
  };

  // Determinar si el usuario eligió "Con dependientes" o "Sin dependientes"
  const hasDependientesList =
    Array.isArray(value.dependientes_detalle) && value.dependientes_detalle.length > 0;
  const sinDependientesSelected =
    !hasDependientesList && isNoDependentsText(value.nombre_dependientes);

  const handleToggleTieneDependientes = (tiene: boolean) => {
    if (disabled) return;
    if (!tiene) {
      onChange({
        ...value,
        dependientes_detalle: [],
        nombre_dependientes: 'Ninguno / No aplica',
      });
    } else {
      const nextList: DependienteItem[] =
        value.dependientes_detalle && value.dependientes_detalle.length > 0
          ? value.dependientes_detalle
          : [{ parentesco: 'Hijo(a)', nombre: '' }];
      onChange({
        ...value,
        dependientes_detalle: nextList,
        nombre_dependientes: formatDependientesDetalleToText(nextList),
      });
    }
  };

  const handleUpdateDependiente = (index: number, patch: Partial<DependienteItem>) => {
    const current = Array.isArray(value.dependientes_detalle) ? [...value.dependientes_detalle] : [];
    current[index] = {
      ...current[index],
      ...patch,
    };
    onChange({
      ...value,
      dependientes_detalle: current,
      nombre_dependientes: formatDependientesDetalleToText(current),
    });
  };

  const handleAddDependiente = () => {
    if (disabled) return;
    const current = Array.isArray(value.dependientes_detalle) ? [...value.dependientes_detalle] : [];
    const nextList = [...current, { parentesco: 'Hijo(a)', nombre: '' }];
    onChange({
      ...value,
      dependientes_detalle: nextList,
      nombre_dependientes: formatDependientesDetalleToText(nextList),
    });
  };

  const handleRemoveDependiente = (index: number) => {
    if (disabled) return;
    const current = Array.isArray(value.dependientes_detalle) ? [...value.dependientes_detalle] : [];
    const nextList = current.filter((_, idx) => idx !== index);
    if (nextList.length === 0) {
      onChange({
        ...value,
        dependientes_detalle: [],
        nombre_dependientes: 'Ninguno / No aplica',
      });
    } else {
      onChange({
        ...value,
        dependientes_detalle: nextList,
        nombre_dependientes: formatDependientesDetalleToText(nextList),
      });
    }
  };

  const conyugeNoAplica = value.nombre_conyuge.trim().toLowerCase() === 'no aplica';

  return (
    <div className="space-y-6">
      {/* GRUPO 1: IDENTIFICACIÓN Y ESTADO CIVIL */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-slate-500">
            Identificación y estado civil
          </span>
          <span className="text-xs text-slate-400">NIT opcional</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
          {/* Fila NIT */}
          <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="sm:w-44 shrink-0">
              <label className="text-sm font-medium text-slate-800 block">
                NIT <span className="text-slate-400 font-normal text-xs">(Opcional)</span>
              </label>
            </div>
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text"
                disabled={disabled}
                value={value.nit}
                onChange={(e) => updateField('nit', formatNitOrDuiInput(e.target.value))}
                placeholder={canCopyDui ? `${cleanDui} o vacío` : 'Dejar vacío o ingresar NIT'}
                maxLength={17}
                className="w-full bg-slate-50/70 focus:bg-white rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-60"
              />
              {canCopyDui && !disabled && value.nit !== cleanDui && (
                <button
                  type="button"
                  onClick={() => updateField('nit', cleanDui)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Usar DUI
                </button>
              )}
            </div>
          </div>

          {/* Fila Estado Civil */}
          <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="text-sm font-medium text-slate-800 sm:w-44 shrink-0">
              Estado civil <span className="text-rose-500">*</span>
            </label>
            <div className="flex-1">
              <select
                disabled={disabled}
                value={value.estado_civil}
                onChange={(e) => {
                  const nextEstado = e.target.value;
                  const nextPatch: Partial<ConoceSocorristaExtraData> = {
                    estado_civil: nextEstado,
                  };
                  if (
                    (nextEstado === 'Soltero(a)' ||
                      nextEstado === 'Divorciado(a)' ||
                      nextEstado === 'Viudo(a)') &&
                    !value.nombre_conyuge.trim()
                  ) {
                    nextPatch.nombre_conyuge = 'No aplica';
                  } else if (
                    (nextEstado === 'Casado(a)' ||
                      nextEstado === 'Acompañado(a) / Unión no matrimonial') &&
                    value.nombre_conyuge.trim().toLowerCase() === 'no aplica'
                  ) {
                    nextPatch.nombre_conyuge = '';
                  }
                  onChange({ ...value, ...nextPatch });
                }}
                className="w-full bg-slate-50/70 focus:bg-white rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-60"
              >
                <option value="">Seleccionar...</option>
                {ESTADOS_CIVILES_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Fila Nacionalidad */}
          <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="text-sm font-medium text-slate-800 sm:w-44 shrink-0">
              Nacionalidad <span className="text-rose-500">*</span>
            </label>
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text"
                disabled={disabled}
                value={value.nacionalidad}
                onChange={(e) => updateField('nacionalidad', e.target.value)}
                placeholder="Salvadoreña"
                className="w-full bg-slate-50/70 focus:bg-white rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-60"
              />
              {!disabled && value.nacionalidad !== 'Salvadoreña' && (
                <button
                  type="button"
                  onClick={() => updateField('nacionalidad', 'Salvadoreña')}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Salvadoreña
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* GRUPO 2: NÚCLEO FAMILIAR Y DEPENDIENTES */}
      <div className="space-y-2">
        <div className="px-1">
          <span className="text-xs font-semibold text-slate-500">
            Cónyuge y dependientes económicos
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
          {/* Cónyuge */}
          <div className="px-4 py-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium text-slate-800">
                Cónyuge <span className="text-rose-500">*</span>
              </label>
              <div className="inline-flex p-0.5 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => updateField('nombre_conyuge', 'No aplica')}
                  className={`px-3 py-1 rounded-[10px] text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    conyugeNoAplica
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  No aplica
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (conyugeNoAplica) updateField('nombre_conyuge', '');
                  }}
                  className={`px-3 py-1 rounded-[10px] text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    !conyugeNoAplica && value.nombre_conyuge !== ''
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : !conyugeNoAplica
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Ingresar nombre
                </button>
              </div>
            </div>

            {!conyugeNoAplica && (
              <input
                type="text"
                disabled={disabled}
                value={value.nombre_conyuge}
                onChange={(e) => updateField('nombre_conyuge', e.target.value)}
                placeholder="Nombre completo del cónyuge o compañero(a) de vida"
                className="w-full bg-slate-50/70 focus:bg-white rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-60"
              />
            )}
          </div>

          {/* Dependientes con Parentesco + Nombre */}
          <div className="px-4 py-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <label className="text-sm font-medium text-slate-800 block">
                  Dependientes <span className="text-rose-500">*</span>
                </label>
                <span className="text-xs text-slate-400">
                  Indica parentesco y nombre completo de cada dependiente
                </span>
              </div>

              <div className="inline-flex p-0.5 bg-slate-100 rounded-xl shrink-0">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleToggleTieneDependientes(false)}
                  className={`px-3 py-1 rounded-[10px] text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    sinDependientesSelected
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Sin dependientes
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleToggleTieneDependientes(true)}
                  className={`px-3 py-1 rounded-[10px] text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    hasDependientesList
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Agregar ({value.dependientes_detalle?.length || 0})
                </button>
              </div>
            </div>

            {hasDependientesList && (
              <div className="space-y-2.5 pt-1">
                {value.dependientes_detalle.map((dep, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-50/80 p-2 rounded-xl"
                  >
                    <select
                      disabled={disabled}
                      aria-label={`Parentesco dependiente ${idx + 1}`}
                      value={dep.parentesco || 'Hijo(a)'}
                      onChange={(e) =>
                        handleUpdateDependiente(idx, { parentesco: e.target.value })
                      }
                      className="sm:w-44 bg-white rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-500 shrink-0"
                    >
                      {PARENTESCOS_DEPENDIENTES_OPTIONS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      disabled={disabled}
                      value={dep.nombre}
                      onChange={(e) => handleUpdateDependiente(idx, { nombre: e.target.value })}
                      placeholder="Nombre completo del dependiente"
                      className="flex-1 bg-white rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                    />

                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => handleRemoveDependiente(idx)}
                        title="Quitar dependiente"
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors self-end sm:self-center cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}

                {!disabled && (
                  <button
                    type="button"
                    onClick={handleAddDependiente}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar otro dependiente
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* GRUPO 3: ACTIVIDAD LABORAL Y DOMICILIO */}
      <div className="space-y-2">
        <div className="px-1">
          <span className="text-xs font-semibold text-slate-500">
            Ocupación y dirección de residencia
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
          {/* Profesión u ocupación */}
          <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="text-sm font-medium text-slate-800 sm:w-44 shrink-0">
              Profesión u ocupación <span className="text-rose-500">*</span>
            </label>
            <div className="flex-1">
              <input
                type="text"
                disabled={disabled}
                value={value.profesion_ocupacion}
                onChange={(e) => updateField('profesion_ocupacion', e.target.value)}
                placeholder="Ej. Estudiante, Enfermero(a), Técnico, Empleado..."
                className="w-full bg-slate-50/70 focus:bg-white rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-60"
              />
            </div>
          </div>

          {/* Fecha de inicio laboral */}
          <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="text-sm font-medium text-slate-800 sm:w-44 shrink-0">
              Inicio laboral / ingreso <span className="text-rose-500">*</span>
            </label>
            <div className="flex-1 flex flex-wrap items-center gap-2">
              <div className="w-44">
                <DateInput
                  disabled={disabled}
                  value={value.fecha_inicio_relacion_laboral}
                  onChange={(val) => updateField('fecha_inicio_relacion_laboral', val)}
                  className="w-full bg-slate-50/70 focus:bg-white rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>
              {fechaIngresoBase &&
                !disabled &&
                value.fecha_inicio_relacion_laboral !== fechaIngresoBase && (
                  <button
                    type="button"
                    onClick={() => updateField('fecha_inicio_relacion_laboral', fechaIngresoBase)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Usar ingreso ({fechaIngresoBase})
                  </button>
                )}
            </div>
          </div>

          {/* Dirección de domicilio */}
          <div className="px-4 py-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium text-slate-800">
                Dirección de domicilio <span className="text-rose-500">*</span>
              </label>
              {direccionBase.trim() &&
                !disabled &&
                value.direccion_domicilio.trim() !== direccionBase.trim() && (
                  <button
                    type="button"
                    onClick={() => updateField('direccion_domicilio', direccionBase.trim())}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Copiar dirección principal
                  </button>
                )}
            </div>
            <textarea
              rows={2}
              disabled={disabled}
              value={value.direccion_domicilio}
              onChange={(e) => updateField('direccion_domicilio', e.target.value)}
              placeholder="Colonia, calle o pasaje, número de casa, municipio y departamento"
              className="w-full bg-slate-50/70 focus:bg-white rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-60"
            />
          </div>
        </div>
      </div>

      {/* GRUPO 4: DECLARACIÓN DE CARGO PÚBLICO (PEP / UIF) */}
      <div className="space-y-2">
        <div className="px-1">
          <span className="text-xs font-semibold text-slate-500">
            Declaración normativa UIF
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
          <div className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="pr-2">
              <span className="text-sm font-medium text-slate-800 block">
                ¿Ha ejercido cargo público o político en los últimos 5 años?{' '}
                <span className="text-rose-500">*</span>
              </span>
            </div>

            <div className="inline-flex p-0.5 bg-slate-100 rounded-xl shrink-0 self-start sm:self-center">
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  onChange({
                    ...value,
                    cargo_publico_ultimos_5_anios: false,
                    cargo_publico_periodo: 'No aplica',
                    cargo_publico_posicion: 'No aplica',
                  })
                }
                className={`px-4 py-1.5 rounded-[10px] text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  value.cargo_publico_ultimos_5_anios === false
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                No
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  onChange({
                    ...value,
                    cargo_publico_ultimos_5_anios: true,
                    cargo_publico_periodo:
                      value.cargo_publico_periodo === 'No aplica' ? '' : value.cargo_publico_periodo,
                    cargo_publico_posicion:
                      value.cargo_publico_posicion === 'No aplica'
                        ? ''
                        : value.cargo_publico_posicion,
                  })
                }
                className={`px-4 py-1.5 rounded-[10px] text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  value.cargo_publico_ultimos_5_anios === true
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Sí
              </button>
            </div>
          </div>

          {value.cargo_publico_ultimos_5_anios === true && (
            <div className="px-4 py-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/40">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Periodo de tiempo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  disabled={disabled}
                  value={
                    value.cargo_publico_periodo === 'No aplica' ? '' : value.cargo_publico_periodo
                  }
                  onChange={(e) => updateField('cargo_publico_periodo', e.target.value)}
                  placeholder="Ej. 2021 - 2024"
                  className="w-full bg-white rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Posición o cargo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  disabled={disabled}
                  value={
                    value.cargo_publico_posicion === 'No aplica' ? '' : value.cargo_publico_posicion
                  }
                  onChange={(e) => updateField('cargo_publico_posicion', e.target.value)}
                  placeholder="Ej. Concejal Municipal"
                  className="w-full bg-white rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
