import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Send,
  CheckCircle2,
  Lock,
  Truck,
  DollarSign,
  AlertCircle,
  FileText,
  Upload,
  Paperclip,
  Image as ImageIcon,
  Trash2,
  X,
  Eye,
  ChevronDown,
  ChevronUp,
  Info,
  Building2,
  User,
  Wrench,
  Download,
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
  canSelectAnySeccional?: boolean;
  userSeccionalNombre: string | null;
  userSeccionalId: number | null;
  submitting: boolean;
  blockedByActive?: boolean;
  blockedNotice?: React.ReactNode;
  onSeccionalChange?: (seccional: { id: number | null; nombre: string }) => void;
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
  'Servicios Generales y Otros Requerimientos',
];

export default function CompraForm({
  seccionales,
  vehiculos,
  isAdmin,
  canSelectAnySeccional,
  userSeccionalNombre,
  userSeccionalId,
  submitting,
  blockedByActive = false,
  blockedNotice,
  onSeccionalChange,
  onSubmit,
}: CompraFormProps) {
  const allowSelectSeccional = canSelectAnySeccional ?? isAdmin;
  const lastEmittedSecRef = useRef<string>('');
  const [seccionalId, setSeccionalId] = useState<string>(() => {
    if (userSeccionalId) {
      const match = seccionales.find((s) => Number(s.id) === Number(userSeccionalId));
      if (match) return String(match.id);
    }
    if (userSeccionalNombre) {
      const match = seccionales.find((s) => s.nombre.toLowerCase() === userSeccionalNombre.toLowerCase());
      if (match) return String(match.id);
    }
    return seccionales[0] ? String(seccionales[0].id) : '';
  });

  useEffect(() => {
    if (seccionales.length === 0) return;

    const matchById = userSeccionalId
      ? seccionales.find((s) => Number(s.id) === Number(userSeccionalId))
      : null;
    const matchByName = userSeccionalNombre
      ? seccionales.find((s) => s.nombre.toLowerCase().trim() === userSeccionalNombre.toLowerCase().trim())
      : null;
    const resolved = matchById || matchByName || null;

    if (!allowSelectSeccional) {
      const target = resolved || seccionales[0];
      if (target && String(seccionalId) !== String(target.id)) {
        setSeccionalId(String(target.id));
        setVehiculoId('');
      }
    } else if (!seccionalId) {
      const fallback = resolved || seccionales[0];
      if (fallback) setSeccionalId(String(fallback.id));
    }
  }, [allowSelectSeccional, userSeccionalId, userSeccionalNombre, seccionales, seccionalId]);

  const selectedSec = seccionales.find((s) => String(s.id) === seccionalId) || seccionales[0];

  useEffect(() => {
    if (!onSeccionalChange) return;
    const resolvedId = selectedSec ? Number(selectedSec.id) : (userSeccionalId ? Number(userSeccionalId) : null);
    const resolvedNombre = selectedSec ? selectedSec.nombre : (userSeccionalNombre || '');
    const key = `${resolvedId ?? ''}::${resolvedNombre}`;
    if (lastEmittedSecRef.current === key) return;
    lastEmittedSecRef.current = key;
    onSeccionalChange({ id: resolvedId, nombre: resolvedNombre });
  }, [selectedSec, userSeccionalId, userSeccionalNombre, onSeccionalChange]);

  const getDirectorDisplay = () => {
    if (selectedSec) {
      if (selectedSec.director && selectedSec.director !== 'N/A') {
        return `${selectedSec.director} · ${selectedSec.nombre}`;
      }
      return `Director Asignado · ${selectedSec.nombre}`;
    }
    return 'Director Seccional';
  };

  const getDirectorNombrePuro = () => {
    if (selectedSec?.director && selectedSec.director !== 'N/A') {
      return selectedSec.director;
    }
    return 'Director Seccional';
  };

  const [nombreMotorista, setNombreMotorista] = useState('');
  const [cargoSolicitante, setCargoSolicitante] = useState('Motorista');
  const [tipoSolicitud, setTipoSolicitud] = useState(TIPOS_SOLICITUD_COMPRA[0]);
  const [esParaVehiculo, setEsParaVehiculo] = useState<boolean>(true);
  const [vehiculoId, setVehiculoId] = useState<string>('');
  const [descripcion, setDescripcion] = useState('');
  const [montoEstimado, setMontoEstimado] = useState('');
  const [proveedorSugerido, setProveedorSugerido] = useState('');
  const [prioridad, setPrioridad] = useState<'Normal' | 'Urgente' | 'Emergencia'>('Normal');

  const [cotizacionesArchivos, setCotizacionesArchivos] = useState<ArchivoCotizacion[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewModalFile, setPreviewModalFile] = useState<ArchivoCotizacion | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const vehiculosDeSeccional = useMemo(() => {
    if (!selectedSec) return [];
    return vehiculos.filter((v) => v.seccional_id === selectedSec.id);
  }, [vehiculos, selectedSec]);

  const handleTipoChange = (val: string) => {
    setTipoSolicitud(val);
    const esVeh =
      val.toLowerCase().includes('vehicular') ||
      val.toLowerCase().includes('ambulancia') ||
      val.toLowerCase().includes('mecánico') ||
      val.toLowerCase().includes('repuesto');
    setEsParaVehiculo(esVeh);
  };

  const handleInsertPrefix = (prefix: string) => {
    const clean = descripcion.trimStart();
    if (clean.startsWith(prefix)) return;
    setDescripcion(`${prefix}${clean}`);
  };

  const handleFilesSelected = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;
    setFormError(null);
    setUploadingFiles(true);

    const newFiles: ArchivoCotizacion[] = [];
    let processed = 0;

    fileArray.forEach((file) => {
      const isValidType = file.type.startsWith('image/') || file.type === 'application/pdf';
      if (!isValidType) {
        setFormError(`El archivo "${file.name}" no es compatible. Suba imágenes (JPG, PNG, WEBP) o PDF.`);
        processed++;
        if (processed === fileArray.length) setUploadingFiles(false);
        return;
      }

      if (file.size > 12 * 1024 * 1024) {
        setFormError(`El archivo "${file.name}" supera el límite de 12 MB.`);
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
          url,
        });
        processed++;
        if (processed === fileArray.length) {
          setCotizacionesArchivos((prev) => [...prev, ...newFiles]);
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
    setCotizacionesArchivos((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (blockedByActive) return;

    if (!seccionalId && seccionales.length > 0) {
      setFormError('Seleccione una seccional o dependencia.');
      return;
    }

    if (!nombreMotorista.trim()) {
      setFormError('Ingrese el nombre del solicitante o motorista asignado.');
      return;
    }

    if (!descripcion.trim()) {
      setFormError('Detalle la descripción de los repuestos o servicio requerido.');
      return;
    }

    const vehiculoSeleccionado = vehiculos.find((v) => String(v.id) === vehiculoId);

    await onSubmit({
      seccional_id: selectedSec ? selectedSec.id : undefined,
      seccional_nombre: selectedSec ? selectedSec.nombre : userSeccionalNombre || 'Seccional',
      solicitado_por: nombreMotorista.trim() || getDirectorNombrePuro(),
      cargo: cargoSolicitante.trim() || 'Motorista',
      tipo_solicitud: tipoSolicitud,
      es_para_vehiculo: esParaVehiculo,
      vehiculo_id: esParaVehiculo && vehiculoSeleccionado ? vehiculoSeleccionado.id : null,
      vehiculo_placa: esParaVehiculo && vehiculoSeleccionado ? vehiculoSeleccionado.placa : null,
      vehiculo_descripcion:
        esParaVehiculo && vehiculoSeleccionado
          ? `${vehiculoSeleccionado.marca} ${vehiculoSeleccionado.modelo} (${vehiculoSeleccionado.carroceria || 'Unidad'})`
          : null,
      descripcion: descripcion.trim(),
      monto_estimado: montoEstimado ? parseFloat(montoEstimado) : null,
      proveedor_sugerido: proveedorSugerido.trim() || null,
      prioridad,
      cotizaciones_archivos: cotizacionesArchivos,
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-[#F2F2F7] rounded-[28px] p-4 sm:p-6 md:p-8 border border-slate-200/80 shadow-xs space-y-6">
        {/* Cabecera limpia estilo iOS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Nueva Requisición de Compra y Mantenimiento
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Completa los datos por bloque para remitir la solicitud al Departamento Administrativo.
            </p>
          </div>
          {!allowSelectSeccional && (selectedSec || userSeccionalNombre) && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs self-start sm:self-auto shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {selectedSec?.nombre || userSeccionalNombre}
            </span>
          )}
        </div>

        {/* Disclosure plegable para Lineamientos Oficiales (sin saturar el formulario) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs">
          <button
            type="button"
            onClick={() => setShowGuide((prev) => !prev)}
            className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-500/12 text-amber-600 flex items-center justify-center shrink-0">
                <Info className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900">
                  Lineamientos administrativos para hoja de recepción
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  Sede San Salvador · Nomenclatura de equipo (EQ) · Firma de motorista y sello seccional
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1 shrink-0">
              {showGuide ? 'Ocultar' : 'Ver guía'}
              {showGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
          </button>

          {showGuide && (
            <div className="px-4 pb-4 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 bg-slate-50/50">
              <div className="p-3 rounded-xl bg-white border border-slate-200/70 space-y-1">
                <p className="font-semibold text-slate-900">1. Lugar y Fecha Oficial</p>
                <p>
                  Todas las hojas llevan <strong>SAN SALVADOR</strong> como sede central y se emiten con 05 días hábiles posteriores al cheque o voucher.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200/70 space-y-1">
                <p className="font-semibold text-slate-900">2. Solicitante y Cargo</p>
                <p>
                  Consignar el nombre completo del <strong>Motorista</strong> responsable de la unidad operativa con el cargo <strong>Motorista</strong>.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200/70 space-y-1">
                <p className="font-semibold text-slate-900">3. Nomenclatura del Requerimiento</p>
                <p>
                  Usar <code className="font-mono text-[11px] bg-slate-100 px-1 rounded">REPUESTOS PARA EQ [N°]</code> o{' '}
                  <code className="font-mono text-[11px] bg-slate-100 px-1 rounded">MANTENIMIENTO PARA EQ [N°]</code>.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200/70 space-y-1">
                <p className="font-semibold text-slate-900">4. Formalización Física</p>
                <p>
                  Al imprimir el documento oficial, debe incluir la firma del motorista y el sello oficial de la seccional correspondiente.
                </p>
              </div>
            </div>
          )}
        </div>

        {blockedNotice}

        {formError && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* SECCIÓN 1: SECCIONAL Y SOLICITANTE (INSET GROUPED CARD) */}
          <section className="space-y-1.5">
            <h3 className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              01. Identificación de Seccional y Solicitante
            </h3>
            <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden shadow-2xs">
              {/* Fila Seccional */}
              <div className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-2 sm:w-52 shrink-0">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span>
                    Seccional <span className="text-rose-500">*</span>
                  </span>
                </label>
                {allowSelectSeccional ? (
                  <select
                    value={seccionalId}
                    onChange={(e) => {
                      setSeccionalId(e.target.value);
                      setVehiculoId('');
                    }}
                    required
                    className="flex-1 px-3 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition cursor-pointer"
                  >
                    {seccionales.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.nombre}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200/70 rounded-xl text-sm font-medium text-slate-700 flex items-center justify-between gap-2 cursor-not-allowed select-none">
                    <span>{selectedSec ? selectedSec.nombre : userSeccionalNombre || 'Seccional asignada'}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shrink-0">
                      <Lock className="w-3 h-3 text-slate-400" />
                      Fija
                    </span>
                  </div>
                )}
              </div>

              {/* Fila Nombre Motorista */}
              <div className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-2 sm:w-52 shrink-0">
                  <User className="w-4 h-4 text-slate-400" />
                  <span>
                    Solicitado por <span className="text-rose-500">*</span>
                  </span>
                </label>
                <div className="flex-1 flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    required
                    value={nombreMotorista}
                    onChange={(e) => setNombreMotorista(e.target.value)}
                    placeholder="Nombre completo del motorista"
                    className="flex-1 px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
                  />
                  <input
                    type="text"
                    value={cargoSolicitante}
                    onChange={(e) => setCargoSolicitante(e.target.value)}
                    placeholder="Cargo (Motorista)"
                    className="sm:w-36 px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
                    title="Cargo registrado en la solicitud"
                  />
                </div>
              </div>

              {/* Fila Aval Director */}
              <div className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 bg-slate-50/40">
                <span className="text-xs font-semibold text-slate-600 flex items-center gap-2 sm:w-52 shrink-0">
                  <Lock className="w-4 h-4 text-slate-400" />
                  Director(a) Aval
                </span>
                <div className="flex-1 flex items-center justify-between gap-2 text-xs text-slate-700 font-medium">
                  <span className="truncate">{getDirectorDisplay()}</span>
                  <span className="text-[11px] text-slate-400 shrink-0">Automático</span>
                </div>
              </div>
            </div>
          </section>

          {/* SECCIÓN 2: RUBRO, UNIDAD Y DETALLE */}
          <section className="space-y-1.5">
            <h3 className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              02. Clasificación y Detalle del Requerimiento
            </h3>
            <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden shadow-2xs">
              {/* Tipo de Solicitud */}
              <div className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-2 sm:w-52 shrink-0">
                  <Wrench className="w-4 h-4 text-slate-400" />
                  <span>
                    Tipo de Solicitud <span className="text-rose-500">*</span>
                  </span>
                </label>
                <select
                  value={tipoSolicitud}
                  onChange={(e) => handleTipoChange(e.target.value)}
                  required
                  className="flex-1 px-3 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
                >
                  {TIPOS_SOLICITUD_COMPRA.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </div>

              {/* Switch iOS: Aplica a ambulancia o vehículo */}
              <div className="px-4 py-3.5 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/12 text-emerald-600 flex items-center justify-center shrink-0">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900">
                        ¿Aplica a una ambulancia o vehículo de la seccional?
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Vincula la placa y unidad de flota correspondiente.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={esParaVehiculo}
                    onClick={() => setEsParaVehiculo((prev) => !prev)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      esParaVehiculo ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        esParaVehiculo ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {esParaVehiculo && (
                  <div className="pt-1">
                    {vehiculosDeSeccional.length === 0 ? (
                      <div className="px-3 py-2.5 bg-amber-50/70 border border-amber-200/70 rounded-xl text-xs text-amber-800">
                        No hay vehículos registrados en flota para {selectedSec?.nombre || 'esta seccional'}. Indica la placa o número de equipo en la descripción.
                      </div>
                    ) : (
                      <select
                        value={vehiculoId}
                        onChange={(e) => setVehiculoId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                      >
                        <option value="">Selecciona la unidad vehicular (opcional)...</option>
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

              {/* Descripción + Botones de inserción rápida */}
              <div className="p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-800">
                    Descripción del Requerimiento o Repuestos <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleInsertPrefix('REPUESTOS PARA EQ ')}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      + REPUESTOS PARA EQ
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertPrefix('MANTENIMIENTO PARA EQ ')}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      + MANTENIMIENTO PARA EQ
                    </button>
                  </div>
                </div>
                <textarea
                  rows={4}
                  required
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Ejemplo: REPUESTOS PARA EQ 231-911: 2 llantas 195R15 para ambulancia CVS-014, juego de pastillas de frenos delanteros y cambio de aceite..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition outline-none leading-relaxed"
                />
                <p className="text-[11px] text-slate-500">
                  Si se requieren múltiples ítems, utiliza el prefijo <strong>REPUESTOS</strong> seguido del número de equipo (EQ) de tu seccional.
                </p>
              </div>
            </div>
          </section>

          {/* SECCIÓN 3: PRESUPUESTO, PROVEEDOR Y PRIORIDAD */}
          <section className="space-y-1.5">
            <h3 className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              03. Costo, Proveedor y Prioridad
            </h3>
            <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden shadow-2xs">
              {/* Costo Total Estimado */}
              <div className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-2 sm:w-52 shrink-0">
                  <DollarSign className="w-4 h-4 text-slate-400" />
                  Costo Total ($ USD)
                </label>
                <div className="flex-1 flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3.5 top-2.5 text-sm font-semibold text-slate-400 select-none">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={montoEstimado}
                      onChange={(e) => setMontoEstimado(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 tabular-nums focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">Según cotización</span>
                </div>
              </div>

              {/* Proveedor Sugerido */}
              <div className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-2 sm:w-52 shrink-0">
                  <FileText className="w-4 h-4 text-slate-400" />
                  Proveedor o Taller
                </label>
                <input
                  type="text"
                  value={proveedorSugerido}
                  onChange={(e) => setProveedorSugerido(e.target.value)}
                  placeholder="Ej. Taller Central / Repuestos Los Andes"
                  className="flex-1 px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
                />
              </div>

              {/* Segmented Control Apple iOS para Prioridad */}
              <div className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                <span className="text-xs font-semibold text-slate-800 sm:w-52 shrink-0">
                  Nivel de Prioridad <span className="text-rose-500">*</span>
                </span>
                <div className="flex-1 bg-slate-100 p-1 rounded-xl grid grid-cols-3 gap-1">
                  {(['Normal', 'Urgente', 'Emergencia'] as const).map((level) => {
                    const active = prioridad === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setPrioridad(level)}
                        className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                          active
                            ? level === 'Emergencia'
                              ? 'bg-rose-600 text-white shadow-2xs'
                              : level === 'Urgente'
                              ? 'bg-amber-500 text-white shadow-2xs'
                              : 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {level}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* SECCIÓN 4: COTIZACIONES ADJUNTAS */}
          <section className="space-y-1.5">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                04. Respaldo y Cotizaciones Adjuntas
              </h3>
              <span className="text-[11px] font-medium text-slate-400 tabular-nums">
                {cotizacionesArchivos.length === 1 ? '1 archivo' : `${cotizacionesArchivos.length} archivos`}
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-3 shadow-2xs">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files) handleFilesSelected(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50/50'
                    : 'border-slate-200 hover:border-emerald-400 bg-slate-50/60 hover:bg-emerald-50/20'
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
                <div className="flex flex-col items-center space-y-1.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/12 text-emerald-600 flex items-center justify-center">
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-800">
                    Subir fotos o PDF de cotizaciones
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Arrastra tus archivos aquí o toca para seleccionar (JPG, PNG, WEBP o PDF hasta 12 MB)
                  </p>
                </div>
              </div>

              {uploadingFiles && (
                <div className="flex items-center justify-center gap-2 text-xs text-emerald-700 font-medium py-1">
                  <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  <span>Procesando archivos...</span>
                </div>
              )}

              {cotizacionesArchivos.length > 0 && (
                <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden">
                  {cotizacionesArchivos.map((file, idx) => (
                    <div
                      key={idx}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-3 bg-white hover:bg-slate-50/60 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => setPreviewModalFile(file)}
                        className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        {file.tipo.startsWith('image/') ? (
                          <img
                            src={file.url}
                            alt={file.nombre}
                            className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 border border-rose-200/70 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-900 truncate">{file.nombre}</p>
                          <p className="text-[11px] text-slate-400">
                            {formatFileSize(file.tamano)} · {file.tipo.startsWith('image/') ? 'Imagen' : 'PDF'}
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPreviewModalFile(file)}
                          className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                          title="Previsualizar"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Quitar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* BOTÓN DE ENVÍO */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting || uploadingFiles || blockedByActive}
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-semibold text-sm shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Enviando solicitud...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar Solicitud de Compra
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* MODAL DE PREVISUALIZACIÓN DE COTIZACIÓN */}
      {previewModalFile && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setPreviewModalFile(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-white border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  {previewModalFile.tipo.startsWith('image/') ? (
                    <ImageIcon className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <FileText className="w-4 h-4 text-rose-600" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 truncate">
                    {previewModalFile.nombre}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Cotización adjunta · {formatFileSize(previewModalFile.tamano)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewModalFile.url}
                  download={previewModalFile.nombre}
                  className="px-3.5 py-2 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewModalFile(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 flex items-center justify-center max-h-[75vh] overflow-auto bg-slate-100">
              {previewModalFile.tipo.startsWith('image/') ? (
                <img
                  src={previewModalFile.url}
                  alt={previewModalFile.nombre}
                  className="max-h-[68vh] max-w-full rounded-xl shadow-sm object-contain"
                />
              ) : (
                <iframe
                  src={previewModalFile.url}
                  title={previewModalFile.nombre}
                  className="w-full h-[65vh] rounded-xl border border-slate-200 bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
