import React, { useState } from 'react';
import { HelpCircle, Send, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import { SolicitudCombustible } from '../../types/combustible';

interface CombustibleFormProps {
  seccionales: { id: number; nombre: string; director?: string; correo?: string }[];
  isAdmin: boolean;
  userSeccionalNombre: string | null;
  defaultDirector: string;
  defaultEmail: string;
  defaultSolicitante: string;
  submitting: boolean;
  onSubmit: (formData: Omit<SolicitudCombustible, 'id' | 'folio' | 'estado' | 'created_at'>) => Promise<void>;
}

export default function CombustibleForm({
  seccionales,
  isAdmin,
  userSeccionalNombre,
  defaultDirector,
  defaultEmail,
  defaultSolicitante,
  submitting,
  onSubmit
}: CombustibleFormProps) {
  const [seccionalId, setSeccionalId] = useState<string>(() => {
    if (userSeccionalNombre) {
      const match = seccionales.find(s => s.nombre.toLowerCase() === userSeccionalNombre.toLowerCase());
      if (match) return String(match.id);
    }
    return seccionales[0] ? String(seccionales[0].id) : '';
  });

  const selectedSec = seccionales.find(s => String(s.id) === seccionalId) || seccionales[0];

  const getDirectorDisplay = () => {
    if (selectedSec) {
      if (selectedSec.director && selectedSec.director !== 'N/A') {
        return `(${selectedSec.nombre.toUpperCase()}) - ${selectedSec.director}`;
      }
      return `(${selectedSec.nombre.toUpperCase()}) - ${defaultDirector || 'Director Asignado'}`;
    }
    return defaultDirector || 'Director Seccional';
  };

  const getCorreoSeccional = () => {
    if (selectedSec?.correo) return selectedSec.correo;
    if (selectedSec?.nombre) {
      const cleanName = selectedSec.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
      return `${cleanName}@cruzverdesv.org`;
    }
    return defaultEmail || 'control_combustible@cruzverdesv.org';
  };

  const [actividad, setActividad] = useState('Emergencias cotidianas');
  const [entregoLiquidacion, setEntregoLiquidacion] = useState<'Si' | 'No'>('Si');
  const [motivoNoLiquidacion, setMotivoNoLiquidacion] = useState('');
  const [nombreSolicitante, setNombreSolicitante] = useState(defaultSolicitante || '');
  const [telefonoSolicitante, setTelefonoSolicitante] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // Tooltips interactivos
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!seccionalId && seccionales.length > 0) {
      alert('Por favor seleccione una seccional.');
      return;
    }
    if (!nombreSolicitante.trim()) {
      alert('Por favor ingrese el nombre del solicitante.');
      return;
    }
    if (!telefonoSolicitante.trim()) {
      alert('Por favor ingrese el teléfono del solicitante.');
      return;
    }
    if (entregoLiquidacion === 'No' && !motivoNoLiquidacion.trim()) {
      alert('Por favor indique el motivo por el cual no ha entregado la liquidación de combustible del mes anterior.');
      return;
    }

    const payload = {
      seccional_id: selectedSec ? selectedSec.id : undefined,
      seccional_nombre: selectedSec ? selectedSec.nombre : (userSeccionalNombre || 'Seccional'),
      director_nombre: getDirectorDisplay(),
      correo_electronico: getCorreoSeccional(),
      actividad: actividad.trim(),
      entrego_liquidacion_anterior: entregoLiquidacion === 'Si',
      motivo_no_liquidacion: entregoLiquidacion === 'No' ? motivoNoLiquidacion.trim() : '',
      nombre_solicitante: nombreSolicitante.trim(),
      telefono_solicitante: telefonoSolicitante.trim(),
      observaciones: observaciones.trim()
    };

    await onSubmit(payload);
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Tarjeta del Formulario idéntica a la Imagen 1 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        
        {/* Cabecera del Formulario */}
        <div className="pt-8 pb-4 px-6 md:px-12 text-center border-b border-gray-100 bg-linear-to-b from-gray-50/70 to-white">
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
            Solicitud de Combustible
          </h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1.5">
            Cruz Verde Salvadoreña • Control y Asignación de Dotación
          </p>
          {userSeccionalNombre && !isAdmin && (
            <div className="mt-3 inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              Seccional {userSeccionalNombre} vinculada automáticamente
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 md:p-12 space-y-7">

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

            {isAdmin ? (
              <select
                value={seccionalId}
                onChange={(e) => setSeccionalId(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition shadow-2xs outline-none"
              >
                {seccionales.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.nombre}
                  </option>
                ))}
              </select>
            ) : (
              <div className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-800">
                {selectedSec ? selectedSec.nombre : (userSeccionalNombre || 'Seccional asignada')}
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
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-medium cursor-not-allowed outline-none select-none"
            />
            <p className="text-2xs text-gray-500 mt-1">Dirección oficial de la seccional configurada para recibir acuse y copia.</p>
          </div>

          {/* Campo 4: Actividad * */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1.5">
              Actividad <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={actividad}
              onChange={(e) => setActividad(e.target.value)}
              placeholder="Emergencias cotidianas"
              className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition shadow-2xs outline-none"
            />
          </div>

          {/* Campo 5: ¿A entregado la liquidación de combustible del mes anterior? * */}
          <div className="space-y-3 pt-1">
            <label className="block text-sm font-semibold text-gray-800">
              ¿A entregado la liquidación de combustible del mes anterior? <span className="text-red-500">*</span>
            </label>
            
            <div className="space-y-2">
              <label className="flex items-center space-x-3 cursor-pointer select-none">
                <input
                  type="radio"
                  name="entrego_liquidacion"
                  value="Si"
                  checked={entregoLiquidacion === 'Si'}
                  onChange={() => setEntregoLiquidacion('Si')}
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300"
                />
                <span className="text-sm font-medium text-gray-800">Sí</span>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer select-none">
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

          {/* Campo 6: Motivo del por que aun no ha entregado liquidación de combustible * */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1.5">
              Motivo del por que aun no ha entregado liquidación de combustible {entregoLiquidacion === 'No' && <span className="text-red-500">*</span>}
            </label>
            <textarea
              rows={3}
              required={entregoLiquidacion === 'No'}
              value={motivoNoLiquidacion}
              onChange={(e) => setMotivoNoLiquidacion(e.target.value)}
              placeholder={entregoLiquidacion === 'No' ? 'Especifique el motivo detallado...' : 'No aplica (ya fue entregada)'}
              className={`w-full px-4 py-2.5 rounded-lg text-sm transition shadow-2xs outline-none ${
                entregoLiquidacion === 'No'
                  ? 'bg-amber-50/50 border border-amber-300 focus:ring-2 focus:ring-amber-500 text-gray-900'
                  : 'bg-white border border-gray-300 focus:ring-2 focus:ring-emerald-500 text-gray-900'
              }`}
            />
            {entregoLiquidacion === 'No' && (
              <p className="text-xs text-amber-700 flex items-center mt-1">
                <AlertCircle className="w-3.5 h-3.5 mr-1" />
                Campo obligatorio al haber seleccionado "No".
              </p>
            )}
          </div>

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
              placeholder="Nombre y Apellidos completos"
              className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition shadow-2xs outline-none"
            />
          </div>

          {/* Campo 8: Ingresa el teléfono del solicitante * */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1.5">
              Ingresa el teléfono del solicitante <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              required
              value={telefonoSolicitante}
              onChange={(e) => setTelefonoSolicitante(e.target.value)}
              placeholder="7742-8734"
              className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition shadow-2xs outline-none"
            />
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
              placeholder="Notas para el Área Administrativa..."
              className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition shadow-2xs outline-none"
            />
          </div>

          {/* Botón Verde Centrado "Enviar" idéntico a la Imagen 1 */}
          <div className="pt-4 flex justify-center">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center px-10 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-base shadow-sm hover:shadow-md transition-all disabled:opacity-50 cursor-pointer"
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
