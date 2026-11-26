import React, { useState } from 'react';
import { HelpCircle, Send, CheckCircle2, AlertCircle, Lock, Fuel } from 'lucide-react';
import {
  SolicitudCombustible,
  CombustibleConfig,
  DEFAULT_COMBUSTIBLE_CONFIG,
  ACTIVIDADES_COMBUSTIBLE_OPTIONS,
} from '../../types/combustible';
import { getElSalvadorDateString } from '../../utils/dateUtils';

interface CombustibleFormProps {
  seccionales: { id: number; nombre: string; director?: string; correo?: string }[];
  isAdmin: boolean;
  canSelectAnySeccional?: boolean;
  userSeccionalId?: number | null;
  userSeccionalNombre: string | null;
  defaultDirector: string;
  defaultEmail: string;
  defaultSolicitante: string;
  config?: CombustibleConfig;
  submitting: boolean;
  blockedByActive?: boolean;
  blockedNotice?: React.ReactNode;
  onSeccionalChange?: (seccional: { id: number | null; nombre: string }) => void;
  onSubmit: (formData: Omit<SolicitudCombustible, 'id' | 'folio' | 'estado' | 'created_at'>) => Promise<void>;
}

/**
 * Formatea un número telefónico de El Salvador con máscara estricta 0000-0000.
 */
