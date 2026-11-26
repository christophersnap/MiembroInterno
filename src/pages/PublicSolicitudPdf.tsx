import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Printer, Download, ShieldCheck, ArrowLeft, Fuel, FileText, 
  CheckCircle2, Clock, XCircle, AlertCircle, Building2, Calendar, User, Truck
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getApiUrl } from '../lib/api';
import {
  SolicitudCombustible,
  CombustibleConfig,
  DEFAULT_COMBUSTIBLE_CONFIG,
  parseCombustibleConfigFromMap,
  resolveCombustibleLogoUrl,
  formatSolicitudCombustibleFechaHoraSV,
} from '../types/combustible';
import {
  SolicitudCompra,
  CompraConfig,
  DEFAULT_COMPRA_CONFIG,
  parseCompraConfigFromMap,
} from '../types/compra';
import SmartStorageImage from '../components/common/SmartStorageImage';
import PdfWatermarkOverlay from '../components/common/PdfWatermarkOverlay';

export default function PublicSolicitudPdf() {
  const { tipo, folio } = useParams<{ tipo: string; folio: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [solicitudCombustible, setSolicitudCombustible] = useState<SolicitudCombustible | null>(null);
  const [solicitudCompra, setSolicitudCompra] = useState<SolicitudCompra | null>(null);

  const [combustibleConfig, setCombustibleConfig] = useState<CombustibleConfig>(DEFAULT_COMBUSTIBLE_CONFIG);
  const [compraConfig, setCompraConfig] = useState<CompraConfig>(DEFAULT_COMPRA_CONFIG);

  const printAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSolicitud();
  }, [tipo, folio]);

  const fetchSolicitud = async () => {
    setLoading(true);
    setError(null);
    try {
      const cleanFolio = decodeURIComponent(folio || '').trim();
      const isCombustible = tipo === 'combustible' || cleanFolio.startsWith('COMB-');

      // Cargar configuraciones guardadas (API + Supabase + fallback localStorage)
      const confMap: Record<string, string> = {};
      try {
        const apiRes = await fetch(getApiUrl('/api/configuracion'));
        if (apiRes.ok) {
          const apiJson = await apiRes.json();
          Object.entries(apiJson).forEach(([k, v]) => {
            if (k && v !== null && v !== undefined) confMap[k] = String(v);
          });
        }
      } catch {}

      try {
        const { data: configRows } = await supabase.from('configuracion').select('clave, valor');
        if (configRows && configRows.length > 0) {
          configRows.forEach(r => {
            if (r.clave && r.valor !== null && r.valor !== undefined) {
              confMap[r.clave] = String(r.valor);
            }
          });
        }
      } catch {}

      let storedLocalComb: Partial<CombustibleConfig> = {};
      try {
        const cached = localStorage.getItem('cruz_verde_combustible_config');
        if (cached) storedLocalComb = JSON.parse(cached);
      } catch {}

      if (isCombustible) {
        setCombustibleConfig(prev => parseCombustibleConfigFromMap(confMap, storedLocalComb, prev));
      } else {
        let storedLocalComp: Partial<CompraConfig> = {};
        try {
          const cached = localStorage.getItem('cruz_verde_compra_config');
          if (cached) storedLocalComp = JSON.parse(cached);
        } catch {}
        setCompraConfig(prev => {
          const parsed = parseCompraConfigFromMap(confMap, storedLocalComp, prev);
          if (!parsed.pdfLogoUrl && confMap.email_template_logo) {
            parsed.pdfLogoUrl = confMap.email_template_logo;
          }
          return parsed;
        });
      }

      if (isCombustible) {
        // Buscar en solicitudes_combustible
        try {
          const { data, error: fetchErr } = await supabase
            .from('solicitudes_combustible')
            .select('*')
            .eq('folio', cleanFolio)
            .maybeSingle();

          if (!fetchErr && data) {
            setSolicitudCombustible(data);
            return;
          }
        } catch (e) {}

        // Fallback local storage
        try {
          const localComb = sessionStorage.getItem('cruz_verde_solicitudes_combustible') || localStorage.getItem('cruz_verde_solicitudes_combustible');
          if (localComb) {
            const arr = JSON.parse(localComb);
            const found = arr.find((s: any) => s.folio === cleanFolio || String(s.id) === cleanFolio);
            if (found) {
              setSolicitudCombustible(found);
              return;
            }
          }
        } catch (localErr) {}

        throw new Error('No se encontró ninguna solicitud de combustible con el folio ' + cleanFolio);
      } else {
        // Buscar en solicitudes_compra
        try {
          const { data, error: fetchErr } = await supabase
            .from('solicitudes_compra')
            .select('*')
            .eq('folio', cleanFolio)
            .maybeSingle();

          if (!fetchErr && data) {
            setSolicitudCompra(data);
            return;
          }
        } catch (e) {}

        // Fallback local storage
        try {
          const localComp = sessionStorage.getItem('cruz_verde_solicitudes_compra') || localStorage.getItem('cruz_verde_solicitudes_compra');
          if (localComp) {
            const arr = JSON.parse(localComp);
            const found = arr.find((s: any) => s.folio === cleanFolio || String(s.id) === cleanFolio);
            if (found) {
              setSolicitudCompra(found);
              return;
            }
          }
        } catch (localErr) {}

        throw new Error('No se encontró ninguna solicitud de compra con el folio ' + cleanFolio);
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar el documento oficial');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent mb-4"></div>
        <p className="text-sm font-semibold text-slate-700">Cargando documento oficial de Cruz Verde Salvadoreña...</p>
        <p className="text-xs text-slate-500 font-mono mt-1">Folio: {folio}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-6 rounded-2xl border border-red-200 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-gray-900">Documento no disponible</h2>
          <p className="text-xs text-gray-600">{error}</p>
          <div className="pt-2">
            <Link
              to="/login"
              className="inline-flex items-center px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-black transition-colors"
            >
              Ir a la plataforma institucional
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isComb = Boolean(solicitudCombustible);
  const folioActual = isComb ? solicitudCombustible?.folio : solicitudCompra?.folio;
  const estadoActual = isComb ? solicitudCombustible?.estado : solicitudCompra?.estado;

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-3 sm:px-6 print:bg-white print:p-0 print:m-0">
      
      {/* Barra Superior con Acciones (Oculta al Imprimir) */}
      <div className="max-w-4xl mx-auto mb-6 print:hidden">
        <div className="bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${
              isComb ? 'bg-emerald-600' : 'bg-blue-600'
            }`}>
              {isComb ? <Fuel className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black tracking-tight text-gray-900">
                  {isComb ? 'Documento de Combustible' : 'Solicitud de Compra'}
                </span>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                  {folioActual}
                </span>
              </div>
              <div className="flex items-center space-x-2 mt-0.5">
                <span className={`inline-flex items-center px-2 py-0.2 rounded-full text-3xs font-bold ${
                  estadoActual === 'Aprobada' ? 'bg-emerald-100 text-emerald-800' :
                  estadoActual === 'Pendiente' ? 'bg-amber-100 text-amber-800' :
                  estadoActual === 'Rechazada' ? 'bg-rose-100 text-rose-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {estadoActual}
                </span>
                <span className="text-3xs text-gray-500">• Verificación Oficial Digital</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center cursor-pointer"
            >
              <Printer className="w-4 h-4 mr-1.5" />
              Imprimir / Guardar PDF
            </button>
            <Link
              to="/login"
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
            >
              Acceso Institucional
            </Link>
          </div>
        </div>
      </div>

      {/* Hoja Física Oficial Imprimible */}
      <div 
        ref={printAreaRef}
        className="max-w-4xl mx-auto bg-white border border-slate-300 rounded-xl shadow-lg p-8 sm:p-12 relative overflow-hidden print:shadow-none print:border-none print:p-4 print:max-w-none print:w-full print:m-0"
        style={{ minHeight: '297mm' }}
      >
        {isComb ? (
          <PdfWatermarkOverlay
            enabled={combustibleConfig.pdfWatermark}
            imageUrl={combustibleConfig.pdfWatermarkImgUrl}
            text={combustibleConfig.pdfWatermarkText}
            opacity={combustibleConfig.pdfWatermarkOpacity}
            scale={combustibleConfig.pdfWatermarkScale}
            position={combustibleConfig.pdfWatermarkPosition}
          />
        ) : (
          <PdfWatermarkOverlay
            enabled={compraConfig.pdfWatermark}
            imageUrl={compraConfig.pdfWatermarkImgUrl}
            text={compraConfig.pdfWatermarkText}
            opacity={compraConfig.pdfWatermarkOpacity}
            scale={compraConfig.pdfWatermarkScale}
            position={compraConfig.pdfWatermarkPosition}
          />
        )}

        {isComb && solicitudCombustible && (() => {
          const resolvedCombLogo = resolveCombustibleLogoUrl(combustibleConfig);
          const fechaHoraSV = formatSolicitudCombustibleFechaHoraSV(solicitudCombustible);
          const vehiculoDisplay = [solicitudCombustible.vehiculo_marca, solicitudCombustible.vehiculo_modelo].filter(Boolean).join(' ').trim();
          const hasOptionalDetails =
            (combustibleConfig.mostrarVehiculo && Boolean(vehiculoDisplay)) ||
            (combustibleConfig.mostrarPlaca && Boolean(solicitudCombustible.vehiculo_placa)) ||
            (combustibleConfig.mostrarTipoGasolina && Boolean(solicitudCombustible.tipo_combustible)) ||
            (combustibleConfig.mostrarGalones && solicitudCombustible.galones_solicitados !== undefined && solicitudCombustible.galones_solicitados !== null && String(solicitudCombustible.galones_solicitados).trim() !== '') ||
            (combustibleConfig.mostrarCantidadDinero && solicitudCombustible.cantidad_dinero !== undefined && solicitudCombustible.cantidad_dinero !== null && String(solicitudCombustible.cantidad_dinero).trim() !== '');
          const nombreJefatura = (combustibleConfig.pdfNombreJefaturaOperaciones || solicitudCombustible.autorizado_por || '').trim();
          const cargoJefatura = (combustibleConfig.pdfLabelFirmaAdmin || 'Jefatura de Operaciones').trim();
          const labelFirmaSolicitante = (combustibleConfig.pdfLabelFirmaSolicitante || 'Firma del Solicitante').trim();
          const textoSello = (combustibleConfig.pdfTextoSelloInstitucional || 'Sello Institucional Oficial').trim();

          return (
            <div className="relative z-10 space-y-6 text-gray-900 font-sans">
              {/* Encabezado */}
              <div className="flex items-center justify-between border-b-2 border-emerald-800 pb-4 gap-4">
                <div className="flex items-center space-x-4">
                  {combustibleConfig.pdfMostrarLogoHeader !== false && (
                    <SmartStorageImage
                      src={resolvedCombLogo}
                      alt="Cruz Verde Salvadoreña"
                      className="h-16 w-auto max-w-[120px] object-contain shrink-0"
                      fallback={
                        <div className="w-16 h-16 rounded-full border-2 border-green-800 bg-white flex flex-col items-center justify-center text-center p-1 shrink-0">
                          <span className="text-[7px] font-bold text-green-900 leading-none">CRUZ VERDE</span>
                          <span className="text-2xl font-black text-green-800 leading-none my-0.5">+</span>
                          <span className="text-[7px] font-bold text-green-900 leading-none">EL SALVADOR</span>
                        </div>
                      }
                    />
                  )}
                  <div>
                    <h1 className="text-lg font-black tracking-tight text-emerald-950 uppercase">
                      {combustibleConfig.pdfTitulo || 'CRUZ VERDE SALVADOREÑA'}
                    </h1>
                    <p className="text-xs font-extrabold text-emerald-800 tracking-wider uppercase">
                      {combustibleConfig.pdfSubtitulo || 'SOLICITUD DE COMBUSTIBLE'}
                    </p>
                    <p className="text-xs text-gray-600 font-semibold mt-0.5">
                      {combustibleConfig.pdfSubtituloSecundario || 'Documento Oficial Administrativo'}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-3xs font-bold text-gray-400 uppercase tracking-widest">FOLIO OFICIAL</div>
                  <div className="text-sm font-mono font-black text-emerald-900 border border-emerald-200 bg-emerald-50/50 px-2.5 py-1 rounded-md inline-block">
                    {solicitudCombustible.folio}
                  </div>
                  <div className="text-3xs text-gray-700 font-mono font-semibold mt-1">
                    {fechaHoraSV.completa}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    (Hora de El Salvador)
                  </div>
                </div>
              </div>

              {/* Estado Banner */}
              <div className={`p-3 rounded-lg border flex items-center justify-between text-xs font-bold ${
                solicitudCombustible.estado === 'Aprobada' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' :
                solicitudCombustible.estado === 'Pendiente' ? 'bg-amber-50 border-amber-300 text-amber-900' :
                solicitudCombustible.estado === 'Rechazada' ? 'bg-rose-50 border-rose-300 text-rose-900' :
                'bg-blue-50 border-blue-300 text-blue-900'
              }`}>
                <span>Estado del Requerimiento: {solicitudCombustible.estado.toUpperCase()}</span>
                {solicitudCombustible.autorizado_por && (
                  <span className="font-normal text-3xs">
                    Autorizado por: <strong>{solicitudCombustible.autorizado_por}</strong>
                  </span>
                )}
              </div>

              {/* Datos Generales */}
              <div className="grid grid-cols-2 gap-4 text-xs border border-gray-200 rounded-lg p-4 bg-gray-50/30">
                <div>
                  <span className="text-3xs font-bold text-gray-400 uppercase block">Seccional Solicitante</span>
                  <span className="font-bold text-gray-900 text-sm">{solicitudCombustible.seccional_nombre}</span>
                </div>
                <div>
                  <span className="text-3xs font-bold text-gray-400 uppercase block">Director / Responsable</span>
                  <span className="font-semibold text-gray-800">{solicitudCombustible.director_nombre || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-3xs font-bold text-gray-400 uppercase block">Solicitante</span>
                  <span className="font-semibold text-gray-800">{solicitudCombustible.nombre_solicitante}</span>
                  {solicitudCombustible.telefono_solicitante && (
                    <span className="text-3xs text-gray-500 font-mono block">Tel: {solicitudCombustible.telefono_solicitante}</span>
                  )}
                </div>
                <div>
                  <span className="text-3xs font-bold text-gray-400 uppercase block">Correo de Contacto</span>
                  <span className="font-mono text-gray-700 break-all">{solicitudCombustible.correo_electronico || 'N/A'}</span>
                </div>
              </div>

              {/* Detalle de Actividad y Liquidación */}
              <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-900 border-b pb-1">
                  Detalle de la Solicitud
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-3xs font-bold text-gray-400 uppercase block">
                      {combustibleConfig.pdfLabelActividad || 'Tipo de Actividad'}
                    </span>
                    <span className="font-bold text-gray-900 text-sm block mt-0.5">
                      {solicitudCombustible.actividad}
                    </span>
                  </div>

                  <div>
                    <span className="text-3xs font-bold text-gray-400 uppercase block">
                      {combustibleConfig.pdfLabelLiquidacion || '¿Entregó liquidación del mes anterior?'}
                    </span>
                    <span className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      solicitudCombustible.entrego_liquidacion_anterior
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {solicitudCombustible.entrego_liquidacion_anterior ? 'Sí' : 'No'}
                    </span>
                  </div>
                </div>

                {!solicitudCombustible.entrego_liquidacion_anterior && (
                  <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-2.5 text-xs">
                    <span className="text-3xs font-bold text-amber-800 uppercase block">
                      {combustibleConfig.pdfLabelMotivo || 'Motivo de no liquidación'}
                    </span>
                    <p className="text-amber-950 font-medium mt-0.5">
                      {solicitudCombustible.motivo_no_liquidacion || 'No especificado'}
                    </p>
                  </div>
                )}

                {hasOptionalDetails && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-2 border-t border-gray-100">
                    {combustibleConfig.mostrarVehiculo && vehiculoDisplay && (
                      <div>
                        <span className="text-3xs font-bold text-gray-400 uppercase block">Vehículo / Unidad</span>
                        <span className="font-semibold text-gray-900">{vehiculoDisplay}</span>
                      </div>
                    )}
                    {combustibleConfig.mostrarPlaca && solicitudCombustible.vehiculo_placa && (
                      <div>
                        <span className="text-3xs font-bold text-gray-400 uppercase block">Placa</span>
                        <span className="font-bold font-mono text-gray-900">{solicitudCombustible.vehiculo_placa}</span>
                      </div>
                    )}
                    {combustibleConfig.mostrarTipoGasolina && solicitudCombustible.tipo_combustible && (
                      <div>
                        <span className="text-3xs font-bold text-gray-400 uppercase block">Tipo de Gasolina</span>
                        <span className="font-medium text-gray-800">{solicitudCombustible.tipo_combustible}</span>
                      </div>
                    )}
                    {combustibleConfig.mostrarGalones && solicitudCombustible.galones_solicitados !== undefined && solicitudCombustible.galones_solicitados !== null && String(solicitudCombustible.galones_solicitados).trim() !== '' && (
                      <div>
                        <span className="text-3xs font-bold text-gray-400 uppercase block">Galones Solicitados</span>
                        <span className="font-bold text-emerald-800 text-sm">{solicitudCombustible.galones_solicitados} Gl.</span>
                      </div>
                    )}
                    {combustibleConfig.mostrarCantidadDinero && solicitudCombustible.cantidad_dinero !== undefined && solicitudCombustible.cantidad_dinero !== null && String(solicitudCombustible.cantidad_dinero).trim() !== '' && (
                      <div>
                        <span className="text-3xs font-bold text-gray-400 uppercase block">Cantidad de Dinero</span>
                        <span className="font-bold text-emerald-800 text-sm">${Number(solicitudCombustible.cantidad_dinero).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}

                {solicitudCombustible.observaciones && (
                  <div className="pt-1">
                    <span className="text-3xs font-bold text-gray-400 uppercase block">Observaciones</span>
                    <p className="text-xs text-gray-700 mt-0.5 whitespace-pre-wrap">{solicitudCombustible.observaciones}</p>
                  </div>
                )}
              </div>

              {/* Firmas y Sello Institucional Oficial */}
              <div className="pt-12 grid grid-cols-3 gap-6 items-end text-center border-t border-gray-200">
                {/* Firma 1: Solicitante */}
                <div className="flex flex-col items-center justify-end px-2">
                  <div className="w-full flex items-end gap-1.5 mb-2">
                    <span className="text-sm font-bold text-gray-900 leading-none shrink-0">F.</span>
                    <div className="flex-1 border-b border-gray-900 h-7"></div>
                  </div>
                  <p className="text-xs font-bold text-gray-900 leading-tight">{solicitudCombustible.nombre_solicitante}</p>
                  <p className="text-3xs text-gray-500 uppercase font-semibold mt-0.5">{labelFirmaSolicitante}</p>
                </div>

                {/* Centro: Cuadro sutil Sello Institucional Oficial */}
                <div className="flex flex-col items-center justify-center">
                  {combustibleConfig.pdfMostrarSelloImg && combustibleConfig.pdfSelloImgUrl ? (
                    <div className="w-36 h-24 rounded-md border border-dashed border-gray-300/60 flex flex-col items-center justify-center p-2">
                      <SmartStorageImage
                        src={combustibleConfig.pdfSelloImgUrl}
                        alt="Sello Institucional Oficial"
                        className="max-h-16 max-w-full object-contain opacity-85"
                      />
                      <span className="text-[9px] text-gray-400/80 uppercase tracking-wider mt-1">{textoSello}</span>
                    </div>
                  ) : (
                    <div className="w-36 h-24 rounded-md border border-dashed border-gray-300/60 flex items-center justify-center p-2">
                      <span className="text-[10px] text-gray-400/75 font-medium uppercase tracking-wider text-center leading-tight">
                        {textoSello}
                      </span>
                    </div>
                  )}
                </div>

                {/* Firma 2: Jefatura de Operaciones */}
                <div className="flex flex-col items-center justify-end px-2">
                  <div className="w-full flex items-end gap-1.5 mb-2">
                    <span className="text-sm font-bold text-gray-900 leading-none shrink-0">F.</span>
                    <div className="flex-1 border-b border-gray-900 h-7"></div>
                  </div>
                  <p className="text-xs font-bold text-gray-900 leading-tight">
                    {nombreJefatura || cargoJefatura}
                  </p>
                  <p className="text-3xs text-gray-500 uppercase font-semibold mt-0.5">
                    {nombreJefatura ? cargoJefatura : 'Autorización Institucional'}
                  </p>
                </div>
              </div>

              {/* Pie de página institucional */}
              <div className="pt-6 border-t border-gray-100 text-center text-4xs text-gray-400 space-y-0.5">
                <p>Cruz Verde Salvadoreña • {combustibleConfig.pdfSubtituloSecundario || 'Documento Oficial Administrativo'}</p>
                <p>Documento generado electrónicamente con código de autenticidad: {solicitudCombustible.folio}</p>
              </div>
            </div>
          );
        })()}

        {!isComb && solicitudCompra && (
          <div className="relative z-10 space-y-6 text-gray-900 font-sans">
            {/* Encabezado */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
              <div className="flex items-center space-x-4">
                <img 
                  src={compraConfig.pdfLogoUrl || "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Cruz_Verde_Salvadore%C3%B1a.png/120px-Cruz_Verde_Salvadore%C3%B1a.png"} 
                  alt="Cruz Verde" 
                  className="h-16 w-auto object-contain"
                  crossOrigin="anonymous"
                />
                <div>
                  <h1 className="text-lg font-black tracking-tight text-gray-950 uppercase">
                    {compraConfig.pdfTitulo || "Cruz Verde Salvadoreña"}
                  </h1>
                  <p className="text-xs font-bold text-emerald-800 tracking-wider uppercase">
                    {compraConfig.pdfDepartamento || "Departamento Administrativo"}
                  </p>
                  <p className="text-xs font-bold text-gray-700 uppercase">
                    {compraConfig.pdfSubtitulo || "Hoja de Solicitud de Compra y Mantenimiento"}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <div className="text-3xs font-bold text-gray-400 uppercase tracking-widest">FOLIO OFICIAL</div>
                <div className="text-sm font-mono font-black text-gray-900 border border-slate-300 bg-slate-50 px-2.5 py-1 rounded-md inline-block">
                  {solicitudCompra.folio}
                </div>
                <div className="text-3xs text-gray-500 mt-1">
                  Fecha: {solicitudCompra.fecha_solicitud}
                </div>
              </div>
            </div>

            {/* Estado Banner */}
            <div className={`p-3 rounded-lg border flex items-center justify-between text-xs font-bold ${
              solicitudCompra.estado === 'Aprobada' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' :
              solicitudCompra.estado === 'Pendiente' ? 'bg-amber-50 border-amber-300 text-amber-900' :
              solicitudCompra.estado === 'Rechazada' ? 'bg-rose-50 border-rose-300 text-rose-900' :
              'bg-blue-50 border-blue-300 text-blue-900'
            }`}>
              <span>Estado de la Solicitud: {solicitudCompra.estado.toUpperCase()}</span>
              {solicitudCompra.autorizado_por && (
                <span className="font-normal text-3xs">
                  Autorizado por: <strong>{solicitudCompra.autorizado_por}</strong>
                </span>
              )}
            </div>

            {/* Datos Generales */}
            <div className="grid grid-cols-2 gap-4 text-xs border border-gray-200 rounded-lg p-4 bg-gray-50/30">
              <div>
                <span className="text-3xs font-bold text-gray-400 uppercase block">Seccional Solicitante</span>
                <span className="font-bold text-gray-900 text-sm">{solicitudCompra.seccional_nombre}</span>
              </div>
              <div>
                <span className="text-3xs font-bold text-gray-400 uppercase block">Solicitado Por</span>
                <span className="font-semibold text-gray-800">{solicitudCompra.solicitado_por} ({solicitudCompra.cargo})</span>
              </div>
              <div>
                <span className="text-3xs font-bold text-gray-400 uppercase block">Tipo de Solicitud</span>
                <span className="font-medium text-gray-800">{solicitudCompra.tipo_solicitud}</span>
              </div>
              <div>
                <span className="text-3xs font-bold text-gray-400 uppercase block">Prioridad</span>
                <span className="font-bold text-slate-800">{solicitudCompra.prioridad || 'Normal'}</span>
              </div>
            </div>

            {/* Detalle del requerimiento */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b pb-1">
                Descripción y Justificación de la Compra / Reparación
              </h2>
              
              {solicitudCompra.es_para_vehiculo && solicitudCompra.vehiculo_placa && (
                <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-900 bg-emerald-50/80 p-2 rounded border border-emerald-200">
                  <Truck className="w-4 h-4 text-emerald-700" />
                  <span>Unidad / Vehículo: Placa {solicitudCompra.vehiculo_placa} {solicitudCompra.vehiculo_descripcion ? `- ${solicitudCompra.vehiculo_descripcion}` : ''}</span>
                </div>
              )}

              <p className="text-xs text-gray-800 whitespace-pre-wrap bg-gray-50 p-3 rounded border border-gray-100 leading-relaxed">
                {solicitudCompra.descripcion}
              </p>

              <div className="grid grid-cols-2 gap-4 text-xs pt-2">
                {solicitudCompra.proveedor_sugerido && (
                  <div>
                    <span className="text-3xs font-bold text-gray-400 uppercase block">Proveedor Sugerido / Comercio</span>
                    <span className="font-medium text-gray-800">{solicitudCompra.proveedor_sugerido}</span>
                  </div>
                )}
                <div>
                  <span className="text-3xs font-bold text-gray-400 uppercase block">Monto Estimado / Presupuesto</span>
                  <span className="font-mono font-bold text-sm text-emerald-800">
                    ${Number(solicitudCompra.monto_estimado || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Firmas y Sellos */}
            <div className="pt-8 grid grid-cols-3 gap-6 text-center border-t border-gray-200">
              <div className="border-t border-gray-400 pt-2">
                <div className="h-10"></div>
                <p className="text-xs font-bold text-gray-900">{solicitudCompra.solicitado_por}</p>
                <p className="text-3xs text-gray-500 uppercase">{compraConfig.pdfFirma1Titulo || "Firma: Solicitante"}</p>
              </div>

              <div className="flex flex-col items-center justify-end">
                {compraConfig.pdfSelloImgUrl ? (
                  <img 
                    src={compraConfig.pdfSelloImgUrl} 
                    alt="Sello" 
                    className="h-14 object-contain mx-auto mb-1" 
                    crossOrigin="anonymous" 
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full border-2 border-dashed border-emerald-700 flex items-center justify-center text-emerald-800 text-3xs font-bold mb-1">
                    SELLO
                  </div>
                )}
                <p className="text-3xs text-emerald-900 font-bold uppercase">Sello Institucional Oficial</p>
              </div>

              <div className="border-t border-gray-400 pt-2">
                <div className="h-10"></div>
                <p className="text-xs font-bold text-gray-900">{solicitudCompra.autorizado_por || "Administración Central"}</p>
                <p className="text-3xs text-gray-500 uppercase">{compraConfig.pdfFirma2Titulo || "Vo.Bo. Jefatura Administrativa"}</p>
              </div>
            </div>

            {/* Pie de página institucional */}
            <div className="pt-6 border-t border-gray-100 text-center text-4xs text-gray-400 space-y-0.5">
              <p>Cruz Verde Salvadoreña • Departamento Administrativo</p>
              <p>Documento oficial emitido con código: {solicitudCompra.folio}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
