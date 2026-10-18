import React, { useState, useMemo, useRef } from 'react';
import { 
  HelpCircle, Send, CheckCircle2, Lock, Truck, DollarSign, AlertCircle,
  FileText, MapPin, UserCheck, Wrench, ShieldCheck, Upload, Paperclip,
  Image as ImageIcon, Trash2, ZoomIn, X, ExternalLink, FileSpreadsheet, Eye
} from 'lucide-react';

export interface ArchivoCotizacion {
  nombre: string;
  tipo: string;
  tamano: number;
  url: string;
}

interface CompraFormProps {
  seccionales: { id: number; nombre: string; director?: string; correo?: string }[];
  vehiculos: { id: number; placa: string; marca: string; modelo: string; carroceria?: string; seccional_id?: number }[];
  isAdmin: boolean;
  userSeccionalNombre: string | null;
  userSeccionalId: number | null;
  submitting: boolean;
  onSubmit: (data: {
    seccional_id?: number;
    seccional_nombre: string;
    solicitado_por: string;
    cargo: string;
    tipo_solicitud: string;
    es_para_vehiculo: boolean;
    vehiculo_id?: number | null;
    vehiculo_placa?: string | null;
    vehiculo_descripcion?: string | null;
    descripcion: string;
    monto_estimado?: number | null;
    proveedor_sugerido?: string | null;
    prioridad: 'Normal' | 'Urgente' | 'Emergencia';
    cotizaciones_archivos?: ArchivoCotizacion[];
  }) => Promise<void>;
}

export const TIPOS_SOLICITUD_COMPRA = [
  'Repuestos Vehiculares y Ambulancias',
  'Mantenimiento Mecánico (Preventivo / Correctivo)',
  'Insumos y Equipamiento Médico',
  'Materiales de Rescate y Operativos',
  'Mantenimiento de Instalaciones Seccionales',
  'Equipos de Comunicación y Radios',
  'Papelería y Suministros de Oficina',
  'Servicios Generales y Otros Requerimientos'
];