function formatPhoneMaskSV(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

export default function CombustibleForm({
  seccionales,
  isAdmin,
  canSelectAnySeccional,
  userSeccionalId,
  userSeccionalNombre,
  defaultDirector,
  defaultEmail,
  defaultSolicitante,
  config = DEFAULT_COMBUSTIBLE_CONFIG,
  submitting,
  blockedByActive = false,
  blockedNotice,
  onSeccionalChange,
  onSubmit
}: CombustibleFormProps) {
  const allowSelectSeccional = canSelectAnySeccional ?? isAdmin;
  const [seccionalId, setSeccionalId] = useState<string>('');
  const lastEmittedSecRef = React.useRef<string>('');

  // Sincronizar seccional asignada cuando cambian las seccionales o los permisos
  React.useEffect(() => {
    if (seccionales.length === 0) return;

    const matchById = userSeccionalId
      ? seccionales.find(s => Number(s.id) === Number(userSeccionalId))
      : null;
    const matchByName = userSeccionalNombre
      ? seccionales.find(s => s.nombre.toLowerCase().trim() === userSeccionalNombre.toLowerCase().trim())
      : null;
    const resolved = matchById || matchByName || null;

    if (!allowSelectSeccional) {
      const target = resolved || seccionales[0];
      if (target && String(seccionalId) !== String(target.id)) {
        setSeccionalId(String(target.id));
      }
    } else if (!seccionalId && resolved) {
      setSeccionalId(String(resolved.id));
    }
  }, [allowSelectSeccional, userSeccionalId, userSeccionalNombre, seccionales, seccionalId]);

  const selectedSec = seccionales.find(s =>
    String(s.id) === String(seccionalId) ||
    s.nombre.toLowerCase().trim() === seccionalId.toLowerCase().trim()
  ) || null;

  React.useEffect(() => {
    if (!onSeccionalChange) return;
    const resolvedId = selectedSec ? Number(selectedSec.id) : (!allowSelectSeccional && userSeccionalId ? Number(userSeccionalId) : null);
    const resolvedNombre = selectedSec ? selectedSec.nombre : (!allowSelectSeccional && userSeccionalNombre ? userSeccionalNombre : '');
    const key = `${resolvedId ?? ''}::${resolvedNombre}`;
    if (lastEmittedSecRef.current === key) return;
    lastEmittedSecRef.current = key;
    onSeccionalChange({ id: resolvedId, nombre: resolvedNombre });
  }, [selectedSec, allowSelectSeccional, userSeccionalId, userSeccionalNombre, onSeccionalChange]);

  const getDirectorDisplay = () => {
    if (selectedSec) {
      if (selectedSec.director && selectedSec.director !== 'N/A') {
        return `(${selectedSec.nombre.toUpperCase()}) - ${selectedSec.director}`;
      }
      return `(${selectedSec.nombre.toUpperCase()}) - ${defaultDirector || 'Director Asignado'}`;
    }
    if (userSeccionalNombre) {
      return `(${userSeccionalNombre.toUpperCase()}) - ${defaultDirector || 'Director Asignado'}`;
    }
    return '';
  };

  const getCorreoSeccional = () => {
    if (selectedSec) {
      if (selectedSec.correo) return selectedSec.correo;
      if (selectedSec.nombre) {
        const cleanName = selectedSec.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
        return `${cleanName}@cruzverdesv.org`;
      }
    }
    if (userSeccionalNombre) {
      const cleanName = userSeccionalNombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
      return `${cleanName}@cruzverdesv.org`;
    }
    return defaultEmail || 'control_combustible@cruzverdesv.org';
  };

  const [actividadSeleccionada, setActividadSeleccionada] = useState<string>('');
  const [actividadOtra, setActividadOtra] = useState('');
  const [entregoLiquidacion, setEntregoLiquidacion] = useState<'Si' | 'No'>('Si');
  const [motivoNoLiquidacion, setMotivoNoLiquidacion] = useState('');
  const [nombreSolicitante, setNombreSolicitante] = useState(defaultSolicitante || '');
  const [telefonoSolicitante, setTelefonoSolicitante] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // Campos opcionales gobernados por configuración de plantilla
  const [vehiculo, setVehiculo] = useState('');
  const [placa, setPlaca] = useState('');
  const [tipoGasolina, setTipoGasolina] = useState('');
  const [galones, setGalones] = useState('');
  const [cantidadDinero, setCantidadDinero] = useState('');

  const [validationError, setValidationError] = useState<string | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const hasOptionalFieldsEnabled =
    Boolean(config.solicitarVehiculo) ||
    Boolean(config.solicitarPlaca) ||
    Boolean(config.solicitarTipoGasolina) ||
    Boolean(config.solicitarGalones) ||
    Boolean(config.solicitarCantidadDinero);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    if (blockedByActive) return;

    let finalSec = selectedSec;
    if (!finalSec && seccionalId) {
      finalSec = seccionales.find(s =>
        String(s.id) === String(seccionalId) ||
        s.nombre.toLowerCase().trim() === seccionalId.toLowerCase().trim()
      ) || null;
    }
    if (!finalSec && userSeccionalNombre) {
      finalSec = seccionales.find(s => s.nombre.toLowerCase().trim() === userSeccionalNombre.toLowerCase().trim()) || null;
    }

    if (!finalSec && !seccionalId && !userSeccionalNombre && seccionales.length > 0) {
      setValidationError('Por favor seleccione una seccional.');
      return;
    }
    if (!actividadSeleccionada) {
      setValidationError('Por favor seleccione un tipo de actividad de la lista.');
      return;
    }
    if (actividadSeleccionada === 'Otros' && !actividadOtra.trim()) {
      setValidationError('Por favor especifique la actividad al seleccionar "Otros".');
      return;
    }
    if (entregoLiquidacion === 'No' && !motivoNoLiquidacion.trim()) {
      setValidationError('Por favor indique el motivo por el cual no ha entregado la liquidación de combustible del mes anterior.');
      return;
    }
    if (!nombreSolicitante.trim()) {
      setValidationError('Por favor ingrese el nombre del solicitante.');
      return;
    }
    if (!/^\d{4}-\d{4}$/.test(telefonoSolicitante.trim())) {
      setValidationError('Por favor ingrese un teléfono válido con formato 0000-0000 (8 dígitos).');
      return;
    }

    const resolvedNombre = finalSec ? finalSec.nombre : (userSeccionalNombre || 'Seccional');
    const resolvedId = finalSec ? finalSec.id : undefined;
    const actividadFinal =
      actividadSeleccionada === 'Otros'
        ? `Otros: ${actividadOtra.trim()}`
        : actividadSeleccionada;

    const payload: Omit<SolicitudCombustible, 'id' | 'folio' | 'estado' | 'created_at'> = {
      seccional_id: resolvedId,
      seccional_nombre: resolvedNombre,
      director_nombre: getDirectorDisplay(),
      correo_electronico: getCorreoSeccional(),
      actividad: actividadFinal,
      entrego_liquidacion_anterior: entregoLiquidacion === 'Si',
      motivo_no_liquidacion: entregoLiquidacion === 'No' ? motivoNoLiquidacion.trim() : '',
      nombre_solicitante: nombreSolicitante.trim(),
      telefono_solicitante: telefonoSolicitante.trim(),
      observaciones: observaciones.trim(),
      fecha_solicitud: getElSalvadorDateString(),
      ...(config.solicitarVehiculo && vehiculo.trim() ? { vehiculo_marca: vehiculo.trim() } : {}),
      ...(config.solicitarPlaca && placa.trim() ? { vehiculo_placa: placa.trim().toUpperCase() } : {}),
      ...(config.solicitarTipoGasolina && tipoGasolina.trim() ? { tipo_combustible: tipoGasolina.trim() } : {}),
      ...(config.solicitarGalones && galones.trim() ? { galones_solicitados: galones.trim() } : {}),
      ...(config.solicitarCantidadDinero && cantidadDinero.trim() ? { cantidad_dinero: Number(cantidadDinero) } : {}),
    };

    await onSubmit(payload);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

        {/* Cabecera del Formulario */}
        <div className="pt-8 pb-4 px-6 md:px-12 text-center border-b border-gray-100 bg-linear-to-b from-gray-50/70 to-white">
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
            Solicitud de Combustible
          </h1>
          <p className="text-xs md:text-sm font-semibold text-emerald-700 mt-1">
            {config.pdfSubtituloSecundario || 'Documento Oficial Administrativo'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Cruz Verde Salvadoreña • Control y Asignación de Dotación
          </p>
          {!allowSelectSeccional && (selectedSec || userSeccionalNombre) && (
            <div className="mt-3 inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              Seccional {selectedSec?.nombre || userSeccionalNombre} vinculada automáticamente
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 md:p-12 space-y-7">

          {blockedNotice}

          {validationError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Campo 1: Seccional * */}
          <div>
            <div className="flex items-center space-x-1.5 mb-1.5">
              <label className="text-sm font-semibold text-gray-800">
                Seccional <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setActiveTooltip(activeTooltip === 'seccional' ? null : 'seccional')}
                  onMouseEnter={() => setActiveTooltip('seccional')}
                  onMouseLeave={() => setActiveTooltip(null)}
                  className="text-gray-400 hover:text-gray-600 transition"
                  title="Información"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
                {activeTooltip === 'seccional' && (
                  <div className="absolute left-6 -top-2 z-20 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
                    Seccional a la que pertenece o se asigna la dotación de combustible.
                  </div>
                )}
              </div>
            </div>

            {allowSelectSeccional ? (
              <select
                value={seccionalId}
                onChange={(e) => setSeccionalId(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition shadow-2xs outline-none cursor-pointer"
              >
                <option value="">-- Seleccione una Seccional --</option>
                {seccionales.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.nombre}
                  </option>
                ))}
              </select>
            ) : (
              <div className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-800 flex items-center justify-between gap-2 cursor-not-allowed select-none">
                <span>{selectedSec ? selectedSec.nombre : (userSeccionalNombre || 'Seccional asignada')}</span>
                <span className="inline-flex items-center text-3xs font-semibold text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full shrink-0">
                  <Lock className="w-2.5 h-2.5 mr-1 text-gray-400" />
                  Asignada • No modificable
                </span>
              </div>
            )}
          </div>

          {/* Campo 2: Director(a) - Solo Lectura */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center space-x-1.5">
                <label className="text-sm font-semibold text-gray-800">
                  Director(a) de la Seccional <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActiveTooltip(activeTooltip === 'director' ? null : 'director')}
                    onMouseEnter={() => setActiveTooltip('director')}
                    onMouseLeave={() => setActiveTooltip(null)}
                    className="text-gray-400 hover:text-gray-600 transition"
                    title="Información"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                  {activeTooltip === 'director' && (
                    <div className="absolute left-6 -top-2 z-20 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
                      Nombre del Director(a) a cargo de la Seccional asignada. Se obtiene de forma automática y no es modificable.
                    </div>
                  )}
                </div>
              </div>

              <span className="inline-flex items-center text-3xs font-semibold text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                <Lock className="w-2.5 h-2.5 mr-1 text-gray-400" />
                Solo lectura • Automático
              </span>
            </div>
            <input
              type="text"
              readOnly
              value={getDirectorDisplay()}
              placeholder="Seleccione una seccional para cargar automáticamente el Director..."
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-medium cursor-not-allowed outline-none select-none"
            />
            <p className="text-2xs text-gray-500 mt-1">Asignado de forma automática según la seccional seleccionada.</p>
          </div>

          {/* Campo 3: Correo Electronico de la Seccional - Solo Lectura */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center space-x-1.5">
                <label className="text-sm font-semibold text-gray-800">
                  Correo Electrónico de la Seccional <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActiveTooltip(activeTooltip === 'correo' ? null : 'correo')}
                    onMouseEnter={() => setActiveTooltip('correo')}
                    onMouseLeave={() => setActiveTooltip(null)}
                    className="text-gray-400 hover:text-gray-600 transition"
                    title="Información"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                  {activeTooltip === 'correo' && (
                    <div className="absolute left-6 -top-2 z-20 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
                      Correo institucional asignado a la Seccional. Se obtiene automáticamente y no puede ser modificado manualmente.
                    </div>
                  )}
                </div>
              </div>

              <span className="inline-flex items-center text-3xs font-semibold text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                <Lock className="w-2.5 h-2.5 mr-1 text-gray-400" />
                Solo lectura • Asignado
              </span>
            </div>
            <input
              type="email"
              readOnly
              value={getCorreoSeccional()}
              placeholder="Seleccione una seccional para cargar automáticamente el correo..."
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-medium cursor-not-allowed outline-none select-none"
            />
            <p className="text-2xs text-gray-500 mt-1">Dirección oficial de la seccional configurada para recibir acuse y copia.</p>
          </div>

          {/* Campo 4: Actividad (Lista de selección única) * */}
          <div className="space-y-2.5">
            <label className="block text-sm font-semibold text-gray-800">
              Actividad <span className="text-red-500">*</span>
            </label>
            <p className="text-2xs text-gray-500 -mt-1">
              Seleccione una única opción correspondiente al tipo de actividad.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ACTIVIDADES_COMBUSTIBLE_OPTIONS.map((option) => {
                const isSelected = actividadSeleccionada === option;
                return (
                  <label
                    key={option}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition cursor-pointer select-none ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-500 text-emerald-950'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/70 text-gray-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="actividad_combustible"
                      value={option}
                      checked={isSelected}
                      onChange={() => {
                        setActividadSeleccionada(option);
                        if (option !== 'Otros') setActividadOtra('');
                        setValidationError(null);
                      }}
                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 shrink-0"
                    />
                    <span className="text-sm font-medium">{option}</span>
                  </label>
                );
              })}
            </div>

            {actividadSeleccionada === 'Otros' && (
              <div className="pt-2">
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Especifique <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={actividadOtra}
                  onChange={(e) => setActividadOtra(e.target.value)}
                  placeholder="Describa la actividad o eventualidad..."
                  className="w-full px-4 py-2.5 bg-white border border-emerald-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition shadow-2xs outline-none"
                />
              </div>
            )}
          </div>

          {/* Campo 5: ¿Ha entregado la liquidación de combustible del mes anterior? * */}
          <div className="space-y-3 pt-1">
            <label className="block text-sm font-semibold text-gray-800">
              ¿Ha entregado la liquidación de combustible del mes anterior? <span className="text-red-500">*</span>
            </label>

            <div className="flex items-center gap-6">
              <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                <input
                  type="radio"
                  name="entrego_liquidacion"
                  value="Si"
                  checked={entregoLiquidacion === 'Si'}
                  onChange={() => {
                    setEntregoLiquidacion('Si');
                    setMotivoNoLiquidacion('');
                  }}
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300"
                />
                <span className="text-sm font-medium text-gray-800">Sí</span>
              </label>

              <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                <input
                  type="radio"
                  name="entrego_liquidacion"
                  value="No"
                  checked={entregoLiquidacion === 'No'}
                  onChange={() => setEntregoLiquidacion('No')}
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300"
                />
                <span className="text-sm font-medium text-gray-800">No</span>
              </label>
            </div>
          </div>

          {/* Campo 6: Solo se muestra si seleccionó "No" en liquidación */}
          {entregoLiquidacion === 'No' && (
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                Motivo del por qué aún no ha entregado liquidación de combustible <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={motivoNoLiquidacion}
                onChange={(e) => setMotivoNoLiquidacion(e.target.value)}
                placeholder="Ej: Factura o comprobante pendiente de entrega por la gasolinera..."
                className="w-full px-4 py-2.5 rounded-lg text-sm transition shadow-2xs outline-none bg-amber-50/50 border border-amber-300 focus:ring-2 focus:ring-amber-500 text-gray-900"
              />
              <p className="text-xs text-amber-700 flex items-center mt-1">
                <AlertCircle className="w-3.5 h-3.5 mr-1" />
                Campo obligatorio al haber seleccionado &quot;No&quot;.
              </p>
            </div>
          )}

          {/* Campos Opcionales de Vehículo / Combustible (solo si están activos en Plantilla) */}
          {hasOptionalFieldsEnabled && (
            <div className="p-4 md:p-5 rounded-xl bg-gray-50/80 border border-gray-200 space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-200 pb-2.5">
                <Fuel className="w-4 h-4 text-emerald-700" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                  Información de Unidad y Dotación
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {config.solicitarVehiculo && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-800 mb-1">
                      Vehículo / Unidad <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={vehiculo}
                      onChange={(e) => setVehiculo(e.target.value)}
                      placeholder="Ej: Ambulancia Unidad 04 / Pick-up Toyota"
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                )}

                {config.solicitarPlaca && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-800 mb-1">
                      Placa <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={placa}
                      onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                      placeholder="Ej: P-123-456"
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-mono text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none uppercase"
                    />
                  </div>
                )}

                {config.solicitarTipoGasolina && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-800 mb-1">
                      Tipo de Gasolina <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={tipoGasolina}
                      onChange={(e) => setTipoGasolina(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="">-- Seleccione tipo --</option>
                      <option value="Gasolina Regular">Gasolina Regular</option>
                      <option value="Gasolina Especial">Gasolina Especial</option>
                      <option value="Diésel">Diésel</option>
                    </select>
                  </div>
                )}

                {config.solicitarGalones && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-800 mb-1">
                      Galones Solicitados <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.1"
                      required
                      value={galones}
                      onChange={(e) => setGalones(e.target.value)}
                      placeholder="Ej: 15"
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                )}

                {config.solicitarCantidadDinero && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-800 mb-1">
                      Cantidad de Dinero (USD $) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      value={cantidadDinero}
                      onChange={(e) => setCantidadDinero(e.target.value)}
                      placeholder="Ej: 50.00"
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Campo 7: Nombre del Solicitante * */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1.5">
              Nombre del Solicitante <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={nombreSolicitante}
              onChange={(e) => setNombreSolicitante(e.target.value)}
              placeholder="Nombre y apellido del socorrista o motorista"
              className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition shadow-2xs outline-none"
            />
          </div>

          {/* Campo 8: Ingresa el teléfono del solicitante (Máscara 0000-0000) * */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1.5">
              Ingresa el teléfono del solicitante <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              inputMode="numeric"
              required
              maxLength={9}
              pattern="\d{4}-\d{4}"
              value={telefonoSolicitante}
              onChange={(e) => setTelefonoSolicitante(formatPhoneMaskSV(e.target.value))}
              placeholder="0000-0000"
              className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-mono tracking-wider text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition shadow-2xs outline-none"
            />
            <p className="text-2xs text-gray-500 mt-1">Formato requerido: 0000-0000 (8 dígitos).</p>
          </div>

          {/* Observaciones adicionales (Opcional) */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1.5">
              Observaciones adicionales <span className="text-gray-400 font-normal">(Opcional)</span>
            </label>
            <textarea
              rows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Detalles u observaciones adicionales de la solicitud (opcional)..."
              className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition shadow-2xs outline-none"
            />
          </div>

          {/* Botón Enviar */}
          <div className="pt-4 flex justify-center">
            <button
              type="submit"
              disabled={submitting || blockedByActive}
              className="inline-flex items-center justify-center px-10 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-base shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Enviando solicitud...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
