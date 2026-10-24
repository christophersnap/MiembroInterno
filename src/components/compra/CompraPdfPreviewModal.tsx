import React, { useRef } from 'react';
import { X, Printer, Download, Eye, Sparkles, Check } from 'lucide-react';
import { CompraConfig } from '../../types/compra';
import { SolicitudCompra } from '../../pages/SolicitudesCompra';

interface CompraPdfPreviewModalProps {
  solicitud?: SolicitudCompra;
  config: CompraConfig;
  onClose: () => void;
}

export default function CompraPdfPreviewModal({
  solicitud: propSolicitud,
  config,
  onClose
}: CompraPdfPreviewModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Solicitud de ejemplo para previsualización si no se proporciona una
  const solicitud: SolicitudCompra = propSolicitud || {
    id: 999,
    folio: 'SC-2026-DEMO',
    seccional_id: 1,
    seccional_nombre: 'Santa Anita',
    solicitado_por: 'Lic. Roberto Gómez',
    cargo: 'Director Seccional',
    user_email: 'santaanita@cruzverdesv.org',
    tipo_solicitud: 'Repuestos para Vehículo',
    es_para_vehiculo: true,
    vehiculo_id: 1,
    vehiculo_placa: 'CVS-014',
    vehiculo_descripcion: 'Toyota Land Cruiser HZJ78 (Ambulancia)',
    descripcion: 'Solicitud urgente de pastillas de freno delanteras y cambio de filtro de aceite para la unidad asignada a turnos nocturnos y traslados de emergencia.',
    monto_estimado: 145.50,
    proveedor_sugerido: 'Auto Repuestos El Salvador S.A.',
    prioridad: 'Urgente',
    lugar_fecha: 'San Salvador, 15 de agosto de 2026',
    fecha_solicitud: new Date().toISOString().split('T')[0],
    hora_solicitud: '10:30:00',
    estado: 'Aprobada',
    autorizado_por: 'Jefatura de Operaciones / Compras'
  };

  const getFontFamilyClass = () => {
    switch (config.pdfFontFamily) {
      case 'serif': return 'font-serif';
      case 'mono': return 'font-mono';
      default: return 'font-sans';
    }
  };

  const getFontSizeClass = () => {
    switch (config.pdfFontSize) {
      case 'small': return 'text-xs';
      case 'large': return 'text-base';
      default: return 'text-sm';
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Renderizar bloques en el orden configurado por arrastre
  const renderBlock = (blockId: string, align: 'left' | 'center' | 'right') => {
    const alignClass = align === 'center' ? 'text-center items-center justify-center' : align === 'right' ? 'text-right items-end justify-end' : 'text-left items-start justify-start';

    switch (blockId) {
      case 'encabezado': {
        const showLogo1 = config.pdfMostrarLogo && config.pdfLogoPosicion !== 'none';
        const showLogo2 = config.pdfMostrarLogoSecundario && config.pdfLogoSecundarioUrl && config.pdfLogoSecundarioPosicion !== 'none';

        const logo1Element = showLogo1 ? (
          config.pdfLogoUrl ? (
            <img
              src={config.pdfLogoUrl}
              alt="Logo Oficial"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
              className={`object-contain ${
                config.pdfLogoSize === 'small' ? 'h-10' : config.pdfLogoSize === 'large' ? 'h-20' : 'h-14'
              }`}
            />
          ) : (
            <div className="w-12 h-12 rounded-full border-2 border-green-800 flex items-center justify-center bg-white text-green-800 font-bold shadow-xs">
              <span className="text-2xl leading-none font-black text-green-700">+</span>
            </div>
          )
        ) : null;

        const logo2Element = showLogo2 ? (
          <img
            src={config.pdfLogoSecundarioUrl}
            alt="Logo Secundario"
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
            className={`object-contain ${
              config.pdfLogoSecundarioSize === 'small' ? 'h-10' : config.pdfLogoSecundarioSize === 'large' ? 'h-20' : 'h-14'
            }`}
          />
        ) : null;

        // Distribución inteligente si hay 2 logos en esquinas opuestas
        const isHeaderSplit = (config.pdfLogoPosicion === 'left' && config.pdfLogoSecundarioPosicion === 'right') ||
                              (config.pdfLogoPosicion === 'right' && config.pdfLogoSecundarioPosicion === 'left');

        if (isHeaderSplit) {
          return (
            <div key={blockId} className="flex items-center justify-between border-b-2 border-green-800 pb-4 gap-4">
              <div className="shrink-0">
                {config.pdfLogoPosicion === 'left' ? logo1Element : logo2Element}
              </div>
              <div className="text-center flex-1">
                <h1 className="text-xl md:text-2xl font-black tracking-tight text-gray-950 uppercase leading-none">
                  {config.pdfTitulo}
                </h1>
                <p className="text-xs md:text-sm font-bold tracking-widest text-green-900 mt-1 uppercase">
                  {config.pdfDepartamento}
                </p>
              </div>
              <div className="shrink-0">
                {config.pdfLogoPosicion === 'right' ? logo1Element : logo2Element}
              </div>
            </div>
          );
        }

        return (
          <div key={blockId} className={`flex flex-col ${alignClass} border-b-2 border-green-800 pb-4`}>
            {/* Logos con posición individual */}
            <div className="w-full flex flex-wrap items-center justify-between gap-2 mb-2">
              {showLogo1 && (
                <div className={`flex w-full ${
                  config.pdfLogoPosicion === 'center' ? 'justify-center' : config.pdfLogoPosicion === 'right' ? 'justify-end' : 'justify-start'
                }`}>
                  {logo1Element}
                </div>
              )}
              {showLogo2 && (
                <div className={`flex w-full ${
                  config.pdfLogoSecundarioPosicion === 'center' ? 'justify-center' : config.pdfLogoSecundarioPosicion === 'right' ? 'justify-end' : 'justify-start'
                }`}>
                  {logo2Element}
                </div>
              )}
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-gray-950 uppercase leading-none">
              {config.pdfTitulo}
            </h1>
            <p className="text-xs md:text-sm font-bold tracking-widest text-green-900 mt-1 uppercase">
              {config.pdfDepartamento}
            </p>
          </div>
        );
      }

      case 'subtitulo_folio':
        return (
          <div key={blockId} className="flex flex-col sm:flex-row items-center justify-between border-b border-gray-300 pb-2 pt-2 gap-2">
            <div className="text-center sm:text-left">
              <span className="text-sm font-black text-gray-900 uppercase tracking-wide bg-gray-100 px-3 py-1 rounded">
                {config.pdfSubtitulo}
              </span>
            </div>
            <div className="flex items-center space-x-4 text-xs font-mono">
              <div className="bg-gray-100 border border-gray-300 px-2.5 py-1 rounded">
                <span className="text-gray-500 font-sans mr-1">FOLIO:</span>
                <span className="font-bold text-green-900">{solicitud.folio}</span>
              </div>
              {config.pdfMostrarFechaHora && (
                <div className="text-gray-600 font-sans text-xs">
                  {solicitud.fecha_solicitud} • {solicitud.hora_solicitud || '10:00 AM'}
                </div>
              )}
            </div>
          </div>
        );

      case 'datos_seccional':
        return (
          <div key={blockId} className="bg-gray-50/70 border border-gray-200 rounded-lg p-3 text-xs space-y-1.5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <span className="font-bold text-gray-700">{config.pdfLabelSolicitante} </span>
                <span className="font-semibold text-gray-900">{solicitud.solicitado_por}</span>
              </div>
              <div>
                <span className="font-bold text-gray-700">{config.pdfLabelCargo} </span>
                <span className="text-gray-900">{solicitud.cargo || 'Director'}</span>
              </div>
              <div>
                <span className="font-bold text-gray-700">{config.pdfLabelSeccional} </span>
                <span className="font-bold text-green-900">{solicitud.seccional_nombre}</span>
              </div>
              <div>
                <span className="font-bold text-gray-700">Correo Seccional: </span>
                <span className="font-mono text-gray-800">{solicitud.user_email || `${solicitud.seccional_nombre.toLowerCase().replace(/[^a-z0-9]/g, '')}@cruzverdesv.org`}</span>
              </div>
            </div>
          </div>
        );

      case 'rubro_vehiculo':
        return (
          <div key={blockId} className="border border-gray-300 rounded-lg p-3 text-xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-bold text-gray-700">{config.pdfLabelTipo} </span>
                <span className="font-semibold text-gray-900 uppercase bg-gray-100 px-2 py-0.5 rounded">
                  {solicitud.tipo_solicitud}
                </span>
              </div>
              {config.pdfMostrarUrgencia && (
                <div className="flex items-center space-x-1">
                  <span className="font-bold text-gray-700">Prioridad: </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    solicitud.prioridad === 'Emergencia' ? 'bg-red-100 text-red-800' :
                    solicitud.prioridad === 'Urgente' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {solicitud.prioridad || 'Normal'}
                  </span>
                </div>
              )}
            </div>

            {config.pdfMostrarVehiculo && solicitud.es_para_vehiculo && (
              <div className="bg-blue-50/60 border border-blue-200 rounded p-2 text-xs flex items-center justify-between">
                <div>
                  <span className="font-bold text-blue-950">{config.pdfLabelVehiculo} </span>
                  <span className="text-blue-900">{solicitud.vehiculo_descripcion || 'Unidad Institucional'}</span>
                </div>
                <div>
                  <span className="font-bold text-blue-950">{config.pdfLabelPlaca} </span>
                  <span className="font-mono font-bold text-blue-900">{solicitud.vehiculo_placa || 'N/A'}</span>
                </div>
              </div>
            )}
          </div>
        );

      case 'costo_urgencia':
        if (!config.pdfMostrarCostos) return null;
        return (
          <div key={blockId} className="flex items-center justify-between bg-amber-50/50 border border-amber-200 rounded-lg px-4 py-2 text-xs">
            <div className="flex items-center flex-wrap gap-2">
              <div>
                <span className="font-bold text-gray-800">{config.pdfLabelMonto} </span>
                <span className="text-sm font-black text-emerald-800">
                  {solicitud.monto_estimado ? `$${solicitud.monto_estimado.toFixed(2)} USD` : 'Por cotizar formalmente'}
                </span>
              </div>
              {solicitud.cotizaciones_archivos && solicitud.cotizaciones_archivos.length > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-3xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                  📎 {solicitud.cotizaciones_archivos.length} cotización(es) adjunta(s)
                </span>
              )}
            </div>
            <div className="text-2xs text-gray-500 italic">
              Sujeto a verificación y cuadro comparativo de compras
            </div>
          </div>
        );

      case 'descripcion_cuerpo':
        return (
          <div key={blockId} className="space-y-1.5">
            <span className="font-bold text-xs text-gray-800 block uppercase tracking-wide">
              {config.pdfLabelDescripcion}
            </span>
            <div className="border border-gray-300 rounded-lg p-4 bg-white text-xs leading-relaxed min-h-[140px] whitespace-pre-wrap font-sans text-gray-900 shadow-2xs">
              {solicitud.descripcion || 'Sin descripción ingresada.'}
            </div>
          </div>
        );

      case 'proveedor_taller':
        if (!config.pdfMostrarProveedor || !solicitud.proveedor_sugerido) return null;
        return (
          <div key={blockId} className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs">
            <span className="font-bold text-gray-700">{config.pdfLabelProveedor} </span>
            <span className="font-semibold text-gray-900">{solicitud.proveedor_sugerido}</span>
          </div>
        );

      case 'firmas_sello': {
        const showSelloImg = config.pdfMostrarSelloImg && config.pdfSelloImgUrl && config.pdfSelloImgPosicion !== 'none';
        const showSelloDefault = config.pdfMostrarSello && !showSelloImg;

        return (
          <div key={blockId} className="pt-8 pb-4">
            <div className="grid grid-cols-3 gap-6 items-end text-center font-sans">
              {/* Firma 1: Solicitante */}
              <div className="flex flex-col items-center">
                <div className="w-full border-b border-black pb-1 mb-1">
                  <span className="text-xs font-bold text-gray-900 block truncate">
                    {solicitud.solicitado_por}
                  </span>
                </div>
                <span className="text-2xs font-black tracking-wider uppercase text-gray-900">
                  {config.pdfFirma1Titulo}
                </span>
                <span className="text-3xs text-gray-500 uppercase mt-0.5">
                  {config.pdfFirma1Subtitulo}
                </span>
              </div>

              {/* Sello Oficial / Imagen personalizada de sello */}
              {showSelloImg ? (
                <div className={`flex flex-col items-center justify-center ${
                  config.pdfSelloImgPosicion === 'left' ? 'items-start' : config.pdfSelloImgPosicion === 'right' ? 'items-end' : 'items-center'
                }`}>
                  <img
                    src={config.pdfSelloImgUrl}
                    alt="Sello Oficial"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                    className={`object-contain ${
                      config.pdfSelloImgSize === 'small' ? 'h-14' : config.pdfSelloImgSize === 'large' ? 'h-24' : 'h-18'
                    }`}
                  />
                  <span className="text-3xs font-bold text-gray-700 mt-1 uppercase">
                    Sello Oficial
                  </span>
                </div>
              ) : showSelloDefault ? (
                <div className="flex flex-col items-center justify-center">
                  <div className="w-22 h-22 rounded-full border-2 border-green-800 flex flex-col items-center justify-center text-center p-1 text-green-900">
                    <span className="text-3xs font-black tracking-tighter leading-none uppercase">{config.pdfSelloTextoSuperior}</span>
                    <span className="text-2xl font-black text-green-700 leading-tight">+</span>
                    <span className="text-3xs font-black tracking-tighter leading-none uppercase">{config.pdfSelloTextoInferior}</span>
                  </div>
                  <span className="text-3xs font-bold text-gray-700 mt-1 uppercase">
                    Sello Oficial
                  </span>
                </div>
              ) : (
                <div />
              )}

              {/* Firma 2: Autorización */}
              <div className="flex flex-col items-center">
                <div className="w-full border-b border-black pb-1 mb-1 min-h-[20px] flex items-center justify-center">
                  {solicitud.autorizado_por ? (
                    <span className="text-xs font-bold text-green-900 block truncate">
                      {solicitud.autorizado_por}
                    </span>
                  ) : (
                    <span className="text-3xs text-gray-400 italic">Pendiente de autorización</span>
                  )}
                </div>
                <span className="text-2xs font-black tracking-wider uppercase text-gray-900">
                  {config.pdfFirma2Titulo}
                </span>
                <span className="text-3xs text-gray-500 uppercase mt-0.5">
                  {config.pdfFirma2Subtitulo}
                </span>
              </div>
            </div>
          </div>
        );
      }

      case 'pie_pagina': {
        const showFooterImg = config.pdfMostrarFooterImg && config.pdfFooterImgUrl && config.pdfFooterImgPosicion !== 'none';

        return (
          <div key={blockId} className="pt-4 border-t border-gray-300 space-y-2">
            {showFooterImg && (
              <div className={`flex w-full ${
                config.pdfFooterImgPosicion === 'center' ? 'justify-center' : config.pdfFooterImgPosicion === 'right' ? 'justify-end' : 'justify-start'
              }`}>
                <img
                  src={config.pdfFooterImgUrl}
                  alt="Cintillo Pie de Página"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                  className={`object-contain ${
                    config.pdfFooterImgSize === 'small' ? 'h-8' : config.pdfFooterImgSize === 'large' ? 'h-16' : 'h-11'
                  }`}
                />
              </div>
            )}
            <div className="flex flex-col sm:flex-row items-center justify-between text-3xs text-gray-500 uppercase gap-1 font-mono">
              <span>{config.pdfPiePagina}</span>
              <span className="font-bold text-gray-700">Folio: {solicitud.folio} • Tamaño Carta</span>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  const activeBlocks = config.pdfBloquesOrden && config.pdfBloquesOrden.length > 0 
    ? config.pdfBloquesOrden.filter(b => b.enabled)
    : [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-xs flex flex-col items-center justify-start p-4 md:p-8 animate-in fade-in">
      
      {/* Barra de control superior */}
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-lg p-4 mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Eye className="w-5 h-5 text-primary" />
          <span className="font-bold text-gray-900 text-sm">
            Previsualización del PDF de Solicitud de Compra (Tamaño Carta)
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handlePrint}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-md transition cursor-pointer"
          >
            <Printer className="w-4 h-4 mr-2" />
            Imprimir / Guardar como PDF
          </button>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* LIENZO DEL DOCUMENTO PDF TAMAÑO CARTA */}
      <div
        ref={printAreaRef}
        id="hoja-solicitud-print"
        className={`w-full max-w-4xl bg-white shadow-2xl p-8 md:p-12 relative min-h-[950px] space-y-4 ${getFontFamilyClass()} ${getFontSizeClass()}`}
        style={{ letterSpacing: '-0.01em' }}
      >
        {/* Marca de agua si está activada */}
        {config.pdfWatermark && (
          <div 
            className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden"
            style={{ opacity: Number(config.pdfWatermarkOpacity) || 0.08 }}
          >
            <span className="text-4xl md:text-5xl font-black text-gray-900 transform -rotate-35 uppercase tracking-widest text-center max-w-2xl">
              {config.pdfWatermarkText}
            </span>
          </div>
        )}

        {/* Renderizado de Bloques en el Orden Configurado */}
        <div className="relative z-10 space-y-4">
          {activeBlocks.map((block) => renderBlock(block.id, block.align))}
        </div>
      </div>
    </div>
  );
}
