import React, { useRef } from 'react';
import { X, Printer, Download } from 'lucide-react';
import { SolicitudCombustible, CombustibleConfig } from '../../types/combustible';

interface CombustiblePdfModalProps {
  solicitud: SolicitudCombustible;
  config: CombustibleConfig;
  onClose: () => void;
}

export default function CombustiblePdfModal({
  solicitud,
  config,
  onClose
}: CombustiblePdfModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  const fechaEnvioFormateada = solicitud.fecha_envio_completa || `${solicitud.fecha_solicitud || new Date().toISOString().split('T')[0]} ${solicitud.hora_solicitud || '12:00:00'}`;

  // Tipografía dinámica
  const getFontFamilyClass = () => {
    switch (config.pdfFontFamily) {
      case 'serif':
        return 'font-serif';
      case 'mono':
        return 'font-mono';
      default:
        return 'font-sans';
    }
  };

  // Tamaño de letra dinámico
  const getFontSizeClass = () => {
    switch (config.pdfFontSize) {
      case 'small':
        return 'text-xs';
      case 'large':
        return 'text-base';
      default:
        return 'text-sm';
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-xs flex flex-col items-center justify-start p-4 md:p-8">
      
      {/* Barra de control superior */}
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-lg p-4 mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Printer className="w-5 h-5 text-emerald-600" />
          <span className="font-bold text-gray-900 text-sm">
            Vista Previa de Documento Oficial PDF (Tamaño Carta / Letter)
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handlePrint}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md transition cursor-pointer"
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

      {/* DOCUMENTO OFICIAL PDF (DOCUMENTO 3 ADJUNTO) */}
      <div
        ref={printAreaRef}
        id="hoja-solicitud-combustible-print"
        className={`w-full max-w-[816px] min-h-[1056px] bg-white text-black p-10 md:p-14 shadow-2xl relative flex flex-col justify-between border border-gray-300 leading-relaxed ${getFontFamilyClass()} ${getFontSizeClass()} print:m-0 print:p-8 print:shadow-none print:border-none print:w-full`}
        style={{ boxSizing: 'border-box' }}
      >
        {/* Marca de agua institucional */}
        {config.pdfWatermark && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden"
            style={{ opacity: Number(config.pdfWatermarkOpacity) || 0.08 }}
          >
            <span className="text-5xl md:text-6xl font-black uppercase text-gray-900 transform -rotate-45 text-center leading-relaxed max-w-lg">
              {config.pdfWatermarkText}
            </span>
          </div>
        )}

        <div className="relative z-10 space-y-6">
          
          {/* Encabezado: Logo + Título Oficial + Fecha/Hora */}
          <div className="flex items-center justify-between border-b-2 border-black pb-4">
            
            <div className="flex items-center space-x-4">
              {config.pdfMostrarLogoHeader && (
                config.pdfLogoHeaderUrl ? (
                  <img
                    src={config.pdfLogoHeaderUrl}
                    alt="Logo Principal Cruz Verde"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                    className={`object-contain ${
                      config.pdfLogoSize === 'small' ? 'w-12 h-12' : config.pdfLogoSize === 'large' ? 'w-20 h-20' : 'w-16 h-16'
                    }`}
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full border-2 border-green-800 bg-white flex flex-col items-center justify-center text-center p-1 shrink-0 shadow-xs">
                    <span className="text-[7px] font-bold text-green-900 leading-none">CRUZ VERDE</span>
                    <span className="text-2xl font-black text-green-800 leading-none my-0.5">+</span>
                    <span className="text-[7px] font-bold text-green-900 leading-none">EL SALVADOR</span>
                  </div>
                )
              )}

              <div>
                <h1 className="text-lg md:text-xl font-black text-gray-900 tracking-wider uppercase">
                  {config.pdfTitulo}
                </h1>
                <h2 className="text-sm md:text-base font-extrabold text-gray-800 tracking-wide uppercase mt-0.5">
                  {config.pdfSubtitulo}
                </h2>
                <span className="text-xs text-gray-600 block mt-0.5">
                  Folio: <strong className="text-black font-mono">{solicitud.folio}</strong>
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {config.pdfMostrarLogoSecundario && config.pdfLogoSecundarioUrl && (
                <img
                  src={config.pdfLogoSecundarioUrl}
                  alt="Logo Secundario / Cooperante"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                  className={`object-contain ${
                    config.pdfLogoSecundarioSize === 'small' ? 'w-10 h-10' : config.pdfLogoSecundarioSize === 'large' ? 'w-18 h-18' : 'w-14 h-14'
                  }`}
                />
              )}

              <div className="text-right text-xs space-y-1">
                <span className="text-gray-500 block text-3xs uppercase tracking-wider">
                  Fecha y Hora de Solicitud:
                </span>
                <span className="font-bold text-gray-900 block font-mono">
                  {fechaEnvioFormateada}
                </span>
                <span className="inline-block px-2 py-0.5 rounded bg-gray-100 font-semibold border border-gray-300 text-2xs">
                  Estado: {solicitud.estado}
                </span>
              </div>
            </div>

          </div>

          {/* Grid de 2 Columnas de Tarjetas Grises Redondeadas (Documento 3) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            
            {/* 1. Nombre del solicitante */}
            <div className="bg-[#f3f4f6] rounded-xl p-3 border border-gray-200">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                {config.pdfLabelSolicitante}:
              </span>
              <span className="font-bold text-gray-900 block">
                {solicitud.nombre_solicitante}
              </span>
            </div>

            {/* 2. Seccional */}
            <div className="bg-[#f3f4f6] rounded-xl p-3 border border-gray-200">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                {config.pdfLabelSeccional}:
              </span>
              <span className="font-bold text-gray-900 block">
                {solicitud.seccional_nombre}
              </span>
            </div>

            {/* 3. Director de la seccional */}
            <div className="bg-[#f3f4f6] rounded-xl p-3 border border-gray-200">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                {config.pdfLabelDirector}:
              </span>
              <span className="font-semibold text-gray-900 block">
                {solicitud.director_nombre}
              </span>
            </div>

            {/* 4. Actividad o Eventualidad */}
            <div className="bg-[#f3f4f6] rounded-xl p-3 border border-gray-200">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                {config.pdfLabelActividad}:
              </span>
              <span className="font-semibold text-gray-900 block">
                {solicitud.actividad}
              </span>
            </div>

            {/* 5. Correo Electronico */}
            <div className="bg-[#f3f4f6] rounded-xl p-3 border border-gray-200">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                {config.pdfLabelCorreo}:
              </span>
              <span className="font-semibold text-gray-900 block break-all">
                {solicitud.correo_electronico}
              </span>
            </div>

            {/* 6. Contacto */}
            <div className="bg-[#f3f4f6] rounded-xl p-3 border border-gray-200">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                {config.pdfLabelContacto}:
              </span>
              <span className="font-semibold text-gray-900 block">
                {solicitud.telefono_solicitante}
              </span>
            </div>

            {/* 7. A entregado liquidación de combustible del mes anterior? */}
            <div className="bg-[#f3f4f6] rounded-xl p-3 border border-gray-200">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                {config.pdfLabelLiquidacion}
              </span>
              <span className="font-bold text-gray-900 block">
                {solicitud.entrego_liquidacion_anterior ? 'Sí' : 'No'}
              </span>
            </div>

            {/* 8. En caso de responder NO, favor especifique */}
            <div className="bg-[#f3f4f6] rounded-xl p-3 border border-gray-200">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                {config.pdfLabelMotivo}:
              </span>
              <span className="font-medium text-gray-900 block">
                {solicitud.entrego_liquidacion_anterior ? 'N/A' : (solicitud.motivo_no_liquidacion || 'No especificado')}
              </span>
            </div>

            {/* 9. Observaciones (Ancho Completo) */}
            <div className="md:col-span-2 bg-[#f3f4f6] rounded-xl p-3 border border-gray-200">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
                {config.pdfLabelObservaciones}
              </span>
              <span className="font-medium text-gray-800 block">
                {solicitud.observaciones || 'Sin observaciones adicionales registradas.'}
              </span>
            </div>

          </div>

          {/* Sección de Firmas (2 Recuadros Idénticos a Documento 3) */}
          <div className="grid grid-cols-2 gap-4 pt-6">
            
            {/* Recuadro 1: Llenado por solicitante */}
            <div className="border-2 border-black rounded-lg p-4 flex flex-col justify-between min-h-[160px] bg-white">
              <div className="border-b border-black pb-1 mb-2 text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-black">
                  {config.pdfLabelFirmaSolicitante}
                </span>
              </div>

              {/* Espacio Firma */}
              <div className="my-auto text-center">
                <div className="w-48 border-b border-dashed border-gray-400 mx-auto mb-1"></div>
                <span className="text-3xs text-gray-500 uppercase">Firma del Solicitante</span>
              </div>

              <div className="space-y-1 text-xs pt-2 border-t border-gray-200">
                <p>
                  <strong>{config.pdfLabelDui}</strong> {solicitud.nombre_solicitante}
                </p>
                <p>
                  <strong>{config.pdfLabelFecha}</strong> {solicitud.fecha_solicitud}
                </p>
              </div>
            </div>

            {/* Recuadro 2: Llenado por Area Administrativa */}
            <div className="border-2 border-black rounded-lg p-4 flex flex-col justify-between min-h-[160px] bg-white">
              <div className="border-b border-black pb-1 mb-2 text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-black">
                  {config.pdfLabelFirmaAdmin}
                </span>
              </div>

              {/* Espacio Firma y Sello */}
              <div className="my-auto text-center relative py-1">
                {config.pdfMostrarSelloImg && config.pdfSelloImgUrl ? (
                  <div className={`flex items-center my-1 ${
                    config.pdfSelloImgPosicion === 'left' ? 'justify-start' : config.pdfSelloImgPosicion === 'right' ? 'justify-end' : 'justify-center'
                  }`}>
                    <img
                      src={config.pdfSelloImgUrl}
                      alt="Sello Oficial"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                      className={`object-contain opacity-90 ${
                        config.pdfSelloImgSize === 'small' ? 'h-12 max-w-[120px]' : config.pdfSelloImgSize === 'large' ? 'h-20 max-w-[200px]' : 'h-16 max-w-[160px]'
                      }`}
                    />
                  </div>
                ) : (
                  <div className="w-48 border-b border-dashed border-gray-400 mx-auto mb-1"></div>
                )}
                <span className="text-3xs text-gray-500 uppercase block">{config.pdfLabelFirmaSello}</span>
              </div>

              <div className="space-y-1 text-xs pt-2 border-t border-gray-200">
                <p>
                  <strong>{config.pdfLabelAutoriza}</strong> {solicitud.autorizado_por || 'Área Administrativa Central'}
                </p>
                <p>
                  <strong>{config.pdfLabelFechaAuto}</strong> {solicitud.fecha_autorizacion ? new Date(solicitud.fecha_autorizacion).toLocaleDateString('es-SV') : 'Pendiente de autorización'}
                </p>
              </div>
            </div>

          </div>

        </div>

        {/* Pie de página institucional (Documento 3) */}
        <div className="relative z-10 pt-6 mt-6 border-t border-gray-400 flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center space-x-2">
            {config.pdfMostrarLogoFooter && (
              config.pdfLogoFooterUrl ? (
                <img 
                  src={config.pdfLogoFooterUrl} 
                  alt="Logo" 
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                  className="w-7 h-7 object-contain" 
                />
              ) : (
                <div className="w-7 h-7 rounded-full border border-green-800 flex items-center justify-center font-bold text-green-900 text-xs">
                  +
                </div>
              )
            )}
            <span className="font-semibold text-3xs uppercase tracking-wider text-gray-800">
              Cruz Verde Salvadoreña • Departamento Administrativo
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <span className="font-mono font-bold text-gray-900 text-xs">
              {config.pdfCodigoFormulario}
            </span>
            <span className="text-3xs text-gray-500">
              Página 1/1
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}