export default function CompraForm({
  seccionales,
  vehiculos,
  isAdmin,
  userSeccionalNombre,
  userSeccionalId,
  submitting,
  onSubmit
}: CompraFormProps) {
  // Seccional seleccionada
  const [seccionalId, setSeccionalId] = useState<string>(() => {
    if (userSeccionalId) {
      const match = seccionales.find(s => s.id === userSeccionalId);
      if (match) return String(match.id);
    }
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
      return `(${selectedSec.nombre.toUpperCase()}) - Director Asignado`;
    }
    return 'Director Seccional';
  };

  const getDirectorNombrePuro = () => {
    if (selectedSec?.director && selectedSec.director !== 'N/A') {
      return selectedSec.director;
    }
    return 'Director Seccional';
  };

  // Campos principales del formulario
  const [nombreMotorista, setNombreMotorista] = useState('');
  const [cargoSolicitante, setCargoSolicitante] = useState('Motorista');
  const [tipoSolicitud, setTipoSolicitud] = useState(TIPOS_SOLICITUD_COMPRA[0]);
  const [esParaVehiculo, setEsParaVehiculo] = useState<boolean>(true);
  const [vehiculoId, setVehiculoId] = useState<string>('');
  const [descripcion, setDescripcion] = useState('');
  const [montoEstimado, setMontoEstimado] = useState('');
  const [proveedorSugerido, setProveedorSugerido] = useState('');
  const [prioridad, setPrioridad] = useState<'Normal' | 'Urgente' | 'Emergencia'>('Normal');

  // Archivos y fotos de cotizaciones
  const [cotizacionesArchivos, setCotizacionesArchivos] = useState<ArchivoCotizacion[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewModalFile, setPreviewModalFile] = useState<ArchivoCotizacion | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tooltips interactivos
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Vehículos filtrados por la seccional elegida
  const vehiculosDeSeccional = useMemo(() => {
    if (!selectedSec) return [];
    return vehiculos.filter(v => v.seccional_id === selectedSec.id);
  }, [vehiculos, selectedSec]);

  // Manejar cambio de tipo de solicitud
  const handleTipoChange = (val: string) => {
    setTipoSolicitud(val);
    const esVeh = val.toLowerCase().includes('vehicular') || 
                  val.toLowerCase().includes('ambulancia') || 
                  val.toLowerCase().includes('mecánico') ||
                  val.toLowerCase().includes('repuesto');
    setEsParaVehiculo(esVeh);
  };

  // Manejar selección de archivos (imágenes o PDF)
  const handleFilesSelected = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setUploadingFiles(true);
    const newFiles: ArchivoCotizacion[] = [];
    let processed = 0;

    fileArray.forEach(file => {
      const isValidType = file.type.startsWith('image/') || file.type === 'application/pdf';
      if (!isValidType) {
        alert(`El archivo "${file.name}" no es compatible. Suba fotos (JPG, PNG) o documentos en formato PDF.`);
        processed++;
        if (processed === fileArray.length) setUploadingFiles(false);
        return;
      }

      if (file.size > 12 * 1024 * 1024) {
        alert(`El archivo "${file.name}" supera el tamaño máximo permitido de 12 MB.`);
        processed++;
        if (processed === fileArray.length) setUploadingFiles(false);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        newFiles.push({
          nombre: file.name,
          tipo: file.type,
          tamano: file.size,
          url
        });
        processed++;
        if (processed === fileArray.length) {
          setCotizacionesArchivos(prev => [...prev, ...newFiles]);
          setUploadingFiles(false);
        }
      };
      reader.onerror = () => {
        processed++;
        if (processed === fileArray.length) setUploadingFiles(false);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveFile = (index: number) => {
    setCotizacionesArchivos(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!seccionalId && seccionales.length > 0) {
      alert('Por favor seleccione una seccional.');
      return;
    }

    if (!descripcion.trim()) {
      alert('Por favor detalle la descripción o repuestos necesarios a adquirir.');
      return;
    }

    const vehiculoSeleccionado = vehiculos.find(v => String(v.id) === vehiculoId);

    const payload = {
      seccional_id: selectedSec ? selectedSec.id : undefined,
      seccional_nombre: selectedSec ? selectedSec.nombre : (userSeccionalNombre || 'Seccional'),
      solicitado_por: nombreMotorista.trim() || getDirectorNombrePuro(),
      cargo: cargoSolicitante.trim() || 'Motorista',
      tipo_solicitud: tipoSolicitud,
      es_para_vehiculo: esParaVehiculo,
      vehiculo_id: (esParaVehiculo && vehiculoSeleccionado) ? vehiculoSeleccionado.id : null,
      vehiculo_placa: (esParaVehiculo && vehiculoSeleccionado) ? vehiculoSeleccionado.placa : null,
      vehiculo_descripcion: (esParaVehiculo && vehiculoSeleccionado)
        ? `${vehiculoSeleccionado.marca} ${vehiculoSeleccionado.modelo} (${vehiculoSeleccionado.carroceria || 'Unidad'})`
        : null,
      descripcion: descripcion.trim(),
      monto_estimado: montoEstimado ? parseFloat(montoEstimado) : null,
      proveedor_sugerido: proveedorSugerido.trim() || null,
      prioridad,
      cotizaciones_archivos: cotizacionesArchivos
    };

    await onSubmit(payload);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* CUADRO INSTITUCIONAL DE NOTA OBLIGATORIA (BASADO EN DIRECTRICES OFICIALES) */}
      <div className="bg-amber-50/90 border-2 border-amber-300/90 rounded-2xl p-5 md:p-6 text-gray-900 shadow-sm space-y-4">
        <div className="flex items-start space-x-3">
          <div className="p-2.5 bg-amber-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
            <FileText className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base md:text-lg font-black text-amber-950 tracking-tight">
                Instrucciones Oficiales para la Solicitud y Recepción de Compra
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-3xs font-extrabold uppercase bg-amber-200 text-amber-900 border border-amber-300">
                Lectura Previa Obligatoria
              </span>
            </div>
            <p className="text-xs text-amber-900/90 mt-1">
              Asegúrese de cumplir con los lineamientos administrativos antes de registrar la solicitud y emitir la hoja física de recepción:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
          
          {/* Criterio 1: Lugar y Fecha */}
          <div className="bg-white/95 border border-amber-200 rounded-xl p-3.5 space-y-2 shadow-2xs">
            <div className="flex items-center space-x-2 text-amber-900 font-bold border-b border-amber-100 pb-1.5">
              <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="uppercase tracking-wider text-2xs">1. Lugar y Fecha Institucional</span>
            </div>
            <div className="text-gray-700 space-y-1.5 pl-1 leading-relaxed">
              <p>
                • <strong>Lugar oficial de emisión:</strong> Todas las hojas de recepción llevarán invariablemente <span className="bg-amber-100/80 px-1 py-0.5 rounded font-bold text-amber-950">SAN SALVADOR</span> como sede central, sin importar la seccional de procedencia.
              </p>
              <p>
                • <strong>Fecha de emisión:</strong> Debe registrarse con exactamente <span className="font-bold text-amber-950">05 días hábiles posteriores</span> a la fecha del cheque o comprobante (voucher).
              </p>
            </div>
          </div>

          {/* Criterio 2: Solicitado por y Cargo */}
          <div className="bg-white/95 border border-amber-200 rounded-xl p-3.5 space-y-2 shadow-2xs">
            <div className="flex items-center space-x-2 text-amber-900 font-bold border-b border-amber-100 pb-1.5">
              <UserCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="uppercase tracking-wider text-2xs">2. Datos del Solicitante</span>
            </div>
            <div className="text-gray-700 space-y-1.5 pl-1 leading-relaxed">
              <p>
                • <strong>Solicitado por:</strong> Colocar el nombre completo del <strong className="text-gray-900">Motorista</strong> asignado a la unidad operativa.
              </p>
              <p>
                • <strong>Cargo:</strong> Consignar formalmente <span className="font-bold text-gray-900">"Motorista"</span>.
              </p>
              <p>
                • <strong>Seccional o Dependencia:</strong> Seleccionar la seccional a la que pertenece el equipo.
              </p>
            </div>
          </div>

          {/* Criterio 3: Descripción del Servicio o Repuestos */}
          <div className="bg-white/95 border border-amber-200 rounded-xl p-3.5 space-y-2 shadow-2xs">
            <div className="flex items-center space-x-2 text-amber-900 font-bold border-b border-amber-100 pb-1.5">
              <Wrench className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="uppercase tracking-wider text-2xs">3. Descripción del Requerimiento</span>
            </div>
            <div className="text-gray-700 space-y-1.5 pl-1 leading-relaxed">
              <p>
                • Redactar según la nomenclatura oficial para equipos: <br />
                <span className="font-mono text-2xs bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-bold inline-block mt-0.5">REPUESTOS PARA EQ [N°]</span> ó <span className="font-mono text-2xs bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-bold inline-block mt-0.5">MANTENIMIENTO PARA EQ [N°]</span>
              </p>
              <p>
                • <strong className="text-amber-900">Nota para múltiples repuestos:</strong> Si son varios ítems, colocar solo la palabra <strong className="text-gray-900">"REPUESTOS"</strong> e indicar obligatoriamente el número de equipo de la unidad de su seccional.
              </p>
            </div>
          </div>

          {/* Criterio 4: Firma y Sello Oficial */}
          <div className="bg-white/95 border border-amber-200 rounded-xl p-3.5 space-y-2 shadow-2xs">
            <div className="flex items-center space-x-2 text-amber-900 font-bold border-b border-amber-100 pb-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="uppercase tracking-wider text-2xs">4. Formalización y Firmas</span>
            </div>
            <div className="text-gray-700 space-y-1.5 pl-1 leading-relaxed">
              <p>
                • Al imprimir la hoja oficial final, es requisito indispensable que lleve la <strong>firma del motorista</strong> y el <strong>sello oficial de la seccional</strong>.
              </p>
              <p>
                • El Director(a) Seccional avala el requerimiento para su visto bueno central.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Tarjeta del Formulario Principal */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        
        {/* Cabecera del Formulario */}
        <div className="pt-8 pb-4 px-6 md:px-12 text-center border-b border-gray-100 bg-linear-to-b from-gray-50/70 to-white">
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
            Solicitud de Compra y Mantenimiento
          </h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1.5">
            Cruz Verde Salvadoreña • Control y Adquisición de Bienes y Repuestos
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
                Seccional o Dependencia <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setActiveTooltip(activeTooltip === 'seccional' ? null : 'seccional')}
                  onMouseEnter={() => setActiveTooltip('seccional')}
                  onMouseLeave={() => setActiveTooltip(null)}
                  className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
                  title="Información"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
                {activeTooltip === 'seccional' && (
                  <div className="absolute left-6 -top-2 z-20 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
                    Seccional que emite el requerimiento de compra o servicio.
                  </div>
                )}
              </div>
            </div>

            {isAdmin ? (
              <select
                value={seccionalId}
                onChange={(e) => {
                  setSeccionalId(e.target.value);
                  setVehiculoId('');
                }}
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

          {/* Campo 2: Solicitante (Motorista) y Aval Director */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* 2.1 Nombre del Motorista */}
            <div>
              <div className="flex items-center space-x-1.5 mb-1.5">
                <label className="text-sm font-semibold text-gray-800">
                  Solicitado por (Nombre del Motorista) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActiveTooltip(activeTooltip === 'motorista' ? null : 'motorista')}
                    onMouseEnter={() => setActiveTooltip('motorista')}
                    onMouseLeave={() => setActiveTooltip(null)}
                    className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
                    title="Información"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                  {activeTooltip === 'motorista' && (
                    <div className="absolute left-6 -top-2 z-20 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
                      Nombre completo del motorista asignado a la unidad operativa.
                    </div>
                  )}
                </div>
              </div>

              <input
                type="text"
                required
                value={nombreMotorista}
                onChange={(e) => setNombreMotorista(e.target.value)}
                placeholder="Ej. Juan Carlos Ramos"
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition shadow-2xs outline-none font-medium"
              />
              <div className="flex items-center justify-between mt-1 text-2xs text-gray-500">
                <span>Cargo registrado:</span>
                <span className="font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                  {cargoSolicitante}
                </span>
              </div>
            </div>

            {/* 2.2 Director(a) que Avala la Seccional (Automático) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-semibold text-gray-800">
                  Director(a) Seccional (Aval) <span className="text-red-500">*</span>
                </label>
                <span className="inline-flex items-center text-3xs font-semibold text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                  <Lock className="w-2.5 h-2.5 mr-1 text-gray-400" />
                  Automático
                </span>
              </div>
              <input
                type="text"
                readOnly
                value={getDirectorDisplay()}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-medium cursor-not-allowed outline-none select-none"
              />
              <p className="text-2xs text-gray-500 mt-1">Avala institucionalmente según la seccional seleccionada.</p>
            </div>

          </div>

          {/* Campo 3: Tipo de Solicitud * */}
          <div>
            <div className="flex items-center space-x-1.5 mb-1.5">
              <label className="text-sm font-semibold text-gray-800">
                Tipo de Solicitud <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setActiveTooltip(activeTooltip === 'tipo' ? null : 'tipo')}
                  onMouseEnter={() => setActiveTooltip('tipo')}
                  onMouseLeave={() => setActiveTooltip(null)}
                  className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
                  title="Información"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
                {activeTooltip === 'tipo' && (
                  <div className="absolute left-6 -top-2 z-20 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
                    Rubro principal del bien, servicio o repuesto que se solicita.
                  </div>
                )}
              </div>
            </div>

            <select
              value={tipoSolicitud}
              onChange={(e) => handleTipoChange(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition shadow-2xs outline-none font-medium"
            >
              {TIPOS_SOLICITUD_COMPRA.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </div>

          {/* Campo 3.1: Unidad Vehicular (Opcional si aplica a ambulancia o vehículo) */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={esParaVehiculo}
                  onChange={(e) => setEsParaVehiculo(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded cursor-pointer"
                />
                <span className="text-sm font-semibold text-gray-800">
                  ¿Esta solicitud es para una ambulancia o vehículo de la seccional?
                </span>
              </label>
              <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
            </div>

            {esParaVehiculo && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Seleccionar Unidad Vehicular ({selectedSec?.nombre || 'Seccional'}):
                </label>
                {vehiculosDeSeccional.length === 0 ? (
                  <div className="p-2.5 bg-white border border-amber-200 rounded-lg text-xs text-amber-800">
                    No hay vehículos registrados para esta seccional en la flota. (Puede detallar las placas en la descripción).
                  </div>
                ) : (
                  <select
                    value={vehiculoId}
                    onChange={(e) => setVehiculoId(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                  >
                    <option value="">Seleccione una unidad vehicular...</option>
                    {vehiculosDeSeccional.map((veh) => (
                      <option key={veh.id} value={String(veh.id)}>
                        Placa {veh.placa} — {veh.marca} {veh.modelo} ({veh.carroceria || 'Vehículo'})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* Campo 4: Descripción del Requerimiento o Repuestos * */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-gray-800">
                Descripción del Requerimiento o Repuestos <span className="text-red-500">*</span>
              </label>
              <span className="text-2xs text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Ej: REPUESTOS PARA EQ [N°]
              </span>
            </div>
            <textarea
              rows={4}
              required
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ejemplo: REPUESTOS PARA EQ 231-911: 2 llantas 195R15 para ambulancia CVS-014, juego de pastillas de frenos delanteros y cambio de aceite..."
              className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition shadow-2xs outline-none leading-relaxed"
            />
            <p className="text-2xs text-gray-500 mt-1">
              📌 <strong>Criterio institucional:</strong> Si son varios repuestos, colocar la palabra <span className="font-bold text-gray-800">"REPUESTOS"</span> y el número de equipo de su seccional.
            </p>
          </div>

          {/* Campo 5 y 6: COSTO TOTAL Y ADJUNTAR FOTOS O DOCUMENTOS DE COTIZACIONES (A LA PAR) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
            
            {/* Columna Izquierda: Monto Estimado y Proveedor Sugerido */}
            <div className="space-y-4">
              
              {/* Monto Estimado / Costo Total */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-semibold text-gray-800">
                    Costo Total o Monto Estimado ($ USD)
                  </label>
                  <span className="text-3xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Costo Total
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={montoEstimado}
                    onChange={(e) => setMontoEstimado(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-base text-gray-900 font-bold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition shadow-2xs outline-none"
                  />
                </div>
                <p className="text-2xs text-gray-400 mt-1">Valor total de acuerdo a la cotización obtenida.</p>
              </div>

              {/* Proveedor o Taller Sugerido */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                  Proveedor o Taller Sugerido
                </label>
                <input
                  type="text"
                  value={proveedorSugerido}
                  onChange={(e) => setProveedorSugerido(e.target.value)}
                  placeholder="Ej. Taller Central / Repuestos Los Andes"
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition shadow-2xs outline-none"
                />
                <p className="text-2xs text-gray-400 mt-1">Nombre del taller, ferretería o comercio cotizado.</p>
              </div>

            </div>

            {/* Columna Derecha: SUBIR FOTOS O DOCUMENTOS DE LAS COTIZACIONES */}
            <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                <div className="flex items-center space-x-1.5">
                  <Paperclip className="w-4 h-4 text-emerald-600" />
                  <label className="text-sm font-bold text-gray-900">
                    Fotos o Documentos de Cotización
                  </label>
                </div>
                <span className="text-3xs font-extrabold text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                  {cotizacionesArchivos.length === 1 
                    ? '1 archivo' 
                    : `${cotizacionesArchivos.length} archivos`}
                </span>
              </div>

              {/* Zona de Carga / Drag & Drop */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files) {
                    handleFilesSelected(e.dataTransfer.files);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                  isDragging 
                    ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-400' 
                    : 'border-gray-300 hover:border-emerald-500 bg-white hover:bg-emerald-50/20'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      handleFilesSelected(e.target.files);
                      e.target.value = '';
                    }
                  }}
                />

                <div className="flex flex-col items-center justify-center space-y-1.5">
                  <div className="p-2 bg-emerald-100/80 text-emerald-700 rounded-full">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-700 hover:text-emerald-800">
                      Subir foto(s) o PDF de cotizaciones
                    </span>
                    <p className="text-3xs text-gray-500 mt-0.5">
                      Arrastra varias fotos o haz clic para examinar
                    </p>
                  </div>
                  <span className="text-3xs text-gray-400">
                    Formatos: JPG, PNG, WEBP o PDF (Hasta 12MB c/u)
                  </span>
                </div>
              </div>

              {/* Estado de carga */}
              {uploadingFiles && (
                <div className="flex items-center justify-center space-x-2 text-xs text-emerald-700 font-semibold py-1">
                  <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Procesando archivo(s)...</span>
                </div>
              )}

              {/* Listado y Miniaturas de Cotizaciones Adjuntas */}
              {cotizacionesArchivos.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {cotizacionesArchivos.map((file, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded-lg shadow-2xs group hover:border-emerald-300 transition-colors"
                      >
                        <div 
                          onClick={() => setPreviewModalFile(file)}
                          className="flex items-center space-x-2 min-w-0 cursor-pointer flex-1"
                        >
                          {file.tipo.startsWith('image/') ? (
                            <img 
                              src={file.url} 
                              alt={file.nombre} 
                              className="w-8 h-8 rounded object-cover border border-gray-200 shrink-0" 
                            />
                          ) : (
                            <div className="w-8 h-8 rounded bg-red-50 text-red-600 border border-red-200 flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                          )}
                          <div className="truncate text-left">
                            <p className="text-2xs font-semibold text-gray-800 truncate" title={file.nombre}>
                              {file.nombre}
                            </p>
                            <span className="text-3xs text-gray-400">
                              {formatFileSize(file.tamano)} • {file.tipo.startsWith('image/') ? 'Foto' : 'PDF'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1 shrink-0 ml-2">
                          <button
                            type="button"
                            onClick={() => setPreviewModalFile(file)}
                            className="p-1 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded transition cursor-pointer"
                            title="Ver en grande"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(idx)}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                            title="Quitar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-3xs text-gray-500 text-center">
                    Las fotos y documentos adjuntos se almacenarán junto al folio de la solicitud.
                  </p>
                </div>
              )}

            </div>

          </div>

          {/* Campo 7: Nivel de Prioridad * */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-800">
              Nivel de Prioridad <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label 
                className={`flex items-center p-3 rounded-xl border cursor-pointer transition select-none ${
                  prioridad === 'Normal' 
                    ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950 font-bold' 
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="prioridad"
                  value="Normal"
                  checked={prioridad === 'Normal'}
                  onChange={() => setPrioridad('Normal')}
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 mr-2.5 cursor-pointer"
                />
                <span className="text-xs">🟢 Normal</span>
              </label>

              <label 
                className={`flex items-center p-3 rounded-xl border cursor-pointer transition select-none ${
                  prioridad === 'Urgente' 
                    ? 'border-amber-500 bg-amber-50/50 text-amber-950 font-bold' 
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="prioridad"
                  value="Urgente"
                  checked={prioridad === 'Urgente'}
                  onChange={() => setPrioridad('Urgente')}
                  className="w-4 h-4 text-amber-600 focus:ring-amber-500 border-gray-300 mr-2.5 cursor-pointer"
                />
                <span className="text-xs">🟡 Urgente</span>
              </label>

              <label 
                className={`flex items-center p-3 rounded-xl border cursor-pointer transition select-none ${
                  prioridad === 'Emergencia' 
                    ? 'border-red-500 bg-red-50/50 text-red-950 font-bold' 
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="prioridad"
                  value="Emergencia"
                  checked={prioridad === 'Emergencia'}
                  onChange={() => setPrioridad('Emergencia')}
                  className="w-4 h-4 text-red-600 focus:ring-red-500 border-gray-300 mr-2.5 cursor-pointer"
                />
                <span className="text-xs">🔴 Emergencia</span>
              </label>
            </div>
          </div>

          {/* Botón Verde Centrado "Enviar Solicitud" */}
          <div className="pt-4 flex justify-center">
            <button
              type="submit"
              disabled={submitting || uploadingFiles}
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
                  Enviar Solicitud
                </>
              )}
            </button>
          </div>

        </form>
      </div>

      {/* MODAL DE PREVISUALIZACIÓN DE ARCHIVO DE COTIZACIÓN */}
      {previewModalFile && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {previewModalFile.tipo.startsWith('image/') ? (
                  <ImageIcon className="w-5 h-5 text-emerald-600" />
                ) : (
                  <FileText className="w-5 h-5 text-red-600" />
                )}
                <div>
                  <h3 className="text-sm font-bold text-gray-900 truncate max-w-xs md:max-w-md">
                    {previewModalFile.nombre}
                  </h3>
                  <p className="text-3xs text-gray-500">
                    Cotización adjunta • {formatFileSize(previewModalFile.tamano)}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <a
                  href={previewModalFile.url}
                  download={previewModalFile.nombre}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center transition cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Abrir / Descargar
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewModalFile(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 flex items-center justify-center max-h-[75vh] overflow-auto bg-gray-900/5">
              {previewModalFile.tipo.startsWith('image/') ? (
                <img
                  src={previewModalFile.url}
                  alt={previewModalFile.nombre}
                  className="max-h-[68vh] max-w-full rounded-lg shadow-sm object-contain"
                />
              ) : (
                <iframe
                  src={previewModalFile.url}
                  title={previewModalFile.nombre}
                  className="w-full h-[65vh] rounded-lg border border-gray-300"
                />
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

