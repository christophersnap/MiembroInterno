import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Printer, Download, ShieldCheck, ArrowLeft, Fuel, FileText, 
  CheckCircle2, Clock, XCircle, AlertCircle, Building2, Calendar, User, Truck
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SolicitudCombustible, CombustibleConfig, DEFAULT_COMBUSTIBLE_CONFIG } from '../types/combustible';
import { SolicitudCompra, CompraConfig, DEFAULT_COMPRA_CONFIG } from '../types/compra';

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

      // Cargar configuraciones guardadas
      try {
        const { data: configRows } = await supabase.from('configuracion').select('clave, valor');
        if (configRows && configRows.length > 0) {
          const confMap: Record<string, string> = {};
          configRows.forEach(r => { if (r.clave && r.valor) confMap[r.clave] = r.valor; });

          if (isCombustible) {
            setCombustibleConfig(prev => ({
              ...prev,
              pdfTitulo: confMap.combustible_pdf_titulo || prev.pdfTitulo,
              pdfSubtitulo: confMap.combustible_pdf_subtitulo || prev.pdfSubtitulo,
              pdfLogoHeaderUrl: confMap.combustible_pdf_logo_url || prev.pdfLogoHeaderUrl,
              pdfSelloImgUrl: confMap.combustible_pdf_sello_img_url || prev.pdfSelloImgUrl,
            }));
          } else {
            setCompraConfig(prev => ({
              ...prev,
              pdfTitulo: confMap.solicitudes_pdf_titulo || prev.pdfTitulo,
              pdfSubtitulo: confMap.solicitudes_pdf_subtitulo || prev.pdfSubtitulo,
              pdfLogoUrl: confMap.solicitudes_pdf_logo_url || prev.pdfLogoUrl,
              pdfSelloImgUrl: confMap.solicitudes_pdf_sello_img_url || prev.pdfSelloImgUrl,
            }));
          }
        }
      } catch (e) {
        // Fallback a localStorage
        try {
          if (isCombustible) {
            const cached = localStorage.getItem('cruz_verde_combustible_config');
            if (cached) setCombustibleConfig({ ...DEFAULT_COMBUSTIBLE_CONFIG, ...JSON.parse(cached) });
          } else {
            const cached = localStorage.getItem('cruz_verde_compra_config');
            if (cached) setCompraConfig({ ...DEFAULT_COMPRA_CONFIG, ...JSON.parse(cached) });
          }
        } catch (localErr) {}
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
        className="max-w-4xl mx-auto bg-white border border-slate-300 rounded-xl shadow-lg p-8 sm:p-12 print:shadow-none print:border-none print:p-4 print:max-w-none print:w-full print:m-0"
        style={{ minHeight: '297mm' }}
      >
        {isComb && solicitudCombustible && (
          <div className="space-y-6 text-gray-900 font-sans">
            {/* Encabezado */}
            <div className="flex items-center justify-between border-b-2 border-emerald-800 pb-4">
              <div className="flex items-center space-x-4">
                <img 
                  src={combustibleConfig.pdfLogoHeaderUrl || "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Cruz_Verde_Salvadore%C3%B1a.png/120px-Cruz_Verde_Salvadore%C3%B1a.png"} 
                  alt="Cruz Verde" 
                  className="h-16 w-auto object-contain"
                  crossOrigin="anonymous"
                />
                <div>
                  <h1 className="text-lg font-black tracking-tight text-emerald-950 uppercase">
                    {combustibleConfig.pdfTitulo || "Cruz Verde Salvadoreña"}
                  </h1>
                  <p className="text-xs font-bold text-emerald-800 tracking-wider uppercase">
                    {combustibleConfig.pdfSubtitulo || "Control y Asignación de Combustible"}
                  </p>
                  <p className="text-3xs text-gray-500 font-medium">
                    Documento Oficial de Autorización y Despacho
                  </p>
                </div>
              </div>

              <div className="text-right">
                <div className="text-3xs font-bold text-gray-400 uppercase tracking-widest">FOLIO OFICIAL</div>
                <div className="text-sm font-mono font-black text-emerald-900 border border-emerald-200 bg-emerald-50/50 px-2.5 py-1 rounded-md inline-block">
                  {solicitudCombustible.folio}
                </div>
                <div className="text-3xs text-gray-500 mt-1">
                  Fecha: {solicitudCombustible.fecha_solicitud}
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
                  <span className="text-3xs text-gray-500 block">Tel: {solicitudCombustible.telefono_solicitante}</span>
                )}
              </div>
              <div>
                <span className="text-3xs font-bold text-gray-400 uppercase block">Correo de Contacto</span>
                <span className="font-mono text-gray-700">{solicitudCombustible.correo_electronico || 'N/A'}</span>
              </div>
            </div>

            {/* Requerimiento y Vehículo */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-900 border-b pb-1">
                Detalle de la Misión y Asignación
              </h2>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-3xs font-bold text-gray-400 uppercase block">Vehículo / Placa</span>
                  <span className="font-bold text-gray-900">{solicitudCombustible.vehiculo_placa || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-3xs font-bold text-gray-400 uppercase block">Marca y Modelo</span>
                  <span className="font-medium text-gray-800">
                    {[solicitudCombustible.vehiculo_marca, solicitudCombustible.vehiculo_modelo].filter(Boolean).join(' ') || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-3xs font-bold text-gray-400 uppercase block">Tipo Combustible</span>
                  <span className="font-medium text-gray-800">{solicitudCombustible.tipo_combustible || 'Regular / Diesel'}</span>
                </div>
                <div>
                  <span className="text-3xs font-bold text-gray-400 uppercase block">Galones Solicitados</span>
                  <span className="font-bold text-emerald-800 text-sm">{solicitudCombustible.galones_solicitados || 'N/A'} Gl.</span>
                </div>
              </div>

              <div>
                <span className="text-3xs font-bold text-gray-400 uppercase block">Actividad / Emergencia / Justificación</span>
                <p className="text-xs text-gray-800 mt-1 whitespace-pre-wrap bg-gray-50 p-2.5 rounded border border-gray-100">
                  {solicitudCombustible.actividad}
                </p>
              </div>

              {solicitudCombustible.observaciones && (
                <div>
                  <span className="text-3xs font-bold text-gray-400 uppercase block">Observaciones</span>
                  <p className="text-xs text-gray-600 mt-0.5">{solicitudCombustible.observaciones}</p>
                </div>
              )}
            </div>

            {/* Firmas y Sellos */}
            <div className="pt-8 grid grid-cols-3 gap-6 text-center border-t border-gray-200">
              <div className="border-t border-gray-400 pt-2">
                <div className="h-10"></div>
                <p className="text-xs font-bold text-gray-900">{solicitudCombustible.nombre_solicitante}</p>
                <p className="text-3xs text-gray-500 uppercase">Firma del Solicitante</p>
              </div>

              <div className="flex flex-col items-center justify-end">
                {combustibleConfig.pdfSelloImgUrl ? (
                  <img 
                    src={combustibleConfig.pdfSelloImgUrl} 
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
                <p className="text-xs font-bold text-gray-900">{solicitudCombustible.autorizado_por || 'Jefatura de Operaciones'}</p>
                <p className="text-3xs text-gray-500 uppercase">Autorizado Presidencia / Jefatura</p>
              </div>
            </div>

            {/* Pie de página institucional */}
            <div className="pt-6 border-t border-gray-100 text-center text-4xs text-gray-400 space-y-0.5">
              <p>Cruz Verde Salvadoreña • Sistema Digital de Verificación y Control</p>
              <p>Documento generado electrónicamente con código de autenticidad: {solicitudCombustible.folio}</p>
            </div>
          </div>
        )}

        {!isComb && solicitudCompra && (
          <div className="space-y-6 text-gray-900 font-sans">
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
